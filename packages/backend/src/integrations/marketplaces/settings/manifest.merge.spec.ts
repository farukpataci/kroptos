import type { ProviderSettingsOverride } from '@kroptos/shared';
import { collectDefaults, collectFields } from '@kroptos/shared';
import { BASE_MANIFEST } from './base.settings';
import { resolveManifest } from './manifest.merge';
import { MarketplaceSettingsRegistry } from './manifest.registry';

const ALL_CAPABILITIES = [
  'orders.read',
  'orders.updateStatus',
  'orders.cancel',
  'products.push',
  'products.read',
  'stock.push',
  'price.push',
  'categories.read',
  'attributes.read',
  'shipment.label',
  'shipment.track',
  'returns.read',
  'invoice.upload',
  'commission.read',
  'buybox.read',
] as ProviderSettingsOverride['capabilities'];

const baseOverride = (patch: Partial<ProviderSettingsOverride> = {}): ProviderSettingsOverride => ({
  provider: 'testmarket',
  displayName: 'Test Market',
  capabilities: ALL_CAPABILITIES,
  credentials: [
    { key: 'apiKey', type: 'password', labelKey: 'x.apiKey', required: true, secret: true },
  ],
  ...patch,
});

const fieldKeys = (manifest: ReturnType<typeof resolveManifest>) =>
  collectFields(manifest).map((f) => f.key);

describe('resolveManifest', () => {
  it('carries every base field through when the provider has all capabilities', () => {
    const manifest = resolveManifest(baseOverride());

    expect(fieldKeys(manifest)).toContain('stock.bufferQuantity');
    expect(fieldKeys(manifest)).toContain('invoicing.uploadToMarketplace');
    expect(manifest.tabs.map((t) => t.id)).toEqual([
      'general',
      'orders',
      'catalog',
      'stock',
      'pricing',
      'fulfillment',
      'returns',
      'invoicing',
      'notifications',
      'advanced',
    ]);
  });

  it('applies patchFields over base defaults', () => {
    const manifest = resolveManifest(
      baseOverride({
        patchFields: {
          'orders.numberPrefix': { default: 'TY-' },
          'advanced.rateLimitPerMinute': { default: 100 },
        },
      }),
    );

    const defaults = collectDefaults(manifest);
    expect(defaults['orders.numberPrefix']).toBe('TY-');
    expect(defaults['advanced.rateLimitPerMinute']).toBe(100);
  });

  it('drops omitted fields and sections', () => {
    const manifest = resolveManifest(
      baseOverride({
        omitFields: ['fulfillment.labelSource'],
        omitSections: ['stock.zero'],
      }),
    );

    expect(fieldKeys(manifest)).not.toContain('fulfillment.labelSource');
    expect(fieldKeys(manifest)).not.toContain('stock.onZeroAction');
  });

  it('appends provider sections at the requested position', () => {
    const manifest = resolveManifest(
      baseOverride({
        addSections: [
          {
            tabId: 'fulfillment',
            position: 'start',
            section: {
              id: 'test.shipment',
              titleKey: 'x.title',
              fields: [{ key: 'test.addressId', type: 'text', labelKey: 'x.addressId' }],
            },
          },
        ],
      }),
    );

    const fulfillment = manifest.tabs.find((t) => t.id === 'fulfillment');
    expect(fulfillment?.sections[0].id).toBe('test.shipment');
    expect(fieldKeys(manifest)).toContain('test.addressId');
  });

  it('rejects a section aimed at a tab that does not exist', () => {
    expect(() =>
      resolveManifest(
        baseOverride({
          addSections: [
            {
              tabId: 'nope',
              section: { id: 'x', titleKey: 'x', fields: [] },
            },
          ],
        }),
      ),
    ).toThrow(/unknown tab 'nope'/);
  });

  it('filters fields, sections and tabs the provider has no capability for', () => {
    const manifest = resolveManifest(
      baseOverride({ capabilities: ['orders.read', 'products.push'] }),
    );

    const tabIds = manifest.tabs.map((t) => t.id);
    expect(tabIds).toContain('orders');
    expect(tabIds).toContain('catalog');
    // stock.push / price.push / returns.read are absent, so those tabs go too.
    expect(tabIds).not.toContain('stock');
    expect(tabIds).not.toContain('pricing');
    expect(tabIds).not.toContain('returns');
    // orders.updateStatus is absent, so the capability-gated field inside a
    // surviving tab is dropped as well.
    expect(fieldKeys(manifest)).not.toContain('orders.autoAccept');
    expect(fieldKeys(manifest)).toContain('orders.autoImport');
  });

  it('drops sections and tabs left empty by capability filtering', () => {
    const manifest = resolveManifest(baseOverride({ capabilities: ['orders.read'] }));

    for (const tab of manifest.tabs) {
      expect(tab.sections.length).toBeGreaterThan(0);
      for (const section of tab.sections) {
        expect(section.fields.length).toBeGreaterThan(0);
      }
    }
  });

  it('prunes wizard steps whose tab did not survive', () => {
    const manifest = resolveManifest(baseOverride({ capabilities: ['orders.read'] }));

    const stepIds = manifest.wizard.map((s) => s.id);
    expect(stepIds).toContain('orders');
    expect(stepIds).not.toContain('stock');
    expect(stepIds).not.toContain('pricing');
  });

  it('applies wizardPatch', () => {
    const manifest = resolveManifest(
      baseOverride({ wizardPatch: { invoicing: { required: true } } }),
    );

    expect(manifest.wizard.find((s) => s.id === 'invoicing')?.required).toBe(true);
  });

  it('appends provider cross rules after the base ones', () => {
    const manifest = resolveManifest(
      baseOverride({
        addCrossRules: [
          { id: 'custom', when: [], requires: 'test.addressId', messageKey: 'x.custom' },
        ],
      }),
    );

    expect(manifest.crossRules.map((r) => r.id)).toEqual([
      'warehouseRequired',
      'floorAboveCeil',
      'markupValueRequired',
      'erpRequired',
      'webhookUrlRequired',
      'statusRequired',
      'custom',
    ]);
  });

  it('never mutates BASE_MANIFEST', () => {
    const snapshot = JSON.stringify(BASE_MANIFEST);

    resolveManifest(
      baseOverride({
        patchFields: { 'orders.numberPrefix': { default: 'MUTATED' } },
        omitSections: ['stock.zero'],
        addSections: [
          {
            tabId: 'stock',
            section: { id: 'x', titleKey: 'x', fields: [{ key: 'x.y', type: 'text', labelKey: 'x' }] },
          },
        ],
      }),
    );

    expect(JSON.stringify(BASE_MANIFEST)).toBe(snapshot);
  });

  it('resolves each registered provider independently', () => {
    const registry = new MarketplaceSettingsRegistry();

    const trendyol = registry.getManifest('trendyol');
    const n11 = registry.getManifest('n11');
    const ciceksepeti = registry.getManifest('ciceksepeti');
    const amazon = registry.getManifest('amazon');

    expect(collectDefaults(trendyol)['orders.numberPrefix']).toBe('TY-');
    expect(collectDefaults(n11)['orders.numberPrefix']).toBe('N11-');

    expect(fieldKeys(trendyol)).toContain('trendyol.shipmentAddressId');
    expect(fieldKeys(n11)).not.toContain('trendyol.shipmentAddressId');
    expect(fieldKeys(n11)).not.toContain('fulfillment.labelSource');
    expect(fieldKeys(ciceksepeti)).not.toContain('catalog.maxImages');
    expect(fieldKeys(amazon)).not.toContain('invoicing.uploadToMarketplace');

    // ÇiçekSepeti has no returns.read capability, so the tab is gone entirely.
    expect(ciceksepeti.tabs.map((t) => t.id)).not.toContain('returns');
  });

  it('rejects an unknown provider by name', () => {
    const registry = new MarketplaceSettingsRegistry();

    // Deliberately a name that will never be registered: this test used to say
    // 'pazarama', which stopped being unknown the day that provider shipped.
    expect(() => registry.getManifest('definitely-not-a-provider')).toThrow(
      /Unsupported marketplace provider/,
    );
    expect(registry.isSupported('TRENDYOL')).toBe(true);
  });
});
