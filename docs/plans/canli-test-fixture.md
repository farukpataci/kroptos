# Canlı Test Fixture'ları — kalıcı, yeniden kullanılır

**Oluşturulma:** 2026-08-19
**Amaç:** Pazaryeri entegrasyonlarını gerçek gateway'e karşı, gerçek müşteri
verisine dokunmadan doğrulamak. **Silmeyin** — her doğrulamada yeniden kurmak
hem zaman kaybı hem de yanlışlıkla ikinci bir kopya yaratma riski.

Yeni bir canlı doğrulamaya başlamadan **önce bu dosyaya bakın.**

---

## 1. Trendyol Stage Test

| | Değer |
|---|---|
| Store | `cmt03gg010001nixf79zpv5eo` — *Trendyol Stage Test* |
| Integration | `cmt03gg230003nixf6vxxtugb` — publicId `int_stage_trendyol` |
| IntegrationSetting | `cmt03gg2b0005nixf1ilnjx7c` |
| Agency | `cmqs8k85b000213co7nxm3na8` |
| Client | `cmrdc12na000euhh8a0izytr2` (*x*, tek aktif client) |
| Ayarlar | `{"general.environment": "sandbox"}`, `isConfigured: true` |
| Store ayarları | `orderProcessingMode: LOGO_SYNC`, TRY / tr-TR / Europe/Istanbul |
| Gateway | `https://stageapigw.trendyol.com`, seller **2738** |
| Kimlikler | `packages/backend/.env` → `TY_SELLER` / `TY_KEY` / `TY_SECRET` (gitignore'lu) |

Kimlikler projenin kendi `encrypt()` util'iyle şifrelenip `credentialsEncrypted`
alanına yazıldı; elle kripto yazılmadı.

### Dokunulmayacak mağazalar

| Mağaza | Neden |
|---|---|
| `Sudocrem` (`cms5ychjp000g13rwemi4depi`) | Mevcut Trendyol entegrasyonu buraya bağlı, `status: error` / `isConfigured: false`. **Ayrı bir sorun, bu turun kapsamı dışında** — dokunulmadı, sadece not düşüldü. |
| `deneme` (`cmrkjmnr9001lewsx3q6upv47`) | 14 sipariş var; e-postalar gerçek görünümlü (`@gmail.com`), sipariş numaraları stage biçiminde değil, `marketplaceOrderNumber` hepsinde null. Muhtemelen gerçek ya da yabancı veri. Mağaza soft-delete edilmiş. **Test için kullanılmaz.** |

---

## 2. Sipariş statü senkronu — canlı doğrulama (2026-08-19)

CLAUDE.md kural 7 protokolü, izole fixture üzerinde.

### 2.1 İlk koşu — ilk import

| | ÖNCE | SONRA |
|---|---|---|
| Sipariş | 0 | **144** |
| Ürün (placeholder) | 0 | 41 |
| OrderTimeline | 0 | 0 |
| Kuyruk kaydı | `pending` | `processed` |

**Status dağılımı: `processing` 93, `shipped` 51.**

Bu, worker'ın statü yazma düzeltmesinin dolaylı kanıtı: sabit `'pending'` yazan
eski kodda 144'ünün **hepsi** `pending` olurdu. İki farklı statü gelmesi,
mapper'ın ürettiği değerin gerçekten yazıldığını gösteriyor.

144 sayısı 208 değil çünkü manifest varsayılanı `orders.importStatuses`'ı
`created/picking/shipped` ile sınırlıyor. (Ham sondada filtre kapatılınca 208
sipariş görülmüştü.)

### 2.2 İkinci koşu — statü değişimi ve OrderTimeline

Pazaryerine **dokunmadan** güncelleme dalını tetiklemek için *bizim* kopyamızın
statüsü bilerek farklılaştırıldı; stage tarafında hiçbir şey değiştirilmedi.

Hedef sipariş: `TY-181620786-92144326`

| Alan | ÖNCE | SONRA | Beklenen |
|---|---|---|---|
| `status` | `pending` (elle bozuldu) | **`shipped`** | stage'deki gerçek değere döner ✅ |
| `logoSyncStatus` | `PENDING` | `PENDING` | **değişmemeli** ✅ |
| `isPoolOrder` | `false` | `false` | **değişmemeli** ✅ |
| OrderTimeline (mağaza geneli) | 0 | **1** | yalnız bir satır ✅ |
| Sipariş sayısı | 144 | 145 | +1 (aşağıya bak) |

Eklenen tek satır:

```json
{"eventType":"status_changed","oldValue":"pending","newValue":"shipped",
 "orderNumber":"TY-181620786-92144326"}
```

**Değişmeyen 143 siparişin hiçbirine timeline satırı eklenmedi** — worker'daki
`existing.status !== o.status` kontrolü gereksiz yazmayı gerçekten engelliyor.
Koşu süresi 4.279 ms.

### 2.3 Açıklanamayan tek nokta

İkinci koşuda sipariş sayısı 144 → **145** oldu. Beklenen +0 idi. İki olasılık,
hangisi olduğu **ölçülmedi**: (a) iki koşu arasında stage hesabına yeni bir
sipariş düştü, (b) bir siparişin statüsü içe aktarma penceresine (`created/
picking/shipped`) yeni girdi. Canlı bir hesapta ikisi de normal, ama **doğrulanmadı**.
Sonraki koşuda sipariş sayısı sabitse (b) elenir.

---

## 3. Hâlâ DOĞRULANAMADI olanlar

| Konu | Durum |
|---|---|
| `updateStock` zaman aşımı (`pending`) yolu | Canlıda tetiklenmedi; batch her seferinde bütçe içinde doldu. Yalnız mock testi var. |
| `stockConfirmTimeoutMs` 15 sn'nin toplu senkronda yeterliliği | Tek kalemlik batch ölçümünden geliyor; 1000 SKU'luk batch ölçülmedi. |
| `getAddresses` alan adları | Satıcı hesabı Draft, gateway `supplier.api.draft.address` (404) dönüyor. Gerçek payload görülmedi. |
| TrendyolMapper `STATUS_MAP` tam listesi | Başka bir ajanın commit edilmemiş işi; bu fixture ile doğrulanabilir ama kapsam dışı bırakıldı. |

---

## 4. Bu fixture ile nasıl koşulur

Nest uygulama bağlamını jest içinde ayağa kaldırıp worker'ı doğrudan çağırmak en
kısa yol; `ts-node` tek başına `@common/*` path alias'larını çözemiyor.

```ts
const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const prisma = app.get(PrismaService);
const worker = app.get(IntegrationSyncWorker);

const q = await prisma.integrationQueue.create({
  data: { agencyId: AGENCY, configId: INTEG, eventType: 'sync_orders',
          payload: '{}', status: 'pending' },
});
await (worker as any).processJob({
  queueRecordId: q.id, integrationId: INTEG, eventType: 'sync_orders', payload: {},
});
```

`IntegrationQueue` alan adlarına dikkat: `configId` (integrationId değil),
`payload` **string**, hata alanı `error` (`errorMessage` değil).

Redis kapalıysa koşu sonunda `ECONNREFUSED ::1:6379` gürültüsü çıkar; BullMQ
worker'ının bağlantı denemesidir, testin sonucunu etkilemez.

Sonda dosyaları `src/` altına geçici olarak konup **koşu sonrası silinmelidir**;
depoya girmemeleri gerekir.
