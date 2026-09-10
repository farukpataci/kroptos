# Odoo (ERP & Accounting) Entegrasyonu

## 1. Odoo Neden Bölünmez? (§1)

SAP (`cloud` / `onprem`), Business Central (`online` / `onprem`) ve Sage (`accounting` / `x3` / `intacct` / `200`) ayrı sağlayıcılara bölünmüştür. Ancak Odoo **bölünmez**.

KroptOS sağlayıcı ayrıştırma matrisi:
1. **Protokol / kimlik modeli / veri modeli farklıysa** $\rightarrow$ **Ayrı sağlayıcı** (örn: SAP cloud vs on-prem).
2. **Ticari kimlik / firma farklıysa** $\rightarrow$ **Hesap / firma kaydı**.
3. **Ağ topolojisi farklıysa** (bulut mu, müşteri sunucusu mu — aynı protokol, aynı kimlik) $\rightarrow$ **Bağlantı kaydı** (taban URL özelliği).
4. **Ürünün sürümü farklıysa** (aynı ürün, yükseltme yolu üzerinde) $\rightarrow$ **Connector içinde taşıma seçimi**.

Odoo Online, odoo.sh ve On-Premise Odoo aynı protokolü, aynı kimlik modelini ve aynı veri modelini konuşur. Odoo 19 ile gelen JSON-2 ve öncesindeki Klasik RPC farkı bir ürün varyantı değil, **sürüm yükseltme** sürecidir. Müşteri Odoo 18'den 19'a geçtiğinde sağlayıcı değiştirip belge geçmişini kaybetmemeli; tek connector içinde sürüm tespitiyle taşıma katmanı dinamik seçilmelidir.

`provider = 'odoo'`. Tek kayıt.

---

## 2. API Kuşağı ve Deprecate Takvimi Gözden Geçirme Notu (§3)

```
Odoo ≥ 19 : /json/2/<model>/<method>     ·  Authorization: Bearer <API_KEY>
Odoo < 19 : /xmlrpc/2/common, /xmlrpc/2/object, /jsonrpc   (klasik RPC)
```

- Odoo 19 ile `/xmlrpc`, `/xmlrpc/2` ve `/jsonrpc` uçları **deprecate edilmiştir**.
- **Kaldırma Takvimi Çelişkisi:** İkincil kaynakların bir kısmı Odoo 20'de (2026 sonu), bir kısmı Odoo 22'de (2027/2028) kaldırılacağını belirtmektedir.
- **Gözden Geçirme Notu:** KroptOS her iki taşımayı da tek bir iç arayüz (`odoo.transport.ts`) arkasında destekler. Odoo $\ge$ 19 tespit edildiğinde kesinlikle modern JSON-2 kullanılır; klasik RPC'ye yeni yük bindirilmez.

---

## 3. Mimari ve Güvenlik İlkeleri

1. **Allowlist Güvenlik Sınırı (§5.1):**
   Odoo uzaktan dinamik ORM metot çağrısı yaptığından, `odoo.allowlist.ts` üzerinde izin verilen `(model, metot)` ikilileri dar tutulmuş ve dondurulmuştur. Listede olmayan hiçbir çağrı ağa iletilmez (`BadRequestException`).
2. **Şema Keşfi (§5.2):**
   Model alanları sürümler arasında değişebildiğinden, bağlantı anında `fields_get` ile zorunlu alanlar introspect edilir. Zorunlu bir alan eksikse bağlantı doğrulanmaz ve eksik alan operatöre bildirilir.
3. **Context ve Çoklu Şirket (§5.3):**
   Şirket kimliği istek gövdesinden okunmaz; tenant doğrulamasından geçmiş entegrasyon/firma kaydından türetilerek context (`allowed_company_ids`) içine enjekte edilir.
4. **Mutabakat Penceresi (§5.4):**
   Faturalar önce taslak (`draft`) olarak açılır. Odoo'nun hesapladığı `amount_total` geri okunarak KroptOS sipariş toplamıyla karşılaştırılır. Eşleşirse `action_post()` çağrılır; eşleşmezse fatura taslakta bırakılır ve fark bildirim olarak gösterilir.
5. **Şifresiz Güvenlik (§5, §10):**
   Credential şemasında şifre alanı yoktur. Yalnızca kullanıcı API anahtarları kabul edilir.
6. **Token Deposu Negatif Testi (§5.7):**
   Odoo statik API anahtarı kullandığından `refreshSemantics` tanımsızdır. Token deposu ve canlı tutma (keep-alive) işi Odoo için çalışmaz.
