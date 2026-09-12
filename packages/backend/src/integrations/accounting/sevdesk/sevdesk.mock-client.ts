import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ISevdeskClient, validatePagination } from './sevdesk.client';
import { createSevdeskRef } from './sevdesk.ref';
import {
  SevdeskBookAmountPayload,
  SevdeskContact,
  SevdeskInvoice,
  SevdeskInvoiceFactoryPayload,
  SevdeskUser,
} from './sevdesk.types';

export class SevdeskMockClient implements ISevdeskClient {
  private invoices = new Map<string, SevdeskInvoice>();
  private contacts = new Map<string, SevdeskContact>();
  private invoiceIdCounter = 1000;
  private invoiceNumberCounter = 20000;

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData(): void {
    const contactId = '1000';
    this.contacts.set(contactId, {
      id: contactId,
      objectName: 'Contact',
      name: 'Musterkunde GmbH',
      customerNumber: 'KND-1000',
    });
    this.invoices.set('inv-1', {
      id: 'inv-1',
      objectName: 'Invoice',
      invoiceNumber: 'RE-10001',
      contact: { id: contactId, objectName: 'Contact' },
      invoiceDate: '2026-09-11',
      status: 200,
      invoiceType: 'RE',
      sumNet: 100,
      sumTax: 19,
      sumGross: 120,
      paidAmount: 0,
    });
  }

  async getCurrentUser(): Promise<SevdeskUser> {
    return {
      id: '101',
      objectName: 'SevUser',
      username: 'max.mustermann',
      fullname: 'Max Mustermann',
      email: 'max@musterfirma.de',
      status: 100,
      role: 'admin',
    };
  }

  async createDraftInvoice(payload: SevdeskInvoiceFactoryPayload): Promise<SevdeskInvoice> {
    const id = String(++this.invoiceIdCounter);
    const invoiceNumber = `RE-${++this.invoiceNumberCounter}`;

    let sumNet = 0;
    let sumTax = 0;

    for (const pos of payload.invoicePosSave || []) {
      const lineNet = pos.quantity * pos.price;
      const lineTax = lineNet * (pos.taxRate / 100);
      sumNet += lineNet;
      sumTax += lineTax;
    }

    const sumGross = Number((sumNet + sumTax).toFixed(2));
    sumNet = Number(sumNet.toFixed(2));
    sumTax = Number(sumTax.toFixed(2));

    const invoice: SevdeskInvoice = {
      id,
      objectName: 'Invoice',
      invoiceNumber,
      contact: payload.invoice.contact,
      invoiceDate: payload.invoice.invoiceDate,
      header: payload.invoice.header,
      customerInternalNote: payload.invoice.customerInternalNote,
      status: 100, // Draft (§5.1)
      invoiceType: 'RE',
      currency: payload.invoice.currency || 'EUR',
      sumNet,
      sumTax,
      sumGross,
      sumGrossAccounting: sumGross,
      sumNetAccounting: sumNet,
      sumTaxAccounting: sumTax,
      paidAmount: 0,
    };

    this.invoices.set(id, invoice);
    return invoice;
  }

  async getInvoice(id: string | number): Promise<SevdeskInvoice> {
    const invoice = this.invoices.get(String(id));
    if (!invoice) {
      throw new NotFoundException(`[sevDesk Mock] Fatura bulunamadı (ID: ${id})`);
    }
    return { ...invoice };
  }

  async bookAmount(
    invoiceId: string | number,
    payload: SevdeskBookAmountPayload,
  ): Promise<SevdeskInvoice> {
    const invoice = this.invoices.get(String(invoiceId));
    if (!invoice) {
      throw new NotFoundException(`[sevDesk Mock] Fatura bulunamadı (ID: ${invoiceId})`);
    }

    const currentPaid = Number(invoice.paidAmount || 0);
    const totalGross = Number(invoice.sumGross || 0);
    const newPaid = Number((currentPaid + payload.amount).toFixed(2));

    if (newPaid > totalGross + 0.01) {
      throw new BadRequestException(
        `[sevDesk Mock] Tahsilat tutarı fatura toplamını aşamaz (Toplam: ${totalGross}, Mevcut: ${currentPaid}, Eklenen: ${payload.amount})`,
      );
    }

    invoice.paidAmount = newPaid;
    if (newPaid >= totalGross - 0.01) {
      invoice.status = 1000; // Paid
    } else {
      invoice.status = 200; // Open (Partially Paid)
    }

    this.invoices.set(String(invoiceId), invoice);
    return { ...invoice };
  }

  async resetToDraft(invoiceId: string | number): Promise<SevdeskInvoice> {
    const invoice = this.invoices.get(String(invoiceId));
    if (!invoice) {
      throw new NotFoundException(`[sevDesk Mock] Fatura bulunamadı (ID: ${invoiceId})`);
    }
    invoice.status = 100;
    this.invoices.set(String(invoiceId), invoice);
    return { ...invoice };
  }

  async resetToOpen(invoiceId: string | number): Promise<SevdeskInvoice> {
    const invoice = this.invoices.get(String(invoiceId));
    if (!invoice) {
      throw new NotFoundException(`[sevDesk Mock] Fatura bulunamadı (ID: ${invoiceId})`);
    }
    invoice.status = 200;
    this.invoices.set(String(invoiceId), invoice);
    return { ...invoice };
  }

  async listInvoices(params?: { limit?: number; offset?: number; status?: number }): Promise<SevdeskInvoice[]> {
    validatePagination(params?.limit, params?.offset);
    let items = Array.from(this.invoices.values());
    if (params?.status) {
      items = items.filter((inv) => inv.status === params.status);
    }
    const offset = params?.offset || 0;
    const limit = params?.limit || 50;
    return items.slice(offset, offset + limit);
  }

  async listContacts(params?: { limit?: number; offset?: number }): Promise<SevdeskContact[]> {
    validatePagination(params?.limit, params?.offset);
    const items = Array.from(this.contacts.values());
    const offset = params?.offset || 0;
    const limit = params?.limit || 50;
    return items.slice(offset, offset + limit);
  }

  async createContact(contact: Partial<SevdeskContact>): Promise<SevdeskContact> {
    const id = String(this.contacts.size + 1000);
    const newContact: SevdeskContact = {
      id,
      objectName: 'Contact',
      name: contact.name || 'İsimsiz Müşteri',
      customerNumber: contact.customerNumber || `KND-${id}`,
    };
    this.contacts.set(id, newContact);
    return newContact;
  }
}
