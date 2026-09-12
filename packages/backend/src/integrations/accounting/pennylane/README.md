# Pennylane Entegrasyonu (API v2, MOCK_READY)

Bu modül, KroptOS muhasebe entegrasyon ailesine Fransa bulut finans ve muhasebe lideri **Pennylane** (`PENNYLANE`) sağlayıcısını kazandırır.

---

## 1. §3 Kararı: Faturayı Kim Kesiyor?

| Yol | Anlamı | Numarayı Kim Veriyor | Durum |
| :--- | :--- | :--- | :--- |
| **Oluştur** (`POST /customer_invoices`) | Pennylane faturayı yapılandırılmış veriden üretir | **Pennylane** | **Seçilen Yol (Varsayılan)** |
| **İçe Aktar** (mevcut PDF) | Zaten kesilmiş bir belge deftere alınır | KroptOS / Dış sistem | İlerideki turlar |
| **E-Fatura İçe Aktar** (Factur-X) | Factur-X XML+PDF hibrit e-belge defteri | Dış sistem | Kapsam Dışı (§6) |

**KroptOS Tercihi:**
KroptOS bu entegrasyonda **"Oluştur" (`POST /customer_invoices`)** yolunu kullanır. Fatura verileri yapılandırılmış satırlar olarak Pennylane'e iletilir; resmi fatura numaralandırmasını (`invoice_number`, örn: `INV-2026-0001`), ardışık numara disiplinini ve yasal defter kaydını Pennylane üstlenir.

---

## 2. API v2 Mimarisi ve Sürüm Kararı (§2.1)

- **v1 Tamamen Emekliye Ayrılmıştır**: 2025 sonu itibarıyla Pennylane API v1 kapatılmıştır. KroptOS entegrasyonu doğrudan resmi kararlı sürüm olan **API v2** (`https://app.pennylane.com/api/external/v2/`) üzerine inşa edilmiştir.
- **Dahili ID Mimarisi**: v2 yalnızca dahili id kullanır (`source_id` yoktur).
- **Ayrı Nesne Oluşturma**: Müşteriler (`customers`), ürünler (`products`) ve faturalar (`customer_invoices`) bağımsız nesneler olarak yönetilir. Fatura gövdesinde müşteri yaratma denemesi yapılamaz.
- **Cursor Tabanlı Sayfalama**: Sayfalama `cursor` ve `limit` parametreleriyle yürütülür; yanıtlar `items`, `has_more`, `next_cursor` formatındadır.

---

## 3. Rate Limit ve Çok Kiracılı Mimari Notu (§5.3)

- **Kayan Pencere Kısıtı (25 istek / 5 saniye)**: Pennylane, saniyelik ortalamaya düzlenemeyen milisaniye hassasiyetli 5 saniyelik bloklarda 25 istek kısıtını uygular (`PennylaneWindowLimiter`).
- **Token Düzeyinde Limit**: NetSuite, Exact ve Xero'daki "uygulama geneli paylaşılan ortak havuz" kısıtı Pennylane'de **yoktur**. Her kiracının (token) kendine ait bağımsız 25 istek / 5 sn bütçesi bulunur. Bir kiracının yoğun fatura kesimi diğer kiracıların bütçesini etkilemez.

---

## 4. Ondalıklı Değerler ve KDV Standartları (§5.2, §5.4)

- **Parasal Tutarlar String Olmak Zorundadır**: `raw_currency_unit_price` ve diğer fiyat alanları `PennylaneSerializer` üzerinden zorunlu olarak `"100.00"` biçiminde string olarak serileştirilir. Sayı (number) gönderilmesi Pennylane tarafından reddedilir.
- **Fransa KDV Kodları (`vat_rate`)**: Pennylane sayısal vergi oranı değil, resmi kodlu enum bekler:
  - `FR_200`: %20 Standart
  - `FR_100`: %10 Ara
  - `FR_055`: %5.5 İndirimli
  - `FR_021`: %2.1 Süper İndirimli
  - `exempt`: %0 Muafiyet / İhracat
  Fransa dışı oran tanımlı değildir; eşleşmeyen vergi oranlarında fatura gönderimi kod düzeyinde durdurulur.

---

## 5. Fatura Yaşam Döngüsü: Taslak → Mutabakat → Kesinleştirme (§5.1)

1. **`draft: true` Zorunluluğu**: `draft` alanı atlanırsa fatura Pennylane tarafında **anında kesinleşir** ve geri alınamaz. Bu nedenle KroptOS her istekte açıkça `draft: true` gönderir.
2. **Geri Okuma**: Taslak oluşturulduktan sonra sunucunun hesapladığı toplamlar (`amount`, `currency_amount`) geri okunur.
3. **Mutabakat (Tolerans ≤ 0.05)**: KroptOS beklenen tutarı ile sunucu tutarı karşılaştırılır.
4. **Kesinleştirme (`PUT /customer_invoices/{id}/finalize`)**: Mutabakat sağlandığında kesinleştirme ucu çağrılarak resmi `invoice_number` alınır. Uyuşmazlık durumunda fatura taslakta bırakılır ve uyuşmazlık bayrağı işaretlenir.

---

## 6. Ayrı Eksen: Fransa E-Fatura Reformu (§6)

Fransa'da B2B zorunlu e-fatura ve e-reporting reform takvimi yürürlüktedir:
- **1 Eylül 2026**: Tüm şirketler için e-fatura kabulü (reception); büyük ve orta ölçekli şirketler için e-fatura düzenleme (issuance).
- **1 Eylül 2027**: KOBİ (PME) ve mikro işletmeler için e-fatura düzenleme ve e-reporting.

Pennylane API'sinde Factur-X XML+PDF formatı için ayrılmış içe aktarma uçları (`/api/external/v2/customer_invoices/e_invoices/imports`) mevcuttur. Ancak KroptOS şu an Factur-X PDF üretmediği ve PDP mimarisi henüz standartlaşmadığı için **bu uçlar bu turda kesinlikle çağrılmaz**. Arayüzde "e-fatura" terimi kullanılmaz.
