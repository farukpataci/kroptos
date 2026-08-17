import { MarketplaceConnectorFactory } from './MarketplaceConnectorFactory';
import { MarketplaceHttpClient } from './MarketplaceHttpClient';
import { MarketplaceRateLimiter } from './MarketplaceRateLimiter';
import { MarketplaceSettingsRegistry } from '../settings/manifest.registry';

/**
 * The provider list lives in two places that must agree: the settings registry
 * (what the UI is offered and what credentials get validated against) and this
 * factory (what can actually be talked to). A provider present in one and not
 * the other is a dead end — the catalogue offers a connection the backend
 * cannot make, or a connector nobody can reach.
 *
 * Iterating the registry rather than a hand-written list is the point: adding a
 * provider to one side without the other fails here instead of in the UI.
 */
describe('MarketplaceConnectorFactory / registry agreement', () => {
  const registry = new MarketplaceSettingsRegistry();
  const factory = new MarketplaceConnectorFactory(
    new MarketplaceHttpClient(),
    new MarketplaceRateLimiter(),
  );

  const registered = registry.listProviders().map((p) => p.provider);

  it('registers at least the providers this repo ships connectors for', () => {
    expect(registered.length).toBeGreaterThan(0);
  });

  /**
   * Credentials are built from the provider's own manifest rather than a fixed
   * literal, so a connector that validates a field at construction time (a
   * storefront country, say) gets a value its manifest actually allows.
   */
  const credentialsFor = (provider: string): Record<string, string> => {
    const creds: Record<string, string> = {};
    for (const field of registry.getManifest(provider).credentials) {
      creds[field.key] = field.options?.length ? String(field.options[0].value) : 'x';
    }
    return creds;
  };

  it.each(registered)('builds a connector for the registered provider %s', (provider) => {
    const connector = factory.create(provider, credentialsFor(provider));
    expect(connector).toBeDefined();
  });

  /**
   * A provider can have a connector while deliberately staying out of the
   * registry — zalando and aliexpress are written but not switched on, which is
   * what keeps their catalogue cards on "coming soon".
   *
   * This is pinned because the asymmetry looks like an oversight: iterating the
   * registry means a factory entry with no manifest passes silently, and
   * "tightening" that would turn an intentional state into a failure.
   *
   * `temu` left this list on 2026-08-14 when it was registered; the case above
   * now covers it, which is the stronger check of the two.
   */
  it('allows a connector to exist without a registry entry', () => {
    for (const provider of ['zalando', 'aliexpress', 'woocommerce', 'shopify']) {
      expect(registry.isSupported(provider)).toBe(false);
      // The connector is reachable, so enabling the provider stays a one-line
      // registry change rather than a rewrite.
      expect(() => factory.create(provider, { apiUrl: 'https://x.example/r', consumerKey: 'k', consumerSecret: 's', accessToken: 't' })).not.toThrow();
    }
  });

  it('rejects a provider the registry does not know', () => {
    expect(() => factory.create('unknown_provider_xyz', {})).toThrow(/Unsupported marketplace provider/i);
  });

  it('reports the same provider as unsupported on both sides', () => {
    expect(registry.isSupported('unknown_provider_xyz')).toBe(false);
    expect(() => factory.create('unknown_provider_xyz', {})).toThrow();
  });
});
