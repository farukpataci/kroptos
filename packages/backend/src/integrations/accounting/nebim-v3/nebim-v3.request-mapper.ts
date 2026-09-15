import { BadRequestException } from '@nestjs/common';
import {
  AccountingContactRequest,
  AccountingInvoiceRequest,
  AccountingPaymentRequest,
} from '../core/AccountingTypes';
import { assertNoCredentialLeak } from '../core/AccountingCredentialSchema';
import { assertPostingDefaults } from '../core/AccountingErrors';
import { NEBIM_V3_FORBIDDEN_BODY_KEYS } from './nebim-v3.types';
import { NEBIM_POSTING_DEFAULTS } from './nebim-v3.posting-defaults';

export interface NebimV3PartnerKey {
  kind: 'taxNumber' | 'erpCode';
  value: string;
}

export interface NebimV3InvoiceBody {
  externalRef: string;
  issueDate: string;
  currency: string;
  partnerKey: NebimV3PartnerKey;
  storeCode: string;
  orderWarehouseCode: string;
  deliveryCode?: string;
  lines: Array<{
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    totalAmount: number;
  }>;
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
}

export interface NebimV3PartnerBody {
  kroptosKey: string;
  partnerKey: NebimV3PartnerKey;
  name: string;
  taxNumber?: string;
  taxOffice?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
}

export interface NebimV3ReceiptBody {
  externalRef: string;
  invoiceExternalId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  creditCardTypeCode?: string;
  bankAccountCode?: string;
  storeCode?: string;
}

/**
 * docs/nebim.v3.agent.md §7.6 — alan adı eşlemesi doğrulanmadı, ama mapper boş durmaz:
 * - Kimlik ve SessionID sızıntısı kontrolü (K1, K15)
 * - Zorunlu alanlar: en az bir satır, pozitif miktar, negatif olmayan fiyat, KDV 0-100
 * - Cari eşleştirme anahtarı: VKN/TCKN -> ERP cari kodu; isim asla anahtar değil
 * - Telefon/e-posta normalizasyonu
 * - Kayıt parametrelerinin varlığı (K17, D6)
 */
export class NebimV3RequestMapper {
  static externalRef(sourceType: string, sourceId: string, version = 1): string {
    const base = `KRP-${sourceType.toUpperCase()}-${sourceId}`;
    return version > 1 ? `${base}:${version}` : base;
  }

  static normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/[^\d+]/g, '');
    if (!digits) return undefined;
    if (/^0\d{10}$/.test(digits)) return `+90${digits.slice(1)}`;
    if (/^\d{10}$/.test(digits)) return `+90${digits}`;
    return digits;
  }

  static normalizeEmail(email?: string): string | undefined {
    const e = email?.trim().toLowerCase();
    return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
  }

  static partnerKey(input: { taxNumber?: string; erpCode?: string; name?: string }): NebimV3PartnerKey {
    const tax = input.taxNumber?.replace(/\D/g, '');
    if (tax && (tax.length === 10 || tax.length === 11)) return { kind: 'taxNumber', value: tax };
    if (input.erpCode?.trim()) return { kind: 'erpCode', value: input.erpCode.trim() };
    throw new BadRequestException(
      'Cari eşleştirme anahtarı yok: VKN/TCKN ya da ERP cari kodu gerekir; isim anahtar olarak kullanılmaz.',
    );
  }

  static toInvoiceBody(
    req: AccountingInvoiceRequest,
    postingDefaults: Record<string, any> | undefined | null,
    externalRef: string,
  ): NebimV3InvoiceBody {
    // K17 (docs/nebim.v3.agent.md §5, §7.4): kayıt parametreleri doğrulanmadan yazma işi kuyruğa girmez
    assertPostingDefaults(NEBIM_POSTING_DEFAULTS, postingDefaults, 'INVOICE', 'NEBIM-V3');

    if (!req.items?.length) throw new BadRequestException('Fatura en az bir satır içermeli.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.issueDate)) throw new BadRequestException('issueDate YYYY-MM-DD olmalı.');
    for (const it of req.items) {
      if (!(it.quantity > 0)) throw new BadRequestException(`Miktar pozitif olmalı: ${it.sku}`);
      if (it.unitPrice < 0) throw new BadRequestException(`Fiyat negatif olamaz: ${it.sku}`);
      if (it.vatRate < 0 || it.vatRate > 100) throw new BadRequestException(`KDV 0–100 arası olmalı: ${it.sku}`);
    }

    const body: NebimV3InvoiceBody = {
      externalRef,
      issueDate: req.issueDate,
      currency: req.currency,
      partnerKey: NebimV3RequestMapper.partnerKey({ taxNumber: req.contact.taxNumber, erpCode: req.contact.id }),
      storeCode: postingDefaults?.storeCode,
      orderWarehouseCode: postingDefaults?.orderWarehouseCode,
      deliveryCode: postingDefaults?.deliveryCode,
      lines: req.items.map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate,
        totalAmount: i.totalAmount,
      })),
      subtotal: req.subtotal,
      vatTotal: req.vatTotal,
      grandTotal: req.grandTotal,
    };

    assertNoCredentialLeak(body, NEBIM_V3_FORBIDDEN_BODY_KEYS);
    return body;
  }

  static toPartnerBody(req: AccountingContactRequest): NebimV3PartnerBody {
    if (!req.kroptosKey?.trim()) throw new BadRequestException('kroptosKey zorunludur.');
    const body: NebimV3PartnerBody = {
      kroptosKey: req.kroptosKey.trim(),
      partnerKey: NebimV3RequestMapper.partnerKey({ taxNumber: req.taxNumber }),
      name: req.name.trim(),
      taxNumber: req.taxNumber?.replace(/\D/g, ''),
      taxOffice: req.taxOffice?.trim(),
      email: NebimV3RequestMapper.normalizeEmail(req.email),
      phone: NebimV3RequestMapper.normalizePhone(req.phone),
      address: req.address?.trim(),
      city: req.city?.trim(),
      district: req.district?.trim(),
    };
    assertNoCredentialLeak(body, NEBIM_V3_FORBIDDEN_BODY_KEYS);
    return body;
  }

  static toReceiptBody(
    req: AccountingPaymentRequest,
    postingDefaults: Record<string, any> | undefined | null,
    externalRef: string,
  ): NebimV3ReceiptBody {
    assertPostingDefaults(NEBIM_POSTING_DEFAULTS, postingDefaults, 'RECEIPT', 'NEBIM-V3');

    if (!(req.amount > 0)) throw new BadRequestException('Tahsilat tutarı pozitif olmalı.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.paymentDate)) throw new BadRequestException('paymentDate YYYY-MM-DD olmalı.');

    const body: NebimV3ReceiptBody = {
      externalRef,
      invoiceExternalId: req.invoiceExternalId,
      amount: req.amount,
      currency: req.currency,
      paymentDate: req.paymentDate,
      storeCode: postingDefaults?.storeCode,
      creditCardTypeCode: postingDefaults?.creditCardTypeCode,
      bankAccountCode: postingDefaults?.bankAccountCode,
    };
    assertNoCredentialLeak(body, NEBIM_V3_FORBIDDEN_BODY_KEYS);
    return body;
  }
}
