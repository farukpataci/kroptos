import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { runWithTenant } from '../src/common/prisma/tenant-context';

/**
 * P12 Adım 3 — kiracı izolasyonu, uçtan uca (gerçek HTTP + gerçek Postgres + RLS).
 *
 * Çalışan API'ye vurur (:3101 deseni):
 *   API_PORT=3101 CORS_ORIGINS=http://localhost:3100 node dist/main.js
 *   pnpm test:e2e            (E2E_API_URL ile başka adres)
 * Ulaşılamazsa atlamaz, patlar: sessizce koşmayan kanıt kanıt değildir.
 *
 * Fixture superuser bağlantısıyla (DATABASE_MIGRATION_URL) kurulur — uygulama rolü
 * (kroptos_app) bağlamsız yazamaz; afterAll'da silinir ve satır sayıları başa döner.
 * RLS'in kendisi uygulamanın PrismaService'i (kroptos_app + uzantı) üzerinden
 * ölçülür: uygulama filtresi KASITLI olarak yok, satırı yalnız Postgres gizler.
 */
loadEnv({ path: join(__dirname, '../.env') });
const API = process.env.E2E_API_URL ?? 'http://localhost:3101/api';
const PASSWORD = 'E2e-Pass-123!';
const TAG = `e2e${Date.now().toString(36)}`;
const TABLES = ['agency', 'client', 'store', 'user', 'userRole', 'role', 'product', 'invitation', 'session', 'refreshToken', 'auditLog'] as const;

type Ctx = { agencyId: string; clientId?: string; storeId?: string };
async function http(method: string, path: string, token?: string | null, ctx?: Ctx | null, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (ctx) {
    headers['x-agency-id'] = ctx.agencyId;
    if (ctx.clientId) headers['x-client-id'] = ctx.clientId;
    if (ctx.storeId) headers['x-store-id'] = ctx.storeId;
  }
  const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json: any = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
const login = async (email: string) => {
  const r = await http('POST', '/auth/login', null, null, { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${JSON.stringify(r.json)}`);
  return r.json as { accessToken: string; refreshToken: string };
};

describe('tenant isolation, end to end', () => {
  const su = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_MIGRATION_URL } } });
  const app = new PrismaService(); // kroptos_app: RLS altında
  const before: Record<string, number> = {};
  const made = { agencies: [] as string[], users: [] as string[], roles: [] as string[] };
  const counts = async () => { const c: Record<string, number> = {}; for (const t of TABLES) c[t] = await (su as any)[t].count(); return c; };

  let ownerRoleId: string; let viewerRoleId: string; let adminRoleId: string;
  let A: { agency: any; client: any; store: any; owner: any; product: any };
  let B: { agency: any; client: any; store: any; owner: any; product: any; role: any };
  let tokA: string;
  const ctxA = () => ({ agencyId: A.agency.id });

  const mkAgency = async (k: string) => {
    const agency = await su.agency.create({ data: { name: `${TAG}-${k}`, slug: `${TAG}-${k}` } });
    made.agencies.push(agency.id);
    const client = await su.client.create({ data: { agencyId: agency.id, name: `${TAG}-c${k}`, contactEmail: `${TAG}-${k}@e2e.local` } });
    const store = await su.store.create({ data: { agencyId: agency.id, clientId: client.id, name: `${TAG}-s${k}` } });
    const product = await su.product.create({ data: { agencyId: agency.id, clientId: client.id, storeId: store.id, sku: `${TAG}-${k}-SKU`, name: `p${k}`, basePrice: 1, price: 1 } });
    return { agency, client, store, product };
  };
  const mkUser = async (k: string, agencyId: string, roleId: string, extra: Record<string, unknown> = {}) => {
    const user = await su.user.create({ data: { email: `${TAG}-${k}@e2e.local`, passwordHash: await bcrypt.hash(PASSWORD, 10), firstName: 'E2E', lastName: k, isActive: true } });
    made.users.push(user.id);
    const ur = await su.userRole.create({ data: { userId: user.id, agencyId, roleId, ...extra } });
    return { ...user, userRoleId: ur.id };
  };

  beforeAll(async () => {
    const ping = await fetch(API + '/auth/me').catch(() => null);
    if (!ping) throw new Error(`API ulaşılamıyor: ${API} — önce backend'i başlat (API_PORT=3101 node dist/main.js)`);
    if (!process.env.DATABASE_MIGRATION_URL) throw new Error('DATABASE_MIGRATION_URL yok (.env) — fixture superuser ister');
    Object.assign(before, await counts());

    const sys = async (key: string) => (await su.role.findFirst({ where: { key, isSystem: true, agencyId: null, deletedAt: null } }))!.id;
    ownerRoleId = await sys('agency_owner'); viewerRoleId = await sys('viewer'); adminRoleId = await sys('agency_admin');

    const a = await mkAgency('A'); const b = await mkAgency('B');
    A = { ...a, owner: await mkUser('ownerA', a.agency.id, ownerRoleId) };
    const roleB = await su.role.create({ data: { agencyId: b.agency.id, key: `${TAG}-rb`, name: 'RoleB', isSystem: false } });
    made.roles.push(roleB.id);
    B = { ...b, owner: await mkUser('ownerB', b.agency.id, ownerRoleId), role: roleB };
    tokA = (await login(A.owner.email)).accessToken;
  }, 60_000);

  afterAll(async () => {
    try {
      await su.auditLog.deleteMany({ where: { OR: [{ tenantId: { in: made.agencies } }, { userId: { in: made.users } }] } });
      await su.session.deleteMany({ where: { userId: { in: made.users } } });
      await su.refreshToken.deleteMany({ where: { userId: { in: made.users } } });
      await su.userRole.deleteMany({ where: { OR: [{ userId: { in: made.users } }, { roleId: { in: made.roles } }] } });
      await su.invitation.deleteMany({ where: { agencyId: { in: made.agencies } } });
      await su.role.deleteMany({ where: { id: { in: made.roles } } });
      await su.user.deleteMany({ where: { id: { in: made.users } } });
      await su.agency.deleteMany({ where: { id: { in: made.agencies } } });
      const after = await counts();
      const diff = TABLES.filter((t) => before[t] !== after[t]).map((t) => `${t}: ${before[t]}→${after[t]}`);
      expect(diff).toEqual([]);
    } finally {
      await su.$disconnect();
      await app.$disconnect();
    }
  }, 60_000);

  it("A kullanıcısı B'nin x-agency-id header'ıyla → 403", async () => {
    const r = await http('GET', '/products', tokA, { agencyId: B.agency.id });
    expect(r.status).toBe(403);
  });

  it("A kullanıcısı B'nin ürün id'siyle GET → 404 (403 değil: product.get kapsamsız okur, satırı RLS gizler)", async () => {
    const r = await http('GET', `/products/${B.product.id}`, tokA, ctxA());
    expect(r.status).toBe(404);
  });

  it("A kullanıcısı B'nin rolünü PATCH → 404", async () => {
    const r = await http('PATCH', `/system/roles/${B.role.id}`, tokA, ctxA(), { name: 'Renamed' });
    expect(r.status).toBe(404);
    expect((await su.role.findUnique({ where: { id: B.role.id } }))!.name).toBe('RoleB');
  });

  it('uygulama filtresi KASITLI kaldırılmış sorgu: RLS satırı gizler (boş döner)', async () => {
    // where'de agencyId YOK; A bağlamında B ürünü görünmez, filtre tamamen Postgres'te.
    const byId = await runWithTenant(A.agency.id, () => app.product.findMany({ where: { id: B.product.id } }));
    expect(byId).toEqual([]);
    const all = await runWithTenant(A.agency.id, () => app.product.findMany({ where: { sku: { startsWith: TAG } } }));
    expect(all.map((p) => p.id)).toEqual([A.product.id]);
    // aynı sorgu superuser'da iki satır: fark yalnız RLS
    expect((await su.product.count({ where: { sku: { startsWith: TAG } } })).valueOf()).toBe(2);
  });

  it('WITH CHECK: app.agency_id=A iken agencyId=B INSERT reddedilir', async () => {
    await expect(
      runWithTenant(A.agency.id, () =>
        app.product.create({ data: { agencyId: B.agency.id, clientId: B.client.id, storeId: B.store.id, sku: `${TAG}-leak`, name: 'leak', basePrice: 1 } }),
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await su.product.count({ where: { sku: `${TAG}-leak` } })).toBe(0);
  });

  it('davet token’ı iki kez kullanılamıyor', async () => {
    const inv = await http('POST', '/system/invitations', tokA, ctxA(), { email: `${TAG}-invited@e2e.local`, roleId: viewerRoleId });
    expect(inv.status).toBe(201);
    const token = String(inv.json.devInviteUrl).split('/invite/')[1];
    expect(token).toBeTruthy();
    const first = await http('POST', `/invitations/${token}/accept`, null, null, { password: PASSWORD, firstName: 'In', lastName: 'Vited' });
    expect(first.status).toBe(200);
    const invited = await su.user.findUnique({ where: { email: `${TAG}-invited@e2e.local` } });
    made.users.push(invited!.id);
    const second = await http('POST', `/invitations/${token}/accept`, null, null, { password: PASSWORD });
    expect([400, 404, 409, 410]).toContain(second.status);
    expect(await su.userRole.count({ where: { userId: invited!.id, deletedAt: null } })).toBe(1);
  });

  it('rolü düşürülen kullanıcının eski token’ı 401', async () => {
    const v = await mkUser('victim', A.agency.id, viewerRoleId);
    const tok = (await login(v.email)).accessToken;
    expect((await http('GET', '/auth/me', tok, ctxA())).status).toBe(200);
    const rev = await http('POST', '/rbac/revoke', tokA, ctxA(), { userRoleId: v.userRoleId });
    expect(rev.status).toBe(200);
    expect((await http('GET', '/auth/me', tok, null)).status).toBe(401);
  });

  it('son agency_owner çıkarılamıyor', async () => {
    const admin = await mkUser('adminA', A.agency.id, adminRoleId);
    const tokAdmin = (await login(admin.email)).accessToken;
    const r = await http('DELETE', `/system/users/${A.owner.id}`, tokAdmin, ctxA());
    expect(r.status).toBe(400);
    expect(await su.userRole.count({ where: { userId: A.owner.id, roleId: ownerRoleId, deletedAt: null } })).toBe(1);
  });

  it('register sonrası rol agency_owner (P1)', async () => {
    const email = `${TAG}-reg@e2e.local`;
    const r = await http('POST', '/auth/register', null, null, { email, password: PASSWORD, firstName: 'Reg', lastName: 'User', agencyName: `${TAG}-regagency` });
    expect(r.status).toBe(201);
    const user = await su.user.findUnique({ where: { email }, include: { userRoles: { include: { role: true } } } });
    made.users.push(user!.id);
    made.agencies.push(user!.userRoles[0].agencyId);
    expect(user!.userRoles.map((ur) => ur.role.key)).toEqual(['agency_owner']);
    expect((await http('GET', '/auth/me', r.json.accessToken, null)).json.user.role).toBe('agency_owner');
  });

  it("key='super_admin', isSystem=false tenant rolü bypass almıyor (P7)", async () => {
    const fake = await su.role.create({
      data: { agencyId: A.agency.id, key: 'super_admin', name: 'Sahte', isSystem: false, permissions: { connect: [{ name: 'products.read' }, { name: 'clients.read' }] } },
    });
    made.roles.push(fake.id);
    const u = await mkUser('fakesa', A.agency.id, fake.id);
    const tok = (await login(u.email)).accessToken;
    expect((await http('GET', `/products/${B.product.id}`, tok, ctxA())).status).toBe(404);
    const clients = await http('GET', '/clients', tok, ctxA());
    expect(clients.status).toBe(200);
    expect(clients.json.map((c: any) => c.agencyId)).toEqual([A.agency.id]);
    expect((await http('GET', '/products', tok, { agencyId: B.agency.id })).status).toBe(403);
  });

  it('mağaza kapsamlı kullanıcı kilitlenmiyor (P2.6)', async () => {
    const s = await mkUser('storeA', A.agency.id, viewerRoleId, { clientId: A.client.id, storeId: A.store.id });
    const tok = (await login(s.email)).accessToken;
    const me = await http('GET', '/auth/me', tok, null);
    expect(me.status).toBe(200);
    expect(me.json.accessibleTenants.some((t: any) => t.storeId === A.store.id && t.permissions.includes('products.read'))).toBe(true);
    expect((await http('GET', '/products', tok, { agencyId: A.agency.id, clientId: A.client.id, storeId: A.store.id })).status).toBe(200);
  });

  it("client/store create'e body'den ajans geçirilemiyor (Adım 0a)", async () => {
    const bClients = await su.client.count({ where: { agencyId: B.agency.id } });
    const bStores = await su.store.count({ where: { agencyId: B.agency.id } });
    expect((await http('POST', '/clients', tokA, ctxA(), { agencyId: B.agency.id, name: 'leak', email: `${TAG}-leak@e2e.local` })).status).toBe(400);
    expect((await http('POST', '/stores', tokA, ctxA(), { agencyId: B.agency.id, clientId: B.client.id, name: 'leak' })).status).toBe(400);
    const ok = await http('POST', '/clients', tokA, ctxA(), { name: 'okC', email: `${TAG}-ok@e2e.local` });
    expect(ok.status).toBe(201);
    expect(ok.json.agencyId).toBe(A.agency.id);
    expect(await su.client.count({ where: { agencyId: B.agency.id } })).toBe(bClients);
    expect(await su.store.count({ where: { agencyId: B.agency.id } })).toBe(bStores);
  });
});
