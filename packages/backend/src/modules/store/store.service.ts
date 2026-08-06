import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { generatePublicId } from '../../common/utils/id-generator';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
  }

  private async writeAuditLog(
    tx: any,
    action: string,
    entityId: string,
    performedBy: string,
    agencyId: string,
    ipAddress?: string,
    changes: any = {},
  ) {
    try {
      await tx.auditLog.create({
        data: {
          action,
          entityType: 'Store',
          entityId,
          performedBy,
          agencyId,
          ipAddress: ipAddress || null,
          changes: JSON.stringify(changes),
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in StoreService:', error);
    }
  }

  private async getAllowedStoreIdsAndAgencies(userId: string, isSuperAdmin: boolean) {
    if (isSuperAdmin) {
      return { allAllowedStoreIds: null, generalAgencyIds: null };
    }

    // 1. Get store IDs from StoreUser model
    const storeUsers = await this.prisma.storeUser.findMany({
      where: { userId, deletedAt: null },
      select: { storeId: true },
    });
    const specificStoreIds = storeUsers.map((su) => su.storeId);

    // 2. Get store IDs from UserRole model (where storeId is explicitly assigned)
    const userRolesWithStore = await this.prisma.userRole.findMany({
      where: { userId, storeId: { not: null }, deletedAt: null },
      select: { storeId: true },
    });
    const roleStoreIds = userRolesWithStore.map((ur) => ur.storeId!);

    const allAllowedStoreIds = [...new Set([...specificStoreIds, ...roleStoreIds])];

    // 3. Get general agency roles (where the user has access to the entire agency, storeId is null)
    const userRolesGeneral = await this.prisma.userRole.findMany({
      where: { userId, storeId: null, deletedAt: null },
      select: { agencyId: true },
    });
    const generalAgencyIds = userRolesGeneral.map((ur) => ur.agencyId);

    return { allAllowedStoreIds, generalAgencyIds };
  }

  private async verifyStoreAccess(store: any, userId: string, isSuperAdmin: boolean) {
    if (isSuperAdmin) return;

    const { allAllowedStoreIds, generalAgencyIds } = await this.getAllowedStoreIdsAndAgencies(userId, isSuperAdmin);

    const hasSpecificAccess = allAllowedStoreIds?.includes(store.id);
    const hasGeneralAccess = generalAgencyIds?.includes(store.agencyId);

    if (!hasSpecificAccess && !hasGeneralAccess) {
      throw new ForbiddenException(`Access denied. You are not authorized for store '${store.id}'.`);
    }
  }

  private async verifyAgencyAccess(agencyId: string, userId: string, isSuperAdmin: boolean) {
    if (isSuperAdmin) return;
    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, agencyId, deletedAt: null },
    });
    if (!userRole) {
      throw new ForbiddenException(`Access denied. You do not belong to agency '${agencyId}'.`);
    }
  }

  async list(userId: string, isSuperAdmin: boolean) {
    const { allAllowedStoreIds, generalAgencyIds } = await this.getAllowedStoreIdsAndAgencies(userId, isSuperAdmin);

    if (isSuperAdmin || (!allAllowedStoreIds && !generalAgencyIds)) {
      return this.prisma.store.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.store.findMany({
      where: {
        deletedAt: null,
        OR: [
          { id: { in: allAllowedStoreIds || [] } },
          { agencyId: { in: generalAgencyIds || [] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, userId: string, isSuperAdmin: boolean) {
    const store = await this.prisma.store.findFirst({
      where: { id, deletedAt: null },
    });

    if (!store) {
      throw new NotFoundException('Store not found or soft-deleted');
    }

    await this.verifyStoreAccess(store, userId, isSuperAdmin);

    return store;
  }

  async create(dto: CreateStoreDto, userId: string, isSuperAdmin: boolean, ipAddress?: string) {
    await this.verifyAgencyAccess(dto.agencyId, userId, isSuperAdmin);

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, agencyId: dto.agencyId, deletedAt: null },
      });
      if (!client) {
        throw new BadRequestException(`Client '${dto.clientId}' does not exist or does not belong to agency '${dto.agencyId}'`);
      }
    }

    const slug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name);
    const existingStore = await this.prisma.store.findFirst({
      where: { agencyId: dto.agencyId, slug, deletedAt: null },
    });

    if (existingStore) {
      throw new BadRequestException(`Store with slug '${slug}' already exists in this agency`);
    }

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          agencyId: dto.agencyId,
          clientId: dto.clientId || null,
          name: dto.name,
          slug,
          domain: dto.domain || null,
          status: dto.status || 'active',
          currency: dto.currency || 'USD',
          locale: dto.locale || 'en-US',
          timezone: dto.timezone || 'UTC',
          type: dto.type || 'retail',
          orderProcessingMode: dto.orderProcessingMode || 'LOGO_SYNC',
          publicId: generatePublicId('tn', 12),
          isActive: true,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'create',
        store.id,
        userId,
        store.agencyId,
        ipAddress,
        { name: store.name, slug: store.slug, domain: store.domain },
      );

      return store;
    });
  }

  async update(id: string, dto: UpdateStoreDto, userId: string, isSuperAdmin: boolean, ipAddress?: string) {
    const store = await this.get(id, userId, isSuperAdmin);

    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name!);
      const existingStore = await this.prisma.store.findFirst({
        where: {
          agencyId: store.agencyId,
          slug,
          id: { not: id },
          deletedAt: null,
        },
      });

      if (existingStore) {
        throw new BadRequestException(`Another store with slug '${slug}' already exists in this agency`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedStore = await tx.store.update({
        where: { id },
        data: {
          name: dto.name,
          slug,
          domain: dto.domain,
          status: dto.status,
          currency: dto.currency,
          locale: dto.locale,
          timezone: dto.timezone,
          type: dto.type,
          orderProcessingMode: dto.orderProcessingMode,
          isActive: dto.isActive,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'update',
        id,
        userId,
        store.agencyId,
        ipAddress,
        {
          before: { name: store.name, status: store.status, domain: store.domain, isActive: store.isActive },
          after: { name: updatedStore.name, status: updatedStore.status, domain: updatedStore.domain, isActive: updatedStore.isActive },
        },
      );

      return updatedStore;
    });
  }

  async delete(id: string, userId: string, isSuperAdmin: boolean, ipAddress?: string) {
    const store = await this.get(id, userId, isSuperAdmin);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.store.update({
        where: { id },
        data: {
          deletedAt: now,
          isActive: false,
          status: 'suspended',
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'delete',
        id,
        userId,
        store.agencyId,
        ipAddress,
        { name: store.name, deletedAt: now },
      );
    });
  }
}
