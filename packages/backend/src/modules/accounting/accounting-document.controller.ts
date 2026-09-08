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
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AccountingDocumentService } from './accounting-document.service';
import { AccountingScope } from './accounting.service';
import {
  AccountingQueryDto,
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
    const activeAgency = (req as any).activeAgency;
    const activeClient = (req as any).activeClient;
    const activeStore = (req as any).activeStore;

    const agencyId = activeAgency?.id || (req.headers['x-agency-id'] as string);
    const clientId = activeClient?.id || (req.headers['x-client-id'] as string);
    const storeId = activeStore?.id || (req.headers['x-store-id'] as string);

    return { agencyId, clientId, storeId };
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

  @Post(':id/cancel-claim')
  @HttpCode(200)
  @RequirePermission('accounting.manage')
  @ApiOperation({ summary: 'Release stuck pending reservation claim' })
  async cancelClaim(@Param('id') id: string, @Req() req: Request) {
    const scope = this.extractScope(req);
    return this.documentService.cancelDocumentClaim(id, scope);
  }
}
