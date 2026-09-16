import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { actorFromRequest } from '../rbac/rbac.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SignedUrlService } from '../../common/services/signed-url.service';
import { DatevExportService } from '../../integrations/accounting/datev/datev.export-service';
import { DatevConfig } from '../../integrations/accounting/datev/datev.types';
import { DatevValidator, DatevValidationError } from '../../integrations/accounting/datev/datev.validation';
import { DatevExportRequestDto, DatevConfigDto } from './dto/datev-export.dto';

interface CachedExportFile {
  buffer: Buffer;
  fileName: string;
  encoding: string;
  hashSha256: string;
  agencyId: string;
  createdAt: number;
}

@ApiTags('DATEV Export')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/accounting/datev')
export class DatevExportController {
  // In-memory export cache for immediate download (TTL 2 hours)
  private static readonly fileCache = new Map<string, CachedExportFile>();

  constructor(
    private readonly datevExportService: DatevExportService,
    private readonly prisma: PrismaService,
    private readonly signedUrlService: SignedUrlService,
  ) {}

  private extractScope(req: Request) {
    const user = (req as any).user;

    // Bulgu 6: ham header tenant filtresi olamaz; yalnizca dogrulanmis aktif baglam.
    const agencyId = actorFromRequest(req).agencyId;
    const userId = user?.id;
    const userEmail = user?.email;
    const userName = user?.name;
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string);

    return { agencyId, userId, userEmail, userName, ipAddress };
  }

  @Post('export')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Generate DATEV EXTF Buchungsstapel export file' })
  async generateExport(@Body() dto: DatevExportRequestDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    const result = await this.datevExportService.generateExport(dto, scope);

    // Cache file buffer for download endpoint
    DatevExportController.fileCache.set(result.batchId, {
      buffer: result.fileBuffer,
      fileName: result.fileName,
      encoding: result.encoding,
      hashSha256: result.hashSha256,
      agencyId: scope.agencyId,
      createdAt: Date.now(),
    });

    // Generate signed download token
    const token = this.signedUrlService.generateSignedToken(
      scope.agencyId,
      result.batchId,
      'export-csv',
    );

    return {
      success: true,
      batchId: result.batchId,
      fileName: result.fileName,
      hashSha256: result.hashSha256,
      encoding: result.encoding,
      datumVon: result.datumVon,
      datumBis: result.datumBis,
      totalDebit: result.totalDebit,
      totalCredit: result.totalCredit,
      entryCount: result.entryCount,
      orderIds: result.orderIds,
      reexportedOrderIds: result.reexportedOrderIds || [],
      downloadUrl: `/api/accounting/datev/exports/${result.batchId}/download`,
      downloadToken: token,
    };
  }

  @Get('exports')
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'List historical DATEV exports' })
  async listExports(@Query('companyId') companyId: string, @Req() req: Request) {
    const scope = this.extractScope(req);

    const where: any = {
      agencyId: scope.agencyId,
      type: 'datev_export',
    };
    if (companyId) {
      where.companyId = companyId;
    }

    const docs = await this.prisma.accountingDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Group documents by batch (externalNumber)
    const batchMap = new Map<string, any>();
    for (const doc of docs) {
      const batchId = doc.externalNumber || 'unknown';
      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, {
          batchId,
          hashSha256: doc.externalId,
          companyId: doc.companyId,
          createdAt: doc.createdAt,
          orderCount: 1,
          totalAmount: Number(doc.totalAmount),
          currency: doc.currency,
          downloadUrl: `/api/accounting/datev/exports/${batchId}/download`,
        });
      } else {
        const item = batchMap.get(batchId);
        item.orderCount += 1;
        item.totalAmount += Number(doc.totalAmount);
      }
    }

    return Array.from(batchMap.values());
  }

  @Get('exports/:batchId/download')
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Download DATEV EXTF CSV file' })
  async downloadExport(
    @Param('batchId') batchId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const scope = this.extractScope(req);
    const cached = DatevExportController.fileCache.get(batchId);

    if (!cached || cached.agencyId !== scope.agencyId) {
      // If not in memory cache, check if export exists in DB
      const existingDoc = await this.prisma.accountingDocument.findFirst({
        where: {
          agencyId: scope.agencyId,
          type: 'datev_export',
          externalNumber: batchId,
        },
      });

      if (!existingDoc) {
        throw new NotFoundException(`DATEV dışa aktarım dosyası (batchId: ${batchId}) bulunamadı.`);
      }

      // If document exists but memory cache expired, inform operator
      throw new NotFoundException(
        `DATEV dışa aktarım dosyasının (${batchId}) indirme oturumu sona erdi. Lütfen dışa aktarımı tekrar çalıştırınız.`,
      );
    }

    const contentType =
      cached.encoding === 'UTF-8'
        ? 'text/csv; charset=utf-8'
        : 'text/csv; charset=windows-1252';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${cached.fileName}"`);
    res.setHeader('X-Datev-SHA256', cached.hashSha256);
    res.setHeader('X-Datev-Encoding', cached.encoding);

    return res.send(cached.buffer);
  }

  @Get('config/:companyId')
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'Get stored DATEV configuration for company' })
  async getConfig(@Param('companyId') companyId: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    const company = await this.prisma.accountingCompany.findFirst({
      where: {
        id: companyId,
        agencyId: scope.agencyId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException(`Muhasebe şirketi (${companyId}) bulunamadı.`);
    }

    return (company.defaultAccountCodes as unknown as Partial<DatevConfig>) || null;
  }

  @Post('config/:companyId')
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Save DATEV configuration for company' })
  async saveConfig(
    @Param('companyId') companyId: string,
    @Body() configDto: DatevConfigDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    const company = await this.prisma.accountingCompany.findFirst({
      where: {
        id: companyId,
        agencyId: scope.agencyId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException(`Muhasebe şirketi (${companyId}) bulunamadı.`);
    }

    // Validate config
    const errors = DatevValidator.validateConfig(configDto as any);
    if (errors.length > 0) {
      throw new DatevValidationError(errors);
    }

    const updated = await this.prisma.accountingCompany.update({
      where: { id: companyId },
      data: {
        defaultAccountCodes: configDto as any,
      },
    });

    return {
      success: true,
      message: 'DATEV yapılandırması başarıyla kaydedildi.',
      config: updated.defaultAccountCodes,
    };
  }
}
