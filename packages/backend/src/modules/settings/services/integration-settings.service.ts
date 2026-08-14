import { Injectable, GoneException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { IntegrationStatus } from '@kroptos/shared';

/**
 * Legacy read model for the System Settings screen.
 *
 * @deprecated The `IntegrationSettings` table is no longer a source of truth.
 * It used to be written by this screen alone, which meant a marketplace
 * connected from the integrations page stayed "Disconnected" here forever —
 * the two systems never knew about each other. Everything below is now derived
 * from `Integration`, the single source of truth, and the write path is closed.
 *
 * The table and this service are scheduled for removal; see
 * `docs/plans/integration-settings-removal.md`.
 */

/** Legacy status vocabulary this screen renders: connected | disconnected | warning | failed. */
const STATUS_MAP: Record<IntegrationStatus, string> = {
  active: 'connected',
  error: 'failed',
  inactive: 'disconnected',
};

/**
 * Providers the screen lists even when nothing is connected, so the grid keeps
 * its shape. Presentation only — never a claim that a provider is supported.
 */
const PLACEHOLDER_PROVIDERS = ['amazon', 'trendyol', 'hepsiburada', 'shopify', 'woocommerce', 'logo'];

export interface LegacyIntegrationSettingsRow {
  id: string;
  agencyId: string;
  provider: string;
  status: string;
  config: Record<string, never>;
  isActive: boolean;
  lastSyncAt: Date | null;
  errorCount: number;
}

@Injectable()
export class IntegrationSettingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string): Promise<LegacyIntegrationSettingsRow[]> {
    // Tenant scoping belongs on the row selection, not just the signature.
    const integrations = await this.prisma.integration.findMany({
      where: { agencyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncAt: true,
      },
    });

    // Failed sync jobs are what `errorCount` always meant; it just used to be
    // stored and left stale. Derived here so the number reflects reality.
    const failedCounts = await this.prisma.integrationQueue.groupBy({
      by: ['configId'],
      // Scoped by agency; rows belonging to deleted integrations simply never
      // match an id in the map below.
      where: { agencyId, status: 'failed' },
      _count: { configId: true },
    });
    const failedByIntegration = new Map(
      failedCounts.map((row) => [row.configId, row._count.configId]),
    );

    const derived: LegacyIntegrationSettingsRow[] = integrations.map((integration) => ({
      id: integration.id,
      agencyId,
      provider: integration.provider.toLowerCase(),
      status: STATUS_MAP[integration.status as IntegrationStatus] ?? 'disconnected',
      // Credentials live encrypted on `Integration` and are never echoed here.
      config: {},
      isActive: integration.status === 'active',
      lastSyncAt: integration.lastSyncAt,
      errorCount: failedByIntegration.get(integration.id) ?? 0,
    }));

    const connectedProviders = new Set(derived.map((row) => row.provider));
    const placeholders: LegacyIntegrationSettingsRow[] = PLACEHOLDER_PROVIDERS.filter(
      (provider) => !connectedProviders.has(provider),
    ).map((provider) => ({
      id: provider,
      agencyId,
      provider,
      status: 'disconnected',
      config: {},
      isActive: false,
      lastSyncAt: null,
      errorCount: 0,
    }));

    return [...derived, ...placeholders];
  }

  /**
   * @deprecated Writing here produced a record nothing else read, so a provider
   * "connected" on this screen was connected nowhere. Failing loudly beats a
   * silent no-op that leaves a broken screen looking like it works.
   */
  async update(): Promise<never> {
    throw new GoneException(
      'Bu uc nokta kaldirildi. Entegrasyonlar artik /integrations uzerinden yonetiliyor; ' +
        'System Settings ekrani salt okunur olarak oradan turetiliyor.',
    );
  }
}
