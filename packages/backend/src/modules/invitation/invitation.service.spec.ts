import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, GoneException, HttpException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InvitationService } from './invitation.service';
import { PrismaService } from '@common/prisma/prisma.service';
import { PermissionCacheService } from '@common/services/permission-cache.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { RbacService, ActorContext } from '../rbac/rbac.service';

const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

describe('InvitationService', () => {
  let service: InvitationService;
  const prisma: any = {
    invitation: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    auditLog: { count: jest.fn(), create: jest.fn() },
    agency: { findFirst: jest.fn() },
    role: { findFirst: jest.fn() },
    user: { findFirst: jest.fn(), create: jest.fn() },
    userRole: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    client: { findFirst: jest.fn() },
    store: { findFirst: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  };
  const rbac = { assertAssignableRole: jest.fn() };
  const auth = { issueSessionFor: jest.fn() };
  const mail = { enqueue: jest.fn() };
  const cache = { invalidateUser: jest.fn() };
  const actor: ActorContext = { userId: 'admin', agencyId: 'a1', role: 'agency_owner', roleIsSystem: true, ipAddress: '1.1.1.1' };
  const token = 'ab'.repeat(32);
  const pendingInv = () => ({
    id: 'inv1', agencyId: 'a1', clientId: null, storeId: 's1', email: 'new@x.y', roleId: 'r-sm', tokenHash: sha(token),
    status: 'pending', expiresAt: new Date(Date.now() + 3600_000), agency: { id: 'a1', name: 'A', publicId: 'tn_a' },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: prisma },
        { provide: RbacService, useValue: rbac },
        { provide: AuthService, useValue: auth },
        { provide: MailService, useValue: mail },
        { provide: PermissionCacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(InvitationService);
    jest.clearAllMocks();
    rbac.assertAssignableRole.mockResolvedValue({ id: 'r-sm', key: 'store_manager', name: 'store_manager', isSystem: true });
    prisma.auditLog.count.mockResolvedValue(0);
    prisma.agency.findFirst.mockResolvedValue({ name: 'A' });
    prisma.role.findFirst.mockResolvedValue({ id: 'r-sm', key: 'store_manager', name: 'store_manager', isSystem: true });
    prisma.invitation.findFirst.mockResolvedValue(null);
    prisma.invitation.updateMany.mockResolvedValue({ count: 1 });
    prisma.userRole.findFirst.mockResolvedValue(null);
    auth.issueSessionFor.mockResolvedValue({ accessToken: 't', refreshToken: 'r', agencies: [] });
  });

  describe('create', () => {
    it('escalation / super_admin are rejected by assertAssignableRole before anything is written', async () => {
      rbac.assertAssignableRole.mockRejectedValue(new ForbiddenException('nope'));
      await expect(service.create({ email: 'new@x.y', roleId: 'sa' }, actor)).rejects.toThrow(ForbiddenException);
      expect(prisma.invitation.create).not.toHaveBeenCalled();
      expect(mail.enqueue).not.toHaveBeenCalled();
    });

    it('stores only the SHA-256 hash, returns no token, mails the raw link', async () => {
      prisma.store.findFirst.mockResolvedValue({ id: 's1', clientId: null });
      prisma.invitation.create.mockImplementation(({ data, select }: any) => Promise.resolve({ id: 'inv1', ...data, tokenHash: undefined }));
      const res: any = await service.create({ email: 'New@X.Y', roleId: 'r-sm', storeId: 's1' }, actor);
      const data = prisma.invitation.create.mock.calls[0][0].data;
      expect(data.email).toBe('new@x.y');
      expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(data.invitedBy).toBe('admin');
      const link = mail.enqueue.mock.calls[0][0].text.match(/\/invite\/([a-f0-9]{64})/)[1];
      expect(sha(link)).toBe(data.tokenHash);
      // Gelistirmede devInviteUrl doner (TODO P8), production'da ASLA
      expect(res.devInviteUrl).toContain(link);
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        prisma.invitation.findFirst.mockResolvedValue(null);
        const prod: any = await service.create({ email: 'new2@x.y', roleId: 'r-sm' }, actor);
        expect(prod.devInviteUrl).toBeUndefined();
        expect(JSON.stringify(prod)).not.toMatch(/[a-f0-9]{64}/);
      } finally {
        process.env.NODE_ENV = prev;
      }
      expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'invitation.created', entityDisplayName: 'new@x.y' }) });
      expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0])).not.toContain(link);
    });

    it('rate limit: 3 per hour per email+agency', async () => {
      prisma.auditLog.count.mockResolvedValue(3);
      await expect(service.create({ email: 'new@x.y', roleId: 'r-sm' }, actor)).rejects.toMatchObject({ status: 429 });
    });

    it('a pending invitation for the same email is resent instead of duplicated', async () => {
      const pending = { ...pendingInv(), tokenHash: undefined };
      prisma.invitation.findFirst.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending);
      prisma.invitation.update.mockResolvedValue(pending);
      await service.create({ email: 'new@x.y', roleId: 'r-sm' }, actor);
      expect(prisma.invitation.create).not.toHaveBeenCalled();
      expect(prisma.invitation.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inv1' }, data: expect.objectContaining({ tokenHash: expect.any(String) }) }));
      expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'invitation.resent' }) });
    });
  });

  describe('accept', () => {
    it('expired token → 410', async () => {
      prisma.invitation.findUnique.mockResolvedValue({ ...pendingInv(), expiresAt: new Date(Date.now() - 1000) });
      await expect(service.accept(token, { password: 'Password123!' })).rejects.toThrow(GoneException);
    });

    it('revoked → 410; wrong token shape → 410 without hitting the DB', async () => {
      prisma.invitation.findUnique.mockResolvedValue({ ...pendingInv(), status: 'revoked' });
      await expect(service.accept(token, { password: 'Password123!' })).rejects.toThrow(GoneException);
      await expect(service.accept('short', {})).rejects.toThrow(GoneException);
      expect(prisma.invitation.findUnique).toHaveBeenCalledTimes(1);
    });

    it('second accept → 410 (status no longer pending; race guarded by updateMany count)', async () => {
      prisma.invitation.findUnique.mockResolvedValue({ ...pendingInv(), status: 'accepted' });
      await expect(service.accept(token, {})).rejects.toThrow(GoneException);
      prisma.invitation.findUnique.mockResolvedValue(pendingInv());
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', isActive: true });
      prisma.invitation.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.accept(token, {})).rejects.toThrow(GoneException);
    });

    it('new user: password required, User + UserRole created, session issued, cache invalidated', async () => {
      prisma.invitation.findUnique.mockResolvedValue(pendingInv());
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.accept(token, {})).rejects.toThrow(BadRequestException);
      prisma.user.create.mockResolvedValue({ id: 'u-new' });
      const res = await service.accept(token, { password: 'Password123!', firstName: 'N' });
      const created = prisma.user.create.mock.calls[0][0].data;
      expect(created.email).toBe('new@x.y');
      expect(created.passwordHash).not.toBe('Password123!');
      expect(prisma.userRole.create).toHaveBeenCalledWith({ data: { userId: 'u-new', agencyId: 'a1', roleId: 'r-sm', clientId: null, storeId: 's1' } });
      expect(prisma.invitation.updateMany).toHaveBeenCalledWith({ where: { id: 'inv1', status: 'pending' }, data: { status: 'accepted', acceptedAt: expect.any(Date) } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'invitation.accepted' }) });
      expect(cache.invalidateUser).toHaveBeenCalledWith('u-new');
      expect(auth.issueSessionFor).toHaveBeenCalledWith('u-new', { agencyId: 'a1', clientId: null, storeId: 's1' }, undefined);
      expect(res.accessToken).toBe('t');
    });

    it('existing user: password ignored, only UserRole added', async () => {
      prisma.invitation.findUnique.mockResolvedValue(pendingInv());
      prisma.user.findFirst.mockResolvedValue({ id: 'u-old', isActive: true });
      await service.accept(token, { password: 'ignored' });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.userRole.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'u-old' }) });
    });

    it('same scope already active → 409 and invitation marked accepted', async () => {
      prisma.invitation.findUnique.mockResolvedValue(pendingInv());
      prisma.user.findFirst.mockResolvedValue({ id: 'u-old', isActive: true });
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1', deletedAt: null });
      await expect(service.accept(token, {})).rejects.toThrow(ConflictException);
      expect(prisma.invitation.updateMany).toHaveBeenLastCalledWith({ where: { id: 'inv1', status: 'pending' }, data: { status: 'accepted', acceptedAt: expect.any(Date) } });
      expect(auth.issueSessionFor).not.toHaveBeenCalled();
    });

    it('role deleted since the invitation → 410; super_admin never accepted', async () => {
      prisma.invitation.findUnique.mockResolvedValue(pendingInv());
      prisma.role.findFirst.mockResolvedValueOnce(null);
      await expect(service.accept(token, {})).rejects.toThrow(GoneException);
      prisma.role.findFirst.mockResolvedValueOnce({ id: 'sa', key: 'super_admin', isSystem: true });
      await expect(service.accept(token, {})).rejects.toThrow(GoneException);
      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });
  });
});
