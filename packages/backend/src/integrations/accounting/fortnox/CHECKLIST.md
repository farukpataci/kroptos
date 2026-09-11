# Fortnox Entegrasyon Kontrol Listesi (Developer Integration Checklist)

Bu belge, Fortnox Geliştirici Portalı (`apps.fortnox.se/developer`, `developer.fortnox.se`) ve
resmi entegrasyon kabul rehberlerinde tanımlanan tüm teknik, operasyonel ve ticari dış kabul
kriterlerinin KroptOS mimarisindeki karşılıklarını belgeler.

> **Önemli İlke:** Bu kontrol listesi Fortnox tarafından zorunlu tutulan bir DIŞ kabul kriteridir.
> Uygulama bu kriterleri sağlamadan ve onay toplantısını (review meeting) geçmeden üretim ortamına
> erişim izni alamaz. Kod bu turda `MOCK_READY` seviyesindedir; hiçbir gerçek ağ isteği yapılmaz.
> Durumlar dürüstçe işaretlenmiştir.

---

## Durum Özeti

| Kategori | Toplam | Karşılandı (Bu Tur) | Sonraki Faz (Canlı/Onay) | Kapsam Dışı (Gerekçeli) |
|---|:---:|:---:|:---:|:---:|
| 1. Geliştirici Kaydı & Yasal Çerçeve | 4 | 0 | 4 | 0 |
| 2. Ortam & Test Altyapısı | 3 | 2 | 1 | 0 |
| 3. Kimlik Doğrulama & OAuth 2.0 Güvenliği | 8 | 8 | 0 | 0 |
| 4. Trafik Disiplini & Rate Limiting | 5 | 5 | 0 | 0 |
| 5. Veri Bütünlüğü, Fatura & Değişmezlik | 8 | 7 | 0 | 1 |
| 6. Mali Yıl & Muhasebe Kuralları | 4 | 4 | 0 | 0 |
| 7. Hata Yönetimi & Maskeleme | 5 | 5 | 0 | 0 |
| 8. Pazaryeri, Yayın Modeli & Ticari Hazırlık | 5 | 1 | 4 | 0 |
| **TOPLAM** | **42** | **32** | **9** | **1** |

---

## 1. Geliştirici Kaydı ve Yasal Çerçeve

| No | Kriter / Fortnox Maddesi | Durum | KroptOS Karşılığı / Gerekçe |
|---|---|:---:|---|
| 1.1 | **Geliştirici Portalı Kaydı:** İsveç şahıs (Personnummer) veya şirket (Organisationsnummer) kimliği ile `apps.fortnox.se/developer` üzerinde kayıtlı geliştirici hesabı açılması. | ⏳ Sonraki Faz | Canlı hesap açılışı ticari/kurumsal adımdır; bu turda sandbox/mock çalıştığı için canlı kimlik gerekmez. TEST_READY aşamasında tamamlanacaktır. |
| 1.2 | **Developer License Talebi:** Fortnox şirket hesabına ücretsiz geliştirici lisansının tanımlanması. | ⏳ Sonraki Faz | Fortnox destek ekibi veya portal üzerinden canlı hesaba atanır. TEST_READY aşamasında tamamlanacaktır. |
| 1.3 | **App Partner Sözleşmesi:** Fortnox Entegrasyon Partner Sözleşmesi'nin incelenmesi ve onaylanması. | ⏳ Sonraki Faz | Ticari sözleşme onayı KroptOS yönetimi tarafından üretim yayını öncesinde verilecektir. |
| 1.4 | **Entegrasyon Kaydı (Client ID / Secret):** Portalde entegrasyon oluşturularak `client_id` ve `client_secret` alınması, redirect URI tanımlanması. | ⏳ Sonraki Faz | Kimlik bilgileri TEST_READY'de portaldan üretilecek; bu turda mock ortam için `fortnox.credential-schema.ts` üzerinden şeması hazırlandı. |

---

## 2. Ortam ve Test Altyapısı

| No | Kriter / Fortnox Maddesi | Durum | KroptOS Karşılığı / Gerekçe |
|---|---|:---:|---|
| 2.1 | **Test Veritabanı (Sandbox) Kullanımı:** Geliştirici portalında sunulan (30 adede kadar eşzamanlı) test şirket/veritabanı ile doğrulama yapılması. | ⏳ Sonraki Faz | MOCK_READY turunda yerel mock simulator çalışır. TEST_READY aşamasında Fortnox Developer Portal'dan test veritabanı açılarak uçtan uca doğrulanacaktır. |
| 2.2 | **Üretim Verisine İzolasyon:** Test sürecinde hiçbir gerçek müşteri veritabanına bağlanılmaması. | ✅ Karşılandı | `supportsTest: false`, `supportsProduction: false`; test ve prod istemcileri `IntegrationNotVerifiedError` fırlatır. Sıfır canlı ağ isteği. |
| 2.3 | **Tenant & Mağaza İzolasyonu:** Çok kiracılı mimaride her KroptOS mağazasının bağımsız Fortnox bağlantısına ve kimlik bilgilerine sahip olması. | ✅ Karşılandı | `AccountingCompany` tablosunda `tenantId`/`storeId` bileşik anahtarı ile tam izolasyon. Çapraz erişim testlerle kilitli. |

---

## 3. Kimlik Doğrulama & OAuth 2.0 Güvenliği

| No | Kriter / Fortnox Maddesi | Durum | KroptOS Karşılığı / Gerekçe |
|---|---|:---:|---|
| 3.1 | **OAuth 2.0 Authorization Code Flow:** Eski sabit token / client-secret header yöntemi (30 Nisan 2025'te tamamen kalktı) yerine Authorization Code Grant kullanılması. | ✅ Karşılandı | `fortnox.oauth.ts` yetkilendirme kod akışını uygular. Temel uçlar: `https://apps.fortnox.se/oauth-v1/auth` ve `oauth-v1/token`. |
| 3.2 | **Authorization-Code Tek Kullanımlık & 10 Dk Ömür:** Auth code'un 10 dakika içinde takas edilmesi ve ikinci kez denenmemesi. | ✅ Karşılandı | Tek kullanımlık kod mantığı kilitlendi. İkinci denemede takas yapılmaz, `OAuthAuthorizationCodeExpiredError` döner. |
| 3.3 | **CSRF ve Nonce (`state`) Koruması:** `state` parametresinin kriptografik rastgelelikte üretilmesi, doğrulanması ve ömrünün auth code'dan kısa (<10 dk) olması. | ✅ Karşılandı | `fortnox.oauth.ts` 8 dakikalık TTL ile tek kullanımlık nonce üretir. İkinci callback veya süresi dolan nonce doğrudan reddedilir. |
| 3.4 | **Access Token Ömrü (1 Saat):** Süresi biten access token ile istek atılmaması, otomatik yenileme tetiklenmesi. | ✅ Karşılandı | `AccountingTokenStore` ve `fortnox.oauth.ts` access token'ı 3600 saniye TTL ile takip eder; dolmadan önce sessizce yeniler. |
| 3.5 | **Refresh Token Rotasyonu & Sıfır Tolerans:** Her yenilemede YENİ refresh token dönmesi ve eski token'ın ANINDA geçersiz olması (`previousTokenGraceMs = 0`). | ✅ Karşılandı | `RefreshSemantics`: `rotatesOnRefresh: true`, `previousTokenGraceMs: 0`. Sage kalıbı: Önce yeni token DB'ye yazılır, sonra isteğe devam edilir. |
| 3.6 | **Hareketsizlik Limiti (45 Gün) & Canlı Tutma:** 45 gün boyunca yenilenmeyen token zincirinin ölmesi. | ✅ Karşılandı | `inactivityLimitDays: 45`. KroptOS arka plan canlı tutma periyodu ~14 gün olarak kurgulanmıştır (limitin 1/3'ü). |
| 3.7 | **Eski Token Kullanımı Yıkıcıdır (`staleTokenUseIsDestructive: true`):** Eski veya geçersiz refresh token kullanıldığında zincirin kurtarılamaması, kullanıcının yeniden yetkilendirmeye zorlanması. | ✅ Karşılandı | `staleTokenUseIsDestructive: true`. Eski refresh token ile asla tekrar denenmez; doğrudan `reauthorization_required` durumuna alınır. |
| 3.8 | **En Az Yetki İlkesi (Least Privilege Scopes):** Kaynak başına hem okuma hem yazma verildiği için yalnızca ihtiyaç duyulan scope'ların istenmesi. | ✅ Karşılandı | Yalnızca `invoice`, `customer`, `article`, `payment`, `bookkeeping` istenir. `salary`, `companyinformation` vb. alakasız scope'lar kesinlikle talep edilmez. |

---

## 4. Trafik Disiplini & Rate Limiting

| No | Kriter / Fortnox Maddesi | Durum | KroptOS Karşılığı / Gerekçe |
|---|---|:---:|---|
| 4.1 | **5 Saniyelik Kayan Pencere Kısıtı (25 istek / 5 sn):** Fortnox dakikalık ortalama değil, 5 saniyelik bloklarda 25 istek sınırını uygular (300 req/dk). Saniyede 5 diye düzlenemez. | ✅ Karşılandı | `fortnox.window-limiter.ts` milisaniye hassasiyetli kayan pencere (sliding window bucket) algoritmasıyla 5000 ms pencerede en fazla 25 istek geçirir. 26. istek pencere kayana kadar bekletilir. |
| 4.2 | **HTTP 429 Aşımında `Retry-After` Header Desteği:** 429 yanıtı geldiğinde başlıkta belirtilen süreye riayet edilmesi. | ✅ Karşılandı | `fortnox.client.ts` 429 yanıtında `Retry-After` başlığını okur ve belirtilen saniye kadar bekler. |
| 4.3 | **Üstel Geri Çekilme ve Jitter (Exponential Backoff + Jitter):** `Retry-After` eksikse veya 5xx sunucu hatalarında agresif tekrar yerine güvenli bekleme. | ✅ Karşılandı | Lexware kalıbı: Rastgele jitter eklenmiş üstel geri çekilme (`baseMs * 2^attempt + jitter`). |
| 4.4 | **Kapsam İzolasyonu (Tenant vs Client):** Fortnox limiti hem Client-ID hem Tenant bazlı uygular. | ✅ Karşılandı | Çok kiracılı KroptOS'ta kiracı başına ayrı kayan pencere kısıtlayıcısı çalıştırılır. |
| 4.5 | **Zorunlu İstek Başlıkları:** `Authorization: Bearer <token>`, `Accept: application/json`, `Content-Type: application/json`. | ✅ Karşılandı | `fortnox.client.ts` her istekte standart başlıkları zorunlu kılar. Eski `Client-Secret` başlığı asla istek gövdesine veya header'ına eklenmez. |

---

## 5. Veri Bütünlüğü, Fatura & Değişmezlik

| No | Kriter / Fortnox Maddesi | Durum | KroptOS Karşılığı / Gerekçe |
|---|---|:---:|---|
| 5.1 | **Taslak → Mutabakat → Kaydet (Bookkeep) Akışı:** Faturanın önce taslak oluşması, geri okunması, mutabakat sağlanması ve ardından deftere kaydedilmesi. | ✅ Karşılandı | `fortnox.invoice-flow.ts`: 1. Idempotency claim -> 2. `POST /3/invoices` -> 3. Geri oku -> 4. Tutar/para birimi mutabakatı (fark ≤ 0.05) -> 5. `PUT /3/invoices/{id}/bookkeep`. |
| 5.2 | **Mutabakat Uyuşmazlığında Kaydetmeme:** Sunucunun hesapladığı toplam ile sipariş toplamı uyuşmuyorsa fatura kesinleştirilmez. | ✅ Karşılandı | Tutar farkında fatura `pending` (kaydedilmemiş) bırakılır, operatöre uyarı ve fark tutarı gösterilir. |
| 5.3 | **Kaydedilmiş Fatura Değiştirilemez (Immutability):** İsveç Muhasebe Kanunu (Bokföringslagen) gereği kaydedilmiş (`Booked: true`) fatura güncellenemez veya doğrudan silinemez. | ✅ Karşılandı | `fortnox.connector.ts` ve akış motoru kaydedilmiş faturayı güncellemeye veya silmeye çalışmaz. |
| 5.4 | **Düzeltme Yolu Alacak Faturasıdır (Credit Invoice):** Hatalı veya iade faturası `PUT /3/invoices/{id}/credit` ile ters kayıt oluşturularak kapatılır. | ✅ Karşılandı | İptal/iade senaryosunda kredi faturası yolu kurgulandı. |
| 5.5 | **İptal Öncesi Güncel Durum Okuma:** Fatura iptal edilmeden önce mutlaka güncel Fortnox durumu okunur. | ✅ Karşılandı | Uygunluk kuralı 8. uygulama: `status-mapper` ve connector işlem öncesi güncel belge durumunu teyit eder. |
| 5.6 | **E-posta ve Yazdırma Uçları KESİNLİKLE ÇAĞRILMAZ:** `.../email` ve `.../print` uçlarına otomatik çağrı yapılması müşteriye mükerrer/hatalı bildirim riski taşır. | ⛔ Yasaklandı / Karşılandı | Güvenlik kuralı: `/email` ve `/print` uçları engellendi; hiçbir client metodunda çağrılmaz. Gönderim Fortnox arayüzünden manuel yapılır. |
| 5.7 | **E-Fatura (PEPPOL / İsveç e-revisering):** e-fatura altyapısına doğrudan gönderim. | 🚫 Kapsam Dışı | İsveç iç pazarındaki e-fatura taşıyıcıları kapsam dışıdır; Türk e-Fatura / e-Arşiv kavramı İsveç'e taşınmaz. |
| 5.8 | **Dış Referans Eşlemesi (`YourOrderNumber`):** KroptOS sipariş numarası Fortnox'un `YourOrderNumber` alanına yazılır. | ✅ Karşılandı | `request-mapper` sipariş numarasını `YourOrderNumber` ve `Comments` alanlarına işler. |

---

## 6. Mali Yıl & Muhasebe Kuralları

| No | Kriter / Fortnox Maddesi | Durum | KroptOS Karşılığı / Gerekçe |
|---|---|:---:|---|
| 6.1 | **Fatura Tarihine Uygun Mali Yıl Doğrulaması:** Fatura tarihi için açık bir mali yıl bulunmalıdır (`GET /3/financialyears/?date={date}`). | ✅ Karşılandı | `fortnox.financial-year.ts`: Fatura gönderilmeden önce tarih sorgulanır; açık mali yıl yoksa fatura durdurulur. |
| 6.2 | **Mali Yılı Sistem Oluşturmaz:** Eksik mali yıl otomatik açılmaya çalışılmaz (muhasebeci sorumluluğundadır). | ✅ Karşılandı | KroptOS asla mali yıl oluşturma isteği atmaz. Eksiklik durumunda operatöre açıklayıcı hata verir: *"Fortnox'ta bu tarih için açık bir mali yıl tanımlı değil"*. |
| 6.3 | **Para Birimi & KDV Yapısı:** İsveç kronu (SEK) ve İsveç KDV dilimleri (%25, %12, %6, %0). | ✅ Karşılandı | Türk KDV mantığı uygulanmaz; `request-mapper` İsveç KDV yapısına ve Fortnox satır formatına (`VAT`, `AccountNumber`) uygun eşler. |
| 6.4 | **Bookkeeping Yetkisi:** Mali yıl kontrolü ve fatura kaydı (bookkeep) için `bookkeeping` scope'unun varlığı. | ✅ Karşılandı | İstenen scope'lara `bookkeeping` eklenmiş ve gerekçesi belgelenmiştir. |

---

## 7. Hata Yönetimi & Maskeleme

| No | Kriter / Fortnox Maddesi | Durum | KroptOS Karşılığı / Gerekçe |
|---|---|:---:|---|
| 7.1 | **Fortnox Hata JSON Yapısının Eşlenmesi:** `{ ErrorInformation: { code, message, error } }` gövdesinin yakalanması. | ✅ Karşılandı | `fortnox.error-mapper.ts` Fortnox hata formatını KroptOS domain hatalarına (`AccountingError`) çevirir. |
| 7.2 | **Kritik Sırların Maskelenmesi:** Token, Client Secret, Auth Code, Authorization başlıklarının loglara ve hata mesajlarına sızmaması. | ✅ Karşılandı | Maskeleme fonksiyonu tüm gizli anahtarları `***` ile filtreler; audit loglarında ve cevaplarda sır yer almaz. |
| 7.3 | **Bilinmeyen Durumların Muhafazakâr Eşlenmesi:** Fortnox'tan dönen tanımsız veya yeni durumların asla `sent`/`cancelled` yapılmaması. | ✅ Karşılandı | `fortnox.status-mapper.ts` yalnızca teyitli durumları eşler; bilinmeyen her şey güvenli tarafta kalarak `pending` olarak işaretlenir. |
| 7.4 | **Referansla Arama & Timeout Retry:** `findByReference` uçtan uca doğrulanmadıkça timeout retry açılmaması. | ✅ Karşılandı | Doğrulama yapılana kadar timeout retry kapalı tutulur; claim takılması durumunda manuel operatör çözümü esastır. |
| 7.5 | **Bağlantı Hatası Tespiti (401 Unauthorized):** Token süresi dolduğunda veya iptal edildiğinde yeniden yetkilendirme bayrağının set edilmesi. | ✅ Karşılandı | 401 yanıtları `AccountingAuthError` olarak ele alınır ve `reauthorization_required` durumuna geçirir. |

---

## 8. Pazaryeri, Yayın Modeli & Ticari Hazırlık

| No | Kriter / Fortnox Maddesi | Durum | KroptOS Karşılığı / Gerekçe |
|---|---|:---:|---|
| 8.1 | **Yayın Modeli Seçimi (Purchasable vs Activatable):** Entegrasyonun Fortnox üzerinden mi yoksa doğrudan KroptOS üzerinden mi satılacağı/açılacağı. | ⚖ Karar Aşamasında | Kodda varsayım yapılmamıştır. Her iki modelin onboarding ve UI etkileri `README.md` belgesinde analiz edilmiş, nihai karar ürün sahibine bırakılmıştır. |
| 8.2 | **Pazaryeri Varlıkları (Logo, İkon, Banner):** Fortnox marka kurallarına uygun görsel varlıkların hazırlanması. | ⏳ Sonraki Faz | Pazaryeri başvurusu sırasında tasarım ekibi tarafından sağlanacaktır. |
| 8.3 | **Landing Page ve Kurulum Dokümantasyonu:** Müşterilere yönelik İsveççe/İngilizce entegrasyon tanıtım ve kurulum sayfası. | ⏳ Sonraki Faz | Pazaryeri başvurusu öncesinde pazarlama tarafından yayına alınacaktır. |
| 8.4 | **Destek & İletişim Bilgileri (SLA):** Fortnox kullanıcıları için destek e-postası, çalışma saatleri ve SLA tanımları. | ⏳ Sonraki Faz | Ticari yayın aşamasında portal profiline girilecektir. |
| 8.5 | **Güvenlik & Gizlilik Beyanı:** GDPR ve veri işleme ilkelerine uyumluluk beyanı. | ✅ Karşılandı | KroptOS tenant izolasyonu, veri maskeleme ve en az yetki ilkeleri teknik olarak tam uyumludur. |

---

## Çelişki ve Uyum Raporu

Kontrol listesinde yer alan hiçbir madde KroptOS'un temel mimari kurallarıyla (tenant izolasyonu, idempotency claim, hata maskeleme, sıfır toleranslı rotasyon) **çelişmemektedir**. Bilakis:
1. Fortnox'un **5 saniyede 25 istek** kuralı, gevşek ortalama limiter'lar yerine milisaniyelik `fortnox.window-limiter.ts` ile KroptOS mimarisini daha da güçlendirmiştir.
2. Fortnox'un **tek kullanımlık 10 dakikalık auth code** ve **anında ölen refresh token** yapısı, KroptOS'un Sage turunda kurulan `rotatesOnRefresh: true, previousTokenGraceMs: 0` profiliyle birebir örtüşmektedir.
3. Fortnox'un **kaydedilmiş faturanın değiştirilemezliği (immutability)** kuralı, KroptOS'un taslak→mutabakat→kaydet ve alacak faturası düzeltme kalıbıyla tam uyumludur.
4. Fortnox'un sunduğu e-posta/yazdırma uçları, KroptOS güvenlik kuralları gereğince **bilerek ve isteyerek engellenmiştir**; faturanın kontrolsüz biçimde müşteriye gitmesi engellenmiştir.
