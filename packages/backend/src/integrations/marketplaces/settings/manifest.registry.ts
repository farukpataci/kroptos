import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  ProviderSettingsManifest,
  ProviderSettingsOverride,
  ProviderSummary,
} from '@kroptos/shared';
import { resolveManifest } from './manifest.merge';
import { trendyolOverride } from './providers/trendyol.settings';
import { hepsiburadaOverride } from './providers/hepsiburada.settings';
import { n11Override } from './providers/n11.settings';
import { amazonOverride } from './providers/amazon.settings';
import { ciceksepetiOverride } from './providers/ciceksepeti.settings';
import { pazaramaOverride } from './providers/pazarama.settings';
import { etsyOverride } from './providers/etsy.settings';

/**
 * The one place a marketplace is registered. Adding a provider is this list
 * plus its `<provider>.settings.ts` — no controller, service or component
 * changes (doc §14).
 */
const OVERRIDES: ProviderSettingsOverride[] = [
  trendyolOverride,
  hepsiburadaOverride,
  n11Override,
  amazonOverride,
  ciceksepetiOverride,
  pazaramaOverride,
  etsyOverride,
];

@Injectable()
export class MarketplaceSettingsRegistry {
  /**
   * Resolution is deterministic and provider count is small, so manifests are
   * built once at boot. That also turns a malformed override into a startup
   * failure instead of a request-time 500.
   */
  private readonly manifests = new Map<string, ProviderSettingsManifest>(
    OVERRIDES.map((override) => [
      override.provider.toLowerCase(),
      resolveManifest(override),
    ]),
  );

  isSupported(provider: string): boolean {
    return this.manifests.has(provider.toLowerCase());
  }

  getManifest(provider: string): ProviderSettingsManifest {
    const manifest = this.manifests.get(provider.toLowerCase());
    if (!manifest) {
      throw new BadRequestException(`Unsupported marketplace provider: ${provider}`);
    }
    return manifest;
  }

  listProviders(): ProviderSummary[] {
    return [...this.manifests.values()].map((manifest) => ({
      provider: manifest.provider,
      displayName: manifest.displayName,
      capabilities: manifest.capabilities,
      docsUrl: manifest.docsUrl,
    }));
  }
}
