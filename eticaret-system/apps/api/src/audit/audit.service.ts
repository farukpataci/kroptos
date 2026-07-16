import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import type { AuditAction } from '../auth/audit-actions';

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async write(input: {
    tenantId?: string;
    userId?: string;
    agencyId?: string;
    clientId?: string;
    storeId?: string;
    action: AuditAction | 'register' | 'login_failed';
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.database.client.auditLog.create({
      data: input as Prisma.AuditLogUncheckedCreateInput,
    });
  }
}
