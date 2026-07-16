# DATABASE_SCHEMA.md - KroptOS Multi-Tenant Database Design

## Overview
PostgreSQL schema with multi-tenant isolation using:
- **Tenant IDs** (agency_id, client_id, store_id) on every table
- **Row-Level Security (RLS)** policies for data isolation
- **Audit triggers** for change tracking
- **Soft deletes** (deleted_at nullable) for data recovery

---

## Core Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         USERS & AUTH                          │
├──────────────────────────────────────────────────────────────┤
│ users                                                          │
│ ├─ id: UUID (PK)                                              │
│ ├─ email: String (UNIQUE)                                     │
│ ├─ password_hash: String (bcrypt)                             │
│ ├─ first_name: String                                         │
│ ├─ last_name: String                                          │
│ ├─ phone: String (optional)                                   │
│ ├─ is_active: Boolean (default true)                          │
│ ├─ last_login_at: DateTime (nullable)                         │
│ ├─ created_at: DateTime                                       │
│ ├─ updated_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable, soft delete)               │
│                                                                │
│ user_roles (junction table)                                   │
│ ├─ id: UUID (PK)                                              │
│ ├─ user_id: UUID (FK → users.id)                             │
│ ├─ role_id: UUID (FK → roles.id)                             │
│ ├─ agency_id: UUID (FK → agencies.id)                        │
│ ├─ client_id: UUID (FK → clients.id, nullable)               │
│ ├─ store_id: UUID (FK → stores.id, nullable)                 │
│ ├─ created_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ roles                                                          │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id)                        │
│ ├─ name: String (e.g., "Admin", "Manager", "Staff")          │
│ ├─ description: String                                        │
│ ├─ created_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ role_permissions (junction table)                             │
│ ├─ id: UUID (PK)                                              │
│ ├─ role_id: UUID (FK → roles.id)                             │
│ ├─ permission_id: UUID (FK → permissions.id)                 │
│ └─ created_at: DateTime                                       │
│                                                                │
│ permissions                                                    │
│ ├─ id: UUID (PK)                                              │
│ ├─ code: String (UNIQUE, e.g., "product:create", "order:read")
│ ├─ description: String                                        │
│ └─ created_at: DateTime                                       │
│                                                                │
│ refresh_tokens                                                │
│ ├─ id: UUID (PK)                                              │
│ ├─ user_id: UUID (FK → users.id)                             │
│ ├─ token_hash: String                                         │
│ ├─ expires_at: DateTime                                       │
│ └─ created_at: DateTime                                       │
└──────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────────────────────────────────────────────────────┐
│                      TENANT HIERARCHY                         │
├──────────────────────────────────────────────────────────────┤
│ agencies                                                       │
│ ├─ id: UUID (PK)                                              │
│ ├─ name: String                                               │
│ ├─ email: String                                              │
│ ├─ phone: String                                              │
│ ├─ address: String                                            │
│ ├─ city: String                                               │
│ ├─ country: String                                            │
│ ├─ tax_id: String (unique per country)                        │
│ ├─ logo_url: String (nullable)                                │
│ ├─ is_active: Boolean                                         │
│ ├─ created_at: DateTime                                       │
│ ├─ updated_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ clients                                                        │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id) [IMMUTABLE]            │
│ ├─ name: String                                               │
│ ├─ email: String                                              │
│ ├─ phone: String                                              │
│ ├─ address: String                                            │
│ ├─ contact_person: String                                     │
│ ├─ is_active: Boolean                                         │
│ ├─ created_at: DateTime                                       │
│ ├─ updated_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ stores                                                         │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id) [IMMUTABLE]            │
│ ├─ client_id: UUID (FK → clients.id) [IMMUTABLE]             │
│ ├─ name: String                                               │
│ ├─ store_code: String (unique per agency)                     │
│ ├─ address: String                                            │
│ ├─ phone: String                                              │
│ ├─ manager_name: String                                       │
│ ├─ store_type: Enum (warehouse, retail, pop-up)              │
│ ├─ is_active: Boolean                                         │
│ ├─ created_at: DateTime                                       │
│ ├─ updated_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
└──────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────────────────────────────────────────────────────┐
│                    COMMERCE ENTITIES                          │
├──────────────────────────────────────────────────────────────┤
│ categories                                                     │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id)                        │
│ ├─ parent_category_id: UUID (FK → categories.id, nullable)   │
│ ├─ name: String                                               │
│ ├─ slug: String (unique per agency)                           │
│ ├─ description: String (nullable)                             │
│ ├─ order: Int (sort order)                                    │
│ ├─ is_active: Boolean                                         │
│ ├─ created_at: DateTime                                       │
│ ├─ updated_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ products                                                       │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id)                        │
│ ├─ category_id: UUID (FK → categories.id, nullable)          │
│ ├─ sku: String (unique per agency)                            │
│ ├─ name: String                                               │
│ ├─ description: String (nullable)                             │
│ ├─ base_price: Decimal (unit price)                           │
│ ├─ cost_price: Decimal (for reporting)                        │
│ ├─ weight: Decimal (kg, nullable)                             │
│ ├─ dimensions: JSON (length, width, height)                   │
│ ├─ barcode: String (nullable)                                 │
│ ├─ is_active: Boolean                                         │
│ ├─ created_at: DateTime                                       │
│ ├─ updated_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ inventories                                                    │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id)                        │
│ ├─ store_id: UUID (FK → stores.id)                           │
│ ├─ product_id: UUID (FK → products.id)                       │
│ ├─ available_qty: Int (stocks available for sale)            │
│ ├─ reserved_qty: Int (allocated to pending orders)           │
│ ├─ defective_qty: Int (damaged, unsellable)                  │
│ ├─ last_counted_at: DateTime (for cycle counts)              │
│ ├─ created_at: DateTime                                       │
│ ├─ updated_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ orders                                                         │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id)                        │
│ ├─ store_id: UUID (FK → stores.id)                           │
│ ├─ order_number: String (unique per store, e.g., "ORD-20240101-001")
│ ├─ customer_name: String                                      │
│ ├─ customer_email: String                                     │
│ ├─ customer_phone: String                                     │
│ ├─ shipping_address: JSON (full address)                      │
│ ├─ status: Enum (pending, processing, shipped, delivered, cancelled)
│ ├─ subtotal: Decimal (before tax/shipping)                   │
│ ├─ tax_amount: Decimal                                        │
│ ├─ shipping_amount: Decimal                                   │
│ ├─ discount_amount: Decimal                                   │
│ ├─ total_amount: Decimal (subtotal + tax + shipping - discount)
│ ├─ notes: String (internal notes)                             │
│ ├─ created_by: UUID (FK → users.id)                          │
│ ├─ created_at: DateTime                                       │
│ ├─ updated_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ order_line_items                                              │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id)                        │
│ ├─ order_id: UUID (FK → orders.id)                           │
│ ├─ product_id: UUID (FK → products.id)                       │
│ ├─ quantity: Int                                              │
│ ├─ unit_price: Decimal (price at time of order)              │
│ ├─ discount_percent: Decimal (0-100)                         │
│ ├─ tax_percent: Decimal (0-100)                              │
│ ├─ line_total: Decimal (calculated)                          │
│ ├─ created_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
│                                                                │
│ order_status_history                                          │
│ ├─ id: UUID (PK)                                              │
│ ├─ agency_id: UUID (FK → agencies.id)                        │
│ ├─ order_id: UUID (FK → orders.id)                           │
│ ├─ from_status: Enum                                          │
│ ├─ to_status: Enum                                            │
│ ├─ changed_by: UUID (FK → users.id)                          │
│ ├─ notes: String (why the change?)                            │
│ ├─ created_at: DateTime                                       │
│ └─ deleted_at: DateTime (nullable)                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Audit & Integration Tables

### Audit Log
```
audit_logs
├─ id: UUID (PK)
├─ agency_id: UUID (FK → agencies.id)
├─ entity_type: String (e.g., "product", "order", "user")
├─ entity_id: UUID
├─ action: Enum (create, update, delete)
├─ changes: JSON (old_value → new_value for each field)
├─ performed_by: UUID (FK → users.id)
├─ performed_at: DateTime
└─ ip_address: String (optional, for security)
```

### Integration Configuration
```
integration_configs
├─ id: UUID (PK)
├─ agency_id: UUID (FK → agencies.id)
├─ integration_type: Enum (trendyol, logo_erp, shipment_provider)
├─ api_key: String (encrypted)
├─ api_secret: String (encrypted)
├─ webhook_url: String (for callbacks)
├─ is_active: Boolean
├─ last_sync_at: DateTime (nullable)
├─ created_at: DateTime
├─ updated_at: DateTime
└─ deleted_at: DateTime (nullable)
```

### Integration Queue
```
integration_queues
├─ id: UUID (PK)
├─ agency_id: UUID (FK → agencies.id)
├─ queue_type: String (order_export, product_sync, shipment_update)
├─ payload: JSON (data to process)
├─ status: Enum (pending, processing, completed, failed)
├─ retry_count: Int (0-3)
├─ error_message: String (nullable, if failed)
├─ scheduled_for: DateTime (nullable)
├─ processed_at: DateTime (nullable)
├─ created_at: DateTime
└─ updated_at: DateTime
```

### Webhooks & Events
```
webhook_events
├─ id: UUID (PK)
├─ agency_id: UUID (FK → agencies.id)
├─ event_type: String (order.created, order.updated, payment.received)
├─ entity_type: String (order, payment, shipment)
├─ entity_id: UUID
├─ payload: JSON (full event data)
├─ created_at: DateTime
└─ processed_at: DateTime (nullable)

webhook_subscriptions
├─ id: UUID (PK)
├─ agency_id: UUID (FK → agencies.id)
├─ event_type: String (wildcard allowed, e.g., "order.*")
├─ target_url: String
├─ secret: String (for signing webhooks)
├─ is_active: Boolean
├─ created_at: DateTime
└─ deleted_at: DateTime (nullable)
```

---

## Indexes & Performance Optimization

```sql
-- Tenant filtering (mandatory on all tables)
CREATE INDEX idx_users_agency_id ON users(agency_id);
CREATE INDEX idx_products_agency_id ON products(agency_id);
CREATE INDEX idx_orders_agency_id ON orders(agency_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);

-- Foreign key indexes
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

-- Soft delete filtering
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_products_deleted_at ON products(deleted_at);

-- Audit logging
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_performed_at ON audit_logs(performed_at DESC);

-- Search & list queries
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Integration queues
CREATE INDEX idx_integration_queues_status ON integration_queues(status);
CREATE INDEX idx_integration_queues_scheduled_for ON integration_queues(scheduled_for);
```

---

## Row-Level Security (RLS) Example

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see data from their authorized tenants
CREATE POLICY products_agency_isolation ON products
    FOR SELECT
    USING (agency_id = current_setting('app.agency_id')::uuid);

CREATE POLICY orders_store_isolation ON orders
    FOR SELECT
    USING (
        store_id IN (
            SELECT id FROM stores 
            WHERE agency_id = current_setting('app.agency_id')::uuid
        )
    );
```

---

## Data Constraints & Validation

| Table | Field | Constraint | Notes |
|-------|-------|-----------|-------|
| users | email | UNIQUE | Case-insensitive comparison |
| agencies | name | NOT NULL | Min length 2, max 255 |
| clients | agency_id | IMMUTABLE | Cannot change after creation |
| stores | client_id | IMMUTABLE | Cannot change after creation |
| products | sku | UNIQUE per agency | Allow reassignment if soft-deleted |
| orders | total_amount | NOT NULL | Must be >= 0 |
| inventories | available_qty | >= reserved_qty | Constraint: no negative stock |

---

## Migration Path

### V1.0 Initial Schema
- Tenant hierarchy (agencies, clients, stores)
- Users, roles, permissions
- Products, categories, inventories
- Orders, order line items, order history
- Audit logs, integration configs, queues

### Future Enhancements (Post-MVP)
- Multi-currency support (currency_id on orders)
- Subscription billing (invoices, payment terms)
- Customer accounts (self-service order tracking)
- Advanced reporting (analytics tables)
- Warehouse management (bins, zones, picking)

---

## Prisma Schema Location
📁 `packages/backend/prisma/schema.prisma`

Generated Prisma Client used in NestJS services for:
- CRUD operations with tenant filtering
- Aggregate queries (revenue reports)
- Batch operations (bulk product import)
- Transaction handling (order creation + inventory update)

---

## Backup & Recovery Strategy

- **Full backup**: Daily snapshot to S3
- **Point-in-time recovery**: WAL archiving enabled
- **Soft deletes**: All data recoverable for 30 days post-deletion
- **Audit log retention**: 5 years (GDPR compliance)
