# Sağlayıcı Paket Mimarisi — her entegrasyon kendi paketinde

**Tarih:** 2026-10-02
**Durum:** Karar verildi, **kod yazılmadı.** İlk adım §7 Faz 0.
**Dayanak:** `docs/plans/entegrasyon-izolasyonu.md` (bağlaşım envanteri K1–K12).
Bu doküman o analizin "ne yapılacak" kısmını hedef mimariye bağlar; envanteri tekrar etmez.

**Hedef:** Her sağlayıcı (pazaryeri, e-ticaret, kargo, muhasebe) ayrı ayrı uçtan uca
bağlanır, ayrı test edilir, ayrı doğrulanır, ayrı yayına alınır. Bir sağlayıcının
yarım işi, kırık testi veya çöken çağrısı diğerlerini etkilemez.
**Hedef değil:** Altyapının kopyalanması. Bkz. §2.

---

## 1. Neden

2026-10-02 taramasında 81 entegrasyonun hiçbiri uçtan uca hazır çıkmadı. Sebeplerin
ikisi yapısal:

1. **Bağlaşım.** eMAG'ın `base.settings.ts`'e eklediği 8 seçenek 14 sağlayıcıyı
   birden kırdı (210 test). Tek `integration-sync` kuyruğu, tek `tr.json`
   (4.871 satır), elle yazılmış katalog ve factory `switch`'leri her sağlayıcıyı
   diğerlerine bağlıyor.
2. **Kanıtsız durum etiketi.** Katalogdaki `status: 'active'` elle yazılıyor; arkasında
   doğrulama kaydı yok. Zucchetti, Comarch ve enova365'in backend'i hiç olmadığı
   halde "active" görünüyor.

Bu mimari ikisini birlikte çözer: sağlayıcı kendi paketinde yaşar, durumu da kendi
doğrulama kaydından türer.

---

## 2. İlke: mekanizma ortak, politika sağlayıcıya özel

| Ortak çekirdek (tek yerde) | Sağlayıcı paketi (her biri ayrı) |
|---|---|
| HTTP istemcisi, retry sınıflandırması, süre bütçesi | Base URL, endpoint yolları, auth akışı |
| Kimlik bilgisi şifreleme/maskeleme (`*CredentialService`) | Kimlik bilgisi şeması (hangi alanlar) |
| Tenant kapsaması, soft-delete filtreleri (CLAUDE.md kural 1) | Alan eşleme (mapper), statü sözlüğü |
| Simülasyon kapısı (worker'ın sahte veri yazmama kuralı) | Sağlayıcıya özel ayarlar ve seçenek listeleri |
| Kategori sözleşme tipleri (`MarketplaceTypes`, `CarrierTypes`…) | Katalog kartı verisi, yetenek listesi |
| Kuyruk/worker iskeleti, devre kesici mekanizması | Rate limit değerleri, kuyruk eşzamanlılığı |
| Doğrulama kademesi tanımları (§4) | Resmi doküman, fixture'lar, testler, doğrulama kaydı |

**Gerekçe.** Çekirdek kopyalanırsa bir güvenlik düzeltmesi 20 yerde yapılır ve biri
unutulur; en kolay kırılacak kural tenant izolasyonu olur. Politika paylaşılırsa
eMAG olayı tekrarlanır.

**Çekirdek değişikliği kuralı.** Ortak çekirdeğe dokunan PR, o kategorideki **tüm**
sağlayıcıların testini koşturur. Sağlayıcı paketine dokunan PR yalnız kendi testini
koşturur.

`entegrasyon-izolasyonu.md` §2'deki "yapma" kararları geçerli kalır: ortak connector
taban sınıfı (K4) ve ortak Prisma şeması (K12) bölünmez.

---

## 3. Paket sözleşmesi

Bir sağlayıcıya ait her şey tek klasördedir. Klasör silindiğinde geride referans
kalmamalı; bozulduğunda yalnız o sağlayıcı devre dışı kalmalı.

```
packages/backend/src/integrations/<kategori>/<saglayici>/
├── provider.manifest.ts     # kimlik, kategori, yetenekler, katalog kartı verisi
├── <Saglayici>Connector.ts  # yalnız bu sağlayıcının çağrıları
├── <Saglayici>Mapper.ts     # alan eşleme
├── <Saglayici>Types.ts      # sağlayıcının kendi istek/yanıt tipleri
├── <saglayici>.settings.ts  # sağlayıcıya özel ayarlar (base'e EKLENMEZ)
├── i18n/
│   ├── tr.json
│   └── en.json
├── docs/                    # resmi API dokümanı kopyası (bkz. §5.1)
│   └── SOURCE.md            # URL, sürüm, indirme tarihi
├── fixtures/                # dokümandan BİREBİR alınmış örnek gövdeler
├── __tests__/
│   ├── contract.spec.ts     # Kademe 1 — dokümana karşı, her CI'da koşar
│   └── sandbox.spec.ts      # Kademe 2 — gerçek sandbox'a karşı, elle tetiklenir
└── VERIFICATION.md          # doğrulama kaydı; kademenin TEK kaynağı (bkz. §4)
```

Kurallar:

- **Kayıt kendiliğinden.** Paket `provider.manifest.ts` üzerinden kendini kategori
  registry'sine kaydeder. `MarketplaceConnectorFactory`, `CarrierConnectorFactory`,
  `AccountingConnectorFactory`, `EcommerceConnectorFactory` içindeki elle yazılmış
  `switch`/import listeleri kalkar (K5).
- **Yükleme hatası izole.** Bir paket yüklenirken hata verirse registry onu
  `disabled` işaretler, nedenini loglar, uygulama açılmaya devam eder (K3).
- **Katalog türetilir.** Frontend kartları manifest + `VERIFICATION.md` kademesinden
  gelir. `AddIntegrationModal.tsx` içindeki elle yazılmış `CATALOG_PROVIDERS`
  listesi kalkar (K11).
- **i18n paket içinde.** Sağlayıcı metinleri ortak `messages/tr.json`'a yazılmaz;
  build adımında birleştirilir (K10). Eksik çeviri yalnız o sağlayıcının testini
  kırar (K1).
- **Kod yolu tahmin içermez.** Dokümanda olmayan alan adı, endpoint veya durum kodu
  yazılmaz. Bilinmeyen işlem reddeder (`AliExpressConnector.getOrders` kalıbı),
  sessizce varsayım yapmaz.

---

## 4. Doğrulama kademeleri

Dört kategori bugün dört ayrı ölçek kullanıyor (`readiness`,
`CarrierIntegrationStatus`, `defaultMode`, katalog `status`). Hepsinin yerine tek
merdiven:

| Kademe | Kod | Kanıtlanan | Gerekli kanıt | Katalog rozeti |
|---|---|---|---|---|
| 0 | `SCAFFOLDED` | Kod var | — | gizli |
| 1 | `DOC_CONFORMANT` | Eşleme resmi dokümanla birebir | `contract.spec.ts` yeşil, fixture'lar kaynaklı | **Önizleme** (bağlanamaz) |
| 2 | `SANDBOX_VERIFIED` | Gerçek sunucu, auth, hata gövdeleri | Sandbox koşusu, `VERIFICATION.md` kaydı | **Beta** |
| 3 | `PILOT_VERIFIED` | Gerçek müşteri verisi | Pilot kaydı (§6) | **Aktif** |
| 4 | `PRODUCTION_READY` | Süre içinde hatasız | 30 gün, kritik hata 0 | **Aktif** |

- Kademe **yalnız `VERIFICATION.md`'den okunur.** Kodda veya katalogda elle kademe
  yazılmaz.
- Kademe atlanmaz. Sandbox'ı olmayan sağlayıcı 1'den doğrudan 3'e geçebilir; bu
  `VERIFICATION.md`'de "Kademe 2: sandbox yok" diye kayıtlı olmalı.
- Kademe 1 altındaki sağlayıcı müşteriye bağlanabilir **gösterilmez.**
- Simülasyon modu (`defaultMode = 'simulation'`) Kademe 1 ve 2'de varsayılandır;
  Kademe 3'e geçişte kapanır.

### `VERIFICATION.md` şablonu

```markdown
# <Sağlayıcı> — doğrulama kaydı

**Güncel kademe:** DOC_CONFORMANT
**Doküman:** docs/SOURCE.md (sürüm, tarih)

## Kademe 1 — doküman uyumu
| İşlem | Fixture | Kaynak (doküman §/sayfa) | Test |
|---|---|---|---|
| createShipment | fixtures/create-shipment.request.xml | §4.2, s. 12 | contract.spec.ts:30 |

## Kademe 2 — sandbox
**Tarih / commit:** —
**Ortam:** —
| İşlem | Sonuç | Not |
|---|---|---|

## DOĞRULANAMADI
| Konu | Neden | Hangi kademede ölçülecek |
|---|---|---|
| Rate limit değeri | Dokümanda yok | 2 |
```

---

## 5. Kademe yöntemleri

### 5.1 Kademe 1 — dokümana karşı

1. Resmi doküman paketin `docs/` klasörüne konur. PDF ise PDF, HTML ise tek dosya.
   Üçüncü taraf blog kopyası veya Postman ekran görüntüsü **kaynak sayılmaz**
   (`docs/carriers/README.md` §0 ile aynı kural).
2. Dokümandaki örnek istek/yanıt gövdeleri `fixtures/`'a **birebir** kopyalanır.
   Her fixture'ın kaynağı `VERIFICATION.md` tablosunda yazılıdır.
3. `contract.spec.ts`:
   - Mapper'ın ürettiği istek, doküman örneğiyle alan alan eşleşir.
   - Doküman yanıt örneği hatasız parse edilir, sözleşme tipine doğru düşer.
   - Doküman hata örnekleri doğru hata sınıfına çevrilir.
4. Makine okunur şema varsa ona karşı doğrulanır: OpenAPI → istek gövdesi şemaya
   karşı; WSDL/XSD → SOAP zarfı XSD'ye karşı. OpenAPI'den mock sunucu (ör. Prism)
   açılarak HTTP katmanı (header, auth, serileştirme) da sınanabilir.
5. Dokümanın cevaplamadığı her şey "DOĞRULANAMADI" tablosuna yazılır.

**Sınır:** Mock'u biz yazmıyoruz, beklenen değer dokümandan geliyor. Bu yüzden bugünkü
mock testlerinden güçlüdür. Ama dokümanın yanlış veya eski olduğu yeri yakalamaz
(n11'de beş uçtan beşi yanlış çıkmıştı). Kademe 1 canlı kanıt **değildir**
(CLAUDE.md kural 7).

### 5.2 Kademe 2 — sandbox

- Ayrı veritabanında koşar (§6). Üretim DB'sine sandbox kimlik bilgisi girmez.
- CLAUDE.md kural 7 protokolü: önce satır sayısı → fixture → gerçek HTTP → `finally`
  içinde silme → satır sayısının başa döndüğünü gösterme. Sonuç commit gövdesine ve
  `VERIFICATION.md`'ye yazılır.
- Hangi sağlayıcıda sandbox olduğu **bu dokümanda kesinleştirilmedi**. Her
  sağlayıcı için ayrı ayrı teyit edilip `VERIFICATION.md`'ye yazılacak.

### 5.3 Kademe 3 — pilot

İlk müşterinin hesabıyla, şu sırayla:

1. **Yalnız okuma.** Sipariş/ürün çekilir, hiçbir şey yazılmaz.
2. **Gölge mod.** Yazma işlemleri (stok, fiyat, fatura, gönderi) hesaplanır ve
   loglanır, gönderilmez. Müşteri "gönderilecek olan" listesini kendi verisiyle onaylar.
3. **Kademeli yazma.** Önce tek SKU / tek sipariş, sonra genişletme.

Her adımın sonucu `VERIFICATION.md`'ye ve `docs/DOGRULAMA_KAYITLARI.md` formatında
kaydedilir.

---

## 6. Çalışma zamanı ve ortamlar

### 6.1 Çalışma zamanı izolasyonu

| Bugün | Hedef |
|---|---|
| Tüm pazaryerleri tek `integration-sync` kuyruğu | Sağlayıcı başına kuyruk: `sync-<saglayici>` |
| Tüm muhasebe tek `accounting-sync` kuyruğu | Sağlayıcı başına kuyruk |
| `MarketplaceRateLimiter` anahtarı tenant içermiyor (K8) | Anahtar `tenantId + sağlayıcı` |
| Sağlayıcıyı durdurma yolu yok | Sağlayıcı başına devre kesici + yönetici kapatma anahtarı |
| Loglarda sağlayıcı ayrımı tutarsız | Her log/metrik sağlayıcı ve tenant etiketli |

BullMQ jobId'de `:` kullanılamaz (bildirim modülünde sessizce inline'a düşmüştü);
kuyruk ve job adlarında ayraç `-`.

### 6.2 Ortamlar

| Ortam | Veritabanı | Kimlik bilgileri | Kademe |
|---|---|---|---|
| local | yerel DB | yok — fixture | 1 |
| sandbox | ayrı `kroptos_sandbox` | sağlayıcı test hesapları | 2 |
| pilot | üretim DB | ilk müşteri, okuma + gölge | 3 |
| production | üretim DB | müşteri hesapları | 4 |

Her ortamın `.env`'i ve `ENCRYPTION_KEY`'i ayrıdır ve repo dışında, bir parola
yöneticisinde yedeklidir. 2026-08-08'de `packages/backend/.env` kalıcı olarak
kaybolmuştu; içindeki anahtar olmadan DB'deki şifreli kimlik bilgileri okunamıyor.

---

## 7. Faz planı

Her faz tek başına değerli ve tek başına geri alınabilir.

| Faz | İş | İzolasyon planındaki karşılığı | Ön koşul |
|---|---|---|---|
| **0** | Test kapısını sağlayıcı bazlı yap; i18n testini ayır | Faz 0–1 (K6, K1) | — |
| **1** | Ortak kademe tipi (§4) + `VERIFICATION.md` okuyucu | — | 0 |
| **2** | Katalog kartını manifest + kademeden türet; elle `status` kalkar | Faz 3 (K11) | 1 |
| **3** | **Şablon sağlayıcı:** bir sağlayıcıyı §3 sözleşmesine uçtan uca taşı, Kademe 1'e çıkar | — | 1 |
| **4** | Registry kendiliğinden kayıt + hataya dayanıklı yükleme | Faz 4 (K3, K5) | 3 |
| **5** | Sağlayıcı başına kuyruk, tenant'lı rate limiter, devre kesici | Faz 5–6 (K8, K9) | 4 |
| **6** | Kalan sağlayıcıların taşınması — her biri kendi dalı ve PR'ı | Faz 2, 7 (K2, K10) | 3 |

Faz 2 tek başına müşteriye karşı en acil düzeltmedir: kanıtsız "active" rozetlerini
kaldırır.

### Şablon sağlayıcı seçimi (Faz 3)

Kriterler: Türkiye pazarı için kritik olması, resmi dokümanın elde olması, mümkünse
sandbox'ı olması. Adaylar: Yurtiçi (kargo, SOAP/WSDL), Paraşüt (muhasebe, REST).
Seçim Faz 3 başında yapılacak.

---

## 8. Kabul kriterleri

- [ ] Bir sağlayıcının `contract.spec.ts`'i bilerek kırıldığında diğer sağlayıcıların
      testleri yeşil kalıyor (`entegrasyon-izolasyonu.md` §5 `provider-isolation.spec.ts`).
- [ ] Bir sağlayıcı paketinin yüklenmesi bilerek hata verdirildiğinde uygulama açılıyor,
      o sağlayıcı `disabled` görünüyor.
- [ ] Katalogdaki hiçbir rozet elle yazılmıyor; `VERIFICATION.md` kademesinden geliyor.
- [ ] Backend'i olmayan sağlayıcı katalogda bağlanabilir görünmüyor.
- [ ] Bir sağlayıcının kuyruğu tıkandığında diğer sağlayıcıların job'ları işlenmeye
      devam ediyor (canlı ölçüm, CLAUDE.md kural 7).
- [ ] Ortak çekirdekte tenant kapsaması, kimlik maskeleme ve simülasyon kapısı tek
      yerde; sağlayıcı paketlerinde kopyası yok.

---

## 9. Açık sorular

- Sağlayıcı başına kuyruk sayısı (~80) Redis bağlantı ve worker sayısını nasıl
  etkiler? Faz 5 öncesi ölçülecek. Alternatif: kategori kuyruğu + sağlayıcı bazlı
  eşzamanlılık sınırı.
- Frontend i18n'in build adımında birleştirilmesi `next-intl` yapılandırmasıyla nasıl
  kurulur? Faz 6'da K10 işiyle birlikte karar verilecek.
- `integrations/erp/logo/LogoConnector.ts` (eski) ile `integrations/accounting/logo-*`
  çakışıyor; eski yolun kaldırılması ayrı iş.
