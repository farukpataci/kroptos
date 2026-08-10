# Trendyol Global — gereken şema değişiklikleri

**Durum:** planlandı, UYGULANMADI. Onay bekliyor.
**Tarih:** 2026-08-10

Ülke başına ayrı `Integration` kaydı kararı şema değişikliği gerektirmedi —
`Integration`'da `@@unique` yok, aynı sağlayıcıdan birden çok kayıt zaten
serbest. Aşağıdaki iki eksik ise ayrı ve gerçek.

---

## 1. `Order` hangi ülkeden geldiğini tutamıyor

### Bugünkü durum

```prisma
model Order {
  source   String @default("manual") // manual, shopify, trendyol, etc.
  currency String @default("USD")
  // integrationId YOK
}
```

`source` serbest metin. Connector artık `trendyol` ile `trendyol_global`'i
ayırıyor (`TrendyolBaseConnector.orderSource`), ama **hangi ülke** olduğu
kayboluyor: Romanya ve Yunanistan siparişlerinin ikisi de `trendyol_global`
yazıyor.

`IntegrationSyncWorker` sipariş oluştururken elinde `integration` nesnesi var
ama `Order`'a yazacak alan yok.

### Önerilen

```prisma
model Order {
  // ...
  integrationId String?
  integration   Integration? @relation(fields: [integrationId], references: [id], onDelete: SetNull)

  @@index([integrationId])
}
```

`Integration` tarafına `orders Order[]` ters ilişkisi eklenir.

**Neden `integrationId`, `country` değil:** ülke zaten entegrasyonun kimlik
bilgisinde duruyor. Ayrı bir `country` kolonu ikinci bir gerçek kaynak yaratır
ve senkron tutulması gerekir — bu depoda tam olarak bu sınıf hatanın (sağlayıcı
listelerinin dört yere dağılması) bedeli ödendi. FK ile ülke tek yerden okunur.

**Neden nullable:** mevcut siparişlerin hiçbirinde bu bilgi yok ve manuel
siparişlerin entegrasyonu da yok. `SetNull`, entegrasyon silinince siparişin
kalmasını sağlar.

**Geriye dönük veri:** mevcut satırlar `null` kalır. `source='trendyol'` olan
eski siparişleri tek bir TR entegrasyonuna bağlamak teorik olarak mümkün ama
birden çok TR entegrasyonu varsa hangisi olduğu bilinemez — **geri doldurma
önerilmiyor**, `null` dürüst cevaptır.

**Kırıcı mı:** hayır. Yeni ve nullable bir kolon; mevcut API sözleşmesi
değişmez.

---

## 2. `MarketplaceStockRule` ülke bazlı kural tutamıyor

### Bugünkü durum

```prisma
model MarketplaceStockRule {
  provider String  // trendyol, amazon, hepsiburada, etc.
  @@unique([agencyId, provider])
}
```

Ajans + sağlayıcı başına **tek** kural. `trendyol_global` için Romanya'ya %10
tampon, Yunanistan'a %0 tampon yazılamaz — ikisi de `provider='trendyol_global'`
satırını paylaşır.

### Önerilen

```prisma
model MarketplaceStockRule {
  // ...
  integrationId String?
  integration   Integration? @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  @@unique([agencyId, provider, integrationId])
}
```

`integrationId = null` satırı sağlayıcı geneli varsayılan olarak kalır; dolu
olan satır o entegrasyonu (dolayısıyla o ülkeyi) ezer. Okuma tarafı önce
entegrasyona özel satıra, yoksa geneline bakar.

> ⚠️ PostgreSQL'de `NULL` değerler unique kısıtında eşit sayılmaz: iki farklı
> `(agencyId, provider, NULL)` satırı **çakışmaz**. Sağlayıcı geneli satırın
> tekilliği isteniyorsa ayrıca kısmi indeks gerekir:
> `CREATE UNIQUE INDEX ... ON "MarketplaceStockRule" ("agencyId","provider") WHERE "integrationId" IS NULL;`
> Bu ayrıntı atlanırsa "genel kural" sessizce çoğalır.

**Kırıcı mı:** `@@unique` daralmıyor, genişliyor — mevcut satırlar
`integrationId=null` ile geçerli kalır. Mevcut okuma kodu güncellenmezse eski
davranışı sürdürür.

**Bu değişiklik ZORUNLU DEĞİL.** Ülke bazlı stok kuralı bugün istenmiyorsa
`trendyol_global` tek kural altında çalışır. Sadece istenirse gerekir.

---

## Uygulama notu

Bu depo deploy'da `prisma db push` kullanıyor, migration geçmişi tutmuyor
(bkz. `db-schema-deploy-strategy`). Her iki değişiklik de yalnızca **ekleme**
olduğu için `db push` veri kaybı uyarısı üretmemeli — ama çalıştırmadan önce
`prisma db push --preview-feature` yerine önce `prisma migrate diff` ile üretilen
SQL gözden geçirilmeli.

Onay gelirse sıra: (1) şema düzenlemesi, (2) üretilen SQL'in gözden geçirilmesi,
(3) `db push`, (4) worker'da `Order.integrationId` doldurulması, (5) test.
