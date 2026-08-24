# Gerçek kargo connector'ı — başlamadan önce elde olması gerekenler

Adım 7d bu liste dolmadan başlamıyor. Buradaki her satır, `CarrierConnector`
arayüzünün somut bir gereksinimi: karşılığı bilinmeden yazılan kod, tahmin
edilmiş alan adı demektir ve tahmin edilmiş alan adı canlıda 400 döner.

Kapsam: Yurtiçi veya MNG (hangisi önce gelirse). Liste sağlayıcıdan bağımsız,
her taşıyıcı için aynı.

---

## 1. Hesap ve ortam

- [ ] **Test ortamı var mı?** Ayrı base URL mi, aynı URL + test bayrağı mı?
      `CarrierIntegration.isTestMode` bu ayrımı taşıyor; hangi anlama geldiğini
      bilmeden bayrak boşa yazılır.
- [ ] Test hesabı kimlik bilgileri (canlıdan ayrı).
- [ ] Canlı hesap kimlik bilgileri — **yalnız kullanıcıdan**, üçüncü taraf
      kopyalardan değil.
- [ ] Sözleşmede tanımlı müşteri/gönderici kodu (çoğu taşıyıcıda kullanıcı
      adından ayrı bir alan).
- [ ] Test ortamında oluşturulan gönderi gerçekten fatura üretiyor mu?

## 2. Kimlik doğrulama

- [ ] Yöntem: Basic auth / API key / OAuth2 / SOAP + oturum bileti.
- [ ] **Alan alan kimlik bilgisi listesi** ve her birinin resmî adı. Bunlar
      `CarrierIntegration.credentials` içine şifreli JSON olarak yazılıyor;
      `requireCredentials([...])` bu adları kullanıyor.
- [ ] Token ömrü ve yenileme kuralı (varsa).
- [ ] Kimlik hatası hangi HTTP kodu + gövde ile geliyor? `describeError` 401/403
      için ayrı mesaj veriyor, ama taşıyıcı 200 + gövdede hata koduyla
      cevaplıyorsa bu tamamen değişir.

## 3. Uç noktalar

Her satır için: tam URL, HTTP metodu, istek gövdesi şeması, cevap şeması.

- [ ] `testConnection` — yan etkisiz, doğrulanabilir bir çağrı (ör. şube listesi).
      Gönderi oluşturan bir uç nokta bu iş için kullanılamaz.
- [ ] `createShipment` — gönderi oluşturma.
- [ ] `getLabel` — etiket.
- [ ] `track` — **toplu** sorgu. Tek seferde kaç takip numarası kabul ediyor?
      Sadece tekli varsa bunu şimdi bilmek gerekiyor: `CarrierTrackingWorker`
      toplu çağrı varsayıyor.
- [ ] `cancelShipment` — iptal.
- [ ] `findByReference` (opsiyonel) — kendi referans kodumuzla sorgu. Bu varsa,
      `createShipment` timeout'unda barkod alınıp alınmadığı ölçülebiliyor;
      yoksa takılı claim elle temizleniyor.
- [ ] `getRates` (opsiyonel) — fiyat sorgusu. Türkiye'deki taşıyıcıların çoğunda
      yok, agregatörlerde var.
- [ ] `createReturn` (opsiyonel) — iade kodu.

## 4. Durum kodu tablosu

- [ ] Taşıyıcının **tüm** durum kodları ve açıklamaları (kısmi liste yetmez).
- [ ] Her kodun `SHIPMENT_STATUSES` karşılığı:
      `created, label_ready, handed_over, in_transit, out_for_delivery,
      delivered, undelivered, returning, returned, cancelled, lost`
- [ ] Teslim tarihi ayrı bir alanda mı geliyor, yoksa "delivered" olayının
      zamanından mı çıkarılacak? (`deliveredAt` siparişi kapatıyor.)
- [ ] Hareket listesi (`events`) ayrı uç noktada mı, aynı cevapta mı?
- [ ] Her hareketin kendi kodu var mı? `ShipmentTrackingEvent` unique anahtarı
      olay bazlı koddan üretiliyor; tüm hareketler aynı kodu taşıyorsa ilk satır
      kalır, gerisi sessizce düşer.

> Eşleşmeyen tek bir kod bile `applyTracking` guard'ına takılır ve o gönderi
> için hiçbir satır yazılmaz. Tablo eksikse connector çalışıyor gibi görünüp
> gönderileri sessizce yerinde bırakır.

## 5. Etiket

- [ ] Format: PDF / ZPL / PNG / HTML — hangileri destekleniyor?
- [ ] Cevap gövdede base64 mü, ayrı URL mi? URL ise kimlik doğrulaması var mı?
      (Taşıyıcının kendi URL'i tarayıcıya verilmiyor; `getLabel` içerik döndürmek
      zorunda.)
- [ ] Etiket gönderi oluşturulurken mi geliyor, ayrı çağrı mı gerekiyor?
- [ ] Barkod numarası ile takip numarası aynı şey mi? (`Shipment.barcode` ve
      `trackingNumber` ayrı kolonlar; birçok taşıyıcıda ikisi farklı.)

## 6. Limitler

- [ ] Dakika/saat başına istek limiti. `CarrierRateLimiter` süreç içi çalışıyor;
      çok pod'lu kurulumda kotanın aşılacağı kodda `ponytail:` notuyla duruyor.
- [ ] 429 cevabı nasıl geliyor? `Retry-After` başlığı var mı?
- [ ] Toplu takip çağrısındaki numara üst sınırı (bkz. 3).
- [ ] Günlük gönderi oluşturma sınırı var mı?

## 7. Ölçü ve fiyat

- [ ] Desi bölen (3000 / 5000 / sözleşmeye özel). Tenant başına
      `settings.desiDivisor` ile tutuluyor, connector tahmin etmiyor.
- [ ] Ağırlık birimi (kg / gr) ve boyut birimi (cm / mm).
- [ ] Çok kutulu gönderi tek istekte mi gidiyor, kutu başına ayrı istek mi?
- [ ] Kapıda ödeme (COD) alanları: tutar, para birimi, tahsilat tipi (nakit /
      kart). `paymentType` + `codAmount` + `codCurrency` bunlara gidiyor.

## 8. Adres

- [ ] Zorunlu alanlar listesi. `CarrierAddress` şu an: fullName, phone, email?,
      line1, line2?, district, city, postalCode?, countryCode, taxId?.
- [ ] İl/ilçe **kod** ile mi gönderiliyor, ad ile mi? Kod ise resmî kod tablosu
      gerekiyor (bizde saklanan yapısal adres ad tutuyor).
- [ ] Şube/aktarma merkezi seçimi gerekiyor mu?
- [ ] Telefon formatı (başında 0 / +90 / boşluksuz).

## 9. Webhook (varsa)

- [ ] Taşıyıcı durum bildirimi gönderiyor mu?
- [ ] **İmza şeması**: HMAC algoritması, hangi başlık, hangi gövde üzerinden.
- [ ] Tekrar gönderim (retry) politikası ve tekrar eden olayın ayırt edici alanı.

> Bu üçü elde olmadan webhook controller'ı yazılmıyor. İmza şemasını uydurmak,
> doğrulama yapıyormuş gibi görünen bir uç nokta bırakmak demektir.
> `CarrierWebhookEvent` tablosu boş bekliyor.

---

## Doküman kaynağı kuralı

Resmî doküman kullanıcıdan gelir. Üçüncü taraf blog, GitHub kopyası veya
"örnek entegrasyon" reposu kaynak sayılmaz: eMAG ve Zalando'da bu yolla
alınan spec'lerin SPA kabuğu ya da eski sürüm çıktığı iki kez görüldü
(`docs/plans/zalando-integration.md`, `emag-api-doc-spa-kabugu` notu).

Liste dolduğunda sıra: `<Provider>Types.ts` → `<Provider>Mapper.ts` →
`<Provider>Connector.ts` → `CarrierConnectorFactory` kaydı → canlı doğrulama
(gerçek hesap, gerçek çağrı, ölçüm commit gövdesinde).
