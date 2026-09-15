// require, import değil: script rootDir (src) dışında; static import nest build'i
// TS6059 ile kırıyor. jest ts-jest ile yine derliyor.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { run } = require('../../../prisma/scripts/backfill-super-admin');

describe('backfill-super-admin script', () => {
  const rows = [
    { id: 'ur-plat', userId: 'u-plat', agencyId: 'a1', user: { email: 'faruk.pataci@gmail.com' } },
    { id: 'ur-1', userId: 'u1', agencyId: 'a1', user: { email: 'someone@example.com' } },
  ];

  const prisma: any = {
    role: {
      findFirst: jest.fn(({ where }) => Promise.resolve({ id: where.name, name: where.name })),
    },
    userRole: {
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'table').mockImplementation(() => undefined);
  });

  it('dry-run writes nothing', async () => {
    await run(prisma, false);

    expect(prisma.userRole.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('--apply converts only non-allowlisted super_admin rows', async () => {
    await run(prisma, true);

    expect(prisma.userRole.update).toHaveBeenCalledTimes(1);
    expect(prisma.userRole.update).toHaveBeenCalledWith({
      where: { id: 'ur-1' },
      data: { roleId: 'agency_owner' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'role.backfill_super_admin',
        entityType: 'UserRole',
        entityId: 'ur-1',
        tenantId: 'a1',
      }),
    });
  });
});
