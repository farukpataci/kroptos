# KroptOS - Multi-Tenant Commerce Operating System

## Project Vision

**KroptOS** adalah enterprise-grade, multi-tenant commerce işletme sistemi. Birden fazla agency, client (muşteri), store (mağaza) ve satış kanalını merkezi platform üzerinden yönetmeyi sağlar.

### Core Value Proposition
- **Multi-agency management**: Farklı ajanlar kendi müşteri ve mağaza ağlarını bağımsız yönetir
- **Centralized control**: Tüm işletme verileri tek panelde görülebilir (role-based)
- **Scalable architecture**: Thousands of tenants, millions of orders
- **Integration-ready**: Trendyol, Logo ERP, shipment providers ile bağlantı
- **Audit & compliance**: Tüm işlem değişiklikleri kaydedilir

---

## MVP Scope (Phase 1-4, 4 Hafta)

### Phase 1: Authentication & Multi-Tenancy (Week 1)
- [x] JWT-based authentication system
- [x] User registration & login (multi-tenant aware)
- [x] Tenant context injection (JWT payload includes `tenantId`, `userId`, `role`)
- [x] Tenant switching for users with multiple access rights
- [x] Password hashing & secure credential storage

### Phase 2: Tenant Hierarchy & RBAC (Week 1-2)
- [x] Agency creation & management
- [x] Client creation (under agencies)
- [x] Store creation (under clients)
- [x] Role-based access control (Admin, Agency Manager, Client Manager, Store Manager, Employee)
- [x] Permission matrix (who can access what resource)
- [x] Tenant middleware (enforces data isolation)

### Phase 3: Core Commerce (Week 2-3)
- [x] Product & Category management (store-scoped)
- [x] Inventory tracking (basic)
- [x] Order management (with order line items)
- [x] Order status workflow (pending → processing → shipped → delivered)
- [x] Audit logging (all mutations recorded)

### Phase 4: Integrations & Advanced Features (Week 3-4)
- [x] Integration queue infrastructure (BullMQ + Redis)
- [x] Trendyol connector (order sync, product listing)
- [x] Logo ERP export queue (order/invoice export)
- [x] Shipment simulation (mock carrier API)
- [x] Webhook infrastructure (order events)

---

## Key Features

### Authentication & Authorization
```
┌─────────────────────────────────────────┐
│ User Registration                       │
│ • Email + password                      │
│ • Phone verification (optional)         │
│ • Tenant assignment at signup           │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ Login Flow                              │
│ • Email + password → JWT token          │
│ • JWT includes: userId, tenantId, role  │
│ • Refresh token (optional)              │
│ • Tenant switching (if user has access) │
└─────────────────────────────────────────┘
```

### Multi-Tenant Hierarchy
```
┌──────────────────────────────────────────────────────────┐
│                       PLATFORM (KroptOS)                 │
│                                                           │
│  ┌────────────────────┐    ┌────────────────────┐       │
│  │   AGENCY 1         │    │   AGENCY 2         │       │
│  │  (e.g., "XYZ Inc")│    │  (e.g., "ABC Ltd") │       │
│  │                    │    │                    │       │
│  │ ┌────────────────┐ │    │ ┌────────────────┐ │       │
│  │ │   CLIENT 1.1   │ │    │ │   CLIENT 2.1   │ │       │
│  │ │ (e.g., "Dept A") │    │ │ (e.g., "Partner1")     │
│  │ │                │ │    │ │                │ │       │
│  │ │ ┌────────────┐ │ │    │ │ ┌────────────┐ │ │       │
│  │ │ │ STORE 1.1.1│ │ │    │ │ │ STORE 2.1.1│ │ │       │
│  │ │ │ (Warehouse) │ │    │ │ │ (Warehouse) │ │ │       │
│  │ │ └────────────┘ │ │    │ │ └────────────┘ │ │       │
│  │ │ ┌────────────┐ │ │    │ │ ┌────────────┐ │ │       │
│  │ │ │ STORE 1.1.2│ │ │    │ │ │ STORE 2.1.2│ │ │       │
│  │ │ │ (Branch)   │ │ │    │ │ │ (Branch)   │ │ │       │
│  │ │ └────────────┘ │ │    │ │ └────────────┘ │ │       │
│  │ └────────────────┘ │    │ └────────────────┘ │       │
│  │                    │    │                    │       │
│  │ ┌────────────────┐ │    │ ┌────────────────┐ │       │
│  │ │   CLIENT 1.2   │ │    │ │   CLIENT 2.2   │ │       │
│  │ │ (e.g., "Dept B") │    │ │ (e.g., "Partner2")     │
│  │ │                │ │    │ │                │ │       │
│  │ │ ┌────────────┐ │ │    │ │ ┌────────────┐ │ │       │
│  │ │ │ STORE 1.2.1│ │ │    │ │ │ STORE 2.2.1│ │ │       │
│  │ │ └────────────┘ │ │    │ │ └────────────┘ │ │       │
│  │ └────────────────┘ │    │ └────────────────┘ │       │
│  └────────────────────┘    │                    │       │
│                            └────────────────────┘       │
│                                                          │
│ Key Rules:                                              │
│ • Agency has many Clients & Stores                      │
│ • Client belongs to ONE Agency, has many Stores         │
│ • Store belongs to ONE Client (and thus ONE Agency)     │
│ • Data access filtered by tenant hierarchy              │
└──────────────────────────────────────────────────────────┘
```

### Role-Based Access Control (RBAC)
| Role | Agency | Clients | Stores | Products | Orders | Users | Reports |
|------|--------|---------|--------|----------|--------|-------|---------|
| **Super Admin** | Create/Edit | Edit | Edit | Edit | Edit | Edit | View All |
| **Agency Admin** | Own agency only | Create/Edit | Create/Edit | View/Edit | View/Edit | Manage | View Own |
| **Client Manager** | View | Own client | Create/Edit | View/Edit | View/Edit | Manage | View Own |
| **Store Manager** | View | View | Own store | View/Edit | View/Edit | Manage | View Own |
| **Warehouse Staff** | - | - | Own store | View | View/Update Status | - | - |
| **Sales Rep** | - | - | Own store | View | Create/View | - | - |

### Core Entities

#### Users & Tenants
- User login credentials + profile
- User roles (per tenant)
- User permissions (derived from roles)
- Audit trail (login, permission changes)

#### Commerce Entities
- **Products**: Name, SKU, price, inventory, category
- **Categories**: Hierarchical (fashion → men → shirts)
- **Inventory**: Stock levels per store
- **Orders**: Order ID, customer info, line items, total, status
- **Order Line Items**: Product, quantity, unit price, discount, tax
- **Order Status History**: Status changes with timestamps & audit trail

#### Integration Entities
- **Integration Configs**: Trendyol API credentials, Logo ERP connection, etc.
- **Integration Queues**: Pending exports, sync jobs
- **Webhook Events**: Order created, order updated, payment received
- **Shipment Simulation**: Mock carrier responses

---

## Non-Functional Requirements

### Performance
- API response time: < 200ms (p95)
- Database queries: indexed for tenant filtering
- Caching: Redis for frequently accessed data (products, roles)
- Concurrent users per tenant: 100+

### Security
- All tenant data isolation mandatory (tenant middleware)
- Encryption: API keys, integration secrets (AES-256)
- Password hashing: bcrypt (salt rounds ≥ 10)
- JWT expiry: 1 hour, refresh token: 7 days
- CORS: Configured per environment
- HTTPS: Enforced in production
- Rate limiting: 1000 requests/minute per user

### Scalability
- Monorepo: Separable frontend/backend for independent scaling
- Database: Indexing on tenant_id, user_id, created_at
- Horizontal scaling: Stateless NestJS backend
- Queue distribution: BullMQ consumers on separate workers
- Load balancer: Ready for multi-instance deployment

### Reliability
- Database backups: Daily snapshots
- Error handling: Graceful degradation (integrations fail gracefully)
- Monitoring: Logs centralized, errors tracked
- Incident response: Admin alerts on critical failures

---

## Success Metrics (MVP Phase)

| Metric | Target | Validation |
|--------|--------|-----------|
| **System uptime** | 99%+ | CloudWatch/monitoring dashboard |
| **Auth latency** | < 100ms | Load test (100 concurrent logins) |
| **Tenant isolation** | 100% compliance | Security audit (cross-tenant query test) |
| **Order creation latency** | < 300ms | Performance test with 1000 orders |
| **Audit log completeness** | 100% of mutations | Audit trail validation |
| **Integration queue success** | 95%+ (first attempt) | Queue monitoring dashboard |
| **User onboarding time** | < 5 minutes | Manual testing |

---

## Constraints & Assumptions

### Assumptions
- PostgreSQL is the source of truth (Redis is cache-only)
- All users have email addresses
- Orders are immutable (status updates only, not order item changes)
- Integration failures are retryable (at least 3 attempts)
- Shipment simulation is for MVP only (to be replaced with real APIs)

### Constraints
- **MVP no payment processing**: Orders are created, not charged
- **MVP no customer accounts**: Orders created by staff, not customers
- **MVP no multi-currency**: All prices in local currency
- **MVP no subscription billing**: Flat admin cost per tenant
- **MVP no analytics**: Basic reporting only (order count, revenue by period)

---

## Technology Stack

```
Frontend:
├─ Next.js 14+ (React framework)
├─ TypeScript (type safety)
├─ Tailwind CSS (styling)
├─ shadcn/ui (component library)
├─ Zustand (state management)
└─ SWR (data fetching)

Backend:
├─ NestJS (API framework)
├─ TypeScript (type safety)
├─ Prisma ORM (database abstraction)
├─ PostgreSQL (primary database)
├─ Redis (caching, queues)
├─ BullMQ (job queue)
├─ Swagger/OpenAPI (API docs)
└─ Pino (logging)

DevOps:
├─ Docker (containerization)
├─ Docker Compose (local orchestration)
├─ pnpm (monorepo package manager)
└─ Git (version control)
```

---

## Project Structure

```
krattos/
├─ docs/                          # Documentation
│  ├─ PROJECT_SCOPE.md            # This file
│  ├─ DATABASE_SCHEMA.md          # DB design
│  ├─ API_ROUTES.md               # REST endpoints
│  ├─ SECURITY_CHECKLIST.md       # Security requirements
│  ├─ MVP_ROADMAP.md              # Sprint breakdown
│  └─ AGENTS.md                   # Custom copilot instructions
│
├─ packages/
│  ├─ backend/                    # NestJS API
│  │  ├─ src/
│  │  │  ├─ app.module.ts
│  │  │  ├─ auth/                 # JWT, login, register
│  │  │  ├─ tenant/               # Tenant context, RLS
│  │  │  ├─ rbac/                 # Roles, permissions
│  │  │  ├─ agencies/             # Agency CRUD
│  │  │  ├─ clients/              # Client CRUD
│  │  │  ├─ stores/               # Store CRUD
│  │  │  ├─ products/             # Product management
│  │  │  ├─ orders/               # Order management
│  │  │  ├─ integrations/         # Queue, connectors
│  │  │  ├─ audit/                # Audit logging
│  │  │  └─ common/               # Shared utilities
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma         # Complete DB schema
│  │  │  └─ migrations/           # DB migration files
│  │  └─ .env.example
│  │
│  ├─ frontend/                   # Next.js dashboard
│  │  ├─ src/
│  │  │  ├─ app/                  # Next.js app router
│  │  │  ├─ components/           # React components
│  │  │  ├─ context/              # Auth, tenant context
│  │  │  ├─ hooks/                # Custom hooks
│  │  │  ├─ lib/                  # Utilities, API client
│  │  │  ├─ styles/               # Global styles
│  │  │  └─ data/                 # designData.ts (reused from tailwind)
│  │  └─ .env.example
│  │
│  └─ shared/                     # Shared TypeScript types
│     └─ src/
│        ├─ types/
│        │  ├─ auth.ts            # JWT payload, user roles
│        │  ├─ tenant.ts          # Agency, client, store
│        │  ├─ product.ts         # Product, category, inventory
│        │  └─ order.ts           # Order, line item
│        └─ constants/            # Shared constants
│
├─ docker-compose.yml             # Local dev environment
├─ pnpm-workspace.yaml            # Monorepo workspace config
├─ package.json                   # Root scripts & dev dependencies
└─ README.md                       # Getting started guide
```

---

## Getting Started (Quick Reference)

1. **Clone & Install**
   ```bash
   cd c:\Users\Administrator\Desktop\kroptos
   pnpm install
   ```

2. **Database Setup**
   ```bash
   cd packages/backend
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

3. **Run Local Stack**
   ```bash
   docker-compose up  # PostgreSQL, Redis
   cd packages/backend && pnpm dev
   cd packages/frontend && pnpm dev
   ```

4. **Test Auth**
   - Visit http://localhost:3000
   - Register: email@example.com / password123
   - Login → Dashboard should load
   - Create test agency → Verify RBAC

5. **API Documentation**
   - Open http://localhost:3001/api/docs (Swagger)

---

## Next Steps
- [ ] Review & approve PROJECT_SCOPE
- [ ] Read DATABASE_SCHEMA.md for detailed table design
- [ ] Review API_ROUTES.md for endpoint structure
- [ ] Check SECURITY_CHECKLIST.md for implementation guidelines
- [ ] Start Phase 2 scaffolding (monorepo setup)
