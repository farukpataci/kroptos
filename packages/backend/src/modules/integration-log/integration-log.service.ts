import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';

export interface CreateIntegrationLogDto {
  tenantId: string;
  integrationType: string;
  provider: string;
  operation: string;
  entityType?: string;
  entityId?: string;
  sourceSystem?: string;
  targetSystem?: string;
  sourceReference?: string;
  targetReference?: string;
  status?: string;
  severity?: string;
  requestPayload?: any;
  responsePayload?: any;
  errorCode?: string;
  errorMessage?: string;
  errorStack?: string;
  errorStep?: string;
  suggestedAction?: string;
  retryCount?: number;
  maxRetryCount?: number;
}

@Injectable()
export class IntegrationLogService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService
  ) {}

  async createLog(data: CreateIntegrationLogDto) {
    try {
      return await this.prisma.integrationLog.create({
        data: {
          ...data,
          status: data.status || 'pending',
          severity: data.severity || 'error',
          requestPayload: data.requestPayload ? JSON.parse(JSON.stringify(data.requestPayload)) : undefined,
          responsePayload: data.responsePayload ? JSON.parse(JSON.stringify(data.responsePayload)) : undefined,
        },
      });
    } catch (err) {
      console.error('Failed to write integration log:', err);
    }
  }

  async getLogs(tenantId: string, query: any) {
    const { skip = 0, take = 50, provider, status, severity, operation } = query;
    const where: any = { tenantId };

    if (provider) where.provider = provider;
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (operation) where.operation = operation;

    const [items, total] = await Promise.all([
      this.prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.integrationLog.count({ where })
    ]);

    return { items, total };
  }

  async getLogById(tenantId: string, id: string) {
    return this.prisma.integrationLog.findFirst({
      where: { id, tenantId }
    });
  }

  async resolveLog(tenantId: string, id: string, userId: string, resolutionNote?: string) {
    const log = await this.prisma.integrationLog.updateMany({
      where: { id, tenantId },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedByUserId: userId,
        resolutionNote,
      }
    });

    if (log.count > 0) {
      await this.auditLogService.createLog({
        tenantId,
        userId,
        action: 'integration_log.resolve',
        entityType: 'IntegrationLog',
        entityId: id,
        description: `Integration log ${id} resolved`,
        newValue: { status: 'resolved', resolutionNote },
      });
    }

    return this.getLogById(tenantId, id);
  }

  async ignoreLog(tenantId: string, id: string, userId: string, resolutionNote?: string) {
    const log = await this.prisma.integrationLog.updateMany({
      where: { id, tenantId },
      data: {
        status: 'ignored',
        resolvedAt: new Date(),
        resolvedByUserId: userId,
        resolutionNote,
      }
    });

    if (log.count > 0) {
      await this.auditLogService.createLog({
        tenantId,
        userId,
        action: 'integration_log.ignore',
        entityType: 'IntegrationLog',
        entityId: id,
        description: `Integration log ${id} ignored`,
        newValue: { status: 'ignored', resolutionNote },
      });
    }

    return this.getLogById(tenantId, id);
  }

  async retryLog(tenantId: string, id: string, userId: string) {
    // Basic stub for retry. In a real system, you'd trigger the queue job based on log.operation
    const existing = await this.getLogById(tenantId, id);
    if (!existing || existing.status === 'resolved' || existing.status === 'ignored') {
      throw new Error('Cannot retry this log');
    }

    await this.prisma.integrationLog.update({
      where: { id },
      data: {
        status: 'retrying',
        retryCount: { increment: 1 },
      }
    });

    await this.auditLogService.createLog({
      tenantId,
      userId,
      action: 'integration_log.retry',
      entityType: 'IntegrationLog',
      entityId: id,
      description: `Retrying operation ${existing.operation}`,
    });

    return this.getLogById(tenantId, id);
  }
}
