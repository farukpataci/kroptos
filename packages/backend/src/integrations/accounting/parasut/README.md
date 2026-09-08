# Paraşüt Muhasebe Entegrasyonu (Faz 1)

Bu modül, KroptOS platformunun **Paraşüt** muhasebe/ön muhasebe sistemiyle entegrasyonunu sağlar.

## Hazırlık Durumu (Readiness)
- **Hedef Seviye:** `MOCK_READY`
- **Ağ İsteği:** Gerçek ağ istekleri (`TEST_READY`, `PRODUCTION_READY`) canlı credential doğrulaması yapılana kadar engellenmiştir ve `IntegrationNotVerifiedError` fırlatır.
- **Mock Motoru:** `ParasutMockClient` ile tüm fatura, tahsilat, cari ve ürün eşleme akışları bellek içi deterministik olarak simüle edilir.

## Kapsamdaki Akışlar
1. **Satış Faturası (KroptOS → Paraşüt):** Rezervasyon öncelikli (claim-first) çifte faturalandırma korumalı fatura kaydı.
2. **Tahsilat Kaydı:** Fatura referansıyla ödeme kaydı.
3. **Cari Eşleme:** Vergi No / TC No -> E-posta -> Telefon öncelikli tekil anahtar (`kroptosKey`) ile cari senkronizasyonu.
4. **Ürün Eşleme:** SKU bazlı ürün kod eşleştirmesi.

## Kapsam Dışı
- **Stok Senkronizasyonu:** Paraşüt ön muhasebe sistemidir; depo/stok merkezi değildir. Stok senkronizasyonu kesinlikle yapılmaz (`stockSync: NOT_SUPPORTED`).
- **Resmi E-Fatura/E-Arşiv Gönderimi:** GİB portalına resmi fatura iletimi Faz 1 dışındadır; yalnızca fatura taslağı/kaydı oluşturulur.
