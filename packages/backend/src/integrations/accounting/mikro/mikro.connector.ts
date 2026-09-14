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
import { MIKRO_CAPABILITIES } from './mikro.capabilities';
import { MIKRO_CATALOG } from './mikro.catalog';
import { MikroRequestMapper } from './mikro.request-mapper';
import { MikroResponseMapper } from './mikro.response-mapper';
import { MIKRO_FORBIDDEN_BODY_KEYS, MIKRO_METHOD_VERSIONS, MIKRO_PATHS, MikroMethod } from './mikro.types';

/** Connector'a rota bağlamı — KİMLİK YOK (K1). Factory verir; yoksa yürütücüsüz DirectTransport. */
export interface MikroConnectorContext {
  transport?: AccountingTransport;
  integrationId?: string;
  companyKey?: CompanyKey;
  invoiceSeries?: string | null;
  methodVersions?: Record<string, string>;
}

/**
 * Mikro ERP connector — readiness SCAFFOLDED (docs/mikro.agent.md GÖREV 3).
 * Protokolü konuşur, Agent taşır: her iş `transport.execute` ile gider; `Mikro: {...}` kimlik
 * zarfını Agent takar (K1). Bugün her yetenek DOCUMENTATION_REQUIRED / CONTRACT_REQUIRED /
 * NOT_SUPPORTED olduğu için guard() ağ çağrısından ÖNCE fırlatır (K3) — bu, tasarım gereğidir.
 */
export class MikroConnector extends AccountingConnector {
  readonly provider = 'MIKRO';
  readonly capabilities: AccountingCapabilities = MIKRO_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly transport: AccountingTransport;
  private readonly integrationId: string;
  private readonly companyKey: CompanyKey;
  private readonly invoiceSeries: string | null;
  private readonly methodVersions: Record<string, string>;

  constructor(
    private readonly credentials: Record<string, any> = {},
    environment: AccountingEnvironment = 'MOCK',
    ctx: MikroConnectorContext = {},
  ) {
    super();
    this.environment = environment;
    this.transport = ctx.transport ?? new DirectTransport();
    this.integrationId = ctx.integrationId ?? 'unbound';
    // FirmaKodu/CalismaYili credential DEĞİL — AccountingCompany satırından gelir (§7.2)
    this.companyKey = ctx.companyKey ?? { companyNo: String(credentials.companyId ?? ''), periodNo: credentials.periodNo ?? null };
    this.invoiceSeries = ctx.invoiceSeries ?? credentials.invoiceSeries ?? null;
    this.methodVersions = ctx.methodVersions ?? MIKRO_METHOD_VERSIONS;
  }

  /** Metot yolu descriptor'daki sürümle kurulur; normalize edilmez, "en yeni" seçilmez (§7.5). */
  methodPath(method: MikroMethod): string {
    return `${MIKRO_PATHS[method]}${this.methodVersions[method] ?? ''}`;
  }

  private op(type: TransportOperation['type'], payload: unknown, idempotencyKey?: string): TransportOperation {
    return { type, integrationId: this.integrationId, companyKey: this.companyKey, payload, idempotencyKey: idempotencyKey ?? null };
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const started = Date.now();
    if (this.environment === 'MOCK') return this.mockConnectionResult(started, this.companyKey.companyNo || undefined);
    this.guard('connectionTest');
    const r = await this.transport.execute(this.op('CONNECTION_TEST', { method: 'APILogin', path: this.methodPath('APILogin'), body: {} }));
    return { ...MikroResponseMapper.toTestConnectionResult(r.data, this.companyKey.companyNo), environment: this.environment, durationMs: Date.now() - started };
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    this.guard('invoicePush');
    const externalRef = request.referenceCode;
    const body = MikroRequestMapper.toInvoiceBody(request, this.invoiceSeries, externalRef);
    const r = await this.transport.execute(
      this.op('INVOICE_PUSH', { method: 'FaturaKaydet', path: this.methodPath('FaturaKaydet'), body }, externalRef),
    );
    return MikroResponseMapper.toInvoiceResult(r.data, externalRef);
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    this.guard('receiptPush');
    const body = MikroRequestMapper.toReceiptBody(request, request.referenceCode);
    const r = await this.transport.execute(this.op('RECEIPT_PUSH', { body }, request.referenceCode));
    return { externalId: String((r.data as any)?.document_id ?? ''), rawResponse: r.data as any };
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    this.guard('partnerUpsert');
    const body = MikroRequestMapper.toPartnerBody(request);
    const r = await this.transport.execute(this.op('PARTNER_UPSERT', { method: 'CariKaydet', path: this.methodPath('CariKaydet'), body }, `KRP-PARTNER-${request.kroptosKey}`));
    return { externalId: String((r.data as any)?.partner_code ?? ''), rawResponse: r.data as any };
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    this.guard('productFetch');
    const r = await this.transport.execute(this.op('PRODUCT_FETCH', { method: 'StokListesi', path: this.methodPath('StokListesi'), body: MikroRequestMapper.toStockListBody({}), sku: request.sku }));
    return { externalId: String((r.data as any)?.product_code ?? ''), code: request.sku, rawResponse: r.data as any };
  }

  /** K11 — fatura sorgulama endpoint'i yok; TEK YOL katalog (`mikro.invoice_by_ref`). */
  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    this.guard('invoiceFindByRef');
    const spec = resolveQuery(MIKRO_CATALOG, 'mikro.invoice_by_ref');
    const params = validateCatalogParams(spec, { ref: referenceCode });
    const r = await this.transport.execute<{ rows: Array<Record<string, unknown>>; columns?: string[] }>(
      this.op('CATALOG_QUERY', { queryId: spec.queryId, params }),
    );
    const rows = r.data?.rows ?? [];
    if (rows.length === 0 && r.data?.columns) {
      assertExpectedColumns(spec, rows, r.data.columns);
      return null;
    }
    assertExpectedColumns(spec, rows, r.data?.columns);
    return MikroResponseMapper.toInvoiceResultFromCatalogRow(rows[0], referenceCode);
  }

  /**
   * K12 — `AlimSatimEvragiSil` SİLMEDİR, iptal değil. Bu metot o ucu KENDİLİĞİNDEN ÇAĞIRMAZ:
   * yetenek CONTRACT_REQUIRED olduğu için guard fırlatır; KroptOS tarafı kapanır, operasyona
   * "Mikro'da elle iptal edilmeli" görevi düşer.
   */
  async cancelInvoice(_externalId: string): Promise<never> {
    this.guard('invoiceCancel');
    throw new Error('unreachable');
  }

  /** Uygunluk paketi (test 32/45): connector'ın ürettiği gövde — kimlik anahtarı içermez. */
  buildRequestPreview(kind: 'invoice' | 'partner' | 'stock' | 'receipt', req: any): unknown {
    switch (kind) {
      case 'invoice':
        return MikroRequestMapper.toInvoiceBody(req, this.invoiceSeries ?? 'MYT', req.referenceCode);
      case 'partner':
        return MikroRequestMapper.toPartnerBody(req);
      case 'receipt':
        return MikroRequestMapper.toReceiptBody(req, req.referenceCode);
      case 'stock':
      default:
        return MikroRequestMapper.toStockListBody(req ?? {});
    }
  }

  /** Sağlayıcının yasak gövde anahtarları — uygunluk paketi bunları çekirdek listeye ekler. */
  readonly forbiddenBodyKeys = MIKRO_FORBIDDEN_BODY_KEYS;
}
