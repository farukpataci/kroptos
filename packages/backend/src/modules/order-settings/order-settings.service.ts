import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { SettingsCacheService } from '../settings/services/settings-cache.service';
import { SettingsResolverService } from '../settings/services/settings-resolver.service';
import {
  ORDER_SETTINGS_REGISTRY,
  ORDER_SETTINGS_SECTIONS,
} from './registry/order-settings.registry';
import {
  OrderSettingsDto,
  mapValuesToOrderSettingsDto,
  SettingChangeItemDto,
} from './dto/order-settings.dto';
import { OrderNumberService } from './services/order-number.service';
import { generatePublicId } from '@common/utils/id-generator';
import { SettingDefinition, ScopeLevel } from '../settings/interfaces/setting-definition.interface';

@Injectable()
export class OrderSettingsService {
  private readonly logger = new Logger(OrderSettingsService.name);
  private readonly definitionsMap = new Map<string, SettingDefinition>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: SettingsCacheService,
    private readonly resolverService: SettingsResolverService,
    private readonly orderNumberService: OrderNumberService,
  ) {
    for (const def of ORDER_SETTINGS_REGISTRY) {
      this.definitionsMap.set(def.key, def);
    }
  }

  /**
   * Retrieves typed, resolved settings for a store.
   * Utilizes Redis cache with DB fallback.
   */
  async get(storeId: string): Promise<OrderSettingsDto> {
    const cacheKey = `order-settings:store:${storeId}`;
    const cached = await this.cacheService.get<OrderSettingsDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Retrieve store to get agencyId and clientId
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, agencyId: true, clientId: true },
    });

    if (!store) {
      // Fallback: return default settings if store not found
      return mapValuesToOrderSettingsDto({});
    }

    const valuesMap = await this.resolverService.resolveValuesMap(
      'order',
      ORDER_SETTINGS_REGISTRY,
      {
        agencyId: store.agencyId,
        clientId: store.clientId,
        storeId: store.id,
      },
    );

    const dto = mapValuesToOrderSettingsDto(valuesMap);
    await this.cacheService.set(cacheKey, dto, 3600);
    return dto;
  }

  /**
   * Returns UI schema with sections and field definitions.
   */
  getSchema(userPermissions: string[] = []) {
    const hasSensitive =
      userPermissions.includes('*:*') ||
      userPermissions.includes('order_settings.update_sensitive');

    return {
      sections: ORDER_SETTINGS_SECTIONS,
      fields: ORDER_SETTINGS_REGISTRY.map((field) => ({
        ...field,
        canEditSensitive: field.sensitive ? hasSensitive : true,
      })),
    };
  }

  /**
   * Returns effective settings with inheritance indicators for UI.
   */
  async getForScope(
    agencyId: string,
    clientId?: string | null,
    storeId?: string | null,
    userPermissions: string[] = [],
  ) {
    return this.resolverService.resolveEffectiveSettings(
      'order',
      ORDER_SETTINGS_REGISTRY,
      { agencyId, clientId, storeId },
      userPermissions,
    );
  }

  /**
   * Updates multiple settings in a single atomic transaction.
   */
  async update(
    agencyId: string,
    clientId: string | null | undefined,
    storeId: string | null | undefined,
    changes: SettingChangeItemDto[],
    reason: string | undefined,
    userId: string,
    userPermissions: string[] = [],
  ) {
    if (!changes || changes.length === 0) {
      throw new BadRequestException('No changes provided');
    }

    const currentScopeLevel: ScopeLevel = storeId
      ? 'STORE'
      : clientId
      ? 'CLIENT'
      : 'AGENCY';

    const hasWildcard = userPermissions.includes('*:*');
    const hasUpdate = hasWildcard || userPermissions.includes('order_settings.update');
    const hasUpdateSensitive =
      hasWildcard || userPermissions.includes('order_settings.update_sensitive');

    if (!hasUpdate) {
      throw new ForbiddenException('Missing order_settings.update permission');
    }

    // 1. Validate all changes first
    const validationErrors: Array<{ key: string; message: string }> = [];

    for (const item of changes) {
      const def = this.definitionsMap.get(item.key);
      if (!def) {
        validationErrors.push({ key: item.key, message: `Unknown setting key: '${item.key}'` });
        continue;
      }

      if (!def.scopes.includes(currentScopeLevel)) {
        validationErrors.push({
          key: item.key,
          message: `Setting '${item.key}' cannot be modified at ${currentScopeLevel} level`,
        });
        continue;
      }

      if (def.sensitive && !hasUpdateSensitive) {
        validationErrors.push({
          key: item.key,
          message: `Modifying sensitive setting '${item.key}' requires order_settings.update_sensitive permission`,
        });
        continue;
      }

      // Consumer protection check: Return window must be >= 14 days
      if (item.key === 'order.returns.windowDays') {
        const val = Number(item.value);
        if (isNaN(val) || val < 14) {
          validationErrors.push({
            key: item.key,
            message: 'İade süresi mevzuat gereği en az 14 gün olmak zorundadır.',
          });
        }
      }

      // Min/Max validations
      if (def.validation?.min !== undefined && Number(item.value) < def.validation.min) {
        validationErrors.push({
          key: item.key,
          message: `${item.key} minimum değeri ${def.validation.min} olmalıdır.`,
        });
      }
      if (def.validation?.max !== undefined && Number(item.value) > def.validation.max) {
        validationErrors.push({
          key: item.key,
          message: `${item.key} maksimum değeri ${def.validation.max} olabilir.`,
        });
      }

      // Enum options check
      if (def.validation?.options && def.type === 'enum') {
        const validValues = def.validation.options.map((o) => String(o.value));
        if (!validValues.includes(String(item.value))) {
          validationErrors.push({
            key: item.key,
            message: `Geçersiz seçenek: '${item.value}'. Geçerli seçenekler: ${validValues.join(', ')}`,
          });
        }
      }
    }

    // Check cross-field validations
    const changeMap = new Map<string, any>();
    changes.forEach((c) => changeMap.set(c.key, c.value));

    if (changeMap.has('order.cod.minAmount') && changeMap.has('order.cod.maxAmount')) {
      const min = Number(changeMap.get('order.cod.minAmount'));
      const max = Number(changeMap.get('order.cod.maxAmount'));
      if (min > max) {
        validationErrors.push({
          key: 'order.cod.minAmount',
          message: 'Kapıda ödeme minimum tutarı, maksimum tutardan büyük olamaz.',
        });
      }
    }

    if (validationErrors.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Settings validation failed',
        errors: validationErrors,
      });
    }

    // 2. Check lock status from upper levels
    const upperOverrides = await this.prisma.settingValue.findMany({
      where: {
        agencyId,
        namespace: 'order',
        key: { in: changes.map((c) => c.key) },
        locked: true,
        deletedAt: null,
      },
    });

    for (const upper of upperOverrides) {
      // If locked at agency level and we are at client or store level
      if (!upper.clientId && !upper.storeId && (clientId || storeId)) {
        throw new ForbiddenException(`'${upper.key}' ayarı Firma seviyesinde kilitlenmiştir ve değiştirilemez.`);
      }
      // If locked at client level and we are at store level
      if (upper.clientId && !upper.storeId && storeId) {
        throw new ForbiddenException(`'${upper.key}' ayarı Marka seviyesinde kilitlenmiştir ve değiştirilemez.`);
      }
    }

    // 3. Perform atomic transaction
    const changeSetId = generatePublicId('cs', 12);

    await this.prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const scopeKey = SettingsResolverService.getScopeKey(
          agencyId,
          clientId,
          storeId,
          'order',
          change.key,
        );

        const existing = await tx.settingValue.findUnique({
          where: {
            agencyId_scopeKey: {
              agencyId,
              scopeKey,
            },
          },
        });

        const oldValue = existing ? existing.value : null;

        const updatedRow = await tx.settingValue.upsert({
          where: {
            agencyId_scopeKey: {
              agencyId,
              scopeKey,
            },
          },
          create: {
            namespace: 'order',
            key: change.key,
            scopeLevel: currentScopeLevel,
            scopeKey,
            agencyId,
            clientId: clientId || null,
            storeId: storeId || null,
            value: change.value,
            updatedById: userId,
          },
          update: {
            value: change.value,
            updatedById: userId,
            deletedAt: null,
          },
        });

        await tx.settingChangeLog.create({
          data: {
            settingValueId: updatedRow.id,
            namespace: 'order',
            key: change.key,
            scopeLevel: currentScopeLevel,
            agencyId,
            clientId: clientId || null,
            storeId: storeId || null,
            oldValue: (oldValue as any) ?? undefined,
            newValue: change.value,
            changedById: userId,
            reason: reason || null,
            changeSetId,
          },
        });
      }
    });

    // 4. Invalidate cache
    if (storeId) {
      await this.cacheService.invalidateStoreSettings(storeId);
    } else {
      await this.cacheService.invalidateAgencySettings(agencyId);
    }

    return {
      success: true,
      changeSetId,
      updatedCount: changes.length,
    };
  }

  /**
   * Resets overrides for selected keys, reverting to inherited values.
   */
  async reset(
    agencyId: string,
    clientId: string | null | undefined,
    storeId: string | null | undefined,
    keys: string[],
    userId: string,
  ) {
    if (!keys || keys.length === 0) {
      throw new BadRequestException('No keys provided for reset');
    }

    const currentScopeLevel: ScopeLevel = storeId
      ? 'STORE'
      : clientId
      ? 'CLIENT'
      : 'AGENCY';

    const changeSetId = generatePublicId('cs', 12);

    await this.prisma.$transaction(async (tx) => {
      for (const key of keys) {
        const scopeKey = SettingsResolverService.getScopeKey(
          agencyId,
          clientId,
          storeId,
          'order',
          key,
        );

        const existing = await tx.settingValue.findUnique({
          where: {
            agencyId_scopeKey: {
              agencyId,
              scopeKey,
            },
          },
        });

        if (existing) {
          await tx.settingValue.delete({
            where: { id: existing.id },
          });

          await tx.settingChangeLog.create({
            data: {
              settingValueId: null,
              namespace: 'order',
              key,
              scopeLevel: currentScopeLevel,
              agencyId,
              clientId: clientId || null,
              storeId: storeId || null,
              oldValue: (existing.value as any) ?? undefined,
              newValue: undefined,
              changedById: userId,
              reason: 'Değer üst seviyeye sıfırlandı (Reset to inherit)',
              changeSetId,
            },
          });
        }
      }
    });

    if (storeId) {
      await this.cacheService.invalidateStoreSettings(storeId);
    } else {
      await this.cacheService.invalidateAgencySettings(agencyId);
    }

    return { success: true, resetCount: keys.length };
  }

  /**
   * Locks or unlocks setting keys for lower hierarchy levels.
   */
  async lock(
    agencyId: string,
    clientId: string | null | undefined,
    keys: string[],
    locked: boolean,
    userId: string,
  ) {
    const currentScopeLevel: ScopeLevel = clientId ? 'CLIENT' : 'AGENCY';

    for (const key of keys) {
      const scopeKey = SettingsResolverService.getScopeKey(
        agencyId,
        clientId,
        null,
        'order',
        key,
      );

      const def = this.definitionsMap.get(key);
      const defaultValue = def ? def.default : null;

      await this.prisma.settingValue.upsert({
        where: {
          agencyId_scopeKey: {
            agencyId,
            scopeKey,
          },
        },
        create: {
          namespace: 'order',
          key,
          scopeLevel: currentScopeLevel,
          scopeKey,
          agencyId,
          clientId: clientId || null,
          storeId: null,
          value: defaultValue,
          locked,
          updatedById: userId,
        },
        update: {
          locked,
          updatedById: userId,
        },
      });
    }

    await this.cacheService.invalidateAgencySettings(agencyId);
    return { success: true, lockedCount: keys.length, locked };
  }

  /**
   * Computes the impact of proposed setting changes before saving.
   */
  async getImpact(
    agencyId: string,
    storeId: string | undefined,
    changes: SettingChangeItemDto[],
  ) {
    const impactResults: any = {
      summary: [],
      affectedOrdersCount: 0,
      riskLevel: 'LOW',
    };

    for (const change of changes) {
      // 1. Auto-cancel hours reduced
      if (change.key === 'order.flow.unpaidCancelAfterHours' && storeId) {
        const hours = Number(change.value);
        const threshold = new Date(Date.now() - hours * 3600 * 1000);
        const count = await this.prisma.order.count({
          where: {
            storeId,
            status: 'pending',
            paymentStatus: 'pending',
            createdAt: { lt: threshold },
            deletedAt: null,
          },
        });
        impactResults.summary.push({
          key: change.key,
          label: 'Otomatik İptal Eşiği',
          description: `Bu değişiklik kaydedildiğinde ${count} adet bekleyen ödenmemiş sipariş iptal edilecek.`,
          count,
        });
        if (count > 0) impactResults.riskLevel = 'MEDIUM';
      }

      // 2. COD disabled
      if (change.key === 'order.cod.enabled' && change.value === false && storeId) {
        const count = await this.prisma.order.count({
          where: {
            storeId,
            paymentStatus: 'pending',
            status: 'pending',
            deletedAt: null,
          },
        });
        impactResults.summary.push({
          key: change.key,
          label: 'Kapıda Ödeme Devre Dışı',
          description: `Kapıda ödeme kapatılıyor. Açık olan mevcut siparişler etkilenmeyecek.`,
          count,
        });
      }

      // 3. Numbering pattern changed
      if (change.key.startsWith('order.numbering') && storeId) {
        impactResults.summary.push({
          key: change.key,
          label: 'Sipariş Numaralandırma',
          description: `Numaralandırma formatı güncellenecek. Önceki siparişlerin numaraları korunur.`,
        });
      }
    }

    return impactResults;
  }

  /**
   * Previews next order number with current or modified settings.
   */
  async previewOrderNumber(storeId: string, overrideConfig?: any) {
    const settings = await this.get(storeId);
    return this.orderNumberService.previewOrderNumber(storeId, settings, overrideConfig);
  }

  /**
   * Generates next order number atomically.
   */
  async generateNextOrderNumber(storeId: string, agencyId: string, isMarketplace = false): Promise<string> {
    const settings = await this.get(storeId);
    return this.orderNumberService.generateNextOrderNumber(storeId, agencyId, settings, isMarketplace);
  }

  /**
   * Fetches change history grouped by changeSetId.
   */
  async getHistory(agencyId: string, storeId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = { agencyId, namespace: 'order' };
    if (storeId) {
      where.storeId = storeId;
    }

    const total = await this.prisma.settingChangeLog.count({ where });

    const logs = await this.prisma.settingChangeLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const userIds = Array.from(new Set(logs.map((l) => l.changedById).filter(Boolean))) as string[];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = logs.map((log) => ({
      ...log,
      changedBy: log.changedById ? userMap.get(log.changedById) || null : null,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Reverts a specific changeSetId.
   */
  async revertChangeSet(agencyId: string, changeSetId: string, userId: string) {
    const logs = await this.prisma.settingChangeLog.findMany({
      where: { agencyId, changeSetId },
    });

    if (logs.length === 0) {
      throw new NotFoundException(`Change set with ID '${changeSetId}' not found`);
    }

    const newChangeSetId = generatePublicId('cs_revert', 12);

    await this.prisma.$transaction(async (tx) => {
      for (const log of logs) {
        const scopeKey = SettingsResolverService.getScopeKey(
          agencyId,
          log.clientId,
          log.storeId,
          'order',
          log.key,
        );

        if (log.oldValue === null) {
          // It was created in that changeSet -> delete it
          await tx.settingValue.deleteMany({
            where: { agencyId, scopeKey },
          });
        } else {
          // Restore old value
          await tx.settingValue.upsert({
            where: {
              agencyId_scopeKey: {
                agencyId,
                scopeKey,
              },
            },
            create: {
              namespace: 'order',
              key: log.key,
              scopeLevel: log.scopeLevel,
              scopeKey,
              agencyId,
              clientId: log.clientId,
              storeId: log.storeId,
              value: log.oldValue,
              updatedById: userId,
            },
            update: {
              value: log.oldValue,
              updatedById: userId,
            },
          });
        }

        await tx.settingChangeLog.create({
          data: {
            namespace: 'order',
            key: log.key,
            scopeLevel: log.scopeLevel,
            agencyId,
            clientId: log.clientId,
            storeId: log.storeId,
            oldValue: (log.newValue as any) ?? undefined,
            newValue: (log.oldValue as any) ?? undefined,
            changedById: userId,
            reason: `Geri alma (Revert of ${changeSetId})`,
            changeSetId: newChangeSetId,
          },
        });
      }
    });

    await this.cacheService.invalidateAgencySettings(agencyId);
    return { success: true, revertedCount: logs.length };
  }

  /**
   * Exports non-sensitive settings for a store as JSON.
   */
  async exportSettings(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { agencyId: true, clientId: true },
    });
    if (!store) throw new NotFoundException('Store not found');

    const overrides = await this.prisma.settingValue.findMany({
      where: {
        storeId,
        namespace: 'order',
        deletedAt: null,
      },
    });

    const exportData: Record<string, any> = {};
    for (const item of overrides) {
      const def = this.definitionsMap.get(item.key);
      if (def && !def.sensitive) {
        exportData[item.key] = item.value;
      }
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      storeId,
      settings: exportData,
    };
  }

  /**
   * Imports settings JSON to a store.
   */
  async importSettings(agencyId: string, storeId: string, json: Record<string, any>, userId: string) {
    const rawSettings = json.settings || json;
    const changes: SettingChangeItemDto[] = [];

    for (const [key, value] of Object.entries(rawSettings)) {
      const def = this.definitionsMap.get(key);
      if (def && !def.sensitive) {
        changes.push({ key, value });
      }
    }

    return this.update(agencyId, undefined, storeId, changes, 'JSON içe aktarma', userId, ['order_settings.update']);
  }

  /**
   * Copies settings from a source store to target stores within the same agency.
   */
  async copySettings(
    agencyId: string,
    sourceStoreId: string,
    targetStoreIds: string[],
    userId: string,
  ) {
    // Verify all target stores belong to the same agency
    const targetStores = await this.prisma.store.findMany({
      where: {
        id: { in: targetStoreIds },
        agencyId,
      },
      select: { id: true, clientId: true },
    });

    if (targetStores.length !== targetStoreIds.length) {
      throw new BadRequestException('Bir veya daha fazla hedef mağaza bu firmaya ait değil.');
    }

    const sourceOverrides = await this.prisma.settingValue.findMany({
      where: {
        storeId: sourceStoreId,
        agencyId,
        namespace: 'order',
        deletedAt: null,
      },
    });

    for (const target of targetStores) {
      const changes: SettingChangeItemDto[] = sourceOverrides
        .filter((o) => {
          const def = this.definitionsMap.get(o.key);
          return def && !def.sensitive; // Do not copy sensitive numbering / invoice keys
        })
        .map((o) => ({ key: o.key, value: o.value }));

      if (changes.length > 0) {
        await this.update(
          agencyId,
          target.clientId,
          target.id,
          changes,
          `${sourceStoreId} mağazasından kopyalandı`,
          userId,
          ['order_settings.update'],
        );
      }
    }

    return { success: true, targetCount: targetStores.length };
  }
}
