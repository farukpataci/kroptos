import { BadRequestException, NotImplementedException } from '@nestjs/common';
import { BizimhesapConnector } from './bizimhesap.connector';
import { BizimhesapMockClient } from './bizimhesap.mock-client';
import { BizimhesapRequestMapper } from './bizimhesap.request-mapper';
import { BizimhesapErrorMapper } from './bizimhesap.error-mapper';
import {
  AccountingApiError,
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
import { AccountingHttpClient } from '../core/AccountingHttpClient';
import { generateContactKey } from '../../../modules/accounting/utils/contact-key.util';
import { BIZIMHESAP_CREDENTIAL_SCHEMA } from './bizimhesap.credential-schema';

describe('BizimhesapConnector', () => {
  beforeEach(() => {
    BizimhesapMockClient.resetStore();
  });

  const validRequest: AccountingInvoiceRequest = {
    companyId: 'firm-999',
    referenceCode: 'BH-ORD-001',
    issueDate: '2026-09-08',
    dueDate: '2026-09-15',
    currency: 'TRY',
    contact: {
      name: 'Hedef Müşteri Ltd.',
      address: 'Büyükdere Cad. No:100 Levent İstanbul',
      taxNumber: '9876543210',
      email: 'muhasebe@hedef.com',
      phone: '02129998877',
    },
    items: [
      {
        sku: 'SKU-01',
        name: 'Kablosuz Mouse',
        quantity: 2,
        unitPrice: 250,
        vatRate: 20,
        discountAmount: 50,
        totalAmount: 540,
      },
    ],
    subtotal: 500,
    vatTotal: 90,
    discountTotal: 50,
    grandTotal: 540,
    notes: 'Sipariş notu',
  };

  describe('1. Metadata & Credential Schema', () => {
    it('should have provider BIZIMHESAP and default MOCK environment', () => {
      const connector = new BizimhesapConnector({ firmId: 'FIRM-1', key: 'KEY-1', token: 'TOK-1' });
      expect(connector.provider).toBe('BIZIMHESAP');
      expect(connector.environment).toBe('MOCK');
    });

    it('should declare firmId, key, and token as secret: true in credential schema (§4.1)', () => {
      const firmIdField = BIZIMHESAP_CREDENTIAL_SCHEMA.fields.find((f) => f.key === 'firmId');
      const keyField = BIZIMHESAP_CREDENTIAL_SCHEMA.fields.find((f) => f.key === 'key');
      const tokenField = BIZIMHESAP_CREDENTIAL_SCHEMA.fields.find((f) => f.key === 'token');

      expect(firmIdField?.secret).toBe(true);
      expect(keyField?.secret).toBe(true);
      expect(tokenField?.secret).toBe(true);
    });

    it('should declare capabilities correctly (only salesInvoice MOCK_ONLY, rest NOT_SUPPORTED)', () => {
      const connector = new BizimhesapConnector({});
      expect(connector.capabilities.salesInvoice).toBe('MOCK_ONLY');
      expect(connector.capabilities.payment).toBe('NOT_SUPPORTED');
      expect(connector.capabilities.contactSync).toBe('NOT_SUPPORTED');
      expect(connector.capabilities.productMapping).toBe('NOT_SUPPORTED');
      expect(connector.capabilities.stockSync).toBe('NOT_SUPPORTED');
      expect(connector.capabilities.cancelInvoice).toBe('NOT_SUPPORTED');
      expect(connector.capabilities.findInvoiceByReference).toBe('NOT_SUPPORTED');
    });
  });

  describe('2. Unverified Environment Guard (TEST & PRODUCTION)', () => {
    it('should throw IntegrationNotVerifiedError in TEST environment', async () => {
      const connector = new BizimhesapConnector({ firmId: 'FIRM-1' }, 'TEST');
      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
      await expect(connector.createInvoice(validRequest)).rejects.toThrow(IntegrationNotVerifiedError);
    });

    it('should throw IntegrationNotVerifiedError in PRODUCTION environment', async () => {
      const connector = new BizimhesapConnector({ firmId: 'FIRM-1' }, 'PRODUCTION');
      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
      await expect(connector.createInvoice(validRequest)).rejects.toThrow(IntegrationNotVerifiedError);
    });
  });

  describe('3. Unsupported Endpoints (NotImplementedException)', () => {
    it('recordPayment should throw NotImplementedException (§1)', async () => {
      const connector = new BizimhesapConnector({ firmId: 'FIRM-1' });
      const payReq: AccountingPaymentRequest = {
        companyId: 'firm-999',
        invoiceExternalId: 'inv-1',
        referenceCode: 'PAY-1',
        amount: 540,
        currency: 'TRY',
        paymentDate: '2026-09-08',
      };
      await expect(connector.recordPayment(payReq)).rejects.toThrow(NotImplementedException);
    });

    it('syncContact should throw NotImplementedException (§1, §4.2)', async () => {
      const connector = new BizimhesapConnector({ firmId: 'FIRM-1' });
      const contactReq: AccountingContactRequest = {
        companyId: 'firm-999',
        kroptosKey: 'cust-1',
        name: 'Müşteri',
      };
      await expect(connector.syncContact(contactReq)).rejects.toThrow(NotImplementedException);
    });

    it('mapProduct should throw NotImplementedException (§1, §4.3)', async () => {
      const connector = new BizimhesapConnector({ firmId: 'FIRM-1' });
      const prodReq: AccountingProductRequest = {
        companyId: 'firm-999',
        sku: 'SKU-01',
        name: 'Ürün',
      };
      await expect(connector.mapProduct(prodReq)).rejects.toThrow(NotImplementedException);
    });

    it('findInvoiceByReference should throw NotImplementedException (§1, §4.6)', async () => {
      const connector = new BizimhesapConnector({ firmId: 'FIRM-1' });
      await expect(connector.findInvoiceByReference('BH-ORD-001')).rejects.toThrow(
        NotImplementedException,
      );
    });
  });

  describe('4. Invoice Creation & Business Validations', () => {
    it('should create invoice successfully in MOCK mode and return guid', async () => {
      const connector = new BizimhesapConnector({ firmId: 'firm-999' });
      const result = await connector.createInvoice(validRequest);
      expect(result.externalId).toBeDefined();
      expect(result.externalId).toContain('bh-guid-');
      expect(result.externalNumber).toBe('BH-ORD-001');
      expect((result.rawResponse as any)?.url).toContain('bizimhesap.com');
    });

    it('should translate TRY to TL in request mapper without leaking TL to core types (§4.4)', () => {
      const payload = BizimhesapRequestMapper.toInvoicePayload(validRequest, 'firm-999');
      expect(payload.amounts.currency).toBe('TL');
      expect(payload.firmId).toBe('firm-999');
      expect(payload.invoiceNo).toBe('BH-ORD-001');
      expect(payload.invoiceType).toBe(3);
    });

    it('should throw BadRequestException on unsupported currency', () => {
      const badReq: AccountingInvoiceRequest = {
        ...validRequest,
        currency: 'JPY',
      };
      expect(() => BizimhesapRequestMapper.toInvoicePayload(badReq, 'firm-999')).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if customer.title is missing or empty (§4.2)', () => {
      const badReq: AccountingInvoiceRequest = {
        ...validRequest,
        contact: {
          ...validRequest.contact,
          name: '   ',
        },
      };
      expect(() => BizimhesapRequestMapper.toInvoicePayload(badReq, 'firm-999')).toThrow(
        /müşteri adı\/unvanı \(customer\.title\) zorunludur/,
      );
    });

    it('should throw BadRequestException if customer.address is missing or empty (§4.2)', () => {
      const badReq: AccountingInvoiceRequest = {
        ...validRequest,
        contact: {
          ...validRequest.contact,
          address: '',
        },
      };
      expect(() => BizimhesapRequestMapper.toInvoicePayload(badReq, 'firm-999')).toThrow(
        /müşteri fatura adresi \(customer\.address\) zorunludur/,
      );
    });

    it('should generate stable, deterministic customerId for same customer (§4.2)', () => {
      const id1 = generateContactKey({
        taxNumber: '1234567890',
        email: 'test@firma.com',
        name: 'Firma A',
      });
      const id2 = generateContactKey({
        taxNumber: '1234567890',
        email: 'test@firma.com',
        name: 'Firma A',
      });
      expect(id1).toBe(id2);
      expect(id1).toBe('TAX-1234567890');
    });

    it('should throw AccountingApiError on HTTP 200 with populated error string (§7)', () => {
      expect(() =>
        BizimhesapErrorMapper.checkApiResponse({
          error: 'Firma yetkisi yok',
          guid: '',
          url: '',
        }),
      ).toThrow(AccountingApiError);
    });

    it('should throw AccountingApiError when error and guid are both empty (corrupted response, §7)', () => {
      expect(() =>
        BizimhesapErrorMapper.checkApiResponse({
          error: '',
          guid: '',
          url: '',
        }),
      ).toThrow(/Bozuk BizimHesap API cevabı/);
    });

    it('should throw AccountingNetworkError on timeout trigger without retry (§4.6)', async () => {
      const connector = new BizimhesapConnector({ firmId: 'firm-999' });
      const timeoutReq: AccountingInvoiceRequest = {
        ...validRequest,
        referenceCode: 'BH-TRIGGER_TIMEOUT',
      };
      await expect(connector.createInvoice(timeoutReq)).rejects.toThrow(AccountingNetworkError);
    });

    it('should enforce HTTPS on AccountingHttpClient (§4.7)', () => {
      const insecureUrl = 'http://bizimhesap.com/api/b2b/inventory/10';
      const upgraded = AccountingHttpClient.enforceHttps(insecureUrl);
      expect(upgraded).toBe('https://bizimhesap.com/api/b2b/inventory/10');
    });
  });

  describe('5. Connection Test Scenarios', () => {
    it('testConnection should succeed in MOCK environment', async () => {
      const connector = new BizimhesapConnector({ firmId: 'FIRM-1', key: 'KEY-1', token: 'TOK-1' });
      const res = await connector.testConnection();
      expect(res.success).toBe(true);
      expect(res.companyId).toBe('FIRM-1');
    });

    it('testConnection should throw AccountingAuthError on TRIGGER_AUTH_FAIL', async () => {
      const connector = new BizimhesapConnector({ key: 'TRIGGER_AUTH_FAIL' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingAuthError);
    });

    it('testConnection should throw AccountingRateLimitError on TRIGGER_RATE_LIMIT', async () => {
      const connector = new BizimhesapConnector({ key: 'TRIGGER_RATE_LIMIT' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingRateLimitError);
    });

    it('testConnection should throw AccountingNetworkError on TRIGGER_NETWORK_FAIL', async () => {
      const connector = new BizimhesapConnector({ key: 'TRIGGER_NETWORK_FAIL' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingNetworkError);
    });
  });
});
