# SECURITY_CHECKLIST.md - KroptOS Security Requirements & Implementation Guide

## Executive Summary
KroptOS handles sensitive commerce data for multiple tenants. **Zero tolerance for cross-tenant data leaks**. All security requirements are **mandatory** for production deployment.

> **Durum (2026-09-16, `feature/multi-user`):** 1, 3 ve 4. bölümler **uygulanan** kodu
> anlatır (P1–P12, kanıtlar commit gövdelerinde). 2, 5–10. bölümler gereksinim şablonudur;
> uygulamayla birebir örtüşmeyen kod örnekleri içerebilir, kaynak koda göre okuyun.

---

## 1. Multi-Tenant Isolation

Hiyerarşi **ajans → client → mağaza**. Üstteki rol alttaki her şeyi kapsar
(CLAUDE.md Kural 3). İzolasyon üç kilitle sağlanır; hiçbiri diğerinin yerine geçmez:

| Kilit | Nerede | Ne yapar |
|---|---|---|
| 1. Bağlam doğrulama | `common/middleware/tenant.middleware.ts` | `x-agency-id / x-client-id / x-store-id` header'larını JWT'nin kullanıcısının **kapsayan** rolüne karşı doğrular (`buildUserRoleScopeWhere`), `req.activeAgency/activeClient/activeStore` yazar; kapsam dışı → 403 |
| 2. Uygulama katmanı kapsaması | her servis | `agencyId` (ve varsa client/store) **where**'de; include'lar da kapsanır; başka kiracının kaydı **404** (403 değil — varlık oracle'ı yok) |
| 3. Postgres RLS | `prisma/scripts/p12-rls-0*.sql` + `common/prisma/prisma.service.ts` | 68 tabloda satır seviyesi politika; uygulama filtresi unutulsa bile satır gelmez / yazılamaz |

### 1.1 Tenant Middleware (UYGULANDI)
- Ham header **asla** tenant filtresi değildir (Kural 2). Filtre yalnız `TenantMiddleware`'in
  yazdığı `req.activeAgency` ya da JWT'den okunur. Servislere aktör `actorFromRequest(req)`
  (`modules/rbac/rbac.service.ts`) ile geçer; agencyId yoksa 400.
- İstek gövdesinden tenant alanı **alınmaz**: `Create*Dto`'larda `agencyId/clientId/storeId`
  yok (Category, Integration, Client, Store — P12a/P12b); `ValidationPipe`
  `forbidNonWhitelisted` gövdede gelirse **400**. Kapsam seçimi gerektiren DTO'lar
  (`AssignRoleDto`, `ChangeUserRoleDto`, `CreateInvitationDto`) yalnız aktif ajans içinde
  client/store seçer ve doğrulanır.
- Bilinen açık (rapor): `accounting.dto` gövde `storeId/clientId` öncelikli (agencyId
  controller'da ezilir); `agent CreateEnrollmentCodeDto.clientId` ajansa ait olduğu
  doğrulanmıyor. Muhasebe/agent modülü ayrı iş.

**Doğrulama**
- [x] Token yok → 401; geçersiz → 401 (`JwtStrategy`, her istekte DB/cache doğrulamalı)
- [x] Geçerli token, kapsam dışı `x-agency-id` → 403 (`test/tenant-isolation.e2e-spec.ts`)
- [x] Gövdede `agencyId=B` ile POST /clients, /stores, /categories, /integrations → 400; B'de satır yok

### 1.2 Row-Level Security (UYGULANDI — P12 Adım 2, aşamalı)
**DB tarafı** (`prisma/scripts/`, psql ile uygulanır; migrations dizini YOK, `pnpm db:push` "already in sync" verir):
- `p12-rls-00-role.sql`: uygulama rolü **`kroptos_app` LOGIN NOSUPERUSER NOBYPASSRLS**,
  tabloların sahibi değil (sahip = postgres). Yardımcı fonksiyon:
  ```sql
  app_rls_allowed(col) = current_setting('app.rls_bypass', true) = 'on'
                      OR (col IS NOT NULL AND col = current_setting('app.agency_id', true))
  ```
- `p12-rls-01..04-wave*.sql`: 4 dalga, her tabloda `ENABLE ROW LEVEL SECURITY` + tek
  `FOR ALL` politikası, **USING ve WITH CHECK aynı koşul** (okuma kadar yazma da kapalı).
  - 54 `agencyId` tablosu doğrudan; `AuditLog` (Prisma `tenantId` → DB kolonu `agencyId`) ve
    `IntegrationLog` (`tenantId`) kolon adıyla; `Role.agencyId IS NULL` (sistem rolleri) herkese
    görünür; `AuditLog`/`CarrierWebhookEvent` NULL satırları yalnız bypass görür.
  - `agencyId`'siz 12 çocuk tablo üst tablo üzerinden `EXISTS(... app_rls_allowed(üst.agencyId))`:
    OrderItem, OrderTimeline, InventoryAdjustment, IntegrationSettingRevision, ProductMapping,
    BundleItem, CrossSellProduct, WebhookEvent, StoreUser, WarehouseZone, WarehouseLocation,
    AccountingSyncCursor.
  - Geri alma: `ALTER TABLE "T" DISABLE ROW LEVEL SECURITY` (politika kalabilir).
- Bağlantılar: `DATABASE_URL` = `kroptos_app` (uygulama); `DATABASE_MIGRATION_URL` = superuser
  (şema `pnpm db:push`, seed `pnpm db:seed`, `prisma/scripts/*.ts`, psql). Superuser ve tablo
  sahibi RLS'i **her zaman** atlar; uygulama asla bu bağlantıyla çalışmaz.

**Uygulama tarafı** (`common/prisma/`):
- `tenant-context.ts`: AsyncLocalStorage bağlamı `{tenant, agencyId}` | `{system, reason}`;
  `runWithTenant(agencyId, fn)` / `runAsSystem(reason, fn)` — reason zorunlu, log'a düşer.
- `prisma.service.ts` (`$extends`): her işlem `[set_config('app.agency_id' | 'app.rls_bypass',
  …, true), işlem]` batch transaction'ı (`SET LOCAL` eşdeğeri); interactive/batch
  `$transaction` başında bir kez set. **Bağlam yoksa**: `WARN [PrismaRls] Query without tenant
  context: Model.op` (çağrı noktası başına dakikada bir) ve sorgu **bypass almadan** koşar →
  kiracı tabloları boş / yazma reddi. Sessiz filtresiz çalışma yok.
- İstek hattı: `RlsContextMiddleware` (TenantMiddleware'den **önce**) `system:request:pre-auth`
  açar — kiracı çözümü, `JwtStrategy`, `PermissionGuard` kiracı bilinmeden koşar;
  `RlsBindInterceptor` (global, guard'lardan sonra) `activeAgency ?? JWT.agencyId` → **tenant**,
  platform super admin (key `super_admin` **ve** `isSystem`, DB'den) → **system**.
- Bağlamsız yerler açık bağlam kurar: `integration-sync.worker` (agencyId `runAsSystem` ile tek
  sorguda çözülür, iş `runWithTenant`), `carrier-tracking.worker` (tarama sistem, grup başına
  kiracı), `accounting-sync.worker` (job.scope.agencyId), `agent-gateway` (hello sistem,
  sonrası Agent'ın ajansı). Tasarım gereği kiracılar arası okumalar: `auth.getMe`,
  `auth.switchTenant`, `agency.list/get`, `session.revokeForUserInTenant` → `runAsSystem`.

**Doğrulama** (hepsi `feature/multi-user` d258818'de canlı ölçüldü)
- [x] psql, `kroptos_app`: bağlamsız `SELECT count(*) FROM "Product"` → 0; `SET app.agency_id=A`
      → yalnız A; `SET LOCAL app.agency_id=A` iken `agencyId=B` INSERT → `42501 violates row-level security policy`
- [x] `pg_roles`: `kroptos_app` rolsuper=f rolbypassrls=f; `pg_stat_activity`: API bu rolle bağlı
- [x] HTTP: `product.get` uygulama katmanında id ile kapsamsız okuyup sonra 403 verir; A kullanıcısı
      B ürün id'si → **404** (satırı RLS gizledi; RLS istek hattına bağlı olmasa 403 olurdu)
- [x] `test/tenant-isolation.e2e-spec.ts`: uygulama filtresi kasıtlı kaldırılmış
      `product.findMany({ where: { id: B } })` A bağlamında boş; WITH CHECK reddi
- [x] Worker: BullMQ `sync_stock` job'ı kiracı bağlamında tamamlandı, ApiLog kiracıda, "not found" yok
- [x] API log'unda bağlamsız sorgu uyarısı 0 (probe ve worker koşuları boyunca)

### 1.3 Application-Level Access Control (UYGULANDI)
Kalıplar (CLAUDE.md Kural 1, 3, 7):
- **Kapsam where'e iner**, include'lara da: `where: { deletedAt: null, userRoles: { some: { agencyId } } }, include: { userRoles: { where: { agencyId } } }`.
- **Tekil okuma**: `findFirst({ where: { AND: [{ id, deletedAt: null }, scope] } })` → yoksa **404**.
  Client/mağaza kapsamlı bağlamda `scope` kendi id'sini taşır; spread ile parametreyi ezmesin (AND).
- **İlişkili id'ler**: bundle/cross-sell/varyant-ebeveyn (`assertProductsInAgency`) ve toplu işlemler:
  `count({ id: { in }, agencyId })` ≠ istenen → **403**, hiçbir yazma yok (sayım oracle olmasın).
- **Listeler aktif bağlamdır**, kullanıcının tüm ajansları değil (client/store list).
- Kullanılmayan kapsam parametresi = hata: `agencyId` imzada alınıp where'e konmamışsa sızıntıdır
  (`logo-stock`, `getProductMappings` vakaları).
- Mock'lu birim testi kanıt değildir; kiracı davranışı canlı ölçülür: satır sayısı → fixture →
  gerçek HTTP → `finally` sil → sayı başa döner (`pnpm test:integration`, `pnpm test:e2e`).

**Doğrulama**
- [x] A kullanıcısı B'nin category/integration/client/store/tenant id'si → 404 (5/5)
- [x] A kullanıcısı B'nin ürününü bundle/cross-sell/parent olarak veremez → 403, satır yok
- [x] Rol, izin, kullanıcı uçları aktif ajans dışını görmez/yazamaz (P5/P7 probe'ları)

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

### 3.1 JWT Token Structure (UYGULANDI)
Erişim token'ı 15 dk, yenileme 7 gün. **İzin listesi JWT'de taşınmaz** (P2): izinler her
istekte DB'den (60 sn Redis cache) çözülür; rol matrisi değişince token bayatlamaz.

```json
{ "sid": "<Session.id>", "userId": "…", "email": "…",
  "tenantId": "…", "agencyId": "…", "clientId": null, "storeId": null,
  "role": "<Role.key>", "roleIsSystem": true }
```
- `role` = `Role.key` (ad değil). Platform süper yöneticisi `isSuperAdminRole({ role, roleIsSystem })`:
  key `super_admin` **ve** `isSystem` — tenant'ın açtığı `super_admin` adlı rol bypass alamaz (P7);
  `PlatformAdminGuard` ayrıca e-posta allowlist'i ister.
- Birincil rol seçimi deterministik: `resolvePrimaryRole` (bağlam özgüllüğü > ROLE_PRIORITY >
  createdAt) — `findFirst` rastgeleliği yok (P1, Kural 4).
- `JwtStrategy.validate` her istekte `PermissionCacheService.getAccess`: kullanıcı aktif mi, silinmiş
  mi, token'ın bağlamını kapsayan rolü var mı; `roleIsSystem` **DB'den**. Başarısızlık **401**
  (403 değil: istemci 403'te bağlamı düşürüp yeniden dener, 401 oturumu temizler).
- `sid` → `Session` satırı (`tokenHash` = sha256(refresh), `lastUsedAt`); "mevcut oturum" işareti.

**Doğrulama**
- [x] Pasife alınan / rolü düşürülen kullanıcının eski access token'ı → 401 (e2e + P11 probe)
- [x] Tenant rolü `key='super_admin', isSystem=false` → B ürünü 404, B header'ı 403 (e2e)
- [x] Mağaza kapsamlı kullanıcı kilitlenmez: getMe brand girdisi + izinler, mağaza bağlamı 200 (P2.6)

### 3.2 Refresh Token Rotation & Session Revocation (UYGULANDI — P11)
- `POST /api/auth/refresh`: eski satır silinir, yeni çift verilir; pasif/silinmiş kullanıcı → 401.
- `SessionService`: `revokeAllForUser` (Session.isActive=false + RefreshToken sil +
  cache invalidate + audit `session.revoke`, **tenantId dolu**), `revokeOne` (başkasınınki 404),
  `revokeForUserInTenant` (başka ajansta rolü kalıyorsa oturumlar korunur — kiracılar arası
  soru, `runAsSystem`), `revokeForRole`.
- Tetikleyiciler: rol kaldırma / değiştirme / tenant'tan çıkarma, rol izin matrisi değişimi,
  `isActive=false`, şifre değişimi. Davet kabulünde yok.
- Uçlar: `GET/DELETE /api/system/sessions`, `DELETE /api/system/sessions/:id`,
  `DELETE /api/system/users/:id/sessions` (`users.manage`).

**Doğrulama**
- [x] Aynı refresh token ikinci kez → 401; pasif kullanıcı refresh → 401
- [x] Başkasının oturumu DELETE → 404; diğer oturumları kapat → `{revoked:n}` + audit kiracıyla

### 3.3 Password Security (UYGULANDI)
bcrypt 12 tur (`auth.service`); kural tek kaynak `@kroptos/shared` `passwordProblem`
(`PASSWORD_MIN_LENGTH=8`), davet kabulü ve profil şifre değişimi aynı kuralı kullanır.

### 3.4 Invitation Flow (UYGULANDI — P6/P9)
- `POST /api/system/invitations` (`users.manage`): davet **aktif ajans** içinde; client/store
  kapsamı doğrulanır; token DB'de yalnız sha256 hash; bekleyen davet varsa yenisi açılmaz.
- Public `GET /api/invitations/:token`, `POST /api/invitations/:token/accept` (guard yok,
  `publicRoutes`; rate limit); kabul → UserRole yazılır, `StoreUser` **yazılmaz**; oturum çifti döner.
- `devInviteUrl` yalnız `NODE_ENV !== 'production'` (TODO: gerçek mail sağlayıcısında kaldır).

**Doğrulama**
- [x] Token ikinci kez kabul → 4xx, tek UserRole (e2e)
- [x] `POST /api/auth/register` → rol `agency_owner` (e2e, P1)

---

## 4. Role-Based Access Control (RBAC)

### 4.1 Permission Catalog & Guard (UYGULANDI — P4/P7)
- **Tek kaynak** `packages/shared/src/permissions.ts`: 66 izin `kaynak.aksiyon` biçiminde
  (`products.read`, `orders.update`; iki nokta kalıbı YOK), `PERMISSION_CATEGORIES`,
  `DEFAULT_ROLES` 9 sistem rolü (`super_admin`, `agency_owner`, `agency_admin`, `client_manager`,
  `store_manager`, `warehouse_staff`, `sales_rep`, `viewer`, …), `SYSTEM_ROLE_KEYS`. Seed oradan okur;
  `@RequirePermission` ile kullanılan her izin katalogda **tanımlı** olmalı (Kural 5).
- `Role`: `agencyId NULL + isSystem` = sistem rolü (dokunulmaz); `agencyId dolu` = ajansın özel rolü.
  Partial unique index'ler (`role_system_key_uq`, `role_agency_key_uq`, `userrole_scope_uq`) yalnız
  SQL'de (`prisma/scripts/p3-role-schema.sql`).
- `PermissionGuard` (`common/guards/permission.guard.ts`): izinler DB/cache'ten
  (`perm:{userId}:{agencyId}:{clientId|-}:{storeId|-}`), kapsayan rollerin **birleşimi**;
  `*:*` yalnız sistem `super_admin`. Eksik izin → 403.
- `RolesService` sınırları: sistem rolü PATCH/DELETE → 403; başka ajansın rolü → 404;
  rezerve key'ler ve `'*:*'` tenant rolüne verilmez; **escalation**: aktör sahip olmadığı izni
  veremez (`assertCanGrant`); izin matrisi değişince role bağlı herkesin oturumu kapanır.
- `RbacService.assignRole/revokeRole`: rol sistem-ya-da-kendi-ajansı (yoksa 404),
  `super_admin` atanamaz (403), kendi rolünü kaldırma 400, **son `agency_owner`** kaldırılamaz /
  pasife alınamaz (400); atama kapsamı (client/store) aktif ajans içinde doğrulanır.

**Doğrulama**
- [x] Yabancı rol atama 404, super_admin atama 403, self-revoke 400, son sahip 400 (probe + e2e)
- [x] Yabancı rol PATCH 404, sistem rolü PATCH 403, `*:*` 403 (probe + e2e)
- [x] `permission.guard.integration-spec`: gerçek DB'de kapsama (ajans → client → mağaza)

### 4.2 Audit Trail (UYGULANDI, konsolidasyon açık)
- Her mutasyon kendi transaction'ında `auditLog.create` ile yazılır (`tx: Prisma.TransactionClient`,
  `any` değil); alan adları şemadan: `tenantId` (DB kolonu `agencyId`), `userId`, `entityType`,
  `entityId`, `action`, `oldValue/newValue`. **try/catch yok**: audit yazılamıyorsa mutasyon
  geri alınır (P5 bulgusu). RLS altında `tenantId` boş audit satırı kiracı bağlamında **reddedilir**
  (42501) — sessiz kayıp yerine hata.
- Rol/atama/oturum olayları: `role.create|update|delete` (izin diff'i `added/removed`),
  `rbac.assign|revoke`, `session.revoke`, `user.*`, `invitation.*`.
- Açık: bazı eski servisler hâlâ `AuditLogService.createLog` (try/catch'li) kullanıyor;
  `profile.service` rol adını (`'owner'`) key yerine karşılaştırıyor — ayrı iş.

**Doğrulama**
- [x] Oturum kapatma / rol değişimi audit satırı kiracıyla (P11h probe)
- [x] `datev-export` / accounting audit aktörü `user.userId` (P12b 0b; önceden hep boştu)

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

## 11. Doğrulama Komutları (kiracı izolasyonu)

```bash
# packages/backend
pnpm test                                   # birim (mock'lu; kanıt değil, regresyon)
pnpm test:integration                       # canlı Postgres: guard zinciri, order/shipment kapsamı
API_PORT=3101 CORS_ORIGINS=http://localhost:3100 node dist/main.js &
pnpm test:e2e                               # gerçek HTTP + RLS: test/tenant-isolation.e2e-spec.ts
pnpm db:push                                # superuser (DATABASE_MIGRATION_URL); "already in sync" beklenir
psql "$DATABASE_MIGRATION_URL" -c "select rolname, rolsuper, rolbypassrls from pg_roles where rolname='kroptos_app'"   # f / f
```
Her kanıt: satır sayısı al → fixture → gerçek çağrı → `finally` sil → sayı başa döndü (CLAUDE.md Kural 7).

## References
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- JWT Best Practices: https://tools.ietf.org/html/rfc8949
- Prisma Security: https://www.prisma.io/docs/concepts/database/introspection
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
