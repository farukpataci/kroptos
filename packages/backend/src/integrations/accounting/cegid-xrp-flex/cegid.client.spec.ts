import { AccountingRateLimitError } from '../core/AccountingErrors';
import { CegidHttpClient } from './cegid.client';

describe('CegidHttpClient', () => {
  const instanceUrl = 'https://tenant1.cegid.cloud';
  let client: CegidHttpClient;

  beforeEach(() => {
    client = new CegidHttpClient({
      instanceUrl,
      branchId: 'PROD',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should enforce strict serialization (concurrency 1)', async () => {
    const order: number[] = [];

    // Mock fetch with artificial delays
    let callCount = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      const current = ++callCount;
      await new Promise((r) => setTimeout(r, current === 1 ? 50 : 10));
      order.push(current);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: current }),
      } as any;
    });

    const p1 = client.request({
      method: 'GET',
      pathOrUrl: '/entity/Default/22.200.001/Customer',
    });
    const p2 = client.request({
      method: 'GET',
      pathOrUrl: '/entity/Default/22.200.001/SalesInvoice',
    });

    await Promise.all([p1, p2]);

    // Request 1 must finish before request 2 starts
    expect(order).toEqual([1, 2]);
  });

  it('should block requests to foreign hosts', async () => {
    await expect(
      client.request({
        method: 'GET',
        pathOrUrl: 'https://evil-server.com/malicious',
      }),
    ).rejects.toThrow();
  });

  it('should include PX-Branch header when branchId is configured', async () => {
    let capturedHeaders: any = {};
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init: any) => {
      capturedHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      } as any;
    });

    await client.request({
      method: 'GET',
      pathOrUrl: '/entity/Default/22.200.001/Customer',
    });

    expect(capturedHeaders['PX-Branch']).toBe('PROD');
  });

  it('should throw AccountingRateLimitError on persistent 429', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '1' }),
      text: async () => 'Rate limit exceeded',
    } as any);

    await expect(
      client.request({
        method: 'GET',
        pathOrUrl: '/entity/Default/22.200.001/Customer',
      }),
    ).rejects.toThrow(AccountingRateLimitError);
  }, 10000);
});
