# Fatture in Cloud (TeamSystem) Entegrasyonu (KroptOS)

## 1. Genel Bakış ve Mimari Kararlar

Fatture in Cloud (FIC), TeamSystem grubunun İtalya pazarı için sunduğu açık dokümanlı bulut tabanlı REST/JSON v2 faturalama ve e-fatura platformudur.

> [!IMPORTANT]
> **TeamSystem Bölünür — Partner Kanalı Notu (§1):**
> TeamSystem Enterprise ve TeamSystem Alyante çözümleri şirket içi (on-prem) ve yetkili iş ortağı (partner) kanalı üzerinden kapalı entegrasyona tabidir. Logo Çözüm Ortağı, DATEV Marktplatz ve Fortnox onay süreçlerinde olduğu gibi bu ürünler ayrı bir sağlayıcı ve ayrı bir takvim konusudur. KroptOS registry'sine yalnızca açık bulut API'ye sahip `fatture-in-cloud` dahil edilmiştir; `teamsystem-enterprise` ve `teamsystem-alyante` için registry kaydı açılmaz. Partner kanalı işbirliği Gün 0'da başlatılmalıdır.

---

## 2. E-Fatura Kararı ve Hukuki Not (§2.1, §5.1, §5.8)

İtalya'da B2B ve B2C elektronik faturalar merkezi vergi dairesi sistemi olan **SdI (Sistema di Interscambio)** üzerinden zorunludur.

> [!CAUTION]
> **Hukuki Sınır ve Geri Alınamazlık İlkesi:**
> Bir faturanın SdI'ya iletilmesi yasal ve mali sonuç doğuran, sistem üzerinden tek taraflı geri alınamaz bir işlemdir. Hatalı gönderilen bir belge ancak karşı tarafa "Nota di Credito" (İade/Düzeltme Faturası) düzenlenerek düzeltilebilir.
> 
> **Phase 1 Kararları (Pazarlığa Kapalı):**
> 1. Belgeler `e_invoice: true` bayrağı ve gerekli `ei_data` (ödeme yöntemi, banka bilgileri, vergi türü) alanlarıyla oluşturulur.
> 2. **SdI gönderme ucu (`POST /c/{company_id}/issued_documents/{document_id}/e_invoice/send`) BU TURDA ÇAĞRILMAZ** ve konnektör izin listesine eklenmez.
> 3. **`dry_run` doğrulama yolu (`GET .../e_invoice/xml_verify`) kurulmuştur.** Belge oluşturulduktan sonra XML şeması prova edilir; hata varsa operatöre iletilir.
> 4. Arayüzde hiçbir zaman "e-fatura gönderildi" yazılmaz; *"e-fatura verisi hazırlandı, SdI'ya resmi gönderim Fatture in Cloud portalı üzerinden yapılır"* kalıcı uyarısı yer alır.
> 5. Canlı gönderim sonraki fazda, açık operatör onayı (`acknowledgeLegalSend: true`), denetim kaydı (AuditLog) ve geri alınamazlık uyarısıyla açılacaktır.

---

## 3. İki Durum Ekseni ve `ei_status` Modellemesi (§5.2, §6)

Seride ilk kez bir belgenin iki bağımsız durum ekseni bulunmaktadır:
1. **KroptOS Belge Durumu:** `pending` | `sent` | `failed` | `cancelled`
   - Belgenin muhasebe sisteminde (`issued_documents`) başarıyla oluşturulup oluşturulmadığını gösterir.
2. **Fatture in Cloud `ei_status`:** `attempt` … `manual_rejected` (14 durum)
   - Belgenin SdI iletim aşamasını gösterir.

### "Sent" Tuzağı:
Fatture in Cloud'un `sent` değeri *"belge SdI'ya iletildi"* demektir. KroptOS'un `sent` değeri ise *"belge muhasebe sistemine yazıldı"* demektir. **İki durum asla birbirine eşlenmez.** FIC tarafında `ei_status: 'sent'` olması KroptOS belge durumunu değiştirmez.

### Saklama Yeri Kararı (§6):
Prisma şemasında yeni kolon açılmamıştır. FIC'ten dönen ham maskeli yanıttaki `ei_status`, `rawResponse.ei_status` içerisinde saklanır. API servis ve DTO katmanı bu alanı okuyarak `AccountingDocumentDto.eiStatus` olarak dışarıya açar. Böylece ana `status` alanı kirlenmez ve arayüzde iki durum iki ayrı sütunda listelenir.

---

## 4. Tutarlar, Fiyatlar ve KDV Hesaplama (§5.4, §5.5)

- **`use_gross_prices` Bayrağı (§5.4):**
  - `false` (varsayılan): Kalem fiyatları `net_price` olarak iletilir.
  - `true`: Kalem fiyatları `gross_price` olarak iletilir.
  - Net $\leftrightarrow$ Brüt dönüşümü yalnızca tek bir yerde (`fic.prices.ts`) yürütülür.
- **2 Ondalık Basamak Yuvarlama (§5.5):**
  - FIC tüm tutarları 2 ondalık basamağa yuvarlar.
  - `payments_list` toplamı ile belgenin brüt tutarı kuruşu kuruşuna eşit olmalıdır; aksi halde FIC `409 Conflict` hatası döndürür.
- **Sunucu Alan Doldurmaz (§5.3):**
  - FIC sunucusu `product_id` veya müşteri `id` verilse dahi ad, fiyat, KDV ve adres alanlarını otomatik tamamlamaz.
  - Zorunlu alanlar (`name`, `vat_number`/`tax_code`, adres, miktar, KDV ID, fiyat) eksiksiz gönderilir. Eksik alan durumunda istek gönderilmeden `BadRequestException` fırlatılır; asla dolgu metin (`"-"`, `"Bilinmiyor"`) üretilmez.

---

## 5. Tahsilat Yolu (§5.6)

Fatture in Cloud'da tahsilatlar belgenin parçası olan `payments_list` içinde iletilir. Ayrı bir `/payments` kaynağı yoktur.
- Fatura oluşturulurken bilinen tahsilat durumu `payments_list`'e işlenir.
- Fatura durumu `paid` ise `payment_account.id` (Kasa/Banka hesap ID) **zorunludur**. Operatör yapılandırmasında bu ID bulunamazsa istek reddedilir; varsayılan uydurulmaz.

---

## 6. Kota, Rate Limit ve Webhook Disiplini (§4)

- **Kota Başlıkları:** FIC API yanıtlarında `RateLimit-HourlyRemaining` ve `RateLimit-MonthlyRemaining` başlıklarını döner.
- **429 Yönetimi:** `429 Too Many Requests` durumunda `Retry-After` süresine riayet edilir; üstel geri çekilme (exponential backoff) ve rastgele gecikme (jitter) uygulanır.
- **Yoklama Sınırı:** `ei_status` durumu için sıkı döngü (tight loop) yasaktır; üstel aralık (2s, 4s, 8s, 16s, 32s) ve azami 5 deneme tavanı uygulanır.
- **Webhook:** Webhook altyapısı bu fazda kurulmamıştır; açık uç, imza doğrulama ve kiracı izolasyonu ön koşullarıyla sonraki faza bırakılmıştır.
