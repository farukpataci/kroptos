# Cegid XRP Flex Muhasebe Entegrasyonu (`MOCK_READY`)

Bu modül, Cegid XRP Flex ERP sisteminin KroptOS muhasebe entegrasyon ailesine bağlanmasını sağlar.

---

## 1. Mimari ve Doğrulama Kapısı Bulguları (§2, §3)

### §1.1. Cegid Ailesi ve Kol Ayrımı (Cegid BÖLÜNÜR)
Cegid markası altında birbirinden tamamen farklı üç ürün ve kimlik mimarisi bulunmaktadır:
- **Cegid XRP Flex (Bu Entegrasyon)**: Şirketin kendi işlettiği bulut ERP çözümü. Acumatica tabanlı REST v2 sözleşme mimarisine ve OAuth 2.0 Password Grant kimlik doğrulamasına sahiptir.
- **Cegid Loop**: Mali müşavir ve muhasebe bürosu (cabinet) tarafı. Ayrı bir sağlayıcıdır; bu modüle dahil edilmez.
- **Cegid Expert**: Muhasebe bürosu odaklı APIM modeli (API Key, Subscription Key, ConsumerId/Secret, SAAS Admin). **Bu model XRP Flex'in modeli DEĞİLDİR ve kesinlikle buraya taşınmaz.**

### §1.2. Acumatica Soyağacı Hipotezi: DOĞRULANDI
Cegid'in resmî örnek deposu (`cegid-io/cegid-xrp-flex-api-samples`, `GetToken.cs`, `Program.cs`, `XrpFlexConnection.cs`) incelenerek Acumatica Contract-Based REST API mimarisi teyit edilmiştir:
- Varlıklar sözleşme uçları üzerinden çağrılır: `/entity/{endpointName}/{endpointVersion}/{entityName}`
- JSON gövdelerinde her veri alanı `{ "value": ... }` sarıcısıyla iletilir.
- OData filtreleme ve genişletme parametreleri desteklenir (`$expand`, `$select`, `$filter`).

---

## 2. Ayrı Eksen: Fransa E-Fatura Reformu (PDP / Factur-X) (§4)

> [!WARNING]
> **HUKUKİ VE TEKNİK AYRIM**:
> Fransa B2B e-fatura reformu, yerel muhasebe belgesi oluşturmaktan tamamen bağımsız bir mali/hukuki süreçtir.
> Bu turda **hiçbir e-fatura / PDP / Factur-X kodu yazılmamıştır** ve kullanıcı arayüzünde "e-fatura" ifadesi kullanılmaz.

### Mevzuat ve Takvim (Ordonnance n°2021-1190 & Uygulama Kararnameleri)
Fransa'da B2B işlemler için elektronik fatura zorunluluğu aşağıdaki takvimle kademeli olarak yürürlüğe girmektedir:
1. **1 Eylül 2026**:
   - **Elektronik Fatura Kabul/Alma Zorunluluğu (Tüm İşletmeler)**: Fransa'daki tüm KDV mükellefi işletmeler (Büyük işletmeler, ETI, KOBİ/PME, TPE ve mikro-işletmeler) elektronik fatura alma ve işleme kapasitesine sahip olmak zorundadır.
   - **Elektronik Fatura Düzenleme/Gönderme Zorunluluğu (Büyük İşletmeler ve ETI'ler)**: Belirlenen standart formatlarda (Factur-X, UBL, CII) fatura düzenlemekle yükümlüdürler.
2. **1 Eylül 2027**:
   - **Elektronik Fatura Düzenleme/Gönderme Zorunluluğu (KOBİ / PME, TPE ve Mikro İşletmeler)**: Tüm küçük ve orta ölçekli işletmeler için resmi e-fatura düzenleme zorunlu hale gelir.
   - **E-Reporting Zorunluluğu**: B2C satışları ve uluslararası işlemler için işlem verisi bildirimi zorunlu hale gelir.

### XRP Flex ve Platform Mimarisi
Akış, onaylı özel platformlar (**PDP** - Plateforme de Dématérialisation Partenaire) veya kamu portalı (**PPF** - Portail Public de Facturation) üzerinden gerçekleştirilir. ERP içerisindeki fatura belgesinin PDP'ye aktarımı müşterinin seçtiği PDP sağlayıcısına ve portal yapılandırmasına bağlıdır.

---

## 3. Hesap Planı ve Mali Müşavir Rolü (§4.1)

Fransa'da hesap planı (Plan Comptable Général - PCG), günlükler (journaux) ve TVA vergi kodları şirketlerin mali müşavirleri (**expert-comptable**) tarafından belirlenir.
- Gelir hesapları ve TVA kodları koda gömülmez.
- `AccountingCompany.defaultAccountCodes` JSON alanı üzerinden firma bazında saklanır.
- Gelir hesabı seçilmeden fatura oluşturulması engellenir.

---

## 4. Fatura Yaşam Döngüsü ve Mutabakat (§6.4)

Cegid XRP Flex fatura akışı `ms-dynamics-bc-online` ve `visma-net-erp` ile aynı güvenli mutabakat disiplinini izler:
1. **Taslak Oluşturma**: Fatura `Hold: { value: true }` olarak oluşturulur.
2. **Geri Okuma**: ERP sunucusunun hesapladığı `Amount` ve `TaxTotal` değerleri okunur.
3. **Mutabakat**: KroptOS sipariş toplamı ile ERP tutarı karşılaştırılır (tolerans: 0.05).
   - Fark varsa: Kesinleştirilmez! Fatura `Hold` taslağında bırakılır, uyuşmazlık arayüze ve yanıta yansıtılır.
   - Fark yoksa: `ReleaseInvoice` eylemi çağrılarak fatura kesinleştirilir (`Open`).
