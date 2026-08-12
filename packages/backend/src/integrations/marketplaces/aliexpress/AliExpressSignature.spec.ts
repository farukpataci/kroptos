import { createHash, createHmac } from 'crypto';
import {
  ACTIVE_VARIANT,
  buildAliExpressPayload,
  buildSignatureBase,
  signAliExpressRequest,
} from './AliExpressSignature';

const SECRET = 'app-secret';

/**
 * The sorting and encoding rules are verified, so they are pinned tightly. Which
 * way the secret enters the hash is not, so both variants are covered — the day
 * the correct one is known, only ACTIVE_VARIANT changes and these stay valid.
 */
describe('buildSignatureBase', () => {
  it('sorts by parameter name in ASCII order, not insertion order', () => {
    expect(buildSignatureBase({ b: '2', a: '1', c: '3' })).toBe('a1b2c3');
    expect(buildSignatureBase({ c: '3', a: '1', b: '2' })).toBe('a1b2c3');
  });

  it('concatenates each key immediately followed by its value', () => {
    expect(buildSignatureBase({ method: 'x.y.get', v: '2.0' })).toBe('methodx.y.getv2.0');
  });

  it('excludes sign from its own input', () => {
    expect(buildSignatureBase({ a: '1', sign: 'STALE' })).toBe('a1');
  });

  it('drops empty values rather than signing a bare key', () => {
    expect(buildSignatureBase({ a: '1', b: '', c: null, d: undefined })).toBe('a1');
  });

  it('serialises nested values as JSON', () => {
    expect(buildSignatureBase({ p: { n: 1 } })).toBe(`p${JSON.stringify({ n: 1 })}`);
  });
});

describe('signAliExpressRequest', () => {
  it('returns an upper-case hex digest', () => {
    expect(signAliExpressRequest({ a: '1' }, SECRET)).toMatch(/^[0-9A-F]+$/);
  });

  it('computes the HMAC variant as HMAC(secret, base)', () => {
    const expected = createHmac('sha256', SECRET).update('a1', 'utf8').digest('hex').toUpperCase();

    expect(signAliExpressRequest({ a: '1' }, SECRET, { variant: 'hmac' })).toBe(expected);
  });

  it('computes the wrapped variant as digest(secret + base + secret)', () => {
    const expected = createHash('sha256')
      .update(`${SECRET}a1${SECRET}`, 'utf8')
      .digest('hex')
      .toUpperCase();

    expect(signAliExpressRequest({ a: '1' }, SECRET, { variant: 'wrapped' })).toBe(expected);
  });

  it('produces different signatures for the two variants', () => {
    // If these ever collided the choice would not matter — and it does.
    expect(signAliExpressRequest({ a: '1' }, SECRET, { variant: 'hmac' })).not.toBe(
      signAliExpressRequest({ a: '1' }, SECRET, { variant: 'wrapped' }),
    );
  });

  it('defaults to the variant the connector is currently configured for', () => {
    expect(signAliExpressRequest({ a: '1' }, SECRET)).toBe(
      signAliExpressRequest({ a: '1' }, SECRET, { variant: ACTIVE_VARIANT }),
    );
  });

  it('produces a different signature for a different secret', () => {
    expect(signAliExpressRequest({ a: '1' }, 'other')).not.toBe(signAliExpressRequest({ a: '1' }, SECRET));
  });

  it('refuses to sign without a secret rather than emitting a usable-looking digest', () => {
    expect(() => signAliExpressRequest({ a: '1' }, '')).toThrow(/app secret/i);
  });
});

describe('buildAliExpressPayload', () => {
  const base = {
    method: 'aliexpress.solution.order.info.get',
    appKey: 'key',
    appSecret: SECRET,
    session: 'token-1',
    timestamp: 1_700_000_000_000,
  };

  it('carries the system envelope AliExpress expects', () => {
    const payload = buildAliExpressPayload(base);

    expect(payload).toMatchObject({
      app_key: 'key',
      method: 'aliexpress.solution.order.info.get',
      // AliExpress names the access token `session`.
      session: 'token-1',
      format: 'json',
      v: '2.0',
      sign_method: 'sha256',
    });
    expect(payload.sign).toMatch(/^[0-9A-F]+$/);
  });

  it('signs the operation parameters together with the envelope', () => {
    expect(buildAliExpressPayload({ ...base, params: { order_id: '9' } }).sign).not.toBe(
      buildAliExpressPayload(base).sign,
    );
  });

  it('never puts the app secret in the payload', () => {
    expect(JSON.stringify(buildAliExpressPayload(base))).not.toContain(SECRET);
  });
});
