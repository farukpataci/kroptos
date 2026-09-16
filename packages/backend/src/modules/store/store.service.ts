import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { Prisma } from '@prisma/client';
import { generatePublicId } from '../../common/utils/id-generator';
import { ActorContext } from '../rbac/rbac.service';

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

  // AuditLog semasinda performedBy/agencyId/changes alanlari yok; dogru
  // adlar: userId, tenantId (@map("agencyId")) ve newValue. Kalip: OrderService.writeAuditLog.
  private async writeAuditLog(
    tx: Prisma.TransactionClient,
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
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in StoreService:', error);
    }
  }

  /**
   * Bulgu 7/8/9: kapsam AKTIF baglamdir (JwtStrategy/TenantMiddleware bu baglami kapsayan
   * rolu zaten dogruladi); kullanicinin tum ajanslari/rol satirlari yeniden taranmaz.
   * Bu ayni zamanda client kapsamli rolun (storeId: null) "ajans geneli" sayilmasi
   * bug'ini kapatir. Baska ajans/client/magaza kaydi 404 (varligi sizmaz).
   */
  private scopeWhere(actor: ActorContext, isSuperAdmin: boolean): Prisma.StoreWhereInput {
    if (isSuperAdmin) return {};
    return {
      agencyId: actor.agencyId,
      ...(actor.clientId ? { clientId: actor.clientId } : {}),
      ...(actor.storeId ? { id: actor.storeId } : {}),
    };
  }

  async list(actor: ActorContext, isSuperAdmin: boolean) {
    return this.prisma.store.findMany({
      where: { deletedAt: null, ...this.scopeWhere(actor, isSuperAdmin) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, actor: ActorContext, isSuperAdmin: boolean) {
    const store = await this.prisma.store.findFirst({
      // AND: kapsam magaza baglaminda kendi id'sini tasir; spread ile parametreyi ezmesin (canli probede yakalandi).
      where: { AND: [{ id, deletedAt: null }, this.scopeWhere(actor, isSuperAdmin)] },
    });

    if (!store) {
      throw new NotFoundException('Store not found or soft-deleted');
    }

    return store;
  }

  async create(dto: CreateStoreDto, actor: ActorContext) {
    // Kapsam aktif baglam (P12b 0a): ajans ve client govdeden degil, dogrulanmis baglamdan.
    const { userId, ipAddress, agencyId } = actor;
    const clientId = actor.clientId ?? null;

    const slug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name);
    const existingStore = await this.prisma.store.findFirst({
      where: { agencyId, slug, deletedAt: null },
    });

    if (existingStore) {
      throw new BadRequestException(`Store with slug '${slug}' already exists in this agency`);
    }

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          agencyId,
          clientId,
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

  async update(id: string, dto: UpdateStoreDto, actor: ActorContext, isSuperAdmin: boolean) {
    const { userId, ipAddress } = actor;
    const store = await this.get(id, actor, isSuperAdmin);

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

  async delete(id: string, actor: ActorContext, isSuperAdmin: boolean) {
    const { userId, ipAddress } = actor;
    const store = await this.get(id, actor, isSuperAdmin);

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
