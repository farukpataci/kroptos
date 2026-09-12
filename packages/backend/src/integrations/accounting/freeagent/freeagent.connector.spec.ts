import { BadRequestException } from '@nestjs/common';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { FreeAgentConnector } from './freeagent.connector';
import {
  buildFreeAgentHeaders,
  DEFAULT_FREEAGENT_USER_AGENT,
  parseFreeAgentLinkHeader,
  validateFreeAgentPagination,
} from './freeagent.client';
import { FreeAgentStatusMapper } from './freeagent.status-mapper';
import { FreeAgentUriHelper } from './freeagent.uri';
import { FreeAgentOAuth } from './freeagent.oauth';
import { FREEAGENT_CAPABILITIES } from './freeagent.capabilities';

describe('FreeAgentConnector Unit Tests (§8)', () => {
  const credentials = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    defaultCategoryUrl: 'https://api.sandbox.freeagent.com/v2/categories/001',
    bankAccountUrl: 'https://api.sandbox.freeagent.com/v2/bank_accounts/1',
  };

  let connector: FreeAgentConnector;

  const sampleInvoiceReq = {
    companyId: 'comp-uk-1',
    referenceCode: 'KROP-REF-201',
    issueDate: '2026-09-11',
    currency: 'GBP',
    contact: { id: '10', name: 'Acme UK Ltd' },
    items: [
      {
        sku: 'SKU-01',
        name: 'Web Geliştirme Hizmeti',
        quantity: 1,
        unitPrice: 100,
        vatRate: 20,
        totalAmount: 120,
      },
    ],
    subtotal: 100,
    vatTotal: 20,
    grandTotal: 120,
  };

  beforeEach(() => {
    connector = new FreeAgentConnector(credentials, 'MOCK');
  });

  describe('8.1 Connection and Test Guard (§1, §4)', () => {
    it('successfully connects in MOCK environment with company and user info', async () => {
      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.companyName).toBe('KroptOS UK Ltd');
      expect(result.companyId).toBe('kroptos-demo');
    });

    it('rejects testConnection in TEST environment with IntegrationNotVerifiedError', async () => {
      const testConnector = new FreeAgentConnector(credentials, 'TEST');
      await expect(testConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });

    it('rejects testConnection in PRODUCTION environment with IntegrationNotVerifiedError', async () => {
      const prodConnector = new FreeAgentConnector(credentials, 'PRODUCTION');
      await expect(prodConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });
  });

  describe('8.2 Invoice Lifecycle and Transition Safety (§5.2, §5.3)', () => {
    it('creates invoice as Draft, reconciles totals, and transitions with mark_as_sent', async () => {
      const result = await connector.createInvoice(sampleInvoiceReq);

      expect(result.externalId).toBeDefined();
      expect(result.externalNumber).toBeDefined();
      expect(result.rawResponse?.documentStatus).toBe('sent');
      expect(result.rawResponse?.transition).toBe('mark_as_sent');
      expect(result.rawResponse?.reconciled).toBe(true);
    });

    it('verifies send_email and mark_as_scheduled are NEVER defined on connector or client (§5.2)', () => {
      expect((connector as any).send_email).toBeUndefined();
      expect((connector as any).mark_as_scheduled).toBeUndefined();
      expect((connector as any).client.send_email).toBeUndefined();
      expect((connector as any).client.mark_as_scheduled).toBeUndefined();
    });
  });

  describe('8.5 User-Agent and Headers Builder (§5.5)', () => {
    it('builds valid headers with default descriptive User-Agent and Bearer token', () => {
      const headers = buildFreeAgentHeaders('valid-token-123');
      expect(headers.Authorization).toBe('Bearer valid-token-123');
      expect(headers['User-Agent']).toBe(DEFAULT_FREEAGENT_USER_AGENT);
      expect(headers.Accept).toBe('application/json');
    });

    it('rejects empty or missing token', () => {
      expect(() => buildFreeAgentHeaders('')).toThrow(BadRequestException);
    });

    it('rejects empty User-Agent (§5.5)', () => {
      expect(() => buildFreeAgentHeaders('valid-token-123', '')).toThrow(BadRequestException);
    });

    it('rejects User-Agent containing token or personal data (§5.5)', () => {
      expect(() =>
        buildFreeAgentHeaders('secret-token-xyz', 'KroptOS secret-token-xyz app'),
      ).toThrow(BadRequestException);
    });
  });

  describe('8.6 Pagination and Link Header (§2.1)', () => {
    it('validates and clamps per_page (max 100)', () => {
      const valid = validateFreeAgentPagination({ page: 2, per_page: 50 });
      expect(valid.page).toBe(2);
      expect(valid.per_page).toBe(50);

      expect(() => validateFreeAgentPagination({ page: 0 })).toThrow(BadRequestException);
      expect(() => validateFreeAgentPagination({ per_page: 101 })).toThrow(BadRequestException);
    });

    it('parses Link header with rel="next" and rel="last"', () => {
      const header =
        '<https://api.freeagent.com/v2/invoices?page=2&per_page=25>; rel="next", <https://api.freeagent.com/v2/invoices?page=5&per_page=25>; rel="last"';
      const parsed = parseFreeAgentLinkHeader(header);
      expect(parsed.nextPage).toBe(2);
      expect(parsed.lastPage).toBe(5);
    });
  });

  describe('8.8 & 8.16 Status Mapping (§6)', () => {
    it('maps Draft, Scheduled To Email, Zero Value -> pending', () => {
      expect(FreeAgentStatusMapper.toKroptosStatus('Draft')).toBe('pending');
      expect(FreeAgentStatusMapper.toKroptosStatus('Scheduled To Email')).toBe('pending');
      expect(FreeAgentStatusMapper.toKroptosStatus('Zero Value')).toBe('pending');
    });

    it('maps Open, Overdue, Paid, Overpaid -> sent', () => {
      expect(FreeAgentStatusMapper.toKroptosStatus('Open')).toBe('sent');
      expect(FreeAgentStatusMapper.toKroptosStatus('Overdue')).toBe('sent');
      expect(FreeAgentStatusMapper.toKroptosStatus('Paid')).toBe('sent');
      expect(FreeAgentStatusMapper.toKroptosStatus('Overpaid')).toBe('sent');
    });

    it('CRITICAL: maps Refunded, Written-off, Part written-off -> sent (NOT cancelled!) (§6)', () => {
      expect(FreeAgentStatusMapper.toKroptosStatus('Refunded')).toBe('sent');
      expect(FreeAgentStatusMapper.toKroptosStatus('Written-off')).toBe('sent');
      expect(FreeAgentStatusMapper.toKroptosStatus('Part written-off')).toBe('sent');
    });

    it('maps Cancelled -> cancelled', () => {
      expect(FreeAgentStatusMapper.toKroptosStatus('Cancelled')).toBe('cancelled');
    });

    it('maps unknown status to pending (NEVER sent or cancelled)', () => {
      expect(FreeAgentStatusMapper.toKroptosStatus('UnknownStatus')).toBe('pending');
      expect(FreeAgentStatusMapper.toKroptosStatus(null)).toBe('pending');
    });
  });

  describe('8.9 Payment Recording via Bank Explanations', () => {
    it('records invoice payment, links to paid_invoice, and updates invoice paid status', async () => {
      // 1. Fatura oluştur (120 GBP)
      const invoice = await connector.createInvoice(sampleInvoiceReq);

      // 2. Tahsilat kaydet (120 GBP tam ödeme)
      const payment = await connector.recordPayment({
        companyId: 'comp-uk-1',
        invoiceExternalId: invoice.externalId,
        referenceCode: 'PAY-REF-1',
        amount: 120,
        currency: 'GBP',
        paymentDate: '2026-09-11',
      });

      expect(payment.externalId).toBeDefined();
      expect(payment.rawResponse?.status).toBe('completed');
      expect(payment.rawResponse?.documentStatus).toBe('sent');
      expect(payment.rawResponse?.invoiceStatus).toBe('Paid');
    });
  });

  describe('8.15 Cancellation Lifecycle (§5.8)', () => {
    it('cancels open invoice with mark_as_cancelled transition', async () => {
      const invoice = await connector.createInvoice(sampleInvoiceReq);
      const cancelResult = await connector.cancelInvoice(invoice.externalId);

      expect(cancelResult.success).toBe(true);
      expect(cancelResult.rawResponse?.currentStatus).toBe('Cancelled');
      expect(cancelResult.rawResponse?.documentStatus).toBe('cancelled');
    });

    it('rejects cancellation if invoice is already Paid (requires credit note)', async () => {
      const invoice = await connector.createInvoice(sampleInvoiceReq);

      // Tam ödeme kaydet
      await connector.recordPayment({
        companyId: 'comp-uk-1',
        invoiceExternalId: invoice.externalId,
        referenceCode: 'PAY-1',
        amount: 120,
        currency: 'GBP',
        paymentDate: '2026-09-11',
      });

      // İptal denenince reddedilmeli
      await expect(connector.cancelInvoice(invoice.externalId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('8.18 findInvoiceByReference (§5.9)', () => {
    it('returns null as search by po_reference is DOCUMENTATION_REQUIRED', async () => {
      const found = await connector.findInvoiceByReference('KROP-REF-201');
      expect(found).toBeNull();
      expect(FREEAGENT_CAPABILITIES.findInvoiceByReference).toBe('DOCUMENTATION_REQUIRED');
    });
  });

  describe('8.4 RefreshSemantics Profile 4 (§4)', () => {
    it('verifies 4th profile values in capabilities', () => {
      const sem = FREEAGENT_CAPABILITIES.refreshSemantics;
      expect(sem).toBeDefined();
      expect(sem?.rotatesOnRefresh).toBe(true);
      expect(sem?.previousTokenGraceMs).toBe(0);
      expect(sem?.inactivityLimitDays).toBeNull();
      expect(sem?.staleTokenUseIsDestructive).toBe(false);
    });
  });

  describe('Contact sync and Product mapping', () => {
    it('syncs contact and extracts numeric ID', async () => {
      const contact = await connector.syncContact({
        companyId: 'comp-1',
        kroptosKey: 'CUST-001',
        name: 'New Customer Ltd',
        email: 'info@newcustomer.example.com',
      });
      expect(contact.externalId).toBeDefined();
    });

    it('maps product to category SKU', async () => {
      const mapped = await connector.mapProduct({
        companyId: 'comp-1',
        sku: 'SKU-001',
        name: 'Sample Product',
      });
      expect(mapped.externalId).toBe('SKU-001');
    });
  });
});
