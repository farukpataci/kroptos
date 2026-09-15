# KroptOS — Çok Kullanıcılı Yapı: Claude Code Prompt Seti (v2, P0 sonrası)

> v1'i at. Bu sürüm P0 durum tespitindeki gerçek bulgulara göre yazıldı.
> Değişenler: guard zinciri (TenantGuard yok), permission kataloğu (backend zaten tutarlı),
> users modülü (var, genişletilecek), sıralama (güvenlik yaması öne alındı).

## Ortak kurallar — her prompta kopyala

```
Konvansiyon kaynağı CLAUDE.md'deki 8 Kalıp Kuralı. Repoda kroptos-konvansiyonlari
skill'i YOK, onu arama.

Guard zinciri: @UseGuards(AuthGuard('jwt'), PermissionGuard) + @RequirePermission(...).
TenantGuard diye bir şey YOK — tenant bağlamı common/middleware/tenant.middleware.ts
tarafından forRoutes('*') ile çözülüp req.user / req.activeAgency / req.activeClient /
req.activeStore olarak yazılıyor. Yeni controller'larda bunu varsay.

Soft delete deletedAt ile. Her mutasyonda auditLog. Tekil erişimde findFirst + tenant scope.
Frontend'de veri erişimi yalnız @/lib/api → apiFetch. Stil yalnız kp-* token'ları.
```

## Sıra ve bağımlılık

```
P1 güvenlik yaması ──┬─ P2 guard birleştirme ──┬─ P3 şema ─┬─ P4 izin kataloğu
                     │                          │           ├─ P5 users API ─┬─ P8 users UI
                     │                          │           ├─ P6 invite API ─┼─ P9 invite UI
                     │                          │           └─ P7 roles API ──┤
                     │                          │                              └─ P10 usePermission
                     └──────────────────────────┴─ P11 session ─ P12 RLS + e2e
```

P1 ve P2 **bugün** yapılmalı, geri kalanı bekleyebilir.

---

## P1 — Kritik: register yetki yükseltmesi + rol seçimi determinizmi

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy.

BAĞLAM — CANLI GÜVENLİK AÇIĞI
packages/backend/src/modules/auth/auth.service.ts:141-171 içinde register akışı,
kayıt olan HER kullanıcıya super_admin rolü veriyor. Seed'de super_admin'in izni "*:*".
Bu rol aynı zamanda üç ayrı yerde string bazlı bypass tetikliyor:
permission.guard.ts, rbac.guard.ts, tenant.middleware.ts (+ UsersController.checkSuperAdmin).
Yani açık kayıt formu = platform çapında tam yetki dağıtımı.

Ayrıca auth.service.ts:280 (login) ve :637 (getMe) userRoles[0]'ı orderBy olmadan alıyor.
Çok ajanslı kullanıcı her girişte rastgele bir ajansa ve rastgele bir rol string'ine iniyor;
super_admin bypass'ı tam da bu string'e bağlı olduğu için davranış nondeterministik.

YAPILACAKLAR

1. register: super_admin yerine agency_owner rolünü ata.
   - Rol seed'de yoksa oluşturma; seed'deki agency_owner'ı bul, yoksa hata fırlat
     (sessizce super_admin'e düşme).
   - agency_owner ajansı, client'ları, store'ları, kullanıcıları ve ekibi yönetebilmeli
     ama platform seviyesinde hiçbir şeye erişememeli.

2. super_admin'i platform rolü yap:
   - Yalnız seed ile atanır, hiçbir runtime akışı bu rolü veremez.
   - UserRole.roleId super_admin olan bir kayıt oluşturulmaya çalışılırsa
     servis katmanında ForbiddenException.

3. Backfill script'i (prisma/scripts/backfill-super-admin.ts):
   - super_admin UserRole kayıtlarını listele.
   - PLATFORM_ADMIN_EMAILS allowlist'inde OLMAYAN her kaydı agency_owner'a çevir.
   - Çalışmadan önce kaç kayıt etkileneceğini yazdır, --apply bayrağı olmadan dry-run yap.
   - Sonucu audit log'a yaz.

4. Primary role seçimini deterministik yap:
   - Ortak bir resolvePrimaryRole(userRoles) helper'ı yaz.
   - Sıralama: (a) aktif tenant bağlamıyla tam eşleşen rol, yoksa
     (b) rol önceliği (super_admin > agency_owner > agency_admin > client_admin >
     store_manager > accountant > warehouse_staff > support > viewer), eşitlikte
     (c) createdAt ASC.
   - login, getMe ve switch-tenant üçü de bu helper'ı kullansın.

5. 'Super Admin' (boşluklu) ölü dalını temizle:
   - 5 yerdeki string karşılaştırmasını kaldır, hepsi mevcut isSuperAdminRole() helper'ını
     çağırsın. Helper'ı tek bir yerde (common/utils/) tut ve export et.

TEST
- auth.service.spec.ts: register sonrası atanan rolün agency_owner olduğu
- super_admin atamaya çalışan servis çağrısının reddedildiği
- resolvePrimaryRole'ün üç senaryosu (tam eşleşme / öncelik / createdAt tiebreak)
- Backfill script'inin dry-run'da hiçbir şey yazmadığı

YAPMA
- Bu PR'da başka hiçbir şeye dokunma. Küçük, hızlı merge edilebilir kalsın.
- Backfill'i migration'a gömme, ayrı çalıştırılabilir script olsun.
```

---

## P2 — Guard çatalını kapat + kapsama semantiğini düzelt

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy.

BAĞLAM — İKİ AYRI HATA

(a) Guard çatalı: Agency/Client/Store controller'ları RbacGuard kullanıyor; bu guard izni
JWT içindeki permissions[] dizisinden okuyor, yani login/switch anındaki snapshot'tan.
Diğer 37 controller PermissionGuard ile DB'den canlı okuyor. Sonuç: bir kullanıcının rolü
geri alındıktan sonra token süresi dolana kadar clients.create çalışmaya devam ediyor.
(repo notu: rbac-guard-vs-permission-guard-fork)

(b) PermissionGuard kapsama hatası, permission.guard.ts:36-42:
UserRole araması { userId, agencyId, clientId: user.clientId || null, deletedAt: null }.
- clientId tam eşitlik aranıyor → token client bağlamındayken (clientId dolu) ajans geneli
  rol (clientId: null) elenir ve kullanıcı hatalı 403 alır.
- storeId filtresi hiç yok → mağaza kapsamlı rol ajans genelinde geçerli sayılır.
auth.service.ts'in switchTenant'ındaki OR kapsama bloğu doğru mantığı zaten içeriyor;
guard onunla aynı olmalı.

YAPILACAKLAR

1. RbacGuard'ı kaldır:
   - Agency/Client/Store controller'larını PermissionGuard'a geçir.
   - @Roles dekoratörü kod tabanında 0 yerde kullanılıyor; dekoratörü ve guard'ı sil.
   - JWT payload'ından permissions[] alanını çıkar (token şişiyor ve yanıltıcı).
     JwtStrategy ve generateTokens buna göre güncellensin.
   - PlatformAdminGuard kalsın, o ayrı bir sorumluluk.

2. Kapsama çözümlemesini ortak bir helper'a çıkar:
   common/utils/tenant-scope.ts → buildUserRoleScopeWhere({ userId, agencyId, clientId, storeId })
   Hiyerarşik OR üretsin:
     - { agencyId, clientId, storeId }            (tam eşleşme)
     - { agencyId, clientId, storeId: null }      (client geneli)
     - { agencyId, clientId: null, storeId: null } (ajans geneli)
   PermissionGuard, tenant.middleware ve auth.service.switchTenant üçü de bunu kullansın.
   Birden fazla rol eşleşirse izinlerin BİRLEŞİMİ alınsın (en dar değil, en geniş).

3. findFirst yerine findMany + izin union'ı (Kural 4). Tek rol varsayımını bırak.

4. super_admin bypass'ını isSuperAdminRole() üzerinden yap (P1'de merkezileştirilen helper).

5. Yetki çözümlemesini Redis'te cache'le:
   - key: perm:{userId}:{agencyId}:{clientId ?? '-'}:{storeId ?? '-'}, TTL 60 sn
   - common/services/permission-cache.service.ts:
     invalidateUser(userId) / invalidateRole(roleId) / invalidateAgency(agencyId)
   - In-memory Map KULLANMA, çok instance'lı ortamda tutarsız olur.

TEST
permission.guard.spec.ts:
- Ajans geneli rolü olan kullanıcı client bağlamında 403 ALMIYOR (mevcut hatanın regresyonu)
- Mağaza kapsamlı rol, başka mağaza bağlamında yetki VERMİYOR
- İki rol eşleşince izinler birleşiyor
- Rol revoke edildikten en geç 60 sn sonra 403
e2e: rolü geri alınan kullanıcının eski token'ıyla POST /api/clients → 403

YAPMA
- tenant.middleware'in sorumluluğunu guard'a taşıma, ikisi ayrı katman kalacak
- JWT ömrünü bu PR'da değiştirme (P11'in işi)
```

---

## P3 — Prisma şeması: tenant-scoped Role, UserRole unique fix, Invitation

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy. packages/backend/prisma/schema.prisma.

BAĞLAM — ÜÇ ŞEMA SORUNU
(a) Role.name global @unique (schema.prisma:173), Role'de agencyId yok → iki ajans
    aynı isimde özel rol tanımlayamıyor. Frontend'de "Yeni Rol Ekle" UI'ı var ama
    şema bunu desteklemiyor.
(b) UserRole @@unique([userId, agencyId, roleId]) — storeId ve clientId unique'e dahil değil.
    Aynı kullanıcıya aynı ajansta aynı rolü iki farklı mağaza için vermek imkânsız;
    rbac.service.ts:112-121 ikinci atamada var olan satırın storeId'sini SESSİZCE eziyor.
(c) Invitation modeli yok.

YAPILACAKLAR

1. Role:
   - agencyId String? + Agency ilişkisi (onDelete: Cascade), null = sistem rolü
   - key String (makine adı, mevcut name değerleri buraya taşınacak)
   - name String (görünen ad, artık @unique DEĞİL)
   - isSystem Boolean @default(false)
   - deletedAt DateTime?, updatedAt DateTime @updatedAt
   - @@unique([agencyId, key]), @@index([agencyId])
   - Agency modeline roles Role[] ters ilişkisi

2. Permission:
   - category String @default("") — UI'da kategori gruplaması için
   - Permission GLOBAL kalır, tenant'a bağlanmaz

3. UserRole:
   - @@unique([userId, agencyId, roleId]) → @@unique([userId, agencyId, clientId, storeId, roleId])
   - DİKKAT: PostgreSQL'de NULL'lar unique constraint'te eşit sayılmaz, yani
     (u1, a1, null, null, r1) iki kez eklenebilir. Bunu önlemek için nullable alanlar
     için COALESCE'lı partial unique index kullan (ham SQL migration) VEYA
     clientId/storeId yerine '-' sentinel değeri kullanma — birincisini tercih et.
   - updatedAt DateTime @updatedAt

4. Yeni model Invitation:
   id, agencyId, clientId?, storeId?, email, roleId,
   tokenHash String @unique, invitedBy String,
   status String @default("pending"),   // pending | accepted | revoked | expired
   expiresAt DateTime, acceptedAt DateTime?, createdAt, updatedAt
   @@index([agencyId]) @@index([email]) @@index([status])
   Agency ilişkisi onDelete: Cascade

5. Migration — iki aşamalı, backfill zorunlu:
   Aşama 1: kolonları nullable ekle, Role.key'i mevcut name'den türet
            (lowercase, boşluk → alt çizgi), 9 seed rolüne isSystem=true, agencyId=NULL
   Aşama 2: constraint'leri ekle
   UserRole unique değişiminde önce mevcut çakışan satırları raporla,
   varsa migration'ı durdur ve bana bildir.

KABUL KRİTERLERİ
- pnpm db:migrate temiz, seed verisi kayıpsız, npx prisma validate hatasız
- pnpm build (backend) yeşil
- Aynı kullanıcıya iki farklı mağaza için store_manager verilebiliyor (manuel doğrulama)

YAPMA
- eticaret-system/ altındaki şemaya dokunma
- StoreUser modelini bu PR'da elden geçirme (UserRole ile örtüşüyor, ayrı iş)
```

---

## P4 — İzin kataloğunu shared'a taşı + gerçek boşlukları kapat

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy.

BAĞLAM — ÖNEMLİ DÜZELTME
Backend permission kataloğu ZATEN TUTARLI: 50 farklı @RequirePermission değerinin hepsi
seed.ts'te tanımlı (58 izin, 9 rol). Toplu yeniden adlandırma GEREKMİYOR ve yapılmamalı.
Sorun tek taraflı: frontend'de RoleList.tsx'in PERMISSION_GROUPS sabiti (16 anahtar,
yalnız 2'si backend'le eşleşiyor) ve UsersTable.tsx'in ROLES sabiti
(['super_admin','admin','manager','user','viewer'] — admin/manager/user seed'de yok).

Kanon = backend seed'i. Frontend ona uyacak.

YAPILACAKLAR

1. packages/shared/src/permissions.ts:
   - seed.ts'teki 58 izni tek kaynak olarak taşı: { key, name, description, category }
   - PermissionKey type'ını as const + typeof ile türet
   - Kategoriler: Katalog, Envanter & Depo, Sipariş & Sevkiyat, Entegrasyon,
     Muhasebe, Analitik, Kiracı Yönetimi, Sistem
   - DEFAULT_ROLES: seed'deki 9 rol, her biri { key, name, description, permissions[] }
   - index.ts'ten export et

2. seed.ts'i bu dosyadan besle. Seed idempotent kalsın (upsert, silme yok).

3. GERÇEK boşlukları kapat (bunlar frontend uydurması değil, backend eksiği):
   - products.update ekle → ürün güncelleme uçları şu an products.create istiyor, yanlış
   - products.delete ekle
   - orders.cancel ekle
   - integrations.sync ekle (şu an integrations.manage altında, ayrılması istenen bir aksiyon)
   Her birini ilgili controller'da @RequirePermission olarak bağla ve
   DEFAULT_ROLES'ta uygun rollere dağıt.
   Geriye dönük uyumluluk: eski izni olan roller yeni izni de alsın (backfill script'i).

4. Kullanılmayan 7 izni ele al:
   accounting.documents.create, accounting.documents.read, accounting.export,
   accounting.invoice.push, clients.read, stores.read, wms.manage
   - clients.read / stores.read: ilgili GET uçlarına BAĞLA (şu an agencies.read istiyorlar,
     bu fazla geniş)
   - accounting.* ve wms.manage: henüz uç yoksa katalogda kalsın,
     permissions.ts'te deprecated: false ama unusedYet: true şeklinde işaretle

5. agency_owner'a users.manage iznini ekle (yeni izin, P5'te kullanılacak).
   Şu an agency_owner'ın 54 izni var ama agencies.create yok — bu yüzden
   /api/rbac/assign|revoke'u çağıramıyor, yani ajans sahibi kendi ekibine rol veremiyor.
   users.manage + users.view izinlerini ekle ve agency_owner + agency_admin'e ver.

6. Frontend: RoleList.tsx'teki PERMISSION_GROUPS ve UsersTable.tsx'teki ROLES sabitlerini
   SİL, ikisini de @kroptos/shared'dan import et. (Ekranların API'ye bağlanması P8'in işi,
   bu adımda sadece sabitleri hizala.)

KABUL KRİTERLERİ
- Permission string'i literal olarak geçen tek yer packages/shared
- pnpm db:seed iki kez üst üste çalışıyor, duplicate yok
- Mevcut hiçbir endpoint izin adı değişikliği nedeniyle kırılmıyor

YAPMA
- Mevcut 50 izni yeniden adlandırma. read→view gibi kozmetik değişiklik YOK.
- Permission'ı tenant'a bağlama
```

---

## P5 — users uçlarını tamamla + rbac assign/revoke'u sınırlandır

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy.

BAĞLAM
GET /api/system/users ZATEN VAR ve ajans kapsamlı (yeni modül kurma, mevcut
settings modülündeki UsersController'ı genişlet).
PATCH /api/system/users/:id/stores de var (StoreUser'ı store_manager rolüyle set ediyor).

Eksikler: kullanıcı düzenleme, rol değiştirme, tenant'tan çıkarma.
Ayrıca POST /api/rbac/assign|revoke'ta iki ayrı hata var:
- dto.agencyId, çağıranın req.user.agencyId'siyle karşılaştırılmıyor → başka ajansa rol atanabilir
- agencies.create izni istiyor, bu izin yalnız super_admin'de → agency_owner kullanamıyor

YAPILACAKLAR

1. UsersController'a ekle (prefix /api/system/users):
   GET    /:id           users.view     Detay + tüm erişim kapsamları
   PATCH  /:id           users.manage   isActive, firstName, lastName, phone
   PATCH  /:id/role      users.manage   UserRole değiştir (roleId + kapsam)
   DELETE /:id           users.manage   Tenant'tan çıkar → 204
   GET    /  mevcut ucun @RequirePermission'ını system.settings.read'den users.view'a çevir

2. rbac.controller.ts assign/revoke:
   - @RequirePermission'ı agencies.create → users.manage yap
   - agencyId'yi DTO'dan DEĞİL, req.activeAgency'den al; DTO'daki agencyId alanını kaldır
   - revoke'ta userRoleId'nin aktif ajansa ait olduğunu doğrula, değilse NotFoundException
   - rbac.service.assignRole'ün storeId ezme davranışını düzelt (P3'teki yeni unique ile
     artık ayrı satır oluşturmalı)

3. KRİTİK KURALLAR
   a. DELETE kullanıcıyı SİLMEZ. Yalnız aktif tenant'taki UserRole kayıtlarına deletedAt yazar.
      User.deletedAt'e ASLA dokunma — aynı kişi başka ajansta çalışıyor olabilir.
   b. Listeleme her zaman UserRole join'i üzerinden aktif tenant'la filtrelenir.
      Global user.findMany YASAK. (super_admin istisnası mevcut kodda var, KORU ama
      isSuperAdminRole() üzerinden yap.)
   c. Kullanıcı kendi rolünü düşüremez / kendini çıkaramaz → BadRequestException
   d. Ajanstaki son agency_owner çıkarılamaz veya düşürülemez → BadRequestException
   e. Privilege escalation: bir kullanıcı, kendi sahip olmadığı izinleri içeren bir rolü
      başkasına veremez → ForbiddenException. super_admin rolü hiçbir koşulda atanamaz (P1).
   f. Yanıtta passwordHash, twoFactorSecret, twoFactorBackupCodes ASLA dönmez —
      explicit select kullan.
   g. Her mutasyonda auditLog (oldValue + newValue dolu) +
      PermissionCacheService.invalidateUser (P2)

DTO: UpdateUserDto, ChangeUserRoleDto, UserResponseDto, ListUsersQueryDto (arama, rol filtresi,
durum filtresi, sayfalama)

TEST: tenant filtresi, kendini silme engeli, son owner koruması, escalation reddi,
hassas alan sızıntısı yok, cross-agency revoke reddi.

YAPMA
- POST /users (doğrudan kullanıcı oluşturma) ekleme — kullanıcı sadece davetle gelir (P6)
- Şifre sıfırlama ucu ekleme, o profile/auth modülünün işi
```

---

## P6 — Davet (invitation) akışı

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy. P3'teki Invitation modelini kullanır.

BAĞLAM
Mevcut ajansa ikinci bir kullanıcı eklemenin HİÇBİR yolu yok. Tek yol /auth/register,
o da yeni ajans açıyor. UsersTable.tsx'te "Yeni kullanıcı" butonu
toast.warning('...davet bağlantısını kullanın') diyor ama öyle bir bağlantı yok.

ENDPOINT'LER

Korumalı (AuthGuard('jwt') + PermissionGuard):
  POST   /api/system/invitations             users.manage
  GET    /api/system/invitations             users.view    (sayfalı, status filtreli)
  POST   /api/system/invitations/:id/resend  users.manage
  POST   /api/system/invitations/:id/revoke  users.manage

Public (@Public, hiçbir guard yok, tenant header'ı zorunlu değil):
  GET    /api/invitations/:token
  POST   /api/invitations/:token/accept

TOKEN
- crypto.randomBytes(32).toString('hex'); DB'ye yalnız SHA-256 hash'i
  (auth.service.ts'teki hashToken deseniyle aynı)
- Ham token sadece mail linkinde: {FRONTEND_URL}/invite/{token}
- TTL env: INVITATION_TTL_DAYS, varsayılan 7
- Doğrulamada timing-safe karşılaştırma
- Ham token'ı loglama, audit metadata'sına yazma, yanıtta döndürme

ACCEPT MANTIĞI (tek transaction)
1. tokenHash ile bul; status pending değil veya expiresAt geçmiş → 410 Gone
2. Bu e-postayla User var mı?
   - VARSA: şifre istenmez, sadece UserRole eklenir (body'de password gelirse yoksay)
   - YOKSA: password zorunlu (auth modülündeki mevcut şifre kurallarıyla aynı),
     User + UserRole oluştur
3. Aynı kapsam için aktif UserRole zaten varsa → 409, davet accepted işaretlenir
4. status=accepted, acceptedAt=now, auditLog: "invitation.accepted"
5. Yanıt: login token çifti + tenant bilgisi (kullanıcı doğrudan içeri girsin)

DİĞER KURALLAR
- Davet edilen rol, daveti gönderenin izinlerinin üstünde olamaz → ForbiddenException.
  super_admin daveti hiçbir koşulda oluşturulamaz.
- Aynı e-posta + aynı tenant için bekleyen davet varsa yenisi oluşturulmaz, mevcut resend edilir
- Rate limit: aynı e-postaya saatte en fazla 3 davet/resend
- Mail gönderimi BullMQ kuyruğuna alınır. Mail servisi yoksa MailService interface'i +
  ConsoleMailProvider stub'ı yaz; gerçek sağlayıcı sonra takılacak.
  Stub, davet linkini konsola bassın ki geliştirme sırasında akış test edilebilsin.

TEST: süresi geçmiş token, iki kez accept, revoke sonrası accept, var olan/yeni kullanıcı
yolları, escalation reddi, rate limit.
```

---

## P7 — roles / permissions stub'larını doldur

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy.

BAĞLAM
GET /api/system/roles ve GET /api/system/permissions ŞU AN return [] — boş stub.
Frontend RoleList.tsx bunlara hiç bağlanmadığı için kimse fark etmemiş.
P3 ile Role artık agencyId taşıyor, özel rol mümkün.

ENDPOINT'LER — /api/system/roles
  GET    /                 roles.view     Sistem rolleri + bu ajansın özel rolleri;
                                          her birinde userCount ve permissions[]
  GET    /:id              roles.view     Detay + izin matrisi
  POST   /                 roles.manage   Özel rol oluştur (agencyId = req.activeAgency)
  PATCH  /:id              roles.manage   name, description, permissions[]
  DELETE /:id              roles.manage   Soft delete → 204
  GET    /api/system/permissions  roles.view  shared kataloğu, kategori gruplu

roles.view ve roles.manage izinlerini P4'teki katalogda tanımla,
agency_owner + agency_admin'e ver.

KURALLAR
1. isSystem = true roller düzenlenemez/silinemez → ForbiddenException
2. Başka ajansın rolüne erişim → NotFoundException (Forbidden değil; varlığını sızdırma)
3. Üzerinde aktif UserRole olan rol silinemez → BadRequestException,
   mesajda kaç kullanıcı olduğu belirtilsin
4. Escalation: çağıranın sahip olmadığı izin role verilemez
5. key, name'den slug'lanır; @@unique([agencyId, key]) çakışmasında sonuna sayı eklenir
   (auth.service.ts'teki agency slug deseniyle aynı)
6. İzin matrisi değişince PermissionCacheService.invalidateRole(roleId)
7. auditLog'da oldValue/newValue izin dizisi farkını göstersin

NOT: /api/rbac/roles ile /api/system/roles artık örtüşüyor. rbac.controller'daki
GET roles ve GET permissions uçlarını KALDIR, tek kaynak /api/system/* olsun.
rbac modülünde yalnız assign/revoke kalsın (P5'te düzeltildi).
```

---

## P8 — Frontend: users + roles ekranlarını gerçek API'ye bağla

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy. Kanonik örnek: t/[tenantPublicId]/products/ sayfası.

BAĞLAM
system/settings/ altında hooks/ klasörü YOK, mantık component içinde.
- UsersTable.tsx: KISMEN gerçek — apiFetch('/api/system/users') ile yüklüyor,
  PATCH /:id/stores ile mağaza kaydediyor. Ama rol değişikliği formda görünüyor,
  backend'e GÖNDERİLMİYOR. "Yeni kullanıcı" akışı toast.warning ile kapanıyor.
- RoleList.tsx: %100 mock — INITIAL_ROLES (role_1..4), handleSavePermissions setTimeout ile
  sahte kaydetme. Kullanıcıya çalışıyormuş gibi görünen ama hiçbir şey kaydetmeyen ekran.

HEDEF YAPI
system/settings/
├── hooks/
│   ├── useUsers.ts          liste + filtre + sayfalama + updateUser/changeRole/removeUser
│   ├── useRoles.ts          rol CRUD + izin matrisi kaydetme
│   └── useInvitations.ts    davet listesi + create/resend/revoke
└── components/
    ├── UsersTable.tsx           sadece sunum
    ├── InviteUserModal.tsx
    ├── PendingInvitations.tsx
    ├── RoleList.tsx
    ├── PermissionMatrix.tsx     kategori gruplu checkbox matrisi
    └── DeleteConfirmModal.tsx

YAPILACAKLAR
1. INITIAL_ROLES ve setTimeout sahte kaydetmeyi tamamen sil.
2. Rol değişikliği artık PATCH /system/users/:id/role'e gitsin (P5).
3. "Yeni kullanıcı" → InviteUserModal → POST /system/invitations (P6).
   Bekleyen davetler ayrı bir bölümde listelensin, resend/revoke butonlarıyla.
4. Roller ve izinler /system/roles + /system/permissions'tan gelsin (P7).
   İzin isimleri @kroptos/shared'dan, hardcode YOK (P4'te sabitler zaten hizalandı).
5. Tüm veri erişimi apiFetch üzerinden. Ham fetch yasak.
6. confirm()/alert() yerine DeleteConfirmModal + useToast.
7. Loading / empty / error durumları ayrı ayrı (products sayfasındaki desen).
8. Kendi satırındaki "rol değiştir" ve "çıkar" butonları disabled
   (backend zaten reddediyor, UI'da da gösterme).
9. Stil yalnız kp-* token'ları; ikonlar @heroicons/react/24/outline;
   metinler useTranslations, yeni anahtarlar messages/tr.json + en.json.

KABUL KRİTERLERİ
- Sayfa yenilendiğinde hiçbir veri kaybolmuyor
- İzin matrisi kaydedip yenileyince değişiklik duruyor
- page.tsx içinde iş mantığı yok
```

---

## P9 — Frontend: davet kabul sayfası

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy.

packages/frontend/src/app/invite/[token]/page.tsx — tenant DIŞI public rota,
/login ile aynı seviyede, t/[tenantPublicId] altında DEĞİL.

AKIŞ
1. Mount'ta GET /invitations/:token ile doğrula
2. Durumlar:
   - Geçerli + kullanıcı sistemde YOK → ad, soyad, şifre, şifre tekrar formu
   - Geçerli + kullanıcı sistemde VAR → "X ajansına katılmak üzere davet edildin" +
     tek tıkla kabul (şifre sorulmaz)
   - Süresi geçmiş / iptal / kullanılmış → açıklayıcı ekran + /login linki
   - Bulunamadı → generic hata, davetin varlığını sızdırma
3. Kabul → POST /invitations/:token/accept
4. Yanıttaki token çiftini auth-context'e yaz, /select-tenant'a yönlendir
   (tek tenant varsa doğrudan dashboard'a)

DETAYLAR
- Şifre alanında canlı güç göstergesi, backend kurallarıyla aynı
- Submit sırasında buton disabled + spinner
- Tasarım dili /login ekranıyla tutarlı, kp-* token'ları, i18n
- Davet geçersizken hangi e-postaya ait olduğunu GÖSTERME

YAPMA
- Bu sayfayı oturum zorunluluğunun arkasına koyma
- Token'ı localStorage'a veya URL query'sine taşıma (path param kalsın)
```

---

## P10 — Frontend: yetkiye duyarlı UI

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy.

BAĞLAM
/auth/me permissions DÖNDÜRMÜYOR; ne getMe yanıtında var ne User interface'inde.
Frontend'de izin gate'i sıfır (hasPermission/usePermission grep'i 0 sonuç).
Gate'lenebilecek tek veri role string'i ve isPlatformAdmin bayrağı — ikisi de yetersiz.
Sonuç: her kullanıcı her butonu görüyor, yetkisizlik ancak 403 toast'ında ortaya çıkıyor.
(repo notu: frontend-permission-gates-missing)

YAPILACAKLAR

1. Backend: getMe yanıtına aktif tenant bağlamı için permissions: string[] ekle.
   P2'deki buildUserRoleScopeWhere + izin union'ını kullan.
   accessibleTenants'taki her girişe de o tenant'taki permissions'ı ekle.
   NOT: Bu izinler JWT'ye KONMAYACAK (P2'de payload'dan çıkardık), yalnız /auth/me yanıtında.

2. auth-context.tsx:
   - permissions state'i; login / refreshUserProfile / switchTenant sonrası güncellenir
   - User interface'ine permissions alanı
   - switchTenant zaten hatayı doğru fırlatıyor (try/catch yok, token yazımı başarıdan sonra) —
     BU DAVRANIŞI KORU.
   - Ama agencies/page.tsx:244'teki switchTenant çağrısında catch YOK →
     unhandled rejection. Oraya catch + toast.error ekle.
     (select-tenant/page.tsx, Header.tsx ve layout.tsx'te catch zaten var.)

3. packages/frontend/src/hooks/usePermission.ts:
   const { can, canAny, canAll, isLoading } = usePermission();
   - wildcard "*:*" desteği
   - permissions yüklenmediyse can() false döner (fail-closed)
   - isLoading ile buton flicker'ı engellenir

4. Sidebar menü tanımına requiredPermission alanı ekle, yetkisi olmayan öğe render edilmesin.
   viewer rolündeki kullanıcı "Sistem Ayarları" linkini hiç görmemeli.

5. Aksiyon butonlarını sar: {can('products.create') && ...}
   En az: products, orders, inventory, warehouses, system/settings sayfaları.

6. Yetkisiz rotaya doğrudan URL ile gidilirse 403 boş durum ekranı göster,
   sessizce dashboard'a atma.

KABUL KRİTERLERİ
- viewer rolüyle giriş yapıldığında menüde ve sayfalarda yetkisiz aksiyon görünmüyor
- İzinler yüklenirken buton flicker'ı yok

YAPMA
- Bunu güvenlik sınırı sayma; yalnızca UX. Backend guard'ları tek gerçek koruma.
- İzinleri tekrar JWT'ye koyma.
```

---

## P11 — Oturum ve token geçersizleştirme

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy.

BAĞLAM
P2'den sonra izinler DB'den okunuyor ve 60 sn cache'li, bu iyi. Ama kullanıcı pasife
alındığında veya tenant'tan çıkarıldığında mevcut refresh token'ı hâlâ yeni access token
üretebiliyor. Session modeli var (isActive, deviceInfo, ipAddress) ama yönetim ucu yok;
profile modülünde yalnız logout-all-devices var.

YAPILACAKLAR

1. SessionService:
   - revokeAllForUser(userId, reason)
   - revokeForUserInTenant(userId, agencyId, reason)
   - Session.isActive = false + ilgili RefreshToken kayıtlarını sil

2. Şu olaylarda tetikle (+ PermissionCacheService invalidation):
   - UserRole değişimi / soft delete (P5)
   - Rol izin matrisi güncellemesi (P7) → o role bağlı tüm kullanıcılar
   - User.isActive = false
   - Şifre değişimi

3. JwtStrategy doğrulamasında kullanıcının hâlâ aktif olduğunu ve ilgili tenant'ta
   rolü bulunduğunu kontrol et — P2'deki 60 sn cache üzerinden, ek DB yükü olmadan.
   Access token ömrünü 15 dk'ya indir.

4. Session modeline lastUsedAt DateTime? ekle, refresh sırasında güncelle.

5. Uçlar:
   GET    /api/system/sessions        Kendi aktif oturumları (cihaz, IP, son kullanım)
   DELETE /api/system/sessions/:id    Tek oturumu kapat
   DELETE /api/system/sessions        Diğer tüm oturumları kapat
   DELETE /api/system/users/:id/sessions   users.manage — yöneticinin başkasını çıkarması
   Kullanıcı yalnız KENDİ oturumlarını görür.

6. Frontend: profil ayarlarına "Aktif Oturumlar" bölümü.
   Mevcut oturum işaretli ve kapatılamaz.

KABUL KRİTERLERİ
- Rolü düşürülen kullanıcı en geç 60 sn içinde 403 alıyor
- Pasife alınan kullanıcı refresh token ile yeni access token ALAMIYOR
- Kullanıcı başkasının oturumunu göremiyor
```

---

## P12 — Tenant izolasyonu: denetim + RLS + e2e

```
CLAUDE.md'deki 8 Kalıp Kuralı'na uy. docs/SECURITY_CHECKLIST.md'yi incele.

BAĞLAM
SECURITY_CHECKLIST.md PostgreSQL RLS'i zorunlu tutuyor ama şemada uygulanmamış.
İzolasyon şu an yalnız uygulama katmanında; tek eksik where koşulu cross-tenant sızıntı.
P0 zaten iki somut örnek buldu (rbac assign/revoke'ta ajans sınırı yok — P5'te düzeltildi).

YAPILACAKLAR

1. ÖNCE DENETLE, sonra düzelt:
   agencyId taşıyan tüm Prisma modellerini listele, bunlara erişen servis metotlarını
   tara ve tenant filtresi OLMAYAN sorguları raporla. Raporu bana göster, onay bekle.

2. RLS migration'ı (ham SQL):
   - agencyId içeren tablolarda ENABLE ROW LEVEL SECURITY
   - USING ("agencyId" = current_setting('app.agency_id', true))
   - Uygulama DB kullanıcısı BYPASSRLS yetkisine sahip OLMAMALI
   - Migration/seed için ayrı superuser bağlantısı: env DATABASE_MIGRATION_URL

3. PrismaService'e oturum değişkeni enjeksiyonu:
   - $extends ile her sorgu öncesi SET LOCAL app.agency_id
   - Bağlamı tenant.middleware'in yazdığı request scope'undan al
   - Cron / BullMQ worker gibi bağlamsız yerlerde explicit sistem bağlamı set edilsin,
     sessizce filtresiz çalışmasın

4. e2e paketi (test/tenant-isolation.e2e-spec.ts):
   - A ajansı kullanıcısı, B'nin x-agency-id header'ıyla → 403
   - A kullanıcısı B'nin ürün id'siyle GET → 404 (403 değil)
   - A kullanıcısı B'nin rolünü PATCH → 404
   - Uygulama filtresi kasıtlı kaldırılmış test sorgusu RLS tarafından boş dönüyor
   - Davet token'ı iki kez kullanılamıyor
   - Rolü düşürülen kullanıcının eski token'ı 403
   - Son agency_owner çıkarılamıyor
   - register sonrası atanan rol agency_owner (P1 regresyonu)

5. docs/SECURITY_CHECKLIST.md'yi gerçek uygulamayı yansıtacak şekilde güncelle.

KABUL KRİTERLERİ
- pnpm test:e2e yeşil, RLS açıkken tüm endpoint'ler çalışıyor
- Worker/cron işleri RLS nedeniyle sessizce boş veri işlemiyor (explicit bağlam testi var)

YAPMA
- RLS'i uygulama katmanı filtrelerinin yerine geçirme; ikisi birlikte duracak
```

---

## Ertelenen işler (bu sette YOK, ayrıca planla)

- **StoreUser ↔ UserRole örtüşmesi.** İki ayrı üyelik modeli var, ikisi de roleId taşıyor.
  `PATCH /users/:id/stores` StoreUser'a, `rbac/assign` UserRole'e yazıyor. Hangisinin
  kanon olduğu belirsiz. Çok kullanıcılı yapı oturduktan sonra birleştirilmeli.
- **PLATFORM_ADMIN_EMAILS allowlist'i.** PlatformAdminGuard e-posta listesine bakıyor;
  env tabanlı allowlist ölçeklenmez, kalıcı çözüm gerekiyor.
- **eticaret-system/ arşivi.** Kendi şeması ve authz'si var, kafa karıştırıyor.
  Silinmeli veya README ile net şekilde arşiv işaretlenmeli.