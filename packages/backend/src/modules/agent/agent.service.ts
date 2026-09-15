import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@common/prisma/prisma.service';
import { decrypt, encrypt } from '../../common/utils/encryption.util';
import { AuditLogService } from '../audit/audit.service';
import { AccountingProviderRegistry } from '../../integrations/accounting/core/AccountingProviderRegistry';
import { isProtocolVersionAccepted } from '../../integrations/accounting/core/agent/AgentProtocol';
import { AssignAgentDto, CreateEnrollmentCodeDto, EnrollAgentDto, SubmitCredentialEnvelopeDto } from './dto/agent.dto';

export interface AgentScope {
  agencyId: string;
  clientId?: string | null;
}
export interface ActorInfo {
  id?: string;
  email?: string;
  name?: string;
  ip?: string;
}

export const ENROLLMENT_CODE_TTL_MS = 15 * 60 * 1000;
export const ENVELOPE_TTL_MS = 24 * 60 * 60 * 1000;

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * docs/mikro.agent.md §9.3 / §9.4 / K9 — kayıt, iptal, kimlik zarfı taşıma, Agent atama.
 * Her sorguda agencyId filtresi; ERP kimliği bu serviste HİÇBİR ZAMAN düz metin görünmez.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditLogService,
  ) {}

  /** Tek kullanımlık kod: 15 dk, kiracı kapsamlı, yalnızca hash'i saklanır, üretimi audit'lenir. */
  async createEnrollmentCode(scope: AgentScope, dto: CreateEnrollmentCodeDto, actor: ActorInfo) {
    const code = randomBytes(6).toString('hex').toUpperCase(); // 12 hex — telefonla okunabilir
    const expiresAt = new Date(Date.now() + ENROLLMENT_CODE_TTL_MS);
    const row = await this.prisma.agentEnrollmentCode.create({
      data: {
        agencyId: scope.agencyId,
        clientId: dto.clientId ?? scope.clientId ?? null,
        codeHash: sha256(code),
        createdBy: actor.id ?? 'unknown',
        expiresAt,
      },
    });
    await this.audit?.createLog({
      tenantId: scope.agencyId,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'agent.enrollment_code.create',
      module: 'agent',
      entityType: 'AgentEnrollmentCode',
      entityId: row.id,
      description: 'Agent kayıt kodu üretildi',
      ipAddress: actor.ip,
    });
    // kod YALNIZCA bu cevapta görünür; sunucuda hash'i kalır
    return { id: row.id, code, expiresAt };
  }

  /** Agent tarafı — kimliksiz uç. Kod doğrulanır, yakılır; agentId + tünel sırrı verilir. */
  async enroll(dto: EnrollAgentDto) {
    if (!isProtocolVersionAccepted(dto.protocolVersion)) {
      throw new BadRequestException('Desteklenmeyen protokol sürümü');
    }
    if (!/^-----BEGIN PUBLIC KEY-----/.test(dto.publicKey.trim())) {
      throw new BadRequestException('publicKey SPKI PEM olmalı');
    }
    const codeRow = await this.prisma.agentEnrollmentCode.findUnique({ where: { codeHash: sha256(dto.code.trim().toUpperCase()) } });
    if (!codeRow || codeRow.usedAt || codeRow.expiresAt.getTime() < Date.now()) {
      // nötr hata: kod var mı yok mu sızmaz
      throw new ForbiddenException('Kayıt kodu geçersiz veya süresi dolmuş');
    }
    const secret = randomBytes(32).toString('hex');
    const agent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.agentInstance.upsert({
        where: { agencyId_name: { agencyId: codeRow.agencyId, name: dto.name } },
        create: {
          agencyId: codeRow.agencyId,
          clientId: codeRow.clientId,
          name: dto.name,
          status: 'PENDING',
          publicKey: dto.publicKey,
          tunnelSecret: encrypt(secret),
          agentVersion: dto.agentVersion,
          osVersion: dto.osVersion,
          protocolVersion: dto.protocolVersion,
          enrolledAt: new Date(),
        },
        // yedekten dönen sunucu yeniden kayıt olur: yeni anahtar + yeni sır, eski oturum düşer
        update: {
          status: 'PENDING',
          publicKey: dto.publicKey,
          tunnelSecret: encrypt(secret),
          agentVersion: dto.agentVersion,
          osVersion: dto.osVersion,
          protocolVersion: dto.protocolVersion,
          enrolledAt: new Date(),
          revokedAt: null,
          revokedBy: null,
        },
      });
      await tx.agentEnrollmentCode.update({ where: { id: codeRow.id }, data: { usedAt: new Date(), usedByAgentId: created.id } });
      return created;
    });
    await this.audit?.createLog({
      tenantId: codeRow.agencyId,
      action: 'agent.enroll',
      module: 'agent',
      entityType: 'AgentInstance',
      entityId: agent.id,
      entityDisplayName: agent.name,
      description: `Agent kaydoldu (v${dto.agentVersion}, ${dto.osVersion})`,
    });
    return { agentId: agent.id, agentSecret: secret };
  }

  /** Tünelde hello imzasını doğrulamak için — sır yalnızca gateway'e, cevaba ASLA. */
  async tunnelSecretOf(agentId: string): Promise<{ secret: string; status: string; agencyId: string } | null> {
    const a = await this.prisma.agentInstance.findUnique({ where: { id: agentId } });
    if (!a?.tunnelSecret) return null;
    return { secret: decrypt(a.tunnelSecret), status: a.status, agencyId: a.agencyId };
  }

  async list(scope: AgentScope) {
    const rows = await this.prisma.agentInstance.findMany({
      where: { agencyId: scope.agencyId, ...(scope.clientId ? { OR: [{ clientId: scope.clientId }, { clientId: null }] } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    // tunnelSecret cevaba girmez
    return rows.map(({ tunnelSecret: _s, ...rest }) => rest);
  }

  async get(scope: AgentScope, id: string) {
    const a = await this.prisma.agentInstance.findFirst({ where: { id, agencyId: scope.agencyId } });
    if (!a) throw new NotFoundException('Agent bulunamadı');
    const { tunnelSecret: _s, ...rest } = a;
    return rest;
  }

  /** §9.3: iptal sertifika süresini beklemez — gateway açık tüneli derhal kapatır. */
  async revoke(scope: AgentScope, id: string, actor: ActorInfo) {
    await this.get(scope, id);
    const updated = await this.prisma.agentInstance.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actor.id ?? 'unknown', tunnelSecret: null },
    });
    // bu Agent'a bağlı bağlantılardan kira düşer
    await this.prisma.accountingIntegration.updateMany({
      where: { agencyId: scope.agencyId, exclusiveAgentId: id },
      data: { exclusiveAgentId: null, agentLeaseUntil: null },
    });
    await this.audit?.createLog({
      tenantId: scope.agencyId,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'agent.revoke',
      module: 'agent',
      entityType: 'AgentInstance',
      entityId: id,
      entityDisplayName: updated.name,
      description: 'Agent iptal edildi',
      ipAddress: actor.ip,
    });
    const { tunnelSecret: _s, ...rest } = updated;
    return rest;
  }

  /**
   * K5/K9/K10 — bağlantıya Agent ata: rota AGENT olur, exclusiveAgentId tek Agent'a kilitlenir.
   * Sağlayıcı AGENT rotasını desteklemiyorsa reddedilir.
   */
  async assignToIntegration(scope: AgentScope, integrationId: string, dto: AssignAgentDto, actor: ActorInfo) {
    const integration = await this.prisma.accountingIntegration.findFirst({ where: { id: integrationId, agencyId: scope.agencyId, deletedAt: null } });
    if (!integration) throw new NotFoundException('Muhasebe entegrasyonu bulunamadı');
    const descriptor = AccountingProviderRegistry.get(integration.provider);
    if (!descriptor.supportedRoutes?.includes('AGENT')) {
      throw new BadRequestException(`${descriptor.displayName} AGENT rotasını desteklemiyor`);
    }
    const agent = await this.get(scope, dto.agentId);
    if (agent.status === 'REVOKED') throw new BadRequestException('İptal edilmiş Agent atanamaz');
    if (integration.exclusiveAgentId && integration.exclusiveAgentId !== dto.agentId) {
      // K9: ikinci Agent bağlanamaz; açık yazma işi varken devralma bloke
      const openWrites = await this.prisma.agentJob.count({
        where: { integrationId, agentId: integration.exclusiveAgentId, status: { in: ['queued', 'dispatched', 'running'] } },
      });
      if (openWrites > 0) {
        await this.raiseProblem(scope.agencyId, integrationId, integration.exclusiveAgentId, 'agent_failover_blocked', { openWrites });
        throw new BadRequestException('Mevcut Agent üzerinde açık iş var; devralma bloke (agent_failover_blocked)');
      }
    }
    const updated = await this.prisma.accountingIntegration.update({
      where: { id: integrationId },
      data: {
        route: 'AGENT',
        agentId: dto.agentId,
        exclusiveAgentId: dto.agentId,
        agentLeaseUntil: new Date(Date.now() + 24 * 3600 * 1000),
        transportSecurity: dto.transportSecurity ?? null,
      },
    });
    await this.audit?.createLog({
      tenantId: scope.agencyId,
      userId: actor.id,
      action: 'accounting.integration.assign_agent',
      module: 'agent',
      entityType: 'AccountingIntegration',
      entityId: integrationId,
      description: `Agent ${agent.name} atandı${dto.transportSecurity ? ` (${dto.transportSecurity})` : ''}`,
      ipAddress: actor.ip,
    });
    const { credentials: _c, ...rest } = updated;
    return rest;
  }

  /** K2 — blob'u bir kez kuyruğa koy; sunucuda kalan iz: credentialSetAt/By/Fingerprint. */
  async submitCredentialEnvelope(scope: AgentScope, dto: SubmitCredentialEnvelopeDto, actor: ActorInfo) {
    const integration = await this.prisma.accountingIntegration.findFirst({ where: { id: dto.integrationId, agencyId: scope.agencyId, deletedAt: null } });
    if (!integration) throw new NotFoundException('Muhasebe entegrasyonu bulunamadı');
    if (integration.route !== 'AGENT' || !integration.agentId) throw new BadRequestException('Bağlantıya önce bir Agent atanmalı');
    if (sha256(dto.blob) !== dto.fingerprint) throw new BadRequestException('Parmak izi blob ile uyuşmuyor');
    // eski teslim edilmemiş zarflar düşer: tek geçerli zarf
    await this.prisma.agentCredentialEnvelope.deleteMany({ where: { integrationId: dto.integrationId } });
    const env = await this.prisma.agentCredentialEnvelope.create({
      data: {
        agencyId: scope.agencyId,
        agentId: integration.agentId,
        integrationId: dto.integrationId,
        blob: dto.blob,
        fingerprint: dto.fingerprint,
        createdBy: actor.id ?? 'unknown',
        expiresAt: new Date(Date.now() + ENVELOPE_TTL_MS),
      },
    });
    await this.prisma.accountingIntegration.update({
      where: { id: dto.integrationId },
      data: { credentialSetAt: new Date(), credentialSetBy: actor.email ?? actor.id ?? 'unknown', credentialFingerprint: dto.fingerprint },
    });
    await this.audit?.createLog({
      tenantId: scope.agencyId,
      userId: actor.id,
      userEmail: actor.email,
      action: 'accounting.credential.envelope',
      module: 'agent',
      entityType: 'AccountingIntegration',
      entityId: dto.integrationId,
      description: `ERP kimlik zarfı kuyruğa alındı (fp ${dto.fingerprint.slice(0, 12)}…)`,
      ipAddress: actor.ip,
    });
    return { envelopeId: env.id, agentId: integration.agentId, expiresAt: env.expiresAt };
  }

  /** Teslim onayı (credential_ack) — blob SİLİNİR. */
  async envelopeDelivered(envelopeId: string, ok: boolean, error?: string) {
    const env = await this.prisma.agentCredentialEnvelope.findUnique({ where: { id: envelopeId } });
    if (!env) return;
    await this.prisma.agentCredentialEnvelope.delete({ where: { id: envelopeId } });
    if (!ok) {
      await this.raiseProblem(env.agencyId, env.integrationId, env.agentId, 'erp_auth_failed', { stage: 'envelope', error });
      await this.prisma.accountingIntegration.update({ where: { id: env.integrationId }, data: { lastErrorMessage: `Kimlik zarfı reddedildi: ${error ?? ''}` } });
    }
  }

  async pendingEnvelopes(agentId: string) {
    return this.prisma.agentCredentialEnvelope.findMany({ where: { agentId, expiresAt: { gt: new Date() } } });
  }

  /** Problem kuyruğu: aynı kod tekrarında sayaç artar, yeni satır AÇILMAZ. */
  async raiseProblem(agencyId: string, integrationId: string | null, agentId: string | null, code: string, detail?: Record<string, unknown>, companyKey?: string | null) {
    const key = { agencyId, integrationId: integrationId ?? '', code, companyKey: companyKey ?? '' };
    const existing = await this.prisma.accountingProblem.findFirst({ where: key });
    if (existing) {
      // çözülmüş satır yeniden açılır (unique anahtar aynı) — sayaç devam eder
      return this.prisma.accountingProblem.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          lastSeenAt: new Date(),
          resolvedAt: null,
          resolvedBy: null,
          detail: (detail ?? existing.detail) as any,
          agentId: agentId ?? existing.agentId,
        },
      });
    }
    try {
      return await this.prisma.accountingProblem.create({
        data: { ...key, integrationId: integrationId ?? '', agentId, severity: code === 'agent_failover_blocked' || code === 'invoice_stuck' ? 'error' : 'warn', detail: detail as any },
      });
    } catch (e: any) {
      this.logger.warn(`problem kaydı yazılamadı (${code}): ${e?.message}`);
      return null;
    }
  }
}
