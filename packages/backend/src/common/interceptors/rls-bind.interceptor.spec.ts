import { of } from 'rxjs';
import { RlsBindInterceptor } from './rls-bind.interceptor';
import { MutableTenantContext, tenantContextStorage } from '../prisma/tenant-context';

// P12 Adım 2: istek bağlamı guard'lardan sonra RLS'e nasıl bağlanır.
describe('RlsBindInterceptor', () => {
  const interceptor = new RlsBindInterceptor();
  const run = (req: any) => {
    const ctx: MutableTenantContext = { mode: 'system', reason: 'request:pre-auth' };
    const exec: any = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) };
    tenantContextStorage.run(ctx as any, () => interceptor.intercept(exec, { handle: () => of(null) }));
    return ctx;
  };

  it('validated active agency → tenant mode', () => {
    expect(run({ activeAgency: { id: 'A' }, user: { agencyId: 'B', role: 'viewer', roleIsSystem: true } })).toEqual({ mode: 'tenant', agencyId: 'A' });
  });

  it('no header context → JWT agency, never the raw header', () => {
    expect(run({ headers: { 'x-agency-id': 'EVIL' }, user: { agencyId: 'A', role: 'viewer', roleIsSystem: true } })).toEqual({ mode: 'tenant', agencyId: 'A' });
  });

  it('platform super admin (key + isSystem from DB) → system', () => {
    expect(run({ activeAgency: { id: 'A' }, user: { agencyId: 'A', role: 'super_admin', roleIsSystem: true } })).toEqual({ mode: 'system', reason: 'super_admin' });
    // tenant rolu 'super_admin' adiyla bypass alamaz (P7 siniri)
    expect(run({ activeAgency: { id: 'A' }, user: { agencyId: 'A', role: 'super_admin', roleIsSystem: false } })).toEqual({ mode: 'tenant', agencyId: 'A' });
  });

  it('public route (no user, no agency) keeps the pre-auth system context', () => {
    expect(run({})).toEqual({ mode: 'system', reason: 'request:pre-auth' });
  });
});
