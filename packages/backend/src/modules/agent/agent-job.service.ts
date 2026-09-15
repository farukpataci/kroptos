import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AgentJob, AgentResult } from '../../integrations/accounting/core/agent/AgentProtocol';
import { AgentJobDispatcher, AgentTransport } from '../../integrations/accounting/core/transport/AgentTransport';
import { AccountingNetworkError } from '../../integrations/accounting/core/AccountingErrors';
import { buildSessionKey } from '../../integrations/accounting/core/AccountingSessionKey';
import { AgentGatewayService } from './agent-gateway.service';
import { AgentService } from './agent.service';

/**
 * AgentJobDispatcher uygulaması: iş satırını yazar (kalıcı kuyruk), gateway'e bırakır, sonucu bekler.
 * K9: iş yalnızca bağlantının exclusiveAgentId'sine gider; başka Agent'a ASLA.
 * Sonuç gelmezse (Agent çevrimdışı / tünel koptu) AccountingNetworkError → çağıran 'stuck' yazar.
 */
@Injectable()
export class AgentJobService implements AgentJobDispatcher {
  private readonly logger = new Logger(AgentJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AgentGatewayService,
    private readonly agentService: AgentService,
  ) {}

  /** Bağlantı için transport üret — connector Agent'ı bilmez, yalnızca bunu kullanır (K5). */
  async transportFor(integration: { id: string; agencyId: string; exclusiveAgentId: string | null; agentId: string | null; agentLeaseUntil: Date | null }, extraForbiddenKeys?: readonly string[]): Promise<AgentTransport> {
    const agentId = integration.exclusiveAgentId ?? integration.agentId;
    if (!agentId) throw new AccountingNetworkError('AGENT', 'Bağlantıya Agent atanmamış');
    if (integration.exclusiveAgentId && integration.agentLeaseUntil && integration.agentLeaseUntil.getTime() < Date.now()) {
      // kira dolmuş; açık yazma işi varsa devralma bloke — iş yine de aynı Agent'a gider (K9)
      this.logger.warn(`integration ${integration.id}: agent kirası dolmuş, yine de ${agentId} kullanılıyor (K9)`);
    }
    return new AgentTransport(this, { agentId, agencyId: integration.agencyId, extraForbiddenKeys });
  }

  async dispatch(job: AgentJob): Promise<AgentResult> {
    const integration = await this.prisma.accountingIntegration.findUnique({ where: { id: job.integrationId } });
    if (!integration) throw new AccountingNetworkError('AGENT', 'Bağlantı yok');
    const allowed = integration.exclusiveAgentId ?? integration.agentId;
    if (allowed !== job.agentId) {
      await this.agentService.raiseProblem(integration.agencyId, integration.id, job.agentId, 'agent_failover_blocked', { requested: job.agentId, exclusive: allowed });
      throw new AccountingNetworkError('AGENT', `İş yalnızca ${allowed} Agent'ına gidebilir (K9)`);
    }

    const companyKey = buildSessionKey(job.integrationId, job.companyKey);
    const row = await this.prisma.agentJob.create({
      data: {
        id: job.jobId,
        agencyId: integration.agencyId,
        agentId: job.agentId,
        integrationId: job.integrationId,
        companyKey,
        type: job.type,
        payload: job.payload as any, // AgentTransport zaten sızıntı denetledi (K1)
        idempotencyKey: job.idempotencyKey,
        status: 'queued',
        attempt: job.attempt,
        notBefore: job.notBefore ? new Date(job.notBefore) : null,
        expiresAt: new Date(Date.parse(job.issuedAt) + job.ttlSec * 1000),
      },
    });

    if (!this.gateway.isConnected(job.agentId)) {
      await this.agentService.raiseProblem(integration.agencyId, integration.id, job.agentId, 'agent_offline', { jobId: row.id }, companyKey);
    }

    const timeoutMs = (job.jobTimeoutSec + 30) * 1000;
    try {
      const result = await this.gateway.dispatch(job, timeoutMs);
      return result;
    } catch (e: any) {
      // sonuç gelmedi: iş DB'de kuyrukta kalır, Agent bağlanınca yeniden gönderilir (en az bir kez)
      throw new AccountingNetworkError('AGENT', e?.message ?? 'Agent cevap vermedi');
    }
  }

  async listJobs(agencyId: string, filter: { integrationId?: string; status?: string; take?: number }) {
    return this.prisma.agentJob.findMany({
      where: { agencyId, ...(filter.integrationId ? { integrationId: filter.integrationId } : {}), ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filter.take ?? 100, 500),
    });
  }
}
