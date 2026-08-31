import { TrendyolConnector } from './integrations/marketplaces/trendyol/TrendyolConnector';
import { MarketplaceHttpClient } from './integrations/marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './integrations/marketplaces/core/MarketplaceRateLimiter';
const c = new TrendyolConnector(
  { apiKey: process.env.TY_KEY!, apiSecret: process.env.TY_SECRET!, sellerId: process.env.TY_SELLER! },
  new MarketplaceHttpClient(), new MarketplaceRateLimiter(),
  { 'general.mode': 'live', 'general.environment': 'sandbox', 'orders.backfillDays': 30, 'orders.importStatuses': [] },
);
(async () => {
  const o = await c.getOrders();
  const nz = o.filter((x) => x.totalAmount > 0);
  const items = o.flatMap((x) => x.items);
  const st: Record<string, number> = {};
  o.forEach((x) => (st[x.status] = (st[x.status] ?? 0) + 1));
  console.log('paket sayisi        :', o.length);
  console.log('benzersiz orderNumber:', new Set(o.map((x) => x.orderNumber)).size);
  console.log('benzersiz mp number  :', new Set(o.map((x) => x.marketplaceOrderNumber)).size);
  console.log('tutar > 0            :', nz.length, '/', o.length);
  console.log('kalem birim fiyat >0 :', items.filter((i) => i.unitPrice > 0).length, '/', items.length);
  console.log('durum dagilimi       :', st);
  const s = nz[0];
  if (s) console.log('ornek tutarli siparis:', s.orderNumber, s.totalAmount, s.currency, JSON.stringify(s.items));
})();
