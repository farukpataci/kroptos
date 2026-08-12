import { createHash } from 'crypto';
import { buildTemuPayload, signTemuRequest } from './TemuSignature';

/**
 * A signing mistake shows up as a blanket authentication failure with no clue
 * which part was wrong, so each rule of the algorithm is pinned separately
 * rather than through one golden string.
 */
describe('signTemuRequest', () => {
  const SECRET = 'app-secret';

  const expected = (concatenated: string) =>
    createHash('md5').update(`${SECRET}${concatenated}${SECRET}`, 'utf8').digest('hex').toUpperCase();

  it('wraps the concatenated parameters with the secret on both sides', () => {
    expect(signTemuRequest({ a: '1' }, SECRET)).toBe(expected('a1'));
  });

  it('returns an upper-case hex digest', () => {
    const signature = signTemuRequest({ a: '1' }, SECRET);
    expect(signature).toMatch(/^[0-9A-F]{32}$/);
  });

  it('sorts parameters by key rather than trusting insertion order', () => {
    const inOneOrder = signTemuRequest({ b: '2', a: '1', c: '3' }, SECRET);
    const inAnother = signTemuRequest({ c: '3', a: '1', b: '2' }, SECRET);

    expect(inOneOrder).toBe(inAnother);
    expect(inOneOrder).toBe(expected('a1b2c3'));
  });

  it('excludes the sign parameter from its own input', () => {
    expect(signTemuRequest({ a: '1', sign: 'STALE' }, SECRET)).toBe(signTemuRequest({ a: '1' }, SECRET));
  });

  it('drops empty values instead of signing a bare key', () => {
    expect(signTemuRequest({ a: '1', b: '', c: null, d: undefined }, SECRET)).toBe(expected('a1'));
  });

  it('serialises nested values as JSON, the way they travel in the body', () => {
    const signature = signTemuRequest({ page: { size: 10 } }, SECRET);
    expect(signature).toBe(expected(`page${JSON.stringify({ size: 10 })}`));
  });

  it('keeps numbers and booleans as their literal text', () => {
    expect(signTemuRequest({ n: 5, b: true }, SECRET)).toBe(expected('btruen5'));
  });

  it('produces a different signature for a different secret', () => {
    expect(signTemuRequest({ a: '1' }, 'other-secret')).not.toBe(signTemuRequest({ a: '1' }, SECRET));
  });

  it('refuses to sign without a secret rather than producing a usable-looking digest', () => {
    expect(() => signTemuRequest({ a: '1' }, '')).toThrow(/app secret/i);
  });
});

describe('buildTemuPayload', () => {
  const base = {
    method: 'bg.order.list.v2.get',
    appKey: 'key',
    appSecret: 'secret',
    accessToken: 'token',
    timestamp: 1_700_000_000,
  };

  it('carries the common envelope every Temu call needs', () => {
    const payload = buildTemuPayload(base);

    expect(payload).toMatchObject({
      type: 'bg.order.list.v2.get',
      app_key: 'key',
      access_token: 'token',
      timestamp: 1_700_000_000,
      data_type: 'JSON',
    });
    expect(payload.sign).toMatch(/^[0-9A-F]{32}$/);
  });

  it('signs the operation parameters together with the envelope', () => {
    const withParams = buildTemuPayload({ ...base, params: { page_number: 1 } });
    const withoutParams = buildTemuPayload(base);

    expect(withParams.sign).not.toBe(withoutParams.sign);
  });

  it('sends the timestamp in seconds, not milliseconds', () => {
    const payload = buildTemuPayload({ ...base, timestamp: undefined });
    const now = Math.floor(Date.now() / 1000);

    expect(Math.abs(Number(payload.timestamp) - now)).toBeLessThan(5);
  });

  it('never puts the app secret in the payload', () => {
    const payload = buildTemuPayload(base);
    expect(JSON.stringify(payload)).not.toContain('secret');
  });
});
