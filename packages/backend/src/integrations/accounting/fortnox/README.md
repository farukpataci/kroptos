# KroptOS — Fortnox Entegrasyonu (İsveç Muhasebe/ERP)

Bu modül, İsveç pazarının lider muhasebe sistemi **Fortnox** ile KroptOS arasındaki entegrasyonu sağlar.
Entegrasyon seviyesi: `MOCK_READY` (Sıfır canlı ağ isteği; test ve prod istemcileri `IntegrationNotVerifiedError` ile kilitlidir).

---

## 1. Talep Edilen Scope Listesi ve Gerekçeleri (§5.2)

Fortnox'ta kaynak düzeyinde **salt-okunur (read-only) scope bulunmamaktadır**; bir scope talep edildiğinde hem okuma hem yazma yetkisi verilir. Bu sebeple en az yetki ilkesi (least-privilege) katı bir şekilde uygulanmıştır.

| Scope | Gerekçe (Tek Satır) |
|---|---|
| `invoice` | Müşteri satış faturalarının oluşturulması, geri okunması ve iptal/kredi işlemlerinin yönetimi için zorunludur. |
| `customer` | KroptOS carilerinin/müşterilerinin Fortnox cari kartları ile eşitlenmesi için zorunludur. |
| `article` | KroptOS ürünlerinin ve SKU'larının Fortnox ürün/hizmet kartlarıyla eşlenmesi için zorunludur. |
| `payment` | Kesilen faturalara ait tahsilat kayıtlarının Fortnox'a işlenmesi için zorunludur. |
| `bookkeeping` | Fatura tarihine ait açık mali yılın doğrulanması (`financialyears`) ve faturanın deftere kaydedilmesi (`bookkeep`) için zorunludur. |

> **Hariç Tutulan Scope'lar:** `salary`, `companyinformation`, `supplier`, `supplierinvoice`, `order`, `offer` vb. KroptOS satış faturası kapsamı dışındaki tüm yetkiler güvenlik gerekçesiyle **talep edilmez**.

---

## 2. Ticari Karar: Yayın Modeli (Purchasable vs Activatable) (§2.1)

Fortnox Entegrasyon Pazaryeri'nde iki farklı yayın ve satış modeli sunar. Bu bir **ticari/ürün yönetimi kararıdır**; kod düzeyinde varsayım yapılmamıştır:

### Seçenek A: Satın Alınabilir (Purchasable)
- **Model:** Satış ve faturalama doğrudan Fortnox üzerinden yürütülür. Kullanıcı Fortnox App Store üzerinden KroptOS entegrasyonunu satın alır.
- **Onboarding Akışı:** Kullanıcı Fortnox içinden "Satın Al" der, Fortnox KroptOS webhook/redirect URL'ine lisans bilgisiyle yönlendirir.
- **Arayüz Etkisi:** KroptOS panelinde "Fortnox aboneliğiniz Fortnox faturanıza yansıtılacaktır" bilgisi gösterilir.

### Seçenek B: Etkinleştirilebilir (Activatable)
- **Model:** Satış ve abonelik doğrudan KroptOS tarafından yapılır. Fortnox Pazaryeri yalnızca bir vitrindir; kullanıcı Fortnox üzerinden entegrasyonu "Etkinleştir" (Activate) diyerek açar.
- **Onboarding Akışı:** Kullanıcı KroptOS paneline yönlendirilir; KroptOS üzerinde aktif bir aboneliği varsa OAuth yetkilendirmesi tamamlanır.
- **Arayüz Etkisi:** KroptOS panelinde standart OAuth bağlantı butonu ve KroptOS plan detayları gösterilir.

> **Karar:** Yayın modeli seçimi KroptOS yönetimine ve ticari stratejisine bırakılmıştır.

---

## 3. `client_credentials` Akışı Araştırma Bulgusu (§5.8)

Fortnox API dokümantasyonu incelendiğinde:
- `client_credentials` akışı yalnızca **Servis Hesapları (`account_type=service`)** için desteklenmektedir.
- Bu akışta müşteri ilk kurulumda servis hesabı izni verir; ardından entegrasyon her istekte `TenantId` başlığı ve Basic Auth ile doğrudan access token alır (refresh token kullanılmaz).
- Çok kiracılı SaaS pazaryeri uygulamalarında standart kullanıcı katılımı ve dinamik consent yönetimi için birincil ve zorunlu akış **`authorization_code`** akışıdır.
- Bu turda KroptOS standart `authorization_code` akışını (10 dk tek kullanımlık auth code + tek kullanımlık nonce) kullanır. `client_credentials` kodda kullanılmamıştır.

---

## 4. Rate Limiting: 5 Saniyelik Kayan Pencere (25 req / 5s) (§5.3)

- Fortnox rate limiti **5 saniyelik pencerede 25 istek** (dakikada 300) sınırıdır. Saniyede 5 istek diye düzlenemez (burst serbesttir).
- `FortnoxWindowLimiter`: Milisaniye hassasiyetli kayan pencere kovası (sliding window bucket) ile uygulanmıştır. 25 istek anında gönderilebilir; 26. istek ilk isteğin 5000 ms'si dolana kadar bekletilir.
- HTTP 429 aşımında `Retry-After` başlığı varsa riayet edilir; yoksa rastgele jitter içeren üstel geri çekilme (exponential backoff) uygulanır.
- **Risk Notu:** Fortnox limiti hem Client ID hem Tenant ID bazında takip eder. Çok kiracılı sistemde limit kiracı başına izole edilmiştir.

---

## 5. Mali Yıl (Financial Year) Ön Kontrolü (§5.6)

- Fatura tarihi için Fortnox'ta açık bir mali yıl tanımlı olmalıdır (`GET /3/financialyears/?date={YYYY-MM-DD}`).
- Mali yıl yoksa veya kapalıysa fatura gönderimi durdurulur ve operatöre açıklayıcı mesaj verilir:
  `"Fortnox'ta bu tarih için açık bir mali yıl tanımlı değil. Lütfen Fortnox arayüzünden ilgili döneme ait mali yılı açınız."`
- KroptOS **asla otomatik mali yıl oluşturmaz**.

---

## 6. Fatura Yaşam Döngüsü, Mutabakat & Değişmezlik (§5.4, §5.5)

1. **Taslak Oluşturma:** `POST /3/invoices` ile taslak fatura açılır.
2. **Geri Okuma:** Fatura `GET /3/invoices/{id}` ile okunur ve sunucunun hesapladığı toplamlar (`Total`, `TotalVAT`) alınır.
3. **Mutabakat (Reconciliation):** Sunucu toplamı ile KroptOS sipariş toplamı karşılaştırılır (tolerans ≤ 0.05 SEK).
   - Tutarsa: `PUT /3/invoices/{id}/bookkeep` ile fatura deftere kaydedilir (`Booked: true`).
   - Tutmazsa: Fatura kaydedilmemiş (unbooked) bırakılır, operatöre fark gösterilir.
4. **Değişmezlik (Bokföringslagen):** Kaydedilmiş fatura değiştirilemez veya silinemez. Düzeltme yolu `PUT /3/invoices/{id}/credit` (alacak faturası) oluşturmaktır.
5. **E-posta & Yazdırma YASAKTIR:** `.../email` ve `.../print` uçları hiçbir koşulda çağrılmaz. Belge dağıtımı Fortnox panelinden operatör tarafından yapılır.

---

## 7. `MOCK_READY` → `TEST_READY` Geçiş Adımları (30 Test Veritabanı)

1. `apps.fortnox.se/developer` üzerinden kayıtlı hesaba giriş yapılır.
2. **Developer Portal > Test Databases** sekmesinden 30 adede kadar ücretsiz test şirketi/veritabanı açılır.
3. Test veritabanına giriş yapılarak aktif bir mali yıl açılır (ör. 2026-01-01 / 2026-12-31).
4. Portalden `client_id`, `client_secret` ve `redirect_uri` alınır.
5. Test ortamında uçtan uca OAuth token değişimi, fatura mutabakatı ve alacak faturası doğrulanır.
6. `CHECKLIST.md` üzerindeki "Sonraki Faz" maddeleri tamamlanarak Fortnox Partner ekibine review başvurusu yapılır.
