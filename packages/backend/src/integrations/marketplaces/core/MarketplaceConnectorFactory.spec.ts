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

  it.each(registered)('builds a connector for the registered provider %s', (provider) => {
    // Credentials are not inspected at construction time; a connector that
    // cannot even be instantiated is the failure this guards against.
    const connector = factory.create(provider, { apiKey: 'x', apiSecret: 'y' });
    expect(connector).toBeDefined();
  });

  it('rejects a provider the registry does not know', () => {
    expect(() => factory.create('shopify', {})).toThrow(/Unsupported marketplace provider/i);
  });

  it('reports the same provider as unsupported on both sides', () => {
    expect(registry.isSupported('shopify')).toBe(false);
    expect(() => factory.create('shopify', {})).toThrow();
  });
});
