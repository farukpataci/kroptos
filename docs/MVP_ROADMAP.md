# MVP_ROADMAP.md - KroptOS 4-Week Sprint Breakdown

## Overview
MVP delivery in 4 consecutive 1-week sprints. Incrementally functional system at end of each sprint.

```
Week 1 (Sprint 1): Auth + Tenant Setup                ✓ Deployable (auth-only)
Week 2 (Sprint 2): Tenant Hierarchy + RBAC           ✓ Deployable (user mgmt)
Week 3 (Sprint 3): Products + Orders (Core Commerce) ✓ Deployable (commerce ready)
Week 4 (Sprint 4): Integrations + Refinement         ✓ MVP Release
```

---

## Sprint 1: Authentication & Multi-Tenant Foundation (Week 1)

**Goal**: Enable user registration/login with tenant context injection. Build JWT + tenant middleware.

### Deliverables

| Task | Owner | Est. Hours | Dependencies | Acceptance Criteria |
|------|-------|-----------|--------------|-------------------|
| **Backend: Project Scaffold** | Backend Lead | 2 | None | NestJS app running, Prisma configured, PostgreSQL connected |
| **Database: Auth Schema** | DBA | 3 | PostgreSQL access | users, refresh_tokens tables created, migrations working |
| **Auth Module: JWT Strategy** | Backend Dev 1 | 4 | Auth Schema | JWT signing/verification working, token includes tenantId |
| **Auth Module: Register Endpoint** | Backend Dev 1 | 3 | JWT Strategy | POST /auth/register creates user + agency, returns accessToken |
| **Auth Module: Login Endpoint** | Backend Dev 1 | 3 | JWT Strategy | POST /auth/login verifies credentials, returns JWT |
| **Auth Module: Refresh Token** | Backend Dev 1 | 2 | JWT Strategy | POST /auth/refresh-token rotates tokens |
| **Tenant Middleware** | Backend Dev 2 | 3 | Auth Module | Middleware extracts tenantId from JWT, sets PostgreSQL session var |
| **Frontend: Project Scaffold** | Frontend Lead | 2 | None | Next.js app running, Tailwind CSS configured |
| **Frontend: Auth Context** | Frontend Dev 1 | 3 | Frontend Scaffold | Context stores JWT, user info, tenantId; provides useAuth hook |
| **Frontend: Login Page** | Frontend Dev 1 | 3 | Auth Context | Form with email/password, calls POST /auth/login, redirects to dashboard on success |
| **Frontend: Register Page** | Frontend Dev 1 | 3 | Auth Context | Form with email/password/agencyName, calls POST /auth/register |
| **Frontend: Protected Route** | Frontend Dev 2 | 2 | Auth Context | PrivateRoute component redirects unauthenticated users to /login |
| **Frontend: Blank Dashboard** | Frontend Dev 2 | 2 | Protected Route | /dashboard shows "Welcome, {name}" and logoutbutton |
| **Docker: docker-compose.yml** | DevOps | 2 | All above | Services: PostgreSQL, Redis (unused in Sprint 1), NestJS backend, Next.js frontend start correctly |
| **Documentation: API Docs** | Tech Lead | 2 | Auth Module | Swagger docs running at /api/docs, auth endpoints documented |
| **Testing: Auth Integration Test** | QA | 3 | All above | E2E test: Register → Login → Refresh → Logout cycle succeeds |

**Total Hours**: ~42 hours (1 Backend Lead + 2 Backend Devs + 2 Frontend Devs + DevOps + QA)

### Sprint 1 End Criteria
```bash
✓ docker-compose up → both services start
✓ POST http://localhost:3001/api/auth/register → user created
✓ POST http://localhost:3001/api/auth/login → JWT returned
✓ http://localhost:3000 → redirects to /login (no token)
✓ http://localhost:3000/auth/login → login form renders
✓ Login with registered email → redirected to /dashboard
✓ JWT decoded at jwt.io → contains tenantId, role, email
```

**Definition of Done**:
- Code reviewed & merged to `main` branch
- All tests passing (unit + integration)
- Swagger docs complete
- Docker image builds without errors
- No critical security issues (OWASP top 5)

---

## Sprint 2: Tenant Hierarchy & Role-Based Access Control (Week 2)

**Goal**: Build multi-level tenant structure (agency → client → store) + RBAC with permissions.

### Deliverables

| Task | Owner | Est. Hours | Dependencies | Acceptance Criteria |
|------|-------|-----------|--------------|-------------------|
| **Database: Tenant & RBAC Schema** | DBA | 4 | Sprint 1 DB | agencies, clients, stores, roles, permissions, user_roles tables; indexes created |
| **Database: Seed Data** | DBA | 2 | Tenant Schema | 6 default roles (super_admin, agency_admin, client_manager, store_manager, warehouse_staff, sales_rep) + 30 permissions |
| **Database: RLS Policies** | DBA | 3 | Tenant Schema | PostgreSQL RLS enabled on all tables, agency_id filtering policies |
| **Backend: Agencies CRUD** | Backend Dev 1 | 4 | Tenant Schema | POST/GET/PUT /agencies/:id endpoints, TenantGuard validates access |
| **Backend: Clients CRUD** | Backend Dev 1 | 4 | Agencies CRUD | POST/GET/PUT /agencies/:id/clients endpoints, client ⊆ agency |
| **Backend: Stores CRUD** | Backend Dev 2 | 4 | Clients CRUD | POST/GET/PUT /agencies/:id/clients/:id/stores, store ⊆ client ⊆ agency |
| **Backend: RBAC Module** | Backend Dev 2 | 5 | Seed Data | RbacService, @RequirePermission() decorator, PermissionGuard, permission matrix |
| **Backend: User Management** | Backend Dev 1 | 4 | RBAC Module | POST /agencies/:id/users (invite), PUT /agencies/:id/users/:id/role, soft delete |
| **Frontend: Tenant Context** | Frontend Dev 1 | 3 | Auth Context | TenantProvider wraps app, useActiveTenant() hook, tenantId passed to API calls |
| **Frontend: Agency/Client/Store Switcher** | Frontend Dev 1 | 4 | Tenant Context | Dropdown in header, users can switch accessible tenants, updates JWT |
| **Frontend: Agency Management Page** | Frontend Dev 2 | 4 | Agencies CRUD | /dashboard/agencies: list (RLS filtered), create, edit, delete modals |
| **Frontend: Client Management Page** | Frontend Dev 2 | 4 | Clients CRUD | /dashboard/agencies/:id/clients: CRUD modals, hierarchy visualization |
| **Frontend: Store Management Page** | Frontend Dev 2 | 4 | Stores CRUD | /dashboard/agencies/:id/clients/:id/stores: CRUD modals, store type selector |
| **Frontend: User Management Page** | Frontend Dev 1 | 4 | User Management | /dashboard/agencies/:id/users: list, invite form, role assignment dropdown |
| **Testing: RBAC Integration Test** | QA | 4 | All above | E2E tests: user without permission → 403, user with permission → 200, role change propagates |
| **Testing: Tenant Isolation Test** | QA | 3 | RLS Policies | Cross-tenant query test: user A cannot see user B's data even with SQL bypass |

**Total Hours**: ~63 hours

### Sprint 2 End Criteria
```bash
✓ Register User A → Create Agency 1, Client 1, Store 1
✓ Register User B → Create Agency 2, Client 2, Store 2
✓ Login as User A → can only see Agency 1 (RLS enforced)
✓ User A tries `SELECT * FROM products WHERE agency_id = <Agency 2>` → 0 rows (RLS)
✓ POST /agencies with invalid role → 403 Forbidden
✓ Assign User A role "store_manager" for Store 1 → can edit Store 1 only
✓ Assign User A role "agency_admin" for Agency 1 → can edit Agency 1, all Clients, all Stores
```

**Definition of Done**:
- All CRUD endpoints return 403 Forbidden for cross-tenant access
- PostgreSQL RLS verified with direct SQL queries
- User roles impact API responses correctly
- Frontend reflects all tenant hierarchy levels
- Audit logs created for role changes

---

## Sprint 3: Products, Categories & Orders (Week 3)

**Goal**: Commerce core: product catalog, inventory, order management with audit trail.

### Deliverables

| Task | Owner | Est. Hours | Dependencies | Acceptance Criteria |
|------|-------|-----------|--------------|-------------------|
| **Database: Product & Order Schema** | DBA | 4 | Sprint 2 DB | categories, products, inventories, orders, order_line_items, order_status_history tables |
| **Database: Audit Log Schema** | DBA | 3 | Sprint 2 DB | audit_logs table, trigger for automatic logging on insert/update |
| **Backend: Categories Module** | Backend Dev 1 | 3 | Product Schema | POST/GET /agencies/:id/categories, hierarchical tree structure, soft delete |
| **Backend: Products Module** | Backend Dev 2 | 5 | Categories | POST/GET/PUT/DELETE /stores/:id/products, SKU uniqueness per agency, inventory sync |
| **Backend: Inventory Module** | Backend Dev 2 | 4 | Products | GET /stores/:id/inventory, PUT .../inventory/:id/adjust (recount, damage), audit log |
| **Backend: Orders Module (Create)** | Backend Dev 1 | 6 | Products, Inventory | POST /stores/:id/orders (create with line items), reserve inventory, audit log, webhook trigger |
| **Backend: Orders Module (List/Read)** | Backend Dev 1 | 3 | Orders Create | GET /stores/:id/orders, GET /stores/:id/orders/:id, status history, RLS |
| **Backend: Orders Module (Status Update)** | Backend Dev 1 | 4 | Orders List | PATCH /stores/:id/orders/:id/status, update inventory on "shipped", audit log, webhook trigger |
| **Backend: Audit Service** | Backend Dev 2 | 3 | Audit Log Schema | AuditService logs all mutations with user, timestamp, old/new values |
| **Frontend: Category Management** | Frontend Dev 1 | 3 | Categories | /dashboard/categories: hierarchical tree, create/edit/delete, drag-and-drop reorder |
| **Frontend: Product Catalog** | Frontend Dev 2 | 5 | Products | /dashboard/products: list with filters (category, active/inactive), search by SKU/name, pagination |
| **Frontend: Product Create/Edit** | Frontend Dev 2 | 4 | Product Catalog | Modal form: SKU, name, category, prices, weight, dimensions, barcode |
| **Frontend: Inventory View** | Frontend Dev 1 | 3 | Inventory | /dashboard/inventory: available/reserved/defective qty, adjust modal |
| **Frontend: Orders Dashboard** | Frontend Dev 2 | 4 | Orders Module | /dashboard/orders: list with status filter, order card showing line items |
| **Frontend: Create Order** | Frontend Dev 1 | 5 | Orders Create | Form: customer info, product selector, qty, discount, auto-calculate total, submit |
| **Frontend: Order Detail View** | Frontend Dev 2 | 4 | Orders List | /dashboard/orders/:id: full details, line items table, status history timeline, edit status |
| **Frontend: Audit Log Viewer** | Frontend Dev 1 | 3 | Audit Service | /dashboard/audit-logs: list mutations by entity, show old/new values, filter by date/user |
| **Testing: Commerce Flow E2E** | QA | 5 | All above | Full flow: create product → check inventory → create order → update status → verify audit log |

**Total Hours**: ~77 hours

### Sprint 3 End Criteria
```bash
✓ Create product PROD-001 in Store 1 → SKU unique per agency
✓ Create order with PROD-001 (qty: 10) → inventory.reserved_qty += 10
✓ Update order status to "shipped" → inventory.available_qty -= 10, reserved_qty -= 10
✓ Query audit_logs for order → shows create, update events with user, timestamp
✓ Download order PDF (stub) → 200 OK with order details
✓ Category hierarchy (Men > Shirts) → frontend tree renders correctly
```

**Definition of Done**:
- All inventory transactions logged
- Orders are immutable except for status
- Audit trail complete for all commerce operations
- Cross-tenant isolation validated
- No performance regressions (order list < 500ms for 10k orders)

---

## Sprint 4: Integrations, Final Polish & Release (Week 4)

**Goal**: Integration queue infrastructure + connectors (Trendyol, Logo ERP, shipment simulation) + launch.

### Deliverables

| Task | Owner | Est. Hours | Dependencies | Acceptance Criteria |
|------|-------|-----------|--------------|-------------------|
| **Database: Integration Schema** | DBA | 3 | Sprint 3 DB | integration_configs, integration_queues, webhook_events, webhook_subscriptions tables |
| **Backend: Integration Config** | Backend Dev 1 | 3 | Integration Schema | POST/GET /agencies/:id/integrations, encrypted API key/secret storage, test connection |
| **Backend: Queue Infrastructure** | Backend Dev 2 | 5 | BullMQ, Redis | BullMQ queue setup, job processor, retry logic (3 attempts), error handling, dead-letter queue |
| **Backend: Trendyol Connector (Stub)** | Backend Dev 1 | 6 | Queue | Integration: on order created → queue job, stub API call, webhook response simulation |
| **Backend: Logo ERP Connector (Stub)** | Backend Dev 1 | 6 | Queue | Integration: on order shipped → export order/invoice JSON, stub API call |
| **Backend: Shipment Simulation** | Backend Dev 2 | 4 | Queue | Integration: on order update → simulate carrier pickup/delivery, webhook callback |
| **Backend: Webhook System** | Backend Dev 2 | 4 | Queue | Webhook subscriptions, event broadcasting, retry on failure, webhook log viewer |
| **Frontend: Integration Settings** | Frontend Dev 1 | 4 | Integration Config | /dashboard/integrations: config form, test button, credentials encryption warning, queue status |
| **Frontend: Queue Monitor** | Frontend Dev 2 | 3 | Queue | /dashboard/queue-monitor: pending jobs, completed/failed tabs, manual retry button |
| **Frontend: Webhook Log Viewer** | Frontend Dev 1 | 2 | Webhook System | /dashboard/webhooks: event log, retry count, response payload |
| **Backend: Error Handling & Recovery** | Backend Dev 2 | 3 | All Modules | Graceful degradation: integration failure doesn't block order creation, retry on network failure |
| **Backend: Performance Optimization** | Backend Dev 1 | 4 | All Modules | Database query optimization, N+1 query fixes, response time monitoring |
| **Frontend: Dark Mode** | Frontend Dev 2 | 2 | UI Components | Tailwind dark: mode toggle, persistent preference, all pages responsive |
| **Frontend: Mobile Responsiveness** | Frontend Dev 2 | 3 | UI Components | Test on mobile (375px), tablet (768px), desktop (1920px); navigation drawer for mobile |
| **Documentation: API OpenAPI Export** | Tech Lead | 2 | All Modules | /api/docs exports OpenAPI 3.0.0 JSON, can import into Postman/Insomnia |
| **Documentation: Deployment Guide** | Tech Lead | 3 | Docker, All Modules | README.md: setup, environment variables, database migrations, deployment steps |
| **Documentation: User Guide** | Tech Lead | 4 | All Features | Quick start: create account → create agency/store → add products → create order |
| **Testing: Integration Tests** | QA | 4 | Connectors | Queue jobs execute, webhooks fire, retries work, errors logged |
| **Testing: Performance Tests** | QA | 3 | All Modules | Load test: 100 concurrent users, 1000 order creation requests, < 500ms p95 latency |
| **Testing: Security Audit** | QA | 5 | Security Checklist | Verify all 10 security sections implemented, no OWASP Top 10 vulnerabilities |
| **Deployment: Staging Deployment** | DevOps | 4 | Docker, All | Deploy to staging environment, smoke tests pass, production-like configuration |
| **Release: MVP v1.0** | Tech Lead | 2 | All | Release notes, version bump, Docker image push, GitHub release tagged |

**Total Hours**: ~96 hours

### Sprint 4 End Criteria
```bash
✓ Create order in Store 1 → "order.created" webhook fires → Trendyol stub logs received → job completes
✓ Update order status to "shipped" → "order.shipped" webhook fires → Logo ERP export queued → job completes
✓ Queue monitor shows 0 failed jobs, all completed with timestamps
✓ Load test 100 concurrent logins → p95 latency < 500ms, no 5xx errors
✓ Security scan: no critical vulnerabilities, RLS enforced, secrets encrypted
✓ Dark mode works, mobile responsive on iOS Safari & Android Chrome
✓ Docker image deployed to staging, health check passes
```

**Definition of Done**:
- All features from MVP scope completed
- Documentation complete (API, deployment, user guide)
- Security audit passed
- Performance benchmarks met
- Production deployment ready
- Release notes published

---

## Post-MVP Backlog (Future Sprints)

### Phase 2: Customer Portal
- [ ] Customer account creation
- [ ] Self-service order tracking
- [ ] Payment integration (Stripe, PayTR)
- [ ] Invoice download

### Phase 3: Advanced Reporting
- [ ] Revenue by period (daily/monthly)
- [ ] Top-selling products
- [ ] Customer analytics
- [ ] Export to Excel/PDF

### Phase 4: Mobile App
- [ ] React Native or Flutter app
- [ ] Order management on-the-go
- [ ] Barcode scanning
- [ ] Real-time notifications

### Phase 5: Enterprise Features
- [ ] Advanced inventory management (warehouse zones, bins)
- [ ] Multi-currency support
- [ ] Subscription billing
- [ ] Advanced reporting & BI integration

---

## Key Dates & Milestones

| Date | Milestone | Deliverable |
|------|-----------|-------------|
| **End of Week 1** | Sprint 1 Review | Auth system working, dashboard loads |
| **End of Week 2** | Sprint 2 Review | Tenant hierarchy visible, RBAC enforced |
| **End of Week 3** | Sprint 3 Review | Orders can be created & tracked |
| **End of Week 4** | **MVP Release** | Full feature set, production deployment |

---

## Team & Roles

| Role | Count | Responsibilities |
|------|-------|------------------|
| **Backend Lead** | 1 | Architecture, DB design, code review |
| **Backend Developer** | 2 | Core modules, API endpoints |
| **Frontend Lead** | 1 | UI/UX, design system, performance |
| **Frontend Developer** | 2 | Pages, components, form handling |
| **DevOps Engineer** | 1 | Docker, CI/CD, deployment |
| **QA Engineer** | 1 | Testing, security audit, performance |
| **Tech Lead** | 1 | Documentation, standards, release |

**Total Team**: 9 people, 4 weeks, ~278 hours

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Database performance under load | Medium | High | Early optimization, index planning in Sprint 3 |
| Integration API changes | Low | Medium | Use mock/stub APIs in MVP, document integration patterns |
| Team knowledge gaps | Low | Medium | Pairing, documentation, architecture reviews |
| Scope creep | High | High | Strict backlog discipline, cut non-MVP features early |

---

## Success Criteria

✅ **MVP Success** is defined as:
1. All 4 core modules complete (auth, tenants, commerce, integrations)
2. Zero critical security vulnerabilities (OWASP review passed)
3. Performance benchmarks met (p95 < 500ms, < 1% error rate under load)
4. Zero data loss or cross-tenant data leaks in security audit
5. Documentation complete & deployment reproducible
6. Team confident in codebase quality & maintainability
