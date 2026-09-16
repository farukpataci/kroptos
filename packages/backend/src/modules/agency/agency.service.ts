import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';
import { Prisma } from '@prisma/client';
import { generatePublicId } from '../../common/utils/id-generator';

@Injectable()
export class AgencyService {
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
          entityType: 'Agency',
          entityId,
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in AgencyService:', error);
    }
  }

  async list(userId: string, isSuperAdmin: boolean) {
    if (isSuperAdmin) {
      return this.prisma.agency.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Tenant Isolation: Only retrieve agencies where this user is assigned a role
    return this.prisma.agency.findMany({
      where: {
        deletedAt: null,
        users: {
          some: {
            userId,
            deletedAt: null,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, userId: string, isSuperAdmin: boolean) {
    // Bulgu 7: uyelik where'de (kullanicinin rolu olan ajanslar); uye olmadigi ajans/magaza 404,
    // 403 degil -> id/publicId'nin varligi sizmaz. Bu uc tenant cozumu icin cok-ajansli kalir.
    const membership = isSuperAdmin ? {} : { users: { some: { userId, deletedAt: null } } };
    let agency = await this.prisma.agency.findFirst({
      where: {
        OR: [
          { id },
          { publicId: id },
        ],
        deletedAt: null,
        ...membership,
      },
    });

    if (!agency) {
      const store = await this.prisma.store.findFirst({
        where: {
          OR: [
            { id },
            { publicId: id },
          ],
          deletedAt: null,
          agency: { deletedAt: null, ...membership },
        },
        include: { agency: true },
      });
      if (store && store.agency) {
        agency = store.agency;
      }
    }

    if (!agency) {
      throw new NotFoundException(`Agency context '${id}' not found or soft-deleted`);
    }

    return agency;
  }

  async create(dto: CreateAgencyDto, userId: string, ipAddress?: string) {
    const slug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name);

    // Verify slug uniqueness
    const existingAgency = await this.prisma.agency.findFirst({
      where: { slug, deletedAt: null },
    });

    if (existingAgency) {
      throw new BadRequestException(`Agency with slug '${slug}' already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the agency
      const agency = await tx.agency.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description || null,
          logo: dto.logo || null,
          website: dto.website || null,
          publicId: generatePublicId('tn', 12),
          isActive: true,
        },
      });

      // 2. Seed'deki agency_owner rolü. Eskiden burada 'Agency Owner' adında
      // '*:*' izinli bir rol yaratılıyordu — register'daki super_admin açığının
      // ikizi (PermissionGuard '*:*' görünce her şeye izin verir).
      const ownerRole = await tx.role.findFirst({ where: { key: 'agency_owner', agencyId: null, deletedAt: null } });
      if (!ownerRole) {
        throw new Error("Role 'agency_owner' not found — run prisma/seed.ts before creating agencies");
      }

      // 3. Assign the creator as Agency Owner
      await tx.userRole.create({
        data: {
          userId,
          agencyId: agency.id,
          roleId: ownerRole.id,
        },
      });

      // 4. Audit Log
      await this.writeAuditLog(
        tx,
        'create',
        agency.id,
        userId,
        agency.id,
        ipAddress,
        { name: agency.name, slug: agency.slug },
      );

      return agency;
    });
  }

  async update(id: string, dto: UpdateAgencyDto, userId: string, isSuperAdmin: boolean, ipAddress?: string) {
    // 1. Verify existence & access
    const agency = await this.get(id, userId, isSuperAdmin);

    // 2. Validate slug uniqueness if updated
    let slug: string | undefined;
    if (dto.slug || dto.name) {
      slug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name!);
      const existingAgency = await this.prisma.agency.findFirst({
        where: {
          slug,
          id: { not: agency.id },
          deletedAt: null,
        },
      });

      if (existingAgency) {
        throw new BadRequestException(`Another agency with slug '${slug}' already exists`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const originalAgency = await tx.agency.findUnique({ where: { id: agency.id } });

      const updatedAgency = await tx.agency.update({
        where: { id: agency.id },
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          logo: dto.logo,
          website: dto.website,
          isActive: dto.isActive,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'update',
        agency.id,
        userId,
        agency.id,
        ipAddress,
        {
          before: { name: originalAgency?.name, slug: originalAgency?.slug, isActive: originalAgency?.isActive },
          after: { name: updatedAgency.name, slug: updatedAgency.slug, isActive: updatedAgency.isActive },
        },
      );

      return updatedAgency;
    });
  }

  async delete(id: string, userId: string, isSuperAdmin: boolean, ipAddress?: string) {
    // 1. Verify existence & access
    const agency = await this.get(id, userId, isSuperAdmin);

    // 2. Execute cascade soft-delete in a transaction
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Soft delete agency itself
      await tx.agency.update({
        where: { id: agency.id },
        data: {
          deletedAt: now,
          isActive: false,
        },
      });

      // Cascade soft delete: clients
      await tx.client.updateMany({
        where: { agencyId: agency.id, deletedAt: null },
        data: { deletedAt: now, isActive: false },
      });

      // Cascade soft delete: stores
      await tx.store.updateMany({
        where: { agencyId: agency.id, deletedAt: null },
        data: { deletedAt: now, isActive: false },
      });

      // Cascade soft delete: user role assignments
      await tx.userRole.updateMany({
        where: { agencyId: agency.id, deletedAt: null },
        data: { deletedAt: now },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'delete',
        agency.id,
        userId,
        agency.id,
        ipAddress,
        { name: agency.name, deletedAt: now },
      );
    });
  }
}
