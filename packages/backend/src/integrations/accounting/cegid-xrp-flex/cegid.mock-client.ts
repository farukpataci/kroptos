import { BadRequestException } from '@nestjs/common';
import { ICegidClient } from './cegid.invoice-flow';
import { CEGID_REQUIRED_SCHEMA, CegidSchemaService } from './cegid.schema';
import {
  CegidCustomer,
  CegidPayment,
  CegidSalesInvoice,
} from './cegid.types';

export class CegidMockClient implements ICegidClient {
  public invoices = new Map<string, CegidSalesInvoice>();
  public customers = new Map<string, CegidCustomer>();
  public payments = new Map<string, CegidPayment>();

  public simulateMismatch = false;
  public simulateSchemaFailure = false;
  public mockDiscoveredEntities: Record<string, string[]> = {
    Customer: ['CustomerID', 'CustomerName', 'MainContact', 'TaxRegistrationID'],
    SalesInvoice: ['ReferenceNbr', 'CustomerID', 'Type', 'Hold', 'Details', 'Amount'],
    Payment: ['ReferenceNbr', 'CustomerID', 'PaymentAmount'],
  };

  private counter = 1000;

  async testConnection(): Promise<boolean> {
    if (this.simulateSchemaFailure) {
      // Eksik alan simülasyonu
      const brokenSchema = {
        Customer: ['CustomerID'], // missing CustomerName, MainContact
        SalesInvoice: ['ReferenceNbr'],
        Payment: [],
      };
      const schemaService = new CegidSchemaService();
      const validation = schemaService.validateSchema(brokenSchema);
      if (!validation.valid) {
        throw new BadRequestException(
          `[Cegid] Bağlantı doğrulanamadı: Eksik zorunlu sözleşme alanları: ${JSON.stringify(
            validation.missingFields,
          )}`,
        );
      }
    }

    const schemaService = new CegidSchemaService();
    const validation = schemaService.validateSchema(this.mockDiscoveredEntities);
    if (!validation.valid) {
      throw new BadRequestException(
        `[Cegid] Bağlantı doğrulanamadı: Şema eksiklikleri tespit edildi.`,
      );
    }

    return true;
  }

  async createInvoice(dto: CegidSalesInvoice): Promise<CegidSalesInvoice> {
    this.counter++;
    const refNbr =
      dto.ReferenceNbr?.value || `INV-FLEX-${this.counter}`;

    let totalAmount = 0;
    if (dto.Details && dto.Details.length > 0) {
      totalAmount = dto.Details.reduce(
        (sum, d) => sum + (d.Amount?.value || (d.Qty?.value || 1) * (d.UnitPrice?.value || 0)),
        0,
      );
    }

    if (this.simulateMismatch) {
      // Yapay olarak sunucu toplamını farklılaştır (mutabakat uyuşmazlığı testi için)
      totalAmount += 25.5;
    }

    const invoice: CegidSalesInvoice = {
      ...dto,
      id: refNbr,
      ReferenceNbr: { value: refNbr },
      Hold: { value: true }, // Başlangıçta Taslak
      Status: { value: 'Hold' },
      Amount: { value: Number(totalAmount.toFixed(2)) },
      TaxTotal: { value: Number((totalAmount * 0.2).toFixed(2)) },
    };

    this.invoices.set(refNbr, invoice);
    return invoice;
  }

  async getInvoice(referenceNbr: string): Promise<CegidSalesInvoice> {
    const inv = this.invoices.get(referenceNbr);
    if (!inv) {
      throw new BadRequestException(
        `[Cegid] Fatura bulunamadı: "${referenceNbr}"`,
      );
    }
    return inv;
  }

  async releaseInvoice(referenceNbr: string): Promise<void> {
    const inv = this.invoices.get(referenceNbr);
    if (!inv) {
      throw new BadRequestException(
        `[Cegid] Fatura bulunamadı: "${referenceNbr}"`,
      );
    }

    // ReleaseInvoice eylemi: Hold kaldırılır, durum Open (kesinleşmiş) olur (§6.4)
    inv.Hold = { value: false };
    inv.Status = { value: 'Open' };
    this.invoices.set(referenceNbr, inv);
  }

  async syncContact(dto: CegidCustomer): Promise<CegidCustomer> {
    const custId = dto.CustomerID?.value || `CUST-${++this.counter}`;
    const cust: CegidCustomer = {
      ...dto,
      id: custId,
      CustomerID: { value: custId },
    };
    this.customers.set(custId, cust);
    return cust;
  }

  async recordPayment(dto: CegidPayment): Promise<CegidPayment> {
    const pmtId = dto.ReferenceNbr?.value || `PMT-${++this.counter}`;
    const pmt: CegidPayment = {
      ...dto,
      id: pmtId,
      ReferenceNbr: { value: pmtId },
      Status: { value: 'Closed' },
    };
    this.payments.set(pmtId, pmt);
    return pmt;
  }

  async findInvoiceByReference(referenceNbr: string): Promise<CegidSalesInvoice | null> {
    return this.invoices.get(referenceNbr) || null;
  }
}
