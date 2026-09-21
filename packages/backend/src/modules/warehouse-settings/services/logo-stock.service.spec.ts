import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LogoStockIntegrationService } from './logo-stock.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

// P12a bulgu 5: update/remove agencyId'yi imzada alip where'e koymuyordu.
describe('LogoStockIntegrationService', () => {
  let service: LogoStockIntegrationService;
  const prisma: any = {
    logoProductMapping: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [LogoStockIntegrationService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(LogoStockIntegrationService);
    jest.clearAllMocks();
  });

  it("update: another agency's mapping → 404, nothing written", async () => {
    prisma.logoProductMapping.findFirst.mockResolvedValue(null);
    await expect(service.update('m1', { status: 'active' }, 'agency-A')).rejects.toThrow(NotFoundException);
    expect(prisma.logoProductMapping.findFirst).toHaveBeenCalledWith({ where: { id: 'm1', agencyId: 'agency-A' }, select: { id: true } });
    expect(prisma.logoProductMapping.update).not.toHaveBeenCalled();
  });

  it("remove: another agency's mapping → 404, nothing deleted", async () => {
    prisma.logoProductMapping.findFirst.mockResolvedValue(null);
    await expect(service.remove('m1', 'agency-A')).rejects.toThrow(NotFoundException);
    expect(prisma.logoProductMapping.delete).not.toHaveBeenCalled();
  });

  it('own mapping → update/delete proceed', async () => {
    prisma.logoProductMapping.findFirst.mockResolvedValue({ id: 'm1' });
    await service.update('m1', { status: 'active' }, 'agency-A');
    await service.remove('m1', 'agency-A');
    expect(prisma.logoProductMapping.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm1' } }));
    expect(prisma.logoProductMapping.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
  });
});
