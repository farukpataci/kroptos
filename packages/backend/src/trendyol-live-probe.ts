import { TrendyolConnector } from './integrations/marketplaces/trendyol/TrendyolConnector';
import { MarketplaceHttpClient } from './integrations/marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './integrations/marketplaces/core/MarketplaceRateLimiter';

const creds = {
  apiKey: process.env.TY_KEY!,
  apiSecret: process.env.TY_SECRET!,
  sellerId: process.env.TY_SELLER!,
};

const settings: Record<string, unknown> = {
  'general.mode': 'live',
  'general.environment': process.env.TY_ENV ?? 'production',
  'orders.backfillDays': 30,
  'orders.importStatuses': [],
};

const c = new TrendyolConnector(creds, new MarketplaceHttpClient(), new MarketplaceRateLimiter(), settings);

async function step(name: string, fn: () => Promise<any>) {
  const t = Date.now();
  try {
    const out = await fn();
    console.log(`\n== ${name} :: OK (${Date.now() - t} ms)`);
    console.log(JSON.stringify(out, null, 2).slice(0, 1000));
    return out;
  } catch (e: any) {
    console.log(`\n== ${name} :: HATA (${Date.now() - t} ms)`);
    console.log(e?.message ?? e);
    return undefined;
  }
}

(async () => {
  console.log(`ortam=${settings['general.environment']} seller=${creds.sellerId}`);
  await step('testConnection', () => c.testConnection());
  const cats = await step('getCategories', async () => {
    const r = await c.getCategories();
    return { count: r.length, first: r[0]?.name, firstId: r[0]?.id };
  });
  if (cats?.firstId !== undefined)
    await step(`getCategoryAttributes(${cats.firstId})`, async () => {
      const a = await c.getCategoryAttributes(String(cats.firstId));
      return { attributeCount: a?.categoryAttributes?.length, first: a?.categoryAttributes?.[0]?.attribute };
    });
  await step('getProducts', async () => {
    const p = await c.getProducts();
    return { count: p.length, first: p[0] };
  });
  await step('getOrders', async () => {
    const o = await c.getOrders();
    return { count: o.length, first: o[0] };
  });
  await step('getAddresses', async () => {
    const a = await c.getAddresses();
    return { count: a.length, first: a[0] };
  });
})();
