# KroptOS Agent

Müşteri sunucusunda çalışır; KroptOS'a **yalnızca dışarı yönlü** bağlanır, Mikro Desktop API'ye
`localhost`'ta konuşur. Tasarım: `docs/mikro.agent.md` §9. **pnpm workspace'i değildir** — kök
`pnpm build` bunu derlemez; kendi `npm install && npm run build` döngüsü vardır.

## Runtime kararı — brifingten sapma

Brifing `.NET 8` istiyordu. Bu makinede .NET SDK yok ve Mikro yalnızca REST konuştuğu için COM köprüsü
bu görevin dışında. Agent **TypeScript/Node 22+** ile yazıldı; kazanç: protokol tipleri backend
çekirdeğinden **tek kaynaktan** import edilir (`src/protocol.ts` → `AgentProtocol.ts`), kod üretimi yok,
ve paket burada jest ile test edilir. COM köprüsü (Logo GO3 / Netsis) ileride ayrı bir **x86 .NET
süreci** olarak eklenir; Host onu `child_process` ile ayakta tutar — tasarımın "ayrı süreçli köprü"
şartı korunur.

İkinci sapma: tünel kimliği mTLS istemci sertifikası yerine **kayıtta verilen sır ile HMAC-imzalı
hello + kısa ömürlü oturum belirteci**. TLS'i ters proxy sağlar. Sertifika imzalama altyapısı (CA,
CSR) eklenene kadar bu geçerlidir; iptal semantiği aynıdır (`REVOKED` → kasa silinir, durur).

## Dosyalar

| Dosya | Görev |
|---|---|
| `src/protocol.ts` | Backend `AgentProtocol.ts` re-export'u — kapalı iş kümesi, zarflar |
| `src/tunnel.ts` | Giden WSS, hello (HMAC), kalp atışı 30 s / ölü 90 s, üstel geri çekilme + jitter ≤ 60 s, N/N-1 protokol |
| `src/job-runner.ts` | Küme dışı → REJECTED; TTL → EXPIRED; idempotency kasası; yazma 1 / okuma 2 eşzamanlılık; STOCK_* coalesce |
| `src/idempotency-store.ts` | `idempotencyKey → sonuç`, TTL 7 gün, disk kalıcı |
| `src/vault.ts` | Yerel kasa — DPAPI (LocalMachine) ile korunur; REVOKED'da silinir |
| `src/credential-envelope.ts` | K2: RSA-OAEP + AES-GCM hibrit zarf; `seal` tarayıcı referansı, `open` Agent tarafı |
| `src/catalog.ts` | K7: manifest + `.sql`; SELECT/WITH dışı ifade → **Agent başlamaz** |
| `src/mikro/sifre.ts` | K8: `Sifre = MD5(tarih + şifre)`, her istekte yeniden, cache yok |
| `src/mikro/executor.ts` | Kimlik zarfını takar; auth hatasında **tam bir kez** yeniden türetir; saat farkı; zaman aşımı |
| `catalog/mikro/` | Sorgu sözleşmeleri; gerçek SQL Faz D'de (`.sql.template` yer tutucu) |

## Kurulum

```
cd agent && npm install && npm run build
node dist/agent/src/main.js enroll <KAYIT_KODU> https://<kroptos>/api/agents/enroll
pm2 start dist/agent/src/main.js --name kroptos-agent     # ya da Windows servisi olarak sar
```

Yapılandırma `%ProgramData%\KroptOS\Agent\agent.json`:

```json
{ "serverUrl": "wss://<kroptos>/api/agents/tunnel", "erp": { "baseUrl": "http://localhost", "port": 8094 } }
```

`port`: v17 → 8094, v16 → 8084. `baseUrl` localhost değilse bağlantı kaydı `transportSecurity='PLAINTEXT_LAN'`
olarak işaretlenmelidir (K10).

## Testler (§9.7)

`npm test` — A1 idempotency (kasadan, ERP'ye çağrı yok, 7 gün TTL, zaman aşımı kasaya yazılmaz) ·
A2 küme dışı tip / TTL / coalesce · A3 REVOKED → kasa silinir, yeniden bağlanma yok · A4 zarf iki istekte
iki kez türetilir, auth hatasında tek retry · A5 gün sınırı, saat farkı · A6 katalog SELECT dışı → başlamaz,
template sorgu `catalog_query_unavailable`, parametreli sorgu `catalog_binding_unverified` · A7 credential
logda yok.

## Bilinmeyenler (§12'ye ek)

- **#11** Mikro metot yollarının öneki: yalnızca `APILogin` ve `SqlVeriOkuV2` için tam yol görüldü; diğerleri
  `/Api/APIMethods/` varsayıldı.
- **#12** `SqlVeriOkuV2` bağlı parametre destekliyor mu? Desteklemiyorsa katalogdaki parametreli sorgular
  için K7 ile uyumlu bir yol (sunucu tarafı whitelisted literal) ayrıca kararlaştırılmalı.
- Kurulum paketi (imzalı MSI), Authenticode doğrulama ve kademeli güncelleme (§9.7) bu turda yok — pm2 ile çalışır.
