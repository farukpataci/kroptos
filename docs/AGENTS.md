⚠️ **BU DOSYA GÜNCEL DEĞİL — koddan saptığı doğrulandı (2026-08).**
> Endpoint yolları, response şekilleri ve auth kalıpları gerçek kodla uyuşmuyor.
> Tek doğruluk kaynağı: `packages/` altındaki kod.
> Düzeltme P0 görevinde yapılacak; o zamana kadar bu dosyaya dayanarak kod üretme.


# AGENTS.md - Custom Copilot Agent Instructions for KroptOS

This file contains custom instructions for GitHub Copilot and code generation patterns specific to the KroptOS multi-tenant commerce OS project.

---

## Code Generation Patterns

### Pattern 1: Multi-Tenant Aware CRUD Service

When generating a new CRUD service (e.g., ProductService), follow this template:

```typescript
// src/products/services/product.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@nestjs/prisma';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  // ✓ Enforce tenant_id in WHERE clause
  async create(agencyId: string, dto: CreateProductDto, userId: string) {
    return this.prisma.product.create({
      data: {
        ...dto,
        agencyId, // MANDATORY: tenant isolation
        sku: `${agencyId}-${dto.sku}`, // Optional: namespace SKU per agency
      },
    });
  }

  // ✓ Filter by tenant_id before returning
  async findMany(agencyId: string, filters: FilterDto) {
    return this.prisma.product.findMany({
      where: {
        agencyId, // ← MANDATORY FILTER
        ...filters, // Additional user-provided filters
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (filters.page - 1) * 20,
    });
  }

  // ✓ Verify tenant ownership before update
  async update(agencyId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.agencyId !== agencyId) {
      throw new ForbiddenException('Product not found or access denied');
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }

  // ✓ Soft delete: mark deleted_at instead of hard delete
  async delete(agencyId: string, id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.agencyId !== agencyId) {
      throw new ForbiddenException('Product not found or access denied');
    }

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

**Key Rules**:
1. ✅ ALWAYS include `agencyId` in WHERE clause
2. ✅ ALWAYS verify tenant ownership before UPDATE/DELETE
3. ✅ NEVER return soft-deleted records (filter `WHERE deletedAt IS NULL`)
4. ✅ ALWAYS use Prisma ORM (never raw SQL unless absolutely necessary)
5. ✅ Return 403 Forbidden on cross-tenant access attempt

### Pattern 2: Controller with Tenant Context & Permissions

```typescript
// src/products/controllers/product.controller.ts
import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '@common/guards/tenant.guard';
import { PermissionGuard } from '@rbac/guards/permission.guard';
import { RequirePermission } from '@rbac/decorators/require-permission.decorator';
import { ProductService } from '../services/product.service';

@Controller('/agencies/:agencyId/products')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionGuard)
export class ProductController {
  constructor(private productService: ProductService) {}

  // ✓ Extract tenant from params & request, apply permission check
  @Post()
  @RequirePermission('product:create')
  async create(
    @Param('agencyId') agencyId: string,
    @Body() dto: CreateProductDto,
    @Req() req: any,
  ) {
    return this.productService.create(agencyId, dto, req.user.userId);
  }

  @Get()
  @RequirePermission('product:read')
  async list(@Param('agencyId') agencyId: string, @Req() req: any) {
    return this.productService.findMany(agencyId, {});
  }

  @Get(':id')
  @RequirePermission('product:read')
  async findOne(@Param('agencyId') agencyId: string, @Param('id') id: string) {
    return this.productService.findById(agencyId, id);
  }

  // ✓ Audit logging: record old values before update
  @Patch(':id')
  @RequirePermission('product:update')
  async update(
    @Param('agencyId') agencyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: any,
  ) {
    // Store old value for audit
    const oldProduct = await this.productService.findById(agencyId, id);
    const updated = await this.productService.update(agencyId, id, dto);

    // Trigger audit log (see Pattern 4)
    await this.auditService.log({
      entityType: 'product',
      entityId: id,
      action: 'update',
      changes: { old: oldProduct, new: updated },
      performedBy: req.user.userId,
    });

    return updated;
  }

  @Delete(':id')
  @RequirePermission('product:delete')
  async delete(
    @Param('agencyId') agencyId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    await this.auditService.log({
      entityType: 'product',
      entityId: id,
      action: 'delete',
      changes: { old: await this.productService.findById(agencyId, id) },
      performedBy: req.user.userId,
    });

    return this.productService.delete(agencyId, id);
  }
}
```

**Key Rules**:
1. ✅ `@UseGuards(AuthGuard, TenantGuard, PermissionGuard)` on every controller
2. ✅ Extract `agencyId` from `@Param()` or query context
3. ✅ Pass `req.user.userId` to service for audit logging
4. ✅ Call `auditService.log()` before mutation
5. ✅ Return 403 Forbidden if permission check fails (handled by guard)

### Pattern 3: Tenant Middleware & Guards

```typescript
// src/common/guards/tenant.guard.ts
import { Injectable, CanActivate, ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { PrismaService } from '@nestjs/prisma';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { agencyId } = request.params;
    const { userId } = request.user; // From JWT

    if (!agencyId || !userId) {
      throw new ForbiddenException('Missing tenant context');
    }

    // ✓ Verify user has access to this agency
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        agencyId,
        deletedAt: null,
      },
    });

    if (!userRole) {
      throw new ForbiddenException(
        `User ${userId} does not have access to agency ${agencyId}`
      );
    }

    // ✓ Attach validated tenant context to request
    request['validatedTenantId'] = agencyId;
    request['userRole'] = userRole;

    return true;
  }
}

// src/common/middleware/tenant.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const { tenantId, userId } = req.user; // From JWT token

    // ✓ Set PostgreSQL session var for RLS
    // (This must be done before any Prisma query)
    if (tenantId) {
      // Store in request context for use in PrismaService
      req['tenantId'] = tenantId;
    }

    next();
  }
}
```

**Key Rules**:
1. ✅ Guards execute AFTER middleware
2. ✅ Guards validate permission; middleware sets context
3. ✅ Return 403 if user lacks access to agency
4. ✅ Middleware must set PostgreSQL session var for RLS

### Pattern 4: Audit Logging Service

```typescript
// src/audit/services/audit.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nestjs/prisma';

export interface AuditLogEntry {
  agencyId: string;
  entityType: string; // 'product', 'order', 'user', etc.
  entityId: string;
  action: 'create' | 'update' | 'delete';
  changes: {
    old?: any;
    new?: any;
  };
  performedBy: string; // user_id
  performedAt?: Date;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // ✓ Log mutations with old/new values
  async log(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        agencyId: entry.agencyId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        changes: JSON.stringify(entry.changes),
        performedBy: entry.performedBy,
        performedAt: entry.performedAt || new Date(),
        ipAddress: entry.ipAddress,
      },
    });
  }

  // ✓ Retrieve audit trail for entity
  async getEntityHistory(agencyId: string, entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        agencyId,
        entityType,
        entityId,
      },
      orderBy: { performedAt: 'desc' },
    });
  }

  // ✓ Query by user, date range, action
  async queryLogs(agencyId: string, filters: {
    entityType?: string;
    action?: string;
    performedBy?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        agencyId,
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.action && { action: filters.action }),
        ...(filters.performedBy && { performedBy: filters.performedBy }),
        ...(filters.fromDate && { performedAt: { gte: filters.fromDate } }),
        ...(filters.toDate && { performedAt: { lte: filters.toDate } }),
      },
      orderBy: { performedAt: 'desc' },
      take: 100,
    });
  }
}
```

**Key Rules**:
1. ✅ Log BEFORE mutation (capture old values)
2. ✅ Include entityId for traceability
3. ✅ Store performedBy (userId) for accountability
4. ✅ Store changes as JSON for flexibility
5. ✅ Include ipAddress for security

### Pattern 5: Order Management (Complex Multi-Step)

```typescript
// src/orders/services/order.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@nestjs/prisma';
import { AuditService } from '@audit/services/audit.service';
import { IntegrationQueueService } from '@integrations/services/integration-queue.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private queueService: IntegrationQueueService,
  ) {}

  // ✓ Complex multi-step transaction
  async createOrder(
    agencyId: string,
    storeId: string,
    dto: CreateOrderDto,
    userId: string,
  ) {
    // 1. Verify store belongs to agency
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.agencyId !== agencyId) {
      throw new BadRequestException('Store not found');
    }

    // 2. Transaction: create order + reserve inventory
    const order = await this.prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          agencyId,
          storeId,
          orderNumber: await this.generateOrderNumber(storeId),
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          shippingAddress: dto.shippingAddress,
          status: 'pending',
          subtotal: this.calculateSubtotal(dto.lineItems),
          totalAmount: this.calculateTotal(dto.lineItems),
          createdBy: userId,
        },
      });

      // Create line items + reserve inventory
      for (const item of dto.lineItems) {
        await tx.orderLineItem.create({
          data: {
            agencyId,
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          },
        });

        // Reserve inventory
        const inventory = await tx.inventory.findUnique({
          where: {
            storeId_productId: {
              storeId,
              productId: item.productId,
            },
          },
        });

        if (!inventory || inventory.availableQty < item.quantity) {
          throw new BadRequestException(
            `Insufficient inventory for product ${item.productId}`
          );
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reservedQty: { increment: item.quantity },
          },
        });
      }

      // Create status history
      await tx.orderStatusHistory.create({
        data: {
          agencyId,
          orderId: newOrder.id,
          fromStatus: null,
          toStatus: 'pending',
          changedBy: userId,
          notes: 'Order created',
        },
      });

      return newOrder;
    });

    // 3. ✓ Audit log
    await this.auditService.log({
      agencyId,
      entityType: 'order',
      entityId: order.id,
      action: 'create',
      changes: { new: order },
      performedBy: userId,
    });

    // 4. ✓ Queue integration (Trendyol, Logo ERP, etc.)
    await this.queueService.enqueue({
      agencyId,
      queueType: 'order.created',
      payload: { orderId: order.id },
    });

    return order;
  }

  // ✓ Status update with inventory change
  async updateStatus(
    agencyId: string,
    orderId: string,
    newStatus: string,
    userId: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.agencyId !== agencyId) {
      throw new BadRequestException('Order not found');
    }

    const oldStatus = order.status;

    // Validate status transition
    const validTransitions = {
      pending: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[oldStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${oldStatus} to ${newStatus}`
      );
    }

    // Update order
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    // If shipped, release reserved inventory
    if (newStatus === 'shipped') {
      const lineItems = await this.prisma.orderLineItem.findMany({
        where: { orderId },
      });

      for (const item of lineItems) {
        const inventory = await this.prisma.inventory.findFirst({
          where: { productId: item.productId, storeId: order.storeId },
        });

        if (inventory) {
          await this.prisma.inventory.update({
            where: { id: inventory.id },
            data: {
              availableQty: { decrement: item.quantity },
              reservedQty: { decrement: item.quantity },
            },
          });
        }
      }
    }

    // Create status history
    await this.prisma.orderStatusHistory.create({
      data: {
        agencyId,
        orderId,
        fromStatus: oldStatus,
        toStatus: newStatus,
        changedBy: userId,
      },
    });

    // ✓ Audit log
    await this.auditService.log({
      agencyId,
      entityType: 'order',
      entityId: orderId,
      action: 'update',
      changes: {
        old: { status: oldStatus },
        new: { status: newStatus },
      },
      performedBy: userId,
    });

    // ✓ Queue integration
    await this.queueService.enqueue({
      agencyId,
      queueType: 'order.status_changed',
      payload: { orderId, fromStatus: oldStatus, toStatus: newStatus },
    });

    return updated;
  }

  // Helper: Generate unique order number
  private async generateOrderNumber(storeId: string): Promise<string> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const count = await this.prisma.order.count({
      where: {
        storeId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });
    return `ORD-${today}-${String(count + 1).padStart(3, '0')}`;
  }

  private calculateSubtotal(lineItems: any[]): number {
    return lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }

  private calculateTotal(lineItems: any[]): number {
    let total = this.calculateSubtotal(lineItems);
    for (const item of lineItems) {
      const discount = item.unitPrice * item.quantity * (item.discountPercent / 100);
      const tax = (item.unitPrice * item.quantity - discount) * (item.taxPercent / 100);
      total += tax - discount;
    }
    return total;
  }
}
```

**Key Rules**:
1. ✅ Use `$transaction()` for multi-step operations
2. ✅ Validate all preconditions before transaction
3. ✅ Update inventory atomically with order creation
4. ✅ Create status history on every status change
5. ✅ Queue integrations AFTER transaction commits
6. ✅ Log changes with old/new values

---

## Naming Conventions

### File & Folder Names
```
✓ src/agencies/controllers/agency.controller.ts
✓ src/agencies/services/agency.service.ts
✓ src/agencies/dto/create-agency.dto.ts
✓ src/products/products.module.ts
✓ src/orders/order-status.enum.ts
```

### Class Names
```
✓ ProductService
✓ OrderController
✓ CreateProductDto
✓ TenantGuard
✓ AuditInterceptor
✓ InvalidOrderStatusException
```

### Database Table Names
```
✓ users (lowercase, plural)
✓ products
✓ orders
✓ order_line_items (snake_case)
✓ audit_logs
✓ integration_queues
```

### Enum Values
```
✓ OrderStatus.PENDING
✓ OrderStatus.PROCESSING
✓ OrderStatus.SHIPPED
✓ UserRole.AGENCY_ADMIN
✓ UserRole.STORE_MANAGER
```

---

## Import & Export Conventions

### Avoid
```typescript
❌ import * as service from './service';
❌ export = ProductService; (CommonJS)
❌ Circular imports between modules
```

### Use
```typescript
✓ import { ProductService } from './services/product.service';
✓ export { ProductService };
✓ Lazy-load modules (forFeature in NestJS)
```

---

## Error Handling

### HTTP Exception Mapping
```typescript
// Service throws domain exception
throw new BadRequestException('Invalid SKU format');

// Controller catches & returns HTTP response
@Post()
async create(@Body() dto: CreateProductDto) {
  try {
    return this.productService.create(dto);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    throw error; // Unexpected error → 500
  }
}
```

### Tenant Access Denial
```typescript
// ALWAYS return 403 Forbidden (not 404)
if (product.agencyId !== requestedAgencyId) {
  throw new ForbiddenException('Access denied');
  // ✓ Correct: reveals authorization issue
  // ❌ Wrong: throw new NotFoundException() hides that resource exists
}
```

---

## Testing Patterns

### Unit Test Template
```typescript
describe('ProductService', () => {
  let service: ProductService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: { product: { create: jest.fn() } } },
      ],
    }).compile();

    service = module.get(ProductService);
    prisma = module.get(PrismaService);
  });

  // ✓ Test tenant isolation
  it('should reject product creation for different agency', async () => {
    const productFromAgency1 = await service.create('agency-1', dto);
    
    expect(async () => {
      await service.findById('agency-2', productFromAgency1.id);
    }).rejects.toThrow(ForbiddenException);
  });

  // ✓ Test audit logging
  it('should log product creation', async () => {
    const auditSpy = jest.spyOn(auditService, 'log');
    await service.create('agency-1', dto, 'user-1');
    
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        entityType: 'product',
        performedBy: 'user-1',
      })
    );
  });
});
```

---

## Frontend Conventions (Next.js + React)

### Page Layout Template
```typescript
// pages/dashboard/agencies.tsx
import PageMeta from '@components/common/PageMeta';
import { pageMetaData } from '@data/designData';
import { useAuth } from '@hooks/useAuth';
import AgenciesList from '@components/agencies/AgenciesList';

export default function AgenciesPage() {
  const { tenantId, permissions } = useAuth();

  if (!permissions.includes('agency:read')) {
    return <div>Access denied</div>;
  }

  return (
    <>
      <PageMeta 
        title={pageMetaData['/agencies']?.title} 
        description={pageMetaData['/agencies']?.description}
      />
      <AgenciesList agencyId={tenantId} />
    </>
  );
}
```

### API Client Pattern
```typescript
// lib/api.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
});

// ✓ Automatically add JWT to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✓ Handle 401 → redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## Summary: Developer Checklist

When implementing a new feature in KroptOS:

- [ ] Extract `agencyId` from route params or JWT
- [ ] Add `agencyId` filter to ALL database queries
- [ ] Verify tenant ownership before UPDATE/DELETE (throw 403)
- [ ] Use `@UseGuards(AuthGuard, TenantGuard, PermissionGuard)`
- [ ] Apply `@RequirePermission()` decorator
- [ ] Log mutations with `auditService.log()`
- [ ] Queue integration events with `integrationQueueService`
- [ ] Use soft deletes (set `deletedAt`, never hard delete)
- [ ] Write unit tests for tenant isolation
- [ ] Write E2E tests for happy path + error cases
- [ ] Document API endpoint in swagger
- [ ] Update SECURITY_CHECKLIST if adding auth/encryption logic

---

## Questions?

Refer to:
- **Architecture**: PROJECT_SCOPE.md → MVP_ROADMAP.md
- **Database**: DATABASE_SCHEMA.md
- **API Contracts**: API_ROUTES.md
- **Security**: SECURITY_CHECKLIST.md
- **Patterns**: This file (AGENTS.md)
