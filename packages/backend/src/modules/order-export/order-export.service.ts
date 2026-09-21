import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import {
  CreateExportJobDto,
  OrderExportFiltersDto,
  PreviewExportDto,
  CreatePresetDto,
  UpdatePresetDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto/order-export.dto';
import {
  EXPORT_COLUMNS,
  COLUMNS_MAP,
  getAvailableColumns,
  escapeFormula,
} from './columns/column-registry';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { OrderExportProcessor } from './order-export.processor';
import { OrderExportScheduler } from './order-export.scheduler';

export interface TenantScope {
  agencyId: string;
  clientId?: string | null;
  storeId?: string | null;
}

@Injectable()
export class OrderExportService {
  private readonly logger = new Logger(OrderExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: OrderExportProcessor,
    private readonly scheduler: OrderExportScheduler,
  ) {}

  /**
   * Return export directory on disk
   */
  getExportStorageDir(): string {
    const dir = path.join(process.cwd(), 'storage', 'exports');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  getColumns(canPii: boolean, rowMode?: 'ORDER' | 'LINE_ITEM') {
    return getAvailableColumns(canPii, rowMode).map((c) => ({
      key: c.key,
      label: c.label,
      group: c.group,
      type: c.type,
      rowModes: c.rowModes,
      pii: c.pii,
    }));
  }

  buildWhereClause(filters?: OrderExportFiltersDto, scope?: TenantScope): any {
    const where: any = { deletedAt: null };

    if (scope?.storeId) {
      where.storeId = scope.storeId;
    } else if (scope?.clientId) {
      where.clientId = scope.clientId;
    } else if (scope?.agencyId) {
      where.agencyId = scope.agencyId;
    }

    if (!filters) return where;

    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.clientId) where.clientId = filters.clientId;

    if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }
    if (filters.paymentStatuses && filters.paymentStatuses.length > 0) {
      where.paymentStatus = { in: filters.paymentStatuses };
    }
    if (filters.fulfillmentStatuses && filters.fulfillmentStatuses.length > 0) {
      where.fulfillmentStatus = { in: filters.fulfillmentStatuses };
    }
    if (filters.source) {
      where.source = filters.source;
    }

    // Date filtering
    const dateField = filters.dateField || 'createdAt';
    if (filters.startDate || filters.endDate) {
      where[dateField] = {};
      if (filters.startDate) {
        where[dateField].gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where[dateField].lte = new Date(filters.endDate);
      }
    }

    // Specific order numbers or search
    if (filters.orderNumbers && filters.orderNumbers.length > 0) {
      where.orderNumber = { in: filters.orderNumbers };
    } else if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async count(filters: OrderExportFiltersDto | undefined, scope: TenantScope) {
    const where = this.buildWhereClause(filters, scope);

    const totalOrders = await this.prisma.order.count({ where });

    const totalItems = await this.prisma.orderItem.count({
      where: {
        order: where,
      },
    });

    return { totalOrders, totalItems };
  }

  async preview(dto: PreviewExportDto, scope: TenantScope, canPii: boolean) {
    const where = this.buildWhereClause(dto.filters, scope);

    const activeColumns = dto.columns
      .map((k) => COLUMNS_MAP.get(k))
      .filter((c): c is NonNullable<typeof c> => !!c);

    // Validate PII
    for (const c of activeColumns) {
      if (c.pii && !canPii) {
        throw new ForbiddenException(`'${c.label}' kişisel veri (PII) kolonu için 'order_export.pii' izni gereklidir.`);
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        store: { select: { name: true } },
      },
    });

    const headers = activeColumns.map((c) => c.label);
    const rows: any[][] = [];

    if (dto.rowMode === 'LINE_ITEM') {
      for (const order of orders) {
        if (!order.items || order.items.length === 0) {
          const row = activeColumns.map((c) => c.resolve(order, undefined, dto.formatOptions));
          rows.push(row);
        } else {
          for (const item of order.items) {
            const row = activeColumns.map((c) => c.resolve(order, item, dto.formatOptions));
            rows.push(row);
          }
        }
        if (rows.length >= 20) break;
      }
    } else {
      for (const order of orders) {
        const row = activeColumns.map((c) => c.resolve(order, undefined, dto.formatOptions));
        rows.push(row);
      }
    }

    return {
      headers,
      rows: rows.slice(0, 20),
      totalSampled: rows.slice(0, 20).length,
    };
  }

  async createJob(
    dto: CreateExportJobDto,
    scope: TenantScope,
    userId?: string,
    canPii = false,
  ) {
    if (!scope.agencyId) {
      throw new BadRequestException('Aktif ajans bağlamı zorunludur.');
    }

    // Default storeId if not present
    let storeId = scope.storeId || dto.filters?.storeId;
    if (!storeId) {
      const defaultStore = await this.prisma.store.findFirst({
        where: { agencyId: scope.agencyId, deletedAt: null },
        select: { id: true },
      });
      storeId = defaultStore?.id;
    }

    if (!storeId) {
      throw new BadRequestException('Dışa aktarma için aktif mağaza seçilmelidir.');
    }

    // Validate Columns
    let hasPii = false;
    for (const colKey of dto.columns) {
      const col = COLUMNS_MAP.get(colKey);
      if (!col) {
        throw new BadRequestException(`Bilinmeyen dışa aktarma kolonu: ${colKey}`);
      }
      if (col.pii) {
        hasPii = true;
        if (!canPii) {
          throw new ForbiddenException(`'${col.label}' kişisel veri (PII) kolonu için 'order_export.pii' izni gereklidir.`);
        }
      }
    }

    // Limit active jobs per user (max 3 concurrent)
    if (userId) {
      const activeCount = await this.prisma.orderExportJob.count({
        where: {
          requestedById: userId,
          status: { in: ['QUEUED', 'PROCESSING'] },
        },
      });
      if (activeCount >= 3) {
        throw new BadRequestException('Aynı anda en fazla 3 aktif dışa aktarma işi çalıştırılabilir. Lütfen mevcut işlerin bitmesini bekleyin.');
      }
    }

    const job = await this.prisma.orderExportJob.create({
      data: {
        agencyId: scope.agencyId,
        clientId: scope.clientId || undefined,
        storeId,
        presetId: dto.presetId || undefined,
        requestedById: userId,
        filters: (dto.filters || {}) as any,
        columns: dto.columns as any,
        rowMode: dto.rowMode,
        format: dto.format,
        formatOptions: (dto.formatOptions || {}) as any,
        status: 'QUEUED',
        progress: 0,
        includesPii: hasPii,
      },
      include: {
        preset: { select: { name: true } },
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'ORDER_EXPORT_CREATED',
        entityType: 'OrderExportJob',
        entityId: job.id,
        userId: userId || undefined,
        tenantId: scope.agencyId,
        newValue: {
          jobId: job.id,
          format: dto.format,
          rowMode: dto.rowMode,
          columnsCount: dto.columns.length,
          includesPii: hasPii,
        },
      },
    }).catch(() => undefined);

    // Enqueue job for background processing
    await this.processor.enqueueJob({
      jobId: job.id,
      agencyId: job.agencyId,
      storeId: job.storeId,
      clientId: job.clientId || undefined,
    });

    return job;
  }

  async listJobs(
    scope: TenantScope,
    userId?: string,
    canReadAll = false,
    page = 1,
    limit = 20,
    status?: string,
  ) {
    const where: any = {
      agencyId: scope.agencyId,
      deletedAt: null,
    };

    if (scope.storeId) {
      where.storeId = scope.storeId;
    }

    // If cannot read all, filter to own jobs
    if (!canReadAll && userId) {
      where.requestedById = userId;
    }

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.orderExportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          preset: { select: { name: true } },
        },
      }),
      this.prisma.orderExportJob.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getJob(id: string, scope: TenantScope) {
    const job = await this.prisma.orderExportJob.findFirst({
      where: { id, agencyId: scope.agencyId, deletedAt: null },
      include: {
        preset: { select: { name: true } },
      },
    });

    if (!job) {
      throw new NotFoundException('Dışa aktarma işi bulunamadı.');
    }

    return job;
  }

  async cancelJob(id: string, scope: TenantScope) {
    const job = await this.getJob(id, scope);

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new BadRequestException('Yalnızca sıradaki veya çalışan işler iptal edilebilir.');
    }

    return this.prisma.orderExportJob.update({
      where: { id: job.id },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Kullanıcı tarafından iptal edildi.',
      },
    });
  }

  async rerunJob(id: string, scope: TenantScope, userId?: string, canPii = false) {
    const job = await this.getJob(id, scope);

    return this.createJob(
      {
        presetId: job.presetId || undefined,
        rowMode: job.rowMode as any,
        format: job.format as any,
        columns: job.columns as any,
        filters: job.filters as any,
        formatOptions: job.formatOptions as any,
      },
      scope,
      userId,
      canPii,
    );
  }

  async deleteJob(id: string, scope: TenantScope) {
    const job = await this.getJob(id, scope);

    // Delete file from disk if exists
    if (job.fileKey) {
      try {
        const filePath = path.join(this.getExportStorageDir(), job.fileKey);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        this.logger.warn(`Could not delete file ${job.fileKey}: ${err}`);
      }
    }

    await this.prisma.orderExportJob.update({
      where: { id: job.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Generates a short-lived (5 min) download token and registers the token hash
   */
  async generateDownloadToken(id: string, scope: TenantScope, user: any) {
    const job = await this.getJob(id, scope);

    if (job.status !== 'COMPLETED' || !job.fileKey) {
      throw new BadRequestException('Bu iş henüz tamamlanmadı veya indirme dosyası mevcut değil.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await this.prisma.orderExportJob.update({
      where: { id: job.id },
      data: {
        downloadTokenHash: tokenHash,
      },
    });

    // Record audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'ORDER_EXPORT_DOWNLOAD_REQUESTED',
        entityType: 'OrderExportJob',
        entityId: job.id,
        userId: user?.id,
        tenantId: scope.agencyId,
        newValue: {
          jobId: job.id,
          fileName: job.fileName,
          includesPii: job.includesPii,
        },
      },
    }).catch(() => undefined);

    return {
      token,
      fileName: job.fileName,
      downloadUrl: `/api/order-exports/${job.id}/download?token=${token}`,
    };
  }

  async verifyAndGetFileStream(id: string, token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const job = await this.prisma.orderExportJob.findFirst({
      where: { id, downloadTokenHash: tokenHash, deletedAt: null },
    });

    if (!job || !job.fileKey) {
      throw new NotFoundException('Geçersiz veya süresi dolmuş indirme bağlantısı.');
    }

    const filePath = path.join(this.getExportStorageDir(), job.fileKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Dışa aktarma dosyası sunucuda bulunamadı veya süresi doldu.');
    }

    // Increment download count and clear single-use token hash
    await this.prisma.orderExportJob.update({
      where: { id: job.id },
      data: {
        downloadCount: { increment: 1 },
        downloadTokenHash: null,
      },
    });

    return {
      stream: fs.createReadStream(filePath),
      fileName: job.fileName || `siparis_export_${job.id}.${job.format.toLowerCase()}`,
      fileSize: job.fileSize,
      format: job.format,
    };
  }

  // ==================== PRESETS ====================

  async listPresets(scope: TenantScope) {
    return this.prisma.orderExportPreset.findMany({
      where: {
        agencyId: scope.agencyId,
        deletedAt: null,
      },
      orderBy: [{ isSystemDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createPreset(dto: CreatePresetDto, scope: TenantScope, userId?: string) {
    let storeId = scope.storeId;
    if (!storeId) {
      const defaultStore = await this.prisma.store.findFirst({
        where: { agencyId: scope.agencyId, deletedAt: null },
        select: { id: true },
      });
      storeId = defaultStore?.id;
    }

    if (!storeId) {
      throw new BadRequestException('Şablon kaydı için mağaza seçilmelidir.');
    }

    return this.prisma.orderExportPreset.create({
      data: {
        agencyId: scope.agencyId,
        clientId: scope.clientId || undefined,
        storeId,
        name: dto.name,
        description: dto.description,
        isShared: dto.isShared !== false,
        createdById: userId,
        rowMode: dto.rowMode,
        format: dto.format,
        columns: dto.columns as any,
        filters: (dto.filters || {}) as any,
        formatOptions: (dto.formatOptions || {}) as any,
      },
    });
  }

  async updatePreset(id: string, dto: UpdatePresetDto, scope: TenantScope) {
    const preset = await this.prisma.orderExportPreset.findFirst({
      where: { id, agencyId: scope.agencyId, deletedAt: null },
    });

    if (!preset) {
      throw new NotFoundException('Şablon bulunamadı.');
    }

    return this.prisma.orderExportPreset.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isShared: dto.isShared,
        rowMode: dto.rowMode,
        format: dto.format,
        columns: dto.columns ? (dto.columns as any) : undefined,
        filters: dto.filters ? (dto.filters as any) : undefined,
        formatOptions: dto.formatOptions ? (dto.formatOptions as any) : undefined,
      },
    });
  }

  async deletePreset(id: string, scope: TenantScope) {
    const preset = await this.prisma.orderExportPreset.findFirst({
      where: { id, agencyId: scope.agencyId, deletedAt: null },
    });

    if (!preset) {
      throw new NotFoundException('Şablon bulunamadı.');
    }

    if (preset.isSystemDefault) {
      throw new ForbiddenException('Sistem varsayılan şablonları silinemez.');
    }

    await this.prisma.orderExportPreset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  // ==================== SCHEDULES ====================

  async listSchedules(scope: TenantScope) {
    return this.prisma.orderExportSchedule.findMany({
      where: {
        agencyId: scope.agencyId,
        deletedAt: null,
      },
      include: {
        preset: { select: { id: true, name: true, format: true, rowMode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSchedule(dto: CreateScheduleDto, scope: TenantScope, userId?: string) {
    let storeId = scope.storeId;
    if (!storeId) {
      const defaultStore = await this.prisma.store.findFirst({
        where: { agencyId: scope.agencyId, deletedAt: null },
        select: { id: true },
      });
      storeId = defaultStore?.id;
    }

    if (!storeId) {
      throw new BadRequestException('Zamanlama için mağaza seçilmelidir.');
    }

    const preset = await this.prisma.orderExportPreset.findFirst({
      where: { id: dto.presetId, agencyId: scope.agencyId, deletedAt: null },
    });
    if (!preset) {
      throw new NotFoundException('Seçilen şablon bulunamadı.');
    }

    return this.prisma.orderExportSchedule.create({
      data: {
        agencyId: scope.agencyId,
        clientId: scope.clientId || undefined,
        storeId,
        name: dto.name,
        presetId: dto.presetId,
        cron: dto.cron,
        timezone: dto.timezone || 'Europe/Istanbul',
        relativeRange: dto.relativeRange,
        recipients: dto.recipients || [],
        isActive: dto.isActive !== false,
        createdById: userId,
      },
      include: {
        preset: { select: { id: true, name: true } },
      },
    });
  }

  async updateSchedule(id: string, dto: UpdateScheduleDto, scope: TenantScope) {
    const schedule = await this.prisma.orderExportSchedule.findFirst({
      where: { id, agencyId: scope.agencyId, deletedAt: null },
    });
    if (!schedule) {
      throw new NotFoundException('Zamanlama bulunamadı.');
    }

    return this.prisma.orderExportSchedule.update({
      where: { id },
      data: {
        name: dto.name,
        presetId: dto.presetId,
        cron: dto.cron,
        timezone: dto.timezone,
        relativeRange: dto.relativeRange as any,
        recipients: dto.recipients,
        isActive: dto.isActive,
      },
      include: {
        preset: { select: { id: true, name: true } },
      },
    });
  }

  async deleteSchedule(id: string, scope: TenantScope) {
    const schedule = await this.prisma.orderExportSchedule.findFirst({
      where: { id, agencyId: scope.agencyId, deletedAt: null },
    });
    if (!schedule) {
      throw new NotFoundException('Zamanlama bulunamadı.');
    }

    await this.prisma.orderExportSchedule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async runScheduleNow(id: string, scope: TenantScope) {
    return this.scheduler.runScheduleNow(id, scope.agencyId);
  }
}
