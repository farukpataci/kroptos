import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { AssignRoleDto, RevokeRoleDto } from './dto/rbac.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class RbacService {
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
          entityType: 'UserRole',
          entityId,
          userId: performedBy,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log in RbacService:', error);
    }
  }

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async assignRole(dto: AssignRoleDto, performedBy: string, ipAddress?: string) {
    // 1. Verify User exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID '${dto.userId}' not found`);
    }

    // 2. Verify Agency exists
    const agency = await this.prisma.agency.findFirst({
      where: { id: dto.agencyId, deletedAt: null },
    });
    if (!agency) {
      throw new NotFoundException(`Agency with ID '${dto.agencyId}' not found`);
    }

    // 3. Verify Role exists
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID '${dto.roleId}' not found`);
    }

    // 4. Verify Client Context if provided
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, agencyId: dto.agencyId, deletedAt: null },
      });
      if (!client) {
        throw new BadRequestException(`Client '${dto.clientId}' does not exist or does not belong to agency '${dto.agencyId}'`);
      }
    }

    // 5. Verify Store Context if provided
    if (dto.storeId) {
      const store = await this.prisma.store.findFirst({
        where: { id: dto.storeId, agencyId: dto.agencyId, deletedAt: null },
      });
      if (!store) {
        throw new BadRequestException(`Store '${dto.storeId}' does not exist or does not belong to agency '${dto.agencyId}'`);
      }
      if (dto.clientId && store.clientId !== dto.clientId) {
        throw new BadRequestException(`Store '${dto.storeId}' does not belong to client '${dto.clientId}'`);
      }
    }

    // 6. Perform assignment transactionally
    return this.prisma.$transaction(async (tx) => {
      // Check if this relation already exists (including soft-deleted ones)
      const existingUserRole = await tx.userRole.findFirst({
        where: {
          userId: dto.userId,
          agencyId: dto.agencyId,
          roleId: dto.roleId,
        },
      });

      let userRole;
      if (existingUserRole) {
        // Reactivate soft-deleted entry or update context
        userRole = await tx.userRole.update({
          where: { id: existingUserRole.id },
          data: {
            clientId: dto.clientId || null,
            storeId: dto.storeId || null,
            deletedAt: null, // restore
          },
        });
      } else {
        // Create new role mapping
        userRole = await tx.userRole.create({
          data: {
            userId: dto.userId,
            agencyId: dto.agencyId,
            clientId: dto.clientId || null,
            storeId: dto.storeId || null,
            roleId: dto.roleId,
          },
        });
      }

      // Write Audit Log
      await this.writeAuditLog(
        tx,
        'assign',
        userRole.id,
        performedBy,
        dto.agencyId,
        ipAddress,
        {
          userId: dto.userId,
          roleName: role.name,
          clientId: dto.clientId || null,
          storeId: dto.storeId || null,
        },
      );

      return userRole;
    });
  }

  async revokeRole(dto: RevokeRoleDto, performedBy: string, ipAddress?: string) {
    const userRole = await this.prisma.userRole.findFirst({
      where: { id: dto.userRoleId, deletedAt: null },
    });

    if (!userRole) {
      throw new NotFoundException(`Active role assignment with ID '${dto.userRoleId}' not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.userRole.update({
        where: { id: dto.userRoleId },
        data: {
          deletedAt: now,
        },
      });

      // Write Audit Log
      await this.writeAuditLog(
        tx,
        'revoke',
        dto.userRoleId,
        performedBy,
        userRole.agencyId,
        ipAddress,
        {
          userId: userRole.userId,
          roleId: userRole.roleId,
          deletedAt: now,
        },
      );
    });
  }
}
