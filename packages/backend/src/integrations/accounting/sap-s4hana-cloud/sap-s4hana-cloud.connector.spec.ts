import { NotImplementedException } from '@nestjs/common';
import {
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitError,
  IntegrationNotVerifiedError,
} from '../core/AccountingErrors';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
  AccountingProductRequest,
} from '../core/AccountingTypes';
import { AccountingHttpClient } from '../core/AccountingHttpClient';
import { SapS4HanaCloudConnector } from './sap-s4hana-cloud.connector';
import { SAP_S4HANA_CLOUD_DESCRIPTOR } from './sap-s4hana-cloud.descriptor';
import { SapODataHelper } from './sap-s4hana-cloud.odata';
import { SapS4HanaCloudSandboxClient } from './sap-s4hana-cloud.sandbox-client';

describe('SAP S/4HANA Cloud Connector (Phase 1: Read-Only Slice)', () => {
  const originalEnv = process.env.SAP_SANDBOX_API_KEY;

  beforeEach(() => {
    delete process.env.SAP_SANDBOX_API_KEY;
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.SAP_SANDBOX_API_KEY = originalEnv;
    } else {
      delete process.env.SAP_SANDBOX_API_KEY;
    }
  });

  describe('1. Registry and Descriptor Rules (§2, §5.3, §6)', () => {
    it('sap-s4hana-cloud should be registered in AccountingProviderRegistry', () => {
      const desc = AccountingProviderRegistry.get('SAP_S4HANA_CLOUD');
      expect(desc).toBeDefined();
      expect(desc.id).toBe('SAP_S4HANA_CLOUD');
      expect(desc.protocol).toBe('odata');
      expect(desc.readiness).toBe('MOCK_READY');
    });

    it('sap-s4hana-onprem should NOT be registered in registry (§2)', () => {
      expect(AccountingProviderRegistry.has('SAP_S4HANA_ONPREM')).toBe(false);
      expect(AccountingProviderRegistry.has('sap-s4hana-onprem')).toBe(false);
    });

    it('supportsTest and supportsProduction must remain false even if sandbox exists (§5.3)', () => {
      const desc = SAP_S4HANA_CLOUD_DESCRIPTOR;
      expect(desc.supportsTest).toBe(false);
      expect(desc.supportsProduction).toBe(false);
      expect(desc.lastVerifiedAt).toBeNull();
    });
  });

  describe('2. Unverified Environment Guard (TEST & PRODUCTION) (§5.2, §5.6)', () => {
    it('TEST environment should throw IntegrationNotVerifiedError without network calls', async () => {
      const connector = new SapS4HanaCloudConnector({}, 'TEST');
      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
      await expect(connector.findBusinessPartners({})).rejects.toThrow(IntegrationNotVerifiedError);
      await expect(connector.findBusinessPartnerById('1000000')).rejects.toThrow(
        IntegrationNotVerifiedError,
      );
    });

    it('PRODUCTION environment should throw IntegrationNotVerifiedError without network calls', async () => {
      const connector = new SapS4HanaCloudConnector({}, 'PRODUCTION');
      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
      await expect(connector.findBusinessPartners({})).rejects.toThrow(IntegrationNotVerifiedError);
      await expect(connector.findBusinessPartnerById('1000000')).rejects.toThrow(
        IntegrationNotVerifiedError,
      );
    });
  });

  describe('3. Sandbox Fallback and Network Protection (§5.2, §5.6)', () => {
    it('when SAP_SANDBOX_API_KEY is missing, sandbox client makes zero network requests and falls back to mock', async () => {
      const mockHttpClient = {
        get: jest.fn(),
      } as unknown as AccountingHttpClient;

      const client = new SapS4HanaCloudSandboxClient({}, mockHttpClient);
      expect(client.hasApiKey()).toBe(false);

      const res = await client.testConnection();
      expect(res.success).toBe(true);
      expect(mockHttpClient.get).not.toHaveBeenCalled();

      const bps = await client.getBusinessPartners({ top: 5 });
      expect(bps.results.length).toBeGreaterThan(0);
      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });

    it('when APIKey is provided, it is sent in headers and not leaked into response', async () => {
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({
          d: {
            results: [
              {
                BusinessPartner: '9990001',
                BusinessPartnerCategory: '1',
                FirstName: 'Test',
                LastName: 'User',
              },
            ],
          },
        }),
      } as unknown as AccountingHttpClient;

      const client = new SapS4HanaCloudSandboxClient({ apiKey: 'my-secret-key-123' }, mockHttpClient);
      expect(client.hasApiKey()).toBe(true);

      const res = await client.getBusinessPartners({ top: 1 });
      expect(res.results.length).toBe(1);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('https://sandbox.api.sap.com/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            APIKey: 'my-secret-key-123',
            Accept: 'application/json',
          }),
        }),
      );

      // Verify the secret key is NOT present anywhere in returned data
      const jsonString = JSON.stringify(res);
      expect(jsonString).not.toContain('my-secret-key-123');
    });
  });

  describe('4. Business Partner Read & OData Query Helper (§5.1, §5.6)', () => {
    it('findBusinessPartners should search by searchTerm and taxNumber in mock mode', async () => {
      const connector = new SapS4HanaCloudConnector();
      const res = await connector.findBusinessPartners({
        searchTerm: 'TCKN-12345678901',
      });

      expect(res.items.length).toBe(1);
      expect(res.items[0].externalId).toBe('1000000');
    });

    it('findBusinessPartnerById should return matched Business Partner', async () => {
      const connector = new SapS4HanaCloudConnector();
      const bp = await connector.findBusinessPartnerById('1000001');

      expect(bp).not.toBeNull();
      expect(bp?.externalId).toBe('1000001');
    });

    it('findBusinessPartnerById should return null when not found', async () => {
      const connector = new SapS4HanaCloudConnector();
      const bp = await connector.findBusinessPartnerById('NON_EXISTENT');
      expect(bp).toBeNull();
    });

    it('OData pagination: buildBusinessPartnerQuery should properly set $top and $skip', () => {
      const queryParams = SapODataHelper.buildBusinessPartnerQuery({
        top: 10,
        skip: 20,
        searchTerm: "O'Reilly",
      });

      expect(queryParams.$top).toBe('10');
      expect(queryParams.$skip).toBe('20');
      // Escaped single quote
      expect(queryParams.$filter).toContain("O''Reilly");
    });
  });

  describe('5. Unsupported Write Operations (Strictly NotImplementedException) (§5.1, §7)', () => {
    const connector = new SapS4HanaCloudConnector();

    it('createInvoice should throw NotImplementedException', async () => {
      const invoiceReq: AccountingInvoiceRequest = {
        companyId: '1010',
        referenceCode: 'ORD-001',
        issueDate: '2026-09-08',
        currency: 'TRY',
        contact: { name: 'Cust', taxNumber: '1234567890' },
        items: [],
        subtotal: 100,
        vatTotal: 20,
        grandTotal: 120,
      };
      await expect(connector.createInvoice(invoiceReq)).rejects.toThrow(NotImplementedException);
    });

    it('recordPayment should throw NotImplementedException', async () => {
      const payReq: AccountingPaymentRequest = {
        companyId: '1010',
        invoiceExternalId: 'inv-1',
        referenceCode: 'PAY-001',
        amount: 120,
        currency: 'TRY',
        paymentDate: '2026-09-08',
      };
      await expect(connector.recordPayment(payReq)).rejects.toThrow(NotImplementedException);
    });

    it('syncContact (write) should throw NotImplementedException', async () => {
      const contactReq: AccountingContactRequest = {
        companyId: '1010',
        kroptosKey: 'c1',
        name: 'Cust',
      };
      await expect(connector.syncContact(contactReq)).rejects.toThrow(NotImplementedException);
    });

    it('mapProduct (write) should throw NotImplementedException', async () => {
      const prodReq: AccountingProductRequest = {
        companyId: '1010',
        sku: 'SKU-01',
        name: 'Prod',
      };
      await expect(connector.mapProduct(prodReq)).rejects.toThrow(NotImplementedException);
    });

    it('findInvoiceByReference should throw NotImplementedException', async () => {
      await expect(connector.findInvoiceByReference('ORD-001')).rejects.toThrow(
        NotImplementedException,
      );
    });

    it('cancelInvoice should throw NotImplementedException', async () => {
      await expect(connector.cancelInvoice('inv-1')).rejects.toThrow(NotImplementedException);
    });
  });

  describe('6. Error Triggers & OData Error Handling (§5.6)', () => {
    it('mock client should throw AccountingAuthError on TRIGGER_AUTH_FAIL', async () => {
      const connector = new SapS4HanaCloudConnector({ apiKey: 'TRIGGER_AUTH_FAIL' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingAuthError);
    });

    it('mock client should throw AccountingRateLimitError on TRIGGER_RATE_LIMIT', async () => {
      const connector = new SapS4HanaCloudConnector({ apiKey: 'TRIGGER_RATE_LIMIT' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingRateLimitError);
    });

    it('mock client should throw AccountingNetworkError on TRIGGER_NETWORK_FAIL', async () => {
      const connector = new SapS4HanaCloudConnector({ apiKey: 'TRIGGER_NETWORK_FAIL' });
      await expect(connector.testConnection()).rejects.toThrow(AccountingNetworkError);
    });

    it('parseODataError should extract innererror details', () => {
      const errorPayload = {
        error: {
          code: 'CX_SY_OPEN_SQL_ERROR',
          message: {
            lang: 'en',
            value: 'SQL error occurred',
          },
          innererror: {
            errordetails: [
              { code: '001', message: 'Table locked by user' },
              { code: '002', message: 'Process terminated' },
            ],
          },
        },
      };

      const msg = SapODataHelper.parseODataError(errorPayload);
      expect(msg).toContain('SQL error occurred');
      expect(msg).toContain('Table locked by user');
      expect(msg).toContain('Process terminated');
    });
  });
});
