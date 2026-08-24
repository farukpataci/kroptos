# KroptOS - Multi-Tenant Commerce Operating System

A enterprise-grade, multi-tenant commerce OS supporting multiple agencies, clients, stores, and sales channels.

## Project Structure

```
krattos/
├── docs/                    # Documentation (PROJECT_SCOPE, DATABASE_SCHEMA, etc.)
├── packages/
│   ├── backend/             # NestJS API server
│   ├── frontend/            # Next.js admin dashboard
│   └── shared/              # Shared TypeScript types
├── docker-compose.yml       # Local dev environment
├── pnpm-workspace.yaml      # Monorepo config
└── package.json             # Root scripts
```

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Redis 7+

### Installation

```bash
# Install dependencies across all workspaces
pnpm install

# Setup database
cd packages/backend
npx prisma migrate dev --name init
npx prisma db seed

# Start development servers
cd ../..
pnpm dev
```

### Access Services
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs
- **Database Studio**: http://localhost:5555 (run `pnpm db:studio`)

## Database

### Schema changes

This repo keeps **no migration history**; the schema is deployed with `db push`.
`prisma migrate dev` would produce a single "init" migration that collides with
the deployed schema, so the script that used to run it is disabled on purpose
(`db:migrate:YASAK-bkz-kargo-spec`).

```bash
# 1. Review the change as SQL, without touching the database
cd packages/backend
npx prisma migrate diff   --from-schema-datasource prisma/schema.prisma   --to-schema-datamodel  prisma/schema.prisma   --script > ../../docs/plans/<change>.sql

# 2. Apply it
pnpm db:push

# 3. On Windows a running backend locks the Prisma engine and `generate` fails
#    with EPERM. Stop it first:
#    pm2 stop kroptos-backend && npx prisma generate && pm2 start kroptos-backend

# Open Prisma Studio (GUI)
pnpm db:studio
```

## Development

### Backend
```bash
cd packages/backend
pnpm dev              # Start dev server on :3001
pnpm test             # Run tests (no database needed)
pnpm test:integration # Run the suites that need the live Postgres from .env
pnpm build            # Build for production
```

### Frontend
```bash
cd packages/frontend
pnpm dev              # Start dev server on :3000
pnpm test             # Run tests
pnpm build            # Build for production
```

## Docker (Local Environment)

```bash
# Start PostgreSQL, Redis, and services
docker-compose up

# Tear down
docker-compose down

# View logs
docker-compose logs -f backend
```

## Documentation

- [PROJECT_SCOPE.md](./docs/PROJECT_SCOPE.md) — MVP vision, features, success metrics
- [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) — PostgreSQL schema, relationships, RLS
- [API_ROUTES.md](./docs/API_ROUTES.md) — REST endpoints, request/response examples
- [SECURITY_CHECKLIST.md](./docs/SECURITY_CHECKLIST.md) — Tenant isolation, encryption, RBAC
- [MVP_ROADMAP.md](./docs/MVP_ROADMAP.md) — 4-week sprint breakdown
- [AGENTS.md](./docs/AGENTS.md) — Code generation patterns, conventions

## Key Features

✅ Multi-tenant architecture with row-level security (RLS)  
✅ Role-based access control (RBAC)  
✅ Audit logging for all mutations  
✅ Product & inventory management  
✅ Order management with status workflow  
✅ Integration queue (BullMQ + Redis)  
✅ Webhooks infrastructure  
✅ Encrypted API keys for integrations  
✅ OpenAPI/Swagger documentation  

## Security

⚠️ **All sensitive data encrypted at rest**: API keys, integration secrets  
⚠️ **Multi-tenant isolation mandatory**: Tenant middleware enforces on every request  
⚠️ **Row-level security (RLS)**: PostgreSQL enforces tenant boundaries  
⚠️ **RBAC**: All API endpoints require permission check  

See [SECURITY_CHECKLIST.md](./docs/SECURITY_CHECKLIST.md) for full security requirements.

## Tech Stack

**Frontend**
- Next.js 14+ (React framework)
- TypeScript
- Tailwind CSS + shadcn/ui
- Zustand (state management)
- SWR (data fetching)

**Backend**
- NestJS (Node.js framework)
- Prisma ORM
- PostgreSQL (primary database)
- Redis (caching, queues)
- BullMQ (job queue)
- Passport.js (authentication)

**DevOps**
- Docker & Docker Compose
- pnpm (monorepo)
- Git

## License

Proprietary — KroptOS © 2024

## Support

For questions, see the documentation in `/docs/` or refer to [AGENTS.md](./docs/AGENTS.md) for code patterns and conventions.
