# KroptOS — SAP S/4HANA Cloud (Public Edition)
# Faz 0: Keşif ve Karar Dokümanı (Fit-Gap Analizi)

**Doküman Sürümü:** 1.0.0  
**Tarih:** 2026-09-08  
**Durum:** Faz 0 Tamamlandı — Karar ve Onay Bekliyor (KOD YAZILMADI)  
**Hedef Kapsam:** `sap-s4hana-cloud` (S/4HANA Cloud, public edition)  
**Kapsam Dışı:** `sap-s4hana-onprem` (Private Cloud / On-Premise — ayrı mimari ve kimlik modeli)

---

## 0. Yönetici Özeti ve Kapsam Sınırı

KroptOS araştırma matrisinde (`claude/08_MUHASEBE_BAGLANTI_MATRISI.md`) belirtildiği üzere:
> *"Doküman en zengini ama proje en pahalısı: her müşteride ayrı özelleştirme, ayrı hesap planı, ayrı danışman. Bu bir connector değil, bir uygulama projesi. İlk fazın dışında."*

Şu anda repoda canlı veya test amaçlı gerçek bir SAP müşterisi **bulunmamaktadır.** SAP sistemine fatura ve muhasebe kaydı atan kodun büyük çoğunluğu müşterinin organizasyonel yapısına (şirket kodu, hesap planı, GL hesabı, vergi kodu, defter, satış organizasyonu) göbekten bağlıdır. Müşteri olmadan bu kodları yazmak, doğrulanamayan varsayımları koda gömmek anlamına gelecektir.

Bu doğrultuda:
1. **Faz 0'ın teslimatı bu dokümandır; tek satır kod üretilmemiştir.**
2. **Faz 1 yalnızca Business Partner OKUMA yapan dar bir dikey dilimdir.** Fatura yazma, cari yazma, ürün yazma, tahsilat bu turun tamamen dışındadır.
3. **Faz 2 (yazma) bu turda açılmaz.** Gerçek bir müşteri ve FI/SD danışman onayı olmadan yazma fazına geçilemez.

---

## 1. Fatura Yolu Karşılaştırması (Dokümanın Kalbi)

SAP S/4HANA Cloud sisteminde dış bir e-ticaret platformundan satış faturasını muhasebeleştirmenin iki ana yolu bulunmaktadır:
1. **Finans (FI) Yolu:** Journal Entry - Post (Doğrudan Muhasebe / Yevmiye Kaydı)
2. **Satış ve Dağıtım (SD) Yolu:** Siparişten Faturalamaya Tam Satış Akışı (Sales Order → Delivery → Goods Issue → Billing Document)

Aşağıdaki tablo iki yaklaşımın teknik ve operasyonel karşılaştırmasını sunmaktadır:

| Kriter | Yol 1: Journal Entry – Post (FI) | Yol 2: Satış Akışı (SD: Sales Order → Delivery → Billing) |
| :--- | :--- | :--- |
| **Hangi API / Servis** | **SOAP:** `JournalEntryCreateRequestConfirmation_In` (Senkron)<br>**SOAP:** `JournalEntryBulkCreationRequest_In` (Asenkron)<br>*Kaynak:* [SAP Hub - Journal Entry Post](https://api.sap.com/api/JOURNALENTRYCREATEREQUESTCONFIR/overview) | **OData v2:** `API_SALES_ORDER_SRV` (Sipariş)<br>**OData v2:** `API_OUTBOUND_DELIVERY_SRV_0002` (İrsaliye)<br>**OData v2:** `API_BILLING_DOCUMENT_SRV` (Okuma/İptal)<br>*Kaynak:* [SAP Hub - Sales Order](https://api.sap.com/api/API_SALES_ORDER_SRV/overview), [Billing Document](https://api.sap.com/api/API_BILLING_DOCUMENT_SRV/overview) |
| **Senkron / Asenkron** | İki ayrı sürümü mevcuttur. Düşük hacimlerde senkron, toplu aktarımlarda asenkron tercih edilir. | Sipariş oluşturma senkron (OData POST), ancak sevkiyat ve faturalama adımları SAP arka plan işleriyle (Batch Job) asenkron işletilir. |
| **Gereken Communication Scenario** | **`SAP_COM_0002`** (Finance - Posting Integration)<br>*Kaynak:* [SAP Help - SAP_COM_0002](https://help.sap.com/docs/SAP_S4HANA_CLOUD/031c345485d847859342e33e4b8181da/2a08892f33c34bb9a98ef732dc666879.html) | **`SAP_COM_0109`** (Sales Order Integration)<br>**`SAP_COM_0120`** (Billing Integration)<br>**`SAP_COM_0108`** (Outbound Delivery Integration) |
| **Müşteri Tarafında Gereken Yapılandırma** | Şirket Kodu (`CompanyCode`), Defter (`Ledger`, örn: `0L`), Belge Türü (`DocumentType`, örn: `DR`), Mutabakat GL Hesabı, Gelir GL Hesabı, Vergi Kodları (`TaxCode`). | Satış Org (`SalesOrg`), Dağıtım Kanalı (`DistrChannel`), Bölüm (`Division`), Fiyatlandırma Prosedürü (`Pricing Procedure`), Sevkiyat Noktası, Malzeme Ana Verisi (SD görünümü). |
| **KroptOS'ta Hangi Veri Gerekiyor?** | Sipariş No, Tutar, KDV Oranı, Müşteri Bilgisi (Bizde var).<br>GL Hesapları ve Vergi Kodları (KroptOS'ta doğrudan yok; eşleme gerektirir). | Sipariş No, Müşteri, Kalemler (Bizde var).<br>Kurumsal SD Hiyerarşisi, Malzeme Kodları, Ödeme Şartları, Fiyat Koşulları (KroptOS'ta YOK). |
| **Kim Sahiplenir?** | FI (Finans) Ekibi / FI Danışmanı | SD (Satış & Dağıtım) Ekibi, Depo/Lojistik Ekibi, FI Ekibi |
| **Belge İptali / Düzeltme** | Ters Kayıt (Reversal) ile yapılır (`JournalEntryReverseRequestConfirmation_In` veya Fiori `Manage Journal Entries` üzerinden manuel). | Çok adımlı ters işlem: Fatura İptali → Mal Çıkışı Ters Kaydı → Teslimat Silme → Sipariş Reddetme. Tek bir adım kilitlenirse fatura düzeltilemez. |
| **Idempotency Nasıl Sağlanır?** | `OriginalReferenceDocument` ve `Reference1IDByBusinessPartner` (BKPF-XBLNR). SAP, aynı referans için mükerrer kontrolü yapar. | Sipariş başlığında `PurchaseOrderByCustomer` (Müşteri Sipariş No) alanı üzerinden `$filter` ile kontrol. |
| **Çift Kayıt Riski ve Tespiti** | Ağ hatasında OData `Operational Journal Entry Item - Read` servisi ile referans sorgulanabilir. | Akış çok adımlı olduğundan sipariş açılsa dahi faturanın oluşup oluşmadığı anlık tespit edilemez; faturalama kuyruğu beklenir. |
| **Vergi Hesabı Kimde?** | KroptOS vergi tutarını hesaplayıp `Tax` segmentinde gönderebilir veya SAP FI otomatik vergi (`calculateTax`) ile hesaplatılabilir. | SAP SD Fiyatlandırma Prosedürü (`MWST` koşulu) tarafından hesaplanır. KroptOS ile kuruş farkı çıkarsa sipariş blokeye düşer (`Incomplete`). |
| **Uygulama Maliyeti** | **Orta.** Doğrudan defter kaydı atar. Stok hareketi yapmaz. | **Çok Yüksek.** Aylar süren SD/MM/FI danışmanlığı, uçtan uca konfigürasyon ve malzeme senkronizasyonu gerektirir. |

### Gerekçeli Öneri:
> **ÖNERİ: Finans (FI) Yolu (`Journal Entry - Post`, Senaryo: `SAP_COM_0002`) tercih edilmelidir.**
> 
> **Gerekçe:** KroptOS e-ticaret sipariş, kargo, stok ve iade süreçlerini kendi altyapısında ve pazar yeri entegrasyonlarında zaten yönetmektedir. E-ticaret entegratörlerinde SAP'tan temel beklenti genel muhasebe/defteri kebir kayıtlarının doğru oluşmasıdır. SD akışını kurmak, her ürün için SAP malzeme kartı açmayı, satış organizasyonu ve sevkiyat noktası gibi e-ticaretle doğrudan ilgisi olmayan onlarca kurumsal alanı yönetmeyi zorunlu kılar.
> 
> **Bilinmeyenler:** Müşterinin Türkiye e-Fatura/e-Arşiv regülasyonunu SAP DRC (Document and Reporting Compliance) üzerinden mi yürüttüğü, DRC'nin FI belgeleri üzerinden tetiklenip tetiklenemediği.

---

## 2. Cari (Business Partner) Fit-Gap

- **Kanonik OData Servisi:** `API_BUSINESS_PARTNER` (OData v2)  
  *Kaynak:* [SAP Business Accelerator Hub - Business Partner (A2X)](https://api.sap.com/api/API_BUSINESS_PARTNER/overview)
- **Gereken Communication Scenario:** **`SAP_COM_0008`** (Business Partner, Customer and Supplier Integration)  
  *Kaynak:* [SAP Help - Communication Scenario SAP_COM_0008](https://help.sap.com/docs/SAP_S4HANA_CLOUD/031c345485d847859342e33e4b8181da/68e27c1f1b204cbb8f9212ad8f31952a.html)
- **KroptOS Müşterisi ↔ Business Partner Eşlemesi:**
  - `BusinessPartnerCategory`:
    - `1` = Kişi (B2C müşteri için `isCompany: false`)
    - `2` = Organizasyon (B2B müşteri için `isCompany: true`)
  - **Gereken Roller:**
    - Fatura kesebilmek için BP'nin `FLCU00` (FI Müşterisi / FI Customer) rolüne ve ilgili `CompanyCode` görünümüne sahip olması şarttır.
  - **Hesap Grubu ve Numaralandırma (`BusinessPartnerGrouping`):**
    - Müşterinin SAP sisteminde yapılandırılan kuraldır (Örn: `BP01`).
    - SAP'ta Business Partner numaraları kural olarak **SAP tarafından dahili olarak (Internal Number Range)** üretilir (Örn: `0001002345`).
  - **KroptOS `AccountingContactMapping` Yönü:**
    - KolayBi'de kullandığımız deterministik anahtar (`TCKN-12345678901` veya `VKN-1234567890`), SAP'ta doğrudan Business Partner ID yapılamaz.
    - KroptOS anahtarı SAP'ta `SearchTerm1` veya `BPTaxNumber` alanında tutulur. Eşleme yönü: KroptOS anahtarı → SAP tarafından üretilen dahili `BusinessPartner` numarası şeklindedir.
- **Zorunlu Alanlar ve KroptOS Uyumluluğu:**
  - Adres yapısı: KroptOS tek satır `address` metni tutarken, SAP `StreetName`, `HouseNumber`, `PostalCode`, `CityName`, `Country` alanlarını yapısal olarak bekler.
  - Vergi Numarası: `A_BusinessPartnerTaxNumber` alt tablosunda `BPTaxType` (Örn: Türkiye için `TR1` VKN, `TR2` TCKN) ile tutulur.

---

## 3. Ürün (Product/Material) Fit-Gap

- **SAP Ürün Modeli:** `API_PRODUCT_SRV` (`SAP_COM_0009`).
- **Gerçek:** Kurumsal SAP kurulumlarında Master Data Governance (MDG) kuralları gereği harici bir e-ticaret platformunun SAP'a malzeme/ürün kartı yazması **kesinlikle yasaktır.**
- **Eksik Alanlar:** SAP malzeme kartı açabilmek için Malzeme Türü (`ProductType`, örn: `HAWA`), Mal Grubu (`ProductGroup`), Temel Ölçü Birimi (`BaseUnit`, ISO değil dahili kod: `PCE`, `MTR`), Değerleme Sınıfı (`ValuationClass`) ve Kâr Merkezi zorunludur. KroptOS'ta bu veriler bulunmaz.
- **Sonuç:** SAP entegrasyonunda ürün oluşturma (`productMapping` / write) `NOT_SUPPORTED` olmalıdır. Ürünler SAP'ta açılır, KroptOS yalnızca SKU üzerinden eşleştirme yapar.

---

## 4. Tahsilat — Dürüst Değerlendirme

- **S/4HANA Cloud'da doğrudan "tahsilat oluşturma" REST API'si var mıdır?**
  - **HAYIR, YOKTUR.**
  - *Kaynak:* SAP S/4HANA Cloud Finance modülünde müşteri ödemesi bir "Açık Kalem Denkleştirme" (`Clearing` / `Post Incoming Payment`) işlemidir.
  - Tahsilat, ya elektronik banka ekstresi entegrasyonu (`CAMT.053` / `MT940`) ile otomatik olarak ya da muhasebeci tarafından Fiori `Clear Outgoing Payments` / `Post Incoming Payments` ekranlarında açık fatura seçilerek yapılır.
  - Dış sistemden doğrudan "ödeme yapıldı" kaydı atmak için basit bir API bulunmamaktadır.
  - **Karar:** KroptOS üzerinde `payment` yeteneği SAP için `NOT_SUPPORTED` olmalıdır; uydurma bir ara yöntem önerilmemelidir.

---

## 5. Müşteriye Özel Yapılandırma Envanteri

Aşağıdaki parametreler **her SAP müşterisinde farklıdır ve koda asla gömülemez:**

1. `CompanyCode` (Şirket Kodu — Örn: `1010`)
2. `ChartOfAccounts` (Hesap Planı — Örn: `YCOA`)
3. `Ledger` (Defter Grubu — Örn: `0L` Leading Ledger)
4. `DocumentType` (Belge Türü — Örn: `DR` Müşteri Faturası)
5. `ReconciliationGLAccount` (Müşteri Mutabakat Hesabı — Örn: `12001000`)
6. `RevenueGLAccount` (Satış/Gelir Hesabı — Örn: `60001000`)
7. `TaxCodes` (KDV Göstergeleri — Örn: %20 -> `A3`, %10 -> `A2`, %1 -> `A1`, %0 -> `A0`)
8. `CostCenter` / `ProfitCenter` (Masraf Merkezi / Kâr Merkezi)
9. `BusinessPartnerGrouping` (Cari Numaralandırma Grubu — Örn: `BP01`)
10. `PaymentTerms` (Ödeme Koşulları — Örn: `0001`)

### Bu Bilgiler KroptOS'ta Nerede Durur?
- KroptOS Prisma şemasındaki `AccountingCompany.defaultAccountCodes` (Json) alanı bu parametrelerin esnek ve müşteri bazlı saklanması için uygundur:
  ```json
  {
    "companyCode": "1010",
    "ledger": "0L",
    "documentType": "DR",
    "reconciliationAccount": "12001000",
    "revenueAccount": "60001000",
    "costCenter": "10101101",
    "profitCenter": "YB101",
    "taxCodes": {
      "20": "A3",
      "10": "A2",
      "1": "A1",
      "0": "A0"
    }
  }
  ```
- **Öneri:** Faz 1 için yeni tablo gerekmez; `defaultAccountCodes` yeterlidir. Faz 2'de pazar yeri bazlı GL hesabı ayrıştırması gerekirse ayrı bir `AccountingAccountMapping` tablosu tasarlanabilir.

---

## 6. Kimlik ve Erişim Ön Koşulları

- **Müşteri Kiracısında Kurulum Sırası:**
  1. `Maintain Communication Users`: Teknik entegrasyon kullanıcısı tanımlanır.
  2. `Communication Systems`: Dış sistem (KroptOS) tanımlanır, kimlik yöntemi (Kullanıcı Adı/Şifre veya OAuth2 Client Credentials) atanır.
  3. `Communication Arrangements`: İlgili senaryolar (`SAP_COM_0008`, `SAP_COM_0002`) aktive edilir. Bu işlem sonucunda müşteri kiracısına özel endpoint URL'leri oluşur.
- **Desteklenen Ortamlar:**
  - **SANDBOX:** `https://sandbox.api.sap.com` (Genel SAP geliştirici ortamı, `APIKey` header'ı ile erişilir).
  - **MÜŞTERİ KİRACISI:** `https://<tenant>-api.s4hana.ondemand.com` (Temel Kimlik Doğrulama veya OAuth 2.0).

---

## 7. Operasyonel Gerçekler

- **CSRF Token:** SAP OData servislerinde veri yazan/değiştiren tüm çağrılar (POST/PATCH/DELETE) için **CSRF token zorunludur.** İstemci önce bir GET isteği ile `x-csrf-token: fetch` gönderir, dönen token ve oturum çerezleri (`set-cookie`) sonraki istekte iletilir. Yalnızca GET (okuma) isteklerinde CSRF gerekmez.
- **Asenkron Doğrulama:** SOAP `JournalEntryBulkCreationRequest_In` çağrısı anında HTTP 202/ACK döner, deftere yazma işlemi asenkron arka planda gerçekleşir. Hata veya başarı takibi için sorgulama mekanizması kurulmalıdır.
- **Lokalizasyon / E-Belge:** SAP Türkiye e-Fatura/e-Arşiv süreçleri SAP DRC (Document and Reporting Compliance) veya aracı entegratör eklentileriyle yönetilir. KroptOS'un SAP'a fatura yazması e-belge üretimini kendiliğinden sağlamaz; bu tamamen SAP tarafındaki FI konfigürasyonunun konusudur.

---

## 8. Karar Kapısı

1. **Fatura hangi yoldan?**
   - **Karar:** Finans (FI) Journal Entry yolu (`SAP_COM_0002`). SD akışı aşırı maliyetli ve gereksizdir.
2. **Gerçek bir müşteri olmadan Faz 2'nin ne kadarı yazılabilir?**
   - **Dürüst Cevap: %0.** GL hesapları, vergi kodları ve şirket kodu eşlemeleri gerçek bir SAP kiracısı ve test verisi olmadan doğrulanamaz. Varsayımlarla kod yazılmamalıdır.
3. **Müşteri Geldiğinde İlk Gün Sorulacak Sorular Listesi:**
   - Hangi S/4HANA sürümünü kullanıyorsunuz? (Public Edition / Private Cloud / On-Premise)
   - Satış faturaları FI Journal Entry olarak mı yoksa SD Faturası olarak mı muhasebeleştirilecek?
   - Şirket Kodu (`CompanyCode`), Defter (`Ledger`) ve Belge Türü (`DocumentType`) nedir?
   - B2C siparişler için toplu muhtelif cari mi açılacak, yoksa her müşteri için ayrı Business Partner mi açılacak?
   - Satış gelirleri ve KDV için GL hesap kodları ve SAP vergi göstergeleri (`Tax Codes`) nelerdir?
   - KroptOS için Communication Arrangement (`SAP_COM_0008` ve `SAP_COM_0002`) tanımlanıp teknik kullanıcı bilgileri sağlanabilir mi?
