import { AccountingConnector } from '../core/AccountingConnector';
import {
  AccountingCapabilities,
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
  CompanyKey,
} from '../core/AccountingTypes';
import { AccountingTransport, TransportOperation } from '../core/transport/AccountingTransport';
import { DirectTransport } from '../core/transport/DirectTransport';
import { assertExpectedColumns, resolveQuery, validateCatalogParams } from '../core/catalog/CatalogManifest';
import { NEBIM_V3_CAPABILITIES } from './nebim-v3.capabilities';
import { NEBIM_V3_CATALOG } from './nebim-v3.catalog';
import { NebimV3RequestMapper } from './nebim-v3.request-mapper';
import { NebimV3ResponseMapper } from './nebim-v3.response-mapper';
import { NEBIM_V3_FORBIDDEN_BODY_KEYS, NEBIM_V3_PATHS } from './nebim-v3.types';

export interface NebimV3ConnectorContext {
  transport?: AccountingTransport;
  integrationId?: string;
  companyKey?: CompanyKey;
  postingDefaults?: Record<string, any> | null;
}

/**
 * Nebim V3 ERP connector — readiness SCAFFOLDED (docs/nebim.v3.agent.md §7).
 * Protokolü konuşur, Agent taşır: işler `transport.execute` ile iletilir.
 * Kimlik ve SessionID Agent oturum havuzunda tutulur; connector bunlara erişmez (K1, K15).
 */
export class NebimV3Connector extends AccountingConnector {
  readonly provider = 'NEBIM-V3';
  readonly capabilities: AccountingCapabilities = NEBIM_V3_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly transport: AccountingTransport;
  private readonly integrationId: string;
  private readonly companyKey: CompanyKey;
  private readonly postingDefaults: Record<string, any> | null;

  /** Conformance test 32 için sızıntı kontrol anahtarları */
  readonly forbiddenBodyKeys = NEBIM_V3_FORBIDDEN_BODY_KEYS;

  constructor(
    private readonly credentials: Record<string, any> = {},
    environment: AccountingEnvironment = 'MOCK',
    ctx: NebimV3ConnectorContext = {},
  ) {
    super();
    this.environment = environment;
    this.transport = ctx.transport ?? new DirectTransport();
    this.integrationId = ctx.integrationId ?? 'unbound';
    // databaseName -> companyNo, officeCode -> branchCode, periodNo -> null (§7.1)
    this.companyKey = ctx.companyKey ?? {
      companyNo: String(credentials.companyId ?? credentials.databaseName ?? ''),
      periodNo: null,
      branchCode: credentials.branchCode ?? credentials.officeCode ?? null,
    };
    this.postingDefaults = ctx.postingDefaults ?? credentials.postingDefaults ?? null;
  }

  private op(type: TransportOperation['type'], payload: unknown, idempotencyKey?: string): TransportOperation {
    return {
      type,
      integrationId: this.integrationId,
      companyKey: this.companyKey,
      payload,
      idempotencyKey: idempotencyKey ?? null,
    };
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const started = Date.now();
    if (this.environment === 'MOCK') {
      return this.mockConnectionResult(started, this.companyKey.companyNo || undefined);
    }
    this.guard('connectionTest');
    const r = await this.transport.execute(
      this.op('CONNECTION_TEST', { method: 'Connect', path: NEBIM_V3_PATHS.Connect, body: {} }),
    );
    return {
      ...NebimV3ResponseMapper.toTestConnectionResult(r.data, this.companyKey.companyNo),
      environment: this.environment,
      durationMs: Date.now() - started,
    };
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    this.guard('invoicePush');
    const externalRef = request.referenceCode;
    const body = NebimV3RequestMapper.toInvoiceBody(request, this.postingDefaults, externalRef);
    const r = await this.transport.execute(
      this.op('INVOICE_PUSH', { method: 'InvoicePush', body }, externalRef),
    );
    return NebimV3ResponseMapper.toInvoiceResult(r.data, externalRef);
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    this.guard('receiptPush');
    const body = NebimV3RequestMapper.toReceiptBody(request, this.postingDefaults, request.referenceCode);
    const r = await this.transport.execute(this.op('RECEIPT_PUSH', { body }, request.referenceCode));
    return { externalId: String((r.data as any)?.document_id ?? ''), rawResponse: r.data as any };
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    this.guard('partnerUpsert');
    const body = NebimV3RequestMapper.toPartnerBody(request);
    const r = await this.transport.execute(this.op('PARTNER_UPSERT', { body }));
    return { externalId: String((r.data as any)?.external_id ?? ''), rawResponse: r.data as any };
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    this.guard('productFetch');
    const r = await this.transport.execute(this.op('PRODUCT_FETCH', { sku: request.sku }));
    return { externalId: String((r.data as any)?.product_code ?? ''), code: request.sku, rawResponse: r.data as any };
  }

  async createProduct(_request: AccountingProductRequest): Promise<AccountingProductResult> {
    this.guard('productCreate');
    throw new Error('Unreachable due to guard');
  }

  /** K11 — dış referanstan evrak sorgulama (katalog üzerinden) */
  async findInvoiceByReference(externalRef: string): Promise<AccountingInvoiceResult | null> {
    this.guard('invoiceFindByRef');
    const spec = resolveQuery(NEBIM_V3_CATALOG, 'nebim.invoice_by_ref');
    const params = validateCatalogParams(spec, { ref: externalRef });
    const r = await this.transport.execute<{ rows: Array<Record<string, unknown>>; columns?: string[] }>(
      this.op('CATALOG_QUERY', { queryId: spec.queryId, params }),
    );
    const rows = r.data?.rows ?? [];
    if (rows.length === 0 && r.data?.columns) {
      assertExpectedColumns(spec, rows, r.data.columns);
      return null;
    }
    assertExpectedColumns(spec, rows, r.data?.columns);
    return NebimV3ResponseMapper.toInvoiceResultFromCatalogRow(rows[0], externalRef);
  }

  /** Conformance test 32 için istek önizleme üretici */
  buildRequestPreview(type: 'invoice' | 'partner' | 'receipt' | 'stock', payload: any): unknown {
    switch (type) {
      case 'invoice':
        return NebimV3RequestMapper.toInvoiceBody(
          payload,
          this.postingDefaults ?? { storeCode: 'M1', orderWarehouseCode: 'D1' },
          payload.referenceCode ?? 'REF-1',
        );
      case 'partner':
        return NebimV3RequestMapper.toPartnerBody(payload);
      case 'receipt':
        return NebimV3RequestMapper.toReceiptBody(
          payload,
          this.postingDefaults ?? { storeCode: 'M1' },
          payload.referenceCode ?? 'REF-1',
        );
      case 'stock':
        return { companyNo: this.companyKey.companyNo };
      default:
        return {};
    }
  }
}
