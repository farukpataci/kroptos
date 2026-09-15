import { PrismaClient, Prisma } from '@prisma/client';
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
    { name: 'carriers.read', description: 'View carrier connections' },
    { name: 'carriers.create', description: 'Add carrier connections' },
    { name: 'carriers.update', description: 'Change or test carrier connections' },
    { name: 'carriers.delete', description: 'Remove carrier connections' },
    { name: 'shipments.read', description: 'View shipments and tracking events' },
    { name: 'shipments.create', description: 'Create shipments and obtain barcodes' },
    { name: 'shipments.cancel', description: 'Cancel shipments at the carrier' },
    { name: 'shipments.label.print', description: 'Print or download shipping labels' },
    { name: 'shipments.handover', description: 'Hand parcels to the courier and print the manifest' },
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
    { name: 'accounting.read', description: 'View accounting integrations and documents' },
    { name: 'accounting.manage', description: 'Manage accounting integrations, companies, and emit invoices' },
    { name: 'accounting.documents.read', description: 'View accounting documents' },
    { name: 'accounting.documents.create', description: 'Create accounting invoice and payment documents' },
    // docs/mikro.agent.md §10 — accounting.credential.manage ve agent.manage AYRI izinlerdir
    { name: 'accounting.credential.manage', description: 'Submit ERP credentials to an Agent (end-to-end encrypted envelope)' },
    { name: 'accounting.invoice.push', description: 'Push invoices to ERP via the Agent route' },
    { name: 'agent.read', description: 'View KroptOS Agents and their job queue' },
    { name: 'agent.manage', description: 'Generate enrollment codes, assign and revoke KroptOS Agents' },
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
        'accounting.read',
        'accounting.manage',
        'accounting.documents.read',
        'accounting.documents.create',
        'accounting.credential.manage',
        'accounting.invoice.push',
        'agent.read',
        'agent.manage',
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
        'carriers.read',
        'carriers.create',
        'carriers.update',
        'carriers.delete',
        'shipments.read',
        'shipments.create',
        'shipments.cancel',
        'shipments.label.print',
        'shipments.handover',
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
        // agency_admin ajans icindeki kullanici/magaza yonetimine yardim eden rol;
        // denetim kaydini gorememesi bu rolun varlik sebebiyle celisiyordu.
        'audit.read',
        'integration.logs.read',
        'integration.logs.manage',
        'carriers.read',
        'shipments.read',
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
        'carriers.read',
        'carriers.create',
        'carriers.update',
        'carriers.delete',
        'shipments.read',
        'shipments.create',
        'shipments.cancel',
        'shipments.label.print',
        'shipments.handover',
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
        'carriers.read',
        'shipments.read',
        'shipments.create',
        'shipments.label.print',
        'shipments.handover',
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
        'carriers.read',
        'shipments.read',
        'shipments.create',
        'shipments.label.print',
        'shipments.handover',
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

  // 4. Seed Multi-tenant Test Data for Staging / Dev
  await seedTestTenants();

  console.log('Seed completed successfully.');
  console.log(`Default Super Admin: ${defaultEmail} / ${defaultPassword}`);
}

async function seedTestTenants() {
  const isProduction = process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_SEED !== 'true';
  if (isProduction) {
    console.log('Production environment detected (NODE_ENV=production). Skipping multi-tenant test data seed.');
    return;
  }

  const testPassword = process.env.SEED_TEST_PASSWORD;
  if (!testPassword) {
    console.warn('SEED_TEST_PASSWORD environment variable is not set. Skipping multi-tenant test data seed.');
    return;
  }

  console.log('Seeding multi-tenant test data for staging/dev...');
  const hashedTestPassword = await bcrypt.hash(testPassword, 10);

  const agencyAdminRole = await prisma.role.findUnique({ where: { name: 'agency_admin' } });
  const storeManagerRole = await prisma.role.findUnique({ where: { name: 'store_manager' } });
  const warehouseStaffRole = await prisma.role.findUnique({ where: { name: 'warehouse_staff' } });

  if (!agencyAdminRole || !storeManagerRole || !warehouseStaffRole) {
    throw new Error('Required roles (agency_admin, store_manager, warehouse_staff) not found');
  }

  // 1. Definition of 2 Agencies, Clients, and Stores
  const agencyConfigs = [
    {
      key: 'A',
      name: 'Test Ajans A',
      slug: 'test-ajans-a',
      publicId: 'tn_test_ajans_a',
      users: [
        { email: 'admin.a@test.kroptos.com', firstName: 'Admin', lastName: 'Ajans A', roleId: agencyAdminRole.id },
        { email: 'manager.a@test.kroptos.com', firstName: 'Manager', lastName: 'Ajans A', roleId: storeManagerRole.id },
        { email: 'staff.a@test.kroptos.com', firstName: 'Staff', lastName: 'Ajans A', roleId: warehouseStaffRole.id },
      ],
      clients: [
        {
          name: 'Ajans A Müşteri 1',
          contactEmail: 'musteri1.a@test.kroptos.com',
          stores: [
            { name: 'Ajans A - Mağaza 1A', slug: 'magaza-a1a', publicId: 'tn_store_a1a', prefix: 'A1A' },
            { name: 'Ajans A - Mağaza 1B', slug: 'magaza-a1b', publicId: 'tn_store_a1b', prefix: 'A1B' },
          ],
        },
        {
          name: 'Ajans A Müşteri 2',
          contactEmail: 'musteri2.a@test.kroptos.com',
          stores: [
            { name: 'Ajans A - Mağaza 2A', slug: 'magaza-a2a', publicId: 'tn_store_a2a', prefix: 'A2A' },
            { name: 'Ajans A - Mağaza 2B', slug: 'magaza-a2b', publicId: 'tn_store_a2b', prefix: 'A2B' },
          ],
        },
      ],
    },
    {
      key: 'B',
      name: 'Test Ajans B',
      slug: 'test-ajans-b',
      publicId: 'tn_test_ajans_b',
      users: [
        { email: 'admin.b@test.kroptos.com', firstName: 'Admin', lastName: 'Ajans B', roleId: agencyAdminRole.id },
        { email: 'manager.b@test.kroptos.com', firstName: 'Manager', lastName: 'Ajans B', roleId: storeManagerRole.id },
        { email: 'staff.b@test.kroptos.com', firstName: 'Staff', lastName: 'Ajans B', roleId: warehouseStaffRole.id },
      ],
      clients: [
        {
          name: 'Ajans B Müşteri 1',
          contactEmail: 'musteri1.b@test.kroptos.com',
          stores: [
            { name: 'Ajans B - Mağaza 1A', slug: 'magaza-b1a', publicId: 'tn_store_b1a', prefix: 'B1A' },
            { name: 'Ajans B - Mağaza 1B', slug: 'magaza-b1b', publicId: 'tn_store_b1b', prefix: 'B1B' },
          ],
        },
        {
          name: 'Ajans B Müşteri 2',
          contactEmail: 'musteri2.b@test.kroptos.com',
          stores: [
            { name: 'Ajans B - Mağaza 2A', slug: 'magaza-b2a', publicId: 'tn_store_b2a', prefix: 'B2A' },
            { name: 'Ajans B - Mağaza 2B', slug: 'magaza-b2b', publicId: 'tn_store_b2b', prefix: 'B2B' },
          ],
        },
      ],
    },
  ];

  let firstStoreOfA: any = null;
  const storeA1Products: any[] = [];

  for (const ac of agencyConfigs) {
    // Agency upsert
    const agency = await prisma.agency.upsert({
      where: { slug: ac.slug },
      update: { name: ac.name, publicId: ac.publicId, isActive: true },
      create: { name: ac.name, slug: ac.slug, publicId: ac.publicId, isActive: true },
    });

    await prisma.tenantSettings.upsert({
      where: { agencyId: agency.id },
      update: { companyName: `${ac.name} A.Ş.` },
      create: { agencyId: agency.id, companyName: `${ac.name} A.Ş.`, defaultCurrency: 'TRY' },
    });

    // Seed 3 users per agency (Admin, Manager, Staff) - strictly bound to their agency
    for (const u of ac.users) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: { passwordHash: hashedTestPassword, firstName: u.firstName, lastName: u.lastName, isActive: true },
        create: { email: u.email, passwordHash: hashedTestPassword, firstName: u.firstName, lastName: u.lastName, isActive: true },
      });

      await prisma.userRole.upsert({
        where: {
          userId_agencyId_roleId: {
            userId: user.id,
            agencyId: agency.id,
            roleId: u.roleId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          agencyId: agency.id,
          roleId: u.roleId,
        },
      });
    }

    // Seed 2 Clients & 2 Stores per client (4 stores per agency = 8 total)
    for (const clDef of ac.clients) {
      let client = await prisma.client.findFirst({
        where: { agencyId: agency.id, name: clDef.name },
      });
      if (!client) {
        client = await prisma.client.create({
          data: {
            agencyId: agency.id,
            name: clDef.name,
            contactEmail: clDef.contactEmail,
            contactPhone: '+905550000000',
            status: 'active',
            isActive: true,
          },
        });
      }

      for (const stDef of clDef.stores) {
        const store = await prisma.store.upsert({
          where: { publicId: stDef.publicId },
          update: {
            name: stDef.name,
            slug: stDef.slug,
            agencyId: agency.id,
            clientId: client.id,
            currency: 'TRY',
            status: 'active',
            isActive: true,
          },
          create: {
            publicId: stDef.publicId,
            name: stDef.name,
            slug: stDef.slug,
            agencyId: agency.id,
            clientId: client.id,
            currency: 'TRY',
            status: 'active',
            isActive: true,
          },
        });

        if (ac.key === 'A' && !firstStoreOfA) {
          firstStoreOfA = store;
        }

        // 3 Categories per store
        const categoriesDef = [
          { name: 'Elektronik', slug: `${stDef.slug}-elektronik` },
          { name: 'Moda & Giyim', slug: `${stDef.slug}-moda-giyim` },
          { name: 'Ev & Yaşam', slug: `${stDef.slug}-ev-yasam` },
        ];

        const seededCategories: any[] = [];
        for (const catDef of categoriesDef) {
          let cat = await prisma.category.findFirst({
            where: { storeId: store.id, slug: catDef.slug },
          });
          if (!cat) {
            cat = await prisma.category.create({
              data: {
                agencyId: agency.id,
                clientId: client.id,
                storeId: store.id,
                name: catDef.name,
                slug: catDef.slug,
                isActive: true,
                status: 'active',
              },
            });
          }
          seededCategories.push(cat);
        }

        // 10 Products per store + Inventory
        for (let i = 1; i <= 10; i++) {
          const sku = `${stDef.prefix}-PRD-${String(i).padStart(2, '0')}`;
          const prodName = `Test Ürün ${i} (${stDef.name})`;
          const price = 50 + i * 20;
          const assignedCat = seededCategories[(i - 1) % seededCategories.length];
          const prodPublicId = `prd_${stDef.prefix.toLowerCase()}_${String(i).padStart(2, '0')}`;

          const product = await prisma.product.upsert({
            where: {
              storeId_sku: {
                storeId: store.id,
                sku,
              },
            },
            update: {
              name: prodName,
              price: new Prisma.Decimal(price),
              basePrice: new Prisma.Decimal(price),
              stockQuantity: 100,
              categoryId: assignedCat.id,
              publicId: prodPublicId,
              isActive: true,
            },
            create: {
              storeId: store.id,
              sku,
              name: prodName,
              price: new Prisma.Decimal(price),
              basePrice: new Prisma.Decimal(price),
              currency: 'TRY',
              stockQuantity: 100,
              taxRate: 20,
              agencyId: agency.id,
              clientId: client.id,
              categoryId: assignedCat.id,
              publicId: prodPublicId,
              type: 'SIMPLE',
              isActive: true,
            },
          });

          if (store.id === firstStoreOfA?.id) {
            storeA1Products.push(product);
          }

          // Inventory record
          await prisma.inventory.upsert({
            where: {
              storeId_productId: {
                storeId: store.id,
                productId: product.id,
              },
            },
            update: {
              availableQty: 100,
              reservedQty: 0,
              defectiveQty: 0,
              reorderLevel: 10,
            },
            create: {
              agencyId: agency.id,
              storeId: store.id,
              productId: product.id,
              availableQty: 100,
              reservedQty: 0,
              defectiveQty: 0,
              reorderLevel: 10,
            },
          });
        }
      }
    }
  }

  // WMS for Agency A: 1 Warehouse, 2 Zones, 5 Locations
  const agencyA = await prisma.agency.findUniqueOrThrow({ where: { slug: 'test-ajans-a' } });
  const warehouseA = await prisma.warehouse.upsert({
    where: {
      agencyId_code: {
        agencyId: agencyA.id,
        code: 'WH-A-MAIN',
      },
    },
    update: {
      name: 'Ajans A Ana Depo',
      type: 'Main',
      city: 'İstanbul',
      district: 'Tuzla',
      capacity: 10000,
      isActive: true,
    },
    create: {
      agencyId: agencyA.id,
      name: 'Ajans A Ana Depo',
      code: 'WH-A-MAIN',
      type: 'Main',
      city: 'İstanbul',
      district: 'Tuzla',
      capacity: 10000,
      publicId: 'wh_ajans_a_main',
      isActive: true,
    },
  });

  const zoneReceiving = await prisma.warehouseZone.upsert({
    where: {
      warehouseId_code: {
        warehouseId: warehouseA.id,
        code: 'ZONE-A-RCV',
      },
    },
    update: {
      name: 'Mal Kabul Alanı',
      type: 'receiving',
      priority: 1,
      isActive: true,
    },
    create: {
      warehouseId: warehouseA.id,
      code: 'ZONE-A-RCV',
      name: 'Mal Kabul Alanı',
      type: 'receiving',
      priority: 1,
      isActive: true,
    },
  });

  const zonePicking = await prisma.warehouseZone.upsert({
    where: {
      warehouseId_code: {
        warehouseId: warehouseA.id,
        code: 'ZONE-A-PCK',
      },
    },
    update: {
      name: 'Sipariş Toplama Alanı',
      type: 'picking',
      priority: 2,
      isActive: true,
    },
    create: {
      warehouseId: warehouseA.id,
      code: 'ZONE-A-PCK',
      name: 'Sipariş Toplama Alanı',
      type: 'picking',
      priority: 2,
      isActive: true,
    },
  });

  const locationsDef = [
    { zoneId: zoneReceiving.id, code: 'LOC-A-RCV-01', aisle: 'R', shelf: '1', bin: '1', level: '1', barcode: 'BC-A-RCV-01' },
    { zoneId: zoneReceiving.id, code: 'LOC-A-RCV-02', aisle: 'R', shelf: '1', bin: '2', level: '1', barcode: 'BC-A-RCV-02' },
    { zoneId: zonePicking.id, code: 'LOC-A-PCK-01', aisle: 'P', shelf: '1', bin: '1', level: '1', barcode: 'BC-A-PCK-01' },
    { zoneId: zonePicking.id, code: 'LOC-A-PCK-02', aisle: 'P', shelf: '1', bin: '2', level: '1', barcode: 'BC-A-PCK-02' },
    { zoneId: zonePicking.id, code: 'LOC-A-PCK-03', aisle: 'P', shelf: '2', bin: '1', level: '2', barcode: 'BC-A-PCK-03' },
  ];

  for (const loc of locationsDef) {
    await prisma.warehouseLocation.upsert({
      where: {
        warehouseId_code: {
          warehouseId: warehouseA.id,
          code: loc.code,
        },
      },
      update: {
        zoneId: loc.zoneId,
        aisle: loc.aisle,
        shelf: loc.shelf,
        bin: loc.bin,
        level: loc.level,
        barcode: loc.barcode,
        isActive: true,
      },
      create: {
        warehouseId: warehouseA.id,
        zoneId: loc.zoneId,
        code: loc.code,
        aisle: loc.aisle,
        shelf: loc.shelf,
        bin: loc.bin,
        level: loc.level,
        barcode: loc.barcode,
        isActive: true,
      },
    });
  }

  // Ajans A'nın ilk store'unda 5 sipariş (farklı statülerde) + order items + timeline
  if (firstStoreOfA && storeA1Products.length >= 5) {
    const ordersSeedData = [
      {
        orderNumber: 'ORD-A1-001',
        status: 'pending',
        paymentStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        customerName: 'Ahmet Yılmaz',
        customerEmail: 'ahmet.yilmaz@example.com',
        customerPhone: '+905321112233',
        shippingAddress: 'Bağdat Caddesi No:10',
        shippingCity: 'İstanbul',
        shippingDistrict: 'Kadıköy',
        shippingCountryCode: 'TR',
        publicId: 'ord_test_a1_001',
        items: [{ product: storeA1Products[0], quantity: 1 }],
        timeline: [{ eventType: 'order_created', newValue: 'pending' }],
      },
      {
        orderNumber: 'ORD-A1-002',
        status: 'processing',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        customerName: 'Ayşe Kaya',
        customerEmail: 'ayse.kaya@example.com',
        customerPhone: '+905332223344',
        shippingAddress: 'Tunalı Hilmi Caddesi No:45',
        shippingCity: 'Ankara',
        shippingDistrict: 'Çankaya',
        shippingCountryCode: 'TR',
        publicId: 'ord_test_a1_002',
        items: [
          { product: storeA1Products[1], quantity: 1 },
          { product: storeA1Products[2], quantity: 1 },
        ],
        timeline: [
          { eventType: 'order_created', newValue: 'pending' },
          { eventType: 'payment_received', oldValue: 'pending', newValue: 'paid' },
          { eventType: 'order_processing', oldValue: 'pending', newValue: 'processing' },
        ],
      },
      {
        orderNumber: 'ORD-A1-003',
        status: 'shipped',
        paymentStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        customerName: 'Mehmet Demir',
        customerEmail: 'mehmet.demir@example.com',
        customerPhone: '+905343334455',
        shippingAddress: 'Kordon Boyu No:12',
        shippingCity: 'İzmir',
        shippingDistrict: 'Konak',
        shippingCountryCode: 'TR',
        publicId: 'ord_test_a1_003',
        items: [{ product: storeA1Products[3], quantity: 1 }],
        timeline: [
          { eventType: 'order_created', newValue: 'pending' },
          { eventType: 'payment_received', oldValue: 'pending', newValue: 'paid' },
          { eventType: 'order_shipped', oldValue: 'processing', newValue: 'shipped' },
        ],
      },
      {
        orderNumber: 'ORD-A1-004',
        status: 'delivered',
        paymentStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        customerName: 'Zeynep Şahin',
        customerEmail: 'zeynep.sahin@example.com',
        customerPhone: '+905354445566',
        shippingAddress: 'Atatürk Bulvarı No:88',
        shippingCity: 'Bursa',
        shippingDistrict: 'Nilüfer',
        shippingCountryCode: 'TR',
        publicId: 'ord_test_a1_004',
        items: [{ product: storeA1Products[4], quantity: 2 }],
        timeline: [
          { eventType: 'order_created', newValue: 'pending' },
          { eventType: 'payment_received', oldValue: 'pending', newValue: 'paid' },
          { eventType: 'order_shipped', oldValue: 'processing', newValue: 'shipped' },
          { eventType: 'order_delivered', oldValue: 'shipped', newValue: 'delivered' },
        ],
      },
      {
        orderNumber: 'ORD-A1-005',
        status: 'cancelled',
        paymentStatus: 'refunded',
        fulfillmentStatus: 'returned',
        customerName: 'Burak Koç',
        customerEmail: 'burak.koc@example.com',
        customerPhone: '+905365556677',
        shippingAddress: 'Lara Caddesi No:22',
        shippingCity: 'Antalya',
        shippingDistrict: 'Muratpaşa',
        shippingCountryCode: 'TR',
        publicId: 'ord_test_a1_005',
        items: [{ product: storeA1Products[0], quantity: 1 }],
        timeline: [
          { eventType: 'order_created', newValue: 'pending' },
          { eventType: 'order_cancelled', oldValue: 'pending', newValue: 'cancelled' },
        ],
      },
    ];

    for (const od of ordersSeedData) {
      let totalAmount = new Prisma.Decimal(0);
      const itemsToCreate = od.items.map((it) => {
        const lineTotal = new Prisma.Decimal(it.product.price).mul(it.quantity);
        totalAmount = totalAmount.add(lineTotal);
        return {
          productId: it.product.id,
          sku: it.product.sku,
          name: it.product.name,
          quantity: it.quantity,
          unitPrice: it.product.price,
          totalPrice: lineTotal,
        };
      });

      const order = await prisma.order.upsert({
        where: {
          storeId_orderNumber: {
            storeId: firstStoreOfA.id,
            orderNumber: od.orderNumber,
          },
        },
        update: {
          status: od.status,
          paymentStatus: od.paymentStatus,
          fulfillmentStatus: od.fulfillmentStatus,
          totalAmount,
          customerName: od.customerName,
          customerEmail: od.customerEmail,
          customerPhone: od.customerPhone,
          shippingAddress: od.shippingAddress,
          shippingCity: od.shippingCity,
          shippingDistrict: od.shippingDistrict,
          shippingCountryCode: od.shippingCountryCode,
        },
        create: {
          storeId: firstStoreOfA.id,
          agencyId: agencyA.id,
          clientId: firstStoreOfA.clientId,
          orderNumber: od.orderNumber,
          status: od.status,
          paymentStatus: od.paymentStatus,
          fulfillmentStatus: od.fulfillmentStatus,
          totalAmount,
          currency: 'TRY',
          customerName: od.customerName,
          customerEmail: od.customerEmail,
          customerPhone: od.customerPhone,
          shippingAddress: od.shippingAddress,
          shippingCity: od.shippingCity,
          shippingDistrict: od.shippingDistrict,
          shippingCountryCode: od.shippingCountryCode,
          createdBy: 'system-seed',
          publicId: od.publicId,
        },
      });

      // Idempotent items
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      for (const it of itemsToCreate) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            ...it,
          },
        });
      }

      // Idempotent timeline
      await prisma.orderTimeline.deleteMany({ where: { orderId: order.id } });
      for (const tl of od.timeline) {
        await prisma.orderTimeline.create({
          data: {
            orderId: order.id,
            eventType: tl.eventType,
            oldValue: tl.oldValue ?? null,
            newValue: tl.newValue ?? null,
          },
        });
      }
    }
  }

  console.log('Multi-tenant test data seeding complete.');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
