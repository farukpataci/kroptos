# KroptOS — sevDesk Muhasebe Entegrasyonu

Almanya odaklı bulut muhasebe sistemi **sevDesk** (REST/JSON) entegrasyonu.

## 1. Hazırlık ve Durum
- **Hazırlık Seviyesi:** `MOCK_READY`
- **Dokümantasyon Durumu:** `PARTIAL`
- **supportsMock:** `true`
- **supportsTest:** `false` (Canlı kimlik bilgisi doğrulanana kadar ağ isteği korumalıdır)
- **supportsProduction:** `false` (Canlı kimlik bilgisi doğrulanana kadar ağ isteği korumalıdır)

## 2. Mimari ve Yaşam Döngüsü

### 2.1 §5.2 Taslak Başlama ve Güvenli Durum Kalıbı
- sevDesk API v1 üzerinde yeni faturalar zorunlu olarak **Draft (100)** olarak açılır (`Invoice/Factory/saveInvoice`).
- sevDesk'te yan etkisiz nötr bir "kesinleştir" (finalize) çağrısı **yoktur**:
  - `POST /Invoice/{id}/sendViaEmail` doğrudan müşteriye e-posta gönderir; **kesinlikle yasaktır ve kod tabanında bulunmaz.**
  - `PUT /Invoice/{id}/sendBy` gönderim yöntemini kaydeder ancak durumu 200 (Open) yapar.
- **KroptOS Tasarım Kararı:** KroptOS faturayı güvenli şekilde **Taslak (Draft 100)** olarak oluşturur, belge KroptOS'ta `pending` kalır ve operatöre `"fatura sevdesk'te taslak olarak oluşturuldu; kesinleştirme sevdesk üzerinden yapılmalıdır"` uyarısı gösterilir.

### 2.2 §2.3 Kimlik Doğrulama Başlığı
- `Authorization: <apiToken>`
- 32 karakterlik ham hexadecimal token taşır.
- **`Bearer` ÖNEKİ KESİNLİKLE KULLANILMAZ.**
- URL parametresi `?token=` Nisan 2025 itibarıyla kaldırılmıştır.

### 2.3 §5.3 `objectName` Zarfı
- sevDesk API'de tüm ilişkili nesneler `{ "id": <id>, "objectName": "<Tip>" }` zarfını gerektirir.
- Bu zarf yalnızca `createSevdeskRef` (`sevdesk.ref.ts`) yardımcısı üzerinden katı kontrollerle üretilir.

### 2.4 §4 Kullanıcıya Bağlı Token (Sessiz Ölüm Riski)
- sevDesk API token'ı organizasyona değil, ilgili **kullanıcı hesabına** bağlıdır.
- Kullanıcı silinirse veya pasifleştirilirse entegrasyon sessizce düşer.
- `GET /SevUser` ile token sahibi tespit edilip arayüzde açıkça gösterilir.
- `SevdeskHealthService` haftalık periyotlarla token sağlığını denetler.

### 2.5 §3 Token Deposu ve Yenileme Yok
- sevDesk API anahtarı statik ve süresizdir.
- `capabilities.refreshSemantics = undefined`.
- sevDesk `AccountingTokenStore`'a asla uğramaz.

### 2.6 §5.7 sevDesk'in Kendi DATEV Entegrasyonu
- sevDesk kendi sisteminde mali müşavir için DATEV CSV/XML ZIP dışa aktarımı sunar.
- Bu nedenle sevDesk kiracılarına KroptOS dahili DATEV EXTF üretimi önerilmez.
