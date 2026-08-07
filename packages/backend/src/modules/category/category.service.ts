import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoryService {
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
          entityType: 'Category',
          entityId,
          performedBy,
          agencyId,
          ipAddress: ipAddress || null,
          changes: JSON.stringify(changes),
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in CategoryService:', error);
    }
  }

  // Detects if assigning parentId would create a loop in the hierarchy
  private async wouldCreateCycle(categoryId: string, parentId: string): Promise<boolean> {
    if (categoryId === parentId) {
      return true;
    }

    let currentParentId: string | null = parentId;
    const visited = new Set<string>();

    while (currentParentId) {
      if (currentParentId === categoryId) {
        return true;
      }
      if (visited.has(currentParentId)) {
        // Guard against existing cycles in database
        break;
      }
      visited.add(currentParentId);

      const parentNode: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });

      if (!parentNode) {
        break;
      }
      currentParentId = parentNode.parentId;
    }

    return false;
  }

  async list(activeAgencyId?: string, activeClientId?: string, activeStoreId?: string, isSuperAdmin?: boolean) {
    if (!activeAgencyId && !isSuperAdmin) {
      throw new BadRequestException('Active agency context is required (x-agency-id header)');
    }

    const whereClause: any = { deletedAt: null };

    if (activeStoreId) {
      // Return store categories, or client categories, or agency-global categories
      whereClause.OR = [
        { storeId: activeStoreId },
        { storeId: null, clientId: activeClientId || null, agencyId: activeAgencyId },
        { storeId: null, clientId: null, agencyId: activeAgencyId },
      ];
    } else if (activeClientId) {
      whereClause.OR = [
        { clientId: activeClientId },
        { clientId: null, agencyId: activeAgencyId },
      ];
    } else if (activeAgencyId) {
      whereClause.agencyId = activeAgencyId;
    }

    return this.prisma.category.findMany({
      where: whereClause,
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async get(id: string, activeAgencyId?: string, activeClientId?: string, activeStoreId?: string, isSuperAdmin?: boolean) {
    if (!activeAgencyId && !isSuperAdmin) {
      throw new BadRequestException('Active agency context is required (x-agency-id header)');
    }

    const category = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found or soft-deleted`);
    }

    // Verify context access if context is provided
    if (!isSuperAdmin && category.agencyId !== activeAgencyId) {
      throw new ForbiddenException('Access denied. Category belongs to a different agency context.');
    }

    return category;
  }

  async create(
    dto: CreateCategoryDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    ipAddress?: string,
  ) {
    // Determine the context fields. Use values from dto, or fall back to active context
    const agencyId = dto.agencyId || activeAgencyId;
    const clientId = dto.clientId || activeClientId || null;
    const storeId = dto.storeId || activeStoreId || null;

    if (!agencyId) {
      throw new BadRequestException('Agency ID context is required to create a category');
    }

    // Validate parent category if provided
    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, deletedAt: null },
      });
      if (!parent) {
        throw new BadRequestException(`Parent category '${dto.parentId}' does not exist or is soft-deleted`);
      }
      if (parent.agencyId !== agencyId) {
        throw new BadRequestException(`Parent category belongs to a different agency`);
      }
    }

    const slug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name);

    // Slug uniqueness check inside the store/client level (or agency level if not scoped)
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        agencyId,
        clientId,
        storeId,
        slug,
        deletedAt: null,
      },
    });

    if (existingCategory) {
      throw new BadRequestException(
        `Category with slug '${slug}' already exists under the active scope`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          agencyId,
          clientId,
          storeId,
          parentId: dto.parentId || null,
          name: dto.name,
          slug,
          status: dto.status || 'active',
          isActive: true,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'create',
        category.id,
        userId,
        agencyId,
        ipAddress,
        { name: category.name, slug: category.slug, parentId: category.parentId },
      );

      return category;
    });
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    ipAddress?: string,
  ) {
    const category = await this.get(id, activeAgencyId, activeClientId, activeStoreId);

    // 1. Validate parentId if modified
    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        // No parent
      } else {
        const parent = await this.prisma.category.findFirst({
          where: { id: dto.parentId, deletedAt: null },
        });
        if (!parent) {
          throw new BadRequestException(`Parent category '${dto.parentId}' does not exist or is soft-deleted`);
        }
        if (parent.agencyId !== category.agencyId) {
          throw new BadRequestException(`Parent category belongs to a different agency`);
        }

        // Cycle check
        const isCycle = await this.wouldCreateCycle(id, dto.parentId);
        if (isCycle) {
          throw new BadRequestException(
            `Cannot set parent category '${dto.parentId}' because it creates a circular dependency`,
          );
        }
      }
    }

    // 2. Validate slug uniqueness if modified
    let slug = category.slug;
    if (dto.slug || dto.name) {
      const targetSlug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name!);
      const existing = await this.prisma.category.findFirst({
        where: {
          id: { not: id },
          agencyId: category.agencyId,
          clientId: category.clientId,
          storeId: category.storeId,
          slug: targetSlug,
          deletedAt: null,
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Another category with slug '${targetSlug}' already exists under this scope`,
        );
      }
      slug = targetSlug;
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedCategory = await tx.category.update({
        where: { id },
        data: {
          parentId: dto.parentId !== undefined ? dto.parentId : undefined,
          name: dto.name || undefined,
          slug,
          status: dto.status || undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'update',
        id,
        userId,
        category.agencyId,
        ipAddress,
        {
          before: { name: category.name, slug: category.slug, parentId: category.parentId },
          after: { name: updatedCategory.name, slug: updatedCategory.slug, parentId: updatedCategory.parentId },
        },
      );

      return updatedCategory;
    });
  }

  async delete(
    id: string,
    userId: string,
    activeAgencyId?: string,
    activeClientId?: string,
    activeStoreId?: string,
    ipAddress?: string,
  ) {
    const category = await this.get(id, activeAgencyId, activeClientId, activeStoreId);

    // Find any children and set their parentId to null or soft-delete them as well
    // Let's set parentId of direct children to null to keep children intact
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Clear parentId on children
      await tx.category.updateMany({
        where: { parentId: id, deletedAt: null },
        data: { parentId: null },
      });

      // Also set categoryId of products belonging to this category to null
      await tx.product.updateMany({
        where: { categoryId: id, deletedAt: null },
        data: { categoryId: null },
      });

      const deletedCategory = await tx.category.update({
        where: { id },
        data: {
          deletedAt: now,
          isActive: false,
        },
      });

      // Audit Log
      await this.writeAuditLog(
        tx,
        'delete',
        id,
        userId,
        category.agencyId,
        ipAddress,
        { name: category.name, deletedAt: now },
      );

      return deletedCategory;
    });
  }
}
