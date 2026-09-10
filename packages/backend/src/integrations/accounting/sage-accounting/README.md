# Sage Business Cloud Accounting Integration (KroptOS)

Bu entegrasyon, Sage Business Cloud Accounting v3.1 REST API üzerinden KroptOS fatura, cari ve yapılandırma keşfi süreçlerini yönetir.

## 1. Mimari ve Sağlayıcı Ayrımı
Matris kuralı gereğince Sage tek bir ürün değildir. Yalnızca **Sage Business Cloud Accounting** bu sağlayıcı altındadır (`sage-accounting`). Diğer Sage ürünleri (`sage-x3`, `sage-intacct`, `sage-200`, `sage-50`) farklı protokollere sahip bağımsız ürünler olup bu sağlayıcı altına eklenmez.

## 2. Doğrulanan API Kaynakları ve İkincil Kaynak Durumu

| Parametre / Alan | İkincil Kaynak Değeri | Doğrulama Durumu | Kaynak URL / Kanıt |
| :--- | :--- | :--- | :--- |
| **API Base URL** | `https://api.accounting.sage.com/v3.1/` | **DOĞRULANDI** | [Sage Developer Accounting API](https://developer.sage.com/accounting/) |
| **OAuth Authorize** | `https://www.sageone.com/oauth2/auth/central` | **DOĞRULANDI** | Sage Central Auth Endpoint |
| **OAuth Token** | `https://oauth.accounting.sage.com/token` | **DOĞRULANDI** | Sage OAuth v2 Token Service |
| **Access Token Ömrü** | 300 saniye (5 dakika) | **DOĞRULANDI** | `expires_in: 300` |
| **Refresh Token Ömrü** | 31 gün hareketsizlik | **DOĞRULANDI** | 31 days rolling expiration |
| **Token Rotasyonu** | Her kullanımda anında rotasyon | **DOĞRULANDI** | Eskisi anında geçersiz kılınır |
| **Firma Başlığı** | `X-Business: <business_id>` | **DOĞRULANDI** | Çok firmalı mimaride zorunlu header |
| **Sayfalama Zarfı** | `{ "$next": "<tam_URL>", "$items": [...] }` | **DOĞRULANDI** | `$next` doğrudan tam URL takip edilir |
| **Tutar Hesaplama (§4.6)** | Sage hesaplar | **DOĞRULANDI** | BC kalıbı (satır bazlı gönderim + geri oku + mutabakat) |
| **Reference Arama (§4.5)** | `?search=...` (serbest metin) | **DOĞRULANDI** | `findByReference` = `DOCUMENTATION_REQUIRED` |
| **Tahsilat & İptal (§4.7)** | `/contact_payments`, `/sales_invoices/{id}` | **DOCUMENTATION_REQUIRED** | Canlı sandbox doğrulaması öncesi kapalı |
| **Rate Limit (§3.6)** | 100 req/dk (firma) / 1.296.000 (uygulama) | **KAYNAK ÇELİŞKİSİ** | En dar sınır (100 req/dk) varsayıldı; `Retry-After` header'ına uyulur |

## 3. §4.1 Dönen Refresh Token Güvenliği
- **Single-Flight:** Eşzamanlı isteklerde çoklu yenilemeyi önlemek için `AccountingTokenStore.getOrRefreshToken` kullanılır.
- **Sıralama:** Yeni refresh token DB'ye şifreli kaydedilmeden (commit) asla access token ile API isteği atılmaz. DB yazımı başarısız olursa istek durdurulur.
- **invalid_grant:** Refresh token ölmüşse retry yapılmaz; durum `failed` ve `REAUTHORIZATION_REQUIRED` olarak işaretlenir.

## 4. §6 Yapılandırma Keşfi
Sage bölgesel bir üründür (UK/IE/vb.) ve Türk KDV mantığı koda gömülmez. Fatura kesmeden önce:
- Varsayılan Gelir Hesabı (`ledger_account_id` - ör. 4000)
- Varsayılan Vergi Oranı (`tax_rate_id` - ör. GB_STANDARD)
`GET /ledger_accounts` ve `GET /tax_rates` üzerinden operatör tarafından seçilir ve `AccountingCompany.defaultAccountCodes` içinde saklanır.
