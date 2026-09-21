import { allSystemTemplates } from './defaults';
import { htmlToText, render, smsSegments, validateTemplate } from './renderer';
import { sampleContext } from './variables';

describe('renderer.validateTemplate', () => {
  it('accepts known variables, helpers and each over order.items', () => {
    const src = '{{customer.firstName}} {{formatCurrency order.total order.currency}} {{#each order.items}}{{name}} x{{quantity}} {{../order.number}}{{/each}}{{#if shipment.trackingNumber}}ok{{/if}}';
    expect(validateTemplate(src, 'ORDER_SHIPPED')).toEqual([]);
  });

  it('reports unknown variables with line numbers', () => {
    const issues = validateTemplate('Merhaba\n{{customer.nickname}}', 'ORDER_CREATED');
    expect(issues).toEqual([{ line: 2, message: 'Bilinmeyen değişken: customer.nickname', variable: 'customer.nickname' }]);
  });

  it('rejects a variable that only exists for another event', () => {
    expect(validateTemplate('{{shipment.trackingNumber}}', 'ORDER_CREATED')).toHaveLength(1);
    expect(validateTemplate('{{shipment.trackingNumber}}', 'ORDER_SHIPPED')).toHaveLength(0);
  });

  it('reports syntax errors and forbidden constructs', () => {
    expect(validateTemplate('{{#if order.number}}', 'ORDER_CREATED')[0].message).toMatch(/Parse error|Expecting/);
    expect(validateTemplate('{{{order.number}}}', 'ORDER_CREATED')[0].message).toMatch(/Üçlü bıyık/);
    expect(validateTemplate('{{lookup order 0}}', 'ORDER_CREATED')[0].message).toMatch(/izinli değil/);
    expect(validateTemplate('{{> header}}', 'ORDER_CREATED')[0].message).toMatch(/Partial/);
  });

  it('every system default template validates against its own event', () => {
    for (const t of allSystemTemplates()) {
      for (const src of [t.subject, t.bodyHtml, t.bodyText]) {
        if (src) expect({ id: t.id, issues: validateTemplate(src, t.event) }).toEqual({ id: t.id, issues: [] });
      }
    }
  });
});

describe('renderer.render', () => {
  it('escapes HTML and formats currency', () => {
    const out = render('{{customer.fullName}} {{formatCurrency order.total order.currency}}', { ...sampleContext('ORDER_CREATED'), customer: { fullName: '<b>x</b>' } });
    expect(out).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(out).toMatch(/1\.249,90/);
  });

  it('htmlToText strips tags and keeps line breaks', () => {
    expect(htmlToText('<p>Merhaba</p><p>Sipariş <strong>1</strong></p>')).toBe('Merhaba\nSipariş 1');
  });
});

describe('renderer.smsSegments', () => {
  it('GSM-7: 160 in one segment, 161 in two', () => {
    expect(smsSegments('a'.repeat(160))).toEqual({ charCount: 160, segments: 1, encoding: 'GSM-7' });
    expect(smsSegments('a'.repeat(161))).toEqual({ charCount: 161, segments: 2, encoding: 'GSM-7' });
    expect(smsSegments('a'.repeat(306))).toEqual({ charCount: 306, segments: 2, encoding: 'GSM-7' });
    expect(smsSegments('a'.repeat(307)).segments).toBe(3);
  });

  it('ö/ü stay GSM-7, ç/ğ/ı/ş force UCS-2 (70/67)', () => {
    expect(smsSegments('gönderüldü').encoding).toBe('GSM-7');
    expect(smsSegments('ş'.repeat(70))).toEqual({ charCount: 70, segments: 1, encoding: 'UCS-2' });
    expect(smsSegments('ı'.repeat(71)).segments).toBe(2);
    expect(smsSegments('ğ'.repeat(134)).segments).toBe(2);
    expect(smsSegments('ç'.repeat(135)).segments).toBe(3);
  });

  it('extension characters count double', () => {
    expect(smsSegments('€').charCount).toBe(2);
    expect(smsSegments('')).toEqual({ charCount: 0, segments: 0, encoding: 'GSM-7' });
  });
});
