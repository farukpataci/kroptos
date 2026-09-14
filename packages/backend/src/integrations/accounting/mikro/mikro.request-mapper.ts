import { BadRequestException } from '@nestjs/common';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
} from '../core/AccountingTypes';
import { assertNoCredentialLeak } from '../core/AccountingCredentialSchema';
import {
  MIKRO_FORBIDDEN_BODY_KEYS,
  MikroInvoiceBody,
  MikroPartnerBody,
  MikroPartnerKey,
  MikroReceiptBody,
  MikroStockListBody,
} from './mikro.types';

/**
 * docs/mikro.agent.md §7.5 — alan adı eşlemesi doğrulanmadı, ama mapper boş durmaz:
 * sağlayıcıdan bağımsız kurallar (kimlik sızıntısı, zorunlu alanlar, cari anahtarı,
 * normalizasyon, delta reddi) burada ve testleri anlamlıdır.
 */
export class MikroRequestMapper {
  /** §7.4: externalRef deterministik — `KRP-ORDER-123`, iptal sonrası `KRP-ORDER-123:2`. */
  static externalRef(sourceType: string, sourceId: string, version = 1): string {
    const base = `KRP-${sourceType.toUpperCase()}-${sourceId}`;
    return version > 1 ? `${base}:${version}` : base;
  }

  static normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/[^\d+]/g, '');
    if (!digits) return undefined;
    // 0 ile başlayan TR numaraları +90'a çevrilir; diğerleri olduğu gibi kalır
    if (/^0\d{10}$/.test(digits)) return `+90${digits.slice(1)}`;
    if (/^\d{10}$/.test(digits)) return `+90${digits}`;
    return digits;
  }

  static normalizeEmail(email?: string): string | undefined {
    const e = email?.trim().toLowerCase();
    return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
  }

  /** Cari eşleştirme anahtarı: VKN/TCKN → ERP cari kodu; İSİM ASLA ANAHTAR DEĞİL. */
  static partnerKey(input: { taxNumber?: string; erpCode?: string; name?: string }): MikroPartnerKey {
    const tax = input.taxNumber?.replace(/\D/g, '');
    if (tax && (tax.length === 10 || tax.length === 11)) return { kind: 'taxNumber', value: tax };
    if (input.erpCode?.trim()) return { kind: 'erpCode', value: input.erpCode.trim() };
    throw new BadRequestException(
      'Cari eşleştirme anahtarı yok: VKN/TCKN ya da ERP cari kodu gerekir; isim anahtar olarak kullanılmaz.',
    );
  }

  static toInvoiceBody(req: AccountingInvoiceRequest, invoiceSeries: string | null | undefined, externalRef: string): MikroInvoiceBody {
    const series = invoiceSeries?.trim();
    if (!series) throw new BadRequestException('Evrak serisi (AccountingCompany.invoiceSeries) tanımlı değil.');
    if (!req.items?.length) throw new BadRequestException('Fatura en az bir satır içermeli.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.issueDate)) throw new BadRequestException('issueDate YYYY-MM-DD olmalı.');
    for (const it of req.items) {
      if (!(it.quantity > 0)) throw new BadRequestException(`Miktar pozitif olmalı: ${it.sku}`);
      if (it.unitPrice < 0) throw new BadRequestException(`Fiyat negatif olamaz: ${it.sku}`);
      if (it.vatRate < 0 || it.vatRate > 100) throw new BadRequestException(`KDV 0–100 arası olmalı: ${it.sku}`);
    }

    const body: MikroInvoiceBody = {
      cha_evrakno_seri: series, // cha_evrakno_sira GÖNDERİLMEZ — sırayı Mikro üretir
      user_tablo: { KROPTOS_REF: externalRef },
      issueDate: req.issueDate,
      currency: req.currency,
      partnerKey: MikroRequestMapper.partnerKey({ taxNumber: req.contact.taxNumber, erpCode: req.contact.id }),
      lines: req.items.map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate,
        discountAmount: i.discountAmount,
        totalAmount: i.totalAmount,
      })),
      totals: { subtotal: req.subtotal, vatTotal: req.vatTotal, grandTotal: req.grandTotal, discountTotal: req.discountTotal },
      notes: req.notes,
    };
    assertNoCredentialLeak(body, MIKRO_FORBIDDEN_BODY_KEYS);
    return body;
  }

  static toPartnerBody(req: AccountingContactRequest, erpCode?: string): MikroPartnerBody {
    if (!req.name?.trim()) throw new BadRequestException('Cari adı zorunlu.');
    const body: MikroPartnerBody = {
      key: MikroRequestMapper.partnerKey({ taxNumber: req.taxNumber, erpCode }),
      name: req.name.trim(),
      taxOffice: req.taxOffice,
      email: MikroRequestMapper.normalizeEmail(req.email),
      phone: MikroRequestMapper.normalizePhone(req.phone),
      address: req.address,
      city: req.city,
      district: req.district,
      isCompany: req.isCompany ?? (req.taxNumber?.replace(/\D/g, '').length === 10),
    };
    assertNoCredentialLeak(body, MIKRO_FORBIDDEN_BODY_KEYS);
    return body;
  }

  static toReceiptBody(req: AccountingPaymentRequest, externalRef: string): MikroReceiptBody {
    if (!(req.amount > 0)) throw new BadRequestException('Tahsilat tutarı pozitif olmalı.');
    if (!req.invoiceExternalId) throw new BadRequestException('Tahsilat için fatura kimliği zorunlu.');
    const body: MikroReceiptBody = {
      invoiceExternalId: req.invoiceExternalId,
      amount: req.amount,
      currency: req.currency,
      paymentDate: req.paymentDate,
      user_tablo: { KROPTOS_REF: externalRef },
      notes: req.notes,
    };
    assertNoCredentialLeak(body, MIKRO_FORBIDDEN_BODY_KEYS);
    return body;
  }

  /** `changedSince` gönderilirse REDDET — stockDelta NOT_SUPPORTED, sahte delta = eskiyen stok. */
  static toStockListBody(q: { depoNo?: number; limit?: number; offset?: number; changedSince?: unknown }): MikroStockListBody {
    if (q && 'changedSince' in q && q.changedSince !== undefined) {
      throw new BadRequestException('Mikro stok delta desteklemiyor (stockDelta NOT_SUPPORTED); changedSince gönderilemez.');
    }
    const body: MikroStockListBody = {};
    if (q?.depoNo !== undefined) body.depoNo = q.depoNo;
    if (q?.limit !== undefined) body.limit = q.limit;
    if (q?.offset !== undefined) body.offset = q.offset;
    assertNoCredentialLeak(body, MIKRO_FORBIDDEN_BODY_KEYS);
    return body;
  }
}
