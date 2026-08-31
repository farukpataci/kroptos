import { PazaramaConnector } from './integrations/marketplaces/pazarama/PazaramaConnector';
import { MarketplaceHttpClient } from './integrations/marketplaces/core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './integrations/marketplaces/core/MarketplaceRateLimiter';

const creds = {
  apiKey: process.env.PZR_KEY!,
  secretKey: process.env.PZR_SECRET!,
};

const settings: Record<string, unknown> = {
  // The connector defaults to simulation until this probe proves the endpoints.
  'general.mode': 'live',
  'orders.backfillDays': 30,
  'orders.importStatuses': [],
};

const c = new PazaramaConnector(creds, new MarketplaceHttpClient(), new MarketplaceRateLimiter(), settings);

async function step(name: string, fn: () => Promise<any>) {
  const t = Date.now();
  try {
    const out = await fn();
    console.log(`\n== ${name} :: OK (${Date.now() - t} ms)`);
    console.log(JSON.stringify(out, null, 2).slice(0, 1500));
    return out;
  } catch (e: any) {
    console.log(`\n== ${name} :: HATA (${Date.now() - t} ms)`);
    console.log(e?.message ?? e);
    return undefined;
  }
}

// Read-only on purpose: updateStock writes to a real catalogue and is not run here.
(async () => {
  if (!creds.apiKey || !creds.secretKey) {
    console.log('PZR_KEY / PZR_SECRET tanımlı değil.');
    process.exit(1);
  }
  console.log(`mod=${JSON.stringify(c.connectionMode)} key=${creds.apiKey.slice(0, 4)}…`);

  await step('testConnection', () => c.testConnection());

  await step('getCategories', async () => {
    const r = await c.getCategories();
    return { count: r.length, first: r[0] };
  });

  // The pagination fixes live or die here: a catalogue over 100 rows is what
  // proves Page/Size actually advances.
  await step('getProducts (sayfalama)', async () => {
    const p = await c.getProducts();
    return {
      count: p.length,
      pagesWalked: Math.ceil(p.length / 100),
      uniqueSkus: new Set(p.map((x) => x.sku)).size,
      first: p[0],
      last: p[p.length - 1],
    };
  });

  await step('getOrders (30 gün)', async () => {
    const o = await c.getOrders();
    return {
      count: o.length,
      prefixApplied: o[0]?.orderNumber,
      statuses: [...new Set(o.map((x) => x.status))],
      first: o[0],
    };
  });
})();
