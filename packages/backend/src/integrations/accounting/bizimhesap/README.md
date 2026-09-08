# BizimHesap Muhasebe Entegrasyonu (Faz 1)

Bu modül KroptOS muhasebe altyapısının **BizimHesap** entegrasyonudur.

## Entegrasyon Durumu ve Kaynak

- **Resmî Dokümantasyon Portalı:** [https://apidocs.bizimhesap.com](https://apidocs.bizimhesap.com) (2026-09)
- **Hazırlık Seviyesi:** `MOCK_READY`
- **Ağ Durumu:** Sıfır gerçek ağ isteği. `TEST` veya `PRODUCTION` ortamlarında `IntegrationNotVerifiedError` fırlatılır.
- **Protokol:** REST API (JSON)
- **Doğrulama Durumu (`documentationStatus`):** `PARTIAL`

## Doğrulanan Uçlar ve Kapsam

1. **Satış Faturası Oluşturma (`sales_invoice`):**
   - `POST https://bizimhesap.com/api/b2b/addinvoice`
   - Gövde alanları (`firmId`, `invoiceNo`, `invoiceType: 3`, `dates`, `customer`, `amounts`, `details`) tam doğrulanmıştır.
   - Başarılı cevap: `{ "error": "", "guid": "...", "url": "..." }`
   - Hatalı cevap: `{ "error": "mesaj", "guid": "", "url": "" }`

## Bu API'de Olmayan ve NOT_SUPPORTED Olan Akışlar

- **Tahsilat / Ödeme (`payment`):** `NOT_SUPPORTED`. BizimHesap B2B API üzerinde tahsilat kaydetme ucu yoktur.
- **Cari Senkronizasyonu (`contactSync`):** `NOT_SUPPORTED`. Ayrı cari oluşturma ucu yoktur. Cari kart, faturadaki `customer` nesnesi üzerinden BizimHesap tarafından otomatik üretilir.
- **Ürün Kartı Yazma (`productMapping`):** `NOT_SUPPORTED`. Yalnızca `GET /api/b2b/products` okuma ucu vardır; ürün oluşturma ucu yoktur.
- **Fatura İptali (`cancelInvoice`):** `NOT_SUPPORTED`. API üzerinden iptal ucu yoktur. Operatör onaylı yerel iptal (`/cancel-locally`) kullanılır; BizimHesap panelinden elle iptal gerektirir.
- **Referansla Fatura Sorgulama (`findInvoiceByReference`):** `NOT_SUPPORTED`. API'de referansla fatura sorgulama ucu yoktur.

## Kritik Güvenlik ve İş Kuralları

1. **İki Kimlik Mekanizması & Maskeleme:**
   - `firmId`, `key`, ve `token` alanlarının üçü de `secret: true` olarak şifrelenir ve maskelenir.
   - `firmId` asla istek gövdesinden okunmaz; doğrulanmış `AccountingCompany.externalCompanyId` üzerinden iletilir.
2. **Timeout'ta Retry Kesinlikle Yasak (`attempts: 1`):**
   - Sorgulama ucu olmadığı için timeout durumunda kör retry çift fatura ve çift cari yaratır. Kuyrukta tekrar yapılmaz; takılı claim operatör talimatıyla elle eşleştirilir (`attach-external`).
3. **Tutarlar ve Kuruş Artığı Doğrulaması:**
   - BizimHesap tutar hesaplamaz. `grossPrice`, `discount`, `net`, `tax`, `total` hem kalemlerde hem başlıkta `Decimal` ile hesaplanır.
   - Kuruş yuvarlama artığı deterministik olarak son kaleme verilir.
4. **Para Birimi Dönüşümü:**
   - KroptOS `TRY` kodunu yalnızca mapper içinde BizimHesap'ın beklediği `TL` koduna dönüştürür. Çekirdeğe `TL` sızdırılmaz. Desteklenen para birimleri: `TL, USD, EUR, CHF, GBP`.
5. **Düz HTTP Güvenlik Kuralı:**
   - `AccountingHttpClient` düz HTTP bağlantılarını otomatik olarak HTTPS'e yükseltir.
