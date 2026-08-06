import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';
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
    let agency = await this.prisma.agency.findFirst({
      where: {
        OR: [
          { id },
          { publicId: id },
        ],
        deletedAt: null,
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

    // Verify access
    if (!isSuperAdmin) {
      const userRole = await this.prisma.userRole.findFirst({
        where: {
          userId,
          agencyId: agency.id,
          deletedAt: null,
        },
      });

      if (!userRole) {
        throw new ForbiddenException('Access denied. You do not belong to this agency.');
      }
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

      // 2. Find or create the "Agency Owner" role
      let ownerRole = await tx.role.findUnique({
        where: { name: 'Agency Owner' },
      });

      if (!ownerRole) {
        ownerRole = await tx.role.create({
          data: {
            name: 'Agency Owner',
            description: 'Owner role with administrative privileges for an agency',
          },
        });

        // Add a default wildcard permission for the owner
        await tx.permission.upsert({
          where: { name: '*:*' },
          update: {},
          create: {
            name: '*:*',
            description: 'Wildcard access permission',
            roles: {
              connect: { id: ownerRole.id },
            },
          },
        });
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
