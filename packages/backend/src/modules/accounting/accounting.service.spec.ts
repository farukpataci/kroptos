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
});
