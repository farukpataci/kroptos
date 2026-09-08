import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit.service';
import {
  AccountingAmountMismatchError,
  AccountingIdempotencyError,
} from '../../integrations/accounting/core/AccountingErrors';
import { AccountingConnectorFactory } from '../../integrations/accounting/core/AccountingConnectorFactory';
import { AccountingCredentialService } from '../../integrations/accounting/core/AccountingCredentialService';
import {
  AccountingEnvironment,
  AccountingInvoiceItem,
  AccountingInvoiceRequest,
} from '../../integrations/accounting/core/AccountingTypes';
import {
  AccountingQueryDto,
  AttachExternalDto,
  CancelLocallyDto,
  CreateAccountingInvoiceDocumentDto,
  CreateAccountingPaymentDocumentDto,
} from './dto/accounting.dto';
import { AccountingMappingService } from './accounting-mapping.service';
import { AccountingScope } from './accounting.service';

@Injectable()
export class AccountingDocumentService {
  private readonly logger = new Logger(AccountingDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectorFactory: AccountingConnectorFactory,
    private readonly credentialsService: AccountingCredentialService,
    private readonly mappingService: AccountingMappingService,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  /**
   * Reservation-first idempotency implementation for sales invoice emission.
   */
  async createInvoiceDocument(
    dto: CreateAccountingInvoiceDocumentDto,
    scope: AccountingScope,
  ) {
    const integration = await this.prisma.accountingIntegration.findFirst({
      where: {
        id: dto.integrationId,
        agencyId: scope.agencyId,
        deletedAt: null,
      },
      include: { companies: true },
    });

    if (!integration) {
      throw new NotFoundException('Muhasebe entegrasyonu bulunamadı.');
    }

    const company = integration.companies.find((c) => c.id === dto.companyId);
    if (!company) {
      throw new NotFoundException('Belirtilen firma bu entegrasyona ait değil.');
    }

    // 1. Check idempotency table first
    const existingDoc = await this.prisma.accountingDocument.findUnique({
      where: {
        agencyId_storeId_type_referenceCode: {
          agencyId: scope.agencyId,
          storeId: dto.storeId,
          type: 'sales_invoice',
          referenceCode: dto.referenceCode,
        },
      },
    });

    if (existingDoc) {
      if (existingDoc.status === 'created') {
        this.logger.log(
          `Idempotent duplicate request: Document already created for ref ${dto.referenceCode}`,
        );
        return existingDoc;
      }
      if (existingDoc.status === 'pending') {
        throw new AccountingIdempotencyError(
          `Bu belge (Ref: ${dto.referenceCode}) için şu an işlem devam etmektedir. Lütfen bekleyiniz.`,
        );
      }
    }

    // 2. Create reservation claim row (status: pending, externalId: null)
    let documentId: string;
    if (existingDoc && existingDoc.status === 'failed') {
      // Re-use failed row for retry
      documentId = existingDoc.id;
      await this.prisma.accountingDocument.update({
        where: { id: documentId },
        data: {
          status: 'pending',
          errorMessage: null,
          totalAmount: new Prisma.Decimal(dto.grandTotal),
          currency: dto.currency,
          isTestMode: integration.environment !== 'PRODUCTION',
        },
      });
    } else {
      const created = await this.prisma.accountingDocument.create({
        data: {
          agencyId: scope.agencyId,
          clientId: dto.clientId || scope.clientId,
          storeId: dto.storeId,
          integrationId: integration.id,
          companyId: company.id,
          type: 'sales_invoice',
          referenceCode: dto.referenceCode,
          status: 'pending',
          totalAmount: new Prisma.Decimal(dto.grandTotal),
          currency: dto.currency,
          isTestMode: integration.environment !== 'PRODUCTION',
        },
      });
      documentId = created.id;
    }

    // 3. Obtain connector instance
    const credentials = integration.credentials
      ? this.credentialsService.decrypt(integration.credentials)
      : {};

    if (company.defaultRetailContactId) {
      credentials.defaultRetailContactId = company.defaultRetailContactId;
    }

    const connector = this.connectorFactory.create(
      integration.provider,
      credentials,
      integration.environment as AccountingEnvironment,
    );

    try {
      // Pre-sync / match contact
      let externalContactId: string | undefined;
      try {
        const contactMapping = await this.mappingService.getOrSyncContact(
          integration.id,
          company.id,
          company.externalCompanyId,
          dto.contact,
          scope,
          connector,
        );
        externalContactId = contactMapping?.externalContactId;
      } catch (err: any) {
        this.logger.warn(`Cari eşleme uyarısı: ${err.message}`);
      }

      if (!externalContactId && !dto.contact.taxNumber && company.defaultRetailContactId) {
        externalContactId = company.defaultRetailContactId;
      }

      // Pre-sync / match product SKUs
      for (const item of dto.items) {
        try {
          await this.mappingService.getOrSyncProduct(
            integration.id,
            company.id,
            company.externalCompanyId,
            item,
            scope,
            connector,
          );
        } catch (err: any) {
          this.logger.warn(`Ürün eşleme uyarısı (${item.sku}): ${err.message}`);
        }
      }

      const invoiceRequest: AccountingInvoiceRequest = {
        companyId: company.externalCompanyId,
        referenceCode: dto.referenceCode,
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        currency: dto.currency,
        contact: {
          id: externalContactId || company.defaultRetailContactId || undefined,
          name: dto.contact.name,
          taxNumber: dto.contact.taxNumber,
          taxOffice: dto.contact.taxOffice,
          email: dto.contact.email,
          phone: dto.contact.phone,
          address: dto.contact.address,
          city: dto.contact.city,
          district: dto.contact.district,
          isCompany: dto.contact.isCompany,
        },
        items: dto.items.map((i): AccountingInvoiceItem => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          vatAmount: i.vatAmount,
          discountAmount: i.discountAmount,
          totalAmount: i.totalAmount,
        })),
        subtotal: dto.subtotal,
        vatTotal: dto.vatTotal,
        discountTotal: dto.discountTotal,
        grandTotal: dto.grandTotal,
        notes: dto.notes,
      };

      const result = await connector.createInvoice(invoiceRequest);

      // 4. Update reservation to 'created'
      return await this.prisma.accountingDocument.update({
        where: { id: documentId },
        data: {
          status: 'created',
          externalId: result.externalId,
          externalNumber: result.externalNumber,
          rawResponse: result.rawResponse as any,
          errorMessage: null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Fatura oluşturma hatası (Doc ID: ${documentId}): ${err.message}`);
      
      // If error was an explicit validation error or rejection, mark failed
      await this.prisma.accountingDocument.update({
        where: { id: documentId },
        data: {
          status: 'failed',
          errorMessage: err.message || 'Bilinmeyen hata',
        },
      });
      throw err;
    }
  }

  /**
   * Reservation-first idempotency for payment recording.
   */
  async createPaymentDocument(
    dto: CreateAccountingPaymentDocumentDto,
    scope: AccountingScope,
  ) {
    const integration = await this.prisma.accountingIntegration.findFirst({
      where: {
        id: dto.integrationId,
        agencyId: scope.agencyId,
        deletedAt: null,
      },
      include: { companies: true },
    });

    if (!integration) throw new NotFoundException('Muhasebe entegrasyonu bulunamadı.');

    const company = integration.companies.find((c) => c.id === dto.companyId);
    if (!company) throw new NotFoundException('Firma bulunamadı.');

    const existingDoc = await this.prisma.accountingDocument.findUnique({
      where: {
        agencyId_storeId_type_referenceCode: {
          agencyId: scope.agencyId,
          storeId: dto.storeId,
          type: 'payment',
          referenceCode: dto.referenceCode,
        },
      },
    });

    if (existingDoc) {
      if (existingDoc.status === 'created') return existingDoc;
      if (existingDoc.status === 'pending') {
        throw new AccountingIdempotencyError(
          `Tahsilat işlemi (Ref: ${dto.referenceCode}) şu an işlem görüyor.`,
        );
      }
    }

    const doc = await this.prisma.accountingDocument.create({
      data: {
        agencyId: scope.agencyId,
        clientId: dto.clientId || scope.clientId,
        storeId: dto.storeId,
        integrationId: integration.id,
        companyId: company.id,
        type: 'payment',
        referenceCode: dto.referenceCode,
        status: 'pending',
        totalAmount: new Prisma.Decimal(dto.amount),
        currency: dto.currency,
        isTestMode: integration.environment !== 'PRODUCTION',
      },
    });

    const credentials = integration.credentials
      ? this.credentialsService.decrypt(integration.credentials)
      : {};

    const connector = this.connectorFactory.create(
      integration.provider,
      credentials,
      integration.environment as AccountingEnvironment,
    );

    try {
      const result = await connector.recordPayment({
        companyId: company.externalCompanyId,
        invoiceExternalId: dto.invoiceExternalId,
        referenceCode: dto.referenceCode,
        amount: dto.amount,
        currency: dto.currency,
        paymentDate: dto.paymentDate,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
      });

      return await this.prisma.accountingDocument.update({
        where: { id: doc.id },
        data: {
          status: 'created',
          externalId: result.externalId,
          rawResponse: result.rawResponse as any,
          errorMessage: null,
        },
      });
    } catch (err: any) {
      await this.prisma.accountingDocument.update({
        where: { id: doc.id },
        data: {
          status: 'failed',
          errorMessage: err.message || 'Tahsilat kaydı başarısız',
        },
      });
      throw err;
    }
  }

  async listDocuments(query: AccountingQueryDto, scope: AccountingScope) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: Prisma.AccountingDocumentWhereInput = {
      agencyId: scope.agencyId,
    };

    if (query.storeId) where.storeId = query.storeId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.companyId) where.companyId = query.companyId;

    const [total, items] = await Promise.all([
      this.prisma.accountingDocument.count({ where }),
      this.prisma.accountingDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Release or cancel a stuck pending claim.
   */
  async cancelDocumentClaim(id: string, scope: AccountingScope) {
    const doc = await this.prisma.accountingDocument.findFirst({
      where: { id, agencyId: scope.agencyId },
    });

    if (!doc) throw new NotFoundException('Belge bulunamadı.');

    return this.prisma.accountingDocument.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  /**
   * Cancel document locally when provider does not support remote cancellation (e.g. BizimHesap).
   */
  async cancelLocally(
    id: string,
    dto: CancelLocallyDto,
    scope: AccountingScope,
    userContext?: { id?: string; email?: string; name?: string; ip?: string },
  ) {
    if (dto.acknowledgeManualCancel !== true) {
      throw new BadRequestException('Sağlayıcı panelinden elle iptal edildiği/edileceği onaylanmalıdır.');
    }

    const doc = await this.prisma.accountingDocument.findFirst({
      where: { id, agencyId: scope.agencyId },
    });

    if (!doc) throw new NotFoundException('Belge bulunamadı.');

    const updated = await this.prisma.accountingDocument.update({
      where: { id },
      data: {
        status: 'cancelled',
        errorMessage: dto.reason
          ? `[yerel iptal] ${dto.reason}`
          : 'sağlayıcıda iptal edilmedi — BizimHesap panelinden elle iptal edilmeli',
      },
    });

    if (this.auditLogService) {
      await this.auditLogService.createLog({
        tenantId: scope.agencyId,
        userId: userContext?.id,
        userEmail: userContext?.email,
        userName: userContext?.name,
        action: 'accounting.document.cancel_locally',
        module: 'accounting',
        entityType: 'AccountingDocument',
        entityId: doc.id,
        entityDisplayName: doc.referenceCode,
        description: `Belge yerel olarak iptal edildi (${doc.referenceCode})`,
        metadata: {
          documentId: doc.id,
          reason: dto.reason,
          acknowledged: true,
          externalId: doc.externalId,
        },
        ipAddress: userContext?.ip,
        severity: 'warning',
      });
    }

    return updated;
  }

  /**
   * Attach external document ID (e.g. after timeout/5xx when document was created on provider).
   */
  async attachExternal(
    id: string,
    dto: AttachExternalDto,
    scope: AccountingScope,
    userContext?: { id?: string; email?: string; name?: string; ip?: string },
  ) {
    if (!dto.externalId?.trim()) {
      throw new BadRequestException('Harici belge GUID / ID bilgisi zorunludur.');
    }

    const doc = await this.prisma.accountingDocument.findFirst({
      where: { id, agencyId: scope.agencyId },
    });

    if (!doc) throw new NotFoundException('Belge bulunamadı.');

    const updated = await this.prisma.accountingDocument.update({
      where: { id },
      data: {
        status: 'created',
        externalId: dto.externalId.trim(),
        ...(dto.externalNumber?.trim() ? { externalNumber: dto.externalNumber.trim() } : {}),
        errorMessage: null,
      },
    });

    if (this.auditLogService) {
      await this.auditLogService.createLog({
        tenantId: scope.agencyId,
        userId: userContext?.id,
        userEmail: userContext?.email,
        userName: userContext?.name,
        action: 'accounting.document.attach_external',
        module: 'accounting',
        entityType: 'AccountingDocument',
        entityId: doc.id,
        entityDisplayName: doc.referenceCode,
        description: `Harici belge bilgisi bağlandı (${dto.externalId})`,
        metadata: {
          documentId: doc.id,
          externalId: dto.externalId.trim(),
          externalNumber: dto.externalNumber?.trim(),
        },
        ipAddress: userContext?.ip,
        severity: 'info',
      });
    }

    return updated;
  }
}

