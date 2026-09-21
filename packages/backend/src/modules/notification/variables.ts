import { NotificationEvent } from '@prisma/client';

/**
 * Şablon değişken kataloğu. Kaydetmede "bilinmeyen değişken" doğrulaması ve
 * düzenleyicideki değişken paneli buradan beslenir; render bağlamı da (`buildContext`)
 * aynı adları üretir — katalog ile bağlam ayrışamaz, ikisi de tek listeden gelir.
 */
export interface VariableDef {
  path: string;
  label: string;
  sample: unknown;
}

const COMMON: VariableDef[] = [
  { path: 'customer.firstName', label: 'Müşteri adı', sample: 'Ayşe' },
  { path: 'customer.fullName', label: 'Müşteri ad soyad', sample: 'Ayşe Yılmaz' },
  { path: 'order.number', label: 'Sipariş no', sample: 'ORD-2026-00042' },
  { path: 'order.date', label: 'Sipariş tarihi', sample: '2026-09-21T10:15:00.000Z' },
  { path: 'order.total', label: 'Sipariş tutarı', sample: 1249.9 },
  { path: 'order.currency', label: 'Para birimi', sample: 'TRY' },
  { path: 'order.items', label: 'Kalemler (ad, adet, fiyat, görsel)', sample: [
    { name: 'Pamuklu Tişört', quantity: 2, price: 349.95, imageUrl: null },
    { name: 'Kot Pantolon', quantity: 1, price: 550, imageUrl: null },
  ] },
  { path: 'order.paymentMethod', label: 'Ödeme yöntemi', sample: 'Kredi kartı' },
  { path: 'order.status', label: 'Sipariş durumu (anahtar)', sample: 'processing' },
  { path: 'shipping.address', label: 'Teslimat adresi', sample: 'Atatürk Cad. No:12 D:3, Kadıköy / İstanbul' },
  { path: 'store.name', label: 'Mağaza adı', sample: 'Örnek Mağaza' },
  { path: 'store.logoUrl', label: 'Mağaza logosu', sample: '' },
  { path: 'store.supportEmail', label: 'Destek e-postası', sample: 'destek@ornek.com' },
  { path: 'store.supportPhone', label: 'Destek telefonu', sample: '+90 212 000 00 00' },
  { path: 'brand.name', label: 'Marka adı', sample: 'Örnek Marka' },
];

const SHIPMENT: VariableDef[] = [
  { path: 'shipment.carrierName', label: 'Kargo firması', sample: 'Yurtiçi Kargo' },
  { path: 'shipment.trackingNumber', label: 'Takip numarası', sample: '1234567890123' },
  { path: 'shipment.trackingUrl', label: 'Takip linki', sample: 'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=1234567890123' },
];

const RETURN: VariableDef[] = [
  { path: 'return.code', label: 'İade kodu', sample: 'RT-88213' },
  { path: 'refund.amount', label: 'İade tutarı', sample: 349.95 },
];

const INVOICE: VariableDef[] = [{ path: 'invoice.url', label: 'Fatura linki', sample: 'https://ornek.com/fatura/INV-2026-00042.pdf' }];

const EXTRA: Partial<Record<NotificationEvent, VariableDef[]>> = {
  ORDER_SHIPPED: SHIPMENT,
  ORDER_OUT_FOR_DELIVERY: SHIPMENT,
  ORDER_DELIVERED: SHIPMENT,
  RETURN_REQUESTED: RETURN,
  RETURN_APPROVED: RETURN,
  RETURN_RECEIVED: RETURN,
  REFUND_COMPLETED: RETURN,
  INVOICE_CREATED: INVOICE,
};

export function variablesFor(event: NotificationEvent): VariableDef[] {
  return [...COMMON, ...(EXTRA[event] ?? [])];
}

/** Katalogdaki her yol için `{ a: { b: sample } }` iç içe nesnesi. */
export function sampleContext(event: NotificationEvent): Record<string, any> {
  const ctx: Record<string, any> = {};
  for (const v of variablesFor(event)) setPath(ctx, v.path, v.sample);
  return ctx;
}

export function setPath(obj: Record<string, any>, path: string, value: unknown) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] ??= {};
  cur[parts[parts.length - 1]] = value;
}

/** `order.items` içindeki alanlar `{{#each order.items}}{{name}}{{/each}}` ile erişilir. */
export const ITEM_FIELDS = ['name', 'quantity', 'price', 'imageUrl'];
