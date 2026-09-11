# Oracle NetSuite Muhasebe Entegrasyonu (MOCK_READY)

Bu modül, KroptOS platformunun **Oracle NetSuite ERP** sistemiyle olan fatura, cari, ödeme ve ürün eşleme entegrasyonunu sağlar.

---

## 1. Mimari ve Temel İlkeler

* **Durum:** `MOCK_READY`
* **Protokol:** NetSuite SuiteTalk REST Web Services (OAuth 2.0 M2M Client Credentials Grant)
* **Kapsam:** Satış Faturası (Invoice), Cari Senkronizasyonu (Customer), Tahsilat Kaydı (CustomerPayment), Ürün Eşlemesi (Item).
* **e-Fatura:** Kapsam dışıdır. Türk KDV mantığı ve yerel regülasyonlar NetSuite üzerine taşınmaz.

---

## 2. NetSuite'e Özgü Mimari Kararlar ve Dokuz Tuzak

### 2.1 Taban URL Hesaptan Üretilir & Sandbox Dönüşümü (§5.1)
* **Kural:** NetSuite API taban adresi koda gömülmez, `accountId` parametresinden üretilir (Oracle Talimatı).
* **Sandbox Kuralı:** Hesap kimliğindeki alt çizgiler (`_`) tire (`-`) işaretine dönüştürülür ve tüm karakterler **küçük harfe (lowercase)** çevrilir:
  * Örnek: `1234567_SB1` → `https://1234567-sb1.suitetalk.api.netsuite.com`
  * Üretim: `1234567` → `https://1234567.suitetalk.api.netsuite.com`
* **Host Doğrulaması:** Giden her HTTP isteğinin host'u, `NetSuiteUriHelper.validateHost` ile hesaptan beklenen host'a karşı katı şekilde doğrulanır (SSRF ve çapraz hesap karışıklığı engeli).

### 2.2 Asimetrik Kimlik Modeli & Özel Anahtar Güvenliği (§5.2)
* NetSuite M2M akışı simetrik `clientSecret` yerine **açık/özel anahtar (RSA keypair)** gerektirir.
* **Sır Yönetimi:** Özel anahtar (private key) `credentials` JSON'una veya veritabanına **KESİNLİKLE yazılmaz**. Yalnızca ortam/KMS referansı (`keyReference`) saklanır ve sunucunun güvenli ortam değişkenlerinden okunur (`process.env[keyReference]`).
* Özel anahtar ve üretilen JWT'ler log'a, audit kayıtlarına, API yanıtlarına veya hata mesajlarına sızdırılmaz.

### 2.3 Sertifika Ömrü ve Çelişkinin Çözümü (§3.c, §5.2)
* **Çelişki:** Bir dokümanda 90 gün, diğerinde 365 gün/2 yıl yazması.
* **Gerçek:** 90 günlük süre, NetSuite'in kullanıcı bazlı Authorization Code akışında kendi iç token imzalama sertifikaları içindir. M2M akışında yüklenen müşteri sertifikaları **2 yıla kadar (730 gün)** geçerlidir (genellikle 365 gün üretilir).
* **İzleme:** `certificateExpiresAt` tarihi entegrasyon kaydında saklanır. Kalan süre **30 gün ve 7 gün** kala arayüzde uyarı üretilir. Süresi dolan sertifikalarla istek yapılması engellenir.

### 2.4 Eşzamanlılık Yönetişimi — Kota Bizim Değil (§5.3)
> [!IMPORTANT]
> **Eşzamanlılık Paylaşım Uyarısı:**
> Bu connector müşterinin NetSuite hesap genelindeki eşzamanlılık havuzunu paylaşır. Müşterinin diğer entegrasyonları (iPaaS araçları, özel script'ler, ETL süreçleri) aynı havuzdan yer. Toplu işler yoğun çalışma saatleri dışında planlanmalıdır.

* **Varsayılan Eşzamanlılık:** Entegrasyon başına **1**'dir. Kodda varsayılan olarak artırılmaz.
* **429 Yönetimi:** HTTP 429 veya `SSS_REQUEST_LIMIT_EXCEEDED` alındığında üstel geri çekilme (exponential backoff + jitter) ile sınırlı (en fazla 3 deneme, maks 16s) deneme yapılır; asla sıkı döngüye (tight loop) girilmez.

### 2.5 TBA (Token-Based Authentication / OAuth 1.0a) Emekliliği (§5.4)
* NetSuite **2027.1** sürümünde yeni TBA entegrasyonu oluşturmayı tamamen engelleyecek ve NLAuth'u sonlandıracaktır. 2028.1'de TBA tamamen emekliye ayrılacaktır.
* Bu modülde kesinlikle TBA / OAuth 1.0a kodu bulunmamaktadır; yalnızca modern **OAuth 2.0 M2M** desteklenir.

### 2.6 Özel Alanlar & Metadata Catalog ile Şema Keşfi (§5.5)
* NetSuite hesaplarındaki özelleştirmeler (`custbody_*`, `custcol_*`) hesaba özeldir.
* Bağlantı testinde `metadata-catalog` uç noktasından şema keşfi yapılır. Gerekli zorunlu alanlar eksikse entegrasyon "doğrulanmadı" statüsünde bırakılır ve eksik alan operatöre bildirilir.

### 2.7 Mutabakat Penceresi & BizimHesap Kalıbı (§5.6)
* NetSuite REST API üzerinden oluşturulan faturalar, onay akışı özel olarak yapılandırılmamışsa doğrudan Defter-i Kebir'e (General Ledger) işler. UI'daki gibi risksiz bir "Draft" bekleme alanı bulunmaz.
* Bu sebeple **BizimHesap kalıbı** uygulanır: Satır tutarları, para birimi, subsidiary ve müşteri bilgileri **göndermeden önce (pre-validation)** katı şekilde doğrulanır. Gönderim sonrası mutabakat farkı bir engelleme değil, denetim/uyarı (audit alert) olarak çalışır.

### 2.8 `externalId` ile Upsert ve İdempotency (§5.7)
* SuiteTalk REST API'nin `PUT /services/rest/record/v1/invoice/eid:<reference>` sözdizimi desteklenir.
* KroptOS sipariş referansı `externalId` olarak yazılır. Ağ kesintilerinde aynı referansla yapılan tekrar çağrıları yeni bir fatura açmaz, mevcut kaydı günceller/döner.
* Claim kilit mekanizması aynı anda gelen farklı isteklerin yarış durumunu engellemek için korunur.

### 2.9 Subsidiary — OneWorld İkinci Eksen (§5.9)
* OneWorld hesaplarında kayıtlar bir `subsidiary`'ye bağlanmak zorundadır.
* Subsidiary bilgisi **istekten okunmaz**, operatör yapılandırmasından (`credentials.subsidiaryId`) gelir.

### 2.10 Rol İzinleri: 401 ile 403 Ayrımı (§5.10)
* **401 Unauthorized:** Bizim tarafımızdaki kimlik hatasıdır (JWT imzası, Client ID veya Sertifika ID uyumsuzluğu).
* **403 Forbidden:** Müşteri tarafındaki NetSuite rol izni eksikliğidir (Entegrasyona atanan rolün ilgili kayda erişim yetkisi yoktur). Operatör nereye bakacağını net olarak bilir.
