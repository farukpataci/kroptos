import { IdeasoftOauthStateService } from './ideasoft-oauth-state.service';

// P14-1: state tek kullanımlık, süreli, bağlı.
describe('IdeasoftOauthStateService', () => {
  const svc = new IdeasoftOauthStateService();
  const bound = { userId: 'u', agencyId: 'a', integrationId: 'i' };

  it('issues a 64-hex state and consumes it exactly once', () => {
    const state = svc.issue(bound);
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(svc.consume(state)).toMatchObject(bound);
    expect(svc.consume(state)).toBeNull(); // tekrar kullanım
  });

  it('rejects unknown, malformed and expired states', () => {
    expect(svc.consume(undefined)).toBeNull();
    expect(svc.consume('x'.repeat(64))).toBeNull();
    expect(svc.consume('short')).toBeNull();
    const state = svc.issue(bound);
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
    expect(svc.consume(state)).toBeNull();
    spy.mockRestore();
  });
});
