import { AccountingTokenStore } from '../core/AccountingTokenStore';
import { BusinessCentralAuth } from './bc.auth';
import { BusinessCentralCredentials } from './bc.types';

describe('BusinessCentralAuth', () => {
  let tokenStore: AccountingTokenStore;
  let auth: BusinessCentralAuth;

  beforeEach(() => {
    tokenStore = new AccountingTokenStore();
    auth = new BusinessCentralAuth(tokenStore);
    delete process.env.BC_ONLINE_CLIENT_ID;
    delete process.env.BC_ONLINE_CLIENT_SECRET;
  });

  const validCredentials: BusinessCentralCredentials = {
    aadTenantId: 'tenant-guid-1234',
    environmentName: 'production',
    companyId: 'company-guid-5678',
    clientId: 'client-id-override',
    clientSecret: 'super-secret-client-secret',
  };

  it('resolves per-tenant credentials when provided', () => {
    const creds = auth.resolveClientCredentials(validCredentials);
    expect(creds.clientId).toBe('client-id-override');
    expect(creds.clientSecret).toBe('super-secret-client-secret');
  });

  it('falls back to environment variables when per-tenant creds are missing', () => {
    process.env.BC_ONLINE_CLIENT_ID = 'sys-client-id';
    process.env.BC_ONLINE_CLIENT_SECRET = 'sys-client-secret';

    const creds = auth.resolveClientCredentials({
      aadTenantId: 'tenant-guid-1234',
      environmentName: 'production',
      companyId: 'company-guid-5678',
    });

    expect(creds.clientId).toBe('sys-client-id');
    expect(creds.clientSecret).toBe('sys-client-secret');
  });

  it('throws AccountingAuthError if neither per-tenant nor env credentials exist', () => {
    expect(() =>
      auth.resolveClientCredentials({
        aadTenantId: 'tenant-guid-1234',
        environmentName: 'production',
        companyId: 'company-guid-5678',
      }),
    ).toThrow('Business Central Entra ID kimlik bilgileri');
  });

  it('caches token by aadTenantId and batches 5 concurrent requests into 1 network call (§8.12)', async () => {
    let callCount = 0;
    const mockFetch = jest.fn().mockImplementation(async () => {
      callCount++;
      // simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 30));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token_type: 'Bearer',
          expires_in: 3600,
          access_token: 'mock-access-token-xyz',
        }),
      } as any;
    });

    // 5 concurrent requests with same aadTenantId
    const promises = Array.from({ length: 5 }).map(() =>
      auth.getAccessToken(validCredentials, mockFetch),
    );

    const tokens = await Promise.all(promises);

    expect(callCount).toBe(1);
    for (const token of tokens) {
      expect(token).toBe('mock-access-token-xyz');
    }
  });

  it('does not leak clientSecret in error messages when Entra ID returns error (§8.13)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'invalid_client',
        error_description: 'AADSTS7000215: Invalid client secret provided.',
      }),
    } as any);

    await expect(auth.getAccessToken(validCredentials, mockFetch)).rejects.toThrow(
      'Entra ID kimlik doğrulama hatası (401)',
    );

    try {
      await auth.getAccessToken(validCredentials, mockFetch);
    } catch (err: any) {
      expect(err.message).not.toContain('super-secret-client-secret');
    }
  });
});
