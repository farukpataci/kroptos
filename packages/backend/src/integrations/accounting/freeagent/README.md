# KroptOS — FreeAgent Muhasebe Entegrasyonu

Birleşik Krallık (UK) odaklı bulut muhasebe sistemi **FreeAgent** (REST/JSON v2) entegrasyonu.

## 1. Hazırlık ve Durum
- **Hazırlık Seviyesi:** `MOCK_READY`
- **Dokümantasyon Durumu:** `PARTIAL`
- **supportsMock:** `true`
- **supportsTest:** `false` (Canlı kimlik bilgisi doğrulanana kadar ağ isteği korumalıdır)
- **supportsProduction:** `false` (Canlı kimlik bilgisi doğrulanana kadar ağ isteği korumalıdır)

---

## 2. Sınır: MTD (Making Tax Digital) ve Hukuki Sorumluluk (§1.1)

> **KRİTİK HUKUKİ SINIR:**
> **MTD (Making Tax Digital) KDV beyanı FreeAgent tarafında kalır — KroptOS beyan üretmez, veri besler.**

- FreeAgent API'de yer alan KDV beyan (VAT Return) uçları KroptOS kapsamında **kesinlikle çağrılmaz** ve ileride eklense dahi **yalnızca okuma** amaçlı olabilir.
- KroptOS hiçbir koşulda UK HMRC için KDV beyanı **üretmez, hesaplamaz, onaylamaz ve göndermez.**
- KroptOS arayüzünde "KDV beyanı", "MTD", "beyan gönderildi" gibi hiçbir beyan iddiası içeren ifade kullanılamaz.
- Bu sınır, DATEV entegrasyonundaki *"muhatap Steuerberater"* ve Türk e-fatura sistemlerindeki *"GİB entegratörü"* sınırıyla aynı ailedendir; salt bir kod kuralı değil, yasal bir sorumluluk ayrımıdır.

---

## 3. Mimari ve Yaşam Döngüsü

### 3.1 §5.1 İlişkiler Tam URL ve Ortam Ayrımı
- FreeAgent API'de tüm ilişkiler tam URL ile temsil edilir (ör. `contact: "https://api.freeagent.com/v2/contacts/2"`).
- **Kimlik Saklama Kuralı:** Veritabanında sayısal kaynak kimliği (`2`) saklanır, tam URL hedef ortamın taban adresinden (`FreeAgentUriHelper.buildResourceUri`) dinamik olarak yeniden kurulur.
- **Host Doğrulaması:** API'den dönen hiçbir adrese körlemesine istek atılmaz; `FreeAgentUriHelper.validateHost` ile host adresi doğrulanır (`api.freeagent.com` veya `api.sandbox.freeagent.com`).
- **Çapraz Ortam Geçersizliği:** Sandbox'ta üretilen bir eşleme üretim ortamında geçersizdir (`isEnvironmentMatch`); sessizce taşınamaz.

### 3.2 §5.2 `mark_as_sent` e-Posta Göndermez (Güvenli Geçiş)
- Durum geçişleri (`PUT /invoices/:id/transitions/...`) ile e-posta gönderimi (`POST /invoices/:id/send_email`) tamamen ayrı uçlardır.
- Fatura kesinleştirme işlemi `PUT /invoices/:id/transitions/mark_as_sent` ile yan etkisiz olarak yürütülür.
- `send_email` ve `mark_as_scheduled` uçları **kesinlikle yasaktır ve izin listesine alınmaz.**

### 3.3 §5.3 Sunucu Tutar Hesaplaması ve Mutabakat
- `net_value`, `sales_tax_value`, `total_value`, `paid_value`, `due_value` alanları **salt okunurdur**. Giden istekte bulunamaz.
- Akış:
  1. Fatura Draft (100) olarak açılır.
  2. Geri okunup sunucunun hesapladığı `total_value` alınır.
  3. KroptOS sipariş toplamıyla mutabakat edilir.
  4. Tutarsa `mark_as_sent` çağrılır; tutmazsa yükseltme yapılmaz, taslak FreeAgent'ta bırakılır ve fark operatöre raporlanır.

### 3.4 §3 Ürün -> Gelir Kategorisi Eşlemesi
- FreeAgent'ta geleneksel ürün kartı kataloğu yoktur; fatura kalemleri muhasebe kategorisi URI'sine (`category`) bağlanır.
- Kategori listesi FreeAgent'tan okunur, firma bazında operatör tarafından eşleştirilir.
- Kategori seçimi yapılmadan fatura gönderilemez; varsayılan kategori uydurulamaz.

### 3.5 §4 RefreshSemantics Dördüncü Profil
```ts
{
  rotatesOnRefresh: true,
  previousTokenGraceMs: 0,       // Dokümante tolerans yok -> 0 ms
  inactivityLimitDays: null,     // Pratikte süresiz
  staleTokenUseIsDestructive: false,
}
```
- 15 token yenileme/dakika kısıtı `AccountingRateLimiter` seviyesinde korunur.
- `expires_in` koda gömülmez, cevaptan dinamik okunur (§5.7).

### 3.6 §5.8 İptal ve Durum Eşlemesi
- Fatura iptali öncesi güncel durum okunur; ödenmiş (`Paid`/`Overpaid`) faturalar geçişle iptal edilemez, Credit Note gerektirir.
- `Refunded`, `Written-off`, `Part written-off` durumları **`sent`** olarak eşlenir; belge muhasebede yaşamaya devam ettiği için asla `cancelled` yapılamaz.
- `capabilities.findInvoiceByReference = DOCUMENTATION_REQUIRED` (§5.9).
