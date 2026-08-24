/**
 * Carrier and shipment permissions into an existing database.
 *
 * Re-run after `shipments.handover` was added: the upserts are by name and the
 * role grants use `connect`, so a second run only adds what is missing.
 *
 * `prisma/seed.ts` already declares these, but it cannot be run against a live
 * database to get them: two of its writes are not idempotent.
 *
 *   1. It upserts the super admin with `update: { passwordHash }`, which resets
 *      that account's password to the default on every run.
 *   2. It upserts roles with `permissions: { set: [...] }`. `set` replaces the
 *      whole list, so any permission granted to a seeded role outside the seed
 *      file is silently disconnected.
 *
 * This script does the one thing that is missing and nothing else: it upserts
 * the eight permissions by name and `connect`s them to the roles seed.ts
 * already names for them. `connect` is additive — an existing grant is left
 * alone, and no role loses anything. Running it twice changes nothing.
 *
 *   npx ts-node prisma/scripts/backfill-carrier-permissions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS: { name: string; description: string }[] = [
  { name: 'carriers.read', description: 'View carrier connections' },
  { name: 'carriers.create', description: 'Add carrier connections' },
  { name: 'carriers.update', description: 'Change or test carrier connections' },
  { name: 'carriers.delete', description: 'Remove carrier connections' },
  { name: 'shipments.read', description: 'View shipments and tracking events' },
  { name: 'shipments.create', description: 'Create shipments and obtain barcodes' },
  { name: 'shipments.cancel', description: 'Cancel shipments at the carrier' },
  { name: 'shipments.label.print', description: 'Print or download shipping labels' },
  { name: 'shipments.handover', description: 'Hand parcels to the courier and print the manifest' },
];

/** Copied from prisma/seed.ts — this script does not invent a mapping. */
const ROLE_GRANTS: Record<string, string[]> = {
  agency_owner: PERMISSIONS.map((p) => p.name),
  client_admin: PERMISSIONS.map((p) => p.name),
  agency_admin: ['carriers.read', 'shipments.read'],
  store_manager: [
    'carriers.read',
    'shipments.read',
    'shipments.create',
    'shipments.label.print',
    'shipments.handover',
  ],
  warehouse_staff: [
    'carriers.read',
    'shipments.read',
    'shipments.create',
    'shipments.label.print',
    'shipments.handover',
  ],
};

const COUNTED = [
  'permission',
  'role',
  'userRole',
  'user',
  'agency',
  'store',
  'carrierIntegration',
  'shipment',
] as const;

async function counts(label: string) {
  const out: Record<string, number> = {};
  for (const model of COUNTED) out[model] = await (prisma as any)[model].count();
  console.log(`--- ${label} ---`);
  console.table(out);
  return out;
}

async function main() {
  const before = await counts('ONCE');

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  const missingRoles: string[] = [];
  for (const [roleName, permissionNames] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      missingRoles.push(roleName);
      continue;
    }
    await prisma.role.update({
      where: { id: role.id },
      // connect, never set: this adds the carrier grants and touches nothing else.
      data: { permissions: { connect: permissionNames.map((name) => ({ name })) } },
    });
  }

  if (missingRoles.length) {
    console.log('DB-de bulunmayan roller (atlandi):', missingRoles.join(', '));
  }

  const after = await counts('SONRA');
  console.log('permission farki:', after.permission - before.permission);

  console.log('--- IZIN -> ROL ESLESMESI ---');
  const rows = [];
  for (const permission of PERMISSIONS) {
    const withRoles = await prisma.permission.findUnique({
      where: { name: permission.name },
      include: { roles: { select: { name: true }, orderBy: { name: 'asc' } } },
    });
    rows.push({
      permission: permission.name,
      roles: withRoles ? withRoles.roles.map((r) => r.name).join(', ') : 'YOK',
    });
  }
  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
