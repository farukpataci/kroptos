import { MarketplaceHttpClient, MarketplaceHttpError, classifyTransportFailure } from './MarketplaceHttpClient';

/**
 * The retry policy is the whole point of this file. n11 answers unrouted paths
 * with a malformed HTTP/1.1 response line; undici rejects it as a bare
 * "fetch failed" with no status, which the previous blanket rule read as
 * retryable — three attempts and ten seconds for a path that will never exist.
 *
 * So every line of the policy gets a test: what never repeats, what repeats
 * once, and what may never repeat because it might already have been applied.
 */
describe('MarketplaceHttpClient', () => {
  let client: MarketplaceHttpClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new MarketplaceHttpClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  // ---------------------------------------------------------------- helpers

  /** Shapes an undici failure: the reason lives in `cause`, not `message`. */
  const netError = (code: string | undefined, message: string) => {
    const cause: any = new Error(message);
    if (code) cause.code = code;
    const error: any = new TypeError('fetch failed');
    error.cause = cause;
    return error;
  };

  const PROTOCOL_ERROR = netError(
    undefined,
    'Response does not match the HTTP/1.1 protocol (Missing expected CR after response line)',
  );

  const answer = (status: number, body: string, contentType = 'application/json') => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 429 ? 'Too Many Requests' : 'Error',
    headers: { get: () => contentType },
    text: async () => body,
  });

  /** Never settles on its own; rejects only when the client's abort fires. */
  const hangs = () => (_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const error: any = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

  const call = (options: Record<string, unknown> = {}) =>
    client.request('https://api.n11.com/ms/order/list', { retries: 2, ...options });

  // ------------------------------------------------------- never retryable

  it('should not retry a malformed HTTP response', async () => {
    fetchMock.mockRejectedValue(PROTOCOL_ERROR);

    const error: any = await call().catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.failureKind).toBe('protocol');
    expect(error.message).toContain('geçersiz bir HTTP yanıtı');
    // The real reason has to reach the seller; "fetch failed" told them nothing.
    expect(error.message).toContain('Missing expected CR');
  });

  it('should not retry an HPE_ parser error', async () => {
    fetchMock.mockRejectedValue(netError('HPE_INVALID_CONSTANT', 'Parse Error'));

    const error: any = await call().catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.failureKind).toBe('protocol');
  });

  it('should not retry a TLS failure', async () => {
    fetchMock.mockRejectedValue(netError('CERT_HAS_EXPIRED', 'certificate has expired'));

    const error: any = await call().catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.failureKind).toBe('tls');
    expect(error.message).toContain('TLS/sertifika');
  });

  it('should not retry an unresolvable host', async () => {
    fetchMock.mockRejectedValue(netError('ENOTFOUND', 'getaddrinfo ENOTFOUND api.n11.invalid'));

    const error: any = await call().catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.failureKind).toBe('dns');
  });

  it('should not retry an invalid URL', async () => {
    fetchMock.mockRejectedValue(netError('ERR_INVALID_URL', 'Invalid URL'));

    const error: any = await call().catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.failureKind).toBe('url');
  });

  it('should not retry an unrecognised network failure', async () => {
    fetchMock.mockRejectedValue(netError('ESOMETHINGNEW', 'who knows'));

    const error: any = await call().catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.failureKind).toBe('unknown');
  });

  // --------------------------------------------- retryable once, reads only

  it.each(['ECONNRESET', 'EPIPE', 'ETIMEDOUT'])(
    'should retry %s once on a GET',
    async (code) => {
      fetchMock
        .mockRejectedValueOnce(netError(code, `read ${code}`))
        .mockResolvedValueOnce(answer(200, '{"ok":true}'));

      await expect(call({ method: 'GET' })).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('should retry a hung-up socket once on a GET', async () => {
    fetchMock
      .mockRejectedValueOnce(netError(undefined, 'socket hang up'))
      .mockResolvedValueOnce(answer(200, '{"ok":true}'));

    await expect(call({ method: 'GET' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should retry only once, never twice', async () => {
    fetchMock.mockRejectedValue(netError('ECONNRESET', 'read ECONNRESET'));

    await call({ method: 'GET', retries: 2 }).catch(() => null);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should not retry a reset on a POST without an idempotency key', async () => {
    fetchMock.mockRejectedValue(netError('ECONNRESET', 'read ECONNRESET'));

    const error: any = await call({ method: 'POST' }).catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.failureKind).toBe('reset');
  });

  it('should retry a POST that carries an idempotency key, and send the header', async () => {
    fetchMock
      .mockRejectedValueOnce(netError('ECONNRESET', 'read ECONNRESET'))
      .mockResolvedValueOnce(answer(200, '{"ok":true}'));

    await expect(call({ method: 'POST', idempotencyKey: 'abc-123' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0][1].headers as any)['Idempotency-Key']).toBe('abc-123');
  });

  // ------------------------------------------------------------- timeouts

  it('should retry a timed-out GET once', async () => {
    fetchMock.mockImplementation(hangs());

    // Budget deliberately far larger than the attempt needs. A tight one made
    // this test measure the machine: under a loaded parallel suite the first
    // abort could fire late enough to spend the budget, leaving no room for the
    // retry this test exists to prove. Budget exhaustion is pinned separately,
    // by the call count in the test below.
    const error: any = await call({ method: 'GET', timeout: 50, budgetMs: 5000 }).catch((e: any) => e);

    expect(error.failureKind).toBe('timeout');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should not retry a timed-out POST', async () => {
    fetchMock.mockImplementation(hangs());

    const error: any = await call({ method: 'POST', timeout: 80, budgetMs: 400 }).catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.failureKind).toBe('timeout');
    expect(error.message).toContain('zaman aşımına');
  });

  it('should stop starting attempts once the budget is spent', async () => {
    // The budget is shorter than one attempt, so the retry can never begin.
    fetchMock.mockImplementation(hangs());

    await call({ method: 'GET', timeout: 300, budgetMs: 100 }).catch(() => null);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------- HTTP answers

  it('should retry a 429 on a GET', async () => {
    fetchMock
      .mockResolvedValueOnce(answer(429, '{"error":"slow down"}'))
      .mockResolvedValueOnce(answer(200, '{"ok":true}'));

    await expect(call({ method: 'GET' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should retry a 503 on a GET', async () => {
    fetchMock
      .mockResolvedValueOnce(answer(503, 'upstream down'))
      .mockResolvedValueOnce(answer(200, '{"ok":true}'));

    await expect(call({ method: 'GET' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should not retry a 4xx', async () => {
    fetchMock.mockResolvedValue(answer(404, '{"message":"No handler found"}'));

    const error: any = await call({ method: 'GET' }).catch((e: any) => e);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.upstreamStatus).toBe(404);
    // The body is what names the rejected path or field, so it travels along.
    expect(error.upstreamBody).toContain('No handler found');
  });

  it('should not retry a 500 on a POST without an idempotency key', async () => {
    fetchMock.mockResolvedValue(answer(500, 'boom'));

    await call({ method: 'POST' }).catch(() => null);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------- non-JSON bodies

  it('should turn a 200 that is not JSON into a readable error, without retrying', async () => {
    const page = '<html><head></head><body><h1>Application is not available</h1></body></html>';
    fetchMock.mockResolvedValue(answer(200, page, 'text/html'));

    const error: any = await call({ method: 'GET' }).catch((e: any) => e);

    expect(error).toBeInstanceOf(MarketplaceHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.message).toContain('yanıt JSON değil');
    expect(error.message).toContain('Application is not available');
    // Kept whole so describeUpstreamBody can recognise it as a gateway page.
    expect(error.upstreamBody).toContain('<html>');
    expect(error.upstreamStatus).toBe(200);
  });

  it('should accept an empty body as a valid answer', async () => {
    fetchMock.mockResolvedValue(answer(204, ''));

    await expect(call({ method: 'POST' })).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------- message

  it('should name the method and path in every failure message', async () => {
    fetchMock.mockRejectedValue(PROTOCOL_ERROR);

    const error: any = await call({ method: 'POST' }).catch((e: any) => e);

    expect(error.message).toContain('POST');
    expect(error.message).toContain('api.n11.com/ms/order/list');
  });

  it('should keep the query string out of the message', async () => {
    fetchMock.mockRejectedValue(PROTOCOL_ERROR);

    const error: any = await client
      .request('https://api.n11.com/cdn/categories?appKey=secret-key', { retries: 2 })
      .catch((e: any) => e);

    expect(error.message).not.toContain('secret-key');
  });

  // ------------------------------------------------------- classification

  it('should classify a bare abort as a timeout', () => {
    const aborted: any = new Error('aborted');
    aborted.name = 'AbortError';

    expect(classifyTransportFailure(aborted)).toBe('timeout');
  });
});
