import { BadRequestException } from '@nestjs/common';
import { AccountingService } from './accounting.service';

describe('AccountingService', () => {
  let service: AccountingService;
  let mockPrisma: any;
  let mockCredentialsService: any;
  let mockConnectorFactory: any;
  let mockAuditLogService: any;

  beforeEach(() => {
    mockPrisma = {
      accountingIntegration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      accountingCompany: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockCredentialsService = {
      validate: jest.fn(),
      encrypt: jest.fn((val) => `enc-${JSON.stringify(val)}`),
      stripNonServerFields: jest.fn((_p, val) => val),
      decrypt: jest.fn((val) => JSON.parse(val.replace('enc-', ''))),
      maskCredentials: jest.fn((p, c) => ({ ...c, clientSecret: '****' })),
    };

    mockConnectorFactory = {
      create: jest.fn().mockReturnValue({
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          message: 'Connection successful',
          companyName: 'Test Firma',
          environment: 'MOCK',
        }),
      }),
    };

    mockAuditLogService = {
      createLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    service = new AccountingService(
      mockPrisma,
      mockCredentialsService,
      mockConnectorFactory,
      mockAuditLogService,
    );
  });

  it('calculateScopeKey formats agencyId, clientId, and storeId correctly', () => {
    expect(
      service.calculateScopeKey({ agencyId: 'ag-1', clientId: 'cl-1', storeId: 'st-1' }),
    ).toBe('ag-1:cl-1:st-1');

    expect(service.calculateScopeKey({ agencyId: 'ag-1' })).toBe('ag-1:-:-');
  });

  it('createIntegration creates an integration row with encrypted credentials and scopeKey', async () => {
    mockPrisma.accountingIntegration.findUnique.mockResolvedValue(null);
    mockPrisma.accountingIntegration.create.mockImplementation(({ data }: any) => ({
      id: 'acc-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await service.createIntegration({
      agencyId: 'agency-1',
      clientId: 'client-1',
      storeId: 'store-1',
      provider: 'PARASUT',
      name: 'Paraşüt Mağaza',
      environment: 'MOCK',
      credentials: {
        clientId: 'id-1',
        clientSecret: 'sec-1',
        username: 'user@kroptos.com',
        password: 'pwd',
        companyId: '12345',
      },
    });

    expect(result.id).toBe('acc-1');
    expect(result.provider).toBe('PARASUT');
    expect(result.credentials.clientSecret).toBe('****');
    expect(mockPrisma.accountingIntegration.create).toHaveBeenCalled();
    expect(mockAuditLogService.createLog).toHaveBeenCalled();
  });

  it('createIntegration rejects duplicate provider and scopeKey', async () => {
    mockPrisma.accountingIntegration.findUnique.mockResolvedValue({
      id: 'existing-1',
      deletedAt: null,
    });

    await expect(
      service.createIntegration({
        agencyId: 'agency-1',
        provider: 'PARASUT',
        name: 'Tekrar',
        credentials: { clientId: 'c' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('testConnection invokes connector and updates lastVerifiedAt on success', async () => {
    mockPrisma.accountingIntegration.findFirst.mockResolvedValue({
      id: 'acc-1',
      provider: 'PARASUT',
      environment: 'MOCK',
      credentials: 'enc-{"clientId":"c"}',
    });

    const result = await service.testConnection('acc-1', { agencyId: 'agency-1' });

    expect(result.success).toBe(true);
    expect(mockPrisma.accountingIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'acc-1' },
        data: expect.objectContaining({ status: 'connected' }),
      }),
    );
  });

  describe('OAuth2 Flow Security (§5 & §5.2)', () => {
    it('startOAuth generates cryptographic nonce and builds URL', async () => {
      const mockConnector = {
        buildAuthorizationUrl: jest.fn().mockReturnValue('https://sageone.com/oauth2?state=mockstate'),
      };
      mockConnectorFactory.create.mockReturnValue(mockConnector);

      mockPrisma.accountingIntegration.findFirst.mockResolvedValue({
        id: 'acc-sage-1',
        agencyId: 'agency-1',
        provider: 'SAGE-ACCOUNTING',
        environment: 'MOCK',
        credentials: 'enc-{"businessId":"biz-1"}',
      });

      const res = await service.startOAuth(
        'acc-sage-1',
        { agencyId: 'agency-1' },
        'http://localhost:3000/callback',
        { id: 'user-1' },
      );

      expect(res.authorizationUrl).toBe('https://sageone.com/oauth2?state=mockstate');
      expect(mockConnector.buildAuthorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.any(String),
          redirectUri: 'http://localhost:3000/callback',
        }),
      );
    });

    it('handleOAuthCallback: nonce tek kullanımlıktır; ikinci kullanımda işlem yapılmaz (§5.2)', async () => {
      const mockConnector = {
        buildAuthorizationUrl: jest.fn().mockImplementation(({ state }) => `https://auth.sage.com?state=${state}`),
        exchangeAuthorizationCode: jest.fn().mockResolvedValue({
          accessToken: 'new_acc_tok',
          refreshToken: 'new_ref_tok',
          expiresIn: 300,
        }),
      };
      mockConnectorFactory.create.mockReturnValue(mockConnector);

      mockPrisma.accountingIntegration.findFirst.mockResolvedValue({
        id: 'acc-sage-1',
        agencyId: 'agency-1',
        provider: 'SAGE-ACCOUNTING',
        environment: 'MOCK',
        credentials: 'enc-{"businessId":"biz-1"}',
      });
      mockPrisma.accountingIntegration.findUnique.mockResolvedValue({
        id: 'acc-sage-1',
        agencyId: 'agency-1',
        provider: 'SAGE-ACCOUNTING',
        environment: 'MOCK',
        credentials: 'enc-{"businessId":"biz-1"}',
      });

      // 1. Start OAuth
      const startRes = await service.startOAuth('acc-sage-1', { agencyId: 'agency-1' });
      const stateNonce = new URL(startRes.authorizationUrl).searchParams.get('state')!;
      expect(stateNonce).toBeDefined();

      // 2. First callback execution -> Success
      const callback1 = await service.handleOAuthCallback('auth_code_123', stateNonce);
      expect(callback1.success).toBe(true);
      expect(mockConnector.exchangeAuthorizationCode).toHaveBeenCalledTimes(1);

      // 3. Second callback with SAME nonce -> Rejected immediately, no code exchange
      const callback2 = await service.handleOAuthCallback('auth_code_123', stateNonce);
      expect(callback2.success).toBe(false);
      expect(callback2.message.toLowerCase()).toContain('geçersiz veya süresi dolmuş');
      // exchangeAuthorizationCode was NOT called again
      expect(mockConnector.exchangeAuthorizationCode).toHaveBeenCalledTimes(1);
    });

    it('Bilinmeyen veya süresi dolmuş state -> nötr hata döner, entegrasyon varlığı sızmaz (§5.2 rule 5)', async () => {
      const res = await service.handleOAuthCallback('fake_code', 'non_existent_nonce');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Yetkilendirme oturumu geçersiz veya süresi dolmuş.');
      expect(mockPrisma.accountingIntegration.findUnique).not.toHaveBeenCalled();
    });

    it('code, state ve tokenlar logda ve audit kaydında AÇIK YAZILMAZ (§5.2 rule 6 & 7)', async () => {
      const mockConnector = {
        buildAuthorizationUrl: jest.fn().mockImplementation(({ state }) => `https://auth.sage.com?state=${state}`),
        exchangeAuthorizationCode: jest.fn().mockResolvedValue({
          accessToken: 'super_secret_access_token',
          refreshToken: 'super_secret_refresh_token',
          expiresIn: 300,
        }),
      };
      mockConnectorFactory.create.mockReturnValue(mockConnector);

      mockPrisma.accountingIntegration.findFirst.mockResolvedValue({
        id: 'acc-sage-1',
        agencyId: 'agency-1',
        provider: 'SAGE-ACCOUNTING',
        environment: 'MOCK',
        credentials: 'enc-{"businessId":"biz-1"}',
      });
      mockPrisma.accountingIntegration.findUnique.mockResolvedValue({
        id: 'acc-sage-1',
        agencyId: 'agency-1',
        provider: 'SAGE-ACCOUNTING',
        environment: 'MOCK',
        credentials: 'enc-{"businessId":"biz-1"}',
      });

      const startRes = await service.startOAuth('acc-sage-1', { agencyId: 'agency-1' });
      const nonce = new URL(startRes.authorizationUrl).searchParams.get('state')!;

      const cbResult = await service.handleOAuthCallback('raw_auth_code', nonce);
      expect(cbResult.success).toBe(true);

      const auditCalls = mockAuditLogService.createLog.mock.calls;
      const oauthAudit = auditCalls.find((c: any[]) => c[0].action === 'OAUTH_AUTHORIZE_SUCCESS');

      expect(oauthAudit).toBeDefined();
      const auditPayloadStr = JSON.stringify(oauthAudit[0]);
      expect(auditPayloadStr).not.toContain('super_secret_access_token');
      expect(auditPayloadStr).not.toContain('super_secret_refresh_token');
      expect(auditPayloadStr).not.toContain('raw_auth_code');
    });

    it('§4.2 Canlı tutma işi (keep-alive) mock ortamda ağ isteği yapmaz', async () => {
      mockPrisma.accountingIntegration.findMany.mockResolvedValue([
        {
          id: 'acc-sage-mock',
          provider: 'SAGE-ACCOUNTING',
          status: 'connected',
          environment: 'MOCK',
          credentials: 'enc-{"businessId":"biz-1"}',
        },
      ]);

      const result = await service.runKeepAliveJob();
      expect(result.checked).toBe(1);
      expect(result.refreshed).toBe(0);
      expect(result.failed).toBe(0);
      // No connector testConnection made for MOCK
      expect(mockConnectorFactory.create).not.toHaveBeenCalled();
    });
  });
});
