# SECURITY_CHECKLIST.md - KroptOS Security Requirements & Implementation Guide

## Executive Summary
KroptOS handles sensitive commerce data for multiple tenants. **Zero tolerance for cross-tenant data leaks**. All security requirements are **mandatory** for production deployment.

---

## 1. Multi-Tenant Isolation

### 1.1 Tenant Middleware (MANDATORY)
**Requirement**: Every API request must validate tenant context before processing any data operation.

**Implementation**:
```typescript
// src/common/middleware/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('Missing token');

    const token = authHeader.replace('Bearer ', '');
    const payload = this.jwtService.verify(token);
    
    // Extract tenant context from JWT
    req['tenantId'] = payload.tenantId;
    req['userId'] = payload.userId;
    req['role'] = payload.role;
    
    // Set PostgreSQL session variable for RLS
    // (executed before any DB query)
    req['pg'] = {
      setting: async () => {
        await db.$executeRaw`
          SET app.agency_id = ${payload.tenantId}::uuid
        `;
      }
    };
    
    next();
  }
}

// Register in app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
```

**Verification**:
- [ ] Token missing → 401 Unauthorized
- [ ] Invalid token → 401 Unauthorized
- [ ] Token valid, but user accesses different tenantId → 403 Forbidden
- [ ] Tenant context set on every request

### 1.2 Row-Level Security (RLS) in PostgreSQL (MANDATORY)
**Requirement**: Database enforces tenant isolation at row level; application layer cannot bypass.

**Implementation**:
```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Only rows matching session agency_id are visible
CREATE POLICY products_rls ON products
    FOR ALL
    USING (agency_id = current_setting('app.agency_id')::uuid)
    WITH CHECK (agency_id = current_setting('app.agency_id')::uuid);

CREATE POLICY orders_rls ON orders
    FOR ALL
    USING (agency_id = current_setting('app.agency_id')::uuid);

-- For users: users can only see users within their agency
CREATE POLICY users_rls ON users
    FOR SELECT
    USING (
      id = current_user_id()  -- See self
      OR agency_id = current_setting('app.agency_id')::uuid  -- Or in same agency
    );
```

**Verification**:
- [ ] Direct SQL query (bypassing app): `SELECT * FROM products;` returns no results
- [ ] Query with correct session: `SET app.agency_id = '...'; SELECT * FROM products;` returns filtered results
- [ ] Attempt INSERT/UPDATE to wrong agency_id → Permission denied error

### 1.3 Application-Level Access Control
**Requirement**: Redundant filtering in NestJS (defense-in-depth; RLS is not sufficient alone).

**Implementation**:
```typescript
// src/common/guards/tenant.guard.ts
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { agencyId } = request.params;
    const currentTenantId = request['tenantId'];

    // Check if user has access to requested tenant
    const hasAccess = await this.prisma.userRole.findFirst({
      where: {
        userId: request['userId'],
        agencyId: agencyId,
      },
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        `User does not have access to agency ${agencyId}`
      );
    }

    return true;
  }
}

// Apply on controller
@Controller('/agencies/:agencyId/products')
@UseGuards(AuthGuard, TenantGuard)
export class ProductController {
  @Get()
  listProducts(@Param('agencyId') agencyId: string) {
    // Additional application filtering
    return this.productService.list(agencyId);
  }
}
```

**Verification**:
- [ ] User A tries to access agency B's products → 403 Forbidden
- [ ] User has role but no permission for action → 403 Forbidden
- [ ] Correct tenant & role → 200 OK

---

## 2. Data Encryption

### 2.1 API Keys & Integration Secrets (MANDATORY)
**Requirement**: All sensitive integration credentials encrypted at rest using AES-256.

**Implementation**:
```typescript
// src/common/utils/encryption.ts
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes hex

export const encryptSecret = (plaintext: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decryptSecret = (encrypted: string): string => {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Usage in integration config
@Service()
export class IntegrationConfigService {
  async createConfig(config: CreateIntegrationConfigDto) {
    return this.prisma.integrationConfig.create({
      data: {
        ...config,
        apiKey: encryptSecret(config.apiKey),
        apiSecret: encryptSecret(config.apiSecret),
      },
    });
  }

  async getConfig(id: string) {
    const config = await this.prisma.integrationConfig.findUnique({ where: { id } });
    return {
      ...config,
      apiKey: decryptSecret(config.apiKey), // Only decrypt when needed
      apiSecret: decryptSecret(config.apiSecret),
    };
  }
}
```

**Verification**:
- [ ] Database backup: API keys are encrypted (not readable as plaintext)
- [ ] `encryptSecret('test')` → different output each time (due to random IV)
- [ ] `decryptSecret(encrypted)` → recovers original value
- [ ] Decryption without correct `ENCRYPTION_KEY` → fails with auth tag error

### 2.2 Environment Variables (MANDATORY)
**Requirement**: Sensitive values in `.env`, never committed to git.

**.env.example** (committed to git):
```
DATABASE_URL=postgresql://user:password@localhost:5432/kroptos
REDIS_URL=redis://localhost:6379
JWT_SECRET=placeholder-change-in-production
ENCRYPTION_KEY=placeholder-32-byte-hex-key
```

**.env** (NOT committed):
```
DATABASE_URL=postgresql://prod-user:secure-pwd@prod-db.rds.amazonaws.com:5432/kroptosdb
REDIS_URL=redis://prod-redis.cache.amazonaws.com:6379
JWT_SECRET=super-secret-jwt-key-min-32-chars
ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

**Verification**:
- [ ] `.env` added to `.gitignore`
- [ ] `git log` shows no commits with ENCRYPTION_KEY or JWT_SECRET
- [ ] Production deployment uses secrets manager (AWS Secrets Manager / Azure Key Vault)

---

## 3. Authentication & JWT Strategy

### 3.1 JWT Token Structure (MANDATORY)
**Requirement**: JWT payload must include tenant context for every request validation.

**JWT Payload**:
```json
{
  "sub": "user-uuid-id",
  "email": "user@example.com",
  "tenantId": "agency-uuid-id",
  "clientId": "client-uuid-id (optional)",
  "storeId": "store-uuid-id (optional)",
  "role": "admin | manager | staff",
  "permissions": ["product:create", "order:read", "order:update:status"],
  "iat": 1704067200,
  "exp": 1704070800,
  "iss": "kroptosapi"
}
```

**Implementation**:
```typescript
// src/auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
      permissions: payload.permissions,
    };
  }
}

// JWT signing on login
@Service()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(user: User, tenantId: string) {
    const permissions = await this.getRolePermissions(user.id, tenantId);
    
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId,
      role: user.role,
      permissions,
    };

    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: '1h',
      }),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: '7d',
      }),
    };
  }
}
```

**Verification**:
- [ ] Decode JWT at jwt.io: payload contains tenantId
- [ ] Change tenantId in token → signature invalid
- [ ] Token older than 1 hour (accessToken) → 401 Unauthorized

### 3.2 Refresh Token Rotation (RECOMMENDED)
**Requirement**: Refresh tokens are revoked after use; new refresh token issued.

**Implementation**:
```typescript
// Database: refresh_tokens table
// ├─ id, user_id, token_hash, expires_at, created_at

@Service()
export class RefreshTokenService {
  async issueRefreshToken(user: User) {
    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: '7d' }
    );

    const tokenHash = hash(refreshToken); // bcrypt hash
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return refreshToken;
  }

  async rotateRefreshToken(oldToken: string) {
    const payload = this.jwtService.verify(oldToken);
    const tokenHash = hash(oldToken);

    // Check if token exists and not expired
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) throw new UnauthorizedException('Invalid refresh token');

    // Revoke old token
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Issue new tokens
    return this.issueRefreshToken(await this.prisma.user.findUnique({
      where: { id: payload.sub }
    }));
  }
}
```

**Verification**:
- [ ] Use refresh token once → success
- [ ] Try reusing same token → 401 Unauthorized

### 3.3 Password Security (MANDATORY)
**Requirement**: Passwords hashed with bcrypt (minimum 10 salt rounds).

**Implementation**:
```typescript
import * as bcrypt from 'bcrypt';

@Service()
export class UserService {
  async hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, 10); // 10 rounds
  }

  async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  async createUser(email: string, password: string) {
    const passwordHash = await this.hashPassword(password);
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    return user;
  }
}
```

**Verification**:
- [ ] `hashPassword('test')` → different hash each time
- [ ] `verifyPassword('test', hash)` → true
- [ ] `verifyPassword('wrong', hash)` → false
- [ ] Database shows no plaintext passwords

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Permission Matrix (MANDATORY)
**Requirement**: All data access validated against role permissions.

| Role | Product CRUD | Order Create | Order Update Status | User Mgmt | Agency Edit |
|------|--------------|--------------|---------------------|-----------|-------------|
| Super Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Agency Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Client Manager | ✓ | ✓ | ✓ | (own store) | ✗ |
| Store Manager | ✓ | ✓ | ✓ | (own store) | ✗ |
| Warehouse Staff | ✓ (view) | ✓ (view) | ✓ | ✗ | ✗ |
| Sales Rep | ✓ (view) | ✓ | ✗ | ✗ | ✗ |

**Implementation**:
```typescript
// src/rbac/decorators/require-permission.decorator.ts
export const RequirePermission = (permission: string) =>
  SetMetadata('permission', permission);

// src/rbac/guards/permission.guard.ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private rbacService: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );
    if (!permission) return true; // No permission required

    const request = context.switchToHttp().getRequest();
    const { userId, tenantId } = request;

    const hasPermission = await this.rbacService.hasPermission(
      userId,
      tenantId,
      permission,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `User lacks permission: ${permission}`
      );
    }

    return true;
  }
}

// Usage in controller
@Controller('/products')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductController {
  @Post()
  @RequirePermission('product:create')
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Patch(':id/archive')
  @RequirePermission('product:delete')
  delete(@Param('id') id: string) {
    return this.productService.softDelete(id);
  }
}
```

**Verification**:
- [ ] User without "product:create" tries POST /products → 403 Forbidden
- [ ] User with "product:create" role → 201 Created
- [ ] Admin always has all permissions

### 4.2 Audit Trail for RBAC Changes (MANDATORY)
**Requirement**: Any role/permission changes logged with user, timestamp, old/new values.

**Implementation**:
```typescript
// src/audit/interceptors/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const { method, path } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (data) => {
        const duration = Date.now() - startTime;

        // Log mutation operations
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          await this.auditService.log({
            entityType: path.split('/')[1], // Extract from path
            entityId: request.params.id,
            action: this.mapMethodToAction(method),
            changes: {
              oldValue: request.body.__old, // Set by business logic
              newValue: data,
            },
            performedBy: request.user.userId,
            performedAt: new Date(),
            ipAddress: request.ip,
          });
        }
      }),
    );
  }

  private mapMethodToAction(method: string) {
    return method === 'POST' ? 'create'
         : method === 'DELETE' ? 'delete'
         : 'update';
  }
}
```

**Verification**:
- [ ] Create user with role "Manager" → audit log shows action: "create", newValue: {role: "Manager"}
- [ ] Change user role to "Admin" → audit log shows changes: {role: {old: "Manager", new: "Admin"}}
- [ ] Query audit logs by entity_id → shows all mutations in chronological order

---

## 5. Input Validation & Injection Prevention

### 5.1 DTO Validation (MANDATORY)
**Requirement**: All request bodies validated using class-validator.

**Implementation**:
```typescript
// src/products/dto/create-product.dto.ts
import { IsString, IsNumber, IsOptional, Min, Max, Length } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @Length(1, 50)
  sku: string;

  @IsString()
  @Length(1, 255)
  name: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsOptional()
  @IsString()
  description?: string;
}

// In controller
@Controller('/products')
export class ProductController {
  @Post()
  create(@Body(new ValidationPipe()) dto: CreateProductDto) {
    return this.productService.create(dto);
  }
}
```

**Verification**:
- [ ] POST with `name: "<script>alert('xss')</script>"` → 400 Bad Request (sanitized)
- [ ] POST with `basePrice: "not-a-number"` → 400 Bad Request
- [ ] POST with valid DTO → 201 Created

### 5.2 SQL Injection Prevention (MANDATORY)
**Requirement**: Use Prisma ORM with parameterized queries; no raw SQL concatenation.

**DANGEROUS (Do NOT do this)**:
```typescript
// ❌ VULNERABLE
const query = `SELECT * FROM products WHERE name = '${productName}'`;
await prisma.$queryRaw(query);
```

**SAFE (Prisma way)**:
```typescript
// ✓ SAFE
const products = await prisma.product.findMany({
  where: {
    name: productName, // Parameterized
  },
});

// For complex queries
const products = await prisma.$queryRaw`
  SELECT * FROM products 
  WHERE name = ${productName} AND agency_id = ${agencyId}
`;
```

**Verification**:
- [ ] Try search with `'; DROP TABLE products; --` → query fails safely
- [ ] Normal search works correctly

---

## 6. HTTPS & Transport Security

### 6.1 HTTPS Enforcement (MANDATORY in Production)
**Requirement**: All production traffic encrypted.

**.env configuration**:
```
NODE_ENV=production
HTTPS=true
SSL_KEY_PATH=/etc/ssl/private/key.pem
SSL_CERT_PATH=/etc/ssl/private/cert.pem
```

**NestJS setup**:
```typescript
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    httpsOptions: process.env.NODE_ENV === 'production' ? {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
    } : undefined,
  });

  await app.listen(3001);
}
```

**Verification**:
- [ ] `https://yourapi.com/api/docs` loads securely
- [ ] `curl -I https://yourapi.com` shows `HTTP/2` or `HTTP/1.1`
- [ ] Redirect HTTP → HTTPS enabled

### 6.2 CORS Configuration (MANDATORY)
**Requirement**: CORS restricted to trusted origins.

**Configuration**:
```typescript
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000', // Local dev
      'https://yourdomain.com', // Production
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
});
```

**Verification**:
- [ ] Request from allowed origin → success
- [ ] Request from blocked origin → CORS error
- [ ] Preflight OPTIONS request succeeds

---

## 7. Rate Limiting & DoS Protection

### 7.1 Request Rate Limiting (RECOMMENDED)
**Requirement**: Prevent brute-force and DoS attacks.

**Implementation (using @nestjs/throttler)**:
```typescript
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // 60 seconds
      limit: 100, // 100 requests per minute
    }),
  ],
})
export class AppModule {}

// Apply globally
@UseGuards(ThrottlerGuard)
@Controller()
export class AppController {}

// Or per endpoint
@Post('/auth/login')
@Throttle(5, 60) // 5 attempts per 60 seconds
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

**Verification**:
- [ ] Exceed rate limit → 429 Too Many Requests
- [ ] Reset after TTL → requests allowed again

---

## 8. Logging & Monitoring

### 8.1 Secure Logging (MANDATORY)
**Requirement**: Never log sensitive data (passwords, API keys, tokens).

**Implementation (using Pino)**:
```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger();

// ✓ SAFE
logger.log(`User ${userId} logged in successfully`);

// ❌ DANGEROUS
logger.log(`User logged in with password: ${password}`); // Never!
```

**Production logging**:
```typescript
import * as pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['password', 'apiKey', 'apiSecret', 'refreshToken', 'accessToken'],
    censor: '[REDACTED]',
  },
});

// Logs automatically redact sensitive fields
```

**Verification**:
- [ ] Check log files: no plaintext passwords
- [ ] Check log files: no JWT tokens
- [ ] Sensitive fields show as `[REDACTED]`

### 8.2 Error Handling (MANDATORY)
**Requirement**: Never expose stack traces or internal details to client.

**Implementation**:
```typescript
// src/common/filters/http-exception.filter.ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ExecutionContext) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    // Production: minimal error info
    if (process.env.NODE_ENV === 'production') {
      return response.status(status).json({
        statusCode: status,
        message: exception.message,
        requestId: generateRequestId(), // For support
      });
    }

    // Development: detailed error
    return response.status(status).json(exception.getResponse());
  }
}
```

**Verification**:
- [ ] Production error → does not show stack trace
- [ ] Development error → shows helpful details

---

## 9. Dependency Management

### 9.1 Dependency Scanning (RECOMMENDED)
**Requirement**: Regular scan for vulnerable dependencies.

**Setup (npm audit)**:
```bash
npm install -g npm-audit-resolver
npm audit
npm audit fix
```

**In CI/CD**:
```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm audit --audit-level=moderate
```

**Verification**:
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] CI/CD pipeline blocks PR if audit fails

---

## 10. Security Deployment Checklist

### Pre-Production
- [ ] All 10 security sections implemented
- [ ] Security audit by external third party (recommended)
- [ ] Penetration testing completed
- [ ] Secrets stored in environment variables, not committed
- [ ] HTTPS certificates purchased & configured
- [ ] Database backups configured & tested
- [ ] Error handling hides stack traces
- [ ] Logging redacts sensitive data
- [ ] Rate limiting enabled on auth endpoints

### Deployment Day
- [ ] Terraform/Infrastructure as Code reviewed
- [ ] Database migrations dry-run successful
- [ ] Monitoring & alerting enabled
- [ ] Incident response plan documented
- [ ] Team trained on security procedures
- [ ] Load test completed (no security issues under stress)

### Post-Deployment
- [ ] Monitor logs for unusual activity
- [ ] Set up daily dependency vulnerability scans
- [ ] Regular security patches (monthly minimum)
- [ ] Incident response drills scheduled

---

## References
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- JWT Best Practices: https://tools.ietf.org/html/rfc8949
- Prisma Security: https://www.prisma.io/docs/concepts/database/introspection
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
