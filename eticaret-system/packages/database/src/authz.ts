import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from './client';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_PERMISSIONS = [
  { key: '*', name: 'All permissions' },
  { key: 'agency.read', name: 'Read agency' },
  { key: 'agency.update', name: 'Update agency' },
  { key: 'clients.read', name: 'Read clients' },
  { key: 'clients.create', name: 'Create clients' },
  { key: 'clients.update', name: 'Update clients' },
  { key: 'clients.delete', name: 'Delete clients' },
  { key: 'stores.read', name: 'Read stores' },
  { key: 'stores.create', name: 'Create stores' },
  { key: 'stores.update', name: 'Update stores' },
  { key: 'stores.delete', name: 'Delete stores' },
  { key: 'users.read', name: 'Read users' },
  { key: 'users.invite', name: 'Invite users' },
  { key: 'users.update', name: 'Update users' },
  { key: 'users.remove', name: 'Remove users' },
  { key: 'roles.read', name: 'Read roles' },
  { key: 'roles.manage', name: 'Manage roles' },
  { key: 'products.read', name: 'Read products' },
  { key: 'products.create', name: 'Create products' },
  { key: 'products.update', name: 'Update products' },
  { key: 'products.delete', name: 'Delete products' },
  { key: 'orders.read', name: 'Read orders' },
  { key: 'orders.update', name: 'Update orders' },
  { key: 'orders.refund', name: 'Refund orders' },
  { key: 'inventory.read', name: 'Read inventory' },
  { key: 'inventory.update', name: 'Update inventory' },
] as const;

export type PermissionKey = (typeof DEFAULT_PERMISSIONS)[number]['key'];

export const DEFAULT_ROLES = [
  {
    key: 'owner',
    name: 'Owner',
    permissions: ['*'],
  },
  {
    key: 'admin',
    name: 'Admin',
    permissions: [
      'agency.read',
      'agency.update',
      'clients.read',
      'clients.create',
      'clients.update',
      'stores.read',
      'stores.create',
      'stores.update',
      'users.read',
      'users.invite',
      'users.update',
      'roles.read',
      'products.read',
      'products.create',
      'products.update',
      'products.delete',
      'orders.read',
      'orders.update',
      'orders.refund',
    ],
  },
  {
    key: 'manager',
    name: 'Manager',
    permissions: [
      'users.read',
      'products.read',
      'products.create',
      'products.update',
      'orders.read',
      'orders.update',
      'inventory.read',
      'inventory.update',
    ],
  },
  {
    key: 'readonly',
    name: 'Readonly',
    permissions: ['products.read', 'orders.read', 'inventory.read'],
  },
] as const;

export type RoleKey = (typeof DEFAULT_ROLES)[number]['key'];

export async function ensureDefaultPermissions(client: DatabaseClient = db) {
  for (const permission of DEFAULT_PERMISSIONS) {
    await client.permission.upsert({
      where: { key: permission.key },
      update: { name: permission.name },
      create: permission,
    });
  }
}

export async function ensureDefaultRoles(client: DatabaseClient = db) {
  await ensureDefaultPermissions(client);

  for (const role of DEFAULT_ROLES) {
    await client.role.upsert({
      where: { key: role.key },
      update: {
        name: role.name,
        isSystem: true,
        permissions: {
          deleteMany: {},
          create: role.permissions.map((permissionKey) => ({
            permission: {
              connect: { key: permissionKey },
            },
          })),
        },
      },
      create: {
        key: role.key,
        name: role.name,
        isSystem: true,
        permissions: {
          create: role.permissions.map((permissionKey) => ({
            permission: {
              connect: { key: permissionKey },
            },
          })),
        },
      },
    });
  }
}

export async function assignStoreRole(input: {
  userId: string;
  storeId: string;
  roleKey: RoleKey;
}) {
  const role = await db.role.findUniqueOrThrow({
    where: { key: input.roleKey },
  });

  return db.storeUser.upsert({
    where: {
      userId_storeId: {
        userId: input.userId,
        storeId: input.storeId,
      },
    },
    update: {
      roleId: role.id,
      status: 'ACTIVE',
    },
    create: {
      userId: input.userId,
      storeId: input.storeId,
      roleId: role.id,
      joinedAt: new Date(),
    },
  });
}

export async function getUserTenantAccess(userId: string) {
  return db.storeUser.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      store: {
        status: 'ACTIVE',
        client: {
          status: 'ACTIVE',
          agency: {
            status: 'ACTIVE',
          },
        },
      },
    },
    select: {
      id: true,
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          client: {
            select: {
              id: true,
              name: true,
              slug: true,
              agency: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      role: {
        select: {
          key: true,
          name: true,
          permissions: {
            select: {
              permission: {
                select: {
                  key: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      store: {
        name: 'asc',
      },
    },
  });
}

export async function hasStorePermission(input: {
  userId: string;
  storeId: string;
  permission: PermissionKey;
}) {
  const access = await db.storeUser.findFirst({
    where: {
      userId: input.userId,
      storeId: input.storeId,
      status: 'ACTIVE',
      role: {
        permissions: {
          some: {
            permission: {
              key: input.permission,
            },
          },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(access);
}

export async function writeAuditLog(input: {
  tenantId?: string;
  userId?: string;
  agencyId?: string;
  clientId?: string;
  storeId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}) {
  return db.auditLog.create({
    data: input,
  });
}
