import { AccountingAuthError } from '../core/AccountingErrors';
import { AccountingTokenStore } from '../core/AccountingTokenStore';
import { SageAuth } from './sage.auth';
import { SageCredentials } from './sage.types';

describe('SageAuth (§4.1 Rotating Refresh Token & Concurrency)', () => {
  let tokenStore: AccountingTokenStore;

  beforeEach(() => {
    tokenStore = new AccountingTokenStore();
    process.env.SAGE_CLIENT_ID = 'test-sage-client-id';
    process.env.SAGE_CLIENT_SECRET = 'test-sage-client-secret';
  });

  afterEach(() => {
    delete process.env.SAGE_CLIENT_ID;
    delete process.env.SAGE_CLIENT_SECRET;
  });

  it('1. 5 eşzamanlı istek → 1 token yenileme çağrısı (tek uçuşlu / single-flight)', async () => {
    let networkCallCount = 0;
    const mockFetch = jest.fn().mockImplementation(async () => {
      networkCallCount++;
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: `token_${networkCallCount}`,
          refresh_token: `refresh_${networkCallCount}`,
          expires_in: 300,
        }),
      } as any;
    });

    const saveTokensFn = jest.fn().mockResolvedValue(undefined);
    const auth = new SageAuth(tokenStore, saveTokensFn);

    const creds: SageCredentials = {
      businessId: 'biz-123',
      refreshToken: 'initial_refresh_token',
    };

    // Fire 5 concurrent getAccessToken calls
    const results = await Promise.all([
      auth.getAccessToken('int-1', creds, mockFetch),
      auth.getAccessToken('int-1', creds, mockFetch),
      auth.getAccessToken('int-1', creds, mockFetch),
      auth.getAccessToken('int-1', creds, mockFetch),
      auth.getAccessToken('int-1', creds, mockFetch),
    ]);

    // All 5 should receive the exact same token
    expect(results).toEqual([
      'token_1',
      'token_1',
      'token_1',
      'token_1',
      'token_1',
    ]);
    // Exactly 1 network refresh call was made
    expect(networkCallCount).toBe(1);
    expect(saveTokensFn).toHaveBeenCalledTimes(1);
    expect(saveTokensFn).toHaveBeenCalledWith('int-1', {
      accessToken: 'token_1',
      refreshToken: 'refresh_1',
      expiresAt: expect.any(Number),
    });
  });

  it('2. Yenileme sırası katıdır: yenile → yeni refresh yaz (commit) → sonra istek', async () => {
    const callOrder: string[] = [];

    const mockFetch = jest.fn().mockImplementation(async () => {
      callOrder.push('1_HTTP_TOKEN_REFRESH');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new_acc_token',
          refresh_token: 'new_ref_token',
          expires_in: 300,
        }),
      } as any;
    });

    const saveTokensFn = jest.fn().mockImplementation(async () => {
      callOrder.push('2_DB_COMMIT_TOKENS');
    });

    const auth = new SageAuth(tokenStore, saveTokensFn);
    const creds: SageCredentials = {
      businessId: 'biz-123',
      refreshToken: 'old_ref_token',
    };

    await auth.executeWithAuth(
      'int-1',
      creds,
      async (token) => {
        callOrder.push(`3_EXECUTE_API_REQUEST_${token}`);
        return 'success';
      },
      mockFetch,
    );

    expect(callOrder).toEqual([
      '1_HTTP_TOKEN_REFRESH',
      '2_DB_COMMIT_TOKENS',
      '3_EXECUTE_API_REQUEST_new_acc_token',
    ]);
  });

  it('3. Yazma başarısız olursa API isteği ATILMAZ ve hata yükselir (§4.1 kural 3)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'token_x',
        refresh_token: 'refresh_x',
        expires_in: 300,
      }),
    } as any);

    const saveTokensFn = jest.fn().mockRejectedValue(new Error('DB Connection Dropped'));
    const auth = new SageAuth(tokenStore, saveTokensFn);

    const creds: SageCredentials = {
      businessId: 'biz-123',
      refreshToken: 'old_ref_token',
    };

    const apiRequestSpy = jest.fn();

    await expect(
      auth.executeWithAuth('int-1', creds, apiRequestSpy, mockFetch),
    ).rejects.toThrow(/Yeni Sage refresh token veri tabanına kaydedilemedi/);

    // Crucial: The downstream API call was NEVER made with an uncommitted/dead token
    expect(apiRequestSpy).not.toHaveBeenCalled();
    // Cache was cleared to prevent subsequent usage of dead token
    expect(tokenStore.getToken('sage_token_int-1')).toBeUndefined();
  });

  it('4. Yeni refresh token yazıldıktan sonra eski değer güncellenir', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'acc_2',
        refresh_token: 'ref_2',
        expires_in: 300,
      }),
    } as any);

    let savedRefreshToken = '';
    const saveTokensFn = jest.fn().mockImplementation(async (_id, tokens) => {
      savedRefreshToken = tokens.refreshToken;
    });

    const auth = new SageAuth(tokenStore, saveTokensFn);
    const creds: SageCredentials = {
      businessId: 'biz-123',
      refreshToken: 'ref_1',
    };

    await auth.getAccessToken('int-1', creds, mockFetch);
    expect(savedRefreshToken).toBe('ref_2');
    expect(creds.refreshToken).toBe('ref_2');
  });

  it('5. invalid_grant hatası alındığında retry YAPILMAZ ve "yeniden yetkilendirme gerekli" işaretlenir', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'The provided refresh token is expired or revoked.',
      }),
    } as any);

    const markReauthSpy = jest.fn().mockResolvedValue(undefined);
    const auth = new SageAuth(tokenStore, undefined, markReauthSpy);

    const creds: SageCredentials = {
      businessId: 'biz-123',
      refreshToken: 'dead_refresh_token',
    };

    await expect(auth.getAccessToken('int-1', creds, mockFetch)).rejects.toThrow(
      /REAUTHORIZATION_REQUIRED/,
    );

    // Must be marked for reauthorization in persistence layer
    expect(markReauthSpy).toHaveBeenCalledTimes(1);
    expect(markReauthSpy).toHaveBeenCalledWith(
      'int-1',
      expect.stringContaining('invalid_grant'),
    );
    // Token endpoint was called exactly once, no retry loops
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('6. 401 Unauthorized alındığında 1 kez yenilenir, 1 kez tekrarlanır (sonsuz döngü koruması)', async () => {
    let tokenRequestCount = 0;
    const mockFetch = jest.fn().mockImplementation(async () => {
      tokenRequestCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: `token_v${tokenRequestCount}`,
          refresh_token: `refresh_v${tokenRequestCount}`,
          expires_in: 300,
        }),
      } as any;
    });

    const auth = new SageAuth(tokenStore);
    const creds: SageCredentials = {
      businessId: 'biz-123',
      accessToken: 'initial_expired_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Date.now() + 100000,
    };

    let apiAttempt = 0;
    const apiCall = jest.fn().mockImplementation(async (token: string) => {
      apiAttempt++;
      if (apiAttempt === 1) {
        const err: any = new Error('Unauthorized');
        err.status = 401;
        throw err;
      }
      return `result_with_${token}`;
    });

    const res = await auth.executeWithAuth('int-1', creds, apiCall, mockFetch);
    expect(res).toBe('result_with_token_v1');
    expect(apiCall).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('7. 401 tekrar ederse sonsuz döngüye girilmez, hata fırlatılır', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'fresh_token',
        refresh_token: 'fresh_refresh',
        expires_in: 300,
      }),
    } as any);

    const auth = new SageAuth(tokenStore);
    const creds: SageCredentials = {
      businessId: 'biz-123',
      accessToken: 'expired_token',
      refreshToken: 'valid_refresh_token',
      expiresAt: Date.now() + 100000,
    };

    const persistent401 = jest.fn().mockImplementation(async () => {
      const err: any = new Error('Persistent 401');
      err.status = 401;
      throw err;
    });

    await expect(
      auth.executeWithAuth('int-1', creds, persistent401, mockFetch),
    ).rejects.toThrow('Persistent 401');

    // Retried exactly once, then stopped
    expect(persistent401).toHaveBeenCalledTimes(2);
  });

  it('8. Client Secret hata mesajlarında ASLA sızdırılmaz', () => {
    delete process.env.SAGE_CLIENT_SECRET;
    const auth = new SageAuth(tokenStore);

    expect(() => auth.resolveAppCredentials({})).toThrow(
      'Sage OAuth2 kimlik bilgileri (Client ID / Client Secret) yapılandırılmamış.',
    );
  });
});
