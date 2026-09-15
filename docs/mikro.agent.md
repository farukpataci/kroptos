# KroptOS — Mikro ERP Agent + API Entegrasyonu · Uygulama Brifingi

> **Bu dosya bir tasarım dokümanı değil, bir AJANA VERİLECEK İŞ EMRİDİR.**
> Antigravity (ya da başka bir kodlama ajanı) bu dosyayı okuyup `farukpataci/kroptos`
> deposunda kodu yazacak. Dosya kendi kendine yeterlidir: gereken tüm karar, kural,
> doğrulanmış bilgi ve kabul kriteri içindedir.

---

## 0. Nasıl kullanılır

**Seçenek A — tek seferde:** bu dosyanın tamamını ajana ver ve şunu yaz:

```
Bu brifingi uygula. GÖREV 1'den başla, her görevin kabul kriterlerini sağlamadan
bir sonrakine geçme. §4'teki değişmez kuralları ve §10'daki yasakları hiçbir
koşulda ihlal etme. Emin olmadığın hiçbir endpoint, alan adı, tablo adı veya
hata kodunu UYDURMA — §9'daki "bilinmeyen" listesine ekle ve DOCUMENTATION_REQUIRED
olarak işaretle.
```

**Seçenek B — görev görev (önerilen):** her seferinde §1–§4 + tek bir GÖREV bloğunu ver.
Ajanlar dar kapsamda daha az uyduruyor ve PR'lar küçük kalıyor (CONTRIBUTING §6).

**Her görev sonunda:** `pnpm lint && pnpm test && pnpm build` yeşil olmadan görev bitmiş
sayılmaz.

---

## 1. Depo bağlamı — ajan bunu varsaymalı

Monorepo, pnpm workspaces: `packages/backend` (NestJS + Prisma + PostgreSQL + Redis/BullMQ),
`packages/frontend` (Next.js App Router), `packages/shared`.

**Aktif proje `packages/*` altındadır. `eticaret-system/` ARŞİVDİR, dokunulmaz.**

### 1.1 Kiracı modeli

```
Agency ──< Client ──< Store ──< Product / Order / ...
```

Aktif bağlam `{ agencyId, clientId, storeId }`; frontend `x-agency-id`, `x-client-id`,
`x-store-id` header'larıyla gönderir; backend `TenantGuard` + `tenant.middleware` doğrular.
**Her sorguda tenant filtresi zorunludur. Cross-tenant sızıntıya sıfır tolerans.**

### 1.2 Uyulacak konvansiyonlar (yeni kalıp İCAT ETME)

Backend:
- Modül dörtlüsü: `<kaynak>.module.ts` + `<kaynak>.controller.ts` + `<kaynak>.service.ts` + `dto/`
- Controller: `@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionGuard)` +
  `@RequirePermission('kaynak.aksiyon')` + Swagger dekoratörleri (`@ApiTags`,
  `@ApiOperation`, `@ApiResponse`, `@ApiHeader`)
- HTTP kodları: liste/detay/güncelle `200`, oluştur `201`, sil `204`; güncelleme **PATCH**
- Servis: her sorguda tenant filtresi + **soft delete** (`deletedAt`) + **audit log**
- DTO: `class-validator`
- Connector kalıbı: `src/integrations/marketplaces/` ikizi. **Ayrı bir
  `domain|application|infrastructure` katman ağacı KURMA.**

Frontend:
- Sayfalar `'use client'`; rota `/t/[tenantPublicId]/<sayfa>`
- Veri çekme **yalnızca** `@/lib/api`'deki `apiFetch` / `api.*` — doğrudan `fetch` yok
- Sayfa mantığı `hooks/useXxx.ts` içinde; `page.tsx` yalnızca kompozisyon
- Stil **yalnızca** `kp-*` token sınıfları — ham hex renk yok
- İkonlar `@heroicons/react/24/outline`
- Metinler i18n: `useTranslations()` + `messages/*.json` (12 dil) — sabit string gömülmez

Prisma:
- **`prisma migrate dev` / `pnpm db:migrate` ÇALIŞTIRMA.** Bu repo migration geçmişi
  tutmuyor; deploy `prisma db push` ile yapılıyor.
- Şema diff'i `npx prisma migrate diff ... --script > docs/plans/<ad>.sql` olarak üretilir,
  lokale `pnpm db:push` ile uygulanır, `.sql` dosyası PR'a girer.

Git (CONTRIBUTING.md):
- `main` korumalı. `feature/<kisa-aciklama>` dalı aç, Conventional Commits kullan
  (`feat(accounting): ...`), Squash and merge.
- **Kod yazılır yazılmaz commit'le.** Untracked bir modül bir `git clean -fd`'ye uzaklıktadır.

### 1.3 Repoda hâlihazırda olan ve KORUNACAK olan

`schema.prisma` içinde: `ErpStockSettings` (`agencyId` **@unique**, `connectionType`,
`companyNo`, `periodNo`, `erpDepotCodes[]`, `syncPeriodMinutes`, `syncDirection`),
`LogoWarehouseMapping`, `LogoProductMapping`, `StockSourceSettings`, `Warehouse`,
`StockMovement` (`source` alanı `MANUEL | LOGO | ORDER | INTEGRATION`).

Frontend: `products/components/ProductFormModal.tsx` içinde ERP kartı eşleştirme sekmesi
(`erpCode`, `erpId`), `system/settings/components/AccountingSettingsForm.tsx`,
sidebar `navigation.erp`.

**Bunlar SİLİNMEZ.** Yeni yapı üstüne kurulur; eski modeller deprecate edilir ve frontend
taşınana kadar yaşar. Backfill **tek yönlüdür**: her `ErpStockSettings` satırı →
1 `AccountingIntegration` + 1 `AccountingCompany`.

---

## 2. Ne inşa edilecek

Mikro ERP (v16/v17) müşteri sunucusunda çalışır ve internete açık değildir. KroptOS buluttan
oraya bağlanamaz. Çözüm: müşteri sunucusuna kurulan bir **KroptOS Agent**, KroptOS'a
**dışarı doğru** bağlanır; işler o tünelden iner, sonuçlar oradan çıkar.

```
┌──────────── KroptOS Bulut ────────────┐      ┌──── Müşteri Sunucusu ────┐
│ Frontend /t/{tenant}/accounting       │      │                          │
│      │ apiFetch + tenant header       │      │  KroptOS Agent (Windows) │
│      ▼                                │      │   ├ tünel istemcisi      │
│ AccountingModule (NestJS)             │      │   ├ yerel kimlik kasası  │
│      ▼                                │      │   └ iş çalıştırıcı       │
│ AccountingConnector (protokol)        │      │          │               │
│      ▼                                │      │          ▼               │
│ AccountingTransport                   │      │  http://localhost:8094   │
│   └ AgentTransport ─┐                 │      │  Mikro Desktop API       │
│ AgentGateway (WSS) ◄┼═ giden mTLS ════╪══════╪►                         │
│ Redis pub/sub · BullMQ · Postgres     │      │          ▼               │
└───────────────────────────────────────┘      │     Mikro veritabanı     │
                                                └──────────────────────────┘
```

Üç kural bu resimden okunur:

1. **Bağlantı yönü daima içeriden dışarıdır.** Müşteriden gelen port açması İSTENMEZ.
2. **Connector protokolü konuşur, Agent taşır.** Rota bağlantı kaydının özelliğidir.
3. **ERP kimliği müşteri tarafında kalır.** Yukarı çıkan tek şey iş sonucudur.

**İlk faz akışları:** ürün kartı eşleşmesi → stok (ERP→KroptOS, salt okuma) →
fatura (KroptOS→ERP) → cari + tahsilat.

---

## 3. Doğrulanmış Mikro gerçekleri

Kaynak: `apidocs.mikro.com.tr` (2026-09-12 okuması). **Ajan bu tabloyu genişletmez,
yalnızca Faz D'de gerçek çağrıyla doğrular.**

### 3.1 Kurulum ve taşıma — DOĞRULANDI

| Bilgi | Değer |
|---|---|
| Windows servisi | "Mikro Desktop API", hesap `NT SERVICE\MikroDesktopAPIContainer`, otomatik başlar |
| Mimari | Kendi servisi — **IIS değil** |
| Port | Varsayılan **8094**; registry: `HKLM\SYSTEM\CurrentControlSet\Services\MikroDesktopAPIContainer\Parameters` |
| Sürüm ayrımı | **v17 → 8094, v16 → 8084** |
| Örnek çağrı | `POST http://localhost:8094/Api/APIMethods/APILogin` |
| HTTPS | **DOĞRULANMADI** — doküman belirtmiyor, örnekler `http://` |

### 3.2 Kimlik — DOĞRULANDI

| Bilgi | Değer |
|---|---|
| Erişim | API Başvuru Formu → lisans ataması (`mikro.com.tr/mikro-program-api-basvuru`) |
| Alanlar | `ApiKey`, `KullaniciKodu`, `Sifre`, `FirmaKodu`, `CalismaYili` |
| `Sifre` | **"Tarih + Şifre → MD5 Hash"** (doküman örneği: `2023-03-09 123asd`) |
| Nerede | Bu beş alan **`Mikro` nesnesi içinde HER İSTEKTE** gider — sadece login'de değil. **Token yoktur.** |
| Kısıt | **"API local sunucuda çalışır. Active-Active desteklemez."** |
| Test | Demo setup ile **100 kayda kadar** |
| Hata | Geçersiz anahtarda *"Geçersiz api key"* |

**DOĞRULANMADI:** `Sifre` hash'inin tam biçimi (tarih formatı, ayraç, büyük/küçük harf,
saat dilimi), cevap zarfı, hata kodu sözlüğü, rate limit değerleri.

### 3.3 Endpoint envanteri — dokümandan birebir

> **Büyük/küçük harf dokümanda tutarsızdır** (`/API/`, `/Api/`, `/apiMethods/`).
> Sunucunun duyarlı olup olmadığı doğrulanmadı → **her yol dokümandaki hâliyle, sabit
> olarak tanımlanır; normalize EDİLMEZ.**

| Grup | Endpoint |
|---|---|
| Oturum | `POST /Api/APIMethods/APILogin` |
| Cari | `CariListesiV2`, `CariListesiV3`, `CariKaydetV2`, `CariGuncelleV2` |
| Stok | `StokListesiV2`, `StokKaydetV2`, `DahiliStokHareketKaydetV2/DuzeltV2/SilV2/GuidSilV2` |
| Fatura | `FaturaKaydetV2`, `FaturaKaydetV3`, `AlimSatimEvragiKaydetV2/DuzeltV2/SilV2/SatirSilV2`, `SiparistenFaturaOlusturmaV2` |
| Listeler | `KullaniciListesiV2`, `KullaniciParametreleriV2`, `VergiListesiV2` |
| SQL | `POST /api/apimethods/SqlVeriOkuV2` — gövdede `SQLSorgu` string'i, **yalnızca SELECT** |
| e-Belge | `FaturaToEFaturaV2`, `EBelgeDurumSorgulamaV2`, `EMukellefSorgulamaV2`, `GelenFaturalarV2/KabulV2/RedV2`, … → **KAPSAM DIŞI** |

**Envanterden okunan üç boşluk — mimariyi bunlar belirliyor:**

1. **Fatura listeleme/sorgulama endpoint'i YOK.** Kaydet/düzelt/sil var, okuma yok.
2. **Firma listesi endpoint'i YOK.** `FirmaKodu` elle girilir ya da katalog sorgusuyla okunur.
3. **`StokListesiV2`'de değişim tarihi filtresi dokümante değil** → delta yok, tam sayım var.

### 3.4 Belge alanları — DOĞRULANDI (dokümandaki örnekten)

- Evrak numarası: `cha_evrakno_seri` (örn. `"MYT"`) + `cha_evrakno_sira` (örn. `39`)
- **`user_tablo`** adlı özel kullanıcı tablosu, örnekte harici referans taşıyor
  (`Craftgate_Id`, `CreditReferenceNumber`, `TransactionReferenceId`)

**DOĞRULANMADI — Faz D'nin kritik sorusu:** `user_tablo` kolonları her kurulumda var mı,
yoksa müşteri setinde tanımlanması mı gerekiyor?

---

## 4. Değişmez kurallar

> Ajan bunlardan birini ihlal ettiyse iş yanlıştır, tekrar yazılır.
> Her biri bir uygunluk testine bağlanacaktır (GÖREV 4).

**K1 — Kimlik connector katmanına girmez.**
`AccountingContext` credential taşımaz ve taşıyamaz. Connector isteğin **kimlik dışı**
kısmını üretir; `Mikro: { ApiKey, KullaniciKodu, Sifre, FirmaKodu, CalismaYili }` nesnesini
**Agent takar**. Backend'de üretilen hiçbir istek gövdesinde `Mikro`, `ApiKey`, `Sifre`
veya `KullaniciKodu` anahtarı bulunmaz.

**K2 — ERP kimliği sunucuda saklanmaz.**
`apiKey`, `kullaniciKodu`, `password` yalnızca Agent'ın yerel kasasındadır. Panelden
girilebilir, ama tarayıcıda Agent'ın açık anahtarıyla şifrelenir; sunucu çözemediği blob'u
bir kez taşır ve teslimde siler. Sunucuda kalan tek iz: `credentialSetAt`,
`credentialSetBy`, `credentialFingerprint`.

**K3 — Sahte başarı yok.**
`SUPPORTED` olmayan bir yeteneğin çağrılması `{ success: true }` döndürmez.
`NOT_SUPPORTED` → `NotImplementedException`; `CONTRACT_REQUIRED` → ayrı hata sınıfı;
diğer her doğrulanmamış statü → `IntegrationNotVerifiedError`. Mock cevaplarda
`isMock: true` ve mesajda "MOCK — gerçek bağlantı doğrulanmadı".

**K4 — Oturum/cache anahtarı firma eksenini içerir.**
`SessionKey = <integrationId>:<companyNo>:<periodNo|->:<branchCode|->`
Token cache, oturum havuzu, throttle sayacı ve yazma kilidi bu anahtarı kullanır.
Mikro'da `FirmaKodu` + `CalismaYili` her isteğin gövdesindedir; bağlantı düzeyinde
cache'lemek 2 no'lu firmanın kimliğiyle 3 no'lu firmaya kayıt attırır — **ve bu hata
exception vermez.**

**K5 — Rota bağlantı kaydının özelliğidir**, sağlayıcının değil.
`AccountingIntegration.route ∈ {DIRECT, AGENT}`. Aynı connector her iki rotada çalışabilmeli.
Mikro için `supportedRoutes: ['AGENT']`.

**K6 — Agent bir uzaktan kabuk değildir.**
`AgentJobType` **kapalı bir kümedir**; küme dışı tip reddedilir ve loglanır. Sunucudan
serbest komut, serbest SQL veya kod gönderilemez. Agent yalnızca kendi `ProgramData`
dizinine ve yapılandırmadaki ERP adresine erişir.

**K7 — Serbest SQL yok, adlandırılmış katalog var.**
`SqlVeriOkuV2` yalnızca Agent'ın imzalı kurulum paketiyle gelen, versiyonlu, parametreli,
**salt okunur** sorgu kataloğu üzerinden çalışır. Sunucu `queryId` + parametre yollar,
SQL metni **göndermez**. Panelde serbest SQL alanı **yoktur**. Katalog dosyasında
`SELECT`/`WITH` dışı ifade varsa Agent **başlamaz**.

**K8 — Tarihe bağlı kimlik cache'lenmez.**
`Sifre` her istek için yeniden türetilir. Gece yarısı sınırında üretilip sonra gönderilen
zarf geçersizdir. Kimlik hatasında zarf **tam bir kez** yeniden türetilerek denenir; bu,
"geçersiz credential'da retry yok" kuralının tek ve dar istisnasıdır.

**K9 — Bağlantı başına tek aktif Agent.**
Mikro Active-Active desteklemiyor; ayrıca Agent'ın tekrar-koruma kasası **kendi diskindedir**,
ikinci Agent onu göremez ve aynı faturayı ikinci kez yazar. İş yalnızca
`exclusiveAgentId`'ye gönderilir. Kira düşse bile açık yazma işi varken devralma **bloke**
edilir ve problem kuyruğuna `agent_failover_blocked` düşer.
**Dürüst sonuç: muhasebe entegrasyonunda yüksek erişilebilirlik yoktur ve panel bunu gizlemez.**

**K10 — Agent, Mikro servisinin çalıştığı makineye kurulur ve `localhost`'a bağlanır.**
Kimlik her istekte gidiyor ve gün boyu geçerli; HTTPS dokümante değil. Bunu düz HTTP ile
LAN'a çıkarmak ERP'nin tam erişim kimliğini ağa günlük olarak dağıtmaktır. Zorunlu istisna
`AccountingIntegration.transportSecurity = 'PLAINTEXT_LAN'` olarak işaretlenir ki denetimde görünsün.

**K11 — `findInvoiceByRef` olmadan otomatik fatura yazma açılmaz.**
Geri okunamayan bir ERP'ye otomatik yazmak, her zaman aşımında "acaba yazıldı mı"yı
operasyona havale etmektir; karşılığı çift kesilmiş faturadır. Bu durumda akış **onaylı
moda** düşer: taslak hazırlanır, kullanıcı panelde onaylar, sistem yazar, sonuç doğrulatılır.

**K12 — Silme iptal değildir.**
`AlimSatimEvragiSilV2` **silme**dir. Numara boşluğu bırakır, e-faturaya dönüşmüş belgede
çalışmaz, muhasebe kaydını ve stok hareketini geri alır. Yetenek `CONTRACT_REQUIRED`;
connector bu ucu **kendiliğinden çağırmaz**. Varsayılan: KroptOS tarafı kapanır, operasyona
"Mikro'da MYT-39 elle iptal edilmeli" görevi düşer.

**K13 — ERP'ye özgü adlar çekirdeğe sızmaz.**
`cha_evrakno_seri`, `user_tablo`, `Sifre`, `LOGICALREF` sınıfı adlar **yalnızca**
`<provider>/*.ts` içinde görünür. Çekirdek tipler KroptOS'un dilindedir.

---

## 5. GÖREV 1 — Veri modeli

**Dal:** `feature/accounting-schema`

`packages/backend/prisma/schema.prisma` sonuna aşağıdaki modelleri ekle. Alan adları
serbesttir ama **anlam ve index'ler zorunludur.**

| Model | Zorunlu içerik |
|---|---|
| `AccountingIntegration` | KİMLİK. `agencyId`, `clientId?` (**`storeId` YOK**), `provider`, `displayName`, `route`, `environment`, `agentId?`, `exclusiveAgentId?` (K9), `agentLeaseUntil?` (K9), `transportSecurity?` (K10), `config Json`, `credentialRef Json?` (**yalnızca SERVER_ENCRYPTED alanlar**), `credentialSetAt/By/Fingerprint`, `status`, `isActive`, `deletedAt?`. `@@unique([agencyId, clientId, provider, displayName])`, index: `agencyId`, `exclusiveAgentId`, `deletedAt` |
| `AccountingCompany` | FİRMA EKSENİ. `integrationId`, `agencyId` (denormalize), `companyNo`, `periodNo?`, `branchCode?`, `title?`, `currency`, `defaultAccountCodes Json?`, `invoiceSeries?`, `isDefault`, `isActive`. `@@unique([integrationId, companyNo, periodNo, branchCode])` |
| `AgentInstance` | `agencyId`, `clientId?`, `name`, `status` (PENDING\|ACTIVE\|OFFLINE\|REVOKED), `publicKey` (K2), `certFingerprint?`, `agentVersion?`, `osVersion?`, `protocolVersion?`, `clockSkewSec?` (K8), `lastHeartbeatAt?`, `connectedNodeId?` (**yalnızca gözlem**), `enrolledAt?`, `revokedAt/By?`. `@@unique([agencyId, name])` |
| `AgentEnrollmentCode` | `agencyId`, `clientId?`, `codeHash @unique` (**kod saklanmaz**), `createdBy`, `expiresAt`, `usedAt?`, `usedByAgentId?` |
| `AgentJob` | `agencyId`, `agentId`, `integrationId`, `companyKey` (SessionKey, K4), `type`, `payload Json` (**maskeli**), `idempotencyKey?`, `status`, `attempt`, `notBefore?`, `expiresAt`, `startedAt/finishedAt?`, `durationMs?`, `errorCode?`, `resultRef Json?`. **`@@unique([agentId, idempotencyKey])`** (Postgres'te NULL'lar çakışmaz) |
| `AccountingDocumentLink` | İDEMPOTENCY KATMAN 1. `agencyId`, `integrationId`, `companyKey`, `sourceType`, `sourceId`, `externalRef`, `erpDocumentId?`, `erpDocumentNo?`, `status` (claimed\|written\|failed\|cancelled\|stuck), `lastError?`. **İKİ unique:** `@@unique([agencyId, integrationId, companyKey, sourceType, sourceId])` ve `@@unique([integrationId, companyKey, externalRef])` |
| `AccountingSyncCursor` | `integrationId`, `companyKey`, `stream` (STOCK\|PRODUCT\|PARTNER), `cursor?`, `lastFullSyncAt?`, `lastDeltaAt?`, `staleSince?`. `@@unique([integrationId, companyKey, stream])` |
| `AccountingProblem` | `agencyId`, `integrationId?`, `agentId?`, `companyKey?`, `code`, `severity`, `occurrences` (aynı kod tekrarında **sayaç artar, yeni satır açılmaz**), `detail Json?`, `resolvedAt/By?`. `@@unique([agencyId, integrationId, code, companyKey])` |

**Kabul kriterleri:**
- [ ] `npx prisma validate` ve `npx prisma generate` temiz
- [ ] Şema diff'i `docs/plans/muhasebe-agent-catisi.sql` olarak üretildi ve commit'lendi
- [ ] `pnpm db:push` lokalde uygulandı — **`prisma migrate dev` çalıştırılmadı**
- [ ] `ErpStockSettings`, `LogoWarehouseMapping`, `LogoProductMapping` **silinmedi, değiştirilmedi**
- [ ] Hiçbir yeni modelde `storeId` yok

---

## 6. GÖREV 2 — Connector çekirdeği

**Dal:** `feature/accounting-core`
**Klasör:** `packages/backend/src/integrations/accounting/core/`

```
core/
├── AccountingTypes.ts            # CompanyKey, AccountingContext, ErpProduct,
│                                 # ErpStockLine/Page, PartnerInput, InvoiceInput,
│                                 # ErpDocumentRef, CancelResult, ConnectionTestResult
├── AccountingCapabilities.ts     # CapabilityStatus, IntegrationReadiness,
│                                 # assertCapability (K3)
├── AccountingCredentialSchema.ts # CredentialFieldSpec { storage, derived },
│                                 # validate / mask / stripNonServerFields (K2)
├── AccountingSessionKey.ts       # buildSessionKey / tokenCacheKey / writeLockName (K4)
├── AccountingErrors.ts           # IntegrationNotVerifiedError, CapabilityNotSupported,
│                                 # CapabilityContractRequired, ClosedPeriodError,
│                                 # ClockSkewError, CatalogQueryRejected, CatalogSchemaDrift
├── AccountingProviderRegistry.ts # açık kayıt + descriptor değişmezleri
├── AccountingConnector.ts        # soyut port
├── AccountingConnectorFactory.ts # registry tabanlı — SWITCH DEĞİL
├── agent/AgentProtocol.ts        # AgentJob/AgentResult, AgentJobType (kapalı küme)
├── catalog/CatalogManifest.ts    # katalog sözleşmesi + salt-okunur doğrulayıcı (K7)
└── transport/
    ├── AccountingTransport.ts    # port: execute(TransportOperation)
    ├── AgentTransport.ts         # işi AgentGateway'e bırakır
    └── DirectTransport.ts        # iskelet; kurucu yoksa NotImplementedException
```

### 6.1 Sözleşmeler

**`AccountingContext` — kimlik taşımaz (K1):**
```ts
interface AccountingContext {
  integrationId: string;
  tenant: { agencyId: string; clientId?: string | null };
  companyKey: { companyNo: string; periodNo?: string | null; branchCode?: string | null };
  environment: 'MOCK' | 'TEST' | 'PRODUCTION';
  transport: AccountingTransport;
  isTestMode: boolean;
}
```

**`CapabilityStatus`:** `SUPPORTED | MOCK_ONLY | NOT_SUPPORTED | DOCUMENTATION_REQUIRED |
CONTRACT_REQUIRED | UNKNOWN`
**`IntegrationReadiness`:** `NOT_STARTED | SCAFFOLDED | MOCK_READY | TEST_READY | PRODUCTION_READY`

Yetenek anahtarları (her biri için statü **zorunlu**, `undefined` olamaz):
`connectionTest, companyList, warehouseList, productSearch, productFetch, productCreate,
stockSnapshot, stockDelta, partnerFetch, partnerUpsert, receiptPush, invoicePush,
invoiceFindByRef, invoiceCancel, eDocument`

**`CredentialFieldSpec` — iki kritik alan:**
```ts
storage: 'SERVER_ENCRYPTED' | 'AGENT_LOCAL';
derived?: { from: string[]; strategy: string };  // formda GÖSTERİLMEZ, Agent türetir
```

**`AgentJobType` — kapalı küme (K6):**
```
CONNECTION_TEST · COMPANY_LIST · WAREHOUSE_LIST · PRODUCT_SEARCH · PRODUCT_FETCH
STOCK_SNAPSHOT · STOCK_DELTA · PARTNER_UPSERT · PARTNER_FETCH · RECEIPT_PUSH
INVOICE_PUSH · INVOICE_FIND_BY_REF · INVOICE_CANCEL · CATALOG_QUERY
```
`CATALOG_QUERY` bir **sağlayıcıya değil, `AGENT+SQL` ROTASINA** aittir; bu yüzden
çekirdektedir ve hiçbir sağlayıcı kümeye ekleme yaptırmaz.

**`AccountingConnector` portu:**
```ts
abstract readonly providerId: string;
abstract readonly capabilities: AccountingCapabilities;

abstract testConnection(ctx): Promise<ConnectionTestResult>;
abstract listCompanies(ctx): Promise<ErpCompany[]>;

// yetenek bazlı — GÖVDESİZ BİLDİRİM, `abstract` yazma
listWarehouses?(ctx); searchProducts?(ctx, q); fetchProduct?(ctx, code);
fetchStock?(ctx, q); upsertPartner?(ctx, p); fetchPartner?(ctx, key);
pushReceipt?(ctx, r); pushInvoice?(ctx, i);
findInvoiceByRef?(ctx, externalRef);   // ATLANAMAZ — K11
cancelInvoice?(ctx, ref);
```
Korumalı yardımcılar: `guard(key)` (K3), `assertProviderExtras(extras)`,
`assertPeriodMatches(ctx, issuedAt)`, `mockConnectionResult(startedAt)`.

**Katalog sözleşmesi (K7):** `CatalogQuerySpec { queryId, params[], expectedColumns[],
maxRows, timeoutSec }`. Fonksiyonlar: `resolveQuery`, `validateCatalogParams`,
`assertExpectedColumns` (eksik kolon → `CatalogSchemaDriftError`, **boş sonuçla devam
etmez**), `assertReadOnlySql` (`SELECT`/`WITH` dışı, `;`, `--`, `/*`, `EXEC`, DDL/DML → reddet).

**Kabul kriterleri:**
- [ ] `AccountingContext` tipinde hiçbir credential alanı yok
- [ ] `assertCapability`'nin hiçbir dalı başarı döndürmüyor
- [ ] Registry bozuk descriptor'ı **kayıt anında** reddediyor: eksik capabilities;
      `lastVerifiedAt` boşken `supportsTest`/`supportsProduction = true`;
      `readiness !== PRODUCTION_READY` iken `supportsProduction = true`
- [ ] Factory `switch` içermiyor — registry + kurucu kaydı
- [ ] `pnpm build` temiz

---

## 7. GÖREV 3 — Mikro connector iskeleti

**Dal:** `feature/accounting-mikro`
**Klasör:** `packages/backend/src/integrations/accounting/mikro/`

```
mikro.types.ts            # MIKRO_PATHS (§3.3'ten BİREBİR), MikroRequest, user_tablo
mikro.capabilities.ts     # başlangıç statüleri — aşağıdaki tablo
mikro.credential-schema.ts
mikro.catalog.ts          # katalog SÖZLEŞMESİ — SQL METNİ YOK
mikro.request-mapper.ts   # kimliksiz gövde + doğrulama/normalizasyon
mikro.response-mapper.ts  # savunmacı; tanımadığı şekli TAHMİN ETMEZ, hata fırlatır
mikro.error-mapper.ts
mikro.descriptor.ts       # readiness: 'SCAFFOLDED'
mikro.connector.ts
```

### 7.1 Başlangıç yetenek tablosu — bu değerlerle başla

| Yetenek | Statü | Gerekçe |
|---|---|---|
| `connectionTest` | `DOCUMENTATION_REQUIRED` | `APILogin` var, cevabı görülmedi |
| `companyList` | `NOT_SUPPORTED` | Firma listeleme endpoint'i yok |
| `warehouseList` | `DOCUMENTATION_REQUIRED` | Endpoint görülmedi → katalog adayı |
| `productSearch` / `productFetch` | `DOCUMENTATION_REQUIRED` | `StokListesiV2` filtre adları doğrulanmadı |
| `productCreate` | `CONTRACT_REQUIRED` | ERP kartı açma ilk fazda kapalı |
| `stockSnapshot` | `DOCUMENTATION_REQUIRED` | Depo kırılımı dönüyor mu bilinmiyor |
| `stockDelta` | **`NOT_SUPPORTED`** | Değişim tarihi filtresi dokümante değil — sahte delta = eskiyen stok |
| `partnerFetch` / `partnerUpsert` | `DOCUMENTATION_REQUIRED` | |
| `receiptPush` | `DOCUMENTATION_REQUIRED` | Tahsilat karşılığı doğrulanmadı |
| `invoicePush` | `DOCUMENTATION_REQUIRED` | |
| `invoiceFindByRef` | `DOCUMENTATION_REQUIRED` | Fatura sorgulama endpoint'i yok — tek yol katalog |
| `invoiceCancel` | **`CONTRACT_REQUIRED`** | K12 |
| `eDocument` | `NOT_SUPPORTED` | Kapsam kararı |

**Bu tabloyu elle `SUPPORTED` yapma.** Her satır Faz D'de gerçek bir çağrıyla değişir ve
`lastVerifiedAt` o zaman dolar.

### 7.2 Credential şeması

| Alan | Tip | storage | derived |
|---|---|---|---|
| `baseUrl` | string | `SERVER_ENCRYPTED` | — (varsayılan `http://localhost`) |
| `port` | number | `SERVER_ENCRYPTED` | — (v17→8094, v16→8084) |
| `apiKey` | password | `AGENT_LOCAL` | — |
| `kullaniciKodu` | string | `AGENT_LOCAL` | — |
| `password` | password | `AGENT_LOCAL` | — (ham şifre; **asla gönderilmez**) |
| `sifre` | password | `AGENT_LOCAL` | `{ from: ['password'], strategy: 'MIKRO_DATE_MD5' }` |

`FirmaKodu` ve `CalismaYili` **credential değildir** → `AccountingCompany` satırıdır.
`CompanyKey` eşlemesi: `companyNo ← FirmaKodu`, `periodNo ← CalismaYili`, `branchCode` yok.

### 7.3 Katalog sorguları (sözleşme; SQL Agent paketinde)

| `queryId` | Parametre | `expectedColumns` |
|---|---|---|
| `mikro.invoice_by_ref` | `ref` | `external_ref`, `document_id`, `document_no` |
| `mikro.stock_by_warehouse` | `depoNo?`, `limit?`, `offset?` | `product_code`, `warehouse_code`, `quantity` |
| `mikro.company_list` | — | `company_no`, `title` |
| `mikro.warehouse_list` | — | `warehouse_code`, `warehouse_name` |

Kolon adları **takma addır** (`SELECT ... AS product_code`) — gerçek Mikro kolon adları
Faz D'de doğrulanacak. **Kolon adı uydurma.**

### 7.4 Fatura gövdesi

```
cha_evrakno_seri: <AccountingCompany.invoiceSeries>   // seri sabit
user_tablo: { KROPTOS_REF: <externalRef> }            // dış referans
// cha_evrakno_sira GÖNDERİLMEZ — sıra numarasını Mikro üretsin
```

`externalRef` deterministiktir: `KRP-ORDER-123`; iptal sonrası yeni sürüm `KRP-ORDER-123:2`
(`sourceId` değişmez).

### 7.5 Mapper'ın ŞİMDİ yapacağı gerçek iş

Alan adı eşlemesi doğrulanmadı, ama mapper boş durmaz. Bunlar sağlayıcıdan bağımsızdır,
gerçek dokümanla değişmez, bu yüzden testleri anlamlıdır:

- Kimlik anahtarı sızıntısı kontrolü (K1) — **iç içe nesnelerde de**
- Zorunlu alanlar: seri, en az bir satır, pozitif miktar, negatif olmayan fiyat, KDV 0–100
- Cari eşleştirme anahtarı: VKN/TCKN → ERP kodu; **isim asla anahtar değil**
- Telefon ve e-posta normalizasyonu
- `changedSince` gönderilirse **reddet** (stockDelta `NOT_SUPPORTED`)
- Response mapper: tanımadığı zarfta **hata fırlat**, boş dizi dönme

**Kabul kriterleri:**
- [ ] Üretilen hiçbir gövdede `Mikro`/`ApiKey`/`Sifre`/`KullaniciKodu` yok — çalışma zamanında da denetleniyor
- [ ] `MIKRO_PATHS` §3.3'teki yollarla **birebir aynı** (büyük/küçük harf dahil), normalize edilmemiş
- [ ] `methodVersions` descriptor'dan okunuyor; "en yeni sürümü kullan" mantığı yok
- [ ] `cancelInvoice` `AlimSatimEvragiSilV2`'yi kendiliğinden çağırmıyor
- [ ] `descriptor.readiness === 'SCAFFOLDED'`, `lastVerifiedAt === null`

---

## 8. GÖREV 4 — Uygunluk test paketi

**Dosya:** `core/__conformance__/connector-conformance.spec.ts`

```ts
describe.each(registry.all())('$id — uygunluk', (descriptor) => { /* ... */ });
```

Sahte transport (`SpyTransport`) ağ çağrılarını **sayar**; "ağ isteği yapılmadı" iddiası
yorum satırıyla değil sayaçla kanıtlanır.

### 8.1 Zorunlu testler

| # | Ne kilitliyor |
|---|---|
| 1 | `capabilities` eksiksiz — hiçbir anahtar `undefined` değil |
| 2 | `NOT_SUPPORTED` yetenek çağrısı → `NotImplementedException`, **ağ çağrısı 0** |
| 3 | Doğrulanmamış yetenek → `IntegrationNotVerifiedError`, **ağ çağrısı 0** |
| 4 | `readiness < PRODUCTION_READY` iken hiçbir yetenek ağa çıkmıyor |
| 5 | `supportsTest`/`supportsProduction` true ise `lastVerifiedAt` dolu |
| 6 | MOCK'ta `isMock: true` ve mesajda "MOCK", ağ çağrısı 0 |
| 11 | `secret` alanlar maskeli; ham değer cevapta yok |
| 20 | Registry kaydı ile connector'ın `capabilities`'i aynı |
| 21 | Üretilen her `jobType` kapalı kümede |
| 22 | İki farklı `companyNo` **aynı token anahtarını paylaşmıyor** |
| 23 | `AccountingContext` hiçbir credential alanı taşımıyor |
| 24 | `AGENT_LOCAL` ve `derived` alanlar sunucu kaydından ayıklanıyor |
| 32 | Connector'ın ürettiği gövdede `Mikro`/`ApiKey`/`Sifre` yok |
| 36 | `derived` alanlar formda gösterilmiyor |
| 39 | Manifest'te olmayan `queryId` ve tanımsız parametre reddediliyor |
| 40 | `SELECT` dışı katalog SQL'i reddediliyor (`;`, `--`, `EXEC`, DDL/DML dahil) |
| 41 | Beklenen kolon yoksa akış duruyor — boş sonuçla devam etmiyor |
| 42 | `invoiceFindByRef` `SUPPORTED` değilken otomatik `pushInvoice` reddediliyor |
| 43 | `cancelInvoice` silme ucunu kendiliğinden çağırmıyor |
| 44 | Metot sürümleri descriptor'dan okunuyor |
| 45 | `stockDelta NOT_SUPPORTED` iken delta isteği ağa çıkmıyor |

**Kabul kriteri:** yeni bir connector eklendiğinde bu dosyaya **tek satır** eklenmeden
kapsanıyor olmalı. Ekleme gerekiyorsa paket sağlayıcıya sızmıştır — **paket düzeltilir,
test eklenmez.**

### 8.2 Mutasyon denemesi — zorunlu

Testlerin davranışı mı yoksa kodun şeklini mi ölçtüğünü anlamanın tek yolu:

| Mutasyon | Beklenen |
|---|---|
| `assertCapability` her zaman `return` etsin | birden çok test **KIRMIZI** |
| `SessionKey`'den `companyNo` düşür | token anahtarı testi **KIRMIZI** |
| Kimlik sızıntısı kontrolünü kaldır | sızıntı testi **KIRMIZI** |
| Katalog `expectedColumns` kontrolünü kaldır | drift testi **KIRMIZI** |

Bir mutasyon **yeşil kalıyorsa o test zayıftır ve düzeltilmelidir.**
Bulgu ve düzeltme PR açıklamasına yazılır.

---

## 9. GÖREV 5 — Agent (.NET)

**Klasör:** `agent/` (monorepo içinde ama **pnpm workspace'i değil**; `pnpm build` onu derlemez)

```
agent/
├── src/KroptOS.Agent.Host/        # .NET 8, Windows Service, x64
├── src/KroptOS.Agent.Protocol/    # zarf tipleri — TS karşılığı BURADAN ÜRETİLİR
├── catalog/mikro/                 # imzalı katalog SQL'leri + manifest.json
└── installer/                     # imzalı MSI
```

> **COM köprüsü (`KroptOS.Agent.ComBridge`, x86) bu görevin kapsamı DIŞINDADIR.**
> Mikro REST konuşuyor. Köprü Logo GO3 / Netsis fazında eklenecek — ama Host, ayrı süreçli
> bir köprü eklenebilecek şekilde tasarlanmalı.

### 9.1 Tünel
- **Yalnızca giden** WebSocket over TLS (`wss`), **mTLS** ile karşılıklı doğrulama
- Müşteride açılacak **gelen port yok**; kurumsal HTTP CONNECT proxy desteği
- Kalp atışı 30 sn / ölü sayma 90 sn; yeniden bağlanma üstel geri çekilme + jitter, üst sınır 60 sn
- Her mesajda `protocolVersion`; sunucu **N ve N-1** kabul eder

### 9.2 Dağıtık tuzak — atlanırsa üretimde bulunur
WS soketi **tek bir backend node'unun belleğindedir**; başka node'daki BullMQ worker'ı o
Agent'a iş gönderemez. Çözüm: soketi tutan node `agent:{agentId}` Redis kanalına abone olur,
iş bırakan node oraya yayınlar. `connectedNodeId` **yalnızca gözlemdir**, yönlendirmede
kullanılmaz (bayatlar).

### 9.3 Kayıt (enrollment) ve iptal
1. Panelde `agent.manage` yetkilisi **tek kullanımlık** kod üretir (TTL 15 dk, kiracı kapsamlı, audit'li)
2. Agent makinede **dışa aktarılamaz** anahtar çifti üretir (Windows CNG), CSR gönderir
3. KroptOS kodu doğrular, kısa ömürlü istemci sertifikası imzalar, kodu **yakar**
4. Özel anahtar makineden **hiç çıkmaz**; yedekten dönen sunucu yeniden kayıt olur

**İptal sertifika süresini beklemez:** yetki, tünel üzerinden yenilenen kısa ömürlü oturum
belirtecidir (öneri 15 dk). `status = REVOKED` → yeni belirteç verilmez, açık tünel kapatılır,
Agent `REVOKED` cevabını alınca **yerel kasasını siler ve durur.**

### 9.4 Kimlik girişi — sunucu görmeden (K2)
```
1. Panel AgentInstance.publicKey'i çeker
2. Tarayıcıda credential hibrit şifrelenir (rastgele simetrik anahtar + açık anahtarla sarmalama)
3. Sunucuya YALNIZCA blob gider — sunucunun özel anahtarı YOK
4. Agent çözer, yerel kasasına yazar (DPAPI makine kapsamı + agent anahtarı)
5. Teslim onayında sunucudaki blob SİLİNİR
```

### 9.5 İş döngüsü
- **En az bir kez teslim.** Tünel kopması "iş çalışmadı" demek değildir.
- **Yerel tekrar-koruma kasası:** `idempotencyKey → { jobId, status, data, completedAt }`,
  TTL **7 gün**. Aynı anahtar ikinci kez gelirse **ERP'ye gidilmez**, saklı sonuç
  `fromCache: true` ile döner. Tünel koptuğunda çift fatura yazılmamasının tek panzehiri budur.
- Eşzamanlılık: `(integrationId, companyKey)` başına yazma **1**, okuma varsayılan **2**
- Küme dışı `type` → iş reddedilir + `IntegrationLog`'a `warn`
- `ttlSec` dolmuş iş çalıştırılmadan `EXPIRED`; **sessizce atılmaz**, problem kuyruğuna yazılır
- Çevrimdışıyken: `STOCK_DELTA`/`STOCK_SNAPSHOT` işleri **coalesce** olur (kuyrukta en son bir tane);
  yazma işleri **birikir ve sırası korunur**
- `jobTimeoutSec` (varsayılan 120) aşımında iş iptal edilmeye çalışılmaz

### 9.6 Mikro'ya özgü davranış
- Kimlik zarfı (`Mikro: {...}`) **Agent'ta** kurulur; `FirmaKodu`/`CalismaYili`
  `AgentJob.companyKey`'den, diğer üçü yerel kasadan gelir
- `Sifre` **her istekte** `MIKRO_DATE_MD5` ile yeniden türetilir — **cache'lenmez** (K8)
- Kimlik hatasında zarf **tam bir kez** yeniden türetilerek denenir; ikincisinde
  `erp_auth_failed` ve **retry yok**
- Agent ile Mikro farklı makinedeyse tarih farkı kontrol edilir; fark varsa iş
  **çalıştırılmadan** `erp_clock_skew` ile başarısız olur
- `CATALOG_QUERY`: `queryId` manifest'te aranır, parametreler tip ve uzunluk doğrulamasından
  geçer, **string birleştirme yok**. Katalog dosyasında `SELECT`/`WITH` dışı ifade varsa
  Agent **yüklemeyi reddeder ve başlamaz**

### 9.7 Güncelleme ve gözlem
- İmzalı MSI; Authenticode doğrulanmadan kurulmaz. **Sunucu ikili kod göndermez** — "yeni
  sürüm var" der, Agent kendisi indirir ve imzayı doğrular
- Servis hesabı **LocalSystem değil**, kısıtlı özel hesap
- Kanallar `canary` → `stable`; başlatma sağlık kontrolü 3 kez başarısız olursa otomatik geri alma
- Kalp atışında: sürüm, OS, ERP sürümü, **saat farkı**, iş sayaçları
- Problem kuyruğu kodları: `agent_offline`, `agent_failover_blocked`, `erp_auth_failed`,
  `erp_session_limit`, `erp_clock_skew`, `mapping_missing`, `stock_sync_stale`,
  `invoice_stuck`, `catalog_schema_drift`

**Agent testleri (ayrı paket):**
- [ ] Aynı `idempotencyKey` ile ikinci iş → ERP'ye çağrı **yok**, `fromCache: true`
- [ ] Küme dışı `type` reddediliyor, çalıştırılmıyor, loglanıyor
- [ ] `REVOKED` cevabı → yerel kasa siliniyor, Agent duruyor
- [ ] Kimlik zarfı iki ardışık istekte **iki kez** türetiliyor
- [ ] Gün sınırı simülasyonu: tarih değişince önceki zarf kullanılmıyor
- [ ] Katalog dosyasında `SELECT` dışı ifade → Agent **başlamıyor**
- [ ] Credential çözüldükten sonra hiçbir log satırında görünmüyor

---

## 10. GÖREV 6 — Backend API + Frontend

**Backend:** `modules/accounting/` ve `modules/agent/` — §1.2'deki modül dörtlüsü kalıbıyla.

RBAC izinleri (seed'e eklenecek): `accounting.read`, `accounting.manage`,
`accounting.credential.manage`, `accounting.invoice.push`, `agent.read`, `agent.manage`.
**`accounting.credential.manage` ve `agent.manage` AYRI izinlerdir** — Agent kurabilen kişi
otomatik olarak ERP şifresi girebilen kişi değildir.

### 10.1 Fatura yazma akışı — üç katman, sırası değişmez

```
1. SUNUCU CLAIM (ağ çağrısından ÖNCE)
   AccountingDocumentLink: status='claimed', erpDocumentId=NULL
   → P2002 (agencyId, integrationId, companyKey, sourceType, sourceId)
       = yarış; KAZANANI OKU VE DÖN, ERP'ye HİÇ GİTME
2. ANCAK ŞİMDİ connector.pushInvoice()   ← Agent kasası ikinci katman
3. Sonuçla update → status='written'
   Timeout/bilinmeyen hata → status='stuck'
```

Adım 1'i 2'nin arkasına almak TOCTOU'yu geri getirir; **test çağrı sırasını doğrulamalı**
(`['claim', 'connector']`). Ağ çağrısı uzun DB transaction'ı içinde yapılmaz.

**Asılı claim'in tek çıkışı:**
```
INVOICE_FIND_BY_REF(externalRef)
  bulundu    → erpDocumentId yaz, status='written'   (yazılmış, cevabı kaybolmuş)
  bulunamadı → status='failed', yeniden denenebilir  (yazılmamış)
```

**İptalin üç dalında da KroptOS tarafı kapanır** — açık kalan claim sonraki denemeyi kilitler.

### 10.2 Stok akışı
- Salt okuma. Tam sayım; **delta yok** (`stockDelta: NOT_SUPPORTED`)
- Sıklık: Mikro'nun limitleri doğrulanmadığı için **saatlik başla**, ölç, sıkılaştır
- Yazma: `Inventory` + `StockMovement` (`source: 'ERP'`, `reference: syncSessionId`).
  `'LOGO'` değeri geriye dönük korunur
- Bayatlık: son başarılı senkron üzerinden `3 × periyot` geçtiyse `stock_sync_stale`
  **ve panelde uyarı**. Bayat stokla pazaryerine bildirim aşırı satış demektir

### 10.3 Frontend sayfaları

| Sayfa | İçerik |
|---|---|
| `/t/{tenant}/accounting` | Bağlantı kartları (**registry'den üretilir**), durum rozeti, ticari ön koşul uyarısı |
| `/t/{tenant}/accounting/[id]` | Firma/dönem listesi, **credential formu şemadan üretilir**, bağlantı testi, yetenek matrisi |
| `/t/{tenant}/accounting/mapping` | Ürün ve depo eşlemesi, eşleşmeyenler, toplu işlem, CSV |
| `/t/{tenant}/accounting/jobs` | İş kuyruğu, problem kuyruğu, **asılı claim'ler ve çözme aksiyonu** |
| `/t/{tenant}/agents` | Agent listesi, kayıt kodu üretme, sürüm, son görülme, iptal |

Credential formunda **yeni sağlayıcı için form kodu yazılmaz** — şemadan üretilir.
`derived` alanlar gösterilmez. Panelde kimlik durumu üç değerlidir:
`Tanımlı değil` / `Tanımlı (tarih, kullanıcı)` / `Geçersiz (son hata)`.

Bağlantı durumu da üç değerlidir: `Bağlı` / `Bağlı değil (son görülme: …)` / `İptal edildi`.

---

## 11. Yasaklar

- Mikro endpoint yolu, alan adı, tablo adı, kolon adı, hata kodu, durum kodu, rate limit
  **uydurmak** — doğrulanmadıysa `DOCUMENTATION_REQUIRED`
- §3.3'teki yolları normalize etmek (büyük/küçük harf düzeltmek)
- Panelden ya da sunucudan **serbest SQL** göndermek; katalog dışı `queryId` çalıştırmak
- Katalog sorgusuna string birleştirmeyle parametre gömmek
- ERP credential'ını sunucuda persist etmek, loglamak, audit'e yazmak, cevapta döndürmek
- `Sifre` hash'ini cache'lemek (gün boyu geçerli bir taşıyıcı kimliktir)
- Ham `password`'ü Mikro'ya göndermek (yalnızca türetilmiş `Sifre` gider)
- Token'ı firma ekseninden bağımsız cache'lemek
- `findInvoiceByRef` olmadan otomatik fatura yazmayı açmak
- `AlimSatimEvragiSilV2`'yi iptal olarak kullanmak
- Evrak **sıra numarasını** KroptOS'ta üretmek
- Aynı bağlantıya ikinci bir Agent bağlamak
- Agent'ı Mikro sunucusundan farklı makineye, düz HTTP ile, **işaretlemeden** kurmak
- `StokListesiV2`'ye doğrulanmamış bir "değişim tarihi" parametresi uydurup delta iddia etmek
- Desteklenmeyen yetenekte sahte başarı döndürmek
- Gerçek çağrı yapılmadan `TEST_READY` / `PRODUCTION_READY` / `lastVerifiedAt` işaretlemek
- Mock cevabı gerçek gibi göstermek, sahte belge numarası üretmek
- e-belge uçlarını fatura akışının içine karıştırmak
- `prisma migrate dev` çalıştırmak
- `ErpStockSettings` / `LogoWarehouseMapping` / `LogoProductMapping` silmek
- `eticaret-system/` klasörüne dokunmak
- Ağ çağrısını uzun DB transaction'ı içinde yapmak
- Tek büyük dosya yazmak, alakasız refactor yapmak, mevcut kullanıcı değişikliğini silmek

---

## 12. Bilinmeyenler — UYDURMA, listeye ekle

Ajan bunlarla karşılaşırsa **durur ve soru olarak raporlar**; tahmin yürütmez:

1. `Sifre` hash'inin tam biçimi: tarih formatı, ayraç, büyük/küçük harf, saat dilimi
2. Mikro cevap zarfının şekli ve hata formatı
3. Alan adı eşlemeleri (stok, cari, fatura gövdeleri)
4. `StokListesiV2` filtre ve sayfalama parametreleri; depo kırılımı dönüyor mu
5. `user_tablo` kolonları her kurulumda var mı, tanımlanması mı gerekiyor
6. Rate limit değerleri (üçüncü taraf sayfalardaki tablolar **resmî değil, koda yazılmaz**)
7. HTTPS desteği ve v18+ uyumu
8. Tahsilat karşılığı hangi endpoint (`Kasa Masraf Fişi`?)
9. `DahiliStokHareketGuid`'in anlamı
10. Evrak sıra numarasını Mikro üretiyor mu, `sira` zorunlu mu

**Faz D gün 1 tek kritik yol:** madde 1 doğrulanmadan hiçbir şey ilerlemez. En fazla altı
varyant denenir ve sonuç dokümana yazılır ki bir sonraki oturum aynı deneyi tekrar etmesin.
Takılırsa `apidestek@mikro.com.tr`.

---

## 13. Tanımlı Bitti (Definition of Done)

Bir görev şunların hepsi sağlanmadan bitmiş sayılmaz:

- [ ] `pnpm lint && pnpm test && pnpm build` yeşil
- [ ] Uygunluk paketi yeni kodu **tek satır eklenmeden** kapsıyor
- [ ] Mutasyon denemesi yapıldı; her mutasyon kırmızı verdi (§8.2)
- [ ] Şema değiştiyse `.sql` diff'i üretildi ve commit'lendi; `db:push` uygulandı
- [ ] Yeni izinler seed'e eklendi
- [ ] i18n anahtarları **12 dilin hepsine** eklendi
- [ ] Kod commit'lendi ve push'landı — `git ls-files` ile doğrulandı
- [ ] Hiçbir sağlayıcı `PRODUCTION_READY` işaretlenmedi
- [ ] §12'deki bilinmeyenlerden hiçbiri tahmin edilmedi

### Çalışma sonu raporu (her görev için)

1. Okunan mevcut dosyalar ve devralınan kalıplar
2. Oluşturulan / değiştirilen dosyalar
3. Kurulan bileşenler
4. Test sonuçları ve **mutasyon denemesi bulguları**
5. **Çatının uygulama sırasında aldığı düzeltmeler** — *bu madde boşsa çatı doğrulanmamış demektir*
6. Şema durumu (üretilen SQL, `db push` uygulandı mı)
7. Güvenlik: şifreleme, maskeleme, tenant filtresi, credential'ın sunucuya ulaşmadığının kanıtı
8. Açık TODO'lar ve §12'ye eklenen yeni bilinmeyenler

---

## 14. Kaynaklar

- https://apidocs.mikro.com.tr/ · `/install` · `/guides`
- https://apidocs.mikro.com.tr/apis/cari · `/apis/stok` · `/apis/alim-satim-evraki-fatura` ·
  `/apis/listeler` · `/apis/sql-sorgulama` · `/apis/e-fatura-islemleri`
- https://www.mikro.com.tr/mikro-program-api-basvuru/
- Destek: `apidestek@mikro.com.tr`
- Proje içi (varsa): `claude/09_MUHASEBE_AGENT_CATISI.md` (çatı),
  `claude/10_MIKRO_AGENT_ENTEGRASYONU.md` (Mikro eki),
  `00_PROJECT_CONTEXT.md`, `02_BACKEND_MODULE_ANATOMY.md`, `claude/CONTRIBUTING.md`