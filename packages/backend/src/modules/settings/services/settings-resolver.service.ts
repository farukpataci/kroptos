import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import {
  SettingDefinition,
  EffectiveSettingValue,
  EffectiveSourceLevel,
  ScopeLevel,
} from '../interfaces/setting-definition.interface';

export interface ResolutionContext {
  agencyId: string;
  clientId?: string | null;
  storeId?: string | null;
}

@Injectable()
export class SettingsResolverService {
  private readonly logger = new Logger(SettingsResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  public static getScopeKey(
    agencyId: string,
    clientId: string | null | undefined,
    storeId: string | null | undefined,
    namespace: string,
    key: string,
  ): string {
    return `${agencyId}:${clientId || '*'}:${storeId || '*'}:${namespace}:${key}`;
  }

  /**
   * Resolves effective values for a given scope context.
   * Returns a detailed list of EffectiveSettingValue items for UI or inspection.
   */
  async resolveEffectiveSettings(
    namespace: string,
    definitions: SettingDefinition[],
    context: ResolutionContext,
    userPermissions: string[] = [],
  ): Promise<EffectiveSettingValue[]> {
    const { agencyId, clientId, storeId } = context;

    // Fetch all overrides within this agency for the given namespace
    const settingRows = await this.prisma.settingValue.findMany({
      where: {
        agencyId,
        namespace,
        deletedAt: null,
      },
    });

    // Bucket rows by hierarchy level
    const agencyMap = new Map<string, { value: any; locked: boolean }>();
    const clientMap = new Map<string, { value: any; locked: boolean }>();
    const storeMap = new Map<string, { value: any; locked: boolean }>();

    for (const row of settingRows) {
      if (!row.clientId && !row.storeId) {
        agencyMap.set(row.key, { value: row.value, locked: row.locked });
      } else if (row.clientId && !row.storeId && (!clientId || row.clientId === clientId)) {
        clientMap.set(row.key, { value: row.value, locked: row.locked });
      } else if (row.storeId && (!storeId || row.storeId === storeId)) {
        storeMap.set(row.key, { value: row.value, locked: row.locked });
      }
    }

    const currentScopeLevel: ScopeLevel = storeId
      ? 'STORE'
      : clientId
      ? 'CLIENT'
      : 'AGENCY';

    const hasWildcard = userPermissions.includes('*:*');
    const hasUpdate = hasWildcard || userPermissions.includes('order_settings.update');
    const hasUpdateSensitive = hasWildcard || userPermissions.includes('order_settings.update_sensitive');

    return definitions.map((def) => {
      let effectiveValue = def.default;
      let sourceLevel: EffectiveSourceLevel = 'SYSTEM';
      let inheritedValue = def.default;
      let isLocked = false;
      let lockedAtLevel: ScopeLevel | undefined = undefined;

      // 1. Agency level
      const agencyOverride = agencyMap.get(def.key);
      if (agencyOverride !== undefined) {
        effectiveValue = agencyOverride.value;
        sourceLevel = 'AGENCY';
        if (agencyOverride.locked) {
          isLocked = true;
          lockedAtLevel = 'AGENCY';
        }
      }

      // If evaluating at client or store level, agency value is inherited
      if (currentScopeLevel === 'CLIENT' || currentScopeLevel === 'STORE') {
        inheritedValue = effectiveValue;
      }

      // 2. Client level (if not locked by agency)
      if (clientId) {
        const clientOverride = clientMap.get(def.key);
        if (clientOverride !== undefined && !agencyOverride?.locked) {
          effectiveValue = clientOverride.value;
          sourceLevel = 'CLIENT';
          if (clientOverride.locked) {
            isLocked = true;
            lockedAtLevel = 'CLIENT';
          }
        }
      }

      // If evaluating at store level, client value is inherited
      if (currentScopeLevel === 'STORE') {
        inheritedValue = effectiveValue;
      }

      // 3. Store level (if not locked by agency or client)
      if (storeId) {
        const storeOverride = storeMap.get(def.key);
        if (storeOverride !== undefined && !agencyOverride?.locked && (!clientId || !clientMap.get(def.key)?.locked)) {
          effectiveValue = storeOverride.value;
          sourceLevel = 'STORE';
        }
      }

      // Determine if active scope can edit this setting
      const isAllowedScope = def.scopes.includes(currentScopeLevel);
      const isSensitiveBlocked = def.sensitive && !hasUpdateSensitive;
      const isPermissionBlocked = !hasUpdate || isSensitiveBlocked;
      const isLockedByUpper = isLocked && lockedAtLevel !== currentScopeLevel;

      const canEdit = isAllowedScope && !isLockedByUpper && !isPermissionBlocked;
      const isOverridden = sourceLevel === currentScopeLevel;

      return {
        key: def.key,
        value: effectiveValue,
        sourceLevel,
        inheritedValue,
        isOverridden,
        isLocked,
        lockedAtLevel,
        canEdit,
        definition: def,
      };
    });
  }

  /**
   * Resolves plain dictionary of effective key-values for fast internal consumption.
   */
  async resolveValuesMap(
    namespace: string,
    definitions: SettingDefinition[],
    context: ResolutionContext,
  ): Promise<Record<string, any>> {
    const effectiveList = await this.resolveEffectiveSettings(namespace, definitions, context, ['*:*']);
    const map: Record<string, any> = {};
    for (const item of effectiveList) {
      map[item.key] = item.value;
    }
    return map;
  }
}
