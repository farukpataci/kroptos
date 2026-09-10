import { BadRequestException } from '@nestjs/common';
import { OdooAllowlistValidator, ODOO_ALLOWED_CALLS } from './odoo.allowlist';

describe('Odoo Allowlist Security Boundary (§5.1, §8.5, §8.6)', () => {
  it('allows safe model and method combinations', () => {
    expect(() => OdooAllowlistValidator.assertAllowed('account.move', 'create')).not.toThrow();
    expect(() => OdooAllowlistValidator.assertAllowed('account.move', 'action_post')).not.toThrow();
    expect(() => OdooAllowlistValidator.assertAllowed('res.partner', 'search_read')).not.toThrow();
    expect(() => OdooAllowlistValidator.assertAllowed('product.product', 'fields_get')).not.toThrow();
    expect(() => OdooAllowlistValidator.assertAllowed('account.payment', 'action_post')).not.toThrow();
  });

  it('rejects destructive or non-allowlisted methods on allowed models', () => {
    // unlink is strictly forbidden to prevent accidental data deletion
    expect(() => OdooAllowlistValidator.assertAllowed('account.move', 'unlink')).toThrow(BadRequestException);
    expect(() => OdooAllowlistValidator.assertAllowed('res.partner', 'unlink')).toThrow(BadRequestException);
    expect(() => OdooAllowlistValidator.assertAllowed('product.product', 'write_many')).toThrow(BadRequestException);
  });

  it('rejects completely forbidden models', () => {
    expect(() => OdooAllowlistValidator.assertAllowed('ir.model', 'search_read')).toThrow(BadRequestException);
    expect(() => OdooAllowlistValidator.assertAllowed('res.users', 'write')).toThrow(BadRequestException);
    expect(() => OdooAllowlistValidator.assertAllowed('ir.config_parameter', 'read')).toThrow(BadRequestException);
    expect(() => OdooAllowlistValidator.assertAllowed('database.drop', 'execute')).toThrow(BadRequestException);
  });

  it('verifies that allowlist is frozen and narrow', () => {
    const models = Object.keys(ODOO_ALLOWED_CALLS);
    expect(models).toEqual(
      expect.arrayContaining([
        'res.company',
        'res.partner',
        'product.product',
        'account.tax',
        'account.journal',
        'account.move',
        'account.move.line',
        'account.payment',
      ]),
    );
    expect(models.length).toBe(8);
  });
});
