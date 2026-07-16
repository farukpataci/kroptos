# Database

This document tracks database design, schema decisions, migrations, and seed data.

## Local PostgreSQL

The local development database can use the existing PostgreSQL service.

```env
DATABASE_URL=postgresql://postgres:********@localhost:5432/eticaret
```

## Prisma

The Prisma schema lives at:

```text
packages/database/prisma/schema.prisma
```

Useful commands:

```bash
corepack pnpm db:generate
corepack pnpm db:push
corepack pnpm db:studio
```

The API exposes a database health check at:

```text
GET /health/db
```

## Multi-Tenant Auth

The system supports one user having different access levels in different companies.

Example:

```text
Omer
|- Firma A -> Owner
|- Firma B -> Manager
`- Firma C -> Readonly
```

Tenant hierarchy:

```text
Agency
`- Client
   `- Store
```

Core relationship:

```text
users
`- store_users
   |- stores
   |  `- clients
   |     `- agencies
   |- roles
   |  `- role_permissions
   |     `- permissions
```

Auth and control tables:

- `users`: Account identity and password hash.
- `agencies`: Top-level operator account.
- `clients`: Commerce client under an agency.
- `stores`: Storefront under a client.
- `store_users`: User access to a store with one active role.
- `roles`: System roles such as `owner`, `admin`, `manager`, `staff`, `readonly`.
- `permissions`: Global permission keys such as `products.create`.
- `role_permissions`: Role-to-permission assignments.
- `sessions`: Opaque session token hashes, expiry, revoke state, and active tenant.
- `audit_logs`: Tenant/user activity history.

Default role helpers live in:

```text
packages/database/src/authz.ts
```

Default roles:

- `owner`: Full tenant access.
- `admin`: Tenant operations, members, stores, products, and orders.
- `manager`: Store, product, and order operations.
- `staff`: Basic store, product, and order work.
- `readonly`: Read-only operational access.

Example permission check:

```ts
import { hasTenantPermission } from 'eticaret-system-database';

const allowed = await hasTenantPermission({
  userId,
  tenantId,
  permission: 'products.create',
});
```

Example tenant access query:

```ts
import { getUserTenantAccess } from 'eticaret-system-database';

const companies = await getUserTenantAccess(userId);
```

## Notes

- Keep schema changes versioned.
- Store only hashed session, API, and password reset tokens.
- Scope every business action by `tenantId`.
- Write important mutations to `audit_logs`.
