import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationEvent, NotificationLogStatus, NotificationTemplate, Prisma } from '@prisma/client';
import { Job, Queue, Worker } from 'bullmq';
import { PrismaService } from '@common/prisma/prisma.service';
import { runAsSystem, runWithTenant } from '@common/prisma/tenant-context';
import { systemTemplate, SystemTemplate } from './defaults';
import { NotificationProviderService } from './notification-provider.service';
import { maskRecipient } from './providers';
import { htmlToText, render, smsSegments, wrapEmailLayout } from './renderer';
import { sampleContext, setPath } from './variables';

export const NOTIFICATION_QUEUE = 'notifications';
export const DEFAULT_LOG_RETENTION_DAYS = 180;

export interface Scope {
  agencyId: string;
  clientId?: string | null;
  storeId?: string | null;
}

export const scopeKey = (clientId: string | null | undefined, storeId: string | null | undefined) => `${clientId ?? '-'}:${storeId ?? '-'}`;

export type EffectiveTemplate = (NotificationTemplate | SystemTemplate) & { resolvedFrom: 'SYSTEM' | 'AGENCY' | 'CLIENT' | 'STORE' };

interface SendJob {
  logId: string;
  agencyId: string;
  templateId: string; // DB id veya sys:*
  recipient: string;
  context: Record<string, any>;
  /** Şablon override (test gönderimi kaydedilmemiş gövdeyle çalışabilsin) */
  override?: { subject?: string | null; bodyHtml?: string | null; bodyText?: string; senderName?: string | null; replyTo?: string | null; smsSenderId?: string | null };
}

const TRACKING_URLS: Record<string, (n: string) => string> = {
  yurtici: (n) => `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${n}`,
  aras: (n) => `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${n}`,
  mng: (n) => `https://www.mngkargo.com.tr/gonderitakip?takipNo=${n}`,
  ptt: (n) => `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${n}`,
  surat: (n) => `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${n}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${n}`,
  dhl: (n) => `https://www.dhl.com/tr-tr/home/tracking.html?tracking-id=${n}`,
};

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private queue?: Queue;
  private worker?: Worker;
  private retentionTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: NotificationProviderService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------------ queue

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      const url = new URL(redisUrl);
      const connection = { host: url.hostname, port: parseInt(url.port, 10) || 6379 };
      this.queue = new Queue(NOTIFICATION_QUEUE, { connection });
      this.queue.on('error', () => undefined);
      this.worker = new Worker(NOTIFICATION_QUEUE, (job) => this.process(job), { connection, concurrency: 3 });
      this.worker.on('error', () => undefined);
      this.worker.on('failed', (job, err) => this.logger.warn(`notification job ${job?.id} failed: ${err.message}`));
    } catch (e) {
      this.logger.error(`notification queue init failed: ${(e as Error).message}`);
    }
    // Günlük temizlik: TenantSettings.settings.notifications.logRetentionDays (varsayılan 180).
    this.retentionTimer = setInterval(() => this.cleanupLogs().catch((e) => this.logger.warn(`log cleanup failed: ${e.message}`)), 24 * 60 * 60 * 1000);
    this.retentionTimer.unref?.();
  }

  async onModuleDestroy() {
    if (this.retentionTimer) clearInterval(this.retentionTimer);
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }

  // --------------------------------------------------------------- resolve

  /**
   * Efektif şablon: STORE > CLIENT > AGENCY (DB, aktif ve silinmemiş) > SYSTEM (kod).
   * `activeOnly=false` listeleme içindir (pasif satır da "kaynak" olarak görünür).
   */
  async resolve(scope: Scope, channel: NotificationChannel, event: NotificationEvent, locale: string, orderStatusKey = '', activeOnly = true): Promise<EffectiveTemplate | null> {
    const candidates: { key: string; level: 'STORE' | 'CLIENT' | 'AGENCY' }[] = [];
    if (scope.storeId) candidates.push({ key: scopeKey(scope.clientId, scope.storeId), level: 'STORE' });
    if (scope.clientId) candidates.push({ key: scopeKey(scope.clientId, null), level: 'CLIENT' });
    candidates.push({ key: scopeKey(null, null), level: 'AGENCY' });

    const rows = await this.prisma.notificationTemplate.findMany({
      where: {
        agencyId: scope.agencyId,
        channel,
        event,
        orderStatusKey,
        locale,
        deletedAt: null,
        scopeKey: { in: candidates.map((c) => c.key) },
        ...(activeOnly ? { isActive: true } : {}),
      },
    });
    for (const c of candidates) {
      const row = rows.find((r) => r.scopeKey === c.key);
      if (row) return { ...row, resolvedFrom: c.level };
    }
    if (orderStatusKey) return null; // özel durum için sistem varsayılanı: ORDER_STATUS_CHANGED genel şablonu
    const sys = systemTemplate(channel, event, locale);
    return sys ? { ...sys, resolvedFrom: 'SYSTEM' } : null;
  }

  // --------------------------------------------------------------- context

  /** Gerçek siparişten değişken bağlamı; alan yoksa boş string (şablon patlamaz). */
  async buildContext(orderId: string, event: NotificationEvent): Promise<Record<string, any> | null> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, deletedAt: null }, include: { items: true } });
    if (!order) return null;
    const [store, client, settings, shipment] = await Promise.all([
      this.prisma.store.findUnique({ where: { id: order.storeId } }),
      order.clientId ? this.prisma.client.findUnique({ where: { id: order.clientId } }) : null,
      this.prisma.tenantSettings.findUnique({ where: { agencyId: order.agencyId } }),
      this.prisma.shipment.findFirst({ where: { orderId: order.id, deletedAt: null, status: { not: 'cancelled' } }, orderBy: { createdAt: 'desc' }, include: { carrierIntegration: true } }),
    ]);
    const ctx = sampleContext(event);
    // Örnek bağlamın üstüne gerçek değerler; örnekte olmayan bir alan üretilmez (katalog = bağlam).
    const fullName = order.customerName || order.shippingFullName || '';
    setPath(ctx, 'customer.firstName', fullName.split(' ')[0] ?? '');
    setPath(ctx, 'customer.fullName', fullName);
    setPath(ctx, 'order.number', order.orderNumber);
    setPath(ctx, 'order.date', order.createdAt.toISOString());
    setPath(ctx, 'order.total', Number(order.totalAmount));
    setPath(ctx, 'order.currency', order.currency);
    setPath(ctx, 'order.items', order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: Number(i.unitPrice), imageUrl: null })));
    setPath(ctx, 'order.paymentMethod', shipment?.paymentType === 'cod' ? 'Kapıda ödeme' : order.paymentStatus);
    setPath(ctx, 'order.status', order.status);
    setPath(ctx, 'shipping.address', order.shippingAddress || [order.shippingLine1, order.shippingLine2, order.shippingDistrict, order.shippingCity].filter(Boolean).join(', '));
    setPath(ctx, 'store.name', store?.name ?? '');
    setPath(ctx, 'store.logoUrl', settings?.logoUrl ?? '');
    setPath(ctx, 'store.supportEmail', client?.contactEmail || client?.email || settings?.email || '');
    setPath(ctx, 'store.supportPhone', client?.contactPhone || client?.phone || settings?.phone || '');
    setPath(ctx, 'brand.name', client?.name ?? store?.name ?? '');
    if (ctx.shipment) {
      const carrierKey = (shipment?.provider ?? '').toLowerCase();
      const tn = shipment?.trackingNumber ?? '';
      setPath(ctx, 'shipment.carrierName', shipment?.carrierIntegration?.displayName ?? shipment?.provider ?? '');
      setPath(ctx, 'shipment.trackingNumber', tn);
      setPath(ctx, 'shipment.trackingUrl', tn && TRACKING_URLS[carrierKey] ? TRACKING_URLS[carrierKey](tn) : '');
    }
    if (ctx.return) {
      setPath(ctx, 'return.code', '');
      setPath(ctx, 'refund.amount', Number(order.totalAmount));
    }
    if (ctx.invoice) setPath(ctx, 'invoice.url', '');
    return ctx;
  }

  recipientFor(order: { customerEmail: string | null; customerPhone: string | null; shippingPhone: string | null }, channel: NotificationChannel): string | null {
    return channel === 'EMAIL' ? order.customerEmail || null : order.customerPhone || order.shippingPhone || null;
  }

  // ---------------------------------------------------------------- render

  renderTemplate(tpl: { channel: NotificationChannel; subject?: string | null; bodyHtml?: string | null; bodyText: string }, ctx: Record<string, any>) {
    if (tpl.channel === 'EMAIL') {
      const subject = render(tpl.subject ?? '', ctx);
      const inner = render(tpl.bodyHtml ?? '', ctx);
      const html = wrapEmailLayout(inner, ctx);
      const text = tpl.bodyText?.trim() ? render(tpl.bodyText, ctx) : htmlToText(inner);
      return { subject, html, text, sms: null as null | ReturnType<typeof smsSegments> };
    }
    const text = render(tpl.bodyText, ctx);
    return { subject: '', html: '', text, sms: smsSegments(text) };
  }

  // --------------------------------------------------------------- enqueue

  /**
   * Log satırı (QUEUED) + kuyruk işi. Idempotency: aynı (orderId, event, channel)
   * için FAILED olmayan gerçek (isTest=false) bir kayıt varsa ikinci gönderim yok.
   * jobId da aynı üçlüden: kuyrukta bekleyen kopya da oluşmaz.
   */
  async enqueue(params: {
    scope: Scope;
    template: EffectiveTemplate;
    recipient: string;
    context: Record<string, any>;
    orderId?: string | null;
    delayMinutes?: number;
    isTest?: boolean;
    override?: SendJob['override'];
  }) {
    const { scope, template, recipient, context, orderId = null, isTest = false } = params;
    if (!isTest && orderId) {
      const dup = await this.prisma.notificationLog.findFirst({
        where: { agencyId: scope.agencyId, orderId, event: template.event, channel: template.channel, isTest: false, status: { not: 'FAILED' } },
        select: { id: true },
      });
      if (dup) return { skipped: 'duplicate' as const, logId: dup.id };
    }
    const rendered = this.renderTemplate({ ...template, ...(params.override ?? {}) } as any, context);
    const log = await this.prisma.notificationLog.create({
      data: {
        agencyId: scope.agencyId,
        clientId: scope.clientId ?? null,
        storeId: scope.storeId ?? null,
        templateId: 'id' in template && !template.id.startsWith('sys:') ? template.id : null,
        channel: template.channel,
        event: template.event,
        orderId,
        recipient: maskRecipient(recipient),
        subject: rendered.subject || null,
        renderedBody: template.channel === 'EMAIL' ? rendered.html : rendered.text,
        status: 'QUEUED',
        provider: 'pending',
        isTest,
      },
    });
    const job: SendJob = { logId: log.id, agencyId: scope.agencyId, templateId: template.id, recipient, context, override: params.override };
    const delay = Math.max(0, params.delayMinutes ?? 0) * 60_000;
    // BullMQ jobId ':' kabul etmez; cuid'lerde ':' yok.
    const jobId = isTest ? `test-${log.id}` : orderId ? `${orderId}-${template.event}-${template.channel}` : log.id;
    if (this.queue) {
      try {
        await this.queue.add('send', job, { jobId, delay, attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: true, removeOnFail: 200 });
        return { skipped: null, logId: log.id };
      } catch (e) {
        this.logger.warn(`notification queue unavailable, processing inline: ${(e as Error).message}`);
      }
    }
    // Redis yok: satır içi işle (istek yolu değil, event dinleyicisi/test ucu — yine de beklemek kabul).
    await this.process({ data: job, attemptsMade: 0 } as Job<SendJob>);
    return { skipped: null, logId: log.id };
  }

  // --------------------------------------------------------------- process

  /** Worker: kiracı bağlamında (RLS) render → sağlayıcı → log. */
  async process(job: Job<SendJob>) {
    const data = job.data;
    return runWithTenant(data.agencyId, async () => {
      const log = await this.prisma.notificationLog.findUnique({ where: { id: data.logId } });
      if (!log || log.status === 'SENT' || log.status === 'DELIVERED') return;
      const tpl = await this.loadTemplate(data.agencyId, data.templateId);
      const attempts = (job.attemptsMade ?? 0) + 1;
      if (!tpl) {
        await this.finish(log.id, 'SKIPPED', { errorMessage: 'Template no longer exists', attempts });
        return;
      }
      const merged = { ...tpl, ...(data.override ?? {}) };
      let providerName = 'none';
      try {
        const rendered = this.renderTemplate(merged as any, data.context);
        let result: { providerMessageId?: string };
        if (tpl.channel === 'EMAIL') {
          const provider = await this.providers.emailProvider(data.agencyId);
          if (!provider) return this.finish(log.id, 'SKIPPED', { errorMessage: 'E-mail provider not configured', attempts, provider: 'none' });
          providerName = provider.name;
          result = await provider.send({ to: data.recipient, subject: rendered.subject, html: rendered.html, text: rendered.text, fromName: merged.senderName ?? undefined, replyTo: merged.replyTo ?? undefined });
        } else {
          const provider = await this.providers.smsProvider(data.agencyId);
          if (!provider) return this.finish(log.id, 'SKIPPED', { errorMessage: 'SMS provider not configured', attempts, provider: 'none' });
          providerName = provider.name;
          result = await provider.send({ to: data.recipient, text: rendered.text, senderId: merged.smsSenderId ?? undefined });
        }
        await this.finish(log.id, 'SENT', { provider: providerName, providerMessageId: result.providerMessageId, attempts, sentAt: new Date(), errorMessage: null });
      } catch (e) {
        const message = (e as Error).message;
        const final = attempts >= (job.opts?.attempts ?? 1);
        await this.finish(log.id, final ? 'FAILED' : 'QUEUED', { provider: providerName, errorMessage: message, attempts });
        throw e; // BullMQ retry/backoff
      }
    });
  }

  private async finish(logId: string, status: NotificationLogStatus, data: Partial<Prisma.NotificationLogUncheckedUpdateInput>) {
    await this.prisma.notificationLog.update({ where: { id: logId }, data: { status, ...data } });
  }

  private async loadTemplate(agencyId: string, templateId: string): Promise<(NotificationTemplate | SystemTemplate) | null> {
    if (templateId.startsWith('sys:')) {
      const [, channel, event, locale] = templateId.split(':');
      return systemTemplate(channel as NotificationChannel, event as NotificationEvent, locale);
    }
    return this.prisma.notificationTemplate.findFirst({ where: { id: templateId, agencyId, deletedAt: null } });
  }

  // ------------------------------------------------------------------ logs

  async listLogs(scope: Scope, q: { channel?: NotificationChannel; status?: NotificationLogStatus; event?: NotificationEvent; orderId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
    const where: Prisma.NotificationLogWhereInput = {
      agencyId: scope.agencyId,
      ...(scope.clientId ? { clientId: scope.clientId } : {}),
      ...(scope.storeId ? { storeId: scope.storeId } : {}),
      ...(q.channel ? { channel: q.channel } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.event ? { event: q.event } : {}),
      ...(q.orderId ? { orderId: q.orderId } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { template: { select: { id: true, name: true, scopeLevel: true } } },
      }),
    ]);
    return { items: rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async logsForOrder(scope: Scope, orderId: string) {
    return this.prisma.notificationLog.findMany({ where: { agencyId: scope.agencyId, orderId }, orderBy: { createdAt: 'desc' } });
  }

  /** Başarısız gönderimi yeniden kuyruğa al: aynı log satırı, sayaç sıfır, bağlam siparişten yeniden. */
  async retry(scope: Scope, logId: string) {
    const log = await this.prisma.notificationLog.findFirst({ where: { id: logId, agencyId: scope.agencyId, ...(scope.storeId ? { storeId: scope.storeId } : {}) } });
    if (!log) throw new NotFoundException('Notification log not found');
    if (log.status !== 'FAILED' && log.status !== 'SKIPPED') throw new NotFoundException('Only FAILED/SKIPPED notifications can be retried');
    if (!log.orderId) throw new NotFoundException('Test notifications cannot be retried');
    const order = await this.prisma.order.findFirst({ where: { id: log.orderId, deletedAt: null } });
    const recipient = order ? this.recipientFor(order, log.channel) : null;
    if (!order || !recipient) throw new NotFoundException('Order or recipient no longer available');
    const template = await this.resolve({ agencyId: log.agencyId, clientId: log.clientId, storeId: log.storeId }, log.channel, log.event, await this.localeFor(order.storeId));
    if (!template) throw new NotFoundException('No active template for this event');
    const context = await this.buildContext(order.id, log.event);
    await this.prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'QUEUED', attempts: 0, errorMessage: null } });
    const job: SendJob = { logId: log.id, agencyId: log.agencyId, templateId: template.id, recipient, context: context ?? {} };
    if (this.queue) await this.queue.add('send', job, { jobId: `retry-${log.id}-${Date.now()}`, attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: true });
    else await this.process({ data: job, attemptsMade: 0 } as Job<SendJob>);
    return { ok: true };
  }

  async localeFor(storeId: string | null): Promise<string> {
    if (!storeId) return 'tr';
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { locale: true } });
    return (store?.locale ?? 'tr').slice(0, 2).toLowerCase();
  }

  /** Saklama süresi: ajans ayarı (settings.notifications.logRetentionDays) yoksa 180 gün. */
  async cleanupLogs() {
    await runAsSystem('notification:log-retention', async () => {
      const agencies = await this.prisma.agency.findMany({ where: { deletedAt: null }, select: { id: true } });
      for (const a of agencies) {
        const settings = await this.prisma.tenantSettings.findUnique({ where: { agencyId: a.id }, select: { settings: true } });
        const days = Number((settings?.settings as any)?.notifications?.logRetentionDays) || DEFAULT_LOG_RETENTION_DAYS;
        const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const { count } = await this.prisma.notificationLog.deleteMany({ where: { agencyId: a.id, createdAt: { lt: before } } });
        if (count) this.logger.log(`log retention: agency ${a.id} -${count} rows (> ${days}d)`);
      }
    });
  }
}
