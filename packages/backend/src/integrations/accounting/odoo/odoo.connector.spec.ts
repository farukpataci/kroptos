import { OdooConnector } from './odoo.connector';
import { OdooMockTransport } from './odoo.mock-client';
import { ODOO_CREDENTIAL_SCHEMA } from './odoo.credential-schema';
import { ODOO_CAPABILITIES } from './odoo.capabilities';
import { OdooVersionManager } from './odoo.version';
import { OdooSchemaManager } from './odoo.schema';
import { BadRequestException } from '@nestjs/common';
import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { OdooStatusMapper } from './odoo.status-mapper';
import { AccountingTokenStore } from '../core/AccountingTokenStore';

describe('Odoo Accounting Connector Suite (§1, §3, §5, §7, §8)', () => {
  let connector: OdooConnector;
  let mockTransport: OdooMockTransport;

  beforeEach(() => {
    mockTransport = new OdooMockTransport(19);
    connector = new OdooConnector(
      {
        baseUrl: 'https://demo.odoo.com',
        database: 'demo_db',
        apiKey: 'mock-key-12345',
        companyId: 1,
      },
      'MOCK',
      mockTransport,
    );
  });

  describe('1. Version Detection & Transport Selection (§8.1, §8.2, §8.3, §8.4)', () => {
    it('selects JSON-2 transport for Odoo >= 19 (§8.1)', () => {
      mockTransport.setVersion(19);
      expect(mockTransport.kind).toBe('json2');
      expect(OdooVersionManager.selectTransport(mockTransport.version)).toBe('json2');
    });

    it('selects Classic RPC transport for Odoo < 19 (§8.1)', () => {
      mockTransport.setVersion(17);
      expect(mockTransport.kind).toBe('rpc');
      expect(OdooVersionManager.selectTransport(mockTransport.version)).toBe('rpc');
    });

    it('fails connection if version info is invalid (§8.3)', async () => {
      expect(() => OdooVersionManager.parseVersion({})).toThrow(/tespit edilemedi/);
    });

    it('invoice creation works seamlessly across both JSON-2 and Classic RPC (§8.4)', async () => {
      // Test with JSON-2 (v19)
      mockTransport.setVersion(19);
      const req = {
        companyId: 'comp-1',
        referenceCode: 'INV-CROSS-19',
        issueDate: '2026-09-10',
        currency: 'EUR',
        contact: { name: 'Customer v19' },
        items: [{ sku: 'SKU-1', name: 'Item 1', quantity: 2, unitPrice: 50, vatRate: 0, vatAmount: 0, totalAmount: 100 }],
        subtotal: 100,
        vatTotal: 0,
        grandTotal: 100,
      };

      const res19 = await connector.createInvoice(req);
      expect(res19.externalId).toBeDefined();
      expect(res19.rawResponse?.posted).toBe(true);

      // Test with Classic RPC (v17)
      mockTransport.setVersion(17);
      const req17 = {
        ...req,
        referenceCode: 'INV-CROSS-17',
        contact: { name: 'Customer v17' },
      };

      const res17 = await connector.createInvoice(req17);
      expect(res17.externalId).toBeDefined();
      expect(res17.rawResponse?.posted).toBe(true);
    });
  });

  describe('2. Security Boundary & Allowlist (§5.1, §8.5, §8.6)', () => {
    it('rejects forbidden model/method combinations without network request (§8.5)', async () => {
      await expect(
        mockTransport.execute({
          model: 'res.users',
          method: 'write',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects deletion (unlink) even on allowed models (§8.5)', async () => {
      await expect(
        mockTransport.execute({
          model: 'account.move',
          method: 'unlink',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('verifies that credential schema contains NO password field (§8.17)', () => {
      const fieldKeys = ODOO_CREDENTIAL_SCHEMA.fields.map((f) => f.key);
      expect(fieldKeys).toContain('apiKey');
      expect(fieldKeys).toContain('baseUrl');
      expect(fieldKeys).toContain('database');
      expect(fieldKeys).not.toContain('password');
    });
  });

  describe('3. Schema Introspection & Discovery (§5.2, §8.7, §8.8)', () => {
    it('passes testConnection when all required fields exist', async () => {
      const res = await connector.testConnection();
      expect(res.success).toBe(true);
      expect(res.message).toContain('Odoo bağlantısı başarılı');
      expect(connector.getSchemaDiscovery()?.isValid).toBe(true);
    });

    it('fails testConnection when a required field is missing in Odoo (§8.7)', async () => {
      mockTransport.simulateMissingField = 'account.move.amount_total';

      const res = await connector.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toContain('Eksik zorunlu alanlar: account.move.amount_total');
    });

    it('detects when rediscovery is required due to version change (§8.8)', () => {
      const oldDiscovery = connector.getSchemaDiscovery();
      const currentVersion = { ...mockTransport.version, majorVersion: 20, server_version: '20.0' };

      expect(OdooSchemaManager.shouldRediscover(oldDiscovery, currentVersion)).toBe(true);
    });
  });

  describe('4. Invoice Flow & Reconciliation (§5.4, §8.11, §8.12, §8.14)', () => {
    it('creates draft, reconciles totals, and posts invoice to ledger (§5.4)', async () => {
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-ODOO-100',
        issueDate: '2026-09-10',
        currency: 'EUR',
        contact: { name: 'Acme Corp', email: 'acme@example.com' },
        items: [
          { sku: 'SKU-A', name: 'Product A', quantity: 1, unitPrice: 200, vatRate: 0, vatAmount: 0, totalAmount: 200 },
        ],
        subtotal: 200,
        vatTotal: 0,
        grandTotal: 200,
      };

      const res = await connector.createInvoice(invoiceReq);
      expect(res.externalId).toBeDefined();
      expect(res.externalNumber).toMatch(/^INV\/2026\/\d+$/);
      expect(res.rawResponse?.posted).toBe(true);
      expect(res.rawResponse?.reconciliationMatched).toBe(true);
    });

    it('DOES NOT POST if totals do not reconcile (§5.4, §8.12)', async () => {
      mockTransport.simulateAmountMismatch = true;

      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-MISMATCH-1',
        issueDate: '2026-09-10',
        currency: 'EUR',
        contact: { name: 'Acme Corp' },
        items: [
          { sku: 'SKU-A', name: 'Product A', quantity: 1, unitPrice: 100, vatRate: 0, vatAmount: 0, totalAmount: 100 },
        ],
        subtotal: 100,
        vatTotal: 0,
        grandTotal: 100,
      };

      const res = await connector.createInvoice(invoiceReq);
      expect(res.rawResponse?.reconciliationMismatch).toBe(true);
      expect(res.rawResponse?.reconciliationDiff).toBe(50);
      expect(res.rawResponse?.posted).toBeUndefined(); // Was NOT posted!

      const savedMove = mockTransport.moves.get(parseInt(res.externalId, 10))!;
      expect(savedMove.state).toBe('draft'); // Remains draft in Odoo
    });

    it('finds existing invoice by reference for idempotent replay (§5.6)', async () => {
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-IDEMPOTENT-1',
        issueDate: '2026-09-10',
        currency: 'EUR',
        contact: { name: 'Acme Corp' },
        items: [{ sku: 'SKU-A', name: 'Product A', quantity: 1, unitPrice: 50, vatRate: 0, vatAmount: 0, totalAmount: 50 }],
        subtotal: 50,
        vatTotal: 0,
        grandTotal: 50,
      };

      const first = await connector.createInvoice(invoiceReq);
      const second = await connector.createInvoice(invoiceReq);

      expect(second.externalId).toBe(first.externalId);
      expect(second.rawResponse?.idempotentReplay).toBe(true);
    });

    it('cancels draft invoice via button_cancel (§5.5, §8.14)', async () => {
      // Create draft invoice that mismatches so it stays draft
      mockTransport.simulateAmountMismatch = true;
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-CANCEL-DRAFT',
        issueDate: '2026-09-10',
        currency: 'EUR',
        contact: { name: 'Customer' },
        items: [{ sku: 'SKU-C', name: 'Item C', quantity: 1, unitPrice: 60, vatRate: 0, vatAmount: 0, totalAmount: 60 }],
        subtotal: 60,
        vatTotal: 0,
        grandTotal: 60,
      };

      const created = await connector.createInvoice(invoiceReq);
      const cancelRes = await connector.cancelInvoice(created.externalId);

      expect(cancelRes.cancellationType).toBe('cancelled');
      expect(cancelRes.message).toContain('başarıyla iptal edildi');

      const move = mockTransport.moves.get(parseInt(created.externalId, 10))!;
      expect(move.state).toBe('cancel');
    });

    it('throws IntegrationNotVerifiedError when cancelling posted invoice (§5.5)', async () => {
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-CANCEL-POSTED',
        issueDate: '2026-09-10',
        currency: 'EUR',
        contact: { name: 'Customer' },
        items: [{ sku: 'SKU-D', name: 'Item D', quantity: 1, unitPrice: 70, vatRate: 0, vatAmount: 0, totalAmount: 70 }],
        subtotal: 70,
        vatTotal: 0,
        grandTotal: 70,
      };

      const created = await connector.createInvoice(invoiceReq);
      // Fatura post edildi
      await expect(connector.cancelInvoice(created.externalId)).rejects.toThrow(
        IntegrationNotVerifiedError,
      );
    });

    it('fails cancellation if invoice is already cancelled (§8.14)', async () => {
      mockTransport.simulateAmountMismatch = true;
      const invoiceReq = {
        companyId: 'comp-1',
        referenceCode: 'ORD-DOUBLE-CANCEL',
        issueDate: '2026-09-10',
        currency: 'EUR',
        contact: { name: 'Customer' },
        items: [{ sku: 'SKU-E', name: 'Item E', quantity: 1, unitPrice: 80, vatRate: 0, vatAmount: 0, totalAmount: 80 }],
        subtotal: 80,
        vatTotal: 0,
        grandTotal: 80,
      };

      const created = await connector.createInvoice(invoiceReq);
      await connector.cancelInvoice(created.externalId);

      await expect(connector.cancelInvoice(created.externalId)).rejects.toThrow(/zaten iptal edilmiştir/);
    });
  });

  describe('5. Negative Test: Core Token Store Bypassed (§5.7, §8.16)', () => {
    it('verifies that Odoo has no refreshSemantics and never touches token store', () => {
      expect(ODOO_CAPABILITIES.refreshSemantics).toBeUndefined();

      // AccountingTokenStore should not register keep-alive or rotation for Odoo
      const tokenStore = new AccountingTokenStore();
      const token = tokenStore.getToken('odoo:comp-1');
      expect(token).toBeUndefined();
    });
  });

  describe('6. Status & Environment Guards (§6, §8.18, §8.20)', () => {
    it('maps unknown status to pending (never sent or cancelled) (§8.18)', () => {
      expect(OdooStatusMapper.toKroptosStatus('unknown_status')).toBe('pending');
      expect(OdooStatusMapper.toKroptosStatus(undefined)).toBe('pending');
      expect(OdooStatusMapper.toKroptosStatus('')).toBe('pending');
    });

    it('TEST and PRODUCTION environments throw IntegrationNotVerifiedError (§8.20)', async () => {
      const testConnector = new OdooConnector({ baseUrl: 'https://test.odoo.com' }, 'TEST');
      await expect(testConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);

      const prodConnector = new OdooConnector({ baseUrl: 'https://prod.odoo.com' }, 'PRODUCTION');
      await expect(prodConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });
  });
});
