import { BadRequestException } from '@nestjs/common';

/**
 * Odoo Method Allowlist (§5.1)
 *
 * Security Boundary:
 * Odoo exposes remote ORM method execution over RPC.
 * To prevent remote execution of arbitrary methods (e.g. unlink, execute_kw on arbitrary tables),
 * every remote call MUST be matched against this strictly hardcoded allowlist.
 *
 * Model and method names MUST NEVER be constructed from user input, DTO, settings, or database records.
 */

export const ODOO_ALLOWED_CALLS: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  'res.company': new Set(['search_read', 'read', 'fields_get']),
  'res.partner': new Set(['search_read', 'read', 'create', 'write', 'fields_get']),
  'product.product': new Set(['search_read', 'read', 'create', 'write', 'fields_get']),
  'account.tax': new Set(['search_read', 'read', 'fields_get']),
  'account.journal': new Set(['search_read', 'read', 'fields_get']),
  'account.move': new Set([
    'search_read',
    'read',
    'create',
    'write',
    'action_post',
    'button_cancel',
    'action_reverse',
    'fields_get',
  ]),
  'account.move.line': new Set(['search_read', 'read', 'create', 'write', 'fields_get']),
  'account.payment': new Set(['search_read', 'read', 'create', 'write', 'action_post', 'fields_get']),
});

export class OdooAllowlistValidator {
  /**
   * Validates if a model and method combination is permitted.
   * Throws BadRequestException if not in the allowlist.
   */
  static assertAllowed(model: string, method: string): void {
    const allowedMethods = ODOO_ALLOWED_CALLS[model];
    if (!allowedMethods || !allowedMethods.has(method)) {
      throw new BadRequestException(
        `[Odoo Security] Çağrı izin listesinde (allowlist) yer almıyor: (${model}, ${method}). Ağ isteği durduruldu.`,
      );
    }
  }

  /**
   * Returns whether a combination is allowed without throwing.
   */
  static isAllowed(model: string, method: string): boolean {
    const allowedMethods = ODOO_ALLOWED_CALLS[model];
    return !!allowedMethods && allowedMethods.has(method);
  }
}
