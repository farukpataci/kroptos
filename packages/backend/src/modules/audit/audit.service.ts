import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';

export interface AuditLogOptions {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: string;
  module?: string;
  entityType: string;
  entityId: string;
  entityDisplayName?: string;
  description?: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async createLog(options: AuditLogOptions) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          tenantId: options.tenantId,
          userId: options.userId,
          userEmail: options.userEmail,
          userName: options.userName,
          action: options.action,
          module: options.module,
          entityType: options.entityType,
          entityId: options.entityId,
          entityDisplayName: options.entityDisplayName,
          description: options.description,
          oldValue: options.oldValue ? JSON.parse(JSON.stringify(options.oldValue)) : undefined,
          newValue: options.newValue ? JSON.parse(JSON.stringify(options.newValue)) : undefined,
          metadata: options.metadata ? JSON.parse(JSON.stringify(options.metadata)) : undefined,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          requestId: options.requestId,
          severity: options.severity || 'info',
        },
      });
    } catch (e) {
      console.error('Failed to create audit log:', e);
    }
  }

  async getLogs(tenantId: string, query: any) {
    const { skip = 0, take = 50, action, entityType, userId, severity } = query;
    
    const where: any = { tenantId };
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;
    if (severity) where.severity = severity;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return { items, total };
  }

  async getLogById(tenantId: string, id: string) {
    return this.prisma.auditLog.findFirst({
      where: { id, tenantId }
    });
  }
}
