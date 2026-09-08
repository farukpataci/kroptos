import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AccountingConnector } from '../../integrations/accounting/core/AccountingConnector';
import {
  AccountingContactDto,
  AccountingInvoiceItemDto,
  AccountingQueryDto,
} from './dto/accounting.dto';
import { generateContactKey } from './utils/contact-key.util';
import { AccountingScope } from './accounting.service';

@Injectable()
export class AccountingMappingService {
  private readonly logger = new Logger(AccountingMappingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrSyncContact(
    integrationId: string,
    companyId: string,
    externalCompanyId: string,
    contact: AccountingContactDto,
    scope: AccountingScope,
    connector: AccountingConnector,
  ) {
    const kroptosKey = generateContactKey({
      taxNumber: contact.taxNumber,
      email: contact.email,
      phone: contact.phone,
      name: contact.name,
    });

    // Check DB mapping
    const existing = await this.prisma.accountingContactMapping.findUnique({
      where: {
        companyId_kroptosKey: {
          companyId,
          kroptosKey,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Call connector to sync/create in accounting system
    const synced = await connector.syncContact({
      companyId: externalCompanyId,
      kroptosKey,
      name: contact.name,
      taxNumber: contact.taxNumber,
      taxOffice: contact.taxOffice,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
      city: contact.city,
      district: contact.district,
      isCompany: contact.isCompany,
    });

    // Save in DB
    return this.prisma.accountingContactMapping.create({
      data: {
        agencyId: scope.agencyId,
        integrationId,
        companyId,
        kroptosKey,
        externalContactId: synced.externalId,
        displayName: contact.name,
        taxNumber: contact.taxNumber,
        status: 'matched',
      },
    });
  }

  async getOrSyncProduct(
    integrationId: string,
    companyId: string,
    externalCompanyId: string,
    item: AccountingInvoiceItemDto,
    scope: AccountingScope,
    connector: AccountingConnector,
  ) {
    const existing = await this.prisma.accountingProductMapping.findUnique({
      where: {
        companyId_productSku: {
          companyId,
          productSku: item.sku,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const mapped = await connector.mapProduct({
      companyId: externalCompanyId,
      sku: item.sku,
      name: item.name,
      code: item.sku,
      vatRate: item.vatRate,
      unitPrice: item.unitPrice,
    });

    return this.prisma.accountingProductMapping.create({
      data: {
        agencyId: scope.agencyId,
        integrationId,
        companyId,
        productSku: item.sku,
        externalProductId: mapped.externalId,
        externalCode: mapped.code || item.sku,
        externalName: item.name,
        status: 'matched',
      },
    });
  }

  async listContactMappings(companyId: string, query: AccountingQueryDto, scope: AccountingScope) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where = {
      companyId,
      agencyId: scope.agencyId,
    };

    const [total, items] = await Promise.all([
      this.prisma.accountingContactMapping.count({ where }),
      this.prisma.accountingContactMapping.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listProductMappings(companyId: string, query: AccountingQueryDto, scope: AccountingScope) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where = {
      companyId,
      agencyId: scope.agencyId,
    };

    const [total, items] = await Promise.all([
      this.prisma.accountingProductMapping.count({ where }),
      this.prisma.accountingProductMapping.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
