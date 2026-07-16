import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

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
          entityType: 'Client',
          entityId,
          performedBy,
          agencyId,
          ipAddress: ipAddress || null,
          changes: JSON.stringify(changes),
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

  private async getAuthorizedAgencyIds(userId: string, isSuperAdmin: boolean): Promise<string[] | null> {
    if (isSuperAdmin) return null;
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, deletedAt: null },
      select: { agencyId: true },
    });
    return userRoles.map((ur) => ur.agencyId);
  }

  async list(userId: string, isSuperAdmin: boolean) {
    const agencyIds = await this.getAuthorizedAgencyIds(userId, isSuperAdmin);

    if (isSuperAdmin || !agencyIds) {
      return this.prisma.client.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.client.findMany({
      where: {
        deletedAt: null,
        agencyId: { in: agencyIds },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, userId: string, isSuperAdmin: boolean) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found or soft-deleted');
    }

    await this.verifyAgencyAccess(client.agencyId, userId, isSuperAdmin);

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

  async update(id: string, dto: UpdateClientDto, userId: string, isSuperAdmin: boolean, ipAddress?: string) {
    const client = await this.get(id, userId, isSuperAdmin);

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

  async delete(id: string, userId: string, isSuperAdmin: boolean, ipAddress?: string) {
    const client = await this.get(id, userId, isSuperAdmin);

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
