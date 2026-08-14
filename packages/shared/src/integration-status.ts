/**
 * The canonical status set for an `Integration` row.
 *
 * These are the only values the backend ever writes:
 *   - `active`   — `create()` (integration.service.ts), a passing
 *                  `testConnection()`, and a sync run that clears a prior error
 *   - `error`    — a failing `testConnection()` or a failed sync job
 *   - `inactive` — `delete()` (soft delete), and the user's pause switch
 *
 * Deliberately NOT included: `pending`. No code path writes it, and a value
 * that only exists in a type is a value every consumer has to handle for no
 * reason. Add it here the day something actually persists it.
 */
export const INTEGRATION_STATUSES = ['active', 'error', 'inactive'] as const;

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

/**
 * Narrows a value read from the database or an API response. Status is stored
 * as a plain string column, so nothing in the type system guarantees a row
 * holds one of the values above — callers that need the union must check.
 */
export function isIntegrationStatus(value: unknown): value is IntegrationStatus {
  return typeof value === 'string' && (INTEGRATION_STATUSES as readonly string[]).includes(value);
}
