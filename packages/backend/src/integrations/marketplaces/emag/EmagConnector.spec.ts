import { HttpStatus, Logger } from '@nestjs/common';
import { EmagConnector, EMAG_MIN_OFFER_SAVE_INTERVAL_MS, resetEmagOfferSaveThrottle } from './EmagConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';
import { parseEmagDateParts, parseEmagDateToUtc } from './EmagMapper';

/**
 * eMAG answers HTTP 200 for business failures, writes stock through a
 * read-then-save pair, and rejects an unregistered IP with the same status as a
 * wrong password. Each of those is a way a sync can look fine while doing
 * nothing (or doing the wrong thing), so those are the paths pinned hardest
 * here.
 *
 * The mapper has its own suite (EmagMapper.spec.ts); nothing below re-tests
 * field mapping. What is tested here is what the connector does *around* it:
 * the envelope check, paging, the per-order failure boundary, the order-number
 * prefix it deliberately applies on top of the mapper's output, and the fact
 * that updateStock never throws.
 */
describe('EmagConnector', () => {
  const PASSWORD = 'p@ssw0rd-SECRET';
  const CREDENTIALS = { country: 'RO', username: 'seller-user', password: PASSWORD };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };
  let sleepSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const build = (
    credentials: Record<string, any> = CREDENTIALS,
    settings: Record<string, unknown> = {},
  ) =>
    new EmagConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  /** A successful eMAG envelope. */
  const ok = (results: unknown[] = []) => ({ isError: false, messages: [], results });

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];
  const urlOf = (index: number) => String(calls()[index][0]);
  const bodyOf = (index: number) => JSON.parse(calls()[index][1].body);
  const lastBody = () => JSON.parse(lastCall()[1].body);

  /** Routes by resource/action so a test only describes the answers it cares about. */
  const route = (handlers: Record<string, (body: any, hit: number) => unknown>) => {
    const hits: Record<string, number> = {};
    httpClient.request.mockImplementation(async (url: string, options: any) => {
      const match = Object.keys(handlers).find((key) => url.endsWith(key));
      if (!match) throw new Error(`test: yönlendirilmemiş eMAG çağrısı ${url}`);
      hits[match] = (hits[match] ?? 0) + 1;
      return handlers[match](options.body ? JSON.parse(options.body) : undefined, hits[match]);
    });
    return () => hits;
  };

  const httpError = (status?: number, body = '') =>
    new MarketplaceHttpError(
      `Marketplace HTTP Request failed with status ${status}`,
      HttpStatus.BAD_GATEWAY,
      status,
      body,
    );

  const offer = (overrides: Record<string, unknown> = {}) => ({
    id: 4001,
    part_number: 'SKU-1',
    part_number_key: 'ABC123',
    name: 'Kablosuz Kulaklık',
    description: '<p>açıklama</p>',
    sale_price: 199.99,
    general_stock: 12,
    status: 1,
    vat_id: 5,
    handling_time: [{ warehouse_id: 1, value: 1 }],
    images: [{ display_type: 1, url: 'https://img/1.jpg' }],
    ean: ['5901234123457'],
    stock: [{ warehouse_id: 1, value: 12 }],
    ...overrides,
  });

  const orderLine = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    product_id: 4001,
    part_number: 'SKU-1',
    name: 'Kablosuz Kulaklık',
    quantity: 2,
    sale_price: 100,
    vat: 0.19,
    ...overrides,
  });

  const order = (overrides: Record<string, unknown> = {}) => ({
    id: 12345,
    status: 1,
    payment_mode_id: 1,
    shipping_tax: 0,
    date: '2026-08-01 10:00:00',
    customer: { id: 7, name: 'Ion Popescu', email: 'ion@example.com', shipping_city: 'București' },
    products: [orderLine()],
    ...overrides,
  });

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
    resetEmagOfferSaveThrottle();
    // The 3-second offer-save interval is real time; the test asserts that it
    // was requested, not that it elapsed.
    sleepSpy = jest.spyOn(EmagConnector.prototype as any, 'sleep').mockResolvedValue(undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const warnings = () => warnSpy.mock.calls.map((call) => String(call[0])).join('\n');
  const errors = () => errorSpy.mock.calls.map((call) => String(call[0])).join('\n');

  // ------------------------------------------------------------------ market

  describe('market selection', () => {
    it('refuses to build without a country rather than guessing a market', () => {
      expect(() => build({ username: 'u', password: 'p' })).toThrow(/ülke seçilmedi/i);
    });

    it('refuses an unsupported country instead of hitting a host that does not exist', () => {
      expect(() => build({ ...CREDENTIALS, country: 'DE' })).toThrow(/desteklenmeyen ülke kodu/i);
    });

    it.each([
      ['RO', 'https://marketplace-api.emag.ro/api-3/vat/read'],
      ['BG', 'https://marketplace-api.emag.bg/api-3/vat/read'],
      ['HU', 'https://marketplace-api.emag.hu/api-3/vat/read'],
      ['PL', 'https://marketplace-api.emag.pl/api-3/vat/read'],
    ])('sends %s traffic to its own host', async (country, expected) => {
      httpClient.request.mockResolvedValue(ok([]));

      await build({ ...CREDENTIALS, country }).testConnection();

      expect(urlOf(0)).toBe(expected);
    });

    it('gives each market its own throttling bucket at eMAG\'s published quota', async () => {
      httpClient.request.mockResolvedValue(ok([]));

      await build().testConnection();

      expect(rateLimiter.throttle).toHaveBeenCalledWith('emag:RO', 20, 60000);
    });

    it('lets the operator lower the quota from settings', async () => {
      httpClient.request.mockResolvedValue(ok([]));

      await build(CREDENTIALS, { 'advanced.rateLimitPerMinute': 5 }).testConnection();

      expect(rateLimiter.throttle).toHaveBeenCalledWith('emag:RO', 5, 60000);
    });
  });

  // --------------------------------------------------------------- transport

  describe('transport', () => {
    it('signs every call with HTTP Basic', async () => {
      httpClient.request.mockResolvedValue(ok([]));

      await build().testConnection();

      const expected = Buffer.from(`seller-user:${PASSWORD}`).toString('base64');
      expect(lastCall()[1].headers.Authorization).toBe(`Basic ${expected}`);
      expect(lastCall()[1].method).toBe('POST');
    });

    it('fails before the first request when a credential is blank', async () => {
      const result = await build({ country: 'RO', username: 'seller-user', password: '' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/kimlik bilgileri eksik: password/i);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('treats isError:true as a failure even though the HTTP call succeeded', async () => {
      // eMAG answers 200 for business failures; trusting the status code is how
      // a sync silently imports nothing.
      httpClient.request.mockResolvedValue({
        isError: true,
        messages: ['You are not allowed to use this resource'],
        results: [],
      });

      await expect(build().getProducts()).rejects.toThrow(
        /product_offer\/read.*You are not allowed to use this resource/s,
      );
    });

    it('treats a missing isError flag as a failure rather than as an empty page', async () => {
      httpClient.request.mockResolvedValue({ results: [] });

      await expect(build().getProducts()).rejects.toThrow(/reddedildi/i);
    });

    it('rejects a body that is not an envelope at all', async () => {
      httpClient.request.mockResolvedValue('<html>maintenance</html>' as any);

      await expect(build().getProducts()).rejects.toThrow(/beklenen zarf değil/i);
    });

    it('keeps the password out of every failure message', async () => {
      httpClient.request.mockRejectedValue(httpError(401, 'unauthorized'));

      const result = await build().testConnection();

      expect(result.message).not.toContain(PASSWORD);
      expect(result.message).not.toContain(Buffer.from(`seller-user:${PASSWORD}`).toString('base64'));
    });
  });

  // ---------------------------------------------------------------- paging

  describe('paging', () => {
    it('never asks for more than the 100-row page cap and walks to the short page', async () => {
      route({
        'product_offer/read': (_body, hit) =>
          ok(hit === 1 ? Array.from({ length: 100 }, (_, i) => offer({ id: i })) : [offer({ id: 999 })]),
      });

      const products = await build().getProducts();

      expect(products).toHaveLength(101);
      expect(bodyOf(0)).toMatchObject({ currentPage: 1, itemsPerPage: 100 });
      expect(bodyOf(1)).toMatchObject({ currentPage: 2, itemsPerPage: 100 });
      expect(calls()).toHaveLength(2);
    });

    it('stops at the page cap instead of looping forever on a response that never shortens', async () => {
      route({ 'product_offer/read': () => ok(Array.from({ length: 100 }, (_, i) => offer({ id: i }))) });

      const products = await build().getProducts();

      expect(calls()).toHaveLength(50);
      expect(products).toHaveLength(5000);
      expect(warnings()).toMatch(/sayfa sınırına ulaştı/i);
    });
  });

  // -------------------------------------------------------- testConnection

  describe('testConnection', () => {
    it('verifies with the cheapest read there is and reports duration', async () => {
      httpClient.request.mockResolvedValue(ok([{ vat_id: 5 }]));

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/RO pazarı/);
      expect(typeof result.durationMs).toBe('number');
      expect(urlOf(0)).toMatch(/vat\/read$/);
    });

    it('names the IP whitelist as well as the credentials on 401', async () => {
      // eMAG rejects an unregistered seller IP with the same 401 as a wrong
      // password; saying only "credentials" sends the seller to rotate a
      // password that was never the problem.
      httpClient.request.mockRejectedValue(httpError(401));

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/IP/);
      expect(result.message).toMatch(/beyaz liste/i);
      expect(result.message).toMatch(/kullanıcı adı\/parola/i);
    });

    it('falls back to category/read on 403 rather than calling the connection dead', async () => {
      route({
        'vat/read': () => {
          throw httpError(403);
        },
        'category/read': () => ok([{ characteristics: [] }]),
      });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/category\/read/);
      expect(urlOf(1)).toMatch(/category\/read$/);
      expect(bodyOf(1)).toMatchObject({ itemsPerPage: 1 });
    });

    it('fails only when the 403 fallback fails too, and says both happened', async () => {
      route({
        'vat/read': () => {
          throw httpError(403);
        },
        'category/read': () => {
          throw httpError(403);
        },
      });

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/vat\/read 403/);
      expect(result.message).toMatch(/category\/read/);
    });

    it('blames the network, not the credentials, when the request never got an answer', async () => {
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('Marketplace Request Timeout', HttpStatus.GATEWAY_TIMEOUT),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/ağ hatası veya zaman aşımı/i);
      expect(result.message).toMatch(/kimlik bilgisi sorunu değildir/i);
      expect(result.message).not.toContain(PASSWORD);
    });

    it('writes nothing while testing', async () => {
      httpClient.request.mockResolvedValue(ok([]));

      await build().testConnection();

      expect(calls().every(([url]) => !String(url).includes('save'))).toBe(true);
    });
  });

  // ---------------------------------------------------------------- products

  describe('getProducts', () => {
    it('maps offers through the mapper', async () => {
      route({ 'product_offer/read': () => ok([offer()]) });

      const products = await build().getProducts();

      expect(products).toEqual([
        expect.objectContaining({
          sku: 'SKU-1',
          name: 'Kablosuz Kulaklık',
          price: 199.99,
          stockQuantity: 12,
          image: 'https://img/1.jpg',
          barcode: '5901234123457',
        }),
      ]);
    });
  });

  // ------------------------------------------------------------------ orders

  describe('getOrders', () => {
    it('asks only for the window, with no unverified filter alongside it', async () => {
      route({ 'order/read': () => ok([]) });

      await build(CREDENTIALS, { 'orders.backfillDays': 3 }).getOrders();

      const body = bodyOf(0);
      expect(Object.keys(body).sort()).toEqual(['createdAfter', 'currentPage', 'itemsPerPage']);
      expect(parseEmagDateParts(body.createdAfter)).toBeDefined();
    });

    it('sends the window in the market\'s local wall clock, with overlap', async () => {
      route({ 'order/read': () => ok([]) });
      const before = Date.now();

      await build(CREDENTIALS, { 'orders.backfillDays': 1 }).getOrders();

      const sent = parseEmagDateToUtc(bodyOf(0).createdAfter, 'Europe/Bucharest');
      const expected = before - 24 * 60 * 60 * 1000 - 5 * 60 * 1000;
      // Round-trips back to the instant it was built from (± a second of drift),
      // which is what proves the zone conversion is not off by an hour.
      expect(Math.abs((sent as Date).getTime() - expected)).toBeLessThan(2000);
    });

    it('imports orders with the currency of the market, never a TRY fallback', async () => {
      route({ 'order/read': () => ok([order()]) });

      const [imported] = await build().getOrders();

      expect(imported.currency).toBe('RON');
      expect(imported.source).toBe('emag');
      expect(imported.orderNumber).toBe('12345');
    });

    it('leaves the order number untouched when no prefix is configured', async () => {
      // Default is an empty string on purpose: a single-market install has
      // nothing to disambiguate.
      route({ 'order/read': () => ok([order()]) });

      const [imported] = await build().getOrders();

      expect(imported.orderNumber).toBe('12345');
    });

    it('applies the configured prefix on top of the mapper\'s bare id', async () => {
      route({ 'order/read': () => ok([order()]) });

      const [imported] = await build(CREDENTIALS, { 'orders.numberPrefix': 'EMG-RO-' }).getOrders();

      expect(imported.orderNumber).toBe('EMG-RO-12345');
    });

    it('drops only the broken order and imports the rest', async () => {
      // One unresolvable SKU must not cost the seller the whole sync.
      route({
        'order/read': () =>
          ok([
            order({ id: 1 }),
            order({ id: 2, products: [orderLine({ part_number: '', product_id: 8888 })] }),
            order({ id: 3 }),
          ]),
        'product_offer/read': () => ok([]),
      });

      const imported = await build().getOrders();

      expect(imported.map((o) => o.orderNumber)).toEqual(['1', '3']);
      expect(errors()).toMatch(/sipariş 2 içe aktarılamadı/i);
      expect(warnings()).toMatch(/1 tanesi/);
    });

    it('logs the mapper\'s SKU warnings even for an order that imported fine', async () => {
      route({
        'order/read': () => ok([order({ products: [orderLine({ part_number: '', product_id: 4001 })] })]),
        'product_offer/read': () => ok([offer()]),
      });

      const imported = await build().getOrders();

      expect(imported).toHaveLength(1);
      expect(imported[0].items[0].sku).toBe('SKU-1');
      expect(warnings()).toMatch(/SKU uyarıları/);
    });

    it('reads the full catalogue at most once per sync, and only when a SKU is missing', async () => {
      // Plan B while `product_offer/read` has no verified id filter: one full
      // read per sync, never one per order.
      const hits = route({
        'order/read': () =>
          ok([
            order({ id: 1, products: [orderLine({ part_number: '', product_id: 4001 })] }),
            order({ id: 2, products: [orderLine({ part_number: '', product_id: 4001 })] }),
            order({ id: 3, products: [orderLine({ part_number: '', product_id: 7777 })] }),
          ]),
        'product_offer/read': () => ok([offer()]),
      });

      const imported = await build().getOrders();

      expect(hits()['product_offer/read']).toBe(1);
      expect(imported.map((o) => o.orderNumber)).toEqual(['1', '2']);
    });

    it('never reads the catalogue when every line carries its own part_number', async () => {
      const hits = route({ 'order/read': () => ok([order(), order({ id: 2 })]) });

      await build().getOrders();

      expect(hits()['product_offer/read']).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------- stock

  describe('updateStock', () => {
    const saveBody = () => {
      const call = calls().find(([url]) => String(url).endsWith('product_offer/save'));
      return JSON.parse(call![1].body);
    };

    it('reads the offer and sends it back with only the stock line changed', async () => {
      route({
        'product_offer/read': () => ok([offer()]),
        'product_offer/save': () => ok([]),
      });

      const result = await build().updateStock('SKU-1', 7);

      expect(result).toEqual({ sku: 'SKU-1', quantity: 7, success: true });
      expect(saveBody()).toEqual([
        {
          id: 4001,
          status: 1,
          sale_price: 199.99,
          vat_id: 5,
          handling_time: [{ warehouse_id: 1, value: 1 }],
          stock: [{ warehouse_id: 1, value: 7 }],
        },
      ]);
    });

    it('sends no product documentation back with a stock write', async () => {
      // Echoing content we did not author is how a catalogue gets rewritten by
      // a stock sync.
      route({
        'product_offer/read': () => ok([offer()]),
        'product_offer/save': () => ok([]),
      });

      await build().updateStock('SKU-1', 7);

      const [payload] = saveBody();
      expect(payload).not.toHaveProperty('name');
      expect(payload).not.toHaveProperty('description');
      expect(payload).not.toHaveProperty('images');
      expect(payload).not.toHaveProperty('characteristics');
    });

    it('refuses instead of guessing warehouse 1 when the offer has no warehouse', async () => {
      route({ 'product_offer/read': () => ok([offer({ stock: [] })]) });

      const result = await build().updateStock('SKU-1', 7);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/depo \(warehouse\) tanımlı değil/i);
      expect(calls().some(([url]) => String(url).endsWith('save'))).toBe(false);
    });

    it('writes the first warehouse, leaves the others untouched, and says so', async () => {
      route({
        'product_offer/read': () =>
          ok([
            offer({
              stock: [
                { warehouse_id: 1, value: 3 },
                { warehouse_id: 2, value: 9 },
              ],
            }),
          ]),
        'product_offer/save': () => ok([]),
      });

      const result = await build().updateStock('SKU-1', 7);

      expect(result.success).toBe(true);
      expect(saveBody()[0].stock).toEqual([
        { warehouse_id: 1, value: 7 },
        { warehouse_id: 2, value: 9 },
      ]);
      expect(warnings()).toMatch(/2 depoya dağıtılmış/);
    });

    it('clamps above the 65535 field limit instead of sending an invalid request', async () => {
      // An invalid request burns the hourly penalty window.
      route({
        'product_offer/read': () => ok([offer()]),
        'product_offer/save': () => ok([]),
      });

      const result = await build().updateStock('SKU-1', 70000);

      expect(result).toEqual({ sku: 'SKU-1', quantity: 65535, success: true });
      expect(saveBody()[0].stock[0].value).toBe(65535);
      expect(warnings()).toMatch(/kırpıldı/i);
    });

    it('reports rather than throws when the offer does not exist', async () => {
      route({ 'product_offer/read': () => ok([]) });

      const result = await build().updateStock('MISSING', 3);

      expect(result).toEqual(
        expect.objectContaining({ sku: 'MISSING', quantity: 3, success: false }),
      );
      expect(result.error).toMatch(/teklif bulunamadı/i);
    });

    it('does not write when eMAG ignored the part_number filter', async () => {
      // A filter silently ignored would otherwise rewrite the first offer in the
      // catalogue.
      route({ 'product_offer/read': () => ok([offer({ part_number: 'SOMETHING-ELSE' })]) });

      const result = await build().updateStock('SKU-1', 3);

      expect(result.success).toBe(false);
      expect(calls().some(([url]) => String(url).endsWith('save'))).toBe(false);
    });

    it.each([
      ['a rejected envelope on save', { 'product_offer/read': () => ok([offer()]), 'product_offer/save': () => ({ isError: true, messages: ['stock value invalid'], results: [] }) }],
      ['a transport failure', { 'product_offer/read': () => { throw httpError(500); } }],
      ['a network outage', { 'product_offer/read': () => { throw new MarketplaceHttpError('Marketplace Request Timeout', HttpStatus.GATEWAY_TIMEOUT); } }],
      ['an unauthorised account', { 'product_offer/read': () => { throw httpError(401); } }],
    ])('reports instead of throwing on %s', async (_name, handlers) => {
      route(handlers as any);

      const result = await build().updateStock('SKU-1', 3);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).not.toContain(PASSWORD);
    });

    it('never throws even when the transport itself is broken', async () => {
      httpClient.request.mockImplementation(() => {
        throw new TypeError('fetch is not a function');
      });

      await expect(build().updateStock('SKU-1', 3)).resolves.toMatchObject({ success: false });
    });

    it('refuses an empty sku and a non-numeric quantity without calling eMAG', async () => {
      httpClient.request.mockResolvedValue(ok([]));

      await expect(build().updateStock('   ', 3)).resolves.toMatchObject({ success: false });
      await expect(build().updateStock('SKU-1', Number.NaN)).resolves.toMatchObject({ success: false });
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('spaces two offer saves even when they come from different connector instances', async () => {
      // `factory.create()` returns a new connector every call, so an instance
      // field would reset before the interval ever fired.
      route({
        'product_offer/read': () => ok([offer()]),
        'product_offer/save': () => ok([]),
      });

      await build().updateStock('SKU-1', 1);
      expect(sleepSpy).not.toHaveBeenCalled();

      await build().updateStock('SKU-1', 2);

      expect(sleepSpy).toHaveBeenCalledTimes(1);
      const waited = sleepSpy.mock.calls[0][0] as number;
      expect(waited).toBeGreaterThan(EMAG_MIN_OFFER_SAVE_INTERVAL_MS - 1000);
      expect(waited).toBeLessThanOrEqual(EMAG_MIN_OFFER_SAVE_INTERVAL_MS);
    });

    it('keeps one market\'s interval out of another\'s way', async () => {
      route({
        'product_offer/read': () => ok([offer()]),
        'product_offer/save': () => ok([]),
      });

      await build().updateStock('SKU-1', 1);
      await build({ ...CREDENTIALS, country: 'PL' }).updateStock('SKU-1', 1);

      expect(sleepSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------- categories

  describe('categories', () => {
    it('returns the category rows as read', async () => {
      route({ 'category/read': (_body, hit) => ok(hit === 1 ? [{ characteristics: [{ id: 1 }] }] : []) });

      const categories = await build().getCategories();

      expect(categories).toEqual([{ characteristics: [{ id: 1 }] }]);
    });

    it('returns a category\'s characteristics', async () => {
      route({ 'category/read': () => ok([{ characteristics: [{ id: 9, name: 'Renk' }] }]) });

      const attributes = await build().getCategoryAttributes('604');

      expect(attributes).toEqual([{ id: 9, name: 'Renk' }]);
      expect(bodyOf(0)).toMatchObject({ id: 604, itemsPerPage: 1 });
    });

    it('returns an empty list rather than throwing when the category has none', async () => {
      // The mapping screen renders "no attributes"; a NotImplemented would break it.
      route({ 'category/read': () => ok([]) });

      await expect(build().getCategoryAttributes('604')).resolves.toEqual([]);
    });

    it('rejects a non-numeric category id instead of reading the whole tree', async () => {
      await expect(build().getCategoryAttributes('elektronik')).rejects.toThrow(/tam sayı/i);
      expect(httpClient.request).not.toHaveBeenCalled();
    });
  });
});
