# Auth Service

KroptOS auth uses opaque session tokens for multi-tenant API access.

Tenant hierarchy:

```text
Agency
`- Client
   `- Store
```

In API responses and guards, the active tenant is the selected `Store`.

## Endpoints

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
GET  /auth/tenants
POST /auth/select-tenant
```

## Session Flow

Login returns a secure random session token:

```json
{
  "token": "raw-token-only-returned-once",
  "tokenType": "Bearer",
  "expiresAt": "date",
  "availableTenants": []
}
```

Only `SHA-256(token)` is stored in `sessions.tokenHash`; the raw token is never persisted.

Protected requests use:

```text
Authorization: Bearer <token>
```

The session guard rejects missing, expired, revoked, or unknown sessions with `401`.

## Tenant Selection

Users select an active tenant with:

```text
POST /auth/select-tenant
```

```json
{
  "tenantId": "store-id"
}
```

The selected tenant is stored in `sessions.activeTenantId`. Tenant-scoped endpoints return `403` until an active tenant is selected.

## Guards

Nest usage:

```ts
@UseGuards(SessionAuthGuard, TenantGuard)
@Permissions('products.create')
@UseGuards(PermissionGuard)
```

Conceptual layers:

- `requireAuth`: `SessionAuthGuard`
- `requireTenant`: `TenantGuard`
- `requirePermission(permissionName)`: `@Permissions(...)` plus `PermissionGuard`

`owner` and `*` permission bypass granular permission checks.

## Audit Logs

Critical actions are written through the centralized auth audit helper:

- `login`
- `logout`
- `tenant_switch`
- `role_change`
- `api_key_create`
- `api_key_revoke`
- `product_create`
- `product_update`
- `product_delete`
- `order_update`
- `integration_create`
- `integration_update`
- `integration_delete`
