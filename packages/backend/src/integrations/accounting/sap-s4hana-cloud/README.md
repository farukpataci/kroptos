# SAP S/4HANA Cloud (Public Edition) — Muhasebe Entegrasyonu

Bu modül, KroptOS muhasebe çatısı altında SAP S/4HANA Cloud (Public Edition) OData Business Partner entegrasyonunun Faz 1 (yalnızca okuma) dikey dilimini içerir.

> **Önemli Kapsam Notu:** Bu fazda fatura yazma, cari yazma, ürün yazma ve tahsilat işlemleri **kapsam dışıdır.** Ayrıntılı keşif ve karar raporu için [docs/plans/sap-s4hana-cloud-fit-gap.md](../../../../../../docs/plans/sap-s4hana-cloud-fit-gap.md) dokümanını inceleyiniz.

---

## 1. Yetenekler ve Kapsam

| Akış | Durum | Açıklama |
| :--- | :--- | :--- |
| **Cari Okuma (Business Partner Read)** | `SUPPORTED` (Mock/Sandbox) | `API_BUSINESS_PARTNER` OData v2 (`$filter`, `$top`, `$skip`). |
| **Cari Yazma (Contact Sync)** | `NOT_SUPPORTED` | Faz 1 kapsamı dışındadır (`NotImplementedException`). |
| **Satış Faturası** | `NOT_SUPPORTED` | Faz 2'ye ertelenmiştir (`NotImplementedException`). |
| **Ürün Eşleme / Yazma** | `NOT_SUPPORTED` | Harici ürün kaydı SAP kurumsal politikaları gereği desteklenmez. |
| **Tahsilat / Ödeme** | `NOT_SUPPORTED` | SAP'ta doğrudan REST tahsilat API'si bulunmamaktadır (Clearing gerektirir). |

---

## 2. Ortamlar

1. **MOCK:** Statik anonimleştirilmiş Business Partner fixture'ları (`__fixtures__/business-partners.fixture.json`).
2. **SANDBOX:** `https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER`. `APIKey` header'ı ile.
   - `SAP_SANDBOX_API_KEY` ortam değişkeni veya credential yoksa **sıfır ağ isteği** yapılır ve mock veriye dönülür.
3. **TEST:** Müşteri test ortamı (`IntegrationNotVerifiedError`, sıfır ağ isteği).
4. **PRODUCTION:** Müşteri canlı ortamı (`IntegrationNotVerifiedError`, sıfır ağ isteği).

---

## 3. Güvenlik

- `apiKey`, `password`, `clientSecret` alanları gizlidir (`secret: true`).
- API anahtarı loglara, audit kayıtlarına veya hata mesajlarına sızdırılmaz.
- `sap-s4hana-onprem` bu sağlayıcı altında değildir ve kayıt açılmamıştır.
