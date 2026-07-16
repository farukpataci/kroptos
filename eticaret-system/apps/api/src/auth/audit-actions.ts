export const AUDIT_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  TENANT_SWITCH: 'tenant_switch',
  ROLE_CHANGE: 'role_change',
  API_KEY_CREATE: 'api_key_create',
  API_KEY_REVOKE: 'api_key_revoke',
  PRODUCT_CREATE: 'product_create',
  PRODUCT_UPDATE: 'product_update',
  PRODUCT_DELETE: 'product_delete',
  ORDER_UPDATE: 'order_update',
  INTEGRATION_CREATE: 'integration_create',
  INTEGRATION_UPDATE: 'integration_update',
  INTEGRATION_DELETE: 'integration_delete',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
