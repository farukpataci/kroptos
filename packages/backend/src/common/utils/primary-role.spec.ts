import { resolvePrimaryRole } from './primary-role';

const ur = (name: string, opts: { agencyId?: string; clientId?: string | null; storeId?: string | null; createdAt?: string } = {}) => ({
  agencyId: opts.agencyId ?? 'a1',
  clientId: opts.clientId ?? null,
  storeId: opts.storeId ?? null,
  createdAt: new Date(opts.createdAt ?? '2026-01-01'),
  role: { name },
});

describe('resolvePrimaryRole', () => {
  it('returns undefined for an empty list', () => {
    expect(resolvePrimaryRole([])).toBeUndefined();
  });

  it('(a) prefers the role that most specifically covers the requested context', () => {
    const agencyWide = ur('agency_owner');
    const storeScoped = ur('store_manager', { storeId: 's1' });
    const otherStore = ur('store_manager', { storeId: 's2' });

    expect(resolvePrimaryRole([agencyWide, storeScoped, otherStore], { agencyId: 'a1', storeId: 's1' })).toBe(storeScoped);
    // s2 rolü s1 bağlamını kapsamaz; ajans geneli kapsar
    expect(resolvePrimaryRole([agencyWide, otherStore], { agencyId: 'a1', storeId: 's1' })).toBe(agencyWide);
    // başka ajansın rolü hiç aday değil
    expect(resolvePrimaryRole([ur('super_admin', { agencyId: 'a2' })], { agencyId: 'a1' })).toBeUndefined();
  });

  it('(b) falls back to role priority regardless of row order', () => {
    const viewer = ur('viewer');
    const owner = ur('agency_owner');
    const unknown = ur('custom_role');

    expect(resolvePrimaryRole([viewer, owner])).toBe(owner);
    expect(resolvePrimaryRole([owner, viewer])).toBe(owner);
    // katalogda olmayan rol en sona düşer
    expect(resolvePrimaryRole([unknown, viewer])).toBe(viewer);
  });

  it('(c) breaks ties by createdAt ASC', () => {
    const newer = ur('viewer', { agencyId: 'a2', createdAt: '2026-03-01' });
    const older = ur('viewer', { agencyId: 'a1', createdAt: '2026-01-01' });

    expect(resolvePrimaryRole([newer, older])).toBe(older);
    expect(resolvePrimaryRole([older, newer])).toBe(older);
  });
});
