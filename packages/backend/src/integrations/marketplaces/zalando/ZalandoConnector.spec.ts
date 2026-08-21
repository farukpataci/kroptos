import { HttpStatus } from '@nestjs/common';
import { ZalandoConnector } from './ZalandoConnector';
import { MarketplaceHttpClient, MarketplaceHttpError } from '../core/MarketplaceHttpClient';
import { MarketplaceRateLimiter } from '../core/MarketplaceRateLimiter';

/**
 * The authentication half is pinned against Zalando's published Authentication
 * OpenAPI spec, fetched from Zalando itself, so those cases describe verified
 * behaviour.
 *
 * The orders and stocks half is pinned against the zDirect OpenAPI documents
 * for those APIs, which had to come from a public mirror — Zalando serves only
 * the authentication spec. These tests therefore prove the connector matches
 * the spec it was written from; they do not prove the spec matches the live
 * API. That distinction is why the provider is still unregistered.
 *
 * Operations with no spec at all still refuse, and those cases exist so the
 * gap fails loudly rather than silently syncing nothing.
 */
describe('ZalandoConnector', () => {
  const CREDENTIALS = {
    clientId: 'client-1',
    clientSecret: 'secret-1',
    merchantId: 'merchant-9',
    salesChannelId: 'fc0aba96-7802-11e5-9e27-10ddb1ee7671',
  };

  let httpClient: { request: jest.Mock };
  let rateLimiter: { throttle: jest.Mock };

  const build = (credentials: Record<string, any> = CREDENTIALS, settings: Record<string, unknown> = {}) =>
    new ZalandoConnector(
      credentials,
      httpClient as unknown as MarketplaceHttpClient,
      rateLimiter as unknown as MarketplaceRateLimiter,
      settings,
    );

  const calls = () => httpClient.request.mock.calls;
  const lastCall = () => calls()[calls().length - 1];
  const tokenCall = () => calls().find((c) => String(c[0]).includes('/auth/token'));

  const mockTokenThen = (payload: unknown) => {
    httpClient.request
      .mockResolvedValueOnce({ access_token: 'access-1', token_type: 'Bearer', expires_in: 3600 })
      .mockResolvedValue(payload);
  };

  beforeEach(() => {
    httpClient = { request: jest.fn() };
    rateLimiter = { throttle: jest.fn().mockResolvedValue(undefined) };
  });

  describe('OAuth2 client credentials', () => {
    it('posts the client-credentials grant to the documented token path', async () => {
      mockTokenThen({ bpids: ['merchant-9'], scopes: [] });

      await build().testConnection();

      const [url, options] = tokenCall()!;
      expect(url).toBe('https://api.merchants.zalando.com/auth/token');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(options.body).toContain('grant_type=client_credentials');
    });

    it('authenticates the token call with Basic, not the bearer', async () => {
      mockTokenThen({ bpids: [], scopes: [] });

      await build().testConnection();

      expect(tokenCall()![1].headers.Authorization).toBe(
        `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`,
      );
    });

    it('sends the access token as a bearer on the business call', async () => {
      mockTokenThen({ bpids: [], scopes: [] });

      await build().testConnection();

      expect(lastCall()[1].headers.Authorization).toBe('Bearer access-1');
    });

    it('attaches a flow id so a failure can be quoted to Zalando support', async () => {
      mockTokenThen({ bpids: [], scopes: [] });

      await build().testConnection();

      expect(lastCall()[1].headers['X-Flow-Id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reuses the token instead of exchanging on every call', async () => {
      mockTokenThen({ bpids: [], scopes: [] });

      const connector = build();
      await connector.testConnection();
      await connector.testConnection();

      expect(calls().filter((c) => String(c[0]).includes('/auth/token'))).toHaveLength(1);
    });

    it('targets the sandbox host when the environment says so', async () => {
      mockTokenThen({ bpids: [], scopes: [] });

      await build(CREDENTIALS, { 'general.environment': 'sandbox' }).testConnection();

      expect(tokenCall()![0]).toBe('https://api-sandbox.merchants.zalando.com/auth/token');
    });

    it('mentions sandbox mode when the token exchange fails', async () => {
      // New zDirect apps default to sandbox, which is the most common reason a
      // correct-looking client id fails against production.
      httpClient.request.mockRejectedValue(
        new MarketplaceHttpError('failed', HttpStatus.BAD_GATEWAY, 401),
      );

      const result = await build().testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/sandbox/i);
    });

    it('separates throttling per environment and merchant', async () => {
      mockTokenThen({ bpids: [], scopes: [] });

      await build().testConnection();
      await build(CREDENTIALS, { 'general.environment': 'sandbox' }).testConnection();
      await build({ ...CREDENTIALS, merchantId: 'merchant-2' }).testConnection();

      expect(new Set(rateLimiter.throttle.mock.calls.map((c) => c[0])).size).toBe(3);
    });
  });

  describe('testConnection', () => {
    it('proves the credentials through the identity endpoint', async () => {
      mockTokenThen({ bpids: ['merchant-9'], scopes: ['orders.read', 'products/stock/write'] });

      const result = await build().testConnection();

      expect(result.success).toBe(true);
      expect(lastCall()[0]).toBe('https://api.merchants.zalando.com/auth/me');
      expect(result.message).toContain('merchant-9');
      expect(result.message).toContain('2');
    });

    it('reads the merchant id from bpids, which is where the spec puts it', async () => {
      // There is no `merchant_id` field on /auth/me. An earlier version read one
      // and would have reported "no merchant" against every real account.
      mockTokenThen({ bpids: ['bp-1'], scopes: [] });

      const result = await build({ ...CREDENTIALS, merchantId: 'bp-1' }).testConnection();

      expect(result.message).toContain('bp-1');
    });

    it('rejects a merchant id the token is not authorised for', async () => {
      // Otherwise a typo surfaces much later as a 403 on the first sync, which
      // reads like a permissions problem rather than a wrong id.
      mockTokenThen({ bpids: ['bp-1', 'bp-2'], scopes: [] });

      const result = await build({ ...CREDENTIALS, merchantId: 'bp-9' }).testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('bp-9');
      expect(result.message).toContain('bp-1, bp-2');
    });

    it('does not depend on any business path', async () => {
      mockTokenThen({ bpids: [], scopes: [] });

      await build().testConnection();

      // Only the token and identity calls — both verified against Zalando's own
      // published spec.
      expect(calls().map((c) => String(c[0]))).toEqual([
        'https://api.merchants.zalando.com/auth/token',
        'https://api.merchants.zalando.com/auth/me',
      ]);
    });
  });

  describe('getOrders', () => {
    const document = {
      data: [
        {
          type: 'order',
          id: 'o1',
          attributes: {
            order_id: 'o1',
            order_number: '1040970000502251',
            status: 'approved',
            order_lines_price_amount: 156,
            order_lines_price_currency: 'EUR',
            shipping_costs: { amount: 4.95, currency: 'EUR' },
            customer_email: 'ada@example.com',
            customer_phone: { number: '9876543210' },
            shipping_address: {
              first_name: 'Ada',
              last_name: 'Lovelace',
              address_line_1: 'Charles Street 1337',
              zip_code: '10178',
              city: 'Berlin',
              country_code: 'DE',
            },
          },
        },
      ],
      included: [
        {
          type: 'order_item',
          id: 'i1',
          attributes: {
            order_item_id: 'i1',
            order_id: 'o1',
            article_id: 'DU341A00M-1020375000',
            external_id: 'SKU-1',
            description: 'Dress',
            quantity_initial: 2,
          },
        },
        {
          type: 'order_line',
          id: 'l1',
          attributes: {
            order_line_id: 'l1',
            order_item_id: 'i1',
            status: 'reserved',
            price: { amount: 78, currency: 'EUR' },
          },
        },
        {
          type: 'order_line',
          id: 'l2',
          attributes: {
            order_line_id: 'l2',
            order_item_id: 'i1',
            status: 'reserved',
            price: { amount: 78, currency: 'EUR' },
          },
        },
      ],
    };

    it('requires the merchant id, which is a path parameter', async () => {
      const { merchantId, ...without } = CREDENTIALS;
      mockTokenThen({ data: [] });

      await expect(build(without).getOrders()).rejects.toThrow(/merchantId/);
    });

    it('asks for JSON:API and pulls in the items and lines', async () => {
      // An order carries no line detail and no money of its own; without the
      // include it comes back empty.
      mockTokenThen(document);

      await build().getOrders();

      const [url, options] = lastCall();
      expect(options.headers.Accept).toBe('application/vnd.api+json');
      expect(url).toContain('include=order_items%2Corder_lines');
    });

    it('paginates with the JSON:API bracket parameters, not limit and offset', async () => {
      mockTokenThen(document);

      await build().getOrders();

      const url = String(lastCall()[0]);
      expect(url).toContain('page%5Bnumber%5D=0');
      expect(url).toContain('page%5Bsize%5D=50');
      expect(url).not.toContain('offset');
    });

    it('scopes the query to the configured sales channel', async () => {
      mockTokenThen(document);

      await build().getOrders();

      expect(String(lastCall()[0])).toContain(
        `sales_channel_id=${CREDENTIALS.salesChannelId}`,
      );
    });

    it('joins the included items and lines onto the order', async () => {
      mockTokenThen(document);

      const [unified] = await build().getOrders();

      expect(unified).toMatchObject({
        orderNumber: '1040970000502251',
        customerName: 'Ada Lovelace',
        customerEmail: 'ada@example.com',
        customerPhone: '9876543210',
        status: 'processing',
        currency: 'EUR',
        source: 'zalando',
      });
      expect(unified.items).toEqual([
        { sku: 'SKU-1', name: 'Dress', quantity: 2, unitPrice: 78, totalPrice: 156 },
      ]);
    });

    it('reads amounts as major units rather than cents', async () => {
      // The opposite of Temu, and the most damaging thing here to get wrong.
      mockTokenThen(document);

      expect((await build().getOrders())[0].items[0].unitPrice).toBe(78);
    });

    it('adds the shipping charge to the goods total', async () => {
      // order_lines_price_amount covers the lines only, so it alone would
      // under-report every order that charged for delivery.
      mockTokenThen(document);

      expect((await build().getOrders())[0].totalAmount).toBe(160.95);
    });

    it('prefers the merchant identifier over Zalando article id for the sku', async () => {
      mockTokenThen(document);

      expect((await build().getOrders())[0].items[0].sku).toBe('SKU-1');
    });

    it('falls back to the article id when the merchant did not supply one', async () => {
      const included = [
        { ...document.included[0], attributes: { ...document.included[0].attributes, external_id: undefined } },
        document.included[1],
        document.included[2],
      ];
      mockTokenThen({ ...document, included });

      expect((await build().getOrders())[0].items[0].sku).toBe('DU341A00M-1020375000');
    });

    it('reports a fully cancelled order as cancelled, which the order status cannot say', async () => {
      // Zalando's OrderStatus enum has no cancelled value at all — cancellation
      // only exists per order line, so without this an order stays processing.
      const included = [
        document.included[0],
        { ...document.included[1], attributes: { ...document.included[1].attributes, status: 'canceled' } },
        { ...document.included[2], attributes: { ...document.included[2].attributes, status: 'canceled' } },
      ];
      mockTokenThen({ ...document, included });

      const [unified] = await build().getOrders();

      expect(unified.status).toBe('cancelled');
      expect(unified.paymentStatus).toBe('failed');
    });

    it('maps fulfilled to shipped rather than delivered', async () => {
      const data = [
        { ...document.data[0], attributes: { ...document.data[0].attributes, status: 'fulfilled' } },
      ];
      mockTokenThen({ ...document, data });

      expect((await build().getOrders())[0].status).toBe('shipped');
    });

    it('leaves an unknown status as pending instead of guessing', async () => {
      const data = [
        { ...document.data[0], attributes: { ...document.data[0].attributes, status: 'SOMETHING_NEW' } },
      ];
      mockTokenThen({ ...document, data });

      expect((await build().getOrders())[0].status).toBe('pending');
    });

    it('does not invent a currency when the payload omits one', async () => {
      const data = [
        {
          ...document.data[0],
          attributes: {
            ...document.data[0].attributes,
            order_lines_price_currency: undefined,
            shipping_costs: undefined,
          },
        },
      ];
      mockTokenThen({ ...document, data });

      expect((await build().getOrders())[0].currency).toBe('');
    });

    it('applies the configured status filter', async () => {
      mockTokenThen(document);

      const orders = await build(CREDENTIALS, { 'orders.importStatuses': ['shipped'] }).getOrders();

      expect(orders).toEqual([]);
    });
  });

  describe('updateStock', () => {
    const EAN = '5901234123457';

    it('sends the EAN and sales channel the stock API keys on', async () => {
      mockTokenThen({ results: [{ result: { status: 'ACCEPTED', code: 0 } }] });

      const result = await build().updateStock(EAN, 25);

      const [url, options] = lastCall();
      expect(url).toBe('https://api.merchants.zalando.com/merchants/merchant-9/stocks');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        items: [{ sales_channel_id: CREDENTIALS.salesChannelId, ean: EAN, quantity: 25 }],
      });
      expect(result.success).toBe(true);
    });

    it('refuses a merchant SKU, because Zalando matches stock on EAN only', async () => {
      const result = await build().updateStock('SKU-1', 5);

      expect(result).toMatchObject({ sku: 'SKU-1', quantity: 5, success: false });
      expect(result.error).toMatch(/GTIN-13/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('says which credential is missing rather than calling without it', async () => {
      const { salesChannelId, ...without } = CREDENTIALS;

      const result = await build(without).updateStock(EAN, 5);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Satış Kanalı/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('reads the per-item verdict out of the 207 body', async () => {
      // The HTTP call succeeds even when the update is rejected, so a status
      // code alone would report every rejection as a success.
      mockTokenThen({
        results: [{ result: { status: 'REJECTED', code: 101, description: 'EAN is not onboarded' } }],
      });

      const result = await build().updateStock(EAN, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('EAN is not onboarded');
    });

    it('treats an empty results array as a failure rather than a success', async () => {
      mockTokenThen({ results: [] });

      expect((await build().updateStock(EAN, 5)).success).toBe(false);
    });

    it('reports a transport failure rather than throwing, so one SKU cannot abort a sync', async () => {
      httpClient.request
        .mockResolvedValueOnce({ access_token: 'access-1', expires_in: 3600 })
        .mockRejectedValue(new MarketplaceHttpError('boom', HttpStatus.BAD_GATEWAY, 500));

      const result = await build().updateStock(EAN, 5);

      expect(result).toMatchObject({ sku: EAN, quantity: 5, success: false });
      expect(result.error).toBeTruthy();
    });
  });

  describe('outlines (categories)', () => {
    const OUTLINE = {
      label: 'shoe',
      name: { en: 'Shoe', de: 'Schuh' },
      tiers: {
        model: {
          mandatory_types: ['brand'],
          optional_types: ['care_instructions'],
          restricted_attributes: [{ type: { label: 'brand' }, values: ['Nike', 'Adidas'] }],
        },
        config: {
          mandatory_types: ['color'],
          optional_types: [],
          restricted_attributes: [{ type: { label: 'color' }, values: ['black', 'white'] }],
        },
        simple: { mandatory_types: ['size'], optional_types: [], restricted_attributes: [] },
      },
    };

    it('reads the outlines path for the configured merchant', async () => {
      mockTokenThen({ items: [OUTLINE] });

      const categories = await build().getCategories();

      expect(lastCall()[0]).toBe('https://api.merchants.zalando.com/merchants/merchant-9/outlines');
      // Outlines are a flat list — there is no tree to descend.
      expect(categories).toEqual([{ id: 'shoe', name: 'Shoe', parentId: null }]);
    });

    it('falls back to the label rather than showing an unselectable blank row', async () => {
      mockTokenThen({ items: [{ label: 'shirt' }, { label: 'bag', name: { de: 'Tasche' } }] });

      const categories = await build().getCategories();

      expect(categories.map((c) => c.name)).toEqual(['shirt', 'Tasche']);
    });

    it('asks for one outline by label and encodes it', async () => {
      mockTokenThen({ items: [OUTLINE] });

      await build().getCategoryAttributes('sports shoe');

      expect(lastCall()[0]).toBe(
        'https://api.merchants.zalando.com/merchants/merchant-9/outlines/sports%20shoe',
      );
    });

    it('marks what varies between variants and what is mandatory', async () => {
      mockTokenThen({ items: [OUTLINE] });

      const result = await build().getCategoryAttributes('shoe');
      const by = (label: string) =>
        result.categoryAttributes.find((a: any) => a.attribute.id === label);

      // Tiers ARE Zalando's variant model: below `model` is per-variant.
      expect(by('brand')).toMatchObject({ required: true, variability: 'UNIFIED' });
      expect(by('color')).toMatchObject({ required: true, variability: 'VARIANTS' });
      expect(by('size')).toMatchObject({ required: true, variability: 'VARIANTS' });
      expect(by('care_instructions')).toMatchObject({ required: false, variability: 'UNIFIED' });
    });

    it('offers the restricted values and leaves unrestricted types free text', async () => {
      mockTokenThen({ items: [OUTLINE] });

      const result = await build().getCategoryAttributes('shoe');
      const by = (label: string) =>
        result.categoryAttributes.find((a: any) => a.attribute.id === label);

      expect(by('color').attributeValues).toEqual([
        { id: 'black', name: 'black' },
        { id: 'white', name: 'white' },
      ]);
      expect(by('color').allowCustom).toBe(false);
      // No restriction listed for `size`, so the seller may type a value.
      expect(by('size')).toMatchObject({ allowCustom: true, attributeValues: [] });
    });

    it('fails instead of returning an empty attribute set for an unknown outline', async () => {
      mockTokenThen({ items: [] });

      await expect(build().getCategoryAttributes('nope')).rejects.toThrow(/bulunamadı/);
    });

    it('matches on the label rather than trusting the first row', async () => {
      // An endpoint that ignores an unknown label and answers with the whole
      // list would otherwise show a different outline's attributes silently.
      mockTokenThen({ items: [{ label: 'bag' }, OUTLINE] });

      const result = await build().getCategoryAttributes('shoe');

      expect(result.id).toBe('shoe');
    });

    it('accepts a bare outline, since this envelope came from the mirror', async () => {
      mockTokenThen(OUTLINE);

      const result = await build().getCategoryAttributes('shoe');

      expect(result.id).toBe('shoe');
    });

    it('drops outlines with no label instead of listing a blank row', async () => {
      mockTokenThen({ items: [OUTLINE, { name: { en: 'Nameless' } }] });

      expect(await build().getCategories()).toEqual([
        { id: 'shoe', name: 'Shoe', parentId: null },
      ]);
    });

    it('encodes the merchant id too, so a stray credential cannot move the path', async () => {
      mockTokenThen({ items: [] });

      await build({ ...CREDENTIALS, merchantId: 'a/../b' }).getCategories();

      expect(lastCall()[0]).toBe(
        'https://api.merchants.zalando.com/merchants/a%2F..%2Fb/outlines',
      );
    });
  });

  describe('product listing, which zDirect does not publish', () => {
    it('refuses rather than reporting an empty catalogue as a successful pull', async () => {
      // Point lookup by EAN exists; enumeration does not. Returning [] here
      // would let a sync record "0 products" as a healthy result.
      await expect(build().getProducts()).rejects.toThrow(/EAN/);
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('warns about the two Zalando models in the refusal', async () => {
      // zDirect and Connected Retail are different products with different
      // protocols; picking the wrong one is the expensive mistake here.
      await expect(build().getProducts()).rejects.toThrow(/Connected Retail/);
    });
  });
});
