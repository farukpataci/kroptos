# KroptOS — Nebim V3 Agent + API Entegrasyonu · Uygulama Brifingi

> **Bu dosya bir tasarım dokümanı değil, bir AJANA VERİLECEK İŞ EMRİDİR.**
> Antigravity (ya da başka bir kodlama ajanı) bu dosyayı okuyup `farukpataci/kroptos`
> deposunda kodu yazacak.
>
> **ÖN KOŞUL:** `claude/11_MIKRO_AGENT_UYGULAMA_BRIEFI.md` içindeki **GÖREV 1 (veri modeli)**
> ve **GÖREV 2 (connector çekirdeği)** tamamlanmış olmalı. Nebim ikinci sağlayıcıdır;
> çatıyı yeniden kurmaz, **üstüne biner ve dört yerde düzeltir** (§4).
> Çekirdek henüz yoksa: önce doküman 11 GÖREV 1–2, sonra bu dosya.

---

## 0. Nasıl kullanılır

**Önerilen:** her seferinde §1–§5 + tek bir GÖREV bloğunu ajana ver.

```
Bu brifingi uygula. Ön koşul olarak integrations/accounting/core/ çekirdeğinin
var olduğunu doğrula; yoksa DUR ve bildir. §5'teki değişmez kuralları ve §11'deki
yasakları hiçbir koşulda ihlal etme. Emin olmadığın hiçbir endpoint, metot adı,
alan adı, tablo adı, saklı yordam adı veya hata kodunu UYDURMA — §12'deki
bilinmeyen listesine ekle ve DOCUMENTATION_REQUIRED olarak işaretle.
```

Her görev sonunda `pnpm lint && pnpm test && pnpm build` yeşil olmadan görev bitmiş sayılmaz.

---

## 1. Depo bağlamı — kısa

Monorepo (pnpm): `packages/backend` (NestJS + Prisma + PostgreSQL + Redis/BullMQ),
`packages/frontend` (Next.js), `packages/shared`. **Aktif proje `packages/*`;
`eticaret-system/` arşivdir, dokunulmaz.**

Kiracı: `Agency ──< Client ──< Store`. `x-agency-id` / `x-client-id` / `x-store-id`
header'ları, `TenantGuard` + `tenant.middleware`. **Her sorguda tenant filtresi zorunlu.**

Konvansiyonlar (doküman 11 §1.2 ile aynı, tekrar edilmez):
modül dörtlüsü + guard zinciri + `@RequirePermission` + Swagger; servis katmanında
tenant filtresi + soft delete + audit; frontend `'use client'` + `apiFetch` +
`hooks/useXxx.ts` + `kp-*` token + `useTranslations` (12 dil);
connector kalıbı `integrations/marketplaces/` ikizi.

**Prisma: `prisma migrate dev` / `pnpm db:migrate` ÇALIŞTIRMA.**
`migrate diff --script` → `docs/plans/<ad>.sql` → `pnpm db:push`.

Git: `feature/<kisa-aciklama>`, Conventional Commits, squash merge.
**Kod yazılır yazılmaz commit'le.**

---

## 2. Ne inşa edilecek — ve Nebim'i diğerlerinden ayıran şey

Nebim V3 müşteri sunucusunda çalışır. KroptOS buluttan oraya bağlanamaz; **KroptOS Agent**
müşteri sunucusuna kurulur, KroptOS'a **dışarı doğru** bağlanır, işler o tünelden iner.
Mimarinin geri kalanı Mikro ile aynıdır (doküman 11 §2).

**Ama bir fark var ve bu farkı yanlış kurmak müşterinin işini durdurur:**

> **Nebim V3 Integrator'a kurulan her eşzamanlı bağlantı, müşterinin Nebim lisans
> havuzundan GERÇEK BİR KULLANICI LİSANSI tüketir.**
>
> Resmî lisans kuralları: *"Nebim V3 Integrator tarafından sunulan servisleri kullanarak
> Nebim V3'e bağlantı kuran harici programlar, yazılım geliştirilirken kodlanan Ofis
> Kullanıcısı ya da Mağaza Kullanıcısı 'kullanıcı tipine' göre, lisans kapsamındaki lisans
> adetlerinden kullanırlar."*

Mikro'da eşzamanlılık bir performans ayarıydı. **Nebim'de eşzamanlılık, mağazadaki bir
kasiyerin sisteme girip giremeyeceğini belirler.** Agent dört paralel oturum açarsa dört
çalışan dışarıda kalır — ve kimse bunun sebebini KroptOS'ta aramaz.

Bunun iki doğrudan sonucu var, §5'te K14 ve K15 olarak kurallaştırılmıştır:
eşzamanlılık tavanı **varsayılan 1**'dir ve sızan bir oturum **sızan bir lisanstır**.

```
┌──────────── KroptOS Bulut ────────────┐      ┌──── Müşteri Sunucusu ────┐
│ AccountingConnector (protokol)        │      │  KroptOS Agent (Windows) │
│      ▼                                │      │   ├ tünel istemcisi      │
│ AccountingTransport → AgentTransport ─┼══════╪► ├ yerel kimlik kasası   │
│ AgentGateway (WSS, giden mTLS)        │      │   └ OTURUM HAVUZU ◄── YENİ│
│ Redis pub/sub · BullMQ · Postgres     │      │          │               │
└───────────────────────────────────────┘      │          ▼               │
                                                │ http://[IP]:[port]/      │
                                                │   IntegratorService/     │
                                                │ Nebim V3 + MS SQL        │
                                                └──────────────────────────┘
```

---

## 3. Doğrulanmış Nebim gerçekleri

Kaynak: Nebim resmî sayfaları ve PDF'leri (2026-09-14 okuması) + ikincil kaynaklar.
**Nebim'e gerçek kimlikle tek bir çağrı yapılmadı.** Ajan bu tabloyu genişletmez.

### 3.1 Entegrasyon yolu — DOĞRULANDI

| Bilgi | Kaynak sınıfı |
|---|---|
| Resmî yöntem: **"REST API services provided by Nebim V3 Integrator"** — gerçek zamanlı, platform/cihaz bağımsız | **BİRİNCİL** (nebim.com.tr) |
| İkinci resmî yöntem: veri ambarı ile **veritabanı import/export** | **BİRİNCİL** (nebim.com.tr) |
| **Nebim V3 Integrator dört sürümün hepsinde standart**: Başlangıç · Standart · İleri · Kurumsal | **BİRİNCİL** (Sürüm Karşılaştırması PDF) |
| Nebim'in kendi kargo ve mobil modülleri de ön koşul olarak Integrator istiyor | **BİRİNCİL** (aynı PDF) |

> **DOKÜMAN 08'İN NEBİM SATIRI ESKİMİŞTİR.** Orada rota `AGENT+SQL`, doküman durumu
> "doküman yok" yazıyordu. Gerçek: resmî bir REST ürünü var. **Rota `AGENT+API`'dir;
> `AGENT+SQL` yalnızca salt-okunur katalog yedeğidir.**

### 3.2 Lisans — DOĞRULANDI, BİRİNCİL

- Integrator için **ayrı bir lisans türü yoktur.**
- Bağlanan harici program, **geliştirme sırasında kodlanan kullanıcı tipine** göre
  (Ofis Kullanıcısı / Mağaza Kullanıcısı) **lisans havuzundan tüketir.**
- Lisans **eşzamanlı kullanıcı sayısına** bağlıdır, sunucuya değil.

**DOĞRULANMADI:** oturum bırakılmazsa lisansın ne kadar süre tutulduğu; Nebim'in oturum
zaman aşımı; tavan aşıldığında dönen hata.

### 3.3 Bağlantı ve kimlik — İKİNCİL (forum), doğrulanmalı

| Bilgi | Durum |
|---|---|
| Bağlantı ucu: `http://[IP]:[port]/IntegratorService/Connect` | **İKİNCİL** |
| Kimlik parametreleri: **User Group Code · Username · Password · Database Name** | **İKİNCİL** |
| Cevap JSON ve **`SessionID` döner**: `{"ModelType":0,"SessionID":"…","Status":"Connection Created Successfully"}` | **İKİNCİL** |
| Giriş yapılmadan çağrı: *"You must be login to use service methods"* | **İKİNCİL** |
| Varsayılan port, HTTPS desteği, `Disconnect` metodu, oturum ömrü | **DOĞRULANMADI** |
| Metot listesi (Connect dışında), istek/cevap zarfı, hata kodu sözlüğü | **DOĞRULANMADI** |

**Mimari sonuç:** Mikro'nun aksine Nebim'de **oturum vardır** (`SessionID`). Yani
09 §5.3'teki oturum anahtarı burada gerçek bir kaynağı yönetir — ve o kaynak ücretlidir.

### 3.4 Yazma için gereken kodlar — İKİNCİL (kurulum rehberleri), ama kritik

Gerçek Nebim entegrasyonları bağlantı bilgisinin yanında şu **"kayıt parametrelerini"**
ister; bunlar olmadan yazma ya başarısız olur ya **yanlış yere düşer**:

| Kod | Nebim'de nereden alınır |
|---|---|
| **Ofis Kodu** | Ayarlar → Şirket Ofisleri |
| **Mağaza Kodu** | Mağazaların Yönetimi → Mağazalar |
| **Sipariş Aktarımı Depo Kodu** | Ayarlar → Şirket Ofisleri |
| **Teslimat Yönetim Kodu** | Satış & Pazarlama |
| **Kredi Kartı Tip Kodu** | Finansman Yönetimi → Kredi Kartı Tipi |
| **Banka Hesabı Kodu** | Finansman Yönetimi → Banka Hesabı |

Ayrıca: *"API Bilgileri Tanımlama kısmındaki bilgiler **Nebim bayiniz** tarafından
verilecektir."* → kimlik **ticari kanaldan** gelir, kendiliğinden üretilemez.

### 3.5 Sektör normu — teyit edici

Nebim ile çalışan üçüncü taraf entegratörler müşteri sunucusuna **kendi `.exe`'lerini**
kuruyor. Yani "on-prem ajan" bu ERP'de istisna değil, **norm**. Agent yaklaşımı doğrulanmıştır.

---

## 4. Nebim'in çatıya yaptırdığı düzeltmeler

> Doküman 11'de `K1–K13` ve `D1–D4` vardı. Nebim iki yapısal düzeltme daha dayatıyor.
> **Bu madde boşsa çatı doğrulanmamış demektir** — burada boş değil.

### D5 — `requiresPeriod` bir bayrak değil, `periodPolicy` bir politikadır

Çekirdekteki descriptor değişmezi şunu söylüyordu:

```ts
if (d.requiresPeriod === false && d.capabilities.invoicePush === 'SUPPORTED') throw …
```

Gerekçesi doğruydu (dönem ekseni olmadan dönem kontrolü yapılamaz), ama **Logo/Mikro'ya
göre yazılmıştı**: ikisinde de dönem bir numaradır (`dönem no`, `CalismaYili`).
Nebim'de dönem numarası yoktur; muhasebe dönemi tarih aralığıdır ve kontrolü ERP yapar.
Mevcut kural Nebim'i registry'ye sokmaz.

**Düzeltme — `requiresPeriod` kaldırılır, yerine:**

```ts
periodPolicy:
  | 'PERIOD_NUMBER'   // dönem bir numaradır; CompanyKey.periodNo zorunlu (logo-*, mikro)
  | 'DATE_RANGE'      // dönem tarih aralığıdır; açık dönem KroptOS'ta tutulur
  | 'ERP_ENFORCED';   // kontrolü ERP yapar; KroptOS ön kontrol yapmaz, hatayı YORUMLAR
```

Yeni değişmez: **üçünden biri seçilmeden `invoicePush` `SUPPORTED` olamaz.**
Kapanmış döneme yazma kontrolü politikaya göre çalışır; `ERP_ENFORCED`'da
`assertPeriodMatches` atlanır ama ERP'nin dönem hatası **kendi hata sınıfına** eşlenir
(sessizce "bilinmeyen hata" olmaz).

Nebim başlangıç değeri: `'ERP_ENFORCED'` (DOCUMENTATION_REQUIRED — Faz D'de doğrulanacak).

### D6 — `AccountingCompany.postingDefaults` — yazmanın ön koşulu

§3.4'teki altı kod `defaultAccountCodes` Json alanına sıkıştırılamaz: bunlar hesap planı
değil, **yazma hedefi**dir. Eksik bir depo kodu faturayı yanlış depoya, eksik bir banka
hesabı kodu tahsilatı yanlış hesaba yazar — ve ikisi de **hata vermez.**

**Düzeltme:**

```prisma
model AccountingCompany {
  // ...
  postingDefaults Json?   // sağlayıcının bildirdiği şemaya göre doğrulanır
}
```

```ts
// descriptor'a eklenir
postingDefaultSpec?: readonly PostingFieldSpec[];
// { key, label (i18n), required, appliesTo: ('INVOICE'|'RECEIPT'|'ORDER'|'STOCK')[] }
```

**Kural:** bir yazma işi kuyruğa girmeden önce, o iş tipinin gerektirdiği tüm `required`
kayıt parametreleri dolu olmalıdır. Eksikse iş **Agent'a hiç gitmez**; operasyona
`posting_defaults_missing` problem kaydı düşer. Bu, 09 §7.3.5'teki "kapanmış döneme yazma
connector'a ulaşmadan reddedilir" kuralının kardeşidir.

### D7 — `AGENT_JOB_TYPES`'a `SESSION_RELEASE` eklenir

Nebim oturumu **ücretli bir kaynaktır** ve bırakılması gerekir. Bırakma, bir iş sonucunun
yan etkisi olamaz: Agent çöküp yeniden başladığında **yetim oturumları** kapatmak için
açık bir iş tipine ihtiyaç var.

`SESSION_RELEASE` bir sağlayıcıya değil, **oturum tutan her rotaya** aittir → çekirdeğe
girer (D1'deki `CATALOG_QUERY` ile aynı gerekçe). Uygunluk testi 21 değişmez.

---

## 5. Değişmez kurallar

**Doküman 11 §4'teki `K1–K13`'ün tamamı aynen geçerlidir.** Özellikle:
K1 (kimlik connector'a girmez) · K2 (credential sunucuda saklanmaz) · K3 (sahte başarı yok) ·
K4 (oturum anahtarı firma eksenini içerir) · K6 (Agent uzaktan kabuk değil) ·
K7 (serbest SQL yok, adlandırılmış katalog var) · K9 (bağlantı başına tek aktif Agent) ·
K11 (`findInvoiceByRef` yoksa otomatik yazma yok) · K13 (ERP adları çekirdeğe sızmaz).

Nebim bunlara yedi kural ekler:

**K14 — Eşzamanlılık tavanı bir lisans sınırıdır, performans ayarı değildir.**
`maxSessions` yapılandırılabilir, **varsayılan 1**. Tavanı aşan iş kuyrukta bekler,
ikinci oturum **açılmaz**. Panelde bağlantı kartında şu yazar:
*"Bu bağlantı Nebim lisansınızdan en fazla N eşzamanlı kullanıcı tüketir."*
Değer değiştirilirken uyarı gösterilir ve değişiklik audit'lenir.

**K15 — Sızan oturum sızan lisanstır.**
Agent açtığı her `SessionID`'yi **yerel dayanıklı depoya** yazar. Açılış sırasında yetim
oturumlar için `SESSION_RELEASE` denenir. Aynı `SessionKey` için bırakılmamış bir oturum
varken **yeni oturum açılmaz**. Her iş sonunda oturum ya havuza döner ya bırakılır;
hiçbir kod yolunda "bırakmayı unut" dalı olamaz — `finally` zorunludur.

**K16 — Oturum havuzu `SessionKey` başınadır.**
`SessionKey = <integrationId>:<databaseName>:<-|periodNo>:<officeCode>`
Boştaki oturum 10 dk sonra **bırakılır** (Mikro'da kapatılırdı; burada bırakılması
lisansı geri verir). Yoğun saat penceresi tanımlanabilir: o pencerede tavan **0**'a
çekilebilir ve senkron durur — bu bir arıza değil, bilinçli bir seçimdir ve panelde görünür.

**K17 — Kayıt parametreleri doğrulanmadan yazma işi kuyruğa girmez.** (D6)

**K18 — Dönem kontrolü politikaya göre yapılır.** (D5)
Nebim'de `ERP_ENFORCED`: KroptOS ön kontrol yapmaz, ama ERP'nin dönem/kapalı-hesap hatasını
`ClosedPeriodError`'a eşler. **"Bilinmeyen hata" olarak geçiştirilmez.**

**K19 — Integrator düz HTTP ile örneklenmiştir.**
Kimlik `Connect` çağrısında düz metin gider ve `SessionID` sonraki her çağrıda taşınır.
Agent, Nebim Integrator ile **aynı makinede** kurulur ve `localhost`'a bağlanır.
Zorunlu istisna `transportSecurity = 'PLAINTEXT_LAN'` olarak işaretlenir ki denetimde görünsün.

**K20 — Veritabanına yazma yasaktır.**
Nebim'in resmî ikinci yolu "veritabanı import/export"tur ve SQL erişimi teknik olarak
mümkündür. **Yazma yalnızca Integrator üzerinden yapılır.** Doğrudan SQL yazmak Nebim'in
iş mantığını (stok hareketi, muhasebe fişi, mağaza/depo tutarlılığı) atlar; hatanın
faturası müşteriye çıkar ve geri dönüşü yoktur. SQL rotası **yalnızca okuma**, yalnızca
imzalı katalog (K7).

---

## 6. GÖREV N1 — Şema ve çekirdek düzeltmeleri

**Dal:** `feature/accounting-nebim-core`

1. `AccountingProviderDescriptor`: `requiresPeriod` → **`periodPolicy`** (D5).
   Değişmezi güncelle: üçünden biri seçilmeden `invoicePush` `SUPPORTED` olamaz.
   Mevcut `mikro` descriptor'ı `periodPolicy: 'PERIOD_NUMBER'` olarak taşınır.
2. `AccountingCompany`'ye **`postingDefaults Json?`** ekle (D6).
   Descriptor'a `postingDefaultSpec?: PostingFieldSpec[]` ekle.
   `assertPostingDefaults(spec, values, jobType)` yardımcısını çekirdeğe yaz (K17).
3. `AGENT_JOB_TYPES`'a **`SESSION_RELEASE`** ekle (D7).
4. `AccountingIntegration`'a **`maxSessions Int @default(1)`** ekle (K14).
5. Yeni problem kodu: **`posting_defaults_missing`**, **`erp_session_limit`** (zaten vardı,
   Nebim'de gerçek anlam kazanıyor), **`session_leaked`**.
6. `AccountingErrors`'a: `PostingDefaultsMissingError` (400), `SessionLimitReachedError` (503).

**Kabul kriterleri:**
- [ ] `npx prisma validate` + `generate` temiz; `.sql` diff üretildi ve commit'lendi; `db:push` uygulandı
- [ ] `mikro` descriptor'ı yeni alanlarla derleniyor, mevcut testleri **hâlâ yeşil**
- [ ] `periodPolicy` seçilmemiş bir descriptor registry'ye **giremiyor**
- [ ] `pnpm build` temiz

---

## 7. GÖREV N2 — Nebim connector

**Dal:** `feature/accounting-nebim`
**Klasör:** `packages/backend/src/integrations/accounting/nebim-v3/`

```
nebim-v3.types.ts             # endpoint sabitleri, oturum tipleri
nebim-v3.capabilities.ts      # başlangıç statüleri — §7.2
nebim-v3.credential-schema.ts # §7.3
nebim-v3.posting-defaults.ts  # §7.4 — D6 şeması
nebim-v3.catalog.ts           # salt-okunur katalog SÖZLEŞMESİ (SQL metni YOK)
nebim-v3.request-mapper.ts    # kimliksiz gövde + doğrulama/normalizasyon
nebim-v3.response-mapper.ts   # savunmacı; tanımadığı şekli TAHMİN ETMEZ
nebim-v3.error-mapper.ts      # dönem/lisans/oturum hatalarını AYRI sınıflara eşler
nebim-v3.descriptor.ts        # readiness: 'SCAFFOLDED'
nebim-v3.connector.ts
```

### 7.1 Sağlayıcı kimliği

```ts
id: 'nebim-v3'
vendorFamily: 'nebim'
productScope: ['Nebim V3 Başlangıç', 'Nebim V3 Standart', 'Nebim V3 İleri', 'Nebim V3 Kurumsal']
protocol: 'REST'
supportedRoutes: ['AGENT']      // DIRECT yok — K19
erpClass: 'ERP'
periodPolicy: 'ERP_ENFORCED'    // DOCUMENTATION_REQUIRED
readiness: 'SCAFFOLDED'
lastVerifiedAt: null
licensePrerequisite: 'accounting.nebim.prerequisite.userLicense'
commercialPrerequisite: 'accounting.nebim.prerequisite.dealer'
```

**`CompanyKey` eşlemesi — Logo/Mikro'dan FARKLI:**

```
CompanyKey.companyNo  ← databaseName   (Nebim'de bir veritabanı = bir şirket)
CompanyKey.periodNo   ← kullanılmaz (null)
CompanyKey.branchCode ← officeCode     (Şirket Ofisi)
```

Mağaza ve depo kodları **firma ekseni değil, kayıt parametresidir** → `postingDefaults`.
Bunları `CompanyKey`'e koymak oturum havuzunu gereksiz yere böler ve **her depo için ayrı
lisans tüketir.** Bu hata pahalıdır; yapma.

### 7.2 Başlangıç yetenek tablosu — bu değerlerle başla

| Yetenek | Statü | Gerekçe |
|---|---|---|
| `connectionTest` | `DOCUMENTATION_REQUIRED` | `Connect` ucu ikincil kaynaktan biliniyor, cevabı doğrulanmadı |
| `companyList` | `DOCUMENTATION_REQUIRED` | Veritabanı listesi Integrator'dan alınabilir mi bilinmiyor |
| `warehouseList` | `DOCUMENTATION_REQUIRED` | |
| `productSearch` / `productFetch` | `DOCUMENTATION_REQUIRED` | |
| `productCreate` | `CONTRACT_REQUIRED` | ERP kartı açma ilk fazda kapalı |
| `stockSnapshot` | `DOCUMENTATION_REQUIRED` | |
| `stockDelta` | `DOCUMENTATION_REQUIRED` | **`NOT_SUPPORTED` yapma** — Nebim'de değişim damgası olabilir; kanıtlanmadan da iddia edilmez |
| `partnerFetch` / `partnerUpsert` | `DOCUMENTATION_REQUIRED` | Bazı üçüncü taraf entegrasyonlar cari aktarımının desteklenmediğini söylüyor — doğrulanmalı |
| `receiptPush` | `DOCUMENTATION_REQUIRED` | Banka hesabı / kredi kartı tip kodu ön koşul |
| `invoicePush` | `DOCUMENTATION_REQUIRED` | |
| `invoiceFindByRef` | `DOCUMENTATION_REQUIRED` | Dış referans alanı bulunmadı — §12/4 |
| `invoiceCancel` | `DOCUMENTATION_REQUIRED` | İptal mi silme mi olduğu bilinmiyor; Mikro dersi geçerli |
| `eDocument` | `NOT_SUPPORTED` | Kapsam dışı — ikinci eksen |

**Bu tabloyu elle `SUPPORTED` yapma.** Her satır Faz D'de gerçek çağrıyla değişir ve
`lastVerifiedAt` o zaman dolar.

### 7.3 Credential şeması

| Alan | Tip | storage | Not |
|---|---|---|---|
| `baseUrl` | string | `SERVER_ENCRYPTED` | `http://localhost` varsayılan |
| `port` | number | `SERVER_ENCRYPTED` | **varsayılan yok — DOĞRULANMADI**, zorunlu alan |
| `servicePath` | string | `SERVER_ENCRYPTED` | `/IntegratorService` (ikincil kaynak) |
| `userGroupCode` | string | `AGENT_LOCAL` | |
| `username` | string | `AGENT_LOCAL` | |
| `password` | password | `AGENT_LOCAL` | |
| `maxSessions` | number | `SERVER_ENCRYPTED` | K14 — varsayılan **1**, panelde uyarılı |

`databaseName` **credential değildir** → `AccountingCompany.companyNo`.
`officeCode` **credential değildir** → `AccountingCompany.branchCode`.

`derived` alan **yoktur** (Mikro'daki `MIKRO_DATE_MD5`'in Nebim'de karşılığı bilinmiyor).

### 7.4 Kayıt parametreleri şeması (D6)

```ts
export const NEBIM_POSTING_DEFAULTS: PostingFieldSpec[] = [
  { key: 'storeCode',        required: true,  appliesTo: ['INVOICE','ORDER','RECEIPT'] },
  { key: 'orderWarehouseCode', required: true, appliesTo: ['ORDER','INVOICE'] },
  { key: 'deliveryCode',     required: false, appliesTo: ['ORDER','INVOICE'] },
  { key: 'creditCardTypeCode', required: false, appliesTo: ['RECEIPT'] },
  { key: 'bankAccountCode',  required: false, appliesTo: ['RECEIPT'] },
];
```

`required` olanlar dolu değilse ilgili yazma işi **kuyruğa girmez** (K17).
`required: false` olanlar ilk fazda opsiyoneldir ama Faz D'de doğrulanıp
`required: true`'ya çekilebilir — tahsilat yazmanın onlarsız nereye düştüğü bilinmiyor.

### 7.5 Oturum sözleşmesi — connector tarafı

Connector oturum **yönetmez**, oturum **ister**. Havuz Agent'tadır (GÖREV N3).
Connector yalnızca şunu garanti eder:

- Her `TransportOperation` kendi `jobType`'ıyla gider; connector `SessionID` görmez
- `SESSION_RELEASE` işini connector **üretmez** — Agent'ın iç işidir; connector'ın
  ürettiği tek şey iş yükleridir

### 7.6 Mapper'ın ŞİMDİ yapacağı gerçek iş

Alan adları doğrulanmadı, ama mapper boş durmaz (doküman 11 §7.5 ile aynı disiplin):

- Kimlik anahtarı sızıntısı kontrolü — **iç içe nesnelerde de** (K1)
- `SessionID` benzeri bir alanın connector gövdesinde bulunmadığının kontrolü
- Zorunlu alanlar: en az bir satır, pozitif miktar, negatif olmayan fiyat, KDV 0–100
- Cari eşleştirme anahtarı: VKN/TCKN → ERP cari kodu; **isim asla anahtar değil**
- Telefon/e-posta normalizasyonu
- Kayıt parametrelerinin varlığı (K17)
- Response mapper: tanımadığı zarfta **hata fırlat**, boş dizi dönme

**Kabul kriterleri:**
- [ ] Üretilen hiçbir gövdede kimlik ya da `SessionID` alanı yok — çalışma zamanında denetleniyor
- [ ] `CompanyKey` eşlemesi §7.1'deki gibi; mağaza/depo kodu `CompanyKey`'de **değil**
- [ ] `postingDefaults` eksikken `pushInvoice` **ağa çıkmıyor**
- [ ] `descriptor.readiness === 'SCAFFOLDED'`, `lastVerifiedAt === null`
- [ ] Endpoint yolları ikincil kaynaktan geldiği için **`DOCUMENTATION_REQUIRED` yorumuyla** işaretli

---

## 8. GÖREV N3 — Agent: oturum ve lisans yöneticisi

**Klasör:** `agent/src/KroptOS.Agent.Host/Sessions/`

Doküman 11 §9'daki Agent (tünel, kayıt, iptal, yerel kasa, iş döngüsü) **önce kurulmuş
olmalı.** Bu görev onun üstüne bir bileşen ekler.

### 8.1 `SessionPool` sözleşmesi

```
Acquire(sessionKey, maxSessions) → SessionLease
  - Havuzda boşta oturum varsa onu döndür
  - Yoksa ve aktif sayı < maxSessions ise Connect çağır, SessionID'yi YEREL DEPOYA YAZ
  - Yoksa ve tavan dolu ise BEKLE (kuyruk), zaman aşımında SessionLimitReached
Release(lease)
  - İşi biten oturum havuza döner (boşta 10 dk)
Evict(sessionKey)
  - Boşta süresi dolan oturum için Disconnect çağır, YEREL KAYDI SİL
```

**Zorunlu davranışlar:**

| # | Davranış |
|---|---|
| S1 | `SessionID` **açılır açılmaz** yerel dayanıklı depoya yazılır — Connect döndükten sonra, iş başlamadan önce |
| S2 | Agent açılışında yetim kayıtlar için `Disconnect` denenir; başarısız olsa bile kayıt **silinmez**, `session_leaked` problem kaydı açılır |
| S3 | Aynı `SessionKey` için bırakılmamış bir oturum varken **yeni oturum açılmaz** (K15) |
| S4 | Oturum bırakma `finally` içindedir; hiçbir hata dalı bırakmayı atlayamaz |
| S5 | Tavan dolduğunda iş **kuyrukta bekler**, ikinci oturum açılmaz (K14) |
| S6 | Yoğun saat penceresinde tavan 0'a çekilebilir; senkron durur ve panelde **görünür** |
| S7 | `Disconnect` metodu doğrulanana kadar `SESSION_RELEASE` yeteneği `DOCUMENTATION_REQUIRED`; bu durumda oturum havuzu **tek oturumu canlı tutar ve hiç kapatmaz** — sızdırmaktansa tek lisansı sürekli tutmak daha az zararlıdır |

> S7 bilinçli bir tercihtir ve gerekçesi asimetridir: sürekli tutulan **bir** lisansın
> maliyeti öngörülebilir; her işte açılıp bırakılamayan oturumların maliyeti **birikir**
> ve mağazayı kilitler.

### 8.2 Agent testleri

- [ ] Tavan 1 iken iki eşzamanlı iş → **tek** `Connect`, ikinci iş bekliyor
- [ ] Oturum `finally` içinde bırakılıyor; iş hata fırlatsa bile
- [ ] Agent çökme simülasyonu → açılışta yetim oturum için `Disconnect` deneniyor
- [ ] `Disconnect` başarısız → kayıt silinmiyor, `session_leaked` problem kaydı açılıyor
- [ ] Bırakılmamış oturum varken ikinci `Connect` **çağrılmıyor**
- [ ] Tavan 0 iken hiçbir iş ağa çıkmıyor, kuyrukta bekliyor
- [ ] `SessionID` hiçbir log satırında, `IntegrationLog.payload`'da veya audit'te görünmüyor

---

## 9. GÖREV N4 — Uygunluk testleri

Doküman 11 §8'deki paketin tamamı `nebim-v3`'ü **otomatik kapsamalı** — `describe.each`
registry'yi geziyor. **Bu dosyaya sağlayıcıya özel satır eklenmez.**

Çekirdeğe eklenen yeni davranışlar için **sağlayıcıdan bağımsız** testler:

| # | Test |
|---|---|
| 46 | `periodPolicy` seçilmemiş descriptor registry'ye giremiyor (D5) |
| 47 | `periodPolicy: 'ERP_ENFORCED'` iken `assertPeriodMatches` **atlanıyor**, ama ERP dönem hatası `ClosedPeriodError`'a eşleniyor |
| 48 | `postingDefaultSpec`'te `required` olan bir alan boşken ilgili yazma işi **ağa çıkmıyor** (D6/K17) |
| 49 | `postingDefaults` şemada tanımsız anahtar içeriyorsa reddediliyor |
| 50 | `SESSION_RELEASE` kapalı kümede; hiçbir sağlayıcı kümeye ekleme yaptırmıyor (D7, test 21 korunur) |
| 51 | `maxSessions` varsayılanı **1**; 1'den büyük bir değer audit kaydı olmadan yazılamıyor (K14) |

**Mutasyon denemesi — zorunlu:**

| Mutasyon | Beklenen |
|---|---|
| `assertPostingDefaults` çağrısını kaldır | test 48 **KIRMIZI** |
| `periodPolicy` değişmezini kaldır | test 46 **KIRMIZI** |
| `SessionPool`'da `finally` yerine düz `Release` | oturum bırakma testi **KIRMIZI** |
| Tavan kontrolünü kaldır | eşzamanlılık testi **KIRMIZI** |

Bir mutasyon yeşil kalıyorsa o test zayıftır ve düzeltilir. Bulgu PR açıklamasına yazılır.

---

## 10. GÖREV N5 — API ve frontend farkları

Doküman 11 §10'daki akışlar (üç katmanlı fatura idempotency'si, asılı claim çözümü,
stok bayatlığı, sayfa listesi) **aynen geçerlidir.** Nebim'e özgü eklemeler:

| Yer | Ekleme |
|---|---|
| `/t/{tenant}/accounting/[id]` | **Lisans uyarısı**: "Bu bağlantı Nebim lisansınızdan en fazla N eşzamanlı kullanıcı tüketir." `maxSessions` değiştirilirken onay ister ve audit'lenir |
| `/t/{tenant}/accounting/[id]` | **Kayıt parametreleri sekmesi** — `postingDefaultSpec`'ten üretilir, eksik zorunlu alan kırmızı rozetle görünür |
| `/t/{tenant}/accounting/jobs` | Problem kuyruğunda `posting_defaults_missing`, `erp_session_limit`, `session_leaked` için **çözüm aksiyonu** |
| `/t/{tenant}/agents` | Agent kartında **aktif oturum sayısı** ve son bırakma zamanı |

RBAC: mevcut izinlere ek yok. `maxSessions` değişikliği `accounting.manage` gerektirir.

i18n: yeni anahtarlar **12 dilin hepsine** eklenir.

---

## 11. Yasaklar

Doküman 11 §11'deki yasakların tamamı geçerlidir. Nebim'e özgü ekler:

- **Nebim veritabanına YAZMAK** — her koşulda (K20)
- Integrator metot adı, endpoint yolu, alan adı, tablo adı, saklı yordam adı, hata kodu
  **uydurmak** — ikincil kaynaktan gelen `Connect` yolu dahil `DOCUMENTATION_REQUIRED` yorumuyla işaretlenir
- `maxSessions`'ı 1'den büyük bir değerle **varsayılan olarak** kurmak
- Oturumu `finally` dışında bırakmak; herhangi bir kod yolunda bırakmayı atlamak
- Mağaza ya da depo kodunu `CompanyKey`'e koymak (oturum havuzunu böler, lisans tüketir)
- Kayıt parametreleri eksikken yazma işini kuyruğa almak
- ERP'nin dönem/kapalı-hesap hatasını "bilinmeyen hata" olarak geçiştirmek
- `SessionID`'yi loglamak, audit'e yazmak, cevapta döndürmek
- `stockDelta`'yı doğrulanmadan `SUPPORTED` **ya da** `NOT_SUPPORTED` yapmak
  (ikisi de iddiadır; doğru cevap `DOCUMENTATION_REQUIRED`)
- Agent'ı Nebim sunucusundan farklı makineye, düz HTTP ile, **işaretlemeden** kurmak
- Doküman 08'in eskimiş Nebim satırını kaynak olarak kullanmak (§3.1)

---

## 12. Bilinmeyenler — UYDURMA, listeye ekle

Ajan bunlarla karşılaşırsa **durur ve soru olarak raporlar**:

1. Integrator metot listesi: `Connect` dışında hangi uçlar var, istek/cevap zarfı nasıl
2. `Disconnect` metodu var mı; yoksa oturum nasıl bırakılıyor, Nebim'in zaman aşımı ne
3. Oturum bırakılmadığında lisans ne kadar tutuluyor; tavan aşımında hangi hata dönüyor
4. **Faturaya/siparişe dış referans (`externalRef`) yazılabilecek bir alan var mı** —
   yoksa `invoiceFindByRef` katalog sorgusuna kalır; o da yoksa **onaylı mod** (K11)
5. Varsayılan port ve HTTPS desteği
6. Minimum Nebim V3 sürümü
7. `stockDelta`: değişim damgası ya da tarih filtresi var mı
8. Cari kart yazma Integrator üzerinden gerçekten destekleniyor mu
9. `invoiceCancel` iptal mi silme mi (Mikro dersi: ikisi aynı şey değil)
10. Kayıt parametrelerinden hangileri gerçekten zorunlu; eksikse kayıt nereye düşüyor
11. Entegrasyonun hangi kullanıcı tipiyle kodlanacağı (Ofis mi Mağaza mı) ve bunun
    lisans havuzuna etkisi — **ticari soru, gün 0**

**Faz D gün 1 kritik yolu:** madde 1 ve 2. Metot listesi ve oturum bırakma doğrulanmadan
hiçbir şey ilerlemez, çünkü ikincisi yanlış kurulursa **müşterinin mağazası kilitlenir.**
Kaynak: Nebim bayisi / Nebim teknik destek. Denemeyle bulunmaya çalışılmaz.

---

## 13. Onboarding runbook

| # | Adım | Sorumlu | Çıktı |
|---|---|---|---|
| 0 | Nebim V3 sürümü ve Integrator'ın kurulu olduğunun teyidi | Ops | Sürüm + servis ayakta |
| 1 | **Nebim bayisinden API bilgileri** + entegrasyonun hangi kullanıcı tipiyle kodlanacağı | Satış | Kimlik + **lisans maliyeti netleşir** — *gün 0, kodu beklemez* |
| 2 | Eşzamanlı kullanıcı bütçesi kararı (`maxSessions`) | Müşteri + satış | Yazılı mutabakat |
| 3 | KroptOS Agent kurulumu **Integrator ile aynı makineye** (K19) | Ops | Agent `ACTIVE` |
| 4 | Kimlik girişi (uçtan uca şifreli, doküman 11 §9.4) | Müşteri yetkilisi | `credentialSetAt` |
| 5 | `databaseName` + `officeCode` girişi | Müşteri | `AccountingCompany` satırları |
| 6 | **Kayıt parametreleri** (§3.4'teki altı kod) | Müşteri | `postingDefaults` dolu |
| 7 | Bağlantı testi | Otomatik | `connectionTest` → `SUPPORTED` |
| 8 | Ürün ve depo eşlemesi | Müşteri + destek | `mapping_missing` → 0'a yaklaşır |
| 9 | **Yalnızca okuma** ile 1 hafta — özellikle oturum sayacı izlenir | — | Lisans tüketimi ölçülür |
| 10 | **Onaylı yazma** ile 1 hafta | Operasyon | Fatura akışı doğrulanır |
| 11 | Otomatik yazma — **yalnızca `invoiceFindByRef` `SUPPORTED` ise** | — | `PRODUCTION_READY` |

**Adım 9 Nebim'de ekstra önemlidir:** okuma fazının asıl amacı veriyi doğrulamak değil,
**lisans tüketiminin gerçek profilini ölçmektir.** Yazma açılmadan önce müşteri "bu
entegrasyon bana kaç kullanıcıya mal oluyor" sorusunun cevabını görmüş olmalıdır.

---

## 14. Tanımlı Bitti (DoD)

- [ ] `pnpm lint && pnpm test && pnpm build` yeşil
- [ ] Uygunluk paketi `nebim-v3`'ü **sağlayıcıya özel satır eklenmeden** kapsıyor
- [ ] Mutasyon denemesi yapıldı; dördü de kırmızı verdi (§9)
- [ ] Şema diff'i `.sql` olarak üretildi ve commit'lendi; `db:push` uygulandı
- [ ] `mikro` sağlayıcısı `periodPolicy` geçişinden sonra **hâlâ yeşil**
- [ ] i18n anahtarları 12 dile eklendi
- [ ] Kod commit'lendi ve push'landı — `git ls-files` ile doğrulandı
- [ ] Hiçbir sağlayıcı `PRODUCTION_READY` işaretlenmedi
- [ ] §12'deki bilinmeyenlerden hiçbiri tahmin edilmedi
- [ ] `SessionID` hiçbir log/audit/cevap yolunda görünmüyor

### Çalışma sonu raporu

1. Okunan dosyalar ve devralınan kalıplar
2. Oluşturulan / değiştirilen dosyalar
3. Kurulan bileşenler
4. Test sonuçları ve **mutasyon denemesi bulguları**
5. **Çatının bu sağlayıcı sırasında aldığı düzeltmeler** — *boşsa çatı doğrulanmamıştır*
6. Şema durumu
7. Güvenlik: credential'ın sunucuya ulaşmadığının ve `SessionID`'nin sızmadığının kanıtı
8. **Lisans etkisi:** ölçülen eşzamanlı oturum profili
9. Açık TODO'lar ve §12'ye eklenen yeni bilinmeyenler

---

## 15. Kaynaklar

**Birincil (Nebim):**
- Harici sistemlerle entegrasyon (Integrator REST API) —
  https://www.nebim.com.tr/en/integration-with-external-systems
- Nebim V3 Lisans Kuralları (Integrator lisans tüketimi) —
  https://www.nebim.com.tr/i/assets/images/v3_brosur/Nebim-V3-Lisans-Kurallari-2020.pdf
- Nebim V3 Sürüm Karşılaştırması (Integrator tüm sürümlerde) —
  https://www.nebim.com.tr/i/assets/images/v3_brosur/Nebim-V3-Surum-Karsilastirmasi.pdf
- Nebim V3 broşürü — https://www.nebim.com.tr/i/assets/images/v3_brosur/Nebim_V3_BR20.pdf

**İkincil (doğrulanacak):**
- Integrator servis testi, `Connect` ucu ve `SessionID` — https://www.cozumpark.com/community/erp-mrp/494728/
- Kurulum rehberi, kayıt parametreleri — https://www.sopyo.com/destek-merkezi/nebim-entegrasyonu-kurulum-rehberi
- Çözüm ortağı sayfaları — https://www.hsnbilisim.com/nebim-v3-uygulamalari/harici-sistemlerle-entegrasyon ·
  https://asistyazilim.com.tr/nebim-v3-uygulamalari/harici-sistemlerle-entegrasyon/

**Proje içi:**
`claude/11_MIKRO_AGENT_UYGULAMA_BRIEFI.md` (çekirdek + Agent — ön koşul),
`claude/09_MUHASEBE_AGENT_CATISI.md` (çatı),
`claude/08_MUHASEBE_BAGLANTI_MATRISI.md` (**Nebim satırı eskimiştir — §3.1**),
`00_PROJECT_CONTEXT.md`, `02_BACKEND_MODULE_ANATOMY.md`, `claude/CONTRIBUTING.md`