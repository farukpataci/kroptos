import { N11Connector } from './integrations/marketplaces/n11/N11Connector';
import { MarketplaceHttpClient } from './integrations/marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './integrations/marketplaces/core/MarketplaceRateLimiter';

const creds = {
  apiKey: process.env.N11_KEY!,
  apiSecret: process.env.N11_SECRET!,
  sellerId: process.env.N11_SELLER!,
};

const settings: Record<string, unknown> = {
  'general.mode': 'live',
  'orders.backfillDays': 15,
  'orders.importStatuses': ['created', 'picking', 'shipped'],
};

const c = new N11Connector(creds, new MarketplaceHttpClient(), new MarketplaceRateLimiter(), settings);

async function step(name: string, fn: () => Promise<any>) {
  const t = Date.now();
  try {
    const out = await fn();
    console.log(`\n== ${name} :: OK (${Date.now() - t} ms)`);
    console.log(JSON.stringify(out, null, 2).slice(0, 1200));
    return out;
  } catch (e: any) {
    console.log(`\n== ${name} :: HATA (${Date.now() - t} ms)`);
    console.log(e?.message ?? e);
    return undefined;
  }
}

(async () => {
  await step('testConnection', () => c.testConnection());
  const cats = await step('getCategories', async () => {
    const r = await c.getCategories();
    return { count: r.length, first: r[0] };
  });
  const id = cats?.first?.id;
  if (id !== undefined) await step(`getCategoryAttributes(${id})`, () => c.getCategoryAttributes(String(id)));
  await step('getProducts', async () => {
    const p = await c.getProducts();
    return { count: p.length, first: p[0] };
  });
  await step('getOrders', async () => {
    const o = await c.getOrders();
    return { count: o.length, first: o[0] };
  });
})();
