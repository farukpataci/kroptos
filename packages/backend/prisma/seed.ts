import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Seed Permissions
  const permissionsList = [
    { name: '*:*', description: 'Wildcard full access' },
    { name: 'agencies.read', description: 'View agencies list and details' },
    { name: 'agencies.create', description: 'Create new agencies' },
    { name: 'clients.read', description: 'View client accounts' },
    { name: 'clients.create', description: 'Create new clients' },
    { name: 'stores.read', description: 'View store channels' },
    { name: 'stores.create', description: 'Create new stores' },
    { name: 'products.read', description: 'View products' },
    { name: 'products.create', description: 'Add new products' },
    { name: 'orders.read', description: 'View client orders' },
    { name: 'orders.update', description: 'Modify orders' },
    { name: 'integrations.manage', description: 'Manage third-party integrations' },
    { name: 'integrations.read', description: 'View integrations and their settings (secrets masked)' },
    { name: 'integrations.settings.update', description: 'Change, reset or restore integration settings' },
    { name: 'accounting.export', description: 'Export financial/invoice reports' },
    { name: 'warehouse.manage', description: 'Manage inventories and warehouse popups' },
    { name: 'wms.view', description: 'Access WMS interface' },
    { name: 'wms.manage', description: 'Full WMS administration' },
    { name: 'wms.print', description: 'Trigger print jobs in WMS' },
    { name: 'wms.settings.update', description: 'Update WMS printer/label settings' },
    { name: 'wms.labels.view', description: 'View WMS shipping labels' },
    { name: 'wms.labels.create', description: 'Create shipping labels in WMS' },
    { name: 'wms.stock.view', description: 'View WMS stock movements' },
    { name: 'wms.stock.update', description: 'Modify WMS stock levels' },
    { name: 'analytics.read', description: 'View analytics dashboards and reports' },
    { name: 'analytics.export', description: 'Export analytics reports' },
    { name: 'analytics.financial.read', description: 'View profitability and financial analytics' },
    { name: 'analytics.integration.read', description: 'View integration health and accounting analytics' },
    { name: 'system.settings.read', description: 'View system, tenant, security and notification settings' },
    { name: 'system.settings.manage', description: 'Change system, tenant, security and notification settings' },
    { name: 'system.settings.write', description: 'Assign stores to users' },
    { name: 'warehouse.settings.read', description: 'View warehouses, zones, locations and stock sources' },
    { name: 'warehouse.settings.manage', description: 'Manage warehouses, zones, locations and stock sources' },
    { name: 'stock.allocation.read', description: 'View and calculate stock allocation rules' },
    { name: 'stock.allocation.manage', description: 'Create and change stock allocation rules' },
    { name: 'audit.read', description: 'View audit log records' },
    { name: 'integration.logs.read', description: 'View integration error logs' },
    { name: 'integration.logs.manage', description: 'Resolve, ignore or retry integration errors' },
    // agencies.write bilincli olarak hicbir role bagli degil: distributor firma
    // yonetimi PlatformAdminGuard ile kilitli, super_admin de '*:*' ile kapsiyor.
    { name: 'agencies.write', description: 'Update or delete agencies' },
    { name: 'clients.write', description: 'Update or delete clients' },
    { name: 'stores.write', description: 'Update or delete stores' },
  ];

  console.log('Seeding permissions...');
  const permissionsMap: Record<string, any> = {};
  for (const perm of permissionsList) {
    const createdPerm = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: perm,
    });
    permissionsMap[perm.name] = createdPerm;
  }

  // 2. Seed Roles and map permissions
  const rolesList = [
    {
      name: 'super_admin',
      description: 'Super administrator with full system-wide access',
      permissions: ['*:*'],
    },
    {
      name: 'agency_owner',
      description: 'Agency owner with full management rights inside their agency',
      permissions: [
        'agencies.read',
        'clients.read',
        'clients.create',
        'stores.read',
        'stores.create',
        'products.read',
        'products.create',
        'orders.read',
        'orders.update',
        'integrations.manage',
        'integrations.read',
        'integrations.settings.update',
        'accounting.export',
        'warehouse.manage',
        'wms.view',
        'wms.manage',
        'wms.print',
        'wms.settings.update',
        'wms.labels.view',
        'wms.labels.create',
        'wms.stock.view',
        'wms.stock.update',
        'analytics.read',
        'analytics.export',
        'analytics.financial.read',
        'analytics.integration.read',
        'system.settings.read',
        'system.settings.manage',
        'system.settings.write',
        'warehouse.settings.read',
        'warehouse.settings.manage',
        'stock.allocation.read',
        'stock.allocation.manage',
        'audit.read',
        'integration.logs.read',
        'integration.logs.manage',
        'clients.write',
        'stores.write',
      ],
    },
    {
      name: 'agency_admin',
      description: 'Agency admin helping to manage clients and stores',
      permissions: [
        'agencies.read',
        'clients.read',
        'clients.create',
        'stores.read',
        'stores.create',
        'products.read',
        'products.create',
        'orders.read',
        'orders.update',
        'integrations.read',
        'integrations.settings.update',
        'wms.view',
        'wms.print',
        'wms.labels.view',
        'wms.stock.view',
        'analytics.read',
        'analytics.integration.read',
        'system.settings.read',
        'integration.logs.read',
        'integration.logs.manage',
      ],
    },
    {
      name: 'client_admin',
      description: 'Client administrator managing stores, products, and orders',
      permissions: [
        'clients.read',
        'stores.read',
        'stores.create',
        'products.read',
        'products.create',
        'orders.read',
        'orders.update',
        'integrations.read',
        'wms.view',
        'wms.manage',
        'wms.print',
        'wms.settings.update',
        'wms.labels.view',
        'wms.labels.create',
        'wms.stock.view',
        'wms.stock.update',
        'analytics.read',
        'warehouse.settings.read',
        'warehouse.settings.manage',
        'stock.allocation.read',
      ],
    },
    {
      name: 'store_manager',
      description: 'Store manager focusing on operational products and orders',
      permissions: [
        'stores.read',
        'products.read',
        'products.create',
        'orders.read',
        'orders.update',
        'wms.view',
        'wms.print',
        'wms.labels.view',
        'wms.stock.view',
        'wms.stock.update',
      ],
    },
    {
      name: 'accountant',
      description: 'Accountant checking billing, financials, and exporting report audits',
      permissions: [
        'stores.read',
        'orders.read',
        'accounting.export',
        'analytics.read',
        'analytics.export',
        'analytics.financial.read',
      ],
    },
    {
      name: 'warehouse_staff',
      description: 'Warehouse staff managing stock levels and fulfillments',
      permissions: [
        'products.read',
        'orders.read',
        'warehouse.manage',
        'wms.view',
        'wms.print',
        'wms.labels.view',
        'wms.labels.create',
        'wms.stock.view',
        'wms.stock.update',
        'warehouse.settings.read',
        'stock.allocation.read',
      ],
    },
    {
      name: 'support',
      description: 'Customer support staff reading issues, tickets, and order logs',
      permissions: ['clients.read', 'stores.read', 'orders.read'],
    },
    {
      name: 'viewer',
      description: 'Read-only profile context viewer',
      permissions: ['agencies.read', 'clients.read', 'stores.read', 'products.read', 'orders.read'],
    },
  ];

  console.log('Seeding roles...');
  for (const roleDef of rolesList) {
    const permConnects = roleDef.permissions.map((pName) => ({ id: permissionsMap[pName].id }));

    // Disconnect old permissions and connect new ones to refresh seed
    await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        description: roleDef.description,
        permissions: {
          set: permConnects,
        },
      },
      create: {
        name: roleDef.name,
        description: roleDef.description,
        permissions: {
          connect: permConnects,
        },
      },
    });
  }

  // 3. Create a default global user (super_admin)
  console.log('Seeding default Super Admin user...');
  const defaultEmail = 'superadmin@kroptos.com';
  const defaultPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const superAdminRole = await prisma.role.findUnique({ where: { name: 'super_admin' } });
  if (!superAdminRole) {
    throw new Error('super_admin role not found after seeding roles');
  }

  const defaultUser = await prisma.user.upsert({
    where: { email: defaultEmail },
    update: { passwordHash: hashedPassword },
    create: {
      email: defaultEmail,
      passwordHash: hashedPassword,
      firstName: 'System',
      lastName: 'SuperAdmin',
      isActive: true,
    },
  });

  // Seed default Agency if not present
  const defaultAgency = await prisma.agency.upsert({
    where: { slug: 'system-agency' },
    update: {},
    create: {
      name: 'System Agency',
      slug: 'system-agency',
      isActive: true,
    },
  });

  // Map user to role
  await prisma.userRole.upsert({
    where: {
      userId_agencyId_roleId: {
        userId: defaultUser.id,
        agencyId: defaultAgency.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: defaultUser.id,
      agencyId: defaultAgency.id,
      roleId: superAdminRole.id,
    },
  });

  console.log('Seed completed successfully.');
  console.log(`Default Super Admin: ${defaultEmail} / ${defaultPassword}`);
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
