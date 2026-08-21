import type {
  ProviderSettingsManifest,
  SettingsCrossRule,
  SettingsField,
  SettingsTab,
  SettingsWizardStep,
} from '@kroptos/shared';

/**
 * The settings every marketplace shares. Provider files only write the diff
 * (see `manifest.registry.ts`); a field a provider cannot support is dropped
 * automatically by its `requiresCapability` rather than by an `if` somewhere.
 *
 * i18n keys are written out in full — the renderer never guesses or abbreviates.
 */

const I = 'integrations.settings';
const label = (key: string) => `${I}.fields.${key}.label`;
const help = (key: string) => `${I}.fields.${key}.help`;
const placeholder = (key: string) => `${I}.fields.${key}.placeholder`;
const option = (key: string, value: string) => `${I}.options.${key}.${value}`;
const sectionTitle = (id: string) => `${I}.sections.${id}.title`;
const sectionDesc = (id: string) => `${I}.sections.${id}.description`;
const tabTitle = (id: string) => `${I}.tabs.${id}.title`;
const stepTitle = (id: string) => `${I}.wizard.steps.${id}.title`;
const stepDesc = (id: string) => `${I}.wizard.steps.${id}.description`;

/** Shorthand for `options` entries whose i18n key follows the field key. */
const opts = (key: string, values: string[]) =>
  values.map((value) => ({ value, labelKey: option(key, value) }));

const INTERVAL_MINUTES = ['5', '10', '15', '30', '60', '180', '360', '720', '1440'];

const intervalField = (key: string, def: string): SettingsField => ({
  key,
  type: 'select',
  labelKey: label(key),
  helpKey: help(key),
  default: def,
  options: opts('intervalMinutes', INTERVAL_MINUTES),
  unitKey: `${I}.units.minutes`,
});

// ---------------------------------------------------------------- Tab: general

const generalTab: SettingsTab = {
  id: 'general',
  titleKey: tabTitle('general'),
  icon: 'Cog6ToothIcon',
  sections: [
    {
      id: 'general.connection',
      titleKey: sectionTitle('general.connection'),
      descriptionKey: sectionDesc('general.connection'),
      icon: 'LinkIcon',
      fields: [
        {
          key: 'general.displayName',
          type: 'text',
          labelKey: label('general.displayName'),
          helpKey: help('general.displayName'),
          placeholderKey: placeholder('general.displayName'),
          maxLength: 80,
        },
        {
          key: 'general.isActive',
          type: 'toggle',
          labelKey: label('general.isActive'),
          helpKey: help('general.isActive'),
          default: true,
        },
        {
          key: 'general.environment',
          type: 'select',
          labelKey: label('general.environment'),
          default: 'production',
          options: opts('general.environment', ['production', 'sandbox']),
        },
        {
          key: 'general.storeScope',
          type: 'resourceSelect',
          labelKey: label('general.storeScope'),
          helpKey: help('general.storeScope'),
          optionsSource: { endpoint: '/stores', valueField: 'id', labelField: 'name' },
        },
        {
          key: 'general.currency',
          type: 'select',
          labelKey: label('general.currency'),
          default: 'TRY',
          // Only what every provider can actually settle in. A provider that
          // trades elsewhere widens this list from its own override — putting
          // its currencies here would make its missing translations surface as
          // a failure on all fifteen providers instead of on itself.
          options: opts('general.currency', ['TRY', 'USD', 'EUR', 'GBP']),
        },
        {
          key: 'general.timezone',
          type: 'select',
          labelKey: label('general.timezone'),
          helpKey: help('general.timezone'),
          default: 'Europe/Istanbul',
          // Same rule as `general.currency`: a provider adds its own zones from
          // its override, never here.
          options: opts('general.timezone', [
            'Europe/Istanbul',
            'Europe/London',
            'Europe/Berlin',
            'UTC',
          ]),
        },
      ],
    },
    {
      id: 'general.health',
      titleKey: sectionTitle('general.health'),
      descriptionKey: sectionDesc('general.health'),
      icon: 'HeartIcon',
      fields: [
        {
          key: 'general.autoDisableOnErrorCount',
          type: 'number',
          labelKey: label('general.autoDisableOnErrorCount'),
          helpKey: help('general.autoDisableOnErrorCount'),
          default: 10,
          min: 0,
          max: 100,
        },
        {
          key: 'general.healthCheckIntervalMinutes',
          type: 'number',
          labelKey: label('general.healthCheckIntervalMinutes'),
          default: 60,
          min: 5,
          max: 1440,
          unitKey: `${I}.units.minutes`,
        },
      ],
    },
  ],
};

// ----------------------------------------------------------------- Tab: orders

const ordersTab: SettingsTab = {
  id: 'orders',
  titleKey: tabTitle('orders'),
  icon: 'ShoppingCartIcon',
  requiresCapability: 'orders.read',
  sections: [
    {
      id: 'orders.import',
      titleKey: sectionTitle('orders.import'),
      descriptionKey: sectionDesc('orders.import'),
      icon: 'InboxArrowDownIcon',
      fields: [
        {
          key: 'orders.autoImport',
          type: 'toggle',
          labelKey: label('orders.autoImport'),
          helpKey: help('orders.autoImport'),
          default: true,
        },
        {
          ...intervalField('orders.intervalMinutes', '15'),
          visibleWhen: { field: 'orders.autoImport', op: 'truthy' },
        },
        {
          key: 'orders.backfillDays',
          type: 'number',
          labelKey: label('orders.backfillDays'),
          helpKey: help('orders.backfillDays'),
          default: 7,
          min: 0,
          max: 90,
          unitKey: `${I}.units.days`,
        },
        {
          key: 'orders.importStatuses',
          type: 'multiselect',
          labelKey: label('orders.importStatuses'),
          helpKey: help('orders.importStatuses'),
          default: ['created', 'picking', 'shipped'],
          options: opts('orders.importStatuses', [
            'created',
            'picking',
            'invoiced',
            'shipped',
            'delivered',
            'cancelled',
            'returned',
          ]),
          colSpan: 2,
        },
        {
          key: 'orders.numberPrefix',
          type: 'text',
          labelKey: label('orders.numberPrefix'),
          helpKey: help('orders.numberPrefix'),
          maxLength: 8,
        },
        {
          key: 'orders.skipTestOrders',
          type: 'toggle',
          labelKey: label('orders.skipTestOrders'),
          default: true,
        },
      ],
    },
    {
      id: 'orders.statusMapping',
      titleKey: sectionTitle('orders.statusMapping'),
      descriptionKey: sectionDesc('orders.statusMapping'),
      icon: 'ArrowsRightLeftIcon',
      fields: [
        {
          key: 'orders.statusMap',
          type: 'mappingTable',
          labelKey: label('orders.statusMap'),
          colSpan: 2,
          mapping: {
            leftLabelKey: `${I}.mapping.marketplaceStatus`,
            rightLabelKey: `${I}.mapping.kroptosStatus`,
            leftSource: opts('orders.importStatuses', [
              'created',
              'picking',
              'invoiced',
              'shipped',
              'delivered',
              'cancelled',
              'returned',
            ]),
            rightSource: opts('orders.kroptosStatus', [
              'pending',
              'processing',
              'shipped',
              'delivered',
              'cancelled',
            ]),
            allowUnmapped: true,
          },
        },
      ],
    },
    {
      id: 'orders.automation',
      titleKey: sectionTitle('orders.automation'),
      icon: 'BoltIcon',
      fields: [
        {
          key: 'orders.autoAccept',
          type: 'toggle',
          labelKey: label('orders.autoAccept'),
          helpKey: help('orders.autoAccept'),
          default: false,
          requiresCapability: 'orders.updateStatus',
        },
        {
          key: 'orders.autoCreateShipment',
          type: 'toggle',
          labelKey: label('orders.autoCreateShipment'),
          default: true,
        },
        {
          key: 'orders.splitByWarehouse',
          type: 'toggle',
          labelKey: label('orders.splitByWarehouse'),
          helpKey: help('orders.splitByWarehouse'),
          default: false,
        },
        {
          key: 'orders.onCancelAction',
          type: 'radioGroup',
          labelKey: label('orders.onCancelAction'),
          default: 'restock',
          options: opts('orders.onCancelAction', ['restock', 'keep', 'manual']),
          colSpan: 2,
        },
      ],
    },
    {
      id: 'orders.customer',
      titleKey: sectionTitle('orders.customer'),
      icon: 'UserIcon',
      fields: [
        {
          key: 'orders.createCustomerRecord',
          type: 'toggle',
          labelKey: label('orders.createCustomerRecord'),
          default: true,
        },
        {
          key: 'orders.maskPII',
          type: 'toggle',
          labelKey: label('orders.maskPII'),
          helpKey: help('orders.maskPII'),
          default: true,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- Tab: catalog

const catalogTab: SettingsTab = {
  id: 'catalog',
  titleKey: tabTitle('catalog'),
  icon: 'TagIcon',
  requiresCapability: 'products.push',
  sections: [
    {
      id: 'catalog.push',
      titleKey: sectionTitle('catalog.push'),
      descriptionKey: sectionDesc('catalog.push'),
      icon: 'ArrowUpTrayIcon',
      fields: [
        {
          key: 'catalog.autoPushNew',
          type: 'toggle',
          labelKey: label('catalog.autoPushNew'),
          helpKey: help('catalog.autoPushNew'),
          default: false,
        },
        {
          key: 'catalog.updateMode',
          type: 'radioGroup',
          labelKey: label('catalog.updateMode'),
          helpKey: help('catalog.updateMode'),
          default: 'partial',
          options: opts('catalog.updateMode', ['full', 'partial']),
          colSpan: 2,
        },
        {
          key: 'catalog.requireApproval',
          type: 'toggle',
          labelKey: label('catalog.requireApproval'),
          default: true,
        },
      ],
    },
    {
      id: 'catalog.content',
      titleKey: sectionTitle('catalog.content'),
      icon: 'DocumentTextIcon',
      fields: [
        {
          key: 'catalog.titleTemplate',
          type: 'text',
          labelKey: label('catalog.titleTemplate'),
          helpKey: help('catalog.titleTemplate'),
          default: '{brand} {name}',
          maxLength: 120,
          colSpan: 2,
        },
        {
          key: 'catalog.descriptionSource',
          type: 'select',
          labelKey: label('catalog.descriptionSource'),
          default: 'long',
          options: opts('catalog.descriptionSource', ['long', 'short', 'custom']),
        },
        {
          key: 'catalog.stripHtml',
          type: 'toggle',
          labelKey: label('catalog.stripHtml'),
          default: false,
        },
        {
          key: 'catalog.barcodeSource',
          type: 'select',
          labelKey: label('catalog.barcodeSource'),
          default: 'barcode',
          options: opts('catalog.barcodeSource', ['barcode', 'sku', 'gtin']),
        },
        {
          key: 'catalog.imageOrder',
          type: 'select',
          labelKey: label('catalog.imageOrder'),
          default: 'default',
          options: opts('catalog.imageOrder', ['default', 'mainFirst', 'custom']),
        },
        {
          key: 'catalog.maxImages',
          type: 'number',
          labelKey: label('catalog.maxImages'),
          default: 8,
          min: 1,
          max: 20,
        },
      ],
    },
    {
      id: 'catalog.defaults',
      titleKey: sectionTitle('catalog.defaults'),
      descriptionKey: sectionDesc('catalog.defaults'),
      icon: 'Square3Stack3DIcon',
      fields: [
        {
          key: 'catalog.defaultBrandId',
          type: 'resourceSelect',
          labelKey: label('catalog.defaultBrandId'),
          helpKey: help('catalog.defaultBrandId'),
          optionsSource: { endpoint: '/brands', valueField: 'id', labelField: 'name' },
        },
        {
          key: 'catalog.defaultCategoryId',
          type: 'resourceSelect',
          labelKey: label('catalog.defaultCategoryId'),
          helpKey: help('catalog.defaultCategoryId'),
          optionsSource: { endpoint: '/categories', valueField: 'id', labelField: 'name' },
        },
        {
          key: 'catalog.missingAttributePolicy',
          type: 'radioGroup',
          labelKey: label('catalog.missingAttributePolicy'),
          default: 'warn',
          options: opts('catalog.missingAttributePolicy', ['block', 'warn', 'useDefault']),
          colSpan: 2,
        },
      ],
    },
  ],
};

// ------------------------------------------------------------------ Tab: stock

const stockTab: SettingsTab = {
  id: 'stock',
  titleKey: tabTitle('stock'),
  icon: 'CubeIcon',
  requiresCapability: 'stock.push',
  sections: [
    {
      id: 'stock.source',
      titleKey: sectionTitle('stock.source'),
      descriptionKey: sectionDesc('stock.source'),
      icon: 'BuildingStorefrontIcon',
      fields: [
        {
          key: 'stock.source',
          type: 'radioGroup',
          labelKey: label('stock.source'),
          default: 'allWarehouses',
          required: true,
          options: opts('stock.source', ['allWarehouses', 'selected', 'allocationRule']),
          colSpan: 2,
        },
        {
          key: 'stock.warehouseIds',
          type: 'multiselect',
          labelKey: label('stock.warehouseIds'),
          helpKey: help('stock.warehouseIds'),
          optionsSource: { endpoint: '/warehouses', valueField: 'id', labelField: 'name' },
          visibleWhen: { field: 'stock.source', op: 'eq', value: 'selected' },
          colSpan: 2,
        },
        {
          key: 'stock.allocationRuleId',
          type: 'resourceSelect',
          labelKey: label('stock.allocationRuleId'),
          helpKey: help('stock.allocationRuleId'),
          optionsSource: {
            endpoint: '/warehouse-settings/stock-allocation',
            valueField: 'id',
            labelField: 'name',
          },
          visibleWhen: { field: 'stock.source', op: 'eq', value: 'allocationRule' },
          colSpan: 2,
        },
      ],
    },
    {
      id: 'stock.policy',
      titleKey: sectionTitle('stock.policy'),
      descriptionKey: sectionDesc('stock.policy'),
      icon: 'ShieldCheckIcon',
      fields: [
        {
          key: 'stock.bufferQuantity',
          type: 'number',
          labelKey: label('stock.bufferQuantity'),
          helpKey: help('stock.bufferQuantity'),
          default: 0,
          min: 0,
          unitKey: `${I}.units.pieces`,
        },
        {
          key: 'stock.bufferPercent',
          type: 'percent',
          labelKey: label('stock.bufferPercent'),
          helpKey: help('stock.bufferPercent'),
          default: 0,
          min: 0,
          max: 100,
        },
        {
          key: 'stock.maxCap',
          type: 'number',
          labelKey: label('stock.maxCap'),
          helpKey: help('stock.maxCap'),
          min: 0,
          unitKey: `${I}.units.pieces`,
        },
        {
          key: 'stock.minThreshold',
          type: 'number',
          labelKey: label('stock.minThreshold'),
          helpKey: help('stock.minThreshold'),
          default: 1,
          min: 0,
          unitKey: `${I}.units.pieces`,
        },
        {
          key: 'stock.oversellProtection',
          type: 'toggle',
          labelKey: label('stock.oversellProtection'),
          helpKey: help('stock.oversellProtection'),
          default: true,
          colSpan: 2,
        },
      ],
    },
    {
      id: 'stock.timing',
      titleKey: sectionTitle('stock.timing'),
      icon: 'ClockIcon',
      fields: [
        intervalField('stock.pushIntervalMinutes', '15'),
        {
          key: 'stock.realtimeOnOrder',
          type: 'toggle',
          labelKey: label('stock.realtimeOnOrder'),
          helpKey: help('stock.realtimeOnOrder'),
          default: true,
        },
        {
          key: 'stock.batchSize',
          type: 'number',
          labelKey: label('stock.batchSize'),
          helpKey: help('stock.batchSize'),
          default: 200,
          min: 1,
          max: 5000,
        },
      ],
    },
    {
      id: 'stock.zero',
      titleKey: sectionTitle('stock.zero'),
      descriptionKey: sectionDesc('stock.zero'),
      icon: 'ExclamationTriangleIcon',
      fields: [
        {
          key: 'stock.onZeroAction',
          type: 'radioGroup',
          labelKey: label('stock.onZeroAction'),
          default: 'sendZero',
          options: opts('stock.onZeroAction', ['sendZero', 'deactivateListing', 'ignore']),
          colSpan: 2,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- Tab: pricing

const pricingTab: SettingsTab = {
  id: 'pricing',
  titleKey: tabTitle('pricing'),
  icon: 'BanknotesIcon',
  requiresCapability: 'price.push',
  sections: [
    {
      id: 'pricing.source',
      titleKey: sectionTitle('pricing.source'),
      descriptionKey: sectionDesc('pricing.source'),
      icon: 'CurrencyDollarIcon',
      fields: [
        {
          key: 'pricing.priceListId',
          type: 'resourceSelect',
          labelKey: label('pricing.priceListId'),
          helpKey: help('pricing.priceListId'),
          optionsSource: { endpoint: '/price-lists', valueField: 'id', labelField: 'name' },
        },
        {
          key: 'pricing.basePriceField',
          type: 'select',
          labelKey: label('pricing.basePriceField'),
          default: 'salePrice',
          required: true,
          options: opts('pricing.basePriceField', ['salePrice', 'listPrice', 'campaignPrice']),
        },
        {
          key: 'pricing.vatIncluded',
          type: 'toggle',
          labelKey: label('pricing.vatIncluded'),
          default: true,
        },
      ],
    },
    {
      id: 'pricing.markup',
      titleKey: sectionTitle('pricing.markup'),
      descriptionKey: sectionDesc('pricing.markup'),
      icon: 'ArrowTrendingUpIcon',
      fields: [
        {
          key: 'pricing.markupType',
          type: 'radioGroup',
          labelKey: label('pricing.markupType'),
          default: 'none',
          options: opts('pricing.markupType', ['none', 'percent', 'fixed']),
          colSpan: 2,
        },
        {
          key: 'pricing.markupValue',
          type: 'number',
          labelKey: label('pricing.markupValue'),
          default: 0,
          min: 0,
          visibleWhen: { field: 'pricing.markupType', op: 'neq', value: 'none' },
        },
        {
          key: 'pricing.rounding',
          type: 'select',
          labelKey: label('pricing.rounding'),
          helpKey: help('pricing.rounding'),
          default: 'none',
          options: opts('pricing.rounding', ['none', 'x99', 'x90', 'nearest1', 'nearest5']),
        },
        {
          key: 'pricing.floorPrice',
          type: 'money',
          labelKey: label('pricing.floorPrice'),
          helpKey: help('pricing.floorPrice'),
          min: 0,
        },
        {
          key: 'pricing.ceilPrice',
          type: 'money',
          labelKey: label('pricing.ceilPrice'),
          helpKey: help('pricing.ceilPrice'),
          min: 0,
        },
      ],
    },
    {
      id: 'pricing.margin',
      titleKey: sectionTitle('pricing.margin'),
      icon: 'CalculatorIcon',
      fields: [
        {
          key: 'pricing.commissionRate',
          type: 'percent',
          labelKey: label('pricing.commissionRate'),
          helpKey: help('pricing.commissionRate'),
          min: 0,
          max: 100,
          readOnly: true,
          requiresCapability: 'commission.read',
        },
        {
          key: 'pricing.minMarginPercent',
          type: 'percent',
          labelKey: label('pricing.minMarginPercent'),
          default: 0,
          min: 0,
          max: 100,
        },
        {
          key: 'pricing.blockBelowMargin',
          type: 'toggle',
          labelKey: label('pricing.blockBelowMargin'),
          helpKey: help('pricing.blockBelowMargin'),
          default: true,
          colSpan: 2,
        },
      ],
    },
    {
      id: 'pricing.timing',
      titleKey: sectionTitle('pricing.timing'),
      icon: 'ClockIcon',
      fields: [
        intervalField('pricing.pushIntervalMinutes', '60'),
        {
          key: 'pricing.requireApprovalOnDrop',
          type: 'toggle',
          labelKey: label('pricing.requireApprovalOnDrop'),
          helpKey: help('pricing.requireApprovalOnDrop'),
          default: true,
        },
        {
          key: 'pricing.approvalDropPercent',
          type: 'percent',
          labelKey: label('pricing.approvalDropPercent'),
          default: 20,
          min: 1,
          max: 100,
          visibleWhen: { field: 'pricing.requireApprovalOnDrop', op: 'truthy' },
        },
      ],
    },
  ],
};

// ------------------------------------------------------------ Tab: fulfillment

const fulfillmentTab: SettingsTab = {
  id: 'fulfillment',
  titleKey: tabTitle('fulfillment'),
  icon: 'TruckIcon',
  sections: [
    {
      id: 'fulfillment.model',
      titleKey: sectionTitle('fulfillment.model'),
      descriptionKey: sectionDesc('fulfillment.model'),
      icon: 'BuildingOffice2Icon',
      fields: [
        {
          key: 'fulfillment.model',
          type: 'radioGroup',
          labelKey: label('fulfillment.model'),
          default: 'seller',
          required: true,
          options: opts('fulfillment.model', ['seller', 'marketplace']),
          colSpan: 2,
        },
      ],
    },
    {
      id: 'fulfillment.carrier',
      titleKey: sectionTitle('fulfillment.carrier'),
      icon: 'ArrowsRightLeftIcon',
      visibleWhen: { field: 'fulfillment.model', op: 'eq', value: 'seller' },
      fields: [
        {
          key: 'fulfillment.carrierMap',
          type: 'mappingTable',
          labelKey: label('fulfillment.carrierMap'),
          colSpan: 2,
          mapping: {
            leftLabelKey: `${I}.mapping.marketplaceCarrier`,
            rightLabelKey: `${I}.mapping.kroptosCarrier`,
            leftSource: opts('fulfillment.marketplaceCarrier', [
              'yurtici',
              'aras',
              'mng',
              'ptt',
              'surat',
              'ups',
            ]),
            rightSource: {
              endpoint: '/integrations',
              valueField: 'id',
              labelField: 'name',
              params: { providerType: 'shipping' },
            },
            allowUnmapped: true,
          },
        },
        {
          key: 'fulfillment.defaultCarrierId',
          type: 'resourceSelect',
          labelKey: label('fulfillment.defaultCarrierId'),
          helpKey: help('fulfillment.defaultCarrierId'),
          optionsSource: {
            endpoint: '/integrations',
            valueField: 'id',
            labelField: 'name',
            params: { providerType: 'shipping' },
          },
        },
      ],
    },
    {
      id: 'fulfillment.timing',
      titleKey: sectionTitle('fulfillment.timing'),
      icon: 'ClockIcon',
      fields: [
        {
          key: 'fulfillment.handlingDays',
          type: 'number',
          labelKey: label('fulfillment.handlingDays'),
          helpKey: help('fulfillment.handlingDays'),
          default: 1,
          min: 0,
          max: 30,
          unitKey: `${I}.units.days`,
        },
        {
          key: 'fulfillment.cutoffTime',
          type: 'time',
          labelKey: label('fulfillment.cutoffTime'),
          helpKey: help('fulfillment.cutoffTime'),
          default: '16:00',
        },
        {
          key: 'fulfillment.workingDays',
          type: 'weekdays',
          labelKey: label('fulfillment.workingDays'),
          default: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
          colSpan: 2,
        },
      ],
    },
    {
      id: 'fulfillment.label',
      titleKey: sectionTitle('fulfillment.label'),
      icon: 'PrinterIcon',
      fields: [
        {
          key: 'fulfillment.labelSource',
          type: 'radioGroup',
          labelKey: label('fulfillment.labelSource'),
          default: 'marketplace',
          options: opts('fulfillment.labelSource', ['marketplace', 'carrier', 'kroptos']),
          requiresCapability: 'shipment.label',
          colSpan: 2,
        },
        {
          key: 'fulfillment.autoPrintLabel',
          type: 'toggle',
          labelKey: label('fulfillment.autoPrintLabel'),
          default: false,
        },
        {
          key: 'fulfillment.packageWeightSource',
          type: 'select',
          labelKey: label('fulfillment.packageWeightSource'),
          default: 'product',
          options: opts('fulfillment.packageWeightSource', ['product', 'fixed', 'calculated']),
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- Tab: returns

const returnsTab: SettingsTab = {
  id: 'returns',
  titleKey: tabTitle('returns'),
  icon: 'ArrowUturnLeftIcon',
  requiresCapability: 'returns.read',
  sections: [
    {
      id: 'returns.import',
      titleKey: sectionTitle('returns.import'),
      descriptionKey: sectionDesc('returns.import'),
      icon: 'InboxArrowDownIcon',
      fields: [
        {
          key: 'returns.autoImport',
          type: 'toggle',
          labelKey: label('returns.autoImport'),
          default: true,
        },
        {
          ...intervalField('returns.intervalMinutes', '60'),
          visibleWhen: { field: 'returns.autoImport', op: 'truthy' },
        },
        {
          key: 'returns.autoApproveUnderAmount',
          type: 'money',
          labelKey: label('returns.autoApproveUnderAmount'),
          helpKey: help('returns.autoApproveUnderAmount'),
          default: 0,
          min: 0,
        },
        {
          key: 'returns.restockOnApproval',
          type: 'toggle',
          labelKey: label('returns.restockOnApproval'),
          default: true,
        },
        {
          key: 'returns.restockWarehouseId',
          type: 'resourceSelect',
          labelKey: label('returns.restockWarehouseId'),
          optionsSource: { endpoint: '/warehouses', valueField: 'id', labelField: 'name' },
          visibleWhen: { field: 'returns.restockOnApproval', op: 'truthy' },
        },
        {
          key: 'returns.refundMode',
          type: 'radioGroup',
          labelKey: label('returns.refundMode'),
          default: 'manual',
          options: opts('returns.refundMode', ['auto', 'manual']),
          colSpan: 2,
        },
      ],
    },
  ],
};

// -------------------------------------------------------------- Tab: invoicing

const invoicingTab: SettingsTab = {
  id: 'invoicing',
  titleKey: tabTitle('invoicing'),
  icon: 'DocumentTextIcon',
  sections: [
    {
      id: 'invoicing.general',
      titleKey: sectionTitle('invoicing.general'),
      descriptionKey: sectionDesc('invoicing.general'),
      icon: 'DocumentDuplicateIcon',
      fields: [
        {
          key: 'invoicing.autoInvoice',
          type: 'toggle',
          labelKey: label('invoicing.autoInvoice'),
          helpKey: help('invoicing.autoInvoice'),
          default: false,
        },
        {
          key: 'invoicing.erpIntegrationId',
          type: 'resourceSelect',
          labelKey: label('invoicing.erpIntegrationId'),
          helpKey: help('invoicing.erpIntegrationId'),
          optionsSource: {
            endpoint: '/integrations',
            valueField: 'id',
            labelField: 'name',
            params: { providerType: 'erp' },
          },
          visibleWhen: { field: 'invoicing.autoInvoice', op: 'truthy' },
        },
        {
          key: 'invoicing.invoiceType',
          type: 'select',
          labelKey: label('invoicing.invoiceType'),
          default: 'e-archive',
          options: opts('invoicing.invoiceType', ['e-archive', 'e-invoice']),
        },
        {
          key: 'invoicing.trigger',
          type: 'radioGroup',
          labelKey: label('invoicing.trigger'),
          default: 'onShip',
          options: opts('invoicing.trigger', ['onOrder', 'onShip', 'onDeliver']),
          colSpan: 2,
        },
        {
          key: 'invoicing.uploadToMarketplace',
          type: 'toggle',
          labelKey: label('invoicing.uploadToMarketplace'),
          default: true,
          requiresCapability: 'invoice.upload',
        },
        {
          key: 'invoicing.seriesPrefix',
          type: 'text',
          labelKey: label('invoicing.seriesPrefix'),
          helpKey: help('invoicing.seriesPrefix'),
          maxLength: 8,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------- Tab: notifications

const notificationsTab: SettingsTab = {
  id: 'notifications',
  titleKey: tabTitle('notifications'),
  icon: 'BellIcon',
  sections: [
    {
      id: 'notifications.channels',
      titleKey: sectionTitle('notifications.channels'),
      descriptionKey: sectionDesc('notifications.channels'),
      icon: 'MegaphoneIcon',
      fields: [
        {
          key: 'notifications.channels',
          type: 'multiselect',
          labelKey: label('notifications.channels'),
          default: ['inApp'],
          options: opts('notifications.channels', ['inApp', 'email', 'slack', 'webhook']),
          colSpan: 2,
        },
        {
          key: 'notifications.emails',
          type: 'tags',
          labelKey: label('notifications.emails'),
          helpKey: help('notifications.emails'),
          visibleWhen: { field: 'notifications.channels', op: 'contains', value: 'email' },
          colSpan: 2,
        },
        {
          key: 'notifications.webhookUrl',
          type: 'text',
          labelKey: label('notifications.webhookUrl'),
          placeholderKey: placeholder('notifications.webhookUrl'),
          pattern: '^https://.+',
          visibleWhen: { field: 'notifications.channels', op: 'contains', value: 'webhook' },
        },
        {
          key: 'notifications.webhookSecret',
          type: 'password',
          labelKey: label('notifications.webhookSecret'),
          helpKey: help('notifications.webhookSecret'),
          secret: true,
          visibleWhen: { field: 'notifications.channels', op: 'contains', value: 'webhook' },
        },
      ],
    },
    {
      id: 'notifications.events',
      titleKey: sectionTitle('notifications.events'),
      icon: 'FlagIcon',
      fields: [
        {
          key: 'notifications.events',
          type: 'multiselect',
          labelKey: label('notifications.events'),
          default: ['syncFailed', 'authFailed'],
          options: opts('notifications.events', [
            'syncFailed',
            'authFailed',
            'stockMismatch',
            'priceBlocked',
            'newOrder',
          ]),
          colSpan: 2,
        },
      ],
    },
    {
      id: 'notifications.retry',
      titleKey: sectionTitle('notifications.retry'),
      icon: 'ArrowPathIcon',
      fields: [
        {
          key: 'notifications.maxRetry',
          type: 'number',
          labelKey: label('notifications.maxRetry'),
          default: 3,
          min: 0,
          max: 10,
        },
        {
          key: 'notifications.backoffStrategy',
          type: 'select',
          labelKey: label('notifications.backoffStrategy'),
          default: 'exponential',
          options: opts('notifications.backoffStrategy', ['fixed', 'linear', 'exponential']),
        },
        {
          key: 'notifications.pauseOnCritical',
          type: 'toggle',
          labelKey: label('notifications.pauseOnCritical'),
          helpKey: help('notifications.pauseOnCritical'),
          default: true,
          colSpan: 2,
        },
      ],
    },
  ],
};

// --------------------------------------------------------------- Tab: advanced

const advancedTab: SettingsTab = {
  id: 'advanced',
  titleKey: tabTitle('advanced'),
  icon: 'WrenchScrewdriverIcon',
  sections: [
    {
      id: 'advanced.runtime',
      titleKey: sectionTitle('advanced.runtime'),
      descriptionKey: sectionDesc('advanced.runtime'),
      icon: 'CpuChipIcon',
      collapsedByDefault: true,
      fields: [
        {
          key: 'advanced.dryRun',
          type: 'toggle',
          labelKey: label('advanced.dryRun'),
          helpKey: help('advanced.dryRun'),
          default: false,
          colSpan: 2,
        },
        {
          key: 'advanced.rateLimitPerMinute',
          type: 'number',
          labelKey: label('advanced.rateLimitPerMinute'),
          helpKey: help('advanced.rateLimitPerMinute'),
          default: 60,
          min: 1,
          max: 6000,
        },
        {
          key: 'advanced.requestTimeoutMs',
          type: 'number',
          labelKey: label('advanced.requestTimeoutMs'),
          default: 30000,
          min: 1000,
          max: 120000,
        },
        {
          key: 'advanced.concurrency',
          type: 'number',
          labelKey: label('advanced.concurrency'),
          helpKey: help('advanced.concurrency'),
          default: 3,
          min: 1,
          max: 20,
        },
        {
          key: 'advanced.logLevel',
          type: 'select',
          labelKey: label('advanced.logLevel'),
          default: 'info',
          options: opts('advanced.logLevel', ['debug', 'info', 'warn', 'error']),
        },
        {
          key: 'advanced.logRetentionDays',
          type: 'number',
          labelKey: label('advanced.logRetentionDays'),
          default: 30,
          min: 1,
          max: 365,
          unitKey: `${I}.units.days`,
        },
        {
          key: 'advanced.customHeaders',
          type: 'keyValue',
          labelKey: label('advanced.customHeaders'),
          helpKey: help('advanced.customHeaders'),
          badgeKey: 'advanced',
          colSpan: 2,
        },
      ],
    },
  ],
};

// ------------------------------------------------------------------- Assembled

export const BASE_TABS: SettingsTab[] = [
  generalTab,
  ordersTab,
  catalogTab,
  stockTab,
  pricingTab,
  fulfillmentTab,
  returnsTab,
  invoicingTab,
  notificationsTab,
  advancedTab,
];

export const BASE_WIZARD: SettingsWizardStep[] = [
  {
    id: 'stock',
    titleKey: stepTitle('stock'),
    descriptionKey: stepDesc('stock'),
    tabId: 'stock',
    required: true,
  },
  {
    id: 'pricing',
    titleKey: stepTitle('pricing'),
    descriptionKey: stepDesc('pricing'),
    tabId: 'pricing',
    required: true,
  },
  {
    id: 'orders',
    titleKey: stepTitle('orders'),
    descriptionKey: stepDesc('orders'),
    tabId: 'orders',
    required: true,
  },
  {
    id: 'fulfillment',
    titleKey: stepTitle('fulfillment'),
    descriptionKey: stepDesc('fulfillment'),
    tabId: 'fulfillment',
    required: true,
  },
  {
    id: 'invoicing',
    titleKey: stepTitle('invoicing'),
    descriptionKey: stepDesc('invoicing'),
    tabId: 'invoicing',
    required: false,
  },
  {
    id: 'notifications',
    titleKey: stepTitle('notifications'),
    descriptionKey: stepDesc('notifications'),
    tabId: 'notifications',
    required: false,
  },
];

/**
 * Rules a single field cannot express. Kept declarative so the validator stays
 * generic — adding a rule never means adding a branch.
 */
export const BASE_CROSS_RULES: SettingsCrossRule[] = [
  {
    id: 'warehouseRequired',
    when: [{ field: 'stock.source', op: 'eq', value: 'selected' }],
    requiresNonEmptyArray: 'stock.warehouseIds',
    messageKey: `${I}.validation.warehouseRequired`,
  },
  {
    id: 'floorAboveCeil',
    when: [],
    lte: ['pricing.floorPrice', 'pricing.ceilPrice'],
    messageKey: `${I}.validation.floorAboveCeil`,
    errorKey: 'pricing.floorPrice',
  },
  {
    id: 'markupValueRequired',
    when: [{ field: 'pricing.markupType', op: 'neq', value: 'none' }],
    positive: 'pricing.markupValue',
    messageKey: `${I}.validation.markupValueRequired`,
  },
  {
    id: 'erpRequired',
    when: [{ field: 'invoicing.autoInvoice', op: 'truthy' }],
    requires: 'invoicing.erpIntegrationId',
    messageKey: `${I}.validation.erpRequired`,
  },
  {
    id: 'webhookUrlRequired',
    when: [{ field: 'notifications.channels', op: 'contains', value: 'webhook' }],
    requires: 'notifications.webhookUrl',
    matches: { key: 'notifications.webhookUrl', pattern: '^https://.+' },
    messageKey: `${I}.validation.webhookUrlRequired`,
  },
  {
    id: 'statusRequired',
    when: [{ field: 'orders.autoImport', op: 'truthy' }],
    requiresNonEmptyArray: 'orders.importStatuses',
    messageKey: `${I}.validation.statusRequired`,
  },
];

export const BASE_MANIFEST: ProviderSettingsManifest = {
  provider: 'base',
  displayName: 'Marketplace',
  version: 1,
  capabilities: [],
  credentials: [],
  tabs: BASE_TABS,
  wizard: BASE_WIZARD,
  crossRules: BASE_CROSS_RULES,
};

export const SETTINGS_I18N_PREFIX = I;
