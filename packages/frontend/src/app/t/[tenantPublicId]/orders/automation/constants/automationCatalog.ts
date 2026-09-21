import {
  ActionType,
  AutomationCatalog,
  ConditionNode,
  ConditionOperator,
  RuleAction,
  TriggerType,
} from '../types';

export interface TriggerMeta {
  key: TriggerType;
  title: string;
  badge: string;
  description: string;
  iconName: string;
  badgeColor: string;
}

export interface FieldMeta {
  key: string;
  label: string;
  category: 'order' | 'shipping' | 'pricing' | 'customer' | 'system';
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  unit?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface OperatorMeta {
  key: ConditionOperator;
  symbol: string;
  label: string;
  description: string;
}

export interface ActionMeta {
  key: ActionType;
  title: string;
  badge: string;
  description: string;
  badgeColor: string;
}

export const TRIGGER_METADATA: Record<TriggerType, TriggerMeta> = {
  ORDER_CREATED: {
    key: 'ORDER_CREATED',
    title: 'Yeni Sipariş Oluşturulduğunda',
    badge: 'Yeni Sipariş',
    description: 'Pazaryeri veya e-ticaret sitenizden sisteme yeni bir sipariş düştüğünde tetiklenir.',
    iconName: 'ShoppingCartIcon',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  ORDER_STATUS_CHANGED: {
    key: 'ORDER_STATUS_CHANGED',
    title: 'Sipariş Durumu Değiştiğinde',
    badge: 'Durum Değişimi',
    description: 'Siparişin durumu belirlenen bir aşamadan diğerine geçtiğinde tetiklenir.',
    iconName: 'ArrowPathIcon',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  PAYMENT_RECEIVED: {
    key: 'PAYMENT_RECEIVED',
    title: 'Ödeme Tahsil Edildiğinde',
    badge: 'Ödeme Alındı',
    description: 'Siparişin ödeme durumu "Ödendi" veya kapıda ödeme tahsil edildi olarak kaydedildiğinde tetiklenir.',
    iconName: 'CreditCardIcon',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  },
  SHIPMENT_CREATED: {
    key: 'SHIPMENT_CREATED',
    title: 'Kargo Gönderisi Oluşturulduğunda',
    badge: 'Kargoya Verildi',
    description: 'Kargo takip barkodu veya sevk irsaliyesi oluşturulduğunda tetiklenir.',
    iconName: 'TruckIcon',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  SHIPMENT_DELIVERED: {
    key: 'SHIPMENT_DELIVERED',
    title: 'Kargo Teslim Edildiğinde',
    badge: 'Teslim Edildi',
    description: 'Kargo taşıyıcısından alıcıya teslim edildi bilgisi geldiğinde tetiklenir.',
    iconName: 'CheckBadgeIcon',
    badgeColor: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
  SHIPMENT_EXCEPTION: {
    key: 'SHIPMENT_EXCEPTION',
    title: 'Kargo Teslimat İstisnası Bildirildiğinde',
    badge: 'Kargo İstisnası',
    description: 'Kargo firması alıcı adreste bulunamadı, hasar veya gecikme uyarısı geçtiğinde tetiklenir.',
    iconName: 'ExclamationTriangleIcon',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  RETURN_REQUESTED: {
    key: 'RETURN_REQUESTED',
    title: 'İade Talebi Geldiğinde',
    badge: 'İade Talebi',
    description: 'Müşteri veya pazaryeri üzerinden bir iade süreci başlatıldığında tetiklenir.',
    iconName: 'ArrowUturnLeftIcon',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  ORDER_CANCELLED: {
    key: 'ORDER_CANCELLED',
    title: 'Sipariş İptal Edildiğinde',
    badge: 'İptal Edildi',
    description: 'Sipariş mağaza, müşteri veya pazaryeri tarafından iptal edildiğinde tetiklenir.',
    iconName: 'XCircleIcon',
    badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  STOCK_INSUFFICIENT: {
    key: 'STOCK_INSUFFICIENT',
    title: 'Yetersiz Stok Tespit Edildiğinde',
    badge: 'Stok Yetersiz',
    description: 'Siparişteki ürünlerden biri için depoda yeterli fiziksel stok bulunamadığında tetiklenir.',
    iconName: 'ArchiveBoxXMarkIcon',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  ORDER_IDLE: {
    key: 'ORDER_IDLE',
    title: 'Sipariş Hareketsiz Kaldığında (Zaman Aşımı)',
    badge: 'Hareketsiz Sipariş',
    description: 'Belirlenen bir durumda X saatten uzun süre işlem görmeyen siparişleri yakalar.',
    iconName: 'ClockIcon',
    badgeColor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
  SCHEDULED: {
    key: 'SCHEDULED',
    title: 'Zamanlanmış Periyotta (Saatlik / Günlük)',
    badge: 'Periyodik',
    description: 'Arka planda düzenli aralıklarla çalışan tarama görevidir.',
    iconName: 'CalendarDaysIcon',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
};

export const FIELD_METADATA: Record<string, FieldMeta> = {
  source: {
    key: 'source',
    label: 'Pazaryeri / Sipariş Kaynağı',
    category: 'order',
    type: 'enum',
    options: [
      { value: 'trendyol', label: 'Trendyol' },
      { value: 'hepsiburada', label: 'Hepsiburada' },
      { value: 'ciceksepeti', label: 'Çiçeksepeti' },
      { value: 'pazarama', label: 'Pazarama' },
      { value: 'n11', label: 'N11' },
      { value: 'shopify', label: 'Shopify Web Mağaza' },
      { value: 'manual', label: 'Manuel / Dahili Sipariş' },
    ],
  },
  status: {
    key: 'status',
    label: 'Sipariş Durumu',
    category: 'order',
    type: 'enum',
    options: [
      { value: 'pending', label: 'Beklemede (pending)' },
      { value: 'processing', label: 'İşleniyor / Hazırlanıyor (processing)' },
      { value: 'shipped', label: 'Kargoya Verildi (shipped)' },
      { value: 'delivered', label: 'Teslim Edildi (delivered)' },
      { value: 'cancelled', label: 'İptal Edildi (cancelled)' },
    ],
  },
  paymentStatus: {
    key: 'paymentStatus',
    label: 'Ödeme Durumu',
    category: 'pricing',
    type: 'enum',
    options: [
      { value: 'pending', label: 'Ödeme Bekliyor' },
      { value: 'paid', label: 'Ödendi' },
      { value: 'partially_refunded', label: 'Kısmen İade Edildi' },
      { value: 'refunded', label: 'İade Edildi' },
      { value: 'failed', label: 'Ödeme Başarısız' },
    ],
  },
  fulfillmentStatus: {
    key: 'fulfillmentStatus',
    label: 'Depo / Karşılama Durumu',
    category: 'order',
    type: 'enum',
    options: [
      { value: 'unfulfilled', label: 'Hazırlanmadı' },
      { value: 'partially_fulfilled', label: 'Kısmen Hazırlandı' },
      { value: 'fulfilled', label: 'Tamamen Hazırlandı' },
      { value: 'returned', label: 'İade Edildi' },
    ],
  },
  totalAmount: {
    key: 'totalAmount',
    label: 'Toplam Sipariş Tutarı',
    category: 'pricing',
    type: 'number',
    unit: 'TL',
    placeholder: 'Örn: 1500',
  },
  currency: {
    key: 'currency',
    label: 'Para Birimi',
    category: 'pricing',
    type: 'enum',
    options: [
      { value: 'TRY', label: 'Türk Lirası (TRY ₺)' },
      { value: 'USD', label: 'Amerikan Doları (USD $)' },
      { value: 'EUR', label: 'Euro (EUR €)' },
    ],
  },
  itemCount: {
    key: 'itemCount',
    label: 'Toplam Ürün Adedi',
    category: 'order',
    type: 'number',
    unit: 'Adet',
    placeholder: 'Örn: 3',
  },
  totalDesi: {
    key: 'totalDesi',
    label: 'Toplam Paket Desisi',
    category: 'shipping',
    type: 'number',
    unit: 'Desi',
    placeholder: 'Örn: 30',
  },
  shippingCity: {
    key: 'shippingCity',
    label: 'Teslimat İli (Şehir)',
    category: 'shipping',
    type: 'string',
    placeholder: 'Örn: İstanbul, Ankara, İzmir',
  },
  shippingDistrict: {
    key: 'shippingDistrict',
    label: 'Teslimat İlçesi',
    category: 'shipping',
    type: 'string',
    placeholder: 'Örn: Kadıköy, Çankaya, Karşıyaka',
  },
  shippingCountry: {
    key: 'shippingCountry',
    label: 'Teslimat Ülkesi',
    category: 'shipping',
    type: 'string',
    placeholder: 'Örn: TR, DE, US',
  },
  hasSku: {
    key: 'hasSku',
    label: 'Siparişteki SKU / Ürün Kodu',
    category: 'order',
    type: 'string',
    placeholder: 'Örn: KRP-1002, TIS-MAVI-L',
  },
  tags: {
    key: 'tags',
    label: 'Sipariş Etiketleri',
    category: 'order',
    type: 'string',
    placeholder: 'Örn: vip, teyit-gerekli',
  },
  isHold: {
    key: 'isHold',
    label: 'Sipariş Bekletmede mi? (Hold)',
    category: 'system',
    type: 'boolean',
  },
  priority: {
    key: 'priority',
    label: 'Sipariş Önceliği',
    category: 'system',
    type: 'enum',
    options: [
      { value: 'low', label: 'Düşük Öncelik' },
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'Yüksek Öncelik' },
      { value: 'urgent', label: 'Kritik / Acil' },
    ],
  },
  notes: {
    key: 'notes',
    label: 'Müşteri / Sipariş Notu',
    category: 'customer',
    type: 'string',
    placeholder: 'Örn: hediye paketi, fatura',
  },
  isFirstOrder: {
    key: 'isFirstOrder',
    label: 'Müşterinin İlk Siparişi mi?',
    category: 'customer',
    type: 'boolean',
  },
  orderHour: {
    key: 'orderHour',
    label: 'Sipariş Verilme Saati (0 - 23)',
    category: 'system',
    type: 'number',
    unit: 'Saat',
    placeholder: 'Örn: 17 (17:00 sonrası)',
  },
  orderDayOfWeek: {
    key: 'orderDayOfWeek',
    label: 'Sipariş Verilme Günü (1: Pzt - 7: Paz)',
    category: 'system',
    type: 'enum',
    options: [
      { value: '1', label: 'Pazartesi' },
      { value: '2', label: 'Salı' },
      { value: '3', label: 'Çarşamba' },
      { value: '4', label: 'Perşembe' },
      { value: '5', label: 'Cuma' },
      { value: '6', label: 'Cumartesi' },
      { value: '7', label: 'Pazar' },
    ],
  },
};

export const OPERATOR_METADATA: Record<ConditionOperator, OperatorMeta> = {
  eq: {
    key: 'eq',
    symbol: '=',
    label: 'Eşittir',
    description: 'Belirtilen değere tam olarak eşit olmalıdır.',
  },
  neq: {
    key: 'neq',
    symbol: '≠',
    label: 'Eşit Değildir',
    description: 'Belirtilen değerden farklı olmalıdır.',
  },
  gt: {
    key: 'gt',
    symbol: '>',
    label: 'Büyüktür',
    description: 'Girilen sayısal değerden kesinlikle büyük olmalıdır.',
  },
  gte: {
    key: 'gte',
    symbol: '≥',
    label: 'Büyüktür veya Eşittir',
    description: 'Girilen sayısal değere eşit veya büyük olmalıdır.',
  },
  lt: {
    key: 'lt',
    symbol: '<',
    label: 'Küçüktür',
    description: 'Girilen sayısal değerden küçük olmalıdır.',
  },
  lte: {
    key: 'lte',
    symbol: '≤',
    label: 'Küçüktür veya Eşittir',
    description: 'Girilen sayısal değere eşit veya küçük olmalıdır.',
  },
  between: {
    key: 'between',
    symbol: '↔',
    label: 'Aralığında',
    description: 'Min ve Max değerleri arasında yer almalıdır (ör: 100 - 500).',
  },
  in: {
    key: 'in',
    symbol: '∈',
    label: 'Listeden Herhangi Biri (İçinde)',
    description: 'Virgülle ayrılan değerlerden en az biriyle eşleşmelidir.',
  },
  not_in: {
    key: 'not_in',
    symbol: '∉',
    label: 'Listede Yok (Dışında)',
    description: 'Belirtilen değer listesindeki hiçbir elemanı içermemelidir.',
  },
  contains: {
    key: 'contains',
    symbol: '🔍',
    label: 'Metin İçerir',
    description: 'Belirtilen metin parçasını içinde barındırır.',
  },
  not_contains: {
    key: 'not_contains',
    symbol: '🚫',
    label: 'Metin İçermez',
    description: 'Belirtilen metin parçasını barındırmaz.',
  },
  is_empty: {
    key: 'is_empty',
    symbol: '∅',
    label: 'Boş / Tanımsız',
    description: 'Alan değerinin girilmemiş veya boş olduğunu kontrol eder.',
  },
  is_not_empty: {
    key: 'is_not_empty',
    symbol: '✓',
    label: 'Dolu / Tanımlı',
    description: 'Alan değerinin mevcut ve dolu olduğunu kontrol eder.',
  },
};

export const ACTION_METADATA: Record<ActionType, ActionMeta> = {
  ADD_TAG: {
    key: 'ADD_TAG',
    title: 'Siparişe Etiket Ekle',
    badge: 'Etiket Ekle',
    description: 'Siparişe özel takip, öncelik veya filtreleme etiketi ekler.',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  REMOVE_TAG: {
    key: 'REMOVE_TAG',
    title: 'Siparişten Etiket Kaldır',
    badge: 'Etiket Kaldır',
    description: 'Siparişte var olan bir etiketi temizler.',
    badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  },
  HOLD_ORDER: {
    key: 'HOLD_ORDER',
    title: 'Siparişi Beklemeye Al (Hold)',
    badge: 'Beklemeye Al',
    description: 'Depo hazırlık veya kargolama akışını durdurup siparişi incelemeye alır.',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  RELEASE_HOLD: {
    key: 'RELEASE_HOLD',
    title: 'Beklemeyi Kaldır (Release)',
    badge: 'Beklemeyi Aç',
    description: 'Bekletmedeki siparişin kilidini kaldırarak süreci devam ettirir.',
    badgeColor: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
  SET_ORDER_STATUS: {
    key: 'SET_ORDER_STATUS',
    title: 'Sipariş Durumunu Güncelle',
    badge: 'Durum Değiştir',
    description: 'Sipariş, ödeme veya karşılama durumunu yeni bir aşamaya geçirir.',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  SET_PRIORITY: {
    key: 'SET_PRIORITY',
    title: 'Sipariş Önceliği Ata',
    badge: 'Öncelik Ata',
    description: 'Depo hazırlık listesinde siparişin öne çıkmasını sağlar.',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  ASSIGN_CARRIER: {
    key: 'ASSIGN_CARRIER',
    title: 'Kargo Firması Ata',
    badge: 'Kargo Ata',
    description: 'Siparişin taşınacağı kargo firmasını otomatik belirler.',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  ASSIGN_WAREHOUSE: {
    key: 'ASSIGN_WAREHOUSE',
    title: 'Sevkiyat Deposu Ata',
    badge: 'Depo Ata',
    description: 'Siparişin çıkış yapacağı fiziksel depoyu atar.',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  },
  CREATE_INVOICE: {
    key: 'CREATE_INVOICE',
    title: 'E-Fatura / E-Arşiv Oluştur',
    badge: 'Fatura Kes',
    description: 'Entegre fatura servisi üzerinden e-fatura kesme emri verir.',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  },
  SEND_NOTIFICATION: {
    key: 'SEND_NOTIFICATION',
    title: 'Bildirim Gönder (SMS / E-Posta)',
    badge: 'Bildirim Gönder',
    description: 'Müşteriye veya personele şablon üzerinden SMS/E-posta iletir.',
    badgeColor: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  },
  ADD_ORDER_NOTE: {
    key: 'ADD_ORDER_NOTE',
    title: 'Siparişe Not Ekle',
    badge: 'Not Ekle',
    description: 'Sipariş zaman tüneline veya yönetici paneline otomatik not düşer.',
    badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  },
  ASSIGN_USER: {
    key: 'ASSIGN_USER',
    title: 'Sorumlu Kullanıcı / Temsilci Ata',
    badge: 'Temsilci Ata',
    description: 'Siparişin takibi için bir yönetici veya operatör görevlendirir.',
    badgeColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  },
  CALL_WEBHOOK: {
    key: 'CALL_WEBHOOK',
    title: 'Harici Webhook Çağır',
    badge: 'Webhook',
    description: 'Dış API veya otomasyon sisteminize (n8n/Zapier) güvenli JSON fırlatır.',
    badgeColor: 'bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-600/20',
  },
  WAIT: {
    key: 'WAIT',
    title: 'Beklet (Gecikmeli Aksiyon)',
    badge: 'Beklet',
    description: 'Sonraki aksiyon adımlarını belirlenen dakika kadar geciktirir.',
    badgeColor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  },
};

/**
 * Fallback static catalog so dropdowns are NEVER empty even if backend is loading or unreachable.
 */
export const FALLBACK_CATALOG: AutomationCatalog = {
  triggers: Object.values(TRIGGER_METADATA).map((t) => ({
    key: t.key,
    labelKey: `triggers.${t.key.toLowerCase()}`,
    descriptionKey: `triggers.desc_${t.key.toLowerCase()}`,
    requiresConfig: t.key === 'ORDER_STATUS_CHANGED' || t.key === 'ORDER_IDLE' || t.key === 'SCHEDULED',
  })),
  fields: Object.values(FIELD_METADATA).map((f) => ({
    key: f.key,
    labelKey: `fields.${f.key}`,
    type: f.type,
    operators:
      f.type === 'number'
        ? ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between']
        : f.type === 'boolean'
          ? ['eq', 'neq']
          : ['eq', 'neq', 'in', 'not_in', 'contains', 'is_empty', 'is_not_empty'],
    options: f.options?.map((o) => ({ value: o.value, labelKey: o.label })),
  })),
  operators: Object.values(OPERATOR_METADATA).map((o) => ({
    key: o.key,
    labelKey: `operators.${o.key}`,
    symbol: o.symbol,
  })),
  actions: Object.values(ACTION_METADATA).map((a) => ({
    key: a.key,
    labelKey: `actions.${a.key.toLowerCase()}`,
    descriptionKey: `actions.desc_${a.key.toLowerCase()}`,
    configFields: [],
  })),
};

/**
 * Builds a natural Turkish sentence describing the rule:
 * "🛒 Yeni sipariş oluşturulduğunda ve Toplam Sipariş Tutarı ≥ 1.500 TL ise → Siparişi Beklemeye Al (Yüksek tutarlı), 'teyit-gerekli' etiketi ekle."
 */
export function generateNaturalLanguageSummary(
  triggerType: TriggerType,
  triggerConfig: Record<string, any>,
  conditions: ConditionNode[],
  conditionOperator: 'and' | 'or',
  actions: RuleAction[],
): string {
  const trigMeta = TRIGGER_METADATA[triggerType] || {
    title: triggerType,
  };

  let triggerPhrase = trigMeta.title;
  if (triggerType === 'ORDER_STATUS_CHANGED' && triggerConfig?.toStatus) {
    triggerPhrase = `Sipariş durumu "${triggerConfig.toStatus}" olarak değiştiğinde`;
  } else if (triggerType === 'ORDER_IDLE' && triggerConfig?.idleHours) {
    triggerPhrase = `${triggerConfig.idleStatus || 'Bekleyen'} durumundaki sipariş ${triggerConfig.idleHours} saattir hareketsiz kaldığında`;
  }

  let conditionsPhrase = '';
  if (conditions.length === 0) {
    conditionsPhrase = 'herhangi bir filtre koşulu aranmaksızın';
  } else {
    const list = conditions.map((c) => {
      const fMeta = FIELD_METADATA[c.field];
      const fieldName = fMeta?.label || c.field;
      const opMeta = OPERATOR_METADATA[c.operator];
      const opSymbol = opMeta?.symbol || c.operator;
      const opLabel = opMeta?.label || c.operator;

      if (c.operator === 'is_empty') return `${fieldName} boş ise`;
      if (c.operator === 'is_not_empty') return `${fieldName} dolu ise`;

      let valStr = '';
      if (Array.isArray(c.value)) {
        valStr = `[${c.value.join(', ')}]`;
      } else if (c.value !== undefined && c.value !== '') {
        valStr = String(c.value);
        if (fMeta?.unit) valStr += ` ${fMeta.unit}`;
      } else {
        valStr = '(belirtilmedi)';
      }

      return `${fieldName} ${opSymbol} ${valStr}`;
    });

    const connector = conditionOperator === 'and' ? ' VE ' : ' VEYA ';
    conditionsPhrase = list.join(connector);
  }

  let actionsPhrase = '';
  if (actions.length === 0) {
    actionsPhrase = 'hiçbir işlem yapma';
  } else {
    const actList = actions.map((act) => {
      const aMeta = ACTION_METADATA[act.type];
      const actTitle = aMeta?.title || act.type;

      switch (act.type) {
        case 'ADD_TAG':
          return act.config?.tag ? `"${act.config.tag}" etiketi ekle` : 'etiket ekle';
        case 'REMOVE_TAG':
          return act.config?.tag ? `"${act.config.tag}" etiketini kaldır` : 'etiket kaldır';
        case 'HOLD_ORDER':
          return act.config?.reason
            ? `siparişi beklemeye al ("${act.config.reason}")`
            : 'siparişi beklemeye al';
        case 'RELEASE_HOLD':
          return 'beklemeyi kaldır';
        case 'SET_ORDER_STATUS': {
          const parts: string[] = [];
          if (act.config?.status) parts.push(`durumunu "${act.config.status}" yap`);
          if (act.config?.paymentStatus) parts.push(`ödeme durumunu "${act.config.paymentStatus}" yap`);
          return parts.length > 0 ? parts.join(', ') : 'durumunu güncelle';
        }
        case 'SET_PRIORITY':
          return `önceliğini "${act.config?.priority || 'normal'}" yap`;
        case 'ASSIGN_CARRIER':
          return act.config?.carrierName
            ? `kargo firmasını "${act.config.carrierName}" yap`
            : 'kargo firması ata';
        case 'ASSIGN_WAREHOUSE':
          return act.config?.warehouseName
            ? `çıkış deposunu "${act.config.warehouseName}" yap`
            : 'depo ata';
        case 'CREATE_INVOICE':
          return 'e-fatura oluştur';
        case 'SEND_NOTIFICATION':
          return `${act.config?.channel || 'dahili'} bildirim gönder`;
        case 'ADD_ORDER_NOTE':
          return act.config?.note ? `"${act.config.note}" notu düş` : 'not ekle';
        case 'CALL_WEBHOOK':
          return act.config?.url ? `webhook çağır (${act.config.url})` : 'webhook çağır';
        case 'WAIT':
          return `${act.config?.minutes || 10} dakika beklet`;
        default:
          return actTitle;
      }
    });

    actionsPhrase = actList.join(', ');
  }

  return `${triggerPhrase} ve ${conditionsPhrase} ise → ${actionsPhrase}.`;
}
