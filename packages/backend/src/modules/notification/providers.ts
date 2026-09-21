import { Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * Sağlayıcı adaptörleri. Arayüz başka sağlayıcıya açık (SES, İleti Merkezi…):
 * aynı iki metodu veren bir sınıf + `buildEmailProvider`/`buildSmsProvider`
 * switch'ine bir dal. Burada yalnız SMTP ve Netgsm gerçek; `console` geliştirme
 * stub'u (mesajı loga basar, "gönderildi" döner).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
  replyTo?: string;
}
export interface SmsMessage {
  to: string;
  text: string;
  senderId?: string;
}
export interface SendResult {
  providerMessageId?: string;
}
export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<SendResult>;
  test(): Promise<void>;
}
export interface SmsProvider {
  readonly name: string;
  send(msg: SmsMessage): Promise<SendResult>;
  test(): Promise<void>;
}

/** config = gizli olmayan alanlar (DB Json), secrets = çözülmüş gizli alanlar. */
export type ProviderConfig = Record<string, any>;

const log = new Logger('NotificationProvider');

// ---------------------------------------------------------------- console

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  async send(msg: EmailMessage): Promise<SendResult> {
    log.log(`\n--- EMAIL -> ${msg.to}\n${msg.subject}\n${msg.text}\n---`);
    return { providerMessageId: `console-${Date.now()}` };
  }
  async test() {}
}

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  async send(msg: SmsMessage): Promise<SendResult> {
    log.log(`\n--- SMS -> ${msg.to} [${msg.senderId ?? '-'}]\n${msg.text}\n---`);
    return { providerMessageId: `console-${Date.now()}` };
  }
  async test() {}
}

// ---------------------------------------------------------------- SMTP

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly transport: Transporter;
  constructor(private readonly config: ProviderConfig, secrets: ProviderConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port) || 587,
      secure: config.secure === true || Number(config.port) === 465,
      auth: config.username ? { user: config.username, pass: secrets.password ?? '' } : undefined,
    });
  }
  async send(msg: EmailMessage): Promise<SendResult> {
    const fromName = msg.fromName || this.config.fromName || '';
    const from = fromName ? `"${fromName.replace(/"/g, '')}" <${this.config.fromEmail}>` : this.config.fromEmail;
    const info = await this.transport.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, replyTo: msg.replyTo || this.config.replyTo || undefined });
    return { providerMessageId: info.messageId };
  }
  async test() {
    await this.transport.verify();
  }
}

// ---------------------------------------------------------------- Netgsm

/**
 * Netgsm REST (GET /sms/send/get). Yanıt "00 <jobid>" / "01 <jobid>" / "02 <jobid>"
 * başarı, diğer kodlar hata (20 mesaj/karakter, 30 kimlik, 40 başlık, 70 parametre…).
 * Doküman: https://www.netgsm.com.tr/dokuman/#http-get-sms-g%C3%B6nderme
 */
export class NetgsmSmsProvider implements SmsProvider {
  readonly name = 'netgsm';
  constructor(private readonly config: ProviderConfig, private readonly secrets: ProviderConfig) {}
  private params(extra: Record<string, string>) {
    return new URLSearchParams({
      usercode: this.config.username ?? '',
      password: this.secrets.password ?? '',
      msgheader: this.config.senderId ?? '',
      dil: 'TR',
      ...extra,
    });
  }
  async send(msg: SmsMessage): Promise<SendResult> {
    const qs = this.params({ gsmno: msg.to.replace(/\D/g, ''), message: msg.text, msgheader: msg.senderId || this.config.senderId || '' });
    const res = await fetch(`https://api.netgsm.com.tr/sms/send/get?${qs.toString()}`);
    const body = (await res.text()).trim();
    const [code, jobId] = body.split(/\s+/);
    if (!['00', '01', '02'].includes(code)) throw new Error(`Netgsm hata kodu ${body}`);
    return { providerMessageId: jobId };
  }
  async test() {
    // Bakiye ucu kimlik bilgisini doğrular, SMS harcamaz.
    const qs = this.params({ stip: '2' });
    const res = await fetch(`https://api.netgsm.com.tr/balance/list/get?${qs.toString()}`);
    const body = (await res.text()).trim();
    if (/^(30|40|70|100)/.test(body)) throw new Error(`Netgsm kimlik doğrulaması başarısız: ${body}`);
  }
}

// ---------------------------------------------------------------- factory

export const EMAIL_PROVIDERS = ['smtp', 'console'] as const;
export const SMS_PROVIDERS = ['netgsm', 'console'] as const;

export function buildEmailProvider(provider: string, config: ProviderConfig, secrets: ProviderConfig): EmailProvider {
  switch (provider) {
    case 'smtp':
      return new SmtpEmailProvider(config, secrets);
    case 'console':
      return new ConsoleEmailProvider();
    default:
      throw new Error(`Unknown e-mail provider '${provider}'`);
  }
}

export function buildSmsProvider(provider: string, config: ProviderConfig, secrets: ProviderConfig): SmsProvider {
  switch (provider) {
    case 'netgsm':
      return new NetgsmSmsProvider(config, secrets);
    case 'console':
      return new ConsoleSmsProvider();
    default:
      throw new Error(`Unknown SMS provider '${provider}'`);
  }
}

/** Sağlayıcı formundaki alan tanımı — UI'ye döner, secret olanlar maskeli gösterilir. */
export const PROVIDER_FIELDS: Record<string, { key: string; label: string; secret?: boolean; type?: 'text' | 'number' | 'boolean' }[]> = {
  smtp: [
    { key: 'host', label: 'SMTP sunucu' },
    { key: 'port', label: 'Port', type: 'number' },
    { key: 'secure', label: 'TLS (465)', type: 'boolean' },
    { key: 'username', label: 'Kullanıcı adı' },
    { key: 'password', label: 'Şifre', secret: true },
    { key: 'fromEmail', label: 'Gönderen e-posta' },
    { key: 'fromName', label: 'Gönderen adı' },
    { key: 'replyTo', label: 'Yanıt adresi' },
  ],
  netgsm: [
    { key: 'username', label: 'Kullanıcı kodu' },
    { key: 'password', label: 'Şifre', secret: true },
    { key: 'senderId', label: 'Mesaj başlığı (senderId)' },
  ],
  console: [],
};

/** KVKK: loglarda ham alıcı yok. a***@x.com / +90 5** *** 12 34 */
export function maskRecipient(recipient: string): string {
  if (recipient.includes('@')) {
    const [user, domain] = recipient.split('@');
    return `${user.slice(0, 1)}***@${domain}`;
  }
  const digits = recipient.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 3)}${'*'.repeat(Math.max(0, digits.length - 5))}${digits.slice(-2)}`;
}
