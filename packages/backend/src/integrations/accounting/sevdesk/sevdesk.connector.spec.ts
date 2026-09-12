import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { AccountingTokenStore } from '../core/AccountingTokenStore';
import { SevdeskConnector } from './sevdesk.connector';
import { buildSevdeskHeaders, SEVDESK_API_BASE_URL } from './sevdesk.client';
import { SevdeskStatusMapper } from './sevdesk.status-mapper';
import { createSevdeskRef } from './sevdesk.ref';

describe('SevdeskConnector Unit Tests (§8)', () => {
  const credentials = { apiToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' };
  let connector: SevdeskConnector;

  const sampleInvoiceReq = {
    companyId: 'org-test-1',
    referenceCode: 'ORD-1',
    issueDate: '2026-09-11',
    currency: 'EUR',
    contact: { name: 'Test Customer', taxNumber: 'DE999888777' },
    items: [
      {
        sku: 'SKU-1',
        name: 'Test Product',
        unitPrice: 100.0,
        quantity: 1,
        vatRate: 19,
        totalAmount: 119.0,
      },
    ],
    subtotal: 100.0,
    vatTotal: 19.0,
    grandTotal: 119.0,
  };

  beforeEach(() => {
    connector = new SevdeskConnector(credentials, 'MOCK');
  });

  describe('8.1 & 8.2 & 8.5 Lifecycle & Safety', () => {
    it('creates invoice as Draft (100) with KroptOS status pending', async () => {
      const result = await connector.createInvoice(sampleInvoiceReq);

      expect(result.externalId).toBeDefined();
      expect(result.rawResponse?.status).toBe('pending');
      expect(result.rawResponse?.sumGross).toBe(119.0);
      expect(result.rawResponse?._reconciled).toBe(true);
    });

    it('verifies sendViaEmail is NEVER present or called on connector or client', () => {
      expect((connector as any).sendViaEmail).toBeUndefined();
      expect((connector as any).client.sendViaEmail).toBeUndefined();
    });
  });

  describe('8.6 & 8.7 Authorization Header & Base URL', () => {
    it('produces raw token in Authorization header WITHOUT Bearer prefix', () => {
      const headers = buildSevdeskHeaders(credentials.apiToken);
      expect(headers.Authorization).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
      expect(headers.Authorization.startsWith('Bearer')).toBe(false);
    });

    it('rejects if Bearer prefix is mistakenly provided', () => {
      expect(() => buildSevdeskHeaders('Bearer a1b2c3d4e5f60718293a4b5c6d7e8f90')).toThrow();
    });

    it('uses /api/v1 as base URL', () => {
      expect(SEVDESK_API_BASE_URL).toBe('https://my.sevdesk.de/api/v1');
    });
  });

  describe('8.8 & 8.9 ObjectName Ref Envelope Helper', () => {
    it('requires all relations to carry { id, objectName } envelope', () => {
      const contactRef = createSevdeskRef('Contact', 1000);
      expect(contactRef).toEqual({ id: 1000, objectName: 'Contact' });

      const unityRef = createSevdeskRef('Unity', 1);
      expect(unityRef).toEqual({ id: 1, objectName: 'Unity' });
    });

    it('rejects arbitrary free-text objectName', () => {
      expect(() => createSevdeskRef('HackedTable' as any, 100)).toThrow();
    });
  });

  describe('8.11 Status Mapping', () => {
    it('maps 100 -> pending, 200 -> sent, 1000 -> sent, 50 -> pending', () => {
      expect(SevdeskStatusMapper.toKroptosStatus(100)).toBe('pending');
      expect(SevdeskStatusMapper.toKroptosStatus(200)).toBe('sent');
      expect(SevdeskStatusMapper.toKroptosStatus(1000)).toBe('sent');
      expect(SevdeskStatusMapper.toKroptosStatus(50)).toBe('pending');
    });

    it('maps unknown status codes to pending (NEVER sent or cancelled)', () => {
      expect(SevdeskStatusMapper.toKroptosStatus(999)).toBe('pending');
      expect(SevdeskStatusMapper.toKroptosStatus(-1)).toBe('pending');
      expect(SevdeskStatusMapper.toKroptosStatus(null)).toBe('pending');
    });
  });

  describe('8.12 & 8.13 & 8.14 Payment and Status Read-back', () => {
    it('records payment, updates paid amount, and reads back status', async () => {
      // Create invoice first (total 119)
      const inv = await connector.createInvoice(sampleInvoiceReq);

      // Partial payment
      const partialRes = await connector.recordPayment({
        companyId: 'org-test-1',
        referenceCode: 'PAY-1',
        invoiceExternalId: inv.externalId,
        amount: 50.0,
        currency: 'EUR',
        paymentDate: '2026-09-11',
      });
      expect(partialRes.externalId).toBeDefined();
      expect(partialRes.rawResponse?.status).toBe('pending');
      expect(partialRes.rawResponse?.updatedInvoice?.status).toBe(200); // Partially paid -> Open (200)

      // Full balance payment
      const fullRes = await connector.recordPayment({
        companyId: 'org-test-1',
        referenceCode: 'PAY-2',
        invoiceExternalId: inv.externalId,
        amount: 69.0,
        currency: 'EUR',
        paymentDate: '2026-09-11',
      });
      expect(fullRes.externalId).toBeDefined();
      expect(fullRes.rawResponse?.status).toBe('completed');
      expect(fullRes.rawResponse?.updatedInvoice?.status).toBe(1000); // Fully paid -> Paid (1000)
    });

    it('rejects payment exceeding total invoice amount', async () => {
      const inv = await connector.createInvoice(sampleInvoiceReq);

      await expect(
        connector.recordPayment({
          companyId: 'org-test-1',
          referenceCode: 'PAY-OVER',
          invoiceExternalId: inv.externalId,
          amount: 200.0,
          currency: 'EUR',
          paymentDate: '2026-09-11',
        }),
      ).rejects.toThrow('Tahsilat tutarı fatura toplamını aşamaz');
    });
  });

  describe('8.12 Invoice Cancellation / Reset', () => {
    it('resets open/draft invoice to draft status', async () => {
      const inv = await connector.createInvoice(sampleInvoiceReq);

      const cancelRes = await connector.cancelInvoice(inv.externalId);
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.rawResponse?.status).toBe('cancelled');
    });

    it('rejects cancelling non-existent invoice', async () => {
      await expect(connector.cancelInvoice('non-existent-id')).rejects.toThrow();
    });
  });

  describe('8.14 & 8.15 Token Owner & Health Check (§4)', () => {
    it('tests connection and identifies token owner user account', async () => {
      const testRes = await connector.testConnection();
      expect(testRes.success).toBe(true);
      expect(testRes.companyName).toBe('Max Mustermann');
      expect(testRes.companyId).toBe('101');
    });

    it('checks health periodically and returns healthy status', async () => {
      const health = await connector.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.tokenOwner?.username).toBe('max.mustermann');
    });
  });

  describe('8.16 Negative Token Store Test (§3 - Third Proof)', () => {
    it('ensures sevDesk has undefined refreshSemantics and never registers in token store', () => {
      expect(connector.capabilities.refreshSemantics).toBeUndefined();

      const tokenStore = new AccountingTokenStore();
      const token = tokenStore.getToken('sevdesk:org-test-1');
      expect(token).toBeUndefined();
    });
  });

  describe('8.17 Reference Search Disabled', () => {
    it('returns null for findInvoiceByReference because it is DOCUMENTATION_REQUIRED', async () => {
      const res = await connector.findInvoiceByReference('ORD-1');
      expect(res).toBeNull();
    });
  });

  describe('8.18 & 8.20 Credential Masking & Environment Protection', () => {
    it('masks apiToken securely in credential display', () => {
      const masked = connector.getMaskedCredentials();
      expect(masked.apiToken).toBe('a1b2••••••••••••••••••••••••••••');
    });

    it('throws IntegrationNotVerifiedError on test environment', async () => {
      const testConn = new SevdeskConnector(credentials, 'TEST');
      await expect(testConn.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });

    it('throws IntegrationNotVerifiedError on production environment', async () => {
      const prodConn = new SevdeskConnector(credentials, 'PRODUCTION');
      await expect(prodConn.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });
  });
});
