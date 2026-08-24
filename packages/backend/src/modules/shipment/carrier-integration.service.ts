import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { maskCredentials, stripMaskedCredentials } from '@kroptos/shared';
import { generatePublicId } from '../../common/utils/id-generator';
import { CarrierConnector } from '../../integrations/carriers/core/CarrierConnector';
import { CarrierConnectorFactory } from '../../integrations/carriers/core/CarrierConnectorFactory';
import { CarrierCredentialService } from '../../integrations/carriers/core/CarrierCredentialService';
import { ConnectionTestResult } from '../../integrations/carriers/core/CarrierTypes';
import {
  CreateCarrierIntegrationDto,
  UpdateCarrierIntegrationDto,
} from './dto/carrier-integration.dto';
import { TenantScope } from './tenant-scope';

@Injectable()
export class CarrierIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CarrierCredentialService,
    private readonly connectors: CarrierConnectorFactory,
  ) {}

  /**
   * Tenant filter for every carrier query.
   *
   * `agencyId` is applied unconditionally, then the store clause narrows it: a
   * store context sees its own rows plus the agency/client-wide ones it
   * inherits. Both halves matter — the store clause alone would match another
   * agency's agency-wide row.
   */
  private scopeWhere(
    scope: TenantScope,
    includeDeleted = false,
  ): Prisma.CarrierIntegrationWhereInput {
    const where: Prisma.CarrierIntegrationWhereInput = {
      agencyId: scope.agencyId,
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    if (scope.storeId) {
      where.OR = [
        { storeId: scope.storeId },
        { storeId: null, clientId: scope.clientId },
        { storeId: null, clientId: null },
      ];
    } else if (scope.clientId) {
      where.OR = [{ clientId: scope.clientId }, { clientId: null }];
    }

    return where;
  }

  /** Secrets never leave the server; the UI only ever sees the mask. */
  private toResponse(row: any) {
    const { credentials, ...rest } = row;
    let masked: Record<string, any> = {};
    try {
      masked = maskCredentials(this.credentials.decrypt(credentials));
    } catch {
      // A row encrypted with a key that has since rotated must still list.
      masked = {};
    }
    return { ...rest, credentials: masked };
  }

  private async writeAudit(
    action: string,
    entityId: string,
    userId: string,
    agencyId: string,
    ipAddress?: string,
    changes?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entityType: 'CarrierIntegration',
          entityId,
          userId,
          tenantId: agencyId,
          ipAddress: ipAddress || null,
          // Never the credential values — only which keys were touched.
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to write CarrierIntegration audit log:', error);
    }
  }

  async list(scope: TenantScope) {
    const rows = await this.prisma.carrierIntegration.findMany({
      where: this.scopeWhere(scope),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toResponse(row));
  }

  /**
   * Raw row, tenant-checked. Callers that need credentials use this.
   *
   * `includeDeleted` exists for shipments that already left the building: the
   * connection is soft deleted, but the barcodes it issued are still out there
   * and the operator has to print, track and cancel them. Filtering the deleted
   * row out would 404 every one of those shipments, permanently — the parcel is
   * in a van and the only screen that can manage it says "not found".
   */
  async findOneOrFail(id: string, scope: TenantScope, options?: { includeDeleted?: boolean }) {
    const row = await this.prisma.carrierIntegration.findFirst({
      where: { ...this.scopeWhere(scope, options?.includeDeleted), id },
    });
    if (!row) throw new NotFoundException(`Taşıyıcı bağlantısı bulunamadı: ${id}`);
    return row;
  }

  async get(id: string, scope: TenantScope) {
    return this.toResponse(await this.findOneOrFail(id, scope));
  }

  /**
   * Which carrier a shipment goes out with, when nobody has said.
   *
   * The rule engine does not exist yet, so this is the whole of the selection
   * logic and the only place it lives — when CarrierRule arrives, this method
   * changes and its callers do not.
   *
   *   none          NO_ACTIVE_CARRIER, a configuration gap, not a server fault
   *   exactly one   that one
   *   several       AMBIGUOUS_CARRIER, with the choices, unless the caller named one
   *
   * Both refusals carry a machine-readable `code` and a `messageKey`: a client
   * that string-matches a Turkish sentence breaks the first time the wording is
   * improved. AMBIGUOUS_CARRIER also returns the candidates, because telling
   * someone to pick one without showing the list sends them off to another
   * screen to find it. Those entries carry id, displayName and provider and
   * nothing else — never the credentials.
   *
   * Picking the first of several is deliberately not an option: a label bought
   * from the wrong carrier is only noticed when the parcel is handed to the
   * wrong van.
   */
  async resolveCarrierIntegration(scope: TenantScope, requestedId?: string) {
    if (requestedId) {
      // Named explicitly. Validated in the tenant's own scope, so an id
      // borrowed from another tenant answers "not found" rather than
      // "forbidden" — the second reply confirms the id exists.
      const row = await this.findOneOrFail(requestedId, scope);
      if (!row.isActive) {
        throw new NotFoundException(`Taşıyıcı bağlantısı bulunamadı: ${requestedId}`);
      }
      return row;
    }

    const active = await this.prisma.carrierIntegration.findMany({
      where: { ...this.scopeWhere(scope), isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (active.length === 0) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_CARRIER',
        messageKey: 'shipping.errors.noActiveCarrier',
        message: 'Bu mağaza için tanımlı aktif kargo bağlantısı yok.',
      });
    }

    if (active.length > 1) {
      throw new BadRequestException({
        code: 'AMBIGUOUS_CARRIER',
        messageKey: 'shipping.errors.ambiguousCarrier',
        message: 'Birden fazla aktif kargo bağlantısı var, istekte birini belirtin.',
        carriers: active.map((row) => ({
          id: row.id,
          displayName: row.displayName,
          provider: row.provider,
        })),
      });
    }

    return active[0];
  }

  async create(
    dto: CreateCarrierIntegrationDto,
    scope: TenantScope,
    userId: string,
    ipAddress?: string,
  ) {
    const { credentials, placeholders } = stripMaskedCredentials(dto.credentials);
    if (placeholders.length > 0) {
      throw new BadRequestException(
        `Yeni bağlantıda maskeli değer kullanılamaz: ${placeholders.join(', ')}`,
      );
    }
    this.credentials.validate(dto.provider, credentials);

    // Postgres treats NULL storeId values as distinct, so the composite unique
    // does not catch two agency-wide rows for the same carrier. Checked here.
    const duplicate = await this.prisma.carrierIntegration.findFirst({
      where: {
        agencyId: scope.agencyId,
        storeId: scope.storeId,
        provider: dto.provider.toUpperCase(),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(`${dto.provider} bu mağaza için zaten tanımlı.`);
    }

    const row = await this.prisma.carrierIntegration.create({
      data: {
        publicId: generatePublicId('crr'),
        agencyId: scope.agencyId,
        clientId: scope.clientId,
        storeId: scope.storeId,
        provider: dto.provider.toUpperCase(),
        displayName: dto.displayName,
        credentials: this.credentials.encrypt(credentials),
        isActive: dto.isActive ?? true,
        isTestMode: dto.isTestMode ?? true,
        senderAddress: (dto.senderAddress ?? undefined) as unknown as Prisma.InputJsonValue,
        settings: (dto.settings ?? undefined) as unknown as Prisma.InputJsonValue,
      },
    });

    await this.writeAudit('carrier.integration.created', row.id, userId, scope.agencyId, ipAddress, {
      provider: row.provider,
      credentialKeys: Object.keys(credentials),
    });

    return this.toResponse(row);
  }

  async update(
    id: string,
    dto: UpdateCarrierIntegrationDto,
    scope: TenantScope,
    userId: string,
    ipAddress?: string,
  ) {
    const existing = await this.findOneOrFail(id, scope);
    const data: Prisma.CarrierIntegrationUpdateInput = {};

    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isTestMode !== undefined) data.isTestMode = dto.isTestMode;
    if (dto.senderAddress !== undefined) {
      data.senderAddress = dto.senderAddress as unknown as Prisma.InputJsonValue;
    }
    if (dto.settings !== undefined) {
      data.settings = dto.settings as unknown as Prisma.InputJsonValue;
    }

    let changedKeys: string[] = [];
    if (dto.credentials !== undefined) {
      // A blank or masked secret means "leave the stored one alone" — writing
      // it through would clear a live credential.
      const { credentials } = stripMaskedCredentials(dto.credentials);
      const merged = { ...this.credentials.decrypt(existing.credentials), ...credentials };
      this.credentials.validate(existing.provider, merged);
      data.credentials = this.credentials.encrypt(merged);
      changedKeys = Object.keys(credentials);
    }

    const row = await this.prisma.carrierIntegration.update({ where: { id: existing.id }, data });

    await this.writeAudit('carrier.integration.updated', row.id, userId, scope.agencyId, ipAddress, {
      fields: Object.keys(data).filter((key) => key !== 'credentials'),
      credentialKeys: changedKeys,
    });

    return this.toResponse(row);
  }

  async remove(id: string, scope: TenantScope, userId: string, ipAddress?: string) {
    const existing = await this.findOneOrFail(id, scope);
    await this.prisma.carrierIntegration.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.writeAudit(
      'carrier.integration.deleted',
      existing.id,
      userId,
      scope.agencyId,
      ipAddress,
      { provider: existing.provider },
    );
  }

  /** Builds a connector for a row the caller already tenant-checked. */
  connectorFor(row: {
    provider: string;
    credentials: string;
    isTestMode: boolean;
  }): CarrierConnector {
    return this.connectors.create(
      row.provider,
      this.credentials.decrypt(row.credentials),
      row.isTestMode,
    );
  }

  async testConnection(id: string, scope: TenantScope): Promise<ConnectionTestResult> {
    const row = await this.findOneOrFail(id, scope);
    const result = await this.connectorFor(row).testConnection();

    await this.prisma.carrierIntegration.update({
      where: { id: row.id },
      data: { lastTestedAt: new Date(), lastTestOk: result.success },
    });

    return result;
  }
}
