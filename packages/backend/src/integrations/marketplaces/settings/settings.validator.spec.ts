import { collectDefaults } from '@kroptos/shared';
import { MarketplaceSettingsRegistry } from './manifest.registry';
import { SettingsValidator } from './settings.validator';

describe('SettingsValidator', () => {
  const registry = new MarketplaceSettingsRegistry();
  const validator = new SettingsValidator();
  const manifest = registry.getManifest('trendyol');
  const defaults = collectDefaults(manifest);

  /** Defaults plus the minimum a Trendyol integration needs to be valid. */
  const validValues = () => ({
    ...defaults,
    'stock.source': 'allWarehouses',
    'fulfillment.model': 'seller',
    'trendyol.shipmentAddressId': 'addr-1',
    'trendyol.returnAddressId': 'addr-2',
  });

  const keysOf = (values: Record<string, unknown>) =>
    validator.validate(manifest, values).errors.map((e) => e.key);

  it('accepts a fully populated set of values', () => {
    const result = validator.validate(manifest, validValues());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('reports a required field left empty', () => {
    const values = { ...validValues(), 'trendyol.shipmentAddressId': '' };
    const errors = validator.validate(manifest, values).errors;

    expect(errors).toContainEqual(
      expect.objectContaining({
        key: 'trendyol.shipmentAddressId',
        messageKey: 'integrations.settings.validation.required',
      }),
    );
  });

  it('rejects a non-numeric value in a number field', () => {
    expect(keysOf({ ...validValues(), 'stock.bufferQuantity': 'five' })).toContain(
      'stock.bufferQuantity',
    );
  });

  it('enforces min and max', () => {
    expect(keysOf({ ...validValues(), 'stock.bufferPercent': -1 })).toContain(
      'stock.bufferPercent',
    );
    expect(keysOf({ ...validValues(), 'stock.bufferPercent': 101 })).toContain(
      'stock.bufferPercent',
    );
  });

  it('enforces maxLength and pattern', () => {
    expect(keysOf({ ...validValues(), 'orders.numberPrefix': 'WAY-TOO-LONG' })).toContain(
      'orders.numberPrefix',
    );
    expect(
      keysOf({
        ...validValues(),
        'notifications.channels': ['webhook'],
        'notifications.webhookUrl': 'http://insecure.example.com',
      }),
    ).toContain('notifications.webhookUrl');
  });

  it('rejects a value outside the declared options', () => {
    expect(keysOf({ ...validValues(), 'stock.onZeroAction': 'explode' })).toContain(
      'stock.onZeroAction',
    );
    expect(keysOf({ ...validValues(), 'orders.importStatuses': ['created', 'teleported'] })).toContain(
      'orders.importStatuses',
    );
  });

  it('rejects a non-boolean in a toggle and a non-list in a multiselect', () => {
    expect(keysOf({ ...validValues(), 'orders.autoImport': 'yes' })).toContain('orders.autoImport');
    expect(keysOf({ ...validValues(), 'orders.importStatuses': 'created' })).toContain(
      'orders.importStatuses',
    );
  });

  it('rejects a malformed time value', () => {
    expect(keysOf({ ...validValues(), 'fulfillment.cutoffTime': '25:99' })).toContain(
      'fulfillment.cutoffTime',
    );
    expect(keysOf({ ...validValues(), 'fulfillment.cutoffTime': '09:30' })).not.toContain(
      'fulfillment.cutoffTime',
    );
  });

  it('skips a field hidden by visibleWhen instead of demanding it', () => {
    // stock.warehouseIds only exists when the source is 'selected'.
    const hidden = { ...validValues(), 'stock.source': 'allWarehouses' };
    expect(keysOf(hidden)).not.toContain('stock.warehouseIds');

    const shown = { ...validValues(), 'stock.source': 'selected', 'stock.warehouseIds': [] };
    expect(keysOf(shown)).toContain('stock.warehouseIds');
  });

  describe('cross rules', () => {
    it('requires warehouses when the stock source is a selection', () => {
      const errors = validator.validate(manifest, {
        ...validValues(),
        'stock.source': 'selected',
        'stock.warehouseIds': [],
      }).errors;

      expect(errors).toContainEqual(
        expect.objectContaining({
          key: 'stock.warehouseIds',
          messageKey: 'integrations.settings.validation.warehouseRequired',
        }),
      );
    });

    it('rejects a floor price above the ceiling', () => {
      const errors = validator.validate(manifest, {
        ...validValues(),
        'pricing.floorPrice': 500,
        'pricing.ceilPrice': 100,
      }).errors;

      expect(errors).toContainEqual(
        expect.objectContaining({
          key: 'pricing.floorPrice',
          messageKey: 'integrations.settings.validation.floorAboveCeil',
        }),
      );
    });

    it('leaves the price bounds alone when only one is set', () => {
      expect(
        keysOf({ ...validValues(), 'pricing.floorPrice': 500, 'pricing.ceilPrice': undefined }),
      ).not.toContain('pricing.floorPrice');
    });

    it('requires a markup value once a markup type is chosen', () => {
      expect(
        keysOf({ ...validValues(), 'pricing.markupType': 'percent', 'pricing.markupValue': 0 }),
      ).toContain('pricing.markupValue');
    });

    it('requires an ERP integration when auto invoicing is on', () => {
      expect(keysOf({ ...validValues(), 'invoicing.autoInvoice': true })).toContain(
        'invoicing.erpIntegrationId',
      );
    });

    it('requires an https webhook url when the webhook channel is selected', () => {
      expect(
        keysOf({ ...validValues(), 'notifications.channels': ['inApp', 'webhook'] }),
      ).toContain('notifications.webhookUrl');
    });

    it('requires at least one order status when auto import is on', () => {
      expect(
        keysOf({ ...validValues(), 'orders.autoImport': true, 'orders.importStatuses': [] }),
      ).toContain('orders.importStatuses');
    });
  });

  describe('unknownKeys', () => {
    it('flags keys the manifest does not define', () => {
      expect(validator.unknownKeys(manifest, { 'stock.bufferQuantity': 5, 'evil.key': 1 })).toEqual([
        'evil.key',
      ]);
    });

    it('flags a provider-specific key belonging to a different marketplace', () => {
      expect(validator.unknownKeys(manifest, { 'n11.shipmentTemplate': 'x' })).toEqual([
        'n11.shipmentTemplate',
      ]);
    });
  });

  describe('pruneInvisible', () => {
    it('drops values whose field is currently hidden', () => {
      const pruned = validator.pruneInvisible(manifest, {
        ...validValues(),
        'stock.source': 'allWarehouses',
        'stock.warehouseIds': ['wh-1'],
      });

      expect(pruned['stock.warehouseIds']).toBeUndefined();
      expect(pruned['stock.source']).toBe('allWarehouses');
    });

    it('keeps values whose condition currently holds', () => {
      const pruned = validator.pruneInvisible(manifest, {
        ...validValues(),
        'stock.source': 'selected',
        'stock.warehouseIds': ['wh-1'],
      });

      expect(pruned['stock.warehouseIds']).toEqual(['wh-1']);
    });
  });

  it('limits validation to one wizard step when a scope is given', () => {
    const broken = {
      ...validValues(),
      'stock.bufferQuantity': 'not-a-number',
      'fulfillment.cutoffTime': '99:99',
    };

    const stockOnly = validator.validate(manifest, broken, {
      scopeKeys: ['stock.bufferQuantity'],
    });

    expect(stockOnly.errors.map((e) => e.key)).toEqual(['stock.bufferQuantity']);
  });
});
