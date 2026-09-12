# Visma.net ERP Entegrasyonu (MOCK_READY)

Bu modül, KroptOS muhasebe entegrasyonu katmanında **Visma.net ERP** (REST API) sağlayıcısını uygular.

## 1. Visma Ürün Ailesi ve Ayrım Kuralı (§1)
Visma tek bir ürün değil, farklı pazar ve ölçeklere hitap eden geniş bir kurumsal yazılım ailesidir:
- **`visma-net-erp` (Bu Modül):** Orta ve büyük ölçekli işletmeler için Acumatica tabanlı REST ERP sistemidir (Nordics + Hollanda).
- **`visma-spiris` / `visma-eaccounting`:** Küçük işletmeler için ayrı bir portal ve tamamen ayrı bir API ailesidir. Bu turda kapsam dışıdır; ayrı bir sağlayıcı olarak açılmalıdır.
- **`visma-business-nxt`:** GraphQL tabanlı yeni nesil bulut ERP ürünüdür. Ayrı portal ve protokol gerektirir; bu turda kayıt açılmaz.
- **DataMart Notu:** Visma.net ERP yanında DataMart adlı salt-okunur bir GraphQL analitik/raporlama API'si mevcuttur. Aynı üründe ikinci bir protokol olduğundan bu turun kapsamı dışındadır.

## 2. Arka Plan Operasyon Mekanizması (§3)
Visma.net ERP, uzun sürebilecek yazma işlemlerinde (fatura, cari, tahsilat vb.) web zaman aşımı (timeout) istisnalarını önlemek için yerel bir arka plan işletim mekanizması sunar:
1. İstek `erp-api-background: none` başlığıyla gönderilir.
2. Sunucu anında `202 Accepted` ve bir `jobId` + `stateLocation` döner.
3. **Kritik Kural:** Operasyon kimliği (`op:<jobId>`) yoklama döngüsü başlamadan **ÖNCE** veritabanına commit edilir.
4. `stateLocation` üstel aralıklarla (exponential backoff) sorgulanır.
5. Durum `Completed` olduğunda `contentLocation` üzerinden oluşturulan belgenin sunucu çıktısı alınır.

### Webhook Notu (§3.3)
`erp-api-background` başlığına webhook URL'i veya `subscription` değeri verilebilmektedir. Ancak bu turda dış ağa açık bir callback ucu ve imza doğrulama bağımlılığı oluşturmamak adına `none` (yoklama) modu tercih edilmiştir. Webhook entegrasyonu, imza doğrulama ve replay koruması ön koşullarıyla birlikte sonraki faza bırakılmıştır.

## 3. Doğrulanmış API Detayları (§4.2)
- **Base URL:** `https://api.finance.visma.net` (REST: `/service/controller/api/v1`)
- **OAuth (Visma Connect):**
  - Authorize: `https://connect.visma.com/connect/authorize`
  - Token: `https://connect.visma.com/connect/token`
  - Scopes: `vismanet_erp_service_api`, `openid`, `profile`, `email`, `offline_access`
- **Firma Tanımlayıcısı:** `ipp-company-id` HTTP başlığı olarak iletilir. Kesinlikle istek parametrelerinden okunmaz; entegrasyon ayarlarından türetilir.
- **Rate Limit Başlıkları:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (saniye), `X-RateLimit-Policy`. `429` durumunda `Retry-After` (saniye) başlığına uyulur.

## 4. Belge Yaşam Döngüsü ve Mutabakat (§5.4, §5.5)
1. Fatura oluşturma isteği sunucuya iletildiğinde satır bazında `unitPriceInCurrency`, `quantity`, `vatCodeId`, `accountNumber` gönderilir.
2. Toplam tutarlar (`amount`, `vatAmount`) sunucu tarafından hesaplanır.
3. Arka plan çıktısından alınan sunucu toplamı ile KroptOS sipariş toplamı arasında **0.05 tolerans** ile mutabakat yapılır.
4. Mutabakat başarılı olursa `action/releaseInvoice` eylemi çağrılarak fatura `Open` durumuna yükseltilir.
5. Aksiyon uçları arka plan içeriğinde nihai belge durumunu döndürmediği için fatura `GET /controller/api/v1/customerinvoice/{invoiceNumber}` ile ayrıca teyit edilir.
