import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { NotificationChannel, NotificationEvent, NotificationScope, NotificationTemplate, Prisma } from '@prisma/client';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { ActorContext } from '../rbac/rbac.service';
import { isSystemTemplateId, parseSystemTemplateId, SUPPORTED_LOCALES, systemTemplate } from '../notification/defaults';
import { NotificationService, scopeKey } from '../notification/notification.service';
import { TemplateIssue, validateTemplate } from '../notification/renderer';
import { sampleContext, variablesFor } from '../notification/variables';
import { CreateTemplateDto, ListTemplatesQueryDto, PreviewDto, TestSendDto, UpdateTemplateDto } from './dto/notification-template.dto';

const EVENTS = Object.values(NotificationEvent) as NotificationEvent[];
const CHANNELS: NotificationChannel[] = ['EMAIL', 'SMS'];
const SNAPSHOT_FIELDS = ['name', 'subject', 'bodyHtml', 'bodyText', 'senderName', 'replyTo', 'smsSenderId', 'sendDelayMinutes'] as const;

/**
 * Şablon CRUD'u, AKTİF kapsamda. Kapsam actorFromRequest'ten (TenantMiddleware);
 * DTO'dan ajans/marka/mağaza alınmaz. "Tüm Markalar" seçiliyken (clientId yok)
 * AGENCY seviyesi, marka seçiliyken CLIENT, mağaza seçiliyken STORE düzenlenir.
 */
@Injectable()
export class NotificationTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditLogService,
  ) {}

  // ----------------------------------------------------------------- scope

  static levelOf(actor: ActorContext): NotificationScope {
    return actor.storeId ? 'STORE' : actor.clientId ? 'CLIENT' : 'AGENCY';
  }

  private ownScope(actor: ActorContext) {
    const level = NotificationTemplateService.levelOf(actor);
    const clientId = level === 'AGENCY' ? null : (actor.clientId ?? null);
    const storeId = level === 'STORE' ? (actor.storeId ?? null) : null;
    return { level, clientId, storeId, key: scopeKey(clientId, storeId) };
  }

  /** Aktif kapsamda görünür satır: kendi seviyesi veya üst seviyeler (STORE görür CLIENT+AGENCY'yi). */
  private visibleWhere(actor: ActorContext): Prisma.NotificationTemplateWhereInput {
    const keys = [scopeKey(null, null)];
    if (actor.clientId) keys.push(scopeKey(actor.clientId, null));
    if (actor.storeId) keys.push(scopeKey(actor.clientId ?? null, actor.storeId));
    return { agencyId: actor.agencyId, deletedAt: null, scopeKey: { in: keys } };
  }

  private async ownRow(actor: ActorContext, id: string): Promise<NotificationTemplate> {
    const row = await this.prisma.notificationTemplate.findFirst({ where: { id, ...this.visibleWhere(actor) } });
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  // ------------------------------------------------------------------ list

  /** Event × kanal matrisi: her hücre aktif kapsamdaki EFEKTİF şablon (+ resolvedFrom). */
  async list(actor: ActorContext, q: ListTemplatesQueryDto) {
    const locale = q.locale ?? 'tr';
    const own = this.ownScope(actor);
    const scope = { agencyId: actor.agencyId, clientId: own.clientId, storeId: own.storeId };
    const rows: any[] = [];
    for (const event of EVENTS) {
      if (q.event && q.event !== event) continue;
      for (const channel of CHANNELS) {
        if (q.channel && q.channel !== channel) continue;
        const t = await this.notifications.resolve(scope, channel, event, locale, '', false);
        if (!t) continue;
        if (q.isActive !== undefined && ('isActive' in t ? t.isActive : true) !== q.isActive) continue;
        if (q.search && !`${t.name} ${'subject' in t ? t.subject ?? '' : ''}`.toLocaleLowerCase('tr-TR').includes(q.search.toLocaleLowerCase('tr-TR'))) continue;
        rows.push(this.toRow(t, own.level));
      }
    }
    // Özel sipariş durumu şablonları (ORDER_STATUS_CHANGED + orderStatusKey) sadece DB'de olur; ayrıca listele.
    const custom = await this.prisma.notificationTemplate.findMany({
      where: { ...this.visibleWhere(actor), event: 'ORDER_STATUS_CHANGED', orderStatusKey: { not: '' }, locale, ...(q.channel ? { channel: q.channel } : {}) },
      orderBy: [{ orderStatusKey: 'asc' }, { channel: 'asc' }],
    });
    for (const c of custom) rows.push(this.toRow({ ...c, resolvedFrom: c.scopeLevel }, own.level));
    return { items: rows, level: own.level, locale, locales: SUPPORTED_LOCALES };
  }

  private toRow(t: any, currentLevel: NotificationScope) {
    return {
      id: t.id,
      channel: t.channel,
      event: t.event,
      orderStatusKey: t.orderStatusKey ?? '',
      locale: t.locale,
      name: t.name,
      subject: t.subject ?? null,
      isActive: 'isActive' in t ? t.isActive : true,
      isSystemDefault: t.resolvedFrom === 'SYSTEM',
      resolvedFrom: t.resolvedFrom,
      scopeLevel: t.scopeLevel ?? 'SYSTEM',
      sendDelayMinutes: t.sendDelayMinutes ?? 0,
      version: t.version ?? 0,
      updatedAt: t.updatedAt ?? null,
      /** Bu kapsamda düzenlenebilir mi: satır tam bu seviyeden geliyorsa evet, üst/sistemse "Özelleştir". */
      editable: t.resolvedFrom === currentLevel,
    };
  }

  async get(actor: ActorContext, id: string) {
    if (isSystemTemplateId(id)) {
      const p = parseSystemTemplateId(id);
      const t = p && systemTemplate(p.channel, p.event, p.locale);
      if (!t) throw new NotFoundException('Template not found');
      return { ...t, isActive: true, isSystemDefault: true, scopeLevel: 'SYSTEM', resolvedFrom: 'SYSTEM', sendDelayMinutes: 0, version: 0, editable: false, orderStatusKey: '' };
    }
    const row = await this.ownRow(actor, id);
    return { ...row, isSystemDefault: false, resolvedFrom: row.scopeLevel, editable: row.scopeLevel === NotificationTemplateService.levelOf(actor) };
  }

  // ---------------------------------------------------------------- create

  private validateOrThrow(dto: { channel: NotificationChannel; event: NotificationEvent; subject?: string | null; bodyHtml?: string | null; bodyText?: string | null }) {
    const issues: (TemplateIssue & { field: string })[] = [];
    const check = (field: string, src?: string | null) => {
      if (!src) return;
      for (const i of validateTemplate(src, dto.event)) issues.push({ field, ...i });
    };
    if (dto.channel === 'EMAIL') {
      if (!dto.subject?.trim()) issues.push({ field: 'subject', line: 1, message: 'Konu zorunlu.' });
      if (!dto.bodyHtml?.trim()) issues.push({ field: 'bodyHtml', line: 1, message: 'E-posta gövdesi zorunlu.' });
      check('subject', dto.subject);
      check('bodyHtml', dto.bodyHtml);
      check('bodyText', dto.bodyText);
    } else {
      if (!dto.bodyText?.trim()) issues.push({ field: 'bodyText', line: 1, message: 'SMS gövdesi zorunlu.' });
      check('bodyText', dto.bodyText);
    }
    if (issues.length) throw new UnprocessableEntityException({ message: 'Template validation failed', issues });
  }

  async create(actor: ActorContext, dto: CreateTemplateDto) {
    if (dto.orderStatusKey && dto.event !== 'ORDER_STATUS_CHANGED') throw new BadRequestException('orderStatusKey only applies to ORDER_STATUS_CHANGED');
    this.validateOrThrow(dto);
    const own = this.ownScope(actor);
    const locale = dto.locale ?? 'tr';
    const dup = await this.prisma.notificationTemplate.findFirst({
      where: { agencyId: actor.agencyId, scopeKey: own.key, channel: dto.channel, event: dto.event, orderStatusKey: dto.orderStatusKey ?? '', locale, deletedAt: null },
    });
    if (dup) throw new BadRequestException('A template for this channel/event/locale already exists at this level');
    const row = await this.prisma.notificationTemplate.create({
      data: {
        agencyId: actor.agencyId,
        clientId: own.clientId,
        storeId: own.storeId,
        scopeKey: own.key,
        scopeLevel: own.level,
        channel: dto.channel,
        event: dto.event,
        orderStatusKey: dto.orderStatusKey ?? '',
        locale,
        name: dto.name,
        subject: dto.channel === 'EMAIL' ? dto.subject ?? null : null,
        bodyHtml: dto.channel === 'EMAIL' ? dto.bodyHtml ?? null : null,
        bodyText: dto.bodyText ?? '',
        isActive: dto.isActive ?? true,
        senderName: dto.senderName ?? null,
        replyTo: dto.replyTo ?? null,
        smsSenderId: dto.smsSenderId ?? null,
        sendDelayMinutes: dto.sendDelayMinutes ?? 0,
        updatedById: actor.userId ?? null,
      },
    });
    await this.log(actor, 'create', row, undefined, row);
    return this.get(actor, row.id);
  }

  /** Üst seviyedeki (veya sistem) şablonu mevcut seviyeye kopyalar. */
  async customize(actor: ActorContext, id: string) {
    const src = await this.get(actor, id);
    const own = this.ownScope(actor);
    if (!src.isSystemDefault && (src as any).scopeKey === own.key) throw new BadRequestException('Template is already at this level');
    return this.create(actor, {
      channel: src.channel,
      event: src.event,
      orderStatusKey: src.orderStatusKey || undefined,
      locale: src.locale,
      name: src.name,
      subject: src.subject ?? undefined,
      bodyHtml: src.bodyHtml ?? undefined,
      bodyText: src.bodyText ?? '',
      isActive: true,
      senderName: (src as any).senderName ?? undefined,
      replyTo: (src as any).replyTo ?? undefined,
      smsSenderId: (src as any).smsSenderId ?? undefined,
      sendDelayMinutes: src.sendDelayMinutes ?? 0,
    });
  }

  // ---------------------------------------------------------------- update

  private assertEditable(actor: ActorContext, row: NotificationTemplate) {
    if (row.scopeKey !== this.ownScope(actor).key) {
      throw new ForbiddenException('Template belongs to a higher level; customize it at this level instead');
    }
  }

  async update(actor: ActorContext, id: string, dto: UpdateTemplateDto) {
    if (isSystemTemplateId(id)) throw new ForbiddenException('System default templates cannot be edited; customize instead');
    const row = await this.ownRow(actor, id);
    this.assertEditable(actor, row);
    const next = { ...row, ...dto };
    this.validateOrThrow(next);
    const snapshot = Object.fromEntries(SNAPSHOT_FIELDS.map((f) => [f, row[f]]));
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.notificationTemplateVersion.create({ data: { agencyId: row.agencyId, templateId: row.id, version: row.version, snapshot, createdById: actor.userId ?? null } });
      return tx.notificationTemplate.update({
        where: { id: row.id },
        data: { ...dto, version: { increment: 1 }, updatedById: actor.userId ?? null },
      });
    });
    await this.log(actor, 'update', row, snapshot, Object.fromEntries(SNAPSHOT_FIELDS.map((f) => [f, updated[f]])));
    return this.get(actor, row.id);
  }

  async toggle(actor: ActorContext, id: string) {
    if (isSystemTemplateId(id)) throw new ForbiddenException('System default templates cannot be toggled; customize instead');
    const row = await this.ownRow(actor, id);
    this.assertEditable(actor, row);
    const updated = await this.prisma.notificationTemplate.update({ where: { id: row.id }, data: { isActive: !row.isActive, updatedById: actor.userId ?? null } });
    await this.log(actor, 'toggle', row, { isActive: row.isActive }, { isActive: updated.isActive });
    return this.get(actor, row.id);
  }

  async remove(actor: ActorContext, id: string) {
    if (isSystemTemplateId(id)) throw new ForbiddenException('System default templates cannot be deleted');
    const row = await this.ownRow(actor, id);
    this.assertEditable(actor, row);
    await this.prisma.notificationTemplate.update({ where: { id: row.id }, data: { deletedAt: new Date(), updatedById: actor.userId ?? null } });
    await this.log(actor, 'delete', row, row, undefined);
  }

  // -------------------------------------------------------------- versions

  async versions(actor: ActorContext, id: string) {
    const row = await this.ownRow(actor, id);
    return this.prisma.notificationTemplateVersion.findMany({ where: { templateId: row.id }, orderBy: { version: 'desc' } });
  }

  async restore(actor: ActorContext, id: string, versionId: string) {
    const row = await this.ownRow(actor, id);
    this.assertEditable(actor, row);
    const v = await this.prisma.notificationTemplateVersion.findFirst({ where: { id: versionId, templateId: row.id } });
    if (!v) throw new NotFoundException('Version not found');
    const snap = v.snapshot as Record<string, any>;
    return this.update(actor, id, Object.fromEntries(SNAPSHOT_FIELDS.filter((f) => snap[f] !== undefined).map((f) => [f, snap[f]])));
  }

  // ------------------------------------------------------- preview / test

  variables(event: NotificationEvent) {
    return variablesFor(event);
  }

  async preview(actor: ActorContext, dto: PreviewDto) {
    const issues: (TemplateIssue & { field: string })[] = [];
    for (const [field, src] of [['subject', dto.subject], ['bodyHtml', dto.bodyHtml], ['bodyText', dto.bodyText]] as const) {
      if (src) for (const i of validateTemplate(src, dto.event)) issues.push({ field, ...i });
    }
    const context = dto.orderId ? await this.orderContext(actor, dto.orderId, dto.event) : sampleContext(dto.event);
    if (issues.length) return { issues, subject: '', html: '', text: '', sms: null, sample: !dto.orderId };
    const rendered = this.notifications.renderTemplate({ channel: dto.channel, subject: dto.subject, bodyHtml: dto.bodyHtml, bodyText: dto.bodyText ?? '' }, context);
    return { issues, ...rendered, sample: !dto.orderId };
  }

  private async orderContext(actor: ActorContext, orderId: string, event: NotificationEvent) {
    // Sipariş aktif kapsamda olmalı — başka mağazanın siparişi 404.
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, agencyId: actor.agencyId, deletedAt: null, ...(actor.clientId ? { clientId: actor.clientId } : {}), ...(actor.storeId ? { storeId: actor.storeId } : {}) },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found in the active scope');
    return (await this.notifications.buildContext(order.id, event)) ?? {};
  }

  async testSend(actor: ActorContext, id: string, dto: TestSendDto) {
    const tpl = await this.get(actor, id);
    const override = { subject: dto.subject, bodyHtml: dto.bodyHtml, bodyText: dto.bodyText };
    const merged = { channel: tpl.channel, event: tpl.event, subject: override.subject ?? tpl.subject, bodyHtml: override.bodyHtml ?? tpl.bodyHtml, bodyText: override.bodyText ?? tpl.bodyText };
    this.validateOrThrow(merged);
    if (tpl.channel === 'EMAIL' ? !dto.recipient.includes('@') : dto.recipient.replace(/\D/g, '').length < 10) {
      throw new BadRequestException(tpl.channel === 'EMAIL' ? 'Recipient must be an e-mail address' : 'Recipient must be a phone number');
    }
    const context = dto.orderId ? await this.orderContext(actor, dto.orderId, tpl.event) : sampleContext(tpl.event);
    const own = this.ownScope(actor);
    const res = await this.notifications.enqueue({
      scope: { agencyId: actor.agencyId, clientId: own.clientId, storeId: own.storeId },
      template: { ...(tpl as any), resolvedFrom: tpl.resolvedFrom },
      recipient: dto.recipient,
      context,
      orderId: dto.orderId ?? null,
      isTest: true,
      override: Object.fromEntries(Object.entries(override).filter(([, v]) => v !== undefined)),
    });
    return { logId: res.logId };
  }

  // ----------------------------------------------------------------- audit

  private log(actor: ActorContext, action: string, row: NotificationTemplate, oldValue: any, newValue: any) {
    return this.audit.createLog({
      tenantId: actor.agencyId,
      userId: actor.userId,
      userEmail: actor.email ?? undefined,
      action,
      module: 'notification',
      entityType: 'NotificationTemplate',
      entityId: row.id,
      entityDisplayName: `${row.channel}:${row.event}:${row.locale}`,
      oldValue,
      newValue,
      ipAddress: actor.ipAddress,
    });
  }
}
