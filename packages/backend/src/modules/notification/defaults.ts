import { NotificationChannel, NotificationEvent } from '@prisma/client';

/**
 * Sistem varsayılan şablonları. DB'de değil kodda: RLS altında agencyId'siz satır
 * görünmez; kodda olunca "silinemez/düzenlenemez" kuralı bedava gelir. Kullanıcı
 * "Özelleştir" dediğinde mevcut kapsama kopyalanır (NotificationTemplateService.customize).
 *
 * İşlemsel (bilgilendirme) mesajlardır; kampanya/indirim içeriği yoktur ve
 * düzenleyici bunu kullanıcıya hatırlatır (İYS kapsamındaki ticari ileti ayrı iş).
 */
export interface SystemTemplate {
  id: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  locale: string;
  name: string;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string;
}

type Copy = { name: string; subject: string; html: string; sms: string };

const TRACK_TR = `<p>Kargo: {{shipment.carrierName}}<br/>Takip no: <strong>{{shipment.trackingNumber}}</strong></p><p><a href="{{shipment.trackingUrl}}">Kargonuzu takip edin</a></p>`;
const TRACK_EN = `<p>Carrier: {{shipment.carrierName}}<br/>Tracking no: <strong>{{shipment.trackingNumber}}</strong></p><p><a href="{{shipment.trackingUrl}}">Track your parcel</a></p>`;
const ITEMS_TR = `<table width="100%" cellpadding="6" style="border-collapse:collapse;font-size:13px;">{{#each order.items}}<tr><td style="border-bottom:1px solid #e5e7eb;">{{name}}</td><td align="center" style="border-bottom:1px solid #e5e7eb;">x{{quantity}}</td><td align="right" style="border-bottom:1px solid #e5e7eb;">{{formatCurrency price ../order.currency}}</td></tr>{{/each}}</table><p style="text-align:right;"><strong>Toplam: {{formatCurrency order.total order.currency}}</strong></p>`;
const ITEMS_EN = ITEMS_TR.replace('Toplam:', 'Total:');

const COPY: Record<NotificationEvent, { tr: Copy; en: Copy }> = {
  ORDER_CREATED: {
    tr: { name: 'Sipariş alındı', subject: '{{order.number}} numaralı siparişiniz alındı', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> numaralı siparişiniz alındı. Hazırlanmaya başlandığında sizi bilgilendireceğiz.</p>${ITEMS_TR}`, sms: '{{store.name}}: {{order.number}} numaralı siparişiniz alındı. Tutar: {{formatCurrency order.total order.currency}}' },
    en: { name: 'Order received', subject: 'We received your order {{order.number}}', html: `<p>Hi {{customer.firstName}},</p><p>Your order <strong>{{order.number}}</strong> has been received. We will let you know when it is being prepared.</p>${ITEMS_EN}`, sms: '{{store.name}}: order {{order.number}} received. Total: {{formatCurrency order.total order.currency}}' },
  },
  ORDER_CONFIRMED: {
    tr: { name: 'Sipariş onaylandı', subject: '{{order.number}} siparişiniz hazırlanıyor', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> numaralı siparişiniz onaylandı ve hazırlanıyor.</p>`, sms: '{{store.name}}: {{order.number}} siparişiniz onaylandı, hazırlanıyor.' },
    en: { name: 'Order confirmed', subject: 'Your order {{order.number}} is being prepared', html: `<p>Hi {{customer.firstName}},</p><p>Your order <strong>{{order.number}}</strong> is confirmed and being prepared.</p>`, sms: '{{store.name}}: order {{order.number}} confirmed and being prepared.' },
  },
  ORDER_SHIPPED: {
    tr: { name: 'Kargoya verildi', subject: '{{order.number}} siparişiniz kargoya verildi', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> numaralı siparişiniz kargoya verildi.</p>${TRACK_TR}`, sms: '{{store.name}}: {{order.number}} siparişiniz {{shipment.carrierName}} ile kargoda. Takip: {{shipment.trackingNumber}}' },
    en: { name: 'Order shipped', subject: 'Your order {{order.number}} has shipped', html: `<p>Hi {{customer.firstName}},</p><p>Your order <strong>{{order.number}}</strong> is on its way.</p>${TRACK_EN}`, sms: '{{store.name}}: order {{order.number}} shipped via {{shipment.carrierName}}. Tracking: {{shipment.trackingNumber}}' },
  },
  ORDER_OUT_FOR_DELIVERY: {
    tr: { name: 'Dağıtımda', subject: '{{order.number}} siparişiniz bugün teslim edilecek', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> numaralı siparişiniz dağıtıma çıktı; bugün teslim edilmesi bekleniyor.</p>${TRACK_TR}`, sms: '{{store.name}}: {{order.number}} siparişiniz dağıtımda, bugün teslim edilecek. Takip: {{shipment.trackingNumber}}' },
    en: { name: 'Out for delivery', subject: 'Your order {{order.number}} is out for delivery', html: `<p>Hi {{customer.firstName}},</p><p>Your order <strong>{{order.number}}</strong> is out for delivery today.</p>${TRACK_EN}`, sms: '{{store.name}}: order {{order.number}} is out for delivery today. Tracking: {{shipment.trackingNumber}}' },
  },
  ORDER_DELIVERED: {
    tr: { name: 'Teslim edildi', subject: '{{order.number}} siparişiniz teslim edildi', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> numaralı siparişiniz teslim edildi. Bir sorun varsa {{store.supportEmail}} adresinden bize ulaşabilirsiniz.</p>`, sms: '{{store.name}}: {{order.number}} siparişiniz teslim edildi. İyi günlerde kullanın.' },
    en: { name: 'Delivered', subject: 'Your order {{order.number}} was delivered', html: `<p>Hi {{customer.firstName}},</p><p>Your order <strong>{{order.number}}</strong> has been delivered. If anything is wrong, contact us at {{store.supportEmail}}.</p>`, sms: '{{store.name}}: order {{order.number}} delivered. Enjoy!' },
  },
  ORDER_CANCELLED: {
    tr: { name: 'Sipariş iptal', subject: '{{order.number}} siparişiniz iptal edildi', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> numaralı siparişiniz iptal edildi. Ödeme yaptıysanız tutar aynı yönteme iade edilecektir.</p>`, sms: '{{store.name}}: {{order.number}} siparişiniz iptal edildi.' },
    en: { name: 'Order cancelled', subject: 'Your order {{order.number}} was cancelled', html: `<p>Hi {{customer.firstName}},</p><p>Your order <strong>{{order.number}}</strong> has been cancelled. Any payment will be refunded to the original method.</p>`, sms: '{{store.name}}: order {{order.number}} cancelled.' },
  },
  PAYMENT_RECEIVED: {
    tr: { name: 'Ödeme alındı', subject: '{{order.number}} ödemeniz alındı', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> siparişiniz için {{formatCurrency order.total order.currency}} tutarındaki ödemeniz alındı.</p>`, sms: '{{store.name}}: {{order.number}} için {{formatCurrency order.total order.currency}} ödemeniz alındı.' },
    en: { name: 'Payment received', subject: 'Payment received for {{order.number}}', html: `<p>Hi {{customer.firstName}},</p><p>We received your payment of {{formatCurrency order.total order.currency}} for order <strong>{{order.number}}</strong>.</p>`, sms: '{{store.name}}: payment of {{formatCurrency order.total order.currency}} received for {{order.number}}.' },
  },
  PAYMENT_FAILED: {
    tr: { name: 'Ödeme başarısız', subject: '{{order.number}} ödemeniz alınamadı', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> siparişinizin ödemesi alınamadı. Lütfen ödeme bilgilerinizi kontrol edip tekrar deneyin.</p>`, sms: '{{store.name}}: {{order.number}} ödemeniz alınamadı, lütfen tekrar deneyin.' },
    en: { name: 'Payment failed', subject: 'Payment failed for {{order.number}}', html: `<p>Hi {{customer.firstName}},</p><p>The payment for order <strong>{{order.number}}</strong> could not be processed. Please check your payment details and try again.</p>`, sms: '{{store.name}}: payment for {{order.number}} failed, please try again.' },
  },
  COD_REMINDER: {
    tr: { name: 'Kapıda ödeme hatırlatma', subject: '{{order.number}} siparişiniz kapıda ödemeli', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> siparişiniz kapıda ödemelidir. Teslimatta {{formatCurrency order.total order.currency}} hazır bulundurmanızı rica ederiz.</p>`, sms: '{{store.name}}: {{order.number}} siparişiniz kapıda ödemeli, tutar {{formatCurrency order.total order.currency}}.' },
    en: { name: 'Cash on delivery reminder', subject: 'Order {{order.number}} is cash on delivery', html: `<p>Hi {{customer.firstName}},</p><p>Order <strong>{{order.number}}</strong> is cash on delivery. Please have {{formatCurrency order.total order.currency}} ready at delivery.</p>`, sms: '{{store.name}}: order {{order.number}} is cash on delivery, amount {{formatCurrency order.total order.currency}}.' },
  },
  RETURN_REQUESTED: {
    tr: { name: 'İade talebi alındı', subject: '{{order.number}} iade talebiniz alındı', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> siparişiniz için iade talebiniz alındı. İade kodunuz: <strong>{{return.code}}</strong></p>`, sms: '{{store.name}}: {{order.number}} iade talebiniz alındı. İade kodu: {{return.code}}' },
    en: { name: 'Return requested', subject: 'Return request received for {{order.number}}', html: `<p>Hi {{customer.firstName}},</p><p>We received your return request for order <strong>{{order.number}}</strong>. Return code: <strong>{{return.code}}</strong></p>`, sms: '{{store.name}}: return request for {{order.number}} received. Code: {{return.code}}' },
  },
  RETURN_APPROVED: {
    tr: { name: 'İade onaylandı', subject: '{{order.number}} iadeniz onaylandı', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{return.code}}</strong> kodlu iadeniz onaylandı. Ürünü kargoya verirken bu kodu paketin üzerine yazın.</p>`, sms: '{{store.name}}: {{return.code}} kodlu iadeniz onaylandı, ürünü kargoya verebilirsiniz.' },
    en: { name: 'Return approved', subject: 'Your return {{return.code}} is approved', html: `<p>Hi {{customer.firstName}},</p><p>Return <strong>{{return.code}}</strong> has been approved. Please write this code on the parcel when shipping it back.</p>`, sms: '{{store.name}}: return {{return.code}} approved, you can ship the item back.' },
  },
  RETURN_RECEIVED: {
    tr: { name: 'İade teslim alındı', subject: '{{return.code}} iadeniz elimize ulaştı', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{return.code}}</strong> kodlu iadeniz depomuza ulaştı; kontrol sonrası iade tutarı ödenecektir.</p>`, sms: '{{store.name}}: {{return.code}} iadeniz elimize ulaştı, kontrol ediliyor.' },
    en: { name: 'Return received', subject: 'We received your return {{return.code}}', html: `<p>Hi {{customer.firstName}},</p><p>Return <strong>{{return.code}}</strong> has arrived at our warehouse; the refund will follow after inspection.</p>`, sms: '{{store.name}}: return {{return.code}} received and being inspected.' },
  },
  REFUND_COMPLETED: {
    tr: { name: 'İade ödemesi yapıldı', subject: '{{order.number}} iade ödemeniz yapıldı', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> siparişiniz için {{formatCurrency refund.amount order.currency}} tutarındaki iade ödemesi yapıldı. Bankanıza göre hesabınıza yansıması birkaç iş günü sürebilir.</p>`, sms: '{{store.name}}: {{order.number}} için {{formatCurrency refund.amount order.currency}} iade ödemeniz yapıldı.' },
    en: { name: 'Refund completed', subject: 'Refund issued for {{order.number}}', html: `<p>Hi {{customer.firstName}},</p><p>A refund of {{formatCurrency refund.amount order.currency}} for order <strong>{{order.number}}</strong> has been issued. It may take a few business days to appear.</p>`, sms: '{{store.name}}: refund of {{formatCurrency refund.amount order.currency}} issued for {{order.number}}.' },
  },
  INVOICE_CREATED: {
    tr: { name: 'Fatura oluşturuldu', subject: '{{order.number}} faturanız hazır', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> siparişinizin faturası hazır.</p><p><a href="{{invoice.url}}">Faturayı görüntüle</a></p>`, sms: '{{store.name}}: {{order.number}} faturanız hazır: {{invoice.url}}' },
    en: { name: 'Invoice created', subject: 'Your invoice for {{order.number}} is ready', html: `<p>Hi {{customer.firstName}},</p><p>The invoice for order <strong>{{order.number}}</strong> is ready.</p><p><a href="{{invoice.url}}">View invoice</a></p>`, sms: '{{store.name}}: your invoice for {{order.number}} is ready: {{invoice.url}}' },
  },
  ORDER_STATUS_CHANGED: {
    tr: { name: 'Sipariş durumu değişti', subject: '{{order.number}} siparişinizin durumu güncellendi', html: `<p>Merhaba {{customer.firstName}},</p><p><strong>{{order.number}}</strong> numaralı siparişinizin durumu güncellendi: <strong>{{order.status}}</strong></p>`, sms: '{{store.name}}: {{order.number}} siparişinizin durumu: {{order.status}}' },
    en: { name: 'Order status changed', subject: 'Order {{order.number}} status updated', html: `<p>Hi {{customer.firstName}},</p><p>The status of order <strong>{{order.number}}</strong> is now <strong>{{order.status}}</strong>.</p>`, sms: '{{store.name}}: order {{order.number}} status: {{order.status}}' },
  },
};

export const SUPPORTED_LOCALES = ['tr', 'en'] as const;

export function systemTemplateId(channel: NotificationChannel, event: NotificationEvent, locale: string) {
  return `sys:${channel}:${event}:${locale}`;
}

export function isSystemTemplateId(id: string) {
  return id.startsWith('sys:');
}

export function systemTemplate(channel: NotificationChannel, event: NotificationEvent, locale: string): SystemTemplate | null {
  const loc = (SUPPORTED_LOCALES as readonly string[]).includes(locale) ? (locale as 'tr' | 'en') : 'tr';
  const c = COPY[event]?.[loc];
  if (!c) return null;
  return {
    id: systemTemplateId(channel, event, loc),
    channel,
    event,
    locale: loc,
    name: c.name,
    subject: channel === 'EMAIL' ? c.subject : null,
    bodyHtml: channel === 'EMAIL' ? c.html : null,
    bodyText: channel === 'EMAIL' ? '' : c.sms,
  };
}

export function allSystemTemplates(): SystemTemplate[] {
  const out: SystemTemplate[] = [];
  for (const event of Object.keys(COPY) as NotificationEvent[]) {
    for (const locale of SUPPORTED_LOCALES) {
      for (const channel of ['EMAIL', 'SMS'] as NotificationChannel[]) {
        const t = systemTemplate(channel, event, locale);
        if (t) out.push(t);
      }
    }
  }
  return out;
}

export function parseSystemTemplateId(id: string): { channel: NotificationChannel; event: NotificationEvent; locale: string } | null {
  const m = /^sys:(EMAIL|SMS):([A-Z_]+):([a-z]{2})$/.exec(id);
  if (!m) return null;
  if (!(m[2] in COPY)) return null;
  return { channel: m[1] as NotificationChannel, event: m[2] as NotificationEvent, locale: m[3] };
}
