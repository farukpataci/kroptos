import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { OrderImportProcessor } from './order-import.processor';
import { OrderFileReader, FileDetectionResult } from './parsing/file-reader';
import { AutoMapper, normalizeHeader } from './mapping/auto-mapper';
import {
  OrderRowValidator,
  ValidatorContext,
  ValidatedOrderGroup,
} from './validation/order-row.validator';
import { ImportTemplateGenerator } from './template/import-template.generator';
import {
  SaveMappingDto,
  SaveValueMapsDto,
  StartImportDto,
  CreateMappingTemplateDto,
  UpdateMappingTemplateDto,
} from './dto/order-import.dto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadedFileDto {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface TenantScope {
  agencyId: string;
  storeId: string;
  clientId?: string;
  isSuperAdmin?: boolean;
}

@Injectable()
export class OrderImportService {
  private readonly logger = new Logger(OrderImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: OrderImportProcessor,
  ) {}

  private getStorageDir(): string {
    const dir = path.join(process.cwd(), 'storage', 'imports');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private async writeAuditLog(
    action: string,
    entityId: string,
    userId: string,
    agencyId: string,
    changes: any = {},
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType: 'OrderImportJob',
          entityId,
          userId,
          tenantId: agencyId,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (e: any) {
      this.logger.error(`Audit log yazılamadı: ${e.message}`);
    }
  }

  /**
   * 1. Get sample import template
   */
  async getSampleTemplate(format: 'CSV' | 'XLSX' = 'XLSX', rowMode: 'ORDER' | 'LINE_ITEM' = 'LINE_ITEM') {
    if (format === 'CSV') {
      const csv = await ImportTemplateGenerator.generateCsv(rowMode);
      return {
        buffer: Buffer.from(csv, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        fileName: `ornek-siparis-sablonu-${rowMode.toLowerCase()}.csv`,
      };
    } else {
      const workbook = await ImportTemplateGenerator.generateWorkbook(rowMode);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `ornek-siparis-sablonu-${rowMode.toLowerCase()}.xlsx`,
      };
    }
  }

  /**
   * 2. Upload file & analyze
   */
  async uploadFile(
    file: UploadedFileDto,
    userId: string,
    scope: TenantScope,
  ) {
    if (!file) {
      throw new BadRequestException('Lütfen bir dosya yükleyin.');
    }

    const maxSizeBytes = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('Dosya boyutu 20 MB sınırını aşıyor.');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsm') {
      throw new BadRequestException('Makro içeren Excel (.xlsm) dosyaları güvenlik nedeniyle desteklenmez.');
    }

    if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
      throw new BadRequestException('Yalnızca CSV veya Excel (.xlsx, .xls) dosyaları desteklenir.');
    }

    // Compute sha256
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Check duplicate file hash in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const duplicateJob = await this.prisma.orderImportJob.findFirst({
      where: {
        storeId: scope.storeId,
        fileHash,
        createdAt: { gte: thirtyDaysAgo },
        deletedAt: null,
      },
      select: { id: true, fileName: true, createdAt: true },
    });

    let duplicateHashWarning: string | undefined;
    if (duplicateJob) {
      duplicateHashWarning = `Bu dosya (${duplicateJob.fileName}) son 30 gün içinde (${duplicateJob.createdAt.toLocaleDateString('tr-TR')}) bu mağazada yüklenmiş görünüyor.`;
    }

    // Save file to disk
    const storageDir = this.getStorageDir();
    const diskFileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const fullPath = path.join(storageDir, diskFileName);
    fs.writeFileSync(fullPath, file.buffer);

    // Inspect file
    const detection = await OrderFileReader.inspectFile(fullPath);

    // Run auto-mapping
    const mappingSuggestion = AutoMapper.mapHeaders(detection.headers);

    // Check saved templates
    const templates = await this.prisma.orderImportMapping.findMany({
      where: {
        storeId: scope.storeId,
        deletedAt: null,
      },
      select: { id: true, columnMap: true },
    });

    const suggestedTemplateId = AutoMapper.findBestTemplate(
      detection.headers,
      templates.map((t) => ({ id: t.id, columnMap: t.columnMap as Record<string, string> })),
    );

    // Create OrderImportJob in DB
    const job = await this.prisma.orderImportJob.create({
      data: {
        agencyId: scope.agencyId,
        clientId: scope.clientId,
        storeId: scope.storeId,
        requestedById: userId,
        fileKey: diskFileName,
        fileName: file.originalname,
        fileHash,
        fileSize: file.size,
        format: detection.format,
        mode: 'CREATE_ONLY',
        matchKey: 'orderNumber',
        columnMap: mappingSuggestion.columnMap,
        valueMaps: {},
        options: {
          encoding: detection.encoding,
          delimiter: detection.delimiter,
          headerRow: detection.headerRow,
          sheetName: detection.sheetNames?.[0],
          decimalSeparator: 'auto',
          dayFirst: true,
          suppressStock: true,
          suppressNotifications: true,
          suppressAutomation: true,
          suppressMarketplace: true,
        },
        status: 'UPLOADED',
        totalRows: detection.totalEstimatedRows,
      },
    });

    await this.writeAuditLog('upload', job.id, userId, scope.agencyId, {
      fileName: file.originalname,
      fileSize: file.size,
      totalRows: detection.totalEstimatedRows,
    });

    return {
      job,
      detection,
      mappingSuggestion,
      suggestedTemplateId,
      duplicateHashWarning,
    };
  }

  /**
   * Helper to fetch job with tenant verification
   */
  private async getJobScoped(jobId: string, scope: TenantScope) {
    const job = await this.prisma.orderImportJob.findFirst({
      where: {
        id: jobId,
        storeId: scope.storeId,
        agencyId: scope.agencyId,
        deletedAt: null,
      },
    });

    if (!job) {
      throw new NotFoundException(`İçe aktarma işi '${jobId}' bulunamadı.`);
    }

    return job;
  }

  /**
   * 3. Save Column Mapping & Mode
   */
  async saveMapping(jobId: string, dto: SaveMappingDto, userId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);

    const updated = await this.prisma.orderImportJob.update({
      where: { id: job.id },
      data: {
        mode: dto.mode || job.mode,
        matchKey: dto.matchKey || job.matchKey,
        columnMap: dto.columnMap,
        options: {
          ...(job.options as any),
          ...(dto.options || {}),
        },
        status: 'MAPPING',
      },
    });

    return updated;
  }

  /**
   * 4. Scan file and detect unmapped values
   */
  async getUnmappedValues(jobId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);
    const storageDir = this.getStorageDir();
    const filePath = path.join(storageDir, job.fileKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Kaynak dosya sunucuda bulunamadı.');
    }

    const columnMap = job.columnMap as Record<string, string>;
    const options = (job.options as any) || {};

    const fieldToFileHeader: Record<string, string> = {};
    for (const [fileHeader, canonicalKey] of Object.entries(columnMap)) {
      fieldToFileHeader[canonicalKey] = fileHeader;
    }

    // Collect value occurrences for key enum fields
    const occurrences: Record<string, Map<string, number>> = {
      status: new Map(),
      paymentStatus: new Map(),
      carrierName: new Map(),
      paymentMethod: new Map(),
      source: new Map(),
    };

    const uniqueSkus = new Set<string>();

    await OrderFileReader.streamRows(
      filePath,
      {
        format: job.format as any,
        encoding: options.encoding,
        delimiter: options.delimiter,
        headerRow: options.headerRow || 1,
        sheetName: options.sheetName,
      },
      (row) => {
        for (const field of ['status', 'paymentStatus', 'carrierName', 'paymentMethod', 'source']) {
          const header = fieldToFileHeader[field];
          if (header && row[header] !== undefined && String(row[header]).trim() !== '') {
            const val = String(row[header]).trim();
            occurrences[field].set(val, (occurrences[field].get(val) || 0) + 1);
          }
        }

        const skuHeader = fieldToFileHeader['itemSku'];
        if (skuHeader && row[skuHeader]) {
          uniqueSkus.add(String(row[skuHeader]).trim());
        }
      },
    );

    // Pre-load store catalog products for sku check
    const storeProducts = await this.prisma.product.findMany({
      where: { storeId: scope.storeId, deletedAt: null },
      select: { sku: true },
    });
    const catalogSkus = new Set(storeProducts.map((p) => (p.sku || '').toLowerCase()));

    const unmappedProducts: Array<{ value: string; count: number; inCatalog: boolean }> = [];
    for (const sku of uniqueSkus) {
      const inCatalog = catalogSkus.has(sku.toLowerCase());
      if (!inCatalog) {
        unmappedProducts.push({ value: sku, count: 1, inCatalog: false });
      }
    }

    // Format results
    const result: Record<string, Array<{ value: string; count: number; suggestion?: string }>> = {};

    for (const [field, counts] of Object.entries(occurrences)) {
      result[field] = [];
      for (const [val, count] of counts.entries()) {
        const norm = normalizeHeader(val);
        result[field].push({
          value: val,
          count,
          suggestion: norm,
        });
      }
    }

    result['products'] = unmappedProducts;
    return result;
  }

  /**
   * 5. Save Value Mappings
   */
  async saveValueMaps(jobId: string, dto: SaveValueMapsDto, userId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);

    const updated = await this.prisma.orderImportJob.update({
      where: { id: job.id },
      data: {
        valueMaps: dto.valueMaps,
        options: {
          ...(job.options as any),
          allowNonCatalogProducts: dto.allowNonCatalogProducts ?? false,
        },
      },
    });

    return updated;
  }

  /**
   * 6. Dry-run validation of the job
   */
  async validateJob(jobId: string, userId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);
    const storageDir = this.getStorageDir();
    const filePath = path.join(storageDir, job.fileKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Yüklenen dosya bulunamadı.');
    }

    await this.prisma.orderImportJob.update({
      where: { id: job.id },
      data: { status: 'VALIDATING' },
    });

    // Clean previous row results for this job if re-validating
    await this.prisma.orderImportRowResult.deleteMany({
      where: { jobId: job.id },
    });

    const columnMap = job.columnMap as Record<string, string>;
    const valueMaps = (job.valueMaps as Record<string, Record<string, string>>) || {};
    const options = (job.options as any) || {};

    // Group rows by matchKey
    const matchKeyField = job.matchKey || 'orderNumber';
    const matchKeyHeader = Object.entries(columnMap).find(([, v]) => v === matchKeyField)?.[0];

    const groupedRows = new Map<string, Array<{ rowNumber: number; data: Record<string, any> }>>();
    let autoGroupCounter = 1;

    await OrderFileReader.streamRows(
      filePath,
      {
        format: job.format as any,
        encoding: options.encoding,
        delimiter: options.delimiter,
        headerRow: options.headerRow || 1,
        sheetName: options.sheetName,
      },
      (row, rowNum) => {
        let key = matchKeyHeader ? String(row[matchKeyHeader] || '').trim() : '';
        if (!key) {
          key = `AUTO_GROUP_${autoGroupCounter++}`;
        }

        if (!groupedRows.has(key)) {
          groupedRows.set(key, []);
        }
        groupedRows.get(key)!.push({ rowNumber: rowNum, data: row });
      },
    );

    // Pre-load store products
    const products = await this.prisma.product.findMany({
      where: { storeId: scope.storeId, deletedAt: null },
      select: { id: true, name: true, sku: true, price: true, barcode: true },
    });

    const productsBySku = new Map<string, any>();
    const productsByBarcode = new Map<string, any>();
    for (const p of products) {
      if (p.sku) productsBySku.set(p.sku.toLowerCase(), p);
      if (p.barcode) productsByBarcode.set(p.barcode.toLowerCase(), p);
    }

    // Pre-load existing orders
    const existingOrders = await this.prisma.order.findMany({
      where: { storeId: scope.storeId, deletedAt: null },
      select: {
        id: true,
        orderNumber: true,
        marketplaceOrderNumber: true,
        publicId: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        totalAmount: true,
      },
    });

    const existingOrdersByMatchKey = new Map<string, any>();
    for (const o of existingOrders) {
      if (o.orderNumber) existingOrdersByMatchKey.set(o.orderNumber.trim(), o);
      if (o.marketplaceOrderNumber) existingOrdersByMatchKey.set(o.marketplaceOrderNumber.trim(), o);
      if (o.publicId) existingOrdersByMatchKey.set(o.publicId.trim(), o);
    }

    const validatorCtx: ValidatorContext = {
      mode: job.mode as any,
      matchKey: job.matchKey as any,
      columnMap,
      valueMaps,
      allowNonCatalogProducts: options.allowNonCatalogProducts,
      options: {
        decimalSeparator: options.decimalSeparator,
        dayFirst: options.dayFirst,
        timezone: options.timezone,
      },
      productsBySku,
      productsByBarcode,
      existingOrdersByMatchKey,
    };

    const validatedGroups: ValidatedOrderGroup[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let skippedCount = 0;

    for (const [groupKey, rows] of groupedRows.entries()) {
      const groupResult = OrderRowValidator.validateGroup(groupKey, rows, validatorCtx);
      validatedGroups.push(groupResult);

      if (groupResult.status === 'VALID') validCount++;
      else if (groupResult.status === 'INVALID') invalidCount++;
      else if (groupResult.status === 'SKIPPED') skippedCount++;
    }

    // Batch insert into OrderImportRowResult
    const BATCH_SIZE = 250;
    for (let i = 0; i < validatedGroups.length; i += BATCH_SIZE) {
      const batch = validatedGroups.slice(i, i + BATCH_SIZE);
      await this.prisma.orderImportRowResult.createMany({
        data: batch.map((g) => ({
          agencyId: job.agencyId,
          clientId: job.clientId,
          storeId: job.storeId,
          jobId: job.id,
          groupKey: g.groupKey,
          rowNumbers: g.rowNumbers,
          action: g.action,
          status: g.status,
          errors: g.errors.length > 0 ? (g.errors as any) : undefined,
          warnings: {
            list: g.warnings,
            _parsedOrder: g.parsedOrder, // Cached for actual execution
          } as any,
          orderId: g.existingOrderId,
        })),
      });
    }

    // Update job counters
    const updatedJob = await this.prisma.orderImportJob.update({
      where: { id: job.id },
      data: {
        status: 'VALIDATED',
        totalOrders: validatedGroups.length,
        validOrders: validCount,
        invalidOrders: invalidCount,
        skippedCount,
      },
    });

    // Sample problematic rows for preview
    const sampleProblems = validatedGroups
      .filter((g) => g.status === 'INVALID' || g.warnings.length > 0)
      .slice(0, 30);

    return {
      job: updatedJob,
      summary: {
        totalOrders: validatedGroups.length,
        validOrders: validCount,
        invalidOrders: invalidCount,
        skippedCount,
      },
      sampleProblems,
    };
  }

  /**
   * 7. Get Job Details & polling
   */
  async getJob(jobId: string, scope: TenantScope) {
    return this.getJobScoped(jobId, scope);
  }

  /**
   * 8. Get Paginated Row Results
   */
  async getJobRows(
    jobId: string,
    status: string | undefined,
    page: number = 1,
    limit: number = 50,
    scope: TenantScope,
  ) {
    await this.getJobScoped(jobId, scope);

    const where: any = { jobId };
    if (status) {
      where.status = status;
    }

    const skip = (Math.max(1, page) - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.orderImportRowResult.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.orderImportRowResult.count({ where }),
    ]);

    return {
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 9. Start processing the validated import
   */
  async startImport(jobId: string, dto: StartImportDto, userId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);

    if (job.status !== 'VALIDATED') {
      throw new BadRequestException('Yalnızca doğrulanmış (VALIDATED) işler başlatılabilir.');
    }

    // Update job options
    const updated = await this.prisma.orderImportJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        options: {
          ...(job.options as any),
          ...dto,
        },
      },
    });

    // Enqueue to processor
    await this.processor.enqueueJob({
      jobId: job.id,
      agencyId: job.agencyId,
      storeId: job.storeId,
      clientId: job.clientId || undefined,
      action: 'PROCESS',
    });

    await this.writeAuditLog('start', job.id, userId, scope.agencyId, dto);

    return updated;
  }

  /**
   * 10. Cancel an import job
   */
  async cancelJob(jobId: string, userId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);

    if (['PROCESSING', 'COMPLETED', 'ROLLED_BACK'].includes(job.status)) {
      throw new BadRequestException(`'${job.status}' durumundaki iş iptal edilemez.`);
    }

    const updated = await this.prisma.orderImportJob.update({
      where: { id: job.id },
      data: { status: 'CANCELLED' },
    });

    await this.writeAuditLog('cancel', job.id, userId, scope.agencyId);
    return updated;
  }

  /**
   * 11. Error Report File
   */
  async getErrorReportFile(jobId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);

    if (!job.errorReportKey) {
      throw new NotFoundException('Bu işe ait hata raporu bulunamadı.');
    }

    const storageDir = this.getStorageDir();
    const filePath = path.join(storageDir, job.errorReportKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Hata raporu dosyası diskte bulunamadı.');
    }

    return {
      filePath,
      fileName: `hata-raporu-${job.fileName.replace(/\.[^/.]+$/, '')}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * 12. Rollback Import Job
   */
  async rollbackImport(jobId: string, userId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);

    if (!['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(job.status)) {
      throw new BadRequestException(`Yalnızca tamamlanmış işler geri alınabilir (Mevcut durum: ${job.status}).`);
    }

    if (job.rollbackDeadline && new Date() > job.rollbackDeadline) {
      throw new ForbiddenException('Bu iş için 24 saatlik geri alma süresi dolmuştur.');
    }

    // Enqueue rollback
    await this.processor.enqueueJob({
      jobId: job.id,
      agencyId: job.agencyId,
      storeId: job.storeId,
      clientId: job.clientId || undefined,
      action: 'ROLLBACK',
    });

    await this.writeAuditLog('rollback_request', job.id, userId, scope.agencyId);

    return { message: 'Geri alma işlemi başlatıldı.', jobId: job.id };
  }

  /**
   * 13. List Import History
   */
  async listJobs(scope: TenantScope, page: number = 1, limit: number = 20) {
    const where: any = {
      agencyId: scope.agencyId,
      storeId: scope.storeId,
      deletedAt: null,
    };

    const skip = (Math.max(1, page) - 1) * limit;
    const [jobs, total] = await Promise.all([
      this.prisma.orderImportJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.orderImportJob.count({ where }),
    ]);

    return {
      items: jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 14. Delete / Soft delete Job
   */
  async deleteJob(jobId: string, userId: string, scope: TenantScope) {
    const job = await this.getJobScoped(jobId, scope);

    await this.prisma.orderImportJob.update({
      where: { id: job.id },
      data: { deletedAt: new Date() },
    });

    // Delete disk file
    const storageDir = this.getStorageDir();
    const filePath = path.join(storageDir, job.fileKey);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }

    await this.writeAuditLog('delete', job.id, userId, scope.agencyId);
    return { success: true };
  }

  // ==================== TEMPLATES CRUD ====================

  async listTemplates(scope: TenantScope) {
    return this.prisma.orderImportMapping.findMany({
      where: {
        storeId: scope.storeId,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getTemplate(id: string, scope: TenantScope) {
    const tpl = await this.prisma.orderImportMapping.findFirst({
      where: {
        id,
        storeId: scope.storeId,
        deletedAt: null,
      },
    });
    if (!tpl) {
      throw new NotFoundException(`Şablon '${id}' bulunamadı.`);
    }
    return tpl;
  }

  async createTemplate(dto: CreateMappingTemplateDto, userId: string, scope: TenantScope) {
    return this.prisma.orderImportMapping.create({
      data: {
        agencyId: scope.agencyId,
        clientId: scope.clientId,
        storeId: scope.storeId,
        createdById: userId,
        name: dto.name,
        isShared: dto.isShared ?? true,
        mode: dto.mode,
        matchKey: dto.matchKey,
        columnMap: dto.columnMap,
        valueMaps: dto.valueMaps || {},
        defaults: dto.defaults || {},
        fileHints: dto.fileHints || {},
      },
    });
  }

  async updateTemplate(id: string, dto: UpdateMappingTemplateDto, userId: string, scope: TenantScope) {
    await this.getTemplate(id, scope);

    return this.prisma.orderImportMapping.update({
      where: { id },
      data: {
        name: dto.name,
        isShared: dto.isShared,
        mode: dto.mode,
        matchKey: dto.matchKey,
        columnMap: dto.columnMap,
        valueMaps: dto.valueMaps,
        defaults: dto.defaults,
        fileHints: dto.fileHints,
      },
    });
  }

  async deleteTemplate(id: string, userId: string, scope: TenantScope) {
    await this.getTemplate(id, scope);

    await this.prisma.orderImportMapping.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
