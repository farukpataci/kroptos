import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '@common/prisma/prisma.service';
import { decrypt, encrypt } from '../../common/utils/encryption.util';
import { AuditLogService } from '../audit/audit.service';
import {
  buildEmailProvider,
  buildSmsProvider,
  EMAIL_PROVIDERS,
  EmailProvider,
  PROVIDER_FIELDS,
  SMS_PROVIDERS,
  SmsProvider,
} from './providers';

/**
 * Kanal başına sağlayıcı ayarı, ajans seviyesinde. Gizli alanlar
 * (encryption.util) şifreli; API yanıtında yalnız "ayarlı mı" bilgisi döner.
 */
@Injectable()
export class NotificationProviderService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  async list(agencyId: string) {
    const rows = await this.prisma.notificationProviderConfig.findMany({ where: { agencyId, deletedAt: null } });
    const byChannel = new Map(rows.map((r) => [r.channel, r]));
    return (['EMAIL', 'SMS'] as NotificationChannel[]).map((channel) => {
      const row = byChannel.get(channel);
      const secrets = row?.secretsEncrypted ? this.readSecrets(row.secretsEncrypted) : {};
      return {
        channel,
        provider: row?.provider ?? null,
        isActive: row?.isActive ?? false,
        config: (row?.config as Record<string, unknown>) ?? {},
        /** Hangi secret alanlar dolu (değer asla dönmez). */
        secretsSet: Object.keys(secrets).filter((k) => secrets[k]),
        options: channel === 'EMAIL' ? EMAIL_PROVIDERS : SMS_PROVIDERS,
        fields: PROVIDER_FIELDS,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async upsert(agencyId: string, channel: NotificationChannel, dto: { provider: string; isActive?: boolean; config?: Record<string, unknown>; secrets?: Record<string, string> }, userId?: string) {
    const allowed = channel === 'EMAIL' ? EMAIL_PROVIDERS : SMS_PROVIDERS;
    if (!(allowed as readonly string[]).includes(dto.provider)) {
      throw new BadRequestException(`Provider must be one of: ${allowed.join(', ')}`);
    }
    const fields = PROVIDER_FIELDS[dto.provider] ?? [];
    const secretKeys = new Set(fields.filter((f) => f.secret).map((f) => f.key));
    const config: Record<string, Prisma.InputJsonValue> = {};
    for (const f of fields) if (!f.secret && dto.config && dto.config[f.key] !== undefined) config[f.key] = dto.config[f.key] as Prisma.InputJsonValue;

    const existing = await this.prisma.notificationProviderConfig.findFirst({ where: { agencyId, channel, deletedAt: null } });
    // Boş gönderilen secret "değiştirme" demektir; mevcut değer korunur.
    const merged = existing?.secretsEncrypted && existing.provider === dto.provider ? this.readSecrets(existing.secretsEncrypted) : {};
    for (const [k, v] of Object.entries(dto.secrets ?? {})) if (secretKeys.has(k) && v) merged[k] = v;

    const data = {
      provider: dto.provider,
      isActive: dto.isActive ?? true,
      config,
      secretsEncrypted: Object.keys(merged).length ? encrypt(JSON.stringify(merged)) : null,
    };
    const row = existing
      ? await this.prisma.notificationProviderConfig.update({ where: { id: existing.id }, data })
      : await this.prisma.notificationProviderConfig.create({ data: { agencyId, channel, ...data } });

    await this.audit.createLog({
      tenantId: agencyId,
      userId,
      action: existing ? 'update' : 'create',
      module: 'notification',
      entityType: 'NotificationProviderConfig',
      entityId: row.id,
      entityDisplayName: `${channel}:${dto.provider}`,
      oldValue: existing ? { provider: existing.provider, isActive: existing.isActive, config: existing.config } : undefined,
      newValue: { provider: row.provider, isActive: row.isActive, config: row.config },
    });
    return (await this.list(agencyId)).find((c) => c.channel === channel);
  }

  /** Aktif sağlayıcı; ayarlı değilse null (gönderim SKIPPED + neden). */
  async emailProvider(agencyId: string): Promise<EmailProvider | null> {
    const row = await this.prisma.notificationProviderConfig.findFirst({ where: { agencyId, channel: 'EMAIL', isActive: true, deletedAt: null } });
    if (!row) return null;
    return buildEmailProvider(row.provider, row.config as Record<string, any>, row.secretsEncrypted ? this.readSecrets(row.secretsEncrypted) : {});
  }

  async smsProvider(agencyId: string): Promise<SmsProvider | null> {
    const row = await this.prisma.notificationProviderConfig.findFirst({ where: { agencyId, channel: 'SMS', isActive: true, deletedAt: null } });
    if (!row) return null;
    return buildSmsProvider(row.provider, row.config as Record<string, any>, row.secretsEncrypted ? this.readSecrets(row.secretsEncrypted) : {});
  }

  async test(agencyId: string, channel: NotificationChannel) {
    const provider = channel === 'EMAIL' ? await this.emailProvider(agencyId) : await this.smsProvider(agencyId);
    if (!provider) throw new BadRequestException(`${channel} provider is not configured`);
    await provider.test();
    return { ok: true, provider: provider.name };
  }

  private readSecrets(encrypted: string): Record<string, string> {
    try {
      return JSON.parse(decrypt(encrypted));
    } catch {
      return {};
    }
  }
}
