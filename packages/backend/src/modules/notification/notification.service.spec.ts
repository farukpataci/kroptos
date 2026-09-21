import { NotificationDispatcher } from './notification-dispatcher';
import { NotificationService, scopeKey } from './notification.service';

/**
 * Mock'lu birim testi: fallback sırası, idempotency ve olay eşlemesi. Sorgunun
 * ŞEKLİ değil kararı test ediliyor; canlı kanıt commit gövdesinde (RLS altında probe).
 */
const row = (level: 'AGENCY' | 'CLIENT' | 'STORE', clientId: string | null, storeId: string | null, extra: any = {}) => ({
  id: `${level}-row`,
  agencyId: 'A',
  clientId,
  storeId,
  scopeKey: scopeKey(clientId, storeId),
  scopeLevel: level,
  channel: 'EMAIL',
  event: 'ORDER_SHIPPED',
  orderStatusKey: '',
  locale: 'tr',
  name: level,
  subject: 's',
  bodyHtml: '<p>b</p>',
  bodyText: '',
  isActive: true,
  sendDelayMinutes: 0,
  ...extra,
});

function make(rows: any[], logs: any[] = []) {
  const prisma: any = {
    notificationTemplate: {
      findMany: jest.fn(async ({ where }: any) => rows.filter((r) => where.scopeKey.in.includes(r.scopeKey) && (where.isActive === undefined || r.isActive === where.isActive))),
      findFirst: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
    },
    notificationLog: {
      findFirst: jest.fn(async () => logs[0] ?? null),
      // Kuyruk yok (test) → satır içi işlenir; sağlayıcı da yok → SKIPPED.
      findUnique: jest.fn(async () => ({ id: 'log-1', status: 'QUEUED' })),
      create: jest.fn(async ({ data }: any) => ({ id: 'log-1', ...data })),
      update: jest.fn(async () => ({})),
    },
  };
  const providers: any = { emailProvider: jest.fn(async () => null), smsProvider: jest.fn(async () => null) };
  const config: any = { get: () => undefined };
  const svc = new NotificationService(prisma, providers, config);
  return { svc, prisma };
}

describe('NotificationService.resolve — STORE > CLIENT > AGENCY > SYSTEM', () => {
  const scope = { agencyId: 'A', clientId: 'C1', storeId: 'S1' };

  it('store row wins over client and agency rows', async () => {
    const { svc } = make([row('AGENCY', null, null), row('CLIENT', 'C1', null), row('STORE', 'C1', 'S1')]);
    const t = await svc.resolve(scope, 'EMAIL', 'ORDER_SHIPPED', 'tr');
    expect(t?.resolvedFrom).toBe('STORE');
  });

  it('falls to client, then agency, then system', async () => {
    expect((await make([row('AGENCY', null, null), row('CLIENT', 'C1', null)]).svc.resolve(scope, 'EMAIL', 'ORDER_SHIPPED', 'tr'))?.resolvedFrom).toBe('CLIENT');
    expect((await make([row('AGENCY', null, null)]).svc.resolve(scope, 'EMAIL', 'ORDER_SHIPPED', 'tr'))?.resolvedFrom).toBe('AGENCY');
    const sys = await make([]).svc.resolve(scope, 'EMAIL', 'ORDER_SHIPPED', 'tr');
    expect(sys?.resolvedFrom).toBe('SYSTEM');
    expect(sys?.id).toBe('sys:EMAIL:ORDER_SHIPPED:tr');
  });

  it('another store/client row is not a candidate', async () => {
    const { svc } = make([row('STORE', 'C1', 'S2'), row('CLIENT', 'C2', null)]);
    expect((await svc.resolve(scope, 'EMAIL', 'ORDER_SHIPPED', 'tr'))?.resolvedFrom).toBe('SYSTEM');
  });

  it('inactive row is skipped when sending, visible when listing', async () => {
    const { svc } = make([row('AGENCY', null, null), row('STORE', 'C1', 'S1', { isActive: false })]);
    expect((await svc.resolve(scope, 'EMAIL', 'ORDER_SHIPPED', 'tr', '', true))?.resolvedFrom).toBe('AGENCY');
    expect((await svc.resolve(scope, 'EMAIL', 'ORDER_SHIPPED', 'tr', '', false))?.resolvedFrom).toBe('STORE');
  });

  it('custom order status has no system fallback', async () => {
    expect(await make([]).svc.resolve(scope, 'EMAIL', 'ORDER_STATUS_CHANGED', 'tr', 'paketlendi')).toBeNull();
  });
});

describe('NotificationService.enqueue — idempotency', () => {
  it('skips a second real send for the same (orderId, event, channel)', async () => {
    const { svc, prisma } = make([], [{ id: 'existing' }]);
    const template: any = { ...row('AGENCY', null, null), resolvedFrom: 'AGENCY' };
    const res = await svc.enqueue({ scope: { agencyId: 'A' }, template, recipient: 'a@b.c', context: {}, orderId: 'O1' });
    expect(res).toEqual({ skipped: 'duplicate', logId: 'existing' });
    expect(prisma.notificationLog.create).not.toHaveBeenCalled();
  });

  it('a test send never counts as a duplicate and is logged with isTest', async () => {
    const template: any = { ...row('AGENCY', null, null), resolvedFrom: 'AGENCY' };
    const { svc, prisma } = make([template], [{ id: 'existing' }]);
    const res = await svc.enqueue({ scope: { agencyId: 'A' }, template, recipient: 'a@b.c', context: {}, orderId: 'O1', isTest: true });
    expect(res.skipped).toBeNull();
    expect(prisma.notificationLog.create.mock.calls[0][0].data).toMatchObject({ isTest: true, recipient: 'a***@b.c', status: 'QUEUED' });
    // sağlayıcı ayarsız → SKIPPED + neden
    expect(prisma.notificationLog.update.mock.calls.at(-1)[0].data).toMatchObject({ status: 'SKIPPED', errorMessage: 'E-mail provider not configured' });
  });
});

describe('NotificationDispatcher.eventFor', () => {
  const base = { orderId: 'O', agencyId: 'A', clientId: null, storeId: 'S' };
  it('maps system statuses, payments and custom statuses', () => {
    expect(NotificationDispatcher.eventFor({ ...base, kind: 'created', newValue: 'pending' })).toEqual({ event: 'ORDER_CREATED', orderStatusKey: '' });
    expect(NotificationDispatcher.eventFor({ ...base, kind: 'status', newValue: 'shipped' })).toEqual({ event: 'ORDER_SHIPPED', orderStatusKey: '' });
    expect(NotificationDispatcher.eventFor({ ...base, kind: 'status', newValue: 'pending' })).toBeNull();
    expect(NotificationDispatcher.eventFor({ ...base, kind: 'status', newValue: 'paketlendi' })).toEqual({ event: 'ORDER_STATUS_CHANGED', orderStatusKey: 'paketlendi' });
    expect(NotificationDispatcher.eventFor({ ...base, kind: 'payment', newValue: 'paid' })).toEqual({ event: 'PAYMENT_RECEIVED', orderStatusKey: '' });
    expect(NotificationDispatcher.eventFor({ ...base, kind: 'payment', newValue: 'pending' })).toBeNull();
    expect(NotificationDispatcher.eventFor({ ...base, kind: 'cancelled', newValue: 'cancelled' })).toEqual({ event: 'ORDER_CANCELLED', orderStatusKey: '' });
  });
});
