import { CegidAuthCredentials, CegidAuthService } from './cegid.auth';
import { CegidTokenResponse } from './cegid.types';

describe('CegidAuthService', () => {
  let authService: CegidAuthService;
  let mockTokenStore: any;

  const validCredentials: CegidAuthCredentials = {
    instanceUrl: 'https://tenant1.cegid.cloud',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    username: 'admin',
    password: 'secure-password',
    scope: 'api',
  };

  const mockTokenResponse: CegidTokenResponse = {
    access_token: 'mock-access-token-123',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'api',
  };

  beforeEach(() => {
    mockTokenStore = {
      tokens: new Map<string, any>(),
      getToken: jest.fn((id: string) => mockTokenStore.tokens.get(id)),
      setToken: jest.fn((id: string, token: any) => {
        mockTokenStore.tokens.set(id, token);
      }),
    };
    authService = new CegidAuthService(mockTokenStore);
  });

  it('should request token with password grant params and store it', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    let capturedHeaders: any = {};

    const mockHttp = async (url: string, body: string, headers: any) => {
      capturedUrl = url;
      capturedBody = body;
      capturedHeaders = headers;
      return mockTokenResponse;
    };

    const token = await authService.getValidToken(
      'integration-1',
      validCredentials,
      mockHttp,
    );

    expect(token).toBe('mock-access-token-123');
    expect(capturedUrl).toBe('https://tenant1.cegid.cloud/identity/connect/token');
    expect(capturedHeaders['content-type']).toBe('application/x-www-form-urlencoded');

    const params = new URLSearchParams(capturedBody);
    expect(params.get('grant_type')).toBe('password');
    expect(params.get('username')).toBe('admin');
    expect(params.get('password')).toBe('secure-password');
    expect(params.get('client_id')).toBe('test-client-id');
    expect(params.get('client_secret')).toBe('test-client-secret');
    expect(params.get('scope')).toBe('api');

    expect(mockTokenStore.setToken).toHaveBeenCalledWith(
      'integration-1',
      expect.objectContaining({
        accessToken: 'mock-access-token-123',
      }),
    );
  });


  it('should reuse valid token from store if not expired', async () => {
    mockTokenStore.tokens.set('integration-1', {
      accessToken: 'already-cached-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes in future
    });

    const mockHttp = jest.fn();
    const token = await authService.getValidToken(
      'integration-1',
      validCredentials,
      mockHttp,
    );

    expect(token).toBe('already-cached-token');
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it('should reject foreign host tokenUrl during validation', async () => {
    const maliciousCreds = {
      ...validCredentials,
      tokenUrl: 'https://evil-server.com/token',
    };

    await expect(
      authService.requestPasswordGrant(maliciousCreds, jest.fn()),
    ).rejects.toThrow();
  });
});
