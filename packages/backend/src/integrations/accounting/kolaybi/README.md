# KolayBi' Muhasebe Entegrasyonu (Faz 1)

Bu modül KroptOS muhasebe altyapısının **KolayBi'** entegrasyonudur.

## Entegrasyon Durumu

- **Hazırlık Seviyesi:** `MOCK_READY`
- **Ağ Durumu:** Sıfır gerçek ağ isteği. `TEST` veya `PRODUCTION` ortamlarında `IntegrationNotVerifiedError` fırlatılır.
- **Protokol:** REST API (JSON / x-www-form-urlencoded)

## Kapsamdaki 4 Akış

1. **Satış Faturası Oluşturma (`sales_invoice`):** KroptOS siparişlerinden KolayBi' faturası oluşturulur.
2. **Cari Senkronizasyonu (`contactSync`):** TCKN/VKN üzerinden cari kart oluşturma/eşleme.
3. **Ürün Eşleme (`productMapping`):** SKU bazlı ürün kartı eşleme.
4. **Tahsilat Kaydı (`payment`):** Faturaya bağlı ödeme/tahsilat kaydı oluşturma.

## Önemli İş Kuralları

- **Kanal / Firma Ayrımı (`Channel`):** KolayBi' isteklerinde firma yönlendirmesi `Channel` HTTP header'ı ile sağlanır. Bu değer her zaman güvenilir `AccountingCompany.externalCompanyId` üzerinden alınır.
- **TCKN/VKN Zorunluluğu:** KolayBi' fatura ve cari işlemlerinde kimlik numarası zorunludur. B2C siparişlerde TCKN bulunamazsa `AccountingCompany.defaultRetailContactId` kullanılır. İkisi de yoksa işlem reddedilir; **kesinlikle sahte TCKN (örn. 11111111111) üretilmez.**
- **Kapalı KDV Oranları:** Yalnızca `0, 1, 8, 10, 18, 20` KDV oranları kabul edilir.
- **Stok Senkronizasyonu:** `stockSync: NOT_SUPPORTED` olarak kesin kapsam dışıdır. (Not: KolayBi' ürün API'sinde `quantity` alanı mevcuttur, matris §2.4 güncellenmelidir.)
- **E-Fatura:** Bu fazda resmi e-fatura kesme/gönderme yoktur; yalnızca muhasebe fatura kaydı oluşturulur.
