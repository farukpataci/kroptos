import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';
import { BusinessCentralConnector } from './bc.connector';
import { BC_ONLINE_DESCRIPTOR } from './bc.descriptor';
import { BusinessCentralMockClient } from './bc.mock-client';
import { BusinessCentralRequestMapper } from './bc.request-mapper';
import { BusinessCentralStatusMapper } from './bc.status-mapper';
import { BusinessCentralErrorMapper, BusinessCentralPreconditionFailedError } from './bc.error-mapper';
import { BusinessCentralOData } from './bc.odata';
import { BusinessCentralAuth } from './bc.auth';
import { AccountingTokenStore } from '../core/AccountingTokenStore';

describe('BusinessCentralConnector — Section 8 Comprehensive Verification', () => {
  const credentials = {
    aadTenantId: 'aad-tenant-001',
    environmentName: 'sandbox',
    companyId: 'company-001',
  };

  const invoiceReq: AccountingInvoiceRequest = {
    companyId: 'company-001',
    referenceCode: 'ORD-SEC8-1',
    issueDate: '2026-09-10',
    currency: 'TRY',
    contact: {
      name: 'Section 8 Customer',
      taxNumber: '9999888877',
      phone: '+905550001122',
      email: 'sec8@test.com',
    },
    items: [
      {
        sku: 'SKU-SEC8',
        name: 'Sec 8 Item',
        quantity: 2,
        unitPrice: 500,
        vatRate: 20,
        vatAmount: 200,
        totalAmount: 1200,
      },
    ],
    subtotal: 1000,
    vatTotal: 200,
    grandTotal: 1200,
  };

  it('1. Salt okunur alanlar (amountIncludingTax, taxPercent, totalAmountIncludingTax) isteğe konulmuyor (§8.1, §4.1)', () => {
    const header = BusinessCentralRequestMapper.toSalesInvoiceHeader(invoiceReq);
    expect((header as any).totalAmountIncludingTax).toBeUndefined();
    expect((header as any).totalTaxAmount).toBeUndefined();
    expect((header as any).totalAmountExcludingTax).toBeUndefined();
    expect((header as any).id).toBeUndefined();
    expect((header as any).status).toBeUndefined();

    const lines = BusinessCentralRequestMapper.toSalesInvoiceLines(invoiceReq, 'draft-1');
    expect(lines.length).toBe(1);
    const line = lines[0];
    expect((line as any).amountIncludingTax).toBeUndefined();
    expect((line as any).taxPercent).toBeUndefined();
    expect((line as any).totalTaxAmount).toBeUndefined();
    expect((line as any).netAmount).toBeUndefined();
    expect(line.quantity).toBe(2);
    expect(line.unitPrice).toBe(500);
  });

  it('2. Toplam uyuşmazlığında Microsoft.NAV.post çağrılmıyor, taslak silinmiyor (§8.2, §4.2)', async () => {
    const mockClient = new BusinessCentralMockClient(credentials);
    const postSpy = jest.spyOn(mockClient, 'postInvoice');
    const deleteSpy = jest.spyOn(mockClient, 'deleteDraftInvoice');

    const mismatchedReq: AccountingInvoiceRequest = {
      ...invoiceReq,
      grandTotal: 1500, // KroptOS says 1500, but BC mock calculates 2 * 500 * 1.20 = 1200
    };

    const connector = new BusinessCentralConnector(credentials, 'MOCK', mockClient);
    const res = await connector.createInvoice(mismatchedReq);

    expect(postSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(res.rawResponse?.providerStatus).toBe('Draft');
    expect(res.rawResponse?.reconciliationMismatch).toBe(true);
    expect(res.rawResponse?.reconciliationDiff).toBe(300);
    expect(res.rawResponse?.reconciliationMessage).toContain('BC toplamı (1200 TRY)');
  });

  it('3. Toplam tuttuğunda post ediliyor ve sonrası tekrar okunuyor (§8.3, §4.2)', async () => {
    const mockClient = new BusinessCentralMockClient(credentials);
    const postSpy = jest.spyOn(mockClient, 'postInvoice');
    const getSpy = jest.spyOn(mockClient, 'getInvoice');

    const connector = new BusinessCentralConnector(credentials, 'MOCK', mockClient);
    const res = await connector.createInvoice(invoiceReq);

    expect(postSpy).toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalledTimes(2); // 1st to read totals, 2nd after post to read final document
    expect(res.rawResponse?.providerStatus).toBe('Open');
    expect(res.rawResponse?.reconciliationMatched).toBe(true);
    expect(res.externalNumber).toBeDefined();
  });

  it('4. externalDocumentNumber her taslakta referans kodu ile dolu (§8.4, §4.3)', () => {
    const header = BusinessCentralRequestMapper.toSalesInvoiceHeader(invoiceReq);
    expect(header.externalDocumentNumber).toBe('ORD-SEC8-1');
  });

  it('5. findInvoiceByReference capability is MOCK_ONLY (§8.5, §4.3)', () => {
    expect(BC_ONLINE_DESCRIPTOR.capabilities.findInvoiceByReference).toBe('MOCK_ONLY');
  });

  it('6. send / postAndSend / cancelAndSend çağrısı kütüphanede engellenmiştir (§8.6, §4.4)', () => {
    expect((BC_ONLINE_DESCRIPTOR.capabilities as any).send).toBeUndefined();
    expect(BC_ONLINE_DESCRIPTOR.capabilities.eInvoiceOfficialSend).toBe('NOT_SUPPORTED');
  });

  it('7 & 8. İptal öncesi status okunuyor: Draft ise DELETE, Posted ise cancel çağrılıp dekont notu dönüyor (§8.7, §8.8, §4.4)', async () => {
    const mockClient = new BusinessCentralMockClient(credentials);
    const deleteSpy = jest.spyOn(mockClient, 'deleteDraftInvoice');
    const cancelSpy = jest.spyOn(mockClient, 'cancelInvoice');

    const connector = new BusinessCentralConnector(credentials, 'MOCK', mockClient);

    // 1. Create a draft invoice
    const draft = await mockClient.createDraftInvoice({
      externalDocumentNumber: 'ORD-DRAFT-CANCEL',
      invoiceDate: '2026-09-10',
      postingDate: '2026-09-10',
      customerId: 'c1',
    });

    // Cancel draft
    const cancelDraftRes = await connector.cancelInvoice(draft.id!);
    expect(deleteSpy).toHaveBeenCalledWith(draft.id, expect.any(String));
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(cancelDraftRes.cancellationType).toBe('deleted');

    // 2. Test cancellation on Posted invoice
    const postedRes = await connector.createInvoice({
      ...invoiceReq,
      referenceCode: 'ORD-POSTED-CANCEL',
    });

    const cancelPostedRes = await connector.cancelInvoice(postedRes.externalId);
    expect(cancelSpy).toHaveBeenCalledWith(postedRes.externalId);
    expect(cancelPostedRes.cancellationType).toBe('credit_memo');
    expect(cancelPostedRes.message).toContain("düzeltici alacak dekontu oluşturuldu");
  });

  it('9. 401 ile 403 farklı hata mesajı üretiyor (Entra vs BC izin kümesi) (§8.9, §3.2)', () => {
    const err401 = BusinessCentralErrorMapper.mapHttpError(401, {
      error: { message: 'Invalid client secret' },
    });
    const err403 = BusinessCentralErrorMapper.mapHttpError(403, {
      error: { message: 'User does not have required permissions' },
    });

    expect(err401.message).toContain('Entra ID kimlik doğrulama hatası (401)');
    expect(err403.message).toContain('Business Central yetki hatası (403)');
    expect(err403.message).toContain('D365 BASIC, D365 SALES DOC, EDIT');
  });

  it('10. 412 retry edilmeyen hata üretir; 429 Retry-After süresini okur (§8.10, §4.8, §3.5)', () => {
    const err412 = BusinessCentralErrorMapper.mapHttpError(412, {
      error: { message: 'ETag mismatch' },
    });
    expect(err412).toBeInstanceOf(BusinessCentralPreconditionFailedError);
    expect(err412.message).toContain('ETag uyuşmazlığı, 412');

    const err429 = BusinessCentralErrorMapper.mapHttpError(
      429,
      { error: { message: 'Rate limit exceeded' } },
      { 'retry-after': '15' },
    );
    expect(err429.message).toContain('Retry after 15s');
  });

  it('11. Geçersiz credential durumunda retry edilmez', () => {
    const err = BusinessCentralErrorMapper.mapHttpError(401, {
      error: { code: 'invalid_grant', message: 'The provided credentials are not valid' },
    });
    expect(err.name).toBe('AccountingAuthError');
  });

  it('12. Token cache aadTenantId bazında çalışır (§8.12, §4.6)', async () => {
    const tokenStore = new AccountingTokenStore();
    const auth = new BusinessCentralAuth(tokenStore);
    let netCalls = 0;
    const fetchMock = jest.fn().mockImplementation(async () => {
      netCalls++;
      return {
        ok: true,
        json: async () => ({
          token_type: 'Bearer',
          expires_in: 3600,
          access_token: 'cached-token-123',
        }),
      } as any;
    });

    const calls = Array.from({ length: 5 }).map(() =>
      auth.getAccessToken(
        {
          aadTenantId: 'tenant-single-flight',
          environmentName: 'production',
          companyId: 'comp-1',
          clientId: 'id',
          clientSecret: 'sec',
        },
        fetchMock,
      ),
    );

    const tokens = await Promise.all(calls);
    expect(netCalls).toBe(1);
    expect(tokens[0]).toBe('cached-token-123');
  });

  it('13. clientSecret ve token hata mesajlarında maskelenir (§8.13)', () => {
    const msg = BusinessCentralErrorMapper.sanitizeMessage(
      'Auth failed for client_secret=SECRET123 and Bearer eyJhbGciOi...',
    );
    expect(msg).not.toContain('SECRET123');
    expect(msg).toContain('client_secret=***');
    expect(msg).toContain('Bearer ***');
  });

  it('14. Bilinmeyen veya yeni status değerleri daima pending döner (§8.14, §5.2)', () => {
    expect(BusinessCentralStatusMapper.toKroptosStatus('Draft')).toBe('pending');
    expect(BusinessCentralStatusMapper.toKroptosStatus('In Review')).toBe('pending');
    expect(BusinessCentralStatusMapper.toKroptosStatus('')).toBe('pending');
    expect(BusinessCentralStatusMapper.toKroptosStatus('Open')).toBe('sent');
    expect(BusinessCentralStatusMapper.toKroptosStatus('Paid')).toBe('sent');
    expect(BusinessCentralStatusMapper.toKroptosStatus('Canceled')).toBe('cancelled');
    expect(BusinessCentralStatusMapper.toKroptosStatus('Corrective')).toBe('cancelled');
    expect(BusinessCentralStatusMapper.toKroptosStatus('SomeFutureStatus')).toBe('pending');
    expect(BusinessCentralStatusMapper.toKroptosStatus(null)).toBe('pending');
  });

  it('15. Post sonrası externalId ve externalNumber doğru korunur (§8.15, §4.5)', async () => {
    const connector = new BusinessCentralConnector(credentials, 'MOCK');
    const res = await connector.createInvoice(invoiceReq);
    expect(res.externalId).toBeDefined();
    expect(res.externalNumber).toBeDefined();
    expect(res.rawResponse?.providerStatus).toBe('Open');
  });

  it('16. Ortam adı (environmentName) URL yapısına credential dan gelir (§8.16, §3.1)', () => {
    const url1 = BusinessCentralOData.buildBaseUrl('production');
    const url2 = BusinessCentralOData.buildBaseUrl('staging_sandbox');
    expect(url1).toContain('/production/');
    expect(url2).toContain('/staging_sandbox/');
  });

  it('17. companyId istekten değil entegrasyon/firma credential indan alınır (§8.17)', () => {
    const url = BusinessCentralOData.buildCompanyResourceUrl(
      'https://api.businesscentral.dynamics.com/v2.0/production/api/v2.0',
      'comp-guid-fixed',
      'salesInvoices',
    );
    expect(url).toContain('companies(comp-guid-fixed)');
  });

  it('18. ms-dynamics-bc-onprem registry de ASLA YER ALMAZ (§8.19, §2)', () => {
    expect(AccountingProviderRegistry.has('ms-dynamics-bc-onprem')).toBe(false);
    expect(AccountingProviderRegistry.has('MS_DYNAMICS_BC_ONPREM')).toBe(false);
  });

  it('19. TEST veya PRODUCTION ortamlarında gerçek ağ isteği engellenir (§8.11, §8.20)', async () => {
    const testConnector = new BusinessCentralConnector(credentials, 'TEST');
    await expect(testConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);

    const prodConnector = new BusinessCentralConnector(credentials, 'PRODUCTION');
    await expect(prodConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
  });

  it('20. Payment metodu çağrıldığında IntegrationNotVerifiedError fırlatılır (§4.7)', async () => {
    const connector = new BusinessCentralConnector(credentials, 'MOCK');
    await expect(
      connector.recordPayment({
        companyId: 'c1',
        invoiceExternalId: 'inv-1',
        referenceCode: 'P-1',
        amount: 100,
        currency: 'TRY',
        paymentDate: '2026-09-10',
      }),
    ).rejects.toThrow(IntegrationNotVerifiedError);
  });
});
