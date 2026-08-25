# Yeni taşıyıcı ekleme runbook'u

Bu dosya adım listesidir, kod örneği değil. Şablon için `MockCarrierConnector`
ve `src/integrations/carriers/core/CarrierConnector.ts` başlıklarına bak.

Bir taşıyıcı ekleme işi üç şeyden oluşur: dokümanı yerine koymak, iki dosya
yazmak, uygunluk paketini yeşile çevirmek. Sıra bu.

---

## 0. Ön koşul: doküman ve kimlik bilgisi

- Taşıyıcının **resmi** API dokümanını `docs/carriers/<PROVIDER>/` altına koy.
  PDF ise PDF, HTML ise tek dosya olarak kaydedilmiş hali.
- Üçüncü taraf blog kopyası, Postman koleksiyonu ekran görüntüsü, "şuradaki
  örnekten çıkardım" **kaynak sayılmaz**. Doküman yoksa taşıyıcıyı yazmaya
  başlama; sağlayıcıdan iste.
- Test ortamı kimlik bilgisi olmadan connector yazılabilir, ama
  **"çalışıyor" denemez**. Canlı doğrulama olmadan bağlantı kartı beta kalır.

## 1. Sağlayıcıyı tanımla

`core/CarrierTypes.ts` → `CARRIER_PROVIDERS` listesine ekle. Zaten listede
olabilir; listede olması connector'ın var olduğu anlamına gelmez.

## 2. Connector'ı yaz

Tek dosya: `src/integrations/carriers/<provider>/<Provider>Connector.ts`

- `CarrierConnector`'ı extend et. `super('<PROVIDER>', ...)`.
- Zorunlu: `testConnection`, `createShipment`, `getLabel`, `track`,
  `cancelShipment`.
- İsteğe bağlı, taşıyıcı destekliyorsa: `getRates`, `createReturn`,
  `findByReference`. Desteklemiyorsa **yazma** — boş stub, uygunluk paketinin
  yetenek bildirimiyle çelişir.
- Kimlik bilgisi okumak için `this.requireCredentials(...)` — kendi kontrolünü
  yazma, o `BadRequestException` fırlatıyor ve sözleşme bunu bekliyor.
- Her dış çağrıdan önce `await this.throttle()`. `rateLimitPerMinute`'i
  taşıyıcının yayınladığı kotadan doldur, tahmin etme.
- Hata çevirisi `this.describeError(error)` ile. Kendi mesajını yazma.
- HTTP: `this.httpClient.json(...)` (REST) veya `this.httpClient.soap(...)`
  (SOAP konuşan taşıyıcılar — Yurtiçi, Aras, PTT). Yeni bir fetch açma.

**Desi'yi yeniden hesaplama.** `Parcel.desi` ve `chargeableWeightKg` dolu
gelir; kiracının böleni `DesiCalculator`'da uygulanmıştır. Connector içinde
`/3000` gördüğün an bug'dır.

## 3. Durum eşlemesini yaz

Aynı dosyada ya da yanında bir `normalizeStatus(rawCode): ShipmentStatus`.

- Bilinen kodları tabloya yaz.
- **Bilinmeyen kod → `in_transit`.** Asla `delivered`/`returned` değil:
  terminal durum takibi durdurur ve siparişi kapatır, yanlışsa geri dönüşü yok.
- Ham kodu `carrierStatusCode`'da sakla, `status`'a koyma.
- Olay geçmişindeki **her olayın kendi** `carrierStatusCode`'u olsun; gönderi
  seviyesindeki kodu her olaya kopyalarsan olaylar tek kayda çöker.

## 4. Factory'ye kaydet

`core/CarrierConnectorFactory.ts` → `create()` içindeki `switch`'e **ve**
`supportedProviders()` listesine. **İkisine birden.** Sadece birine eklemek
pazaryeri tarafında zaten bir kez yaşandı (factory ↔ registry ayrışması).

## 5. Uygunluk paketini koştur

Spec dosyası: `src/integrations/carriers/<provider>/<Provider>Connector.spec.ts`

İçinde sözleşme testi **yazma**, çağır:

```
describeCarrierConformance({ provider, create, credentials,
  requiredCredentials, normalizeStatus, respond, capabilities })
```

Alanlar:

| Alan | Ne verilir |
|---|---|
| `create(ctx)` | Her test için taze connector. `ctx`'teki http/limiter/isTestMode'u aynen geçir. |
| `credentials` | Mutlu yolun koştuğu, gerçekçi görünen sahte kimlik bilgileri. |
| `requiredCredentials` | Boş bırakılamayan anahtarlar. `[]` yazmak maddeyi atlar — sadece hiçbir yere bağlanmayan connector için dürüst. |
| `normalizeStatus` | 3. adımdaki fonksiyon. Pakete çöp kod verilir. |
| `respond(req)` | Taşıyıcının kanned cevabı. Connector HTTP atmıyorsa atlanabilir. |
| `capabilities` | `getRates` / `createReturn` / `findByReference` gerçekten yazıldıysa `true`. `batchTracking: false` sadece dokümanda toplu uç YOKSA — hangi sayfa olduğunu yorumda belirt. `simulationOnly: true` yalnız mock/simülasyon için. |

Koşturma:

```
cd packages/backend
npx jest src/integrations/carriers/<provider>
```

Kırmızıları düzelt. Paketi gevşetme — bir madde geçmiyorsa connector yanlıştır,
madde değil. Tek istisna `batchTracking`, ve onun da gerekçesi dokümanda olur.

## 6. Canlı doğrulama

Test ortamı kimlik bilgisi geldiğinde, gerçek bir çağrıyla:

1. `testConnection` yeşil.
2. Bir gönderi oluştur, barkodu al, etiketi indir.
3. Aynı takip numarasını `track` ile sorgula, dönen durumu gör.
4. Aynı gönderiyi `cancelShipment` ile iptal et.

Ölçüm çıktısını commit mesajının gövdesine yaz. Ölçülemeyen madde
`DOĞRULANAMADI` diye işaretlenir; sessizce "çalışıyor" denmez.

---

## DoD

- [ ] Resmi doküman `docs/carriers/<PROVIDER>/` altında.
- [ ] `CARRIER_PROVIDERS` içinde.
- [ ] Connector yazıldı; desi yeniden hesaplanmıyor, `/3000` yok.
- [ ] `normalizeStatus` yazıldı; bilinmeyen kod `in_transit`.
- [ ] Factory'nin **hem** `switch`'ine **hem** `supportedProviders()`'ına eklendi.
- [ ] Spec dosyası `describeCarrierConformance` çağırıyor, testleri kopyalamıyor.
- [ ] `npx jest src/integrations/carriers/<provider>` tamamen yeşil.
- [ ] Atlanan uygunluk maddesi varsa (`batchTracking`) gerekçesi doküman sayfası
      referansıyla yorumda.
- [ ] Alıcı telefon/e-posta/adres loglara ve `raw`'a maskesiz gitmiyor.
- [ ] Canlı doğrulama yapıldıysa çıktısı commit gövdesinde; yapılmadıysa
      bağlantı kartı beta ve "çalışıyor" denmedi.
