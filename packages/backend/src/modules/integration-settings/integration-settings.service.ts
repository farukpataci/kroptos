import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import type {
  EffectiveSettings,
  ProviderSettingsManifest,
  SettingsRevisionSummary,
  SettingsValidationResult,
} from '@kroptos/shared';
import {
  collectDefaults,
  missingRequiredKeys,
  redactSecrets,
  secretKeys,
} from '@kroptos/shared';
import { encrypt, decrypt } from '../../common/utils/encryption.util';
import { MarketplaceSettingsRegistry } from '../../integrations/marketplaces/settings/manifest.registry';
import { SettingsValidator } from '../../integrations/marketplaces/settings/settings.validator';
import { IntegrationService } from '../integration/integration.service';

export interface TenantCtx {
  agencyId?: string;
  clientId?: string;
  storeId?: string;
  isSuperAdmin?: boolean;
  userId?: string;
  userName?: string;
  ipAddress?: string;
}

/** Settings whose change is worth flagging in the audit trail. */
const CRITICAL_KEYS = new Set([
  'stock.source',
  'pricing.markupType',
  'pricing.floorPrice',
  'general.isActive',
  'advanced.dryRun',
]);

const RUNTIME_CACHE_TTL_MS = 60_000;

/** Last 4 characters only, so the UI can show "a value exists" without leaking it. */
function maskSecret(value: unknown): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  const tail = text.slice(-4);
  return `••••${tail}`;
}

@Injectable()
export class IntegrationSettingsService {
  /**
   * Runtime settings are read on every queued job, so they are cached briefly.
   * Deliberately in-process rather than Redis: this deployment treats Redis as
   * optional (see IntegrationQueueService's in-memory fallback), and a stale
   * read here is bounded by the TTL and cleared on every write anyway.
   */
  private readonly runtimeCache = new Map<string, { at: number; values: Record<string, unknown> }>();

  constructor(
    private prisma: PrismaService,
    // Circular by design: this service reuses IntegrationService.get() for its
    // tenant check, while IntegrationService calls back here on create/delete
    // and to guard triggerSync.
    @Inject(forwardRef(() => IntegrationService))
    private integrationService: IntegrationService,
    private registry: MarketplaceSettingsRegistry,
    private validator: SettingsValidator,
  ) {}

  // ------------------------------------------------------------------ reading

  /** Resolves the integration (which enforces tenant scope) and its manifest. */
  private async resolve(integrationId: string, ctx: TenantCtx) {
    const integration = await this.integrationService.get(
      integrationId,
      ctx.agencyId,
      ctx.clientId,
      ctx.storeId,
      ctx.isSuperAdmin,
    );

    if (integration.providerType !== 'marketplace') {
      throw new BadRequestException(
        'Integration settings are only defined for marketplace integrations',
      );
    }

    return { integration, manifest: this.registry.getManifest(integration.provider) };
  }

  private async findSetting(integrationId: string) {
    return this.prisma.integrationSetting.findFirst({
      where: { integrationId, deletedAt: null },
    });
  }

  getSchema(provider: string): ProviderSettingsManifest {
    return this.registry.getManifest(provider);
  }

  async getSchemaForIntegration(
    integrationId: string,
    ctx: TenantCtx,
  ): Promise<ProviderSettingsManifest> {
    const { manifest } = await this.resolve(integrationId, ctx);
    return manifest;
  }

  async getEffective(integrationId: string, ctx: TenantCtx): Promise<EffectiveSettings> {
    const { integration, manifest } = await this.resolve(integrationId, ctx);
    const setting = await this.findSetting(integration.id);

    const stored = (setting?.values as Record<string, unknown>) ?? {};
    const masked = this.maskedSecrets(manifest, setting?.secretsEncrypted ?? null);
    const values = { ...stored, ...masked };
    const defaults = collectDefaults(manifest);
    const effective = { ...defaults, ...values };

    return {
      integrationId: integration.id,
      provider: integration.provider,
      schemaVersion: setting?.schemaVersion ?? manifest.version,
      values,
      defaults,
      effective,
      isConfigured: setting?.isConfigured ?? false,
      completedSteps: setting?.completedSteps ?? [],
      missingRequired: missingRequiredKeys(manifest, effective),
      lastAppliedAt: setting?.lastAppliedAt?.toISOString() ?? null,
      updatedAt: setting?.updatedAt?.toISOString() ?? null,
    };
  }

  /**
   * What connectors and workers read. Secrets come back in the clear here —
   * this is the only path that decrypts them, and its result must never be
   * returned over HTTP.
   */
  async resolveForRuntime(integrationId: string): Promise<Record<string, unknown>> {
    const cached = this.runtimeCache.get(integrationId);
    if (cached && Date.now() - cached.at < RUNTIME_CACHE_TTL_MS) {
      return cached.values;
    }

    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, deletedAt: null },
    });
    if (!integration) {
      throw new NotFoundException(`Integration with ID '${integrationId}' not found`);
    }

    const manifest = this.registry.getManifest(integration.provider);
    const setting = await this.findSetting(integration.id);
    const values = {
      ...collectDefaults(manifest),
      ...((setting?.values as Record<string, unknown>) ?? {}),
      ...this.decryptSecrets(setting?.secretsEncrypted ?? null),
    };

    this.runtimeCache.set(integrationId, { at: Date.now(), values });
    return values;
  }

  invalidateRuntimeCache(integrationId: string): void {
    this.runtimeCache.delete(integrationId);
  }

  async listRevisions(
    integrationId: string,
    ctx: TenantCtx,
    take = 20,
  ): Promise<SettingsRevisionSummary[]> {
    const { integration } = await this.resolve(integrationId, ctx);
    const setting = await this.findSetting(integration.id);
    if (!setting) return [];

    const revisions = await this.prisma.integrationSettingRevision.findMany({
      where: { integrationSettingId: setting.id },
      orderBy: { version: 'desc' },
      take,
    });

    return revisions.map((revision) => ({
      id: revision.id,
      version: revision.version,
      diff: revision.diff as SettingsRevisionSummary['diff'],
      changedByUserId: revision.changedByUserId,
      changedByName: revision.changedByName,
      note: revision.note,
      createdAt: revision.createdAt.toISOString(),
    }));
  }

  // ------------------------------------------------------------------ writing

  async validateOnly(
    integrationId: string,
    incoming: Record<string, unknown>,
    ctx: TenantCtx,
    stepId?: string,
  ): Promise<SettingsValidationResult> {
    const { integration, manifest } = await this.resolve(integrationId, ctx);
    const setting = await this.findSetting(integration.id);

    const unknown = this.validator.unknownKeys(manifest, incoming);
    if (unknown.length > 0) {
      return {
        valid: false,
        errors: unknown.map((key) => ({
          key,
          messageKey: 'integrations.settings.validation.unknownKey',
        })),
      };
    }

    const merged = {
      ...collectDefaults(manifest),
      ...((setting?.values as Record<string, unknown>) ?? {}),
      ...incoming,
    };

    return this.validator.validate(manifest, merged, {
      scopeKeys: stepId ? this.stepKeys(manifest, stepId) : undefined,
    });
  }

  async save(
    integrationId: string,
    incoming: Record<string, unknown>,
    ctx: TenantCtx,
    options: { partial?: boolean; note?: string } = {},
  ): Promise<EffectiveSettings> {
    const { integration, manifest } = await this.resolve(integrationId, ctx);

    const unknown = this.validator.unknownKeys(manifest, incoming);
    if (unknown.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Unknown settings keys',
        errors: unknown.map((key) => ({
          key,
          messageKey: 'integrations.settings.validation.unknownKey',
        })),
      });
    }

    const setting = await this.findSetting(integration.id);
    const storedValues = (setting?.values as Record<string, unknown>) ?? {};
    const storedSecrets = this.decryptSecrets(setting?.secretsEncrypted ?? null);

    // A full save replaces the value set; a PATCH layers onto what is stored.
    const baseValues = options.partial === false ? {} : storedValues;
    const { values: incomingValues, secrets: incomingSecrets } = this.splitSecrets(
      manifest,
      incoming,
      storedSecrets,
    );

    const nextSecrets = { ...storedSecrets, ...incomingSecrets };
    const defaults = collectDefaults(manifest);

    // Only what the user actually diverged on is persisted, and only while the
    // field is still reachable — a value hidden by a condition is dropped so it
    // cannot silently re-apply if the condition flips back later.
    const userSet = { ...baseValues, ...incomingValues };
    const stillVisible = this.validator.pruneInvisible(manifest, { ...defaults, ...userSet });
    const nextValues = Object.fromEntries(
      Object.entries(userSet).filter(([key]) => key in stillVisible),
    );

    const effective = { ...defaults, ...nextValues, ...nextSecrets };
    // Only what this request actually writes is validated. The wizard and the
    // drawer both save a step or a section at a time, so demanding a complete
    // manifest here would make the first save impossible; whether the whole
    // integration is complete is tracked separately by `missingRequired`.
    const result = this.validator.validate(manifest, effective, {
      scopeKeys: Object.keys(incoming),
    });
    if (!result.valid) {
      throw new UnprocessableEntityException({
        message: 'Integration settings validation failed',
        errors: result.errors,
      });
    }

    const diff = this.buildDiff({ ...storedValues, ...storedSecrets }, { ...nextValues, ...nextSecrets });

    return this.persist(integration, manifest, {
      setting,
      values: nextValues,
      secrets: nextSecrets,
      diff,
      note: options.note,
      ctx,
    });
  }

  async reset(
    integrationId: string,
    sectionId: string | undefined,
    ctx: TenantCtx,
  ): Promise<EffectiveSettings> {
    const { integration, manifest } = await this.resolve(integrationId, ctx);
    const setting = await this.findSetting(integration.id);
    if (!setting) return this.getEffective(integrationId, ctx);

    const storedValues = (setting.values as Record<string, unknown>) ?? {};
    const storedSecrets = this.decryptSecrets(setting.secretsEncrypted);

    let nextValues: Record<string, unknown> = {};
    let nextSecrets: Record<string, unknown> = {};

    if (sectionId) {
      const section = manifest.tabs
        .flatMap((tab) => tab.sections)
        .find((candidate) => candidate.id === sectionId);
      if (!section) {
        throw new NotFoundException(`Unknown settings section '${sectionId}'`);
      }
      const cleared = new Set(section.fields.map((field) => field.key));
      nextValues = Object.fromEntries(
        Object.entries(storedValues).filter(([key]) => !cleared.has(key)),
      );
      nextSecrets = Object.fromEntries(
        Object.entries(storedSecrets).filter(([key]) => !cleared.has(key)),
      );
    }

    const diff = this.buildDiff({ ...storedValues, ...storedSecrets }, { ...nextValues, ...nextSecrets });

    return this.persist(integration, manifest, {
      setting,
      values: nextValues,
      secrets: nextSecrets,
      diff,
      note: sectionId ? `reset:${sectionId}` : 'reset:all',
      ctx,
      action: 'integration.settings.reset',
    });
  }

  async completeWizardStep(
    integrationId: string,
    stepId: string,
    values: Record<string, unknown> | undefined,
    ctx: TenantCtx,
  ): Promise<EffectiveSettings> {
    const { integration, manifest } = await this.resolve(integrationId, ctx);

    if (!manifest.wizard.some((step) => step.id === stepId)) {
      throw new NotFoundException(`Unknown wizard step '${stepId}'`);
    }

    if (values && Object.keys(values).length > 0) {
      await this.save(integrationId, values, ctx, { partial: true });
    }

    const setting = await this.findSetting(integration.id);
    if (!setting) {
      throw new NotFoundException('Integration settings record is missing');
    }

    const completedSteps = Array.from(new Set([...setting.completedSteps, stepId]));
    const effective = await this.getEffective(integrationId, ctx);

    // "Configured" means every required step is done *and* nothing required is
    // still blank — a step can be marked complete and later be invalidated by
    // an edit that empties one of its fields.
    const requiredSteps = manifest.wizard.filter((step) => step.required).map((step) => step.id);
    const isConfigured =
      requiredSteps.every((step) => completedSteps.includes(step)) &&
      effective.missingRequired.length === 0;

    await this.prisma.integrationSetting.update({
      where: { id: setting.id },
      data: {
        completedSteps,
        isConfigured,
        lastAppliedAt: isConfigured ? new Date() : setting.lastAppliedAt,
      },
    });

    this.invalidateRuntimeCache(integration.id);
    return this.getEffective(integrationId, ctx);
  }

  async restoreRevision(
    integrationId: string,
    version: number,
    ctx: TenantCtx,
  ): Promise<EffectiveSettings> {
    const { integration, manifest } = await this.resolve(integrationId, ctx);
    const setting = await this.findSetting(integration.id);
    if (!setting) {
      throw new NotFoundException('Integration settings record is missing');
    }

    const revision = await this.prisma.integrationSettingRevision.findUnique({
      where: {
        integrationSettingId_version: { integrationSettingId: setting.id, version },
      },
    });
    if (!revision) {
      throw new NotFoundException(`Settings revision ${version} not found`);
    }

    const snapshot = (revision.values as Record<string, unknown>) ?? {};
    const secrets = secretKeys(manifest);
    const restoredValues = Object.fromEntries(
      Object.entries(snapshot).filter(([key]) => !secrets.includes(key)),
    );
    const restoredSecrets = Object.fromEntries(
      Object.entries(snapshot).filter(([key]) => secrets.includes(key)),
    );

    const storedValues = (setting.values as Record<string, unknown>) ?? {};
    const storedSecrets = this.decryptSecrets(setting.secretsEncrypted);

    return this.persist(integration, manifest, {
      setting,
      values: restoredValues,
      secrets: restoredSecrets,
      diff: this.buildDiff({ ...storedValues, ...storedSecrets }, snapshot),
      note: `restore:v${version}`,
      ctx,
      action: 'integration.settings.restore',
    });
  }

  /**
   * Called when an integration is created, so a settings row (and therefore a
   * "not configured yet" state) exists from the first moment rather than
   * appearing only after the first save.
   */
  async ensureForIntegration(integration: {
    id: string;
    agencyId: string;
    clientId: string | null;
    storeId: string | null;
    provider: string;
    providerType: string;
  }): Promise<void> {
    if (integration.providerType !== 'marketplace') return;
    if (!this.registry.isSupported(integration.provider)) return;

    const manifest = this.registry.getManifest(integration.provider);
    await this.prisma.integrationSetting.upsert({
      where: { integrationId: integration.id },
      update: { deletedAt: null },
      create: {
        integrationId: integration.id,
        agencyId: integration.agencyId,
        clientId: integration.clientId,
        storeId: integration.storeId,
        provider: integration.provider,
        schemaVersion: manifest.version,
        values: {},
        isConfigured: false,
        completedSteps: [],
      },
    });
  }

  async softDeleteForIntegration(integrationId: string): Promise<void> {
    await this.prisma.integrationSetting.updateMany({
      where: { integrationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    this.invalidateRuntimeCache(integrationId);
  }

  /** Guard used by triggerSync — the UI is never the only thing stopping a sync. */
  async assertConfigured(integrationId: string, provider: string): Promise<void> {
    if (!this.registry.isSupported(provider)) return;

    const setting = await this.findSetting(integrationId);
    if (!setting?.isConfigured) {
      throw new BadRequestException('integration.settings.notConfigured');
    }
  }

  // ------------------------------------------------------------------ helpers

  /** Field keys that belong to a wizard step, via its tab or explicit sections. */
  private stepKeys(manifest: ProviderSettingsManifest, stepId: string): string[] {
    const step = manifest.wizard.find((candidate) => candidate.id === stepId);
    if (!step) return [];

    const sections = manifest.tabs
      .filter((tab) => !step.tabId || tab.id === step.tabId)
      .flatMap((tab) => tab.sections)
      .filter((section) => !step.sectionIds || step.sectionIds.includes(section.id));

    return sections.flatMap((section) => section.fields.map((field) => field.key));
  }

  /**
   * Splits incoming values into plain and secret halves. A secret echoed back
   * masked carries no new information, so it is dropped and the stored value
   * survives — the same rule credential updates follow.
   */
  private splitSecrets(
    manifest: ProviderSettingsManifest,
    incoming: Record<string, unknown>,
    stored: Record<string, unknown>,
  ): { values: Record<string, unknown>; secrets: Record<string, unknown> } {
    const secrets = new Set(secretKeys(manifest));
    const values: Record<string, unknown> = {};
    const nextSecrets: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(incoming)) {
      if (!secrets.has(key)) {
        values[key] = value;
        continue;
      }
      const isMasked = typeof value === 'string' && value.startsWith('••••');
      const isBlank = value === null || value === undefined || value === '';
      if (isMasked || (isBlank && key in stored)) continue;
      nextSecrets[key] = value;
    }

    return { values, secrets: nextSecrets };
  }

  private decryptSecrets(encrypted: string | null): Record<string, unknown> {
    if (!encrypted) return {};
    try {
      return JSON.parse(decrypt(encrypted));
    } catch {
      // A blob that no longer decrypts (rotated key, truncated column) must not
      // take the whole settings read down with it.
      console.error('Failed to decrypt integration settings secrets; treating as empty');
      return {};
    }
  }

  private maskedSecrets(
    manifest: ProviderSettingsManifest,
    encrypted: string | null,
  ): Record<string, unknown> {
    const decrypted = this.decryptSecrets(encrypted);
    const known = new Set(secretKeys(manifest));
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(decrypted)) {
      if (known.has(key)) masked[key] = maskSecret(value);
    }
    return masked;
  }

  private buildDiff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, { before: unknown; after: unknown }> {
    const diff: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        diff[key] = { before: before[key], after: after[key] };
      }
    }
    return diff;
  }

  private async persist(
    integration: { id: string; agencyId: string; clientId: string | null; storeId: string | null; provider: string; name: string },
    manifest: ProviderSettingsManifest,
    input: {
      setting: { id: string; completedSteps: string[] } | null;
      values: Record<string, unknown>;
      secrets: Record<string, unknown>;
      diff: Record<string, { before: unknown; after: unknown }>;
      note?: string;
      ctx: TenantCtx;
      action?: string;
    },
  ): Promise<EffectiveSettings> {
    const { setting, values, secrets, diff, note, ctx } = input;
    const action = input.action ?? 'integration.settings.update';

    const secretsEncrypted =
      Object.keys(secrets).length > 0 ? encrypt(JSON.stringify(secrets)) : null;

    const effective = { ...collectDefaults(manifest), ...values, ...secrets };
    const stillMissing = missingRequiredKeys(manifest, effective);
    const requiredSteps = manifest.wizard.filter((step) => step.required).map((step) => step.id);
    const completedSteps = setting?.completedSteps ?? [];
    const isConfigured =
      requiredSteps.every((step) => completedSteps.includes(step)) && stillMissing.length === 0;

    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.integrationSetting.upsert({
        where: { integrationId: integration.id },
        update: {
          values: values as any,
          secretsEncrypted,
          schemaVersion: manifest.version,
          isConfigured,
          lastAppliedAt: new Date(),
          deletedAt: null,
        },
        create: {
          integrationId: integration.id,
          agencyId: integration.agencyId,
          clientId: integration.clientId,
          storeId: integration.storeId,
          provider: integration.provider,
          schemaVersion: manifest.version,
          values: values as any,
          secretsEncrypted,
          isConfigured,
          completedSteps: [],
          lastAppliedAt: new Date(),
        },
      });

      const last = await tx.integrationSettingRevision.findFirst({
        where: { integrationSettingId: saved.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      await tx.integrationSettingRevision.create({
        data: {
          integrationSettingId: saved.id,
          version: (last?.version ?? 0) + 1,
          // The snapshot must be restorable, so secrets are included — the
          // revision row lives behind the same tenant scope as the setting.
          values: { ...values, ...secrets } as any,
          diff: redactSecrets(manifest, diff) as any,
          changedByUserId: ctx.userId ?? null,
          changedByName: ctx.userName ?? null,
          note: note ?? null,
        },
      });

      const touchedCritical = Object.keys(diff).some((key) => CRITICAL_KEYS.has(key));
      await tx.auditLog.create({
        data: {
          action,
          module: 'integration',
          entityType: 'Integration',
          entityId: integration.id,
          entityDisplayName: integration.name,
          userId: ctx.userId ?? null,
          userName: ctx.userName ?? null,
          tenantId: integration.agencyId,
          ipAddress: ctx.ipAddress ?? null,
          oldValue: redactSecrets(
            manifest,
            Object.fromEntries(Object.entries(diff).map(([key, d]) => [key, d.before])),
          ) as any,
          newValue: redactSecrets(
            manifest,
            Object.fromEntries(Object.entries(diff).map(([key, d]) => [key, d.after])),
          ) as any,
          severity: touchedCritical ? 'warning' : 'info',
        },
      });
    });

    this.invalidateRuntimeCache(integration.id);
    return this.getEffective(integration.id, ctx);
  }

}
