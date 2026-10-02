/**
 * Ortam (APP_ENV) ve dış dünyaya çıkış kapısı.
 *
 * Neden: staging canlı verinin kopyasıyla çalışır. Kopyada kalan bir pazaryeri kimlik
 * bilgisi, staging worker'ının müşterinin GERÇEK Trendyol/kargo/muhasebe hesabına stok,
 * fiyat veya fatura yazmasına yol açar. Kapı bunu tek noktada keser.
 *
 * Kapsam: backend'in bütün dış HTTP çağrıları global `fetch` üzerinden gider (pazaryeri,
 * kargo, muhasebe, e-ticaret istemcileri, Netgsm, otomasyon webhook'u). `fetch` dışındaki
 * tek çıkış SMTP'dir (nodemailer); o, bildirim sağlayıcısı seçiminde `notificationsDeliver()`
 * ile kesilir. Yeni bir çıkış yolu (undici, http.request, SOAP kütüphanesi) eklenirse
 * buraya bağlanmalıdır.
 *
 * Varsayılanlar yalnız staging'de kapalıdır; production ve lokal geliştirmede davranış değişmez.
 *
 *   APP_ENV                 production | staging | development | test   (varsayılan development)
 *   OUTBOUND_HTTP           allow | block       (varsayılan: staging'de block, diğerlerinde allow)
 *   OUTBOUND_ALLOWLIST      virgüllü host listesi; "*.ornek.com" alt alan adlarını kapsar.
 *                           Sağlayıcıların test ortamları (ör. stageapi.trendyol.com) buraya yazılır.
 *   NOTIFICATIONS_DELIVERY  send | console      (varsayılan: staging'de console, diğerlerinde send)
 */

export const APP_ENVS = ['production', 'staging', 'development', 'test'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export function appEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const raw = (env.APP_ENV || 'development').trim().toLowerCase();
  if (!(APP_ENVS as readonly string[]).includes(raw)) {
    // Yanlış yazılmış bir değer sessizce "production" davranışına düşmesin.
    throw new Error(`APP_ENV geçersiz: '${env.APP_ENV}'. Geçerli: ${APP_ENVS.join(', ')}`);
  }
  return raw as AppEnv;
}

function choice<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
  env: NodeJS.ProcessEnv,
): T {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new Error(`${name} geçersiz: '${env[name]}'. Geçerli: ${allowed.join(', ')}`);
  }
  return raw as T;
}

export interface OutboundPolicy {
  env: AppEnv;
  blocked: boolean;
  allowlist: string[];
}

export function outboundPolicy(env: NodeJS.ProcessEnv = process.env): OutboundPolicy {
  const current = appEnv(env);
  const mode = choice('OUTBOUND_HTTP', ['allow', 'block'] as const, current === 'staging' ? 'block' : 'allow', env);
  const allowlist = (env.OUTBOUND_ALLOWLIST || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return { env: current, blocked: mode === 'block', allowlist };
}

/** Bildirimler gerçekten gönderilsin mi (false → console sağlayıcısı). */
export function notificationsDeliver(env: NodeJS.ProcessEnv = process.env): boolean {
  const current = appEnv(env);
  return choice('NOTIFICATIONS_DELIVERY', ['send', 'console'] as const, current === 'staging' ? 'console' : 'send', env) === 'send';
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isHostAllowed(host: string, allowlist: string[]): boolean {
  const h = host.toLowerCase();
  if (LOOPBACK.has(h)) return true;
  return allowlist.some((entry) =>
    entry.startsWith('*.') ? h === entry.slice(2) || h.endsWith(entry.slice(1)) : h === entry,
  );
}

export class OutboundBlockedError extends Error {
  constructor(readonly host: string, readonly env: AppEnv) {
    super(
      `[${env}] dış istek engellendi: ${host}. Bu ortamda dış HTTP kapalı ` +
        `(OUTBOUND_HTTP). Bir test ortamına izin vermek için OUTBOUND_ALLOWLIST'e ekleyin.`,
    );
    this.name = 'OutboundBlockedError';
  }
}

function hostOf(input: unknown): string {
  if (typeof input === 'string') return new URL(input).hostname;
  if (input instanceof URL) return input.hostname;
  if (input && typeof (input as { url?: unknown }).url === 'string') {
    return new URL((input as { url: string }).url).hostname; // Request
  }
  throw new TypeError('fetch girdisinden host çözülemedi');
}

const INSTALLED = Symbol.for('kroptos.outboundGuard');

/**
 * Global fetch'i politikaya göre sarar. Uygulama açılırken, başka her şeyden önce bir kez
 * çağrılır (main.ts). Kapalı değilse dokunmaz. Engellenen istek ağa hiç çıkmaz.
 */
export function installOutboundGuard(
  policy: OutboundPolicy = outboundPolicy(),
  target: { fetch: typeof fetch } = globalThis as unknown as { fetch: typeof fetch },
): boolean {
  if (!policy.blocked) return false;
  const original = target.fetch as typeof fetch & { [INSTALLED]?: true };
  if (original[INSTALLED]) return true;

  const guarded = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const host = hostOf(input);
    if (!isHostAllowed(host, policy.allowlist)) {
      throw new OutboundBlockedError(host, policy.env);
    }
    return original(input, init);
  }) as typeof fetch & { [INSTALLED]?: true };
  guarded[INSTALLED] = true;
  target.fetch = guarded;
  return true;
}
