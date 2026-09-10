import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@common/prisma/prisma.service';
import { AuditLogService } from '../../../modules/audit/audit.service';
import {
  DatevBookingEntry,
  DatevConfig,
  DatevExportOptions,
  DatevExportResult,
  DatevHeaderInput,
  DatevInvoiceInput,
  DatevPaymentInput,
} from './datev.types';
import { DatevValidator, DatevValidationError } from './datev.validation';
import { DatevBookingMapper } from './datev.booking-mapper';
import { DatevExtfWriter } from './datev.extf-writer';

export class DatevReexportError extends BadRequestException {
  constructor(public readonly alreadyExportedIds: string[]) {
    super(
      `GoBD Uyarısı: Belirtilen tarih aralığında daha önce dışa aktarılmış ${
        alreadyExportedIds.length
      } adet sipariş bulunmaktadır (${alreadyExportedIds.slice(0, 5).join(', ')}${
        alreadyExportedIds.length > 5 ? '...' : ''
      }). Tekrar dışa aktarım Steuerberater tarafında mükerrer kayda yol açabilir. Devam etmek istiyorsanız 'Tekrar dışa aktarımı onaylıyorum' seçeneğini işaretleyiniz.`,
    );
  }
}

export interface DatevUserScope {
  agencyId: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  ipAddress?: string;
}

@Injectable()
export class DatevExportService {
  private readonly logger = new Logger(DatevExportService.name);

  constructor(
    private readonly prisma?: PrismaService,
    private readonly auditLogService?: AuditLogService,
  ) {}

  /**
   * Pure in-memory export function (§5, §6).
   * Has NO network or database dependencies. Validates and generates deterministic EXTF file buffer.
   */
  exportBuchungsstapel(params: {
    config: DatevConfig;
    invoices: DatevInvoiceInput[];
    payments?: DatevPaymentInput[];
    datumVon: string | Date;
    datumBis: string | Date;
    batchId?: string;
  }): DatevExportResult {
    const { config, invoices, payments = [], datumVon, datumBis } = params;

    // 1. Validate Config
    const configErrors = DatevValidator.validateConfig(config);
    if (configErrors.length > 0) {
      throw new DatevValidationError(configErrors);
    }

    // 2. Validate Header
    const headerInput: DatevHeaderInput = {
      beraterNummer: config.beraterNummer,
      mandantenNummer: config.mandantenNummer,
      wjBeginn: config.wjBeginn,
      sachkontenLaenge: config.sachkontenLaenge,
      datumVon,
      datumBis,
      kontenrahmen: config.kontenrahmen,
      bezeichnung: config.bezeichnung || 'Buchungsstapel',
      diktatKuerzel: config.diktatKuerzel,
      festschreibung: config.festschreibung ?? 0,
    };

    const headerErrors = DatevValidator.validateHeader(headerInput);
    if (headerErrors.length > 0) {
      throw new DatevValidationError(headerErrors);
    }

    // 3. Map bookings
    const entries: DatevBookingEntry[] = DatevBookingMapper.mapBatch(invoices, payments, config);

    // 4. Validate Entries
    const entryErrors = DatevValidator.validateEntries(
      entries,
      config.sachkontenLaenge,
      datumVon,
      datumBis,
    );
    if (entryErrors.length > 0) {
      throw new DatevValidationError(entryErrors);
    }

    // 5. Generate EXTF CSV buffer
    const encoding = config.encoding || 'WINDOWS-1252';
    const writerOutput = DatevExtfWriter.generateBuchungsstapel({
      header: headerInput,
      entries,
      encoding,
    });

    // 6. Compute SHA-256 hash
    const hashSha256 = crypto.createHash('sha256').update(writerOutput.buffer).digest('hex');
    const batchId = params.batchId || `datev_${Date.now()}`;
    const fileName = `EXTF_Buchungsstapel_${batchId}.csv`;

    const orderIds = invoices.map(i => i.orderId);

    return {
      batchId,
      fileName,
      fileBuffer: writerOutput.buffer,
      hashSha256,
      encoding,
      datumVon: new Date(datumVon).toISOString().substring(0, 10),
      datumBis: new Date(datumBis).toISOString().substring(0, 10),
      totalDebit: writerOutput.totalDebit,
      totalCredit: writerOutput.totalCredit,
      entryCount: writerOutput.entryCount,
      orderIds,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Orchestrated export with Prisma DB queries, GoBD idempotency check, and Audit logging (§8.4)
   */
  async generateExport(options: DatevExportOptions, scope: DatevUserScope): Promise<DatevExportResult> {
    if (!this.prisma) {
      throw new Error('PrismaService is required for database-driven export');
    }

    const { companyId, dateFrom, dateTo, acknowledgeReexport, overrideConfig } = options;

    // 1. Resolve Accounting Company & DATEV Config
    const company = await this.prisma.accountingCompany.findFirst({
      where: {
        id: companyId,
        agencyId: scope.agencyId,
        deletedAt: null,
      },
      include: {
        integration: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Muhasebe şirketi (id: ${companyId}) bulunamadı.`);
    }

    // Load stored config or override
    const storedConfig = (company.defaultAccountCodes as unknown as Partial<DatevConfig>) || {};
    const config: DatevConfig = {
      ...storedConfig,
      ...overrideConfig,
    } as DatevConfig;

    // 2. Fetch orders within period
    const startOfDateFrom = new Date(`${dateFrom}T00:00:00.000Z`);
    const endOfDateTo = new Date(`${dateTo}T23:59:59.999Z`);

    const orders = await this.prisma.order.findMany({
      where: {
        agencyId: scope.agencyId,
        createdAt: {
          gte: startOfDateFrom,
          lte: endOfDateTo,
        },
        deletedAt: null,
        status: { not: 'cancelled' },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) {
      throw new BadRequestException(
        `Belirtilen tarih aralığında (${dateFrom} - ${dateTo}) dışa aktarılacak sipariş bulunamadı.`,
      );
    }

    const orderIds = orders.map(o => o.id);

    // 3. GoBD Re-export Check & Idempotency claim (§8.4)
    const existingExports = await this.prisma.accountingDocument.findMany({
      where: {
        agencyId: scope.agencyId,
        companyId: company.id,
        type: 'datev_export',
        referenceCode: { in: orderIds },
        status: 'sent',
      },
      select: {
        referenceCode: true,
      },
    });

    const alreadyExportedIds = existingExports.map(e => e.referenceCode);
    if (alreadyExportedIds.length > 0 && !acknowledgeReexport) {
      throw new DatevReexportError(alreadyExportedIds);
    }

    // 4. Map Orders to DatevInvoiceInput
    const invoices: DatevInvoiceInput[] = orders.map(order => ({
      orderId: order.id,
      invoiceNumber: order.orderNumber,
      issueDate: order.createdAt,
      grandTotal: Number(order.totalAmount),
      currency: order.currency || 'EUR',
      customerId: order.customerId || undefined,
      customerName: order.customerName,
      items: order.items.map(item => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        vatRate: 19, // Default standard VAT rate for German market
        totalAmount: Number(item.totalPrice),
      })),
    }));

    // 5. Generate EXTF Export
    const batchId = `datev_${Date.now()}`;
    const exportResult = this.exportBuchungsstapel({
      config,
      invoices,
      datumVon: dateFrom,
      datumBis: dateTo,
      batchId,
    });

    if (alreadyExportedIds.length > 0) {
      exportResult.reexportedOrderIds = alreadyExportedIds;
    }

    // 6. Record GoBD claims in AccountingDocument
    for (const order of orders) {
      await this.prisma.accountingDocument.upsert({
        where: {
          agencyId_storeId_type_referenceCode: {
            agencyId: scope.agencyId,
            storeId: order.storeId,
            type: 'datev_export',
            referenceCode: order.id,
          },
        },
        update: {
          externalId: exportResult.hashSha256,
          externalNumber: batchId,
          status: 'sent',
          totalAmount: order.totalAmount,
          currency: order.currency || 'EUR',
          updatedAt: new Date(),
        },
        create: {
          agencyId: scope.agencyId,
          clientId: order.clientId,
          storeId: order.storeId,
          integrationId: company.integrationId,
          companyId: company.id,
          type: 'datev_export',
          referenceCode: order.id,
          externalId: exportResult.hashSha256,
          externalNumber: batchId,
          totalAmount: order.totalAmount,
          currency: order.currency || 'EUR',
          status: 'sent',
        },
      });
    }

    // 7. Audit log record
    if (this.auditLogService) {
      await this.auditLogService.createLog({
        tenantId: scope.agencyId,
        userId: scope.userId,
        userEmail: scope.userEmail,
        userName: scope.userName,
        action: 'DATEV_EXPORT_GENERATED',
        module: 'accounting',
        entityType: 'DatevExport',
        entityId: batchId,
        entityDisplayName: exportResult.fileName,
        description: `DATEV EXTF Buchungsstapel dışa aktarıldı (${exportResult.entryCount} kayıt, SHA-256: ${exportResult.hashSha256})`,
        ipAddress: scope.ipAddress,
        metadata: {
          batchId,
          hashSha256: exportResult.hashSha256,
          entryCount: exportResult.entryCount,
          totalDebit: exportResult.totalDebit,
          totalCredit: exportResult.totalCredit,
          dateFrom,
          dateTo,
          reexportedCount: alreadyExportedIds.length,
        },
      });
    }

    return exportResult;
  }
}
