import {
  PennylaneCreateInvoiceRequest,
  PennylaneCustomerRequest,
  PennylaneCustomerResponse,
  PennylaneInvoiceResponse,
  PennylaneListResponse,
  PennylaneProductRequest,
  PennylaneProductResponse,
} from './pennylane.types';
import { IPennylaneClient } from './pennylane.client';
import { PennylaneSerializer } from './pennylane.serialize';

/**
 * Pennylane Bellek-İçi Mock İstemcisi (§8)
 */
export class PennylaneMockClient implements IPennylaneClient {
  private customerSeq = 1000;
  private invoiceSeq = 2000;
  private productSeq = 3000;

  private customers = new Map<number, PennylaneCustomerResponse>();
  private invoices = new Map<number, PennylaneInvoiceResponse>();
  private products = new Map<number, PennylaneProductResponse>();

  public simulateMismatch = false;

  constructor() {
    // Başlangıç mock müşterisi
    this.customers.set(1, {
      id: 1,
      name: 'Client Mock France SAS',
      reg_no: '123456789',
      vat_number: 'FR12345678901',
      emails: ['billing@client-mock.fr'],
      external_reference: 'MOCK-CUST-1',
      created_at: new Date().toISOString(),
    });
  }

  async createCustomer(data: PennylaneCustomerRequest): Promise<PennylaneCustomerResponse> {
    const id = ++this.customerSeq;
    const customer: PennylaneCustomerResponse = {
      id,
      name: data.name,
      reg_no: data.reg_no || null,
      vat_number: data.vat_number || null,
      emails: data.emails,
      external_reference: data.external_reference || null,
      created_at: new Date().toISOString(),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async getCustomer(id: number): Promise<PennylaneCustomerResponse> {
    const cust = this.customers.get(id);
    if (!cust) {
      throw new Error(`Customer with id ${id} not found`);
    }
    return cust;
  }

  async findCustomerByExternalReference(ref: string): Promise<PennylaneCustomerResponse | null> {
    for (const cust of this.customers.values()) {
      if (cust.external_reference === ref) {
        return cust;
      }
    }
    return null;
  }

  async createInvoice(data: PennylaneCreateInvoiceRequest): Promise<PennylaneInvoiceResponse> {
    // §5.1: draft: true ZORUNLULUK kontrolü
    if ((data as any).draft !== true) {
      throw new Error(
        "Pennylane v2 güvenlik kuralı ihlali (§5.1): Fatura oluştururken 'draft: true' zorunludur!",
      );
    }

    // §5.2, §9.3: Parasal tutarların string olduğunun teyidi
    if (data.invoice_lines) {
      for (const line of data.invoice_lines) {
        PennylaneSerializer.assertLinePriceIsString(line);
      }
    }

    let calculatedTotal = 0;
    for (const line of data.invoice_lines || []) {
      const price = parseFloat(line.raw_currency_unit_price);
      const qty = typeof line.quantity === 'number' ? line.quantity : parseFloat(String(line.quantity));
      let vatMultiplier = 1.2; // default 20%
      if (line.vat_rate === 'FR_100') vatMultiplier = 1.1;
      if (line.vat_rate === 'FR_055') vatMultiplier = 1.055;
      if (line.vat_rate === 'FR_021') vatMultiplier = 1.021;
      if (line.vat_rate === 'exempt') vatMultiplier = 1.0;
      calculatedTotal += price * qty * vatMultiplier;
    }

    if (this.simulateMismatch) {
      calculatedTotal += 50.0; // Uyuşmazlık simülasyonu
    }

    const totalStr = PennylaneSerializer.formatMonetary(calculatedTotal);
    const id = ++this.invoiceSeq;

    const invoice: PennylaneInvoiceResponse = {
      id,
      invoice_number: null,
      draft: true,
      status: 'draft',
      date: data.date,
      deadline: data.deadline,
      amount: totalStr,
      currency_amount: totalStr,
      remaining_amount_with_tax: totalStr,
      paid: false,
      customer_id: data.customer_id,
      external_reference: data.external_reference || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.invoices.set(id, invoice);
    return invoice;
  }

  async getInvoice(id: number): Promise<PennylaneInvoiceResponse> {
    const inv = this.invoices.get(id);
    if (!inv) {
      throw new Error(`Invoice with id ${id} not found`);
    }
    return inv;
  }

  async findInvoiceByExternalReference(ref: string): Promise<PennylaneInvoiceResponse | null> {
    for (const inv of this.invoices.values()) {
      if (inv.external_reference === ref) {
        return inv;
      }
    }
    return null;
  }

  async finalizeInvoice(id: number): Promise<PennylaneInvoiceResponse> {
    const inv = this.invoices.get(id);
    if (!inv) {
      throw new Error(`Invoice with id ${id} not found`);
    }

    const finalized: PennylaneInvoiceResponse = {
      ...inv,
      draft: false,
      status: 'finalized',
      invoice_number: `INV-2026-${String(id).padStart(4, '0')}`,
      updated_at: new Date().toISOString(),
    };

    this.invoices.set(id, finalized);
    return finalized;
  }

  async deleteDraftInvoice(id: number): Promise<void> {
    const inv = this.invoices.get(id);
    if (!inv) {
      return;
    }
    if (inv.draft !== true) {
      throw new Error(
        'Kesinleşmiş faturalar silinemez! Sadece taslak (draft: true) faturalar silinebilir.',
      );
    }
    this.invoices.delete(id);
  }

  async createProduct(data: PennylaneProductRequest): Promise<PennylaneProductResponse> {
    const id = ++this.productSeq;
    const product: PennylaneProductResponse = {
      id,
      label: data.label,
      reference: data.reference || null,
      unit: data.unit || 'piece',
      vat_rate: data.vat_rate || 'FR_200',
      price_before_tax: data.price_before_tax || null,
    };
    this.products.set(id, product);
    return product;
  }

  async listInvoices(cursor?: string, limit = 50): Promise<PennylaneListResponse<PennylaneInvoiceResponse>> {
    const items = Array.from(this.invoices.values()).slice(0, limit);
    return {
      items,
      has_more: false,
      next_cursor: null,
    };
  }
}
