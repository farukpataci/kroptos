# Microsoft Dynamics 365 Business Central Online Entegrasyonu

Bu paket, **Microsoft Dynamics 365 Business Central Online (API v2.0)** ile fatura, cari ve ürün eşleştirmelerini uçtan uca yöneten KroptOS muhasebe konnektörüdür.

Mevcut hazırlık düzeyi: **`MOCK_READY`** (Dokümantasyon Durumu: `PARTIAL`).

---

## 1. Sağlayıcı Ayrımı Kuralı (BÖL)
Online ile On-premises mimarileri farklı uç noktalar, kimlik mekanizmaları ve taban URL'leri kullanmaktadır:
- `ms-dynamics-bc-online`: Bu paketin konusu.
- `ms-dynamics-bc-onprem`: AYRI bir sağlayıcıdır. On-premises desteği açılana kadar merkezi `AccountingProviderRegistry`'ye eklenmez.

---

## 2. Doğrulanan ve Doğrulanmayan Alanlar (Microsoft Learn, 2026-09)

### 2.1 Doğrulananlar
- **Taban URL:** `https://api.businesscentral.dynamics.com/v2.0/<environment>/api/v2.0` (veya doğrudan kiracı için `.../<userDomain>/<environment>/api/v2.0`)
- **Kimlik Doğrulama:** OAuth2 S2S Client Credentials (`grant_type=client_credentials`, `scope=https://api.businesscentral.dynamics.com/.default`)
- **Varlık Yolları:** `.../companies({companyId})/salesInvoices({id})` ve `.../salesInvoiceLines`
- **Fatura Alanları & Salt Okunurlar:** Başlık ve satır tutarları BC tarafından otomatik hesaplanır (`pricesIncludeTax`, `totalAmountExcludingTax`, `totalTaxAmount`, `totalAmountIncludingTax`, `netAmount`, `taxPercent`). Bu alanlar KroptOS tarafından **ASLA GÖNDERİLMEZ**.
- **Bağlı Eylemler (Bound Actions):** `Microsoft.NAV.post`, `Microsoft.NAV.cancel`, `Microsoft.NAV.makeCorrectiveCreditMemo` (204 döner).
- **ETag / Concurrency:** DELETE ve PATCH işlemlerinde `If-Match` başlığı **ZORUNLUDUR**. Uyuşmazlık durumunda HTTP 412 (Precondition Failed) döner; bu hata retry edilmez.

### 2.2 Doğrulanmayanlar (Uydurma Yapılmadı)
- **Tahsilat Akışı:** `customerPayment` ve `customerPaymentJournal` varlıkları v2.0 API'de mevcut olsa da, ödemeyi deftere otomatik işleyen standart bir `Microsoft.NAV.post` bound action'ı bulunmamaktadır. Bu sebeple:
  - `capabilities.payment = 'DOCUMENTATION_REQUIRED'`
  - Canlı sandbox doğrulanana kadar çağrıldığında `IntegrationNotVerifiedError` fırlatılır.
- **$filter Performansı:** `externalDocumentNumber` üzerinde filtreleme OData v4 sözdizimi ile yazılmış ancak canlı performans endeksi doğrulanana kadar `capabilities.findInvoiceByReference = 'MOCK_ONLY'` olarak işaretlenmiştir.
- **send / postAndSend / cancelAndSend:** Müşteriye bildirim/e-posta gönderme riski taşıdığından kütüphanede devre dışı bırakılmıştır (`NOT_SUPPORTED`).

---

## 3. Mimari ve Kritik Kalıplar

### 3.1 Çok Kiracılı Kimlik Kararı (§4.6)
**Seçim: Tek Çok Kiracılı (Multitenant) Entra ID Uygulaması (Önerilen Model)**
- `clientId` ve `clientSecret` KroptOS sistem seviyesinde ortam değişkenlerinde (`BC_ONLINE_CLIENT_ID`, `BC_ONLINE_CLIENT_SECRET`) saklanır.
- Kiracı bazında yalnızca `aadTenantId`, `environmentName`, `companyId` ve isteğe bağlı `userDomain` tutulur.
- Özel Entra uygulaması tercih eden müşteriler için credential şemasında opsiyonel `clientId` ve `clientSecret` alanları da desteklenir.
- **Secret Rotasyon Planı:**
  1. Entra ID uygulamasında yeni bir Client Secret oluşturulur (eskisi silinmeden).
  2. KroptOS sunucu ortam değişkeni güncellenir ve token önbelleği temizlenir.
  3. Yeni secret doğrulanınca eski secret Entra ID üzerinden silinir.

### 3.2 Taslak -> Mutabakat -> Deftere İşleme (Post) Akışı (§4.2)
1. **Idempotency Claim Satırı:** `AccountingDocument` üzerinde `pending` kaydı oluşturulur.
2. **Taslak Oluşturma:** `POST salesInvoices` ile taslak fatura açılır (`externalDocumentNumber` = sipariş referans kodu).
3. **Satırları Ekleme:** `POST salesInvoiceLines` ile kalemler gönderilir (yalnızca `quantity`, `unitPrice`, `taxCode`, `description`).
4. **Toplamları Okuma:** `GET salesInvoices({id})?$expand=salesInvoiceLines` ile BC'nin hesapladığı `totalAmountIncludingTax` okunur.
5. **Mutabakat (Reconciliation):**
   - KroptOS `grandTotal` ile BC `totalAmountIncludingTax` kuruşu kuruşuna karşılaştırılır. Tolerans yoktur.
   - **Tutar Tutuyorsa:** `Microsoft.NAV.post` çağrılarak fatura deftere işlenir ve `status: 'sent'` olur.
   - **Tutar Tutmuyorsa:** `post` ÇAĞRILMAZ. Belge KroptOS'ta `pending` kalır, fark `rawResponse.reconciliationMessage`'a yazılır ve operatöre arayüzde gösterilir. Taslak Business Central üzerinde inceleme için saklanır.

### 3.3 İptal Akışı (§4.4)
- İptal isteğinde faturanın güncel BC durumu okunur:
  - **Draft (Taslak):** `DELETE salesInvoices({id})` ile silinir (ETag `If-Match` ile).
  - **Open / Paid (Kaydedilmiş):** `Microsoft.NAV.cancel` çağrılarak düzeltici alacak dekontu üretilir. Operatöre dekont oluşturulduğu bilgisi iletilir.

---

## 4. Müşteri Onboarding Adımları (Microsoft Entra ID)
1. **Azure Portal / Entra ID:**
   - App Registration açılır (`Accounts in any organizational directory`).
   - `API.ReadWrite.All` Application permission eklenir.
2. **Business Central Admin:**
   - "Microsoft Entra Applications" sayfasına gidilir.
   - Client ID kaydedilir ve gerekli izin kümeleri (`D365 BASIC`, `D365 SALES DOC, EDIT`) atanır.
3. **Grant Consent:**
   - Kart üzerinden Global / Cloud Application Administrator tarafından onay verilir.
