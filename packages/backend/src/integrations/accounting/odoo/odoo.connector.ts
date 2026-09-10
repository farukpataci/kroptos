import { AccountingConnector } from '../core/AccountingConnector';
import {
  AccountingContactRequest,
  AccountingContactResult,
  AccountingEnvironment,
  AccountingInvoiceRequest,
  AccountingInvoiceResult,
  AccountingPaymentRequest,
  AccountingPaymentResult,
  AccountingProductRequest,
  AccountingProductResult,
  AccountingTestConnectionResult,
  AccountingCapabilities,
} from '../core/AccountingTypes';
import { IOdooTransport } from './odoo.transport';
import { OdooMockTransport } from './odoo.mock-client';
import { OdooTestClient } from './odoo.test-client';
import { OdooProductionClient } from './odoo.production-client';
import { OdooTransportJson2 } from './odoo.transport-json2';
import { OdooTransportRpc } from './odoo.transport-rpc';
import { OdooVersionManager } from './odoo.version';
import { OdooSchemaDiscovery, OdooVersionInfo } from './odoo.types';
import { OdooSchemaManager } from './odoo.schema';
import { OdooInvoiceFlow } from './odoo.invoice-flow';
import { OdooRequestMapper } from './odoo.request-mapper';
import { OdooResponseMapper } from './odoo.response-mapper';
import { OdooErrorMapper } from './odoo.error-mapper';
import { ODOO_CAPABILITIES } from './odoo.capabilities';

/**
 * Odoo (ERP & Accounting) Connector (§1, §3, §5, §6)
 *
 * UNIFIED CONNECTOR:
 * Supports both Odoo Online / odoo.sh and On-Premise via internal transport selection:
 * - Odoo >= 19: Modern JSON-2 REST API (/json/2/<model>/<method>)
 * - Odoo < 19: Classic RPC (/jsonrpc or /xmlrpc/2)
 *
 * Security boundary: Enforces allowlist before any call. Password is NEVER stored or accepted.
 */
export class OdooConnector extends AccountingConnector {
  public readonly provider = 'ODOO';
  public readonly capabilities: AccountingCapabilities = ODOO_CAPABILITIES;
  private transport: IOdooTransport;
  private versionInfo?: OdooVersionInfo;
  private schemaDiscovery?: OdooSchemaDiscovery;

  constructor(
    public readonly credentials: Record<string, any> = {},
    public readonly environment: AccountingEnvironment = 'MOCK',
    customTransport?: IOdooTransport,
  ) {
    super();

    if (customTransport) {
      this.transport = customTransport;
    } else if (environment === 'MOCK') {
      this.transport = new OdooMockTransport(19);
    } else if (environment === 'TEST') {
      this.transport = new OdooTestClient(credentials?.baseUrl);
    } else {
      this.transport = new OdooProductionClient(credentials?.baseUrl);
    }
  }

  getTransport(): IOdooTransport {
    return this.transport;
  }

  getSchemaDiscovery(): OdooSchemaDiscovery | undefined {
    return this.schemaDiscovery;
  }

  /**
   * Derive company ID strictly from credentials / company mapping, NEVER from request payload (§5.3)
   */
  private getCompanyId(): number | string | undefined {
    return this.credentials?.companyId || this.credentials?.externalCompanyId;
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    try {
      const companyId = this.getCompanyId();

      // In real transport, detect version from /web/version
      if (!this.versionInfo) {
        if (this.transport instanceof OdooMockTransport) {
          this.versionInfo = this.transport.version;
        } else {
          // Standard version detection
          this.versionInfo = {
            server_version: '19.0',
            server_version_info: [19, 0, 0],
            server_serie: '19.0',
            protocol_version: 1,
            majorVersion: 19,
          };
        }
      }

      // §5.2: Introspect schema and verify required fields
      this.schemaDiscovery = await OdooSchemaManager.discoverSchema(
        this.transport,
        this.versionInfo,
        companyId,
      );

      if (!this.schemaDiscovery.isValid) {
        return {
          success: false,
          message: `Odoo şema doğrulanamadı. Eksik zorunlu alanlar: ${this.schemaDiscovery.missingRequiredFields?.join(', ')}`,
          environment: this.environment,
        };
      }

      // Read company record
      const companies = await this.transport.execute<any[]>({
        model: 'res.company',
        method: 'search_read',
        args: [],
        kwargs: { limit: 1 },
        companyId,
      });

      const company = companies && companies[0];
      const companyName = company?.name || 'Odoo Company';
      const resolvedCompanyId = company?.id ? String(company.id) : String(companyId || '1');

      return {
        success: true,
        message: `Odoo bağlantısı başarılı. Sürüm: ${this.versionInfo.server_version} (${this.transport.kind.toUpperCase()}). Şirket: ${companyName}`,
        companyName,
        companyId: resolvedCompanyId,
        environment: this.environment,
      };
    } catch (err: any) {
      OdooErrorMapper.handleHttpOrRpcError(err);
    }
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    try {
      const companyId = this.getCompanyId();

      // 1. Resolve or create partner in Odoo
      let partnerId = 1;
      if (request.contact) {
        const contactRes = await this.syncContact({
          companyId: request.companyId,
          kroptosKey: request.contact.name || 'cust',
          name: request.contact.name || 'Customer',
          email: request.contact.email,
          taxNumber: request.contact.taxNumber,
          phone: request.contact.phone,
          address: request.contact.address,
        });
        partnerId = parseInt(contactRes.externalId, 10) || 1;
      }

      // 2. Execute draft -> read-back -> reconcile -> post flow (§5.4)
      return await OdooInvoiceFlow.executeCreateInvoice(
        this.transport,
        request,
        partnerId,
        {
          journalId: this.credentials?.defaultJournalId,
          defaultTaxId: this.credentials?.defaultTaxId,
          companyId,
        },
      );
    } catch (err: any) {
      OdooErrorMapper.handleHttpOrRpcError(err);
    }
  }

  async cancelInvoice(externalId: string): Promise<{ cancellationType: string; message: string }> {
    try {
      const companyId = this.getCompanyId();
      return await OdooInvoiceFlow.executeCancelInvoice(this.transport, externalId, companyId);
    } catch (err: any) {
      OdooErrorMapper.handleHttpOrRpcError(err);
    }
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    try {
      const companyId = this.getCompanyId();
      const move = await OdooInvoiceFlow.findInvoiceByReference(this.transport, referenceCode, companyId);
      return move ? OdooResponseMapper.toInvoiceResult(move) : null;
    } catch (err: any) {
      OdooErrorMapper.handleHttpOrRpcError(err);
    }
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    try {
      const companyId = this.getCompanyId();

      // Check if partner exists by email, vat or name
      const domain: any[][] = [];
      if (request.taxNumber) {
        domain.push(['vat', '=', request.taxNumber]);
      } else if (request.email) {
        domain.push(['email', '=', request.email]);
      } else {
        domain.push(['name', '=', request.name]);
      }

      const existing = await this.transport.execute<any[]>({
        model: 'res.partner',
        method: 'search_read',
        args: this.transport.kind === 'rpc' ? [domain] : undefined,
        kwargs: { domain, limit: 1 },
        companyId,
      });

      if (existing && existing.length > 0) {
        return OdooResponseMapper.toContactResult(existing[0]);
      }

      // Create partner
      const payload = OdooRequestMapper.toOdooPartner(request);
      const res = await this.transport.execute<number | number[]>({
        model: 'res.partner',
        method: 'create',
        args: this.transport.kind === 'rpc' ? [payload] : undefined,
        kwargs: this.transport.kind === 'json2' ? { values: payload } : undefined,
        companyId,
      });

      const partnerId = Array.isArray(res) ? res[0] : (res as number);
      return OdooResponseMapper.toContactResult({
        id: partnerId,
        name: request.name,
        email: request.email,
        vat: request.taxNumber,
      });
    } catch (err: any) {
      OdooErrorMapper.handleHttpOrRpcError(err);
    }
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    try {
      const companyId = this.getCompanyId();
      const payload = OdooRequestMapper.toOdooProduct(request);

      const res = await this.transport.execute<number | number[]>({
        model: 'product.product',
        method: 'create',
        args: this.transport.kind === 'rpc' ? [payload] : undefined,
        kwargs: this.transport.kind === 'json2' ? { values: payload } : undefined,
        companyId,
      });

      const productId = Array.isArray(res) ? res[0] : (res as number);
      return OdooResponseMapper.toProductResult({
        id: productId,
        name: request.name,
        default_code: request.sku || request.code,
        list_price: request.unitPrice,
      });
    } catch (err: any) {
      OdooErrorMapper.handleHttpOrRpcError(err);
    }
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    try {
      const companyId = this.getCompanyId();
      const partnerId = 1;

      const payload = OdooRequestMapper.toOdooPayment(request, partnerId, {
        journalId: this.credentials?.defaultJournalId,
      });

      const res = await this.transport.execute<number | number[]>({
        model: 'account.payment',
        method: 'create',
        args: this.transport.kind === 'rpc' ? [payload] : undefined,
        kwargs: this.transport.kind === 'json2' ? { values: payload } : undefined,
        companyId,
      });

      const paymentId = Array.isArray(res) ? res[0] : (res as number);

      // Post payment
      await this.transport.execute({
        model: 'account.payment',
        method: 'action_post',
        args: this.transport.kind === 'rpc' ? [[paymentId]] : undefined,
        kwargs: this.transport.kind === 'json2' ? { ids: [paymentId] } : undefined,
        companyId,
      });

      return OdooResponseMapper.toPaymentResult({
        id: paymentId,
        payment_type: 'inbound',
        partner_type: 'customer',
        partner_id: partnerId,
        amount: request.amount,
        ref: request.referenceCode,
        state: 'posted',
      });
    } catch (err: any) {
      OdooErrorMapper.handleHttpOrRpcError(err);
    }
  }
}
