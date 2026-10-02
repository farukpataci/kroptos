import {
  appEnv,
  installOutboundGuard,
  isHostAllowed,
  notificationsDeliver,
  OutboundBlockedError,
  outboundPolicy,
} from './outbound-guard';

describe('outbound-guard', () => {
  describe('ortam ve varsayılanlar', () => {
    it('APP_ENV yoksa development; dış HTTP açık, bildirim gerçek', () => {
      expect(appEnv({})).toBe('development');
      expect(outboundPolicy({}).blocked).toBe(false);
      expect(notificationsDeliver({})).toBe(true);
    });

    it('production davranışı değişmez', () => {
      const env = { APP_ENV: 'production' };
      expect(outboundPolicy(env).blocked).toBe(false);
      expect(notificationsDeliver(env)).toBe(true);
    });

    it('staging varsayılanı: dış HTTP kapalı, bildirim console', () => {
      const env = { APP_ENV: 'staging' };
      expect(outboundPolicy(env).blocked).toBe(true);
      expect(notificationsDeliver(env)).toBe(false);
    });

    it('staging açıkça açılabilir', () => {
      const env = { APP_ENV: 'staging', OUTBOUND_HTTP: 'allow', NOTIFICATIONS_DELIVERY: 'send' };
      expect(outboundPolicy(env).blocked).toBe(false);
      expect(notificationsDeliver(env)).toBe(true);
    });

    it('yanlış yazılmış değer sessizce geçmez', () => {
      expect(() => appEnv({ APP_ENV: 'prod' })).toThrow(/APP_ENV geçersiz/);
      expect(() => outboundPolicy({ APP_ENV: 'staging', OUTBOUND_HTTP: 'off' })).toThrow(/OUTBOUND_HTTP/);
    });
  });

  describe('izin listesi', () => {
    it('loopback her zaman izinli', () => {
      expect(isHostAllowed('localhost', [])).toBe(true);
      expect(isHostAllowed('127.0.0.1', [])).toBe(true);
    });

    it('tam ad ve *.alt-alan eşleşmesi', () => {
      const list = ['stageapi.trendyol.com', '*.sandbox.example.com'];
      expect(isHostAllowed('stageapi.trendyol.com', list)).toBe(true);
      expect(isHostAllowed('api.trendyol.com', list)).toBe(false);
      expect(isHostAllowed('a.sandbox.example.com', list)).toBe(true);
      expect(isHostAllowed('sandbox.example.com', list)).toBe(true);
      expect(isHostAllowed('evilsandbox.example.com', list)).toBe(false);
    });
  });

  describe('fetch kapısı', () => {
    const okResponse = { ok: true } as unknown as Response;

    function target() {
      const calls: string[] = [];
      const t = {
        fetch: (async (input: any) => {
          calls.push(typeof input === 'string' ? input : input.url ?? String(input));
          return okResponse;
        }) as typeof fetch,
      };
      return { t, calls };
    }

    it('kapalı değilse fetch\'e dokunmaz', () => {
      const { t } = target();
      const before = t.fetch;
      expect(installOutboundGuard({ env: 'production', blocked: false, allowlist: [] }, t)).toBe(false);
      expect(t.fetch).toBe(before);
    });

    it('engellenen istek ağa hiç çıkmaz', async () => {
      const { t, calls } = target();
      installOutboundGuard({ env: 'staging', blocked: true, allowlist: [] }, t);
      await expect(t.fetch('https://api.trendyol.com/sapigw/suppliers/1/orders')).rejects.toBeInstanceOf(
        OutboundBlockedError,
      );
      await expect(t.fetch(new URL('https://api.netgsm.com.tr/sms/send/get'))).rejects.toThrow(
        /api\.netgsm\.com\.tr/,
      );
      await expect(t.fetch({ url: 'https://api.parasut.com/v4/me' } as any)).rejects.toThrow(/staging/);
      expect(calls).toEqual([]);
    });

    it('izin listesindeki ve loopback adresler geçer', async () => {
      const { t, calls } = target();
      installOutboundGuard({ env: 'staging', blocked: true, allowlist: ['stageapi.trendyol.com'] }, t);
      await t.fetch('https://stageapi.trendyol.com/x');
      await t.fetch('http://localhost:3001/api/health');
      expect(calls).toEqual(['https://stageapi.trendyol.com/x', 'http://localhost:3001/api/health']);
    });

    it('iki kez kurulunca iç içe sarmaz', () => {
      const { t } = target();
      installOutboundGuard({ env: 'staging', blocked: true, allowlist: [] }, t);
      const once = t.fetch;
      installOutboundGuard({ env: 'staging', blocked: true, allowlist: [] }, t);
      expect(t.fetch).toBe(once);
    });
  });
});
