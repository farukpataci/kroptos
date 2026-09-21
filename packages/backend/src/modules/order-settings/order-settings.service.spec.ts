import { OrderNumberService } from './services/order-number.service';
import { ORDER_SETTINGS_REGISTRY } from './registry/order-settings.registry';
import { mapValuesToOrderSettingsDto } from './dto/order-settings.dto';

describe('OrderSettings Registry & Logic', () => {
  it('should have all 11 sections defined in the registry', () => {
    const sections = new Set(ORDER_SETTINGS_REGISTRY.map((r) => r.section));
    expect(sections.has('general')).toBe(true);
    expect(sections.has('numbering')).toBe(true);
    expect(sections.has('flow')).toBe(true);
    expect(sections.has('stock')).toBe(true);
    expect(sections.has('payment')).toBe(true);
    expect(sections.has('shipping')).toBe(true);
    expect(sections.has('invoice')).toBe(true);
    expect(sections.has('returns')).toBe(true);
    expect(sections.has('risk')).toBe(true);
    expect(sections.has('checkout')).toBe(true);
    expect(sections.has('retention')).toBe(true);
    expect(sections.size).toBe(11);
  });

  it('should enforce consumer protection minimum 14 days on return window', () => {
    const returnWindowDef = ORDER_SETTINGS_REGISTRY.find(
      (r) => r.key === 'order.returns.windowDays',
    );
    expect(returnWindowDef).toBeDefined();
    expect(returnWindowDef?.default).toBeGreaterThanOrEqual(14);
    expect(returnWindowDef?.validation?.min).toBe(14);
  });

  it('should mark numbering, invoice and retention settings as sensitive', () => {
    const numberingDef = ORDER_SETTINGS_REGISTRY.find(
      (r) => r.key === 'order.numbering.pattern',
    );
    const invoiceDef = ORDER_SETTINGS_REGISTRY.find(
      (r) => r.key === 'order.invoice.autoCreateOn',
    );
    const retentionDef = ORDER_SETTINGS_REGISTRY.find(
      (r) => r.key === 'order.retention.notificationLogDays',
    );

    expect(numberingDef?.sensitive).toBe(true);
    expect(invoiceDef?.sensitive).toBe(true);
    expect(retentionDef?.sensitive).toBe(true);
  });

  it('should correctly map values into typed OrderSettingsDto', () => {
    const dto = mapValuesToOrderSettingsDto({
      'order.general.timezone': 'Europe/Istanbul',
      'order.general.currency': 'TRY',
      'order.returns.windowDays': 30,
      'order.cod.fee': 45.5,
    });

    expect(dto.general.timezone).toBe('Europe/Istanbul');
    expect(dto.general.currency).toBe('TRY');
    expect(dto.returns.windowDays).toBe(30);
    expect(dto.cod.fee).toBe(45.5);
    expect(dto.general.pricesIncludeTax).toBe(true); // Default preserved
  });
});

describe('OrderNumberService', () => {
  let service: OrderNumberService;

  beforeEach(() => {
    const mockPrisma = {} as any;
    service = new OrderNumberService(mockPrisma);
  });

  it('should format order numbers with default pattern {PREFIX}-{YYYY}{MM}-{SEQ}', () => {
    const date = new Date(2026, 8, 21); // Sept 21, 2026
    const formatted = service.formatNumber(
      '{PREFIX}-{YYYY}{MM}-{SEQ}',
      'KP',
      '',
      5,
      125,
      date,
    );
    expect(formatted).toBe('KP-202609-00125');
  });

  it('should format order numbers with suffix and 6 digit padding', () => {
    const date = new Date(2026, 0, 15); // Jan 15, 2026
    const formatted = service.formatNumber(
      '{PREFIX}-{YYYY}-{SEQ}-{SUFFIX}',
      'ORD',
      'TR',
      6,
      42,
      date,
    );
    expect(formatted).toBe('ORD-2026-000042-TR');
  });

  it('should gracefully handle empty prefix and suffix without double dashes', () => {
    const date = new Date(2026, 8, 21);
    const formatted = service.formatNumber(
      '{PREFIX}-{YYYY}{MM}-{SEQ}-{SUFFIX}',
      '',
      '',
      4,
      7,
      date,
    );
    expect(formatted).toBe('202609-0007');
  });
});
