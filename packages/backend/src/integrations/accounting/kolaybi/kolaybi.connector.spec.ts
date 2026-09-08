import { BadRequestException } from '@nestjs/common';
import { KolaybiConnector } from './kolaybi.connector';
import { KolaybiMockClient } from './kolaybi.mock-client';
import {
  AccountingAmountMismatchError,
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitError,
  IntegrationNotVerifiedError,
} from '../core/AccountingErrors';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import { KolaybiStatusMapper } from './kolaybi.status-mapper';

describe('KolaybiConnector', () => {
  beforeEach(() => {
    KolaybiMockClient.resetStore();
  });

  const validInvoiceRequest: AccountingInvoiceRequest = {
    companyId: 'test_channel',
    referenceCode: 'KB-ORD-001',
    issueDate: '2026-09-08',
    currency: 'TRY',
    contact: {
      name: 'Ahmet Yılmaz',
      taxNumber: '12345678901',
      city: 'İstanbul',
    },
    items: [
      {
        sku: 'PRD-01',
        name: 'Deri Cüzdan',
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

  describe('Initialization & Metadata', () => {
    it('1. should initialize with provider KOLAYBI and default MOCK environment', () => {
      const connector = new KolaybiConnector({ apiKey: 'kbi_key', channel: 'kbi_chan' });
      expect(connector.provider).toBe('KOLAYBI');
      expect(connector.environment).toBe('MOCK');
    });

    it('2. should declare capabilities properly (stockSync NOT_SUPPORTED, eDocument DOCUMENTATION_REQUIRED)', () => {
      const connector = new KolaybiConnector({});
      expect(connector.capabilities.stockSync).toBe('NOT_SUPPORTED');
      expect(connector.capabilities.eDocument).toBe('DOCUMENTATION_REQUIRED');
      expect(connector.capabilities.salesInvoice).toBe('MOCK_ONLY');
      expect(connector.capabilities.multiCompany).toBe('SUPPORTED');
    });
  });

  describe('testConnection', () => {
    it('3. should succeed in MOCK environment', async () => {
      const connector = new KolaybiConnector({ apiKey: 'valid_key', channel: 'my_company' });
      const res = await connector.testConnection();
      expect(res.success).toBe(true);
      expect(res.companyName).toBe('my_company');
    });

    it('4. should throw AccountingAuthError on TRIGGER_AUTH_FAIL', async () => {
      const connector = new KolaybiConnector({ apiKey: 'TRIGGER_AUTH_FAIL', channel: 'my_company' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingAuthError);
    });

    it('5. should throw AccountingRateLimitError on TRIGGER_RATE_LIMIT', async () => {
      const connector = new KolaybiConnector({ apiKey: 'TRIGGER_RATE_LIMIT', channel: 'my_company' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingRateLimitError);
    });

    it('6. should throw AccountingNetworkError on TRIGGER_NETWORK_FAIL', async () => {
      const connector = new KolaybiConnector({ apiKey: 'TRIGGER_NETWORK_FAIL', channel: 'my_company' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingNetworkError);
    });
  });

  describe('Unverified Environment Guard (TEST & PRODUCTION)', () => {
    it('7. should reject testConnection in TEST environment without calling network', async () => {
      const connector = new KolaybiConnector({ apiKey: 'test_key' }, 'TEST');
      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });

    it('8. should reject createInvoice in TEST environment without calling network', async () => {
      const connector = new KolaybiConnector({ apiKey: 'test_key' }, 'TEST');
      await expect(connector.createInvoice(validInvoiceRequest)).rejects.toThrow(
        IntegrationNotVerifiedError,
      );
    });

    it('9. should reject testConnection in PRODUCTION environment without calling network', async () => {
      const connector = new KolaybiConnector({ apiKey: 'prod_key' }, 'PRODUCTION');
      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });

    it('10. should reject recordPayment in PRODUCTION environment without calling network', async () => {
      const connector = new KolaybiConnector({ apiKey: 'prod_key' }, 'PRODUCTION');
      const payReq: AccountingPaymentRequest = {
        companyId: 'test_chan',
        invoiceExternalId: 'inv-1',
        referenceCode: 'PAY-1',
        amount: 100,
        currency: 'TRY',
        paymentDate: '2026-09-08',
      };
      await expect(connector.recordPayment(payReq)).rejects.toThrow(IntegrationNotVerifiedError);
    });
  });

  describe('createInvoice Flow & Business Rules', () => {
    it('11. should create an invoice successfully in MOCK environment', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const result = await connector.createInvoice(validInvoiceRequest);
      expect(result.externalId).toBeDefined();
      expect(result.externalNumber).toContain('KB-ORD-001');
    });

    it('12. should throw AccountingAmountMismatchError on total mismatch', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const badRequest = {
        ...validInvoiceRequest,
        subtotal: 1000,
        vatTotal: 200,
        grandTotal: 1500, // mismatch!
      };
      await expect(connector.createInvoice(badRequest)).rejects.toThrow(
        AccountingAmountMismatchError,
      );
    });

    it('13. should throw BadRequestException on unsupported VAT rate (not in 0, 1, 8, 10, 18, 20)', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const badVatRequest: AccountingInvoiceRequest = {
        ...validInvoiceRequest,
        items: [
          {
            sku: 'PRD-02',
            name: 'Özel Hizmet',
            quantity: 1,
            unitPrice: 100,
            vatRate: 15, // invalid for KolayBi!
            vatAmount: 15,
            totalAmount: 115,
          },
        ],
        subtotal: 100,
        vatTotal: 15,
        grandTotal: 115,
      };
      await expect(connector.createInvoice(badVatRequest)).rejects.toThrow(/Desteklenmeyen KDV oranı/);
    });

    it('14. should throw BadRequestException when TCKN is missing and no defaultRetailContactId exists', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const missingTcknRequest: AccountingInvoiceRequest = {
        ...validInvoiceRequest,
        contact: {
          name: 'Perakende Müşteri',
          // taxNumber missing!
        },
      };
      await expect(connector.createInvoice(missingTcknRequest)).rejects.toThrow(
        /varsayılan perakende cari/,
      );
    });

    it('15. should use defaultRetailContactId fallback when TCKN is missing', async () => {
      const connector = new KolaybiConnector({
        channel: 'test_chan',
        defaultRetailContactId: 'kb-retail-999',
      });
      const missingTcknRequest: AccountingInvoiceRequest = {
        ...validInvoiceRequest,
        contact: {
          name: 'Perakende Müşteri',
        },
      };
      const result = await connector.createInvoice(missingTcknRequest);
      expect(result.externalId).toBeDefined();
    });

    it('16. should handle HTTP 200 failure payload with TRIGGER_200_FAILURE', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const triggerReq: AccountingInvoiceRequest = {
        ...validInvoiceRequest,
        referenceCode: 'KB-TRIGGER_200_FAILURE-01',
      };
      await expect(connector.createInvoice(triggerReq)).rejects.toThrow(/KolayBi iş mantığı hatası/);
    });

    it('17. should ensure idempotency on same referenceCode', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const first = await connector.createInvoice(validInvoiceRequest);
      const second = await connector.createInvoice(validInvoiceRequest);
      expect(first.externalId).toBe(second.externalId);
    });

    it('18. should retrieve invoice by referenceCode via findInvoiceByReference', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      await connector.createInvoice(validInvoiceRequest);
      const found = await connector.findInvoiceByReference(validInvoiceRequest.referenceCode);
      expect(found).not.toBeNull();
      expect(found?.externalNumber).toContain(validInvoiceRequest.referenceCode);
    });
  });

  describe('Payment, Contact & Product Flows', () => {
    it('19. should record payment successfully in MOCK mode', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const payReq: AccountingPaymentRequest = {
        companyId: 'test_chan',
        invoiceExternalId: 'inv-123',
        referenceCode: 'PAY-001',
        amount: 1200,
        currency: 'TRY',
        paymentDate: '2026-09-08',
        paymentMethod: 'CREDIT_CARD',
      };
      const res = await connector.recordPayment(payReq);
      expect(res.externalId).toBeDefined();
    });

    it('20. should throw on TRIGGER_PAYMENT_FAIL in recordPayment', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const payReq: AccountingPaymentRequest = {
        companyId: 'test_chan',
        invoiceExternalId: 'inv-123',
        referenceCode: 'PAY-TRIGGER_PAYMENT_FAIL',
        amount: 5000,
        currency: 'TRY',
        paymentDate: '2026-09-08',
      };
      await expect(connector.recordPayment(payReq)).rejects.toThrow(/Fatura bakiyesinden yüksek/);
    });

    it('21. should sync contact successfully with valid taxNumber', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const contactReq: AccountingContactRequest = {
        companyId: 'test_chan',
        kroptosKey: 'cust-123',
        name: 'Test Cari Ltd.',
        taxNumber: '1234567890',
        isCompany: true,
      };
      const res = await connector.syncContact(contactReq);
      expect(res.externalId).toBeDefined();
    });

    it('22. should throw BadRequestException when contact taxNumber is missing', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const contactReq: AccountingContactRequest = {
        companyId: 'test_chan',
        kroptosKey: 'cust-123',
        name: 'Eksik Vergi No',
        taxNumber: '',
      };
      await expect(connector.syncContact(contactReq)).rejects.toThrow(/TCKN veya VKN zorunludur/);
    });

    it('23. should map product successfully', async () => {
      const connector = new KolaybiConnector({ channel: 'test_chan' });
      const prodReq: AccountingProductRequest = {
        companyId: 'test_chan',
        sku: 'SKU-001',
        name: 'Deri Çanta',
        unitPrice: 1500,
        vatRate: 20,
      };
      const res = await connector.mapProduct(prodReq);
      expect(res.externalId).toBeDefined();
      expect(res.code).toBe('SKU-001');
    });
  });

  describe('Status Mapper', () => {
    it('24. should map KolayBi statuses to KroptOS document statuses', () => {
      expect(KolaybiStatusMapper.toKroptosStatus('draft')).toBe('pending');
      expect(KolaybiStatusMapper.toKroptosStatus('ready_to_send')).toBe('pending');
      expect(KolaybiStatusMapper.toKroptosStatus('sent')).toBe('created');
      expect(KolaybiStatusMapper.toKroptosStatus('approved')).toBe('created');
      expect(KolaybiStatusMapper.toKroptosStatus('rejected')).toBe('failed');
      expect(KolaybiStatusMapper.toKroptosStatus('cancelled')).toBe('cancelled');
      expect(KolaybiStatusMapper.toKroptosStatus('unknown_status')).toBe('pending');
      expect(KolaybiStatusMapper.toKroptosStatus(null)).toBe('pending');
    });
  });
});
