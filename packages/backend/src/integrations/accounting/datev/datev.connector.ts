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
} from '../core/AccountingTypes';
import { DATEV_CAPABILITIES } from './datev.capabilities';
import { DatevConfig } from './datev.types';
import { DatevValidator } from './datev.validation';
import { DatevBookingMapper } from './datev.booking-mapper';
import { DatevAccountResolver } from './datev.account-resolver';

export class DatevConnector extends AccountingConnector {
  readonly provider = 'DATEV';
  readonly capabilities: AccountingCapabilities = DATEV_CAPABILITIES;
  readonly environment: AccountingEnvironment;

  private readonly config: DatevConfig;

  constructor(
    credentials: Record<string, any>,
    environment: AccountingEnvironment = 'MOCK',
  ) {
    super();
    this.environment = environment;

    // Normalize credentials into DatevConfig
    this.config = {
      beraterNummer: parseInt(credentials?.beraterNummer, 10) || 1001,
      mandantenNummer: parseInt(credentials?.mandantenNummer, 10) || 1,
      wjBeginn: credentials?.wjBeginn || `${new Date().getFullYear()}-01-01`,
      sachkontenLaenge: parseInt(credentials?.sachkontenLaenge, 10) || 4,
      kontenrahmen: (credentials?.kontenrahmen as any) || 'SKR03',
      debitorNummernkreisStart: credentials?.debitorNummernkreisStart
        ? parseInt(credentials.debitorNummernkreisStart, 10)
        : undefined,
      debitorNummernkreisEnde: credentials?.debitorNummernkreisEnde
        ? parseInt(credentials.debitorNummernkreisEnde, 10)
        : undefined,
      encoding: credentials?.encoding || 'WINDOWS-1252',
      festschreibung: credentials?.festschreibung !== undefined ? Number(credentials.festschreibung) as any : 0,
      bezeichnung: credentials?.bezeichnung || 'Buchungsstapel',
      diktatKuerzel: credentials?.diktatKuerzel || 'KO',
    };
  }

  async testConnection(): Promise<AccountingTestConnectionResult> {
    const errors = DatevValidator.validateConfig(this.config);
    if (errors.length > 0) {
      return {
        success: false,
        message: `DATEV Yapılandırma Hatası: ${errors.join('; ')}`,
        environment: this.environment,
      };
    }

    return {
      success: true,
      message: `DATEV EXTF yapılandırması doğrulandı (Berater-Nr: ${this.config.beraterNummer}, Mandanten-Nr: ${this.config.mandantenNummer}, ${this.config.kontenrahmen}, ${this.config.encoding}).`,
      companyId: String(this.config.mandantenNummer),
      companyName: `DATEV Mandant ${this.config.mandantenNummer}`,
      environment: this.environment,
    };
  }

  async findInvoiceByReference(referenceCode: string): Promise<AccountingInvoiceResult | null> {
    return null;
  }

  async createInvoice(request: AccountingInvoiceRequest): Promise<AccountingInvoiceResult> {
    const entries = DatevBookingMapper.mapInvoice(
      {
        orderId: request.referenceCode,
        invoiceNumber: request.referenceCode,
        issueDate: request.issueDate,
        dueDate: request.dueDate,
        currency: request.currency || 'EUR',
        customerId: request.contact.id,
        customerNumber: request.contact.taxNumber,
        customerName: request.contact.name,
        grandTotal: request.grandTotal,
        items: request.items.map((it) => ({
          sku: it.sku,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          vatRate: it.vatRate,
          vatAmount: it.vatAmount,
          totalAmount: it.totalAmount,
        })),
        notes: request.notes,
      },
      this.config,
    );

    return {
      externalId: `datev_extf_${request.referenceCode}`,
      externalNumber: DatevBookingMapper.sanitizeBelegfeld1(request.referenceCode),
      rawResponse: {
        batchFormat: 'EXTF-700-21-13',
        entryCount: entries.length,
        entriesSummary: entries.map((e) => ({
          umsatz: e.umsatz,
          sollHaben: e.sollHaben,
          konto: e.konto,
          gegenkonto: e.gegenkonto,
          belegdatum: e.belegdatum,
        })),
      },
    };
  }

  async recordPayment(request: AccountingPaymentRequest): Promise<AccountingPaymentResult> {
    const entry = DatevBookingMapper.mapPayment(
      {
        paymentId: request.referenceCode,
        invoiceNumber: request.invoiceExternalId,
        paymentDate: request.paymentDate,
        amount: request.amount,
        currency: request.currency || 'EUR',
        notes: request.notes,
      },
      this.config,
    );

    return {
      externalId: `datev_pay_${request.referenceCode}`,
      rawResponse: {
        batchFormat: 'EXTF-700-21-13',
        entrySummary: {
          umsatz: entry.umsatz,
          sollHaben: entry.sollHaben,
          konto: entry.konto,
          gegenkonto: entry.gegenkonto,
          belegdatum: entry.belegdatum,
        },
      },
    };
  }

  async syncContact(request: AccountingContactRequest): Promise<AccountingContactResult> {
    const debitorNumber = DatevAccountResolver.resolveDebitorNumber({
      customerId: request.kroptosKey,
      externalCustomerNumber: request.taxNumber,
      sachkontenLaenge: this.config.sachkontenLaenge,
      rangeStart: this.config.debitorNummernkreisStart,
      rangeEnd: this.config.debitorNummernkreisEnde,
    });

    return {
      externalId: String(debitorNumber),
      rawResponse: {
        debitorNumber,
        sachkontenLaenge: this.config.sachkontenLaenge,
      },
    };
  }

  async mapProduct(request: AccountingProductRequest): Promise<AccountingProductResult> {
    const defaultTaxRate = 19;
    const revenueAccount = DatevAccountResolver.getRevenueAccount(
      this.config.kontenrahmen,
      defaultTaxRate,
      this.config.sachkontenLaenge,
      this.config.defaultRevenueAccounts,
    );

    return {
      externalId: String(revenueAccount),
      rawResponse: {
        kontenrahmen: this.config.kontenrahmen,
        revenueAccount,
      },
    };
  }
}
