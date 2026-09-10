# QuickBooks Online Accounting Entegrasyonu (KroptOS)

## 1. Genel Bakış ve Kapsam

QuickBooks Online (QBO) entegrasyonu, uluslararası pazarlarda (ABD, Birleşik Krallık, Kanada, Avustralya) faaliyet gösteren işletmeler için geliştirilmiştir.

- **Protokol:** REST API v3
- **Durum:** `MOCK_READY` (Sandbox veya canlı kimlik bilgisi olmadan gerçek ağ çağrısı yapılmaz)
- **Hedef Varlıklar:** Fatura (`Invoice`), Cari (`Customer`), Ürün (`Item`), Tahsilat (`Payment`)
- **Vergi Mantığı:** Türkiye GİB/e-Fatura mantığı kesinlikle taşınmamıştır; uluslararası satış vergisi ve QBO Automated Sales Tax (AST) modeli geçerlidir.

---

## 2. API Yaşam Döngüsü ve `minorversion` Sabitlemesi (§3.2)

QuickBooks Online API v3 çağrılarında `minorversion` parametresi **zorunludur**.
- **Pinlenen Sürüm:** `QBO_API_MINORVERSION = '75'`
- **Gerekçe:** 1–74 sürümleri Intuit tarafından emekliye ayrılmıştır / kullanım dışı bırakılmıştır. `latest` kullanımı API sözleşmesinde beklenmedik kırılmalara yol açabileceğinden sabit değere pinlenmiştir.
- **Bakım ve Gözden Geçirme Takvimi:**
  - **Son Doğrulama Tarihi:** 10 Eylül 2026
  - **Sonraki Planlı Kontrol:** Mart 2027 (azami 6 aylık periyot)
  - **İzlenecek Kaynak:** [Intuit Developer Changelog](https://developer.intuit.com/hub/blog) ve API Reference.

---

## 3. Doğrulanmış Bilgiler ve Dokümantasyon Çelişkileri (§3.3 & §3.4)

| Konu | Dokümante Edilen / Varsayılan Değer | İkincil Kaynak Çelişkisi | İzlenen Güvenlik Stratejisi |
|---|---|---|---|
| **Refresh Token Ömrü** | **100 gün** | Bazı forumlarda "5 yıl", bazılarında "24 saat" | Intuit resmî OAuth2 kılavuzundaki 100 gün esastır. Token rotasyonu ~24 saatte bir tetiklenir. |
| **Eski Token Kullanım Riski** | **Yıkıcı (Destructive)** | - | Eski/geçersiz token denemesi `invalid_grant` döndürür ve yetkilendirme zincirini kalıcı olarak iptal edebilir (`staleTokenUseIsDestructive: true`). Çekirdek asla eski token ile deneme yapmaz. |
| **API İstek Limiti** | **500 istek / dk** (realmId başına) | - | Standart API rate limit (429'da üstel geri çekilme). |
| **Eşzamanlılık Limiti** | **10 eşzamanlı istek** | "40 istek" vs "10 istek" | En dar limit olan 10 eşzamanlı istek varsayılmıştır. |
| **Toplu İşlem (Batch)** | **Kullanılmıyor** | "30 varlık" vs "120/dk" | Kısmi hata/başarı durumları idempotency'yi bozduğundan tekil çağrı modeli benimsenmiştir. |
| **Fatura Durum Alanı** | **Durum alanı yoktur** | - | Durum `TotalAmt`, `Balance` ve void bayrağından türetilir (§4.7). Bilinmeyen her durum `pending` kalır. |
| **Idempotency** | `requestid` query parametresi | Header sanılması | URL'de `?requestid={UUID}&minorversion=75` olarak gönderilir (azami 50 karakter). |
| **Otomatik Satış Vergisi (AST)** | `Preferences.TaxPrefs.PartnerTaxEnabled` | - | `true` ise `TxnTaxDetail` gönderilmez, `TaxCodeRef` satırda `'TAX'` / `'NON'` olarak ayarlanır. |
| **İyimser Kilit (`SyncToken`)** | Hata Kodu `5010` (Stale Object) | - | Mutasyondan hemen önce GET yapılır; 5010 durumunda 1 kez yeniden okunup tekrarlanır, döngü kurulmaz. |

---

## 4. Yetenek Matrisi

- `stockSync`: `NOT_SUPPORTED`
- `salesInvoice`: `MOCK_ONLY`
- `payment`: `MOCK_ONLY`
- `contactSync`: `MOCK_ONLY`
- `productMapping`: `MOCK_ONLY`
- `eInvoiceOfficialSend`: `NOT_SUPPORTED`
- `cancelInvoice`: `MOCK_ONLY` (Taslak/açık: Void)
- `findInvoiceByReference`: `MOCK_ONLY`
- `multiCompany`: `MOCK_ONLY`
- `supportsTest`: `false`
- `supportsProduction`: `false`
- `lastVerifiedAt`: `null`
- `sandboxVerifiedAt`: `null`
