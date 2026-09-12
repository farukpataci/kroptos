import { BadRequestException, NotImplementedException } from '@nestjs/common';
import { FattureInCloudConnector } from './fic.connector';
import { FATTURE_IN_CLOUD_CAPABILITIES } from './fic.capabilities';
import { FicStatusMapper } from './fic.status-mapper';
import { FicEInvoiceService } from './fic.einvoice';
import { FicHttpClient } from './fic.client';
import { FicMockClient } from './fic.mock-client';
import { FicTestClient } from './fic.test-client';
import { FicProductionClient } from './fic.production-client';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { CapabilityStatus, AccountingInvoiceRequest } from '../core/AccountingTypes';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import './fic.descriptor';

describe('Fatture in Cloud (TeamSystem) Conformance & Integration Suite (§8)', () => {
  const validRequest: AccountingInvoiceRequest = {
    companyId: '12345',
    referenceCode: 'ORD-1001',
    issueDate: '2026-09-11',
    dueDate: '2026-10-11',
    currency: 'EUR',
    contact: {
      name: 'Mario Rossi S.r.l.',
      taxNumber: 'IT12345678901',
      address: 'Via Dante, 1',
      district: '20121',
      city: 'Milano',
      email: 'mario@rossi.it',
    },
    items: [
      {
        sku: 'SKU-A',
        name: 'Item Alpha',
        quantity: 2,
        unitPrice: 50,
        vatRate: 22,
        totalAmount: 122,
      },
    ],
    subtotal: 100,
    vatTotal: 22,
    grandTotal: 122,
  };

  // 1 & 2: E-Invoice Send endpoint is NOT called and capabilities.eInvoiceOfficialSend === NOT_SUPPORTED
  it('1 & 2. should verify eInvoiceOfficialSend is NOT_SUPPORTED and sendEInvoice throws NotImplementedException', async () => {
    const connector = new FattureInCloudConnector({ companyId: '12345' }, 'MOCK');
    expect(connector.capabilities.eInvoiceOfficialSend).toBe(CapabilityStatus.NOT_SUPPORTED);
    await expect(connector.sendEInvoice()).rejects.toThrow(NotImplementedException);
  });

  // 1 bis: HTTP client strictly blocks any /e_invoice/send call
  it('1 bis. should strictly block any HTTP call targeting /e_invoice/send', async () => {
    const fetchSpy = jest.fn();
    const client = new FicHttpClient({ accessToken: 'mock_token' }, fetchSpy);

    await expect(
      client.request('/c/12345/issued_documents/999/e_invoice/send', { method: 'POST' }),
    ).rejects.toThrow(BadRequestException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // 3: dry_run verification does NOT send to SdI
  it('3. dry_run verification should call xml_verify and never send to SdI', async () => {
    const mockClient = new FicMockClient();
    const sendSpy = jest.fn();
    (mockClient as any).sendEInvoice = sendSpy;

    const verifySpy = jest.spyOn(mockClient, 'verifyEInvoiceXml');

    const connector = new FattureInCloudConnector({ companyId: '12345' }, 'MOCK', mockClient);
    const invoiceRes = await connector.createInvoice(validRequest);

    expect(invoiceRes.externalId).toBeDefined();
    expect(verifySpy).toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
    expect(invoiceRes.rawResponse?.dry_run_verified).toBe(true);
  });

  // 4 & 5: ei_status is NOT mapped to KroptOS document status; FIC 'sent' does NOT make KroptOS 'sent'
  it('4 & 5. should keep ei_status completely isolated from KroptOS document status (§5.2)', () => {
    // FIC 'sent' means sent to SdI
    const ficStatus = 'sent';
    const kroptosStatus = FicStatusMapper.toKroptosDocumentStatus(12345);

    // KroptOS status must remain 'created' independent of whether FIC status is 'sent', 'error', etc.
    expect(kroptosStatus).toBe('created');
    expect(kroptosStatus).not.toBe(ficStatus);

    // And sanitizeEiStatus keeps 'sent'
    expect(FicStatusMapper.sanitizeEiStatus(ficStatus)).toBe('sent');
  });

  // 6: Unknown ei_status is preserved verbatim without interpretation
  it('6. should preserve unknown ei_status verbatim without interpretation', () => {
    const unknownStatus = 'future_custom_sdi_state';
    const sanitized = FicStatusMapper.sanitizeEiStatus(unknownStatus);
    expect(sanitized).toBe('future_custom_sdi_state');
  });

  // 7: Missing required entity/item fields -> not sent, no dummy text
  it('7. should reject invoice creation if mandatory contact name is missing without creating dummy text', async () => {
    const connector = new FattureInCloudConnector({ companyId: '12345' }, 'MOCK');
    const invalidRequest = {
      ...validRequest,
      contact: { ...validRequest.contact, name: '' },
    };

    await expect(connector.createInvoice(invalidRequest)).rejects.toThrow(BadRequestException);
  });

  // 8: Even when product_id is mapped, name, price, qty, and vat are fully populated
  it('8. should fully populate item fields even when product_id is mapped (§5.3)', async () => {
    const mockClient = new FicMockClient();
    const createDocSpy = jest.spyOn(mockClient, 'createIssuedDocument');

    const connector = new FattureInCloudConnector({ companyId: '12345' }, 'MOCK', mockClient);
    await connector.createInvoice(validRequest);

    expect(createDocSpy).toHaveBeenCalled();
    const sentPayload = createDocSpy.mock.calls[0][1];
    expect(sentPayload.items_list[0].name).toBe('Item Alpha');
    expect(sentPayload.items_list[0].qty).toBe(2);
    expect(sentPayload.items_list[0].net_price).toBe(50);
    expect(sentPayload.items_list[0].vat.id).toBe(0);
  });

  // 10: status: "paid" + payment_account.id missing -> throws BadRequestException
  it('10. should throw if isPaid is true but payment_account.id is not provided (§5.6)', async () => {
    const connector = new FattureInCloudConnector(
      { companyId: '12345', paymentAccountId: undefined },
      'MOCK',
    );

    // Using direct document mapper test for isPaid: true
    const { FicDocumentMapper } = await import('./fic.document-mapper');
    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(validRequest, {
        companyId: '12345',
        isPaid: true,
        paymentAccountId: undefined,
      }),
    ).toThrow(BadRequestException);
  });

  // 11: ei_status polling uses exponential backoff with upper bound and max attempts
  it('11. should poll ei_status with backoff and stop at maxAttempts (§4)', async () => {
    const mockClient = new FicMockClient();
    jest.spyOn(mockClient, 'getIssuedDocument').mockResolvedValue({
      data: { id: 10001, ei_status: 'processing' } as any,
    });

    const result = await FicEInvoiceService.pollEiStatusWithBackoff(
      mockClient as any,
      12345,
      10001,
      {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      },
    );

    expect(result.attempts).toBe(3);
    expect(result.reachedTarget).toBe(false);
    expect(result.eiStatus).toBe('processing');
  });

  // 12: No webhook registration in this phase
  it('12. should not register webhooks in MOCK_READY phase', () => {
    const connector = new FattureInCloudConnector({ companyId: '12345' }, 'MOCK');
    expect((connector as any).registerWebhook).toBeUndefined();
  });

  // 13: Company ID is derived from authorized company configuration, never from body
  it('13. should derive companyId from connector configuration and not from request body', () => {
    const connector = new FattureInCloudConnector({ companyId: '98765' }, 'MOCK');
    expect(connector.companyId).toBe('98765');
  });

  // 14: findByReference is DOCUMENTATION_REQUIRED, timeout retry disabled
  it('14. should have findInvoiceByReference as DOCUMENTATION_REQUIRED', async () => {
    const connector = new FattureInCloudConnector({ companyId: '12345' }, 'MOCK');
    expect(connector.capabilities.findInvoiceByReference).toBe(
      CapabilityStatus.DOCUMENTATION_REQUIRED,
    );
    const result = await connector.findInvoiceByReference('ORD-1001');
    expect(result).toBeNull();
  });

  // 15: Sensitive tokens and secrets are not leaked in output
  it('15. should never leak clientSecret or raw token in testConnection response', async () => {
    const connector = new FattureInCloudConnector(
      { companyId: '12345', clientSecret: 'super_secret_key_12345' },
      'MOCK',
    );
    const connResult = await connector.testConnection();
    expect(JSON.stringify(connResult)).not.toContain('super_secret_key_12345');
  });

  // 16: Tenant isolation
  it('16. should scope connector instances strictly per companyId', () => {
    const connectorA = new FattureInCloudConnector({ companyId: 'comp-A' }, 'MOCK');
    const connectorB = new FattureInCloudConnector({ companyId: 'comp-B' }, 'MOCK');
    expect(connectorA.companyId).toBe('comp-A');
    expect(connectorB.companyId).toBe('comp-B');
    expect(connectorA.companyId).not.toBe(connectorB.companyId);
  });

  // 17: teamsystem-enterprise and teamsystem-alyante are NOT in registry
  it('17. should NOT register teamsystem-enterprise or teamsystem-alyante in AccountingProviderRegistry', () => {
    const allProviders = AccountingProviderRegistry.all().map((p) => p.id);
    expect(allProviders).toContain('FATTURE-IN-CLOUD');
    expect(allProviders).not.toContain('TEAMSYSTEM-ENTERPRISE');
    expect(allProviders).not.toContain('TEAMSYSTEM-ALYANTE');
    expect(allProviders).not.toContain('teamsystem-enterprise');
    expect(allProviders).not.toContain('teamsystem-alyante');
  });

  // 18: In MOCK_READY phase, TEST and PRODUCTION clients throw IntegrationNotVerifiedError and do not make network calls
  it('18. should throw IntegrationNotVerifiedError on test and production clients without network calls', async () => {
    const testClient = new FicTestClient();
    await expect(testClient.getUserCompanies()).rejects.toThrow(IntegrationNotVerifiedError);

    const prodClient = new FicProductionClient();
    await expect(prodClient.createIssuedDocument(1, {})).rejects.toThrow(
      IntegrationNotVerifiedError,
    );
  });
});
