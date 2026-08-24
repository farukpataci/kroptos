import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@common/prisma/prisma.service';
import { CarrierConnectorFactory } from '../../integrations/carriers/core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../../integrations/carriers/core/CarrierCredentialService';
import { CarrierIntegrationService } from './carrier-integration.service';

/**
 * Carrier selection, in the one method that owns it.
 *
 * The rule the tests defend is that ambiguity is never resolved quietly: with
 * no connection or with several, the caller is refused and told why, in a form
 * a client can branch on. Picking the first of several would be the cheap
 * option and the expensive bug — a label bought from the wrong carrier is only
 * noticed when the parcel is handed to the wrong van.
 */
describe('CarrierIntegrationService.resolveCarrierIntegration', () => {
  let service: CarrierIntegrationService;

  const prisma: any = { carrierIntegration: { findMany: jest.fn(), findFirst: jest.fn() } };
  const credentials: any = { decrypt: jest.fn(() => ({})), encrypt: jest.fn(), validate: jest.fn() };
  const connectors: any = { create: jest.fn() };
  const scope = { agencyId: 'ag-1', storeId: 'st-1', clientId: null } as any;

  const row = (id: string, over: any = {}) => ({
    id,
    provider: 'MOCK',
    displayName: `Kargo ${id}`,
    credentials: 'encrypted-blob',
    isActive: true,
    isTestMode: true,
    deletedAt: null,
    ...over,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarrierIntegrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: CarrierCredentialService, useValue: credentials },
        { provide: CarrierConnectorFactory, useValue: connectors },
      ],
    }).compile();

    service = module.get(CarrierIntegrationService);
    jest.clearAllMocks();
  });

  const bodyOf = async (promise: Promise<unknown>) => {
    try {
      await promise;
      throw new Error('beklenen hata firlatilmadi');
    } catch (error: any) {
      return { error, body: error?.response ?? error?.getResponse?.() };
    }
  };

  it('refuses with NO_ACTIVE_CARRIER when the tenant has none', async () => {
    prisma.carrierIntegration.findMany.mockResolvedValue([]);

    const { error, body } = await bodyOf(service.resolveCarrierIntegration(scope));

    expect(error).toBeInstanceOf(BadRequestException);
    expect(body.code).toBe('NO_ACTIVE_CARRIER');
    expect(body.messageKey).toBe('shipping.errors.noActiveCarrier');
    // A configuration gap answers 400, not 500.
    expect(error.getStatus()).toBe(400);
    // No connector was built, so nothing could have been bought.
    expect(connectors.create).not.toHaveBeenCalled();
  });

  it('refuses with AMBIGUOUS_CARRIER and lists the choices, without credentials', async () => {
    prisma.carrierIntegration.findMany.mockResolvedValue([
      row('ci-1', { displayName: 'Yurtici', provider: 'YURTICI' }),
      row('ci-2', { displayName: 'MNG', provider: 'MNG' }),
    ]);

    const { error, body } = await bodyOf(service.resolveCarrierIntegration(scope));

    expect(error.getStatus()).toBe(400);
    expect(body.code).toBe('AMBIGUOUS_CARRIER');
    expect(body.messageKey).toBe('shipping.errors.ambiguousCarrier');
    expect(body.carriers).toEqual([
      { id: 'ci-1', displayName: 'Yurtici', provider: 'YURTICI' },
      { id: 'ci-2', displayName: 'MNG', provider: 'MNG' },
    ]);
    // Three fields and no fourth: the encrypted blob must not ride along.
    expect(JSON.stringify(body)).not.toContain('encrypted-blob');
    expect(Object.keys(body.carriers[0])).toEqual(['id', 'displayName', 'provider']);
    expect(connectors.create).not.toHaveBeenCalled();
  });

  it('uses the one connection when there is exactly one', async () => {
    prisma.carrierIntegration.findMany.mockResolvedValue([row('ci-only')]);

    await expect(service.resolveCarrierIntegration(scope)).resolves.toMatchObject({
      id: 'ci-only',
    });
  });

  it('uses the connection the caller named, even with several active', async () => {
    prisma.carrierIntegration.findFirst.mockResolvedValue(row('ci-2'));

    const chosen = await service.resolveCarrierIntegration(scope, 'ci-2');

    expect(chosen.id).toBe('ci-2');
    // Named explicitly, so the ambiguity question never arises.
    expect(prisma.carrierIntegration.findMany).not.toHaveBeenCalled();
    // And it was looked up inside the caller's own tenant.
    expect(prisma.carrierIntegration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agencyId: 'ag-1', id: 'ci-2' }) }),
    );
  });

  it("answers 404 for another tenant's connection id, not 403", async () => {
    // The scoped lookup simply does not see it.
    prisma.carrierIntegration.findFirst.mockResolvedValue(null);

    const { error } = await bodyOf(service.resolveCarrierIntegration(scope, 'ci-elsewhere'));

    // 403 would confirm the id exists somewhere; 404 says nothing.
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getStatus()).toBe(404);
  });

  it('treats a deactivated connection as absent, named or not', async () => {
    prisma.carrierIntegration.findFirst.mockResolvedValue(row('ci-off', { isActive: false }));

    const { error } = await bodyOf(service.resolveCarrierIntegration(scope, 'ci-off'));
    expect(error).toBeInstanceOf(NotFoundException);
  });

  it('never offers a soft-deleted connection as a candidate', async () => {
    prisma.carrierIntegration.findMany.mockResolvedValue([]);

    await bodyOf(service.resolveCarrierIntegration(scope));

    // deletedAt: null comes from scopeWhere and isActive is added on top; a
    // soft-deleted row cannot reach the candidate list in the first place.
    const where = prisma.carrierIntegration.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ agencyId: 'ag-1', deletedAt: null, isActive: true });
  });
});
