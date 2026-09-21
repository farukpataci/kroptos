import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { RbacService } from '../rbac/rbac.service';

// P13-4: "son sahip" kontrolü rol adıyla değil RbacService.isLastAgencyOwner (key + isSystem) ile.
describe('ProfileService.deleteAccount', () => {
  let service: ProfileService;
  const prisma: any = { user: { findUnique: jest.fn(), update: jest.fn() }, userRole: { count: jest.fn() } };
  const rbac = { isLastAgencyOwner: jest.fn() };
  const audit = { createLog: jest.fn() };
  const user = { id: 'u1', email: 'u@x', firstName: 'A', lastName: 'B', userRoles: [{ role: { key: 'ops', name: 'Owner', isSystem: false } }] };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: audit },
        { provide: SessionService, useValue: {} },
        { provide: RbacService, useValue: rbac },
      ],
    }).compile();
    service = mod.get(ProfileService);
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
  });

  it("tenant role named 'Owner' (isSystem=false) does NOT block deletion; decision comes from isLastAgencyOwner", async () => {
    rbac.isLastAgencyOwner.mockResolvedValue(false);
    await expect(service.deleteAccount('u1', 'a1', '127.0.0.1', 'ua')).resolves.toEqual({ success: true });
    expect(rbac.isLastAgencyOwner).toHaveBeenCalledWith('u1', 'a1');
    expect(prisma.userRole.count).not.toHaveBeenCalled(); // rol ADI ile sayım yok
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: expect.objectContaining({ isActive: false }) });
  });

  it('last agency_owner → 403, no soft delete', async () => {
    rbac.isLastAgencyOwner.mockResolvedValue(true);
    await expect(service.deleteAccount('u1', 'a1', '127.0.0.1', 'ua')).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
