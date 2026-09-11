import { BadRequestException, NotFoundException } from '@nestjs/common';
import { INetSuiteClient } from './netsuite.invoice-flow';
import { NetSuiteCredentials, NetSuiteMetadataCatalogSchema } from './netsuite.types';
import { NetSuiteSchemaManager } from './netsuite.schema';
import { NetSuiteUriHelper } from './netsuite.uri';
import { NetSuiteErrorMapper } from './netsuite.error-mapper';
import { NetSuiteJwtHelper } from './netsuite.jwt';

export class NetSuiteMockClient implements INetSuiteClient {
  public invoices = new Map<string, any>();
  public customers = new Map<string, any>();
  public payments = new Map<string, any>();
  public items = new Map<string, any>();

  // Eşzamanlılık testi için sayaçlar
  public activeRequests = 0;
  public maxObservedConcurrency = 0;

  // Hata simülasyon bayrakları
  public simulate401 = false;
  public simulate403 = false;
  public simulate429 = false;
  public simulateMissingField: string | null = null;

  private invoiceCounter = 1000;
  private customerCounter = 200;
  private paymentCounter = 300;

  constructor(private readonly credentials: NetSuiteCredentials) {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    // Örnek müşteri
    this.customers.set('42', {
      id: '42',
      entityId: 'CUST-00042',
      companyName: 'Acme Test Corp',
      email: 'billing@acme.corp',
      phone: '+1-555-0199',
      subsidiary: { id: '1', refName: 'Parent Company' },
      externalId: 'TAX-ACME-42',
    });

    // Örnek fatura
    this.invoices.set('1001', {
      id: '1001',
      tranId: 'INV-1001',
      status: 'Open',
      entity: { id: '42', refName: 'Acme Test Corp' },
      subsidiary: { id: '1' },
      total: 120.0,
      externalId: 'ORD-2026-001',
    });
  }

  /**
   * Eşzamanlılık ve hata koruması (§5.3, §5.10)
   */
  private async enterRequest(): Promise<void> {
    this.activeRequests++;
    if (this.activeRequests > this.maxObservedConcurrency) {
      this.maxObservedConcurrency = this.activeRequests;
    }

    if (this.simulate401) {
      throw NetSuiteErrorMapper.map(401, { message: 'Invalid JWT signature or Client ID' });
    }
    if (this.simulate403) {
      throw NetSuiteErrorMapper.map(403, { message: 'Role does not have permission to access record' });
    }
    if (this.simulate429) {
      throw NetSuiteErrorMapper.map(429, { message: 'Account-wide concurrency limit exceeded' });
    }
  }

  private leaveRequest(): void {
    this.activeRequests--;
  }

  async testConnection(): Promise<{ success: boolean; accountId: string; host: string }> {
    await this.enterRequest();
    try {
      // Host doğrulaması (§5.1)
      const expectedHost = NetSuiteUriHelper.getExpectedHost(this.credentials.accountId);

      // Sertifika kontrolü (§5.2)
      const certCheck = NetSuiteJwtHelper.checkCertificateStatus(this.credentials.certificateExpiresAt);
      if (certCheck.isExpired) {
        throw new BadRequestException(
          `NetSuite sertifikası süresi DOLDU (${this.credentials.certificateExpiresAt}). Bağlantı kurulamaz.`,
        );
      }

      return {
        success: true,
        accountId: this.credentials.accountId,
        host: expectedHost,
      };
    } finally {
      this.leaveRequest();
    }
  }

  async getMetadataCatalog(recordType: string): Promise<NetSuiteMetadataCatalogSchema> {
    await this.enterRequest();
    try {
      const schema = NetSuiteSchemaManager.getMockCatalogSchema(recordType);
      if (this.simulateMissingField && this.simulateMissingField.startsWith(recordType + '.')) {
        const fieldToRemove = this.simulateMissingField.split('.')[1];
        const clone = JSON.parse(JSON.stringify(schema));
        delete clone.properties[fieldToRemove];
        return clone;
      }
      return schema;
    } finally {
      this.leaveRequest();
    }
  }

  /**
   * eid: Upsert mantığı (§5.7): externalId ile varsa güncelle, yoksa yeni kayıt oluştur.
   */
  async upsertInvoice(externalId: string, payload: any): Promise<any> {
    await this.enterRequest();
    try {
      // Daha önce aynı externalId ile kayıt oluşturulmuş mu?
      for (const [id, inv] of this.invoices.entries()) {
        if (inv.externalId === externalId) {
          // Mevcut kaydı güncelle ve dön (İkinci çağrı yeni kayıt açmaz!)
          const updated = { ...inv, ...payload, id };
          this.invoices.set(id, updated);
          return updated;
        }
      }

      const newId = String(++this.invoiceCounter);
      const newInvoice = {
        id: newId,
        tranId: `INV-${newId}`,
        status: payload.status || 'Open',
        ...payload,
        externalId,
      };

      this.invoices.set(newId, newInvoice);
      return newInvoice;
    } finally {
      this.leaveRequest();
    }
  }

  async getInvoice(idOrExternalId: string | number): Promise<any> {
    await this.enterRequest();
    try {
      const key = String(idOrExternalId).trim();
      if (key.startsWith('eid:')) {
        const eid = key.substring(4);
        for (const inv of this.invoices.values()) {
          if (inv.externalId === eid) return inv;
        }
        throw new NotFoundException(`NetSuite faturası bulunamadı (eid: ${eid})`);
      }

      const direct = this.invoices.get(key);
      if (direct) return direct;

      // externalId araması
      for (const inv of this.invoices.values()) {
        if (inv.externalId === key) return inv;
      }

      throw new NotFoundException(`NetSuite faturası bulunamadı: ${key}`);
    } finally {
      this.leaveRequest();
    }
  }

  async upsertCustomer(externalId: string, payload: any): Promise<any> {
    await this.enterRequest();
    try {
      for (const [id, cust] of this.customers.entries()) {
        if (cust.externalId === externalId) {
          const updated = { ...cust, ...payload, id };
          this.customers.set(id, updated);
          return updated;
        }
      }

      const newId = String(++this.customerCounter);
      const newCustomer = {
        id: newId,
        entityId: `CUST-${newId}`,
        ...payload,
        externalId,
      };

      this.customers.set(newId, newCustomer);
      return newCustomer;
    } finally {
      this.leaveRequest();
    }
  }

  async getCustomer(idOrExternalId: string | number): Promise<any> {
    await this.enterRequest();
    try {
      const key = String(idOrExternalId).trim();
      const direct = this.customers.get(key);
      if (direct) return direct;

      for (const cust of this.customers.values()) {
        if (cust.externalId === key) return cust;
      }

      throw new NotFoundException(`NetSuite carisi bulunamadı: ${key}`);
    } finally {
      this.leaveRequest();
    }
  }

  async createPayment(payload: any): Promise<any> {
    await this.enterRequest();
    try {
      const newId = String(++this.paymentCounter);
      const payment = {
        id: newId,
        ...payload,
      };
      this.payments.set(newId, payment);
      return payment;
    } finally {
      this.leaveRequest();
    }
  }

  async createItem(payload: any): Promise<any> {
    await this.enterRequest();
    try {
      const id = payload.itemId || `ITEM-${Date.now()}`;
      const item = { id, ...payload };
      this.items.set(id, item);
      return item;
    } finally {
      this.leaveRequest();
    }
  }

  async getItem(idOrExternalId: string | number): Promise<any> {
    await this.enterRequest();
    try {
      const key = String(idOrExternalId).trim();
      const item = this.items.get(key);
      if (item) return item;
      return { id: key, itemId: key, displayName: `Item ${key}` };
    } finally {
      this.leaveRequest();
    }
  }

  async voidInvoice(idOrExternalId: string | number): Promise<any> {
    await this.enterRequest();
    try {
      const invoice = await this.getInvoice(idOrExternalId);
      invoice.status = 'Voided';
      this.invoices.set(String(invoice.id), invoice);
      return invoice;
    } finally {
      this.leaveRequest();
    }
  }
}
