# Exact Online Muhasebe Entegrasyonu (`MOCK_READY`)

Bu modül, Benelux (Hollanda, Belçika), Almanya, Birleşik Krallık, ABD ve İspanya'da yaygın olarak kullanılan **Exact Online** bulut muhasebe ve ERP sisteminin KroptOS entegrasyonunu sağlar.

---

## 1. Mimari Prensipler ve Kapsam

- **Yasal ve Fonksiyonel Kapsam:** Satış faturaları (`SalesInvoices`), cari hesaplar (`Accounts`), ürün/hizmet eşlemeleri ve tahsilat kayıtları.
- **Benelux & AB Vergi Mantığı:** Türkiye e-fatura/KDV mantığı taşınmamıştır; Hollanda/Benelux KDV oranları (Standart %21, İndirimli %9, Sıfır %0) ve KDV kodları desteklenir.
- **Sıfır Ağ İsteği:** Gerçek kimlik bilgileri doğrulanana kadar sistem `MOCK_READY` durumundadır; `supportsTest: false` ve `supportsProduction: false` bayraklarıyla korunmuştur.

---

## 2. Çağrı Bütçesi ve Hız Sınırları (`exact.budget.ts`)

Exact Online API, ekosistemdeki en sıkı hız sınırlarından birine sahiptir:
- **Dakikalık Sınır:** Uygulama × Bölüm (Division) başına 60 çağrı (`X-RateLimit-Minutely-Limit`, `X-RateLimit-Minutely-Remaining`).
- **Günlük Sınır:** Uygulama × Bölüm başına 5.000 çağrı (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).
- **Sıfırlanma Zamanı:** `X-RateLimit-Reset` **UTC epoch MİLİSANİYE** cinsindendir.
- **Hata Sınırı:** Uç nokta başına saatte en fazla 10 hata.

### Bütçe Yöneticisi Kuralları
1. **Dinamik Header Takibi:** Sabit sayılara güvenilmez; bütçe her HTTP yanıt başlığından öğrenilir ve bölüm bazında saklanır.
2. **Ön Denetim (Pre-flight Check):** Bir iş başlatılmadan önce tahmini çağrı sayısı kalan günlük bütçeye sığmıyorsa iş başlatılmaz ve ertelenir.
3. **Yazma Rezervi (Write Reserve):** Günlük kotanın bir kısmı (varsayılan 1.000 çağrı) fatura ve tahsilat yazma işlemleri için rezerve edilmiştir; senkron/okuma işleri bu rezervi tüketemez.
4. **Kör Retry Yasağı:** Günlük kota bittiğinde işler `X-RateLimit-Reset` zamanına kadar ertelenir.

---

## 3. §5.2 Eşzamanlılık ve Çok Kiracılı Mimari Risk Notu

Exact Online API kuralları ve Fair Use Policy gereğince **paralel / multi-threaded API çağrıları kesinlikle yasaktır**. Tüm çağrılar sıralı (sequential) yürütülmelidir.

- **Bölüm Başına Eşzamanlılık:** Kesinlikle **1**'dir. Aynı bölüme ait istekler `ExactBudgetManager.runSequential()` ile serileştirilir.
- **Çok Kiracılı Ölçek Riski:** Hız sınırı bölüm başına olsa da, yüzlerce kiracı tek bir merkezi `client_id` üzerinden aynı anda istek attığında Exact Online Gateway düzeyinde şüpheli trafik algılanabilir. Yüksek hacimli kurumsal kiracılar için Exact App Center üzerinde "Dedicated App Registration (Özel İstemci Kimliği)" tahsis edilmesi önerilir.

---

## 4. §3.5 & §4 OAuth 2.0 ve 570 Saniye Yenileme Penceresi

- **Access Token Ömrü:** 600 saniye (10 dakika).
- **Erken Yenileme Yasağı:** Exact Online, token verildikten sonraki ilk **570 saniye (9.5 dakika)** içinde yapılan yenileme isteklerini doğrudan reddeder (`400 Bad Request`). Yenileme yalnızca **570s - 600s arasındaki 30 saniyelik pencerede** veya token süresi dolduktan sonra kabul edilir.
- **Refresh Token Rotasyonu:** Tek kullanımlıktır; her yenilemede yenisi verilir ve eskisi anında ölür (`rotatesOnRefresh: true`, `previousTokenGraceMs: 0`).
- **Yaz-Sonra-Kullan:** Yeni refresh token veritabanına kaydedilmeden istek atılmaz.
- **Hareketsizlik:** 30 gün kullanılmayan refresh token geçersiz kalır.

---

## 5. §5.7 Fatura Yazma Yolu: `SalesInvoices`

KroptOS, e-ticaret siparişlerinin satır bazında ürün (Item), miktar, birim fiyat, KDV ve müşteri referansıyla belgelenmesini sağlamak amacıyla ticari satış faturası modülü olan **`/salesinvoice/SalesInvoices`** uç noktasını kullanır.
- Fatura taslak (`Status: 20 - Open`) olarak oluşturulur.
- GET ile okunarak Exact Online sunucusunun hesapladığı `AmountDC` ve `VATAmountDC` değerleri KroptOS beklenen tutarlarıyla karşılaştırılır (Reconciliation).
- Müşteri sipariş referansı `YourRef` alanında tutulur ve `$filter=YourRef eq '...'` ile aranabilir.
