import { AccountingProviderRegistry } from '../AccountingProviderRegistry';
import { IntegrationNotVerifiedError } from '../AccountingErrors';
import { CapabilityStatus } from '../AccountingTypes';
// Ensure registered providers are loaded
import '../../parasut';
import '../../kolaybi';
import '../../bizimhesap';
import '../../sap-s4hana-cloud';

describe('Accounting Provider Conformance Suite', () => {
  const providers = AccountingProviderRegistry.all();

  it('should have at least one registered provider', () => {
    expect(providers.length).toBeGreaterThan(0);
  });

  describe.each(providers.map((p) => [p.id, p]))('Provider: %s', (_id, descriptor) => {
    it('1. should have uppercase unique ID', () => {
      expect(descriptor.id).toBe(descriptor.id.toUpperCase());
      expect(descriptor.id.length).toBeGreaterThan(0);
    });

    it('2. should have non-empty displayName and country', () => {
      expect(descriptor.displayName).toBeDefined();
      expect(descriptor.displayName.length).toBeGreaterThan(0);
      expect(descriptor.country).toBeDefined();
      expect(descriptor.country.length).toBe(2);
    });

    it('3. should have valid protocol', () => {
      expect(['jsonapi', 'rest', 'custom', 'soap', 'odata']).toContain(descriptor.protocol);
    });

    it('4. should have valid readiness status', () => {
      expect(['MOCK_READY', 'TEST_READY', 'PRODUCTION_READY']).toContain(descriptor.readiness);
    });

    it('5. should have valid credential schema with required field definitions', () => {
      expect(descriptor.credentialSchema.fields.length).toBeGreaterThan(0);
      for (const field of descriptor.credentialSchema.fields) {
        expect(field.key).toBeDefined();
        expect(field.label).toBeDefined();
        expect(['text', 'password', 'url', 'number', 'select']).toContain(field.type);
        expect(typeof field.required).toBe('boolean');
      }
    });

    it('6. should declare stockSync as NOT_SUPPORTED', () => {
      expect(descriptor.capabilities.stockSync).toBe('NOT_SUPPORTED');
    });

    it('7. should declare all core capability statuses', () => {
      const validStatuses = Object.values(CapabilityStatus);
      expect(validStatuses).toContain(descriptor.capabilities.salesInvoice);
      expect(validStatuses).toContain(descriptor.capabilities.payment);
      expect(validStatuses).toContain(descriptor.capabilities.contactSync);
      expect(validStatuses).toContain(descriptor.capabilities.productMapping);
    });

    it('8. should have connectorClass implementing AccountingConnector', () => {
      expect(descriptor.connectorClass).toBeDefined();
      const connector = new descriptor.connectorClass({}, 'MOCK');
      expect(typeof connector.testConnection).toBe('function');
      expect(typeof connector.createInvoice).toBe('function');
      expect(typeof connector.syncContact).toBe('function');
      expect(typeof connector.recordPayment).toBe('function');
      expect(typeof connector.mapProduct).toBe('function');
    });

    it('9. should instantiate connector in MOCK environment', () => {
      const connector = new descriptor.connectorClass({}, 'MOCK');
      expect(connector.environment).toBe('MOCK');
      expect(connector.provider).toBe(descriptor.id);
    });

    it('10. should reject TEST environment if supportsTest is false', async () => {
      if (!descriptor.supportsTest) {
        const connector = new descriptor.connectorClass({}, 'TEST');
        await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
      }
    });

    it('11. should reject PRODUCTION environment if supportsProduction is false', async () => {
      if (!descriptor.supportsProduction) {
        const connector = new descriptor.connectorClass({}, 'PRODUCTION');
        await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
      }
    });

    it('12. mock client createInvoice behavior matches capability', async () => {
      const connector = new descriptor.connectorClass({}, 'MOCK');
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'INV-101',
        issueDate: '2026-09-08',
        currency: 'TRY',
        contact: {
          name: 'Test Customer',
          address: 'Test Adres No:1',
          taxNumber: '1234567890',
        },
        items: [
          {
            sku: 'SKU-1',
            name: 'Item 1',
            quantity: 1,
            unitPrice: 100,
            vatRate: 20,
            vatAmount: 20,
            totalAmount: 120,
          },
        ],
        subtotal: 100,
        vatTotal: 20,
        grandTotal: 120,
      };

      if (descriptor.capabilities.salesInvoice === 'NOT_SUPPORTED') {
        await expect(connector.createInvoice(invoiceReq)).rejects.toThrow();
      } else {
        const res = await connector.createInvoice(invoiceReq);
        expect(res.externalId).toBeDefined();
      }
    });

    it('13. mock client syncContact behavior matches capability', async () => {
      const connector = new descriptor.connectorClass({}, 'MOCK');
      const contactReq = {
        companyId: 'comp-1',
        kroptosKey: 'cust-1',
        name: 'Mock Customer',
        taxNumber: '12345678901',
      };
      if (descriptor.capabilities.contactSync === 'NOT_SUPPORTED') {
        await expect(connector.syncContact(contactReq)).rejects.toThrow();
      } else {
        const res = await connector.syncContact(contactReq);
        expect(res.externalId).toBeDefined();
      }
    });

    it('14. mock client recordPayment behavior matches capability', async () => {
      const connector = new descriptor.connectorClass({}, 'MOCK');
      const payReq = {
        companyId: 'comp-1',
        invoiceExternalId: 'inv-1',
        referenceCode: 'PAY-1',
        amount: 120,
        currency: 'TRY',
        paymentDate: '2026-09-08',
      };
      if (descriptor.capabilities.payment === 'NOT_SUPPORTED') {
        await expect(connector.recordPayment(payReq)).rejects.toThrow();
      } else {
        const res = await connector.recordPayment(payReq);
        expect(res.externalId).toBeDefined();
      }
    });

    it('15. sandboxVerifiedAt must not enable supportsTest (§6)', () => {
      if (descriptor.sandboxVerifiedAt) {
        expect(descriptor.supportsTest).toBe(false);
        expect(descriptor.supportsProduction).toBe(false);
      }
    });
  });
});
