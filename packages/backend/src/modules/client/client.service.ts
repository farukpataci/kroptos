import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { Prisma } from '@prisma/client';
import { ActorContext } from '../rbac/rbac.service';

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

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
          entityType: 'Client',
          entityId,
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in ClientService:', error);
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

  /**
   * Bulgu 7/8: kapsam AKTIF baglamdir (JwtStrategy/TenantMiddleware zaten bu baglami
   * kapsayan rolu dogruladi), kullanicinin tum ajanslari degil. Client kapsamli
   * baglamda yalniz o client gorunur; baska ajansin client'i 404 (varligi sizmaz).
   */
  private scopeWhere(actor: ActorContext, isSuperAdmin: boolean): Prisma.ClientWhereInput {
    if (isSuperAdmin) return {};
    return { agencyId: actor.agencyId, ...(actor.clientId ? { id: actor.clientId } : {}) };
  }

  async list(actor: ActorContext, isSuperAdmin: boolean) {
    return this.prisma.client.findMany({
      where: { deletedAt: null, ...this.scopeWhere(actor, isSuperAdmin) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, actor: ActorContext, isSuperAdmin: boolean) {
    const client = await this.prisma.client.findFirst({
      // AND: kapsam client baglaminda kendi id'sini tasir; spread ile parametreyi ezmesin (canli probede yakalandi).
      where: { AND: [{ id, deletedAt: null }, this.scopeWhere(actor, isSuperAdmin)] },
    });

    if (!client) {
      throw new NotFoundException('Client not found or soft-deleted');
    }

    return client;
  }

  async create(dto: CreateClientDto, userId: string, isSuperAdmin: boolean, ipAddress?: string) {
    await this.verifyAgencyAccess(dto.agencyId, userId, isSuperAdmin);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          agencyId: dto.agencyId,
          name: dto.name,
          legalName: dto.legalName || null,
          taxNumber: dto.taxNumber || null,
          taxOffice: dto.taxOffice || null,
          email: dto.email,
          phone: dto.phone || null,
          contactEmail: dto.email, // maintaining schema fallback
          contactPhone: dto.phone || null,
          isActive: true,
          status: 'active',
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'create',
        client.id,
        userId,
        client.agencyId,
        ipAddress,
        { name: client.name, email: client.email },
      );

      return client;
    });
  }

  async update(id: string, dto: UpdateClientDto, actor: ActorContext, isSuperAdmin: boolean) {
    const { userId, ipAddress } = actor;
    const client = await this.get(id, actor, isSuperAdmin);

    return this.prisma.$transaction(async (tx) => {
      const updatedClient = await tx.client.update({
        where: { id },
        data: {
          name: dto.name,
          legalName: dto.legalName,
          taxNumber: dto.taxNumber,
          taxOffice: dto.taxOffice,
          email: dto.email,
          phone: dto.phone,
          contactEmail: dto.email,
          contactPhone: dto.phone,
          isActive: dto.isActive,
          status: dto.status,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'update',
        id,
        userId,
        client.agencyId,
        ipAddress,
        {
          before: { name: client.name, status: client.status, isActive: client.isActive },
          after: { name: updatedClient.name, status: updatedClient.status, isActive: updatedClient.isActive },
        },
      );

      return updatedClient;
    });
  }

  async delete(id: string, actor: ActorContext, isSuperAdmin: boolean) {
    const { userId, ipAddress } = actor;
    const client = await this.get(id, actor, isSuperAdmin);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Soft-delete client itself
      await tx.client.update({
        where: { id },
        data: {
          deletedAt: now,
          isActive: false,
          status: 'inactive',
        },
      });

      // 2. Cascade soft-delete stores under this client
      await tx.store.updateMany({
        where: {
          clientId: id,
          deletedAt: null,
        },
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
        client.agencyId,
        ipAddress,
        { name: client.name, deletedAt: now },
      );
    });
  }
}
