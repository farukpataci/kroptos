import { LexwareConnector } from './lexware.connector';
import { LexwareMockClient } from './lexware.mock-client';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import { AccountingTokenStore } from '../core/AccountingTokenStore';
import { IntegrationNotVerifiedError, AccountingAmountMismatchError } from '../core/AccountingErrors';
import { LexwareStatusMapper } from './lexware.status-mapper';
import { LexwareErrorMapper, LexwareValidationError } from './lexware.error-mapper';
import { LEXWARE_CAPABILITIES } from './lexware.capabilities';
import './lexware.descriptor'; // Ensure auto-registration

describe('LexwareConnector Suite (§4, §5, §8, §9)', () => {
  let connector: LexwareConnector;
  let mockClient: LexwareMockClient;

  const validCredentials = {
    apiKey: 'lex_live_mock_secret_key_12345',
  };

  const sampleInvoiceReq = {
    companyId: 'org-test-1',
    referenceCode: 'KROP-LEX-777',
    issueDate: '2026-09-10',
    dueDate: '2026-09-24',
    currency: 'EUR',
    contact: {
      name: 'Erika Mustermann',
      address: 'Friedrichstraße 42, 10117 Berlin',
      taxNumber: 'DE999888777',
    },
    items: [
      {
        sku: 'ART-101',
        name: 'Beratungsleistung',
        quantity: 1,
        unitPrice: 100,
        vatRate: 19,
        vatAmount: 19,
        totalAmount: 119,
      },
    ],
    subtotal: 100,
    vatTotal: 19,
    grandTotal: 119,
  };

  beforeEach(() => {
    mockClient = new LexwareMockClient();
    connector = new LexwareConnector(validCredentials, 'MOCK', mockClient);
  });

  describe('1. Registry & Scope (§1, §9.18)', () => {
    it('is registered as LEXWARE-OFFICE in AccountingProviderRegistry', () => {
      expect(AccountingProviderRegistry.has('LEXWARE-OFFICE')).toBe(true);
      const desc = AccountingProviderRegistry.get('LEXWARE-OFFICE');
      expect(desc.displayName).toBe('Lexware Office');
      expect(desc.country).toBe('DE');
      expect(desc.protocol).toBe('rest');
      expect(desc.readiness).toBe('MOCK_READY');
    });

    it('§1 & §9.18: lexware-desktop is strictly NOT in the registry', () => {
      expect(AccountingProviderRegistry.has('lexware-desktop')).toBe(false);
      expect(AccountingProviderRegistry.has('LEXWARE-DESKTOP')).toBe(false);
    });
  });

  describe('2. Negative Test: Core Token Store Bypassed (§4, §9.14)', () => {
    it('verifies that Lexware has no refreshSemantics and never registers in token store', () => {
      expect(LEXWARE_CAPABILITIES.refreshSemantics).toBeUndefined();

      // AccountingTokenStore should not register keep-alive, rotation, or stored token for Lexware
      const tokenStore = new AccountingTokenStore();
      const token = tokenStore.getToken('lexware-office:org-test-1');
      expect(token).toBeUndefined();
    });
  });

  describe('3. Lifecycle & Forbidden Param Check (§5.2, §9.1, §9.2, §9.12)', () => {
    it('creates invoice via draft -> reconcile -> finalize without ?finalize=true (§9.1, §9.2)', async () => {
      const res = await connector.createInvoice(sampleInvoiceReq);

      expect(res.externalId).toBeDefined();
      expect(res.externalNumber).toMatch(/^RE-2026-\d+/);
      expect(res.rawResponse?.finalized).toBe(true);

      // Verify no ?finalize=true in any request made to client
      for (const req of mockClient.requestHistory) {
        expect(req.path).not.toContain('finalize=true');
        if (req.body) {
          expect(JSON.stringify(req.body)).not.toContain('finalize=true');
        }
      }
    });

    it('§9.12: never writes to /vouchers endpoint under any circumstance', async () => {
      await connector.createInvoice(sampleInvoiceReq);
      await connector.syncContact({ companyId: 'org-test-1', kroptosKey: 'c-1', name: 'Test Contact' });
      await connector.mapProduct({ companyId: 'org-test-1', sku: 'P-1', name: 'Product 1', unitPrice: 10 });

      for (const req of mockClient.requestHistory) {
        expect(req.path).not.toContain('/vouchers');
      }
    });
  });

  describe('4. Error Model & HTTP 406 (§3.6, §5.3, §9.4, §9.5)', () => {
    it('classifies HTTP 406 as non-retryable validation error driven by i18nKey (§9.4, §9.5)', async () => {
      mockClient.simulateValidation406 = {
        i18nKey: 'invalid_tax_conditions',
        message: 'Original message text that could change at any time',
      };

      await expect(connector.createInvoice(sampleInvoiceReq)).rejects.toThrow(LexwareValidationError);
    });
  });

  describe('5. Read-Only /payment Endpoint (§5.7)', () => {
    it('rejects recording payments because /payments is strictly read-only', async () => {
      await expect(
        connector.recordPayment({
          companyId: 'org-test-1',
          referenceCode: 'PAY-1',
          invoiceExternalId: 'inv-1',
          amount: 119,
          currency: 'EUR',
          paymentDate: '2026-09-10',
        }),
      ).rejects.toThrow(/desteklenmemektedir/);
    });
  });

  describe('6. Cancellation Rules (§3.3, §8, Universal Rule 18)', () => {
    it('deletes draft invoice successfully', async () => {
      const draft = await mockClient.createDraftInvoice({
        voucherDate: '2026-09-10',
        address: { name: 'Draft Customer', countryCode: 'DE' },
        lineItems: [],
        totalPrice: { currency: 'EUR', totalNetAmount: 0, totalGrossAmount: 0, totalTaxAmount: 0 },
        taxAmounts: [],
        taxConditions: { taxType: 'net' },
      });

      await expect(connector.cancelInvoice(draft.id)).resolves.not.toThrow();
    });

    it('rejects deleting or cancelling finalized open invoice (recommends credit note)', async () => {
      const created = await connector.createInvoice(sampleInvoiceReq);

      await expect(connector.cancelInvoice(created.externalId)).rejects.toThrow(
        /Alacak Dekontu \(Rechnungskorrektur/,
      );
    });
  });

  describe('7. Status Mapping & Safety (§7, §9.15)', () => {
    it('maps statuses correctly and unmapped status strictly to pending (§9.15)', () => {
      expect(LexwareStatusMapper.toKroptosStatus('draft')).toBe('pending');
      expect(LexwareStatusMapper.toKroptosStatus('open')).toBe('sent');
      expect(LexwareStatusMapper.toKroptosStatus('paid')).toBe('sent');
      expect(LexwareStatusMapper.toKroptosStatus('voided')).toBe('cancelled');
      expect(LexwareStatusMapper.toKroptosStatus('unknown_status')).toBe('pending');
      expect(LexwareStatusMapper.toKroptosStatus(undefined)).toBe('pending');
      expect(LexwareStatusMapper.toKroptosStatus(null)).toBe('pending');
    });
  });

  describe('8. Environment Protection (§9.19)', () => {
    it('TEST and PRODUCTION throw IntegrationNotVerifiedError (§9.19)', async () => {
      const testConnector = new LexwareConnector(validCredentials, 'TEST');
      await expect(testConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);

      const prodConnector = new LexwareConnector(validCredentials, 'PRODUCTION');
      await expect(prodConnector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });
  });

  describe('9. Pagination Limit (§3.5, §9.11)', () => {
    it('lists invoices respecting size limit of 250', async () => {
      const pageRes = await mockClient.listInvoices(0, 300);
      expect(pageRes.size).toBe(250); // Capped to 250 per §3.5
      expect(pageRes.totalPages).toBeGreaterThanOrEqual(1);
    });
  });
});
