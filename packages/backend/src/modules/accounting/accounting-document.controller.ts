import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorFromRequest } from '../rbac/rbac.service';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AccountingDocumentService } from './accounting-document.service';
import { AccountingScope } from './accounting.service';
import {
  AccountingQueryDto,
  AttachExternalDto,
  CancelLocallyDto,
  CreateAccountingInvoiceDocumentDto,
  CreateAccountingPaymentDocumentDto,
} from './dto/accounting.dto';

@ApiTags('Accounting Documents')
@ApiBearerAuth()
@ApiHeader({ name: 'x-agency-id', required: true, description: 'Active Agency ID' })
@ApiHeader({ name: 'x-client-id', required: false, description: 'Active Client ID' })
@ApiHeader({ name: 'x-store-id', required: false, description: 'Active Store ID' })
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Controller('/api/accounting/documents')
export class AccountingDocumentController {
  constructor(private readonly documentService: AccountingDocumentService) {}

  private extractScope(req: Request): AccountingScope {
    // Bulgu 6: ham header tenant filtresi olamaz; yalnizca TenantMiddleware'in dogruladigi baglam.
    const actor = actorFromRequest(req);
    return { agencyId: actor.agencyId, clientId: actor.clientId ?? undefined, storeId: actor.storeId ?? undefined };
  }

  @Get()
  @HttpCode(200)
  @RequirePermission('accounting.read')
  @ApiOperation({ summary: 'List accounting documents (invoices, payments)' })
  async list(@Query() query: AccountingQueryDto, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.documentService.listDocuments(query, scope);
  }

  @Post('invoices')
  @HttpCode(201)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Create invoice document with reservation-first idempotency' })
  async createInvoice(
    @Body() dto: CreateAccountingInvoiceDocumentDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    if (!dto.storeId && scope.storeId) dto.storeId = scope.storeId;
    return this.documentService.createInvoiceDocument(dto, scope);
  }

  @Post('payments')
  @HttpCode(201)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Create payment document with reservation-first idempotency' })
  async createPayment(
    @Body() dto: CreateAccountingPaymentDocumentDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    if (!dto.storeId && scope.storeId) dto.storeId = scope.storeId;
    return this.documentService.createPaymentDocument(dto, scope);
  }

  @Post(':id/resolve-stuck')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Asılı belgeyi çöz: INVOICE_FIND_BY_REF → bulundu: created, bulunamadı: failed (§10.1)' })
  async resolveStuck(@Param('id') id: string, @Req() req: Request) {
    return this.documentService.resolveStuck(id, this.extractScope(req));
  }

  @Post(':id/cancel-claim')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Release stuck pending reservation claim' })
  async cancelClaim(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.documentService.cancelDocumentClaim(id, scope);
  }

  @Post(':id/cancel-locally')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Cancel document locally when provider lacks API cancellation' })
  async cancelLocally(
    @Param('id') id: string,
    @Body() dto: CancelLocallyDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.documentService.cancelLocally(id, dto, scope, {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      ip: req.ip,
    });
  }

  @Post(':id/attach-external')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Manually attach external ID/number to stuck document' })
  async attachExternal(
    @Param('id') id: string,
    @Body() dto: AttachExternalDto,
    @Req() req: Request,
  ) {
    const scope = this.extractScope(req);
    const user = (req as any).user;
    return this.documentService.attachExternal(id, dto, scope, {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      ip: req.ip,
    });
  }
}
