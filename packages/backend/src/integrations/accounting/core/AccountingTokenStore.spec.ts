import { AccountingTokenStore } from './AccountingTokenStore';
import { RefreshSemantics } from './AccountingTokenSemantics';
import { AccountingAuthError } from './AccountingErrors';

describe('AccountingTokenStore (§4.1 / §1 Phase 0 Core Promoted Rotating Refresh Token)', () => {
  let store: AccountingTokenStore;

  beforeEach(() => {
    store = new AccountingTokenStore();
    jest.clearAllMocks();
  });

  const zeroGraceSemantics: RefreshSemantics = {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 0,
    inactivityLimitDays: 31,
    staleTokenUseIsDestructive: false,
  };

  const xeroGraceSemantics: RefreshSemantics = {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 1_800_000, // 30 minutes
    inactivityLimitDays: 60,
    staleTokenUseIsDestructive: false,
  };

  const destructiveSemantics: RefreshSemantics = {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 0,
    inactivityLimitDays: 100,
    staleTokenUseIsDestructive: true,
  };

  const destructiveWithGraceSemantics: RefreshSemantics = {
    rotatesOnRefresh: true,
    previousTokenGraceMs: 1_800_000, // grace is declared but should be overridden by destructive=true
    inactivityLimitDays: 100,
    staleTokenUseIsDestructive: true,
  };

  it('1. 5 concurrent calls result in single-flight (1 refresh call)', async () => {
    let callCount = 0;
    const refreshCall = jest.fn(async (rt: string) => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return {
        accessToken: `access-${rt}-${callCount}`,
        refreshToken: `refresh-${rt}-${callCount}`,
        expiresIn: 3600,
      };
    });

    const results = await Promise.all([
      store.rotateTokenWithPolicy({
        key: 'int-1',
        provider: 'test-provider',
        semantics: zeroGraceSemantics,
        currentRefreshToken: 'initial-token',
        refreshCall,
      }),
      store.rotateTokenWithPolicy({
        key: 'int-1',
        provider: 'test-provider',
        semantics: zeroGraceSemantics,
        currentRefreshToken: 'initial-token',
        refreshCall,
      }),
      store.rotateTokenWithPolicy({
        key: 'int-1',
        provider: 'test-provider',
        semantics: zeroGraceSemantics,
        currentRefreshToken: 'initial-token',
        refreshCall,
      }),
      store.rotateTokenWithPolicy({
        key: 'int-1',
        provider: 'test-provider',
        semantics: zeroGraceSemantics,
        currentRefreshToken: 'initial-token',
        refreshCall,
      }),
      store.rotateTokenWithPolicy({
        key: 'int-1',
        provider: 'test-provider',
        semantics: zeroGraceSemantics,
        currentRefreshToken: 'initial-token',
        refreshCall,
      }),
    ]);

    expect(callCount).toBe(1);
    expect(results[0].accessToken).toBe('access-initial-token-1');
    expect(results[1].accessToken).toBe(results[0].accessToken);
  });

  it('2. Save failure aborts and does NOT cache tokens', async () => {
    const refreshCall = jest.fn(async () => ({
      accessToken: 'new-acc',
      refreshToken: 'new-ref',
      expiresIn: 3600,
    }));

    const saveTokensFn = jest.fn(async () => {
      throw new Error('Database locked');
    });

    await expect(
      store.rotateTokenWithPolicy({
        key: 'int-2',
        provider: 'xero',
        providerDisplayName: 'Xero',
        semantics: zeroGraceSemantics,
        currentRefreshToken: 'curr-ref',
        refreshCall,
        saveTokensFn,
      }),
    ).rejects.toThrow(/Yeni Xero refresh token veri tabanına kaydedilemedi \(Database locked\)/);

    expect(store.getToken('int-2')).toBeUndefined();
  });

  it('3. Zero grace semantics aborts immediately on first error without retrying', async () => {
    let attempts = 0;
    const refreshCall = jest.fn(async () => {
      attempts++;
      throw new Error('Transient Network Reset');
    });

    await expect(
      store.rotateTokenWithPolicy({
        key: 'int-3',
        provider: 'sage',
        semantics: zeroGraceSemantics,
        currentRefreshToken: 'curr-ref',
        refreshCall,
      }),
    ).rejects.toThrow('Transient Network Reset');

    expect(attempts).toBe(1);
  });

  it('4. Positive grace semantics allows retry with backoff and succeeds', async () => {
    let attempts = 0;
    const refreshCall = jest.fn(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('503 Service Unavailable');
      }
      return {
        accessToken: 'recovered-acc',
        refreshToken: 'recovered-ref',
        expiresIn: 3600,
      };
    });

    const sleepFn = jest.fn(async () => {});

    const res = await store.rotateTokenWithPolicy({
      key: 'int-4',
      provider: 'xero',
      semantics: xeroGraceSemantics,
      currentRefreshToken: 'curr-ref',
      refreshCall,
      sleepFn,
      backoffBaseMs: 10,
    });

    expect(attempts).toBe(2);
    expect(res.accessToken).toBe('recovered-acc');
    expect(sleepFn).toHaveBeenCalledWith(10);
  });

  it('5. invalid_grant terminates immediately without retry even if positive grace period exists', async () => {
    let attempts = 0;
    const refreshCall = jest.fn(async () => {
      attempts++;
      const err: any = new Error('invalid_grant: token has been revoked');
      err.error = 'invalid_grant';
      throw err;
    });

    const markReauth = jest.fn(async () => {});

    await expect(
      store.rotateTokenWithPolicy({
        key: 'int-5',
        provider: 'xero',
        semantics: xeroGraceSemantics,
        currentRefreshToken: 'revoked-ref',
        refreshCall,
        markReauthRequiredFn: markReauth,
      }),
    ).rejects.toThrow(/REAUTHORIZATION_REQUIRED/);

    expect(attempts).toBe(1);
    expect(markReauth).toHaveBeenCalledWith(expect.stringContaining('invalid_grant'));
  });

  it('6. Missing refresh token rejects with REAUTHORIZATION_REQUIRED', async () => {
    const markReauth = jest.fn(async () => {});
    await expect(
      store.rotateTokenWithPolicy({
        key: 'int-6',
        provider: 'xero',
        semantics: xeroGraceSemantics,
        currentRefreshToken: '',
        refreshCall: jest.fn(),
        markReauthRequiredFn: markReauth,
      }),
    ).rejects.toThrow(/REAUTHORIZATION_REQUIRED/);

    expect(markReauth).toHaveBeenCalledWith('Missing refresh token');
  });

  it('7. staleTokenUseIsDestructive: true -> fails closed immediately without retry and marks reauth required (§2.2, §7.1.2)', async () => {
    let attempts = 0;
    const refreshCall = jest.fn(async () => {
      attempts++;
      throw new Error('ETIMEDOUT: Connection reset during refresh');
    });

    const markReauth = jest.fn(async () => {});

    await expect(
      store.rotateTokenWithPolicy({
        key: 'int-7',
        provider: 'quickbooks',
        semantics: destructiveSemantics,
        currentRefreshToken: 'qbo-token-1',
        refreshCall,
        markReauthRequiredFn: markReauth,
      }),
    ).rejects.toThrow(/REAUTHORIZATION_REQUIRED/);

    // Absolutely NO retry with stale token
    expect(attempts).toBe(1);
    expect(markReauth).toHaveBeenCalledWith(expect.stringContaining('staleTokenUseIsDestructive'));
  });

  it('8. staleTokenUseIsDestructive: true overrides previousTokenGraceMs > 0 (§2.2, §7.1.3)', async () => {
    let attempts = 0;
    const refreshCall = jest.fn(async () => {
      attempts++;
      throw new Error('503 Service Unavailable');
    });

    const markReauth = jest.fn(async () => {});

    await expect(
      store.rotateTokenWithPolicy({
        key: 'int-8',
        provider: 'quickbooks',
        semantics: destructiveWithGraceSemantics,
        currentRefreshToken: 'qbo-token-2',
        refreshCall,
        markReauthRequiredFn: markReauth,
      }),
    ).rejects.toThrow(/REAUTHORIZATION_REQUIRED/);

    // Overrides grace period, exactly 1 attempt
    expect(attempts).toBe(1);
    expect(markReauth).toHaveBeenCalled();
  });
});

