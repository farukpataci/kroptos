# Muhasebe Agent + API Çatısı — Logo Ailesi (GO3 · Tiger · Netsis) Uçtan Uca Bağlantı Modeli

> Tarih: 2026-09-12. `claude/08_MUHASEBE_BAGLANTI_MATRISI.md`'nin **üstünde** çalışır:
> matris "ne ile nasıl bağlanılır"ı araştırdı, bu doküman "altyapı nasıl kurulur"u tasarlar.
> Disiplin `claude/06_KARGO_ON_ENTEGRASYON_CATISI.md` ve `claude/07_KARGO_BAGLANTI_MODELI.md`
> ile aynıdır: **doğrulanmayan hiçbir endpoint, alan adı, tablo adı, port, durum kodu ya da
> token ömrü kesinmiş gibi yazılmaz.**
>
> Çakışmada: 06/07'nin *kalıpları* (registry, yetenek/hazırlık, credential şeması, uygunluk
> paketi, idempotency, yasaklar) aynen geçerlidir. Sapılan üç nokta §0.3'te gerekçesiyle
> listelenmiştir.

---

## 0. Karar kaydı ve kapsam

### 0.1 Bu turda verilen dört karar

| # | Karar | Seçim |
|---|---|---|
| 1 | Teslimat | **Mimari doküman.** Kod bu turda yazılmadı. |
| 2 | Faz D referansı | **Üçü birden, tek çatı** (GO3 + Tiger + Netsis) |
| 3 | ERP kimlik modeli | **Kimlik Agent'ta kalır.** ERP kullanıcı/şifresi müşteri sunucusundan çıkmaz. |
| 4 | İlk faz akışları | Ürün kartı eşleşmesi · Stok (ERP→KroptOS) · Fatura (KroptOS→ERP) · Cari + tahsilat |

### 0.2 "Üçü birden" kararının riski ve alınan karşı önlem

`06 §1` net: *"sıfır gerçek entegrasyonla kurulan bir çatı, hayalden şekillenmiş bir soyutlama
üretir."* Üç varyantı da aynı anda kapsayan bir çatı bu riski **üçe katlar** — ve üçünün de
`SCAFFOLDED`'da kalması en olası sonuçtur.

Karar uygulanır, ama tek bir düzeltmeyle:

> **Çatının gerçek riski üçüncü sağlayıcı değil, protokol sınıfı sınırıdır.**
> Soyutlama REST ile COM arasındaki farkı taşıyabiliyorsa üçüncü varyant ucuzdur;
> taşıyamıyorsa üç varyant da yanlış olur.

Bu yüzden çatı **üçünü birden kapsayacak şekilde tasarlanır**, fakat doğrulama iki sınıfa
karşı yapılır:

| Sınıf | Varyant | Faz D hedefi |
|---|---|---|
| REST üzerinden yerel servis | `netsis` (NetOpenX REST) **veya** `logo-rest` (Tiger 3/Wings) | `TEST_READY` |
| COM üzerinden yerel nesne | `logo-objects` (GO3) | `TEST_READY` |

Üçüncü varyant `SCAFFOLDED` kalabilir ve bu bir eksiklik sayılmaz — çünkü kendi sınıfının
temsilcisi zaten doğrulanmıştır. **İki sınıftan biri doğrulanmadan çatı bitmiş sayılmaz.**

### 0.3 06/07'den bilinçli sapılan üç nokta

| # | Kural (06/07) | Bu çatıda | Gerekçe |
|---|---|---|---|
| 1 | *"Token cache ve throttle anahtarı = bağlantı. Hesap sayısıyla çoğalmaz."* (07 §2) | **Token/oturum anahtarı = (bağlantı, firma[, dönem]).** | Logo REST'te `firmno` **token isteğinin gövdesindedir** (§1.1) — token firmaya kilitlidir. LogoObjects'te `Login(...)` çağrısı firma ve dönem alır. Oturum firma ekseninden ayrılamaz; ayrılırsa yanlış firmaya kayıt atılır. |
| 2 | Credential **daima** KroptOS'ta şifreli saklanır (06 §4.4) | On-prem sağlayıcılarda credential **Agent'ta** saklanır; KroptOS'ta ne düz metin ne çözebildiği bir şifreli metin durur. | Karar #3. Panel UX'i §4.4.3'teki uçtan uca şifreli tek yönlü aktarımla korunur. |
| 3 | `CarrierProvider` kapalı union değildir (06 §4.0) | Aynı kural, **ek olarak** rota (`HTTPS` / `AGENT+API` / `AGENT+SQL`) sağlayıcının değil **bağlantı kaydının** alanıdır. | 08 §2.2: aynı sağlayıcı (Odoo) hem bulut hem on-prem gelebilir. Rotayı sağlayıcıya gömmek ikinci bir connector ailesi doğurur. |

### 0.4 Başarı ölçütü

- Dokümanı ve test credential'ı elde olan **yeni bir muhasebe sağlayıcısının** `TEST_READY`
  olması ≤ **5 iş günü**, ve bu sürede **Agent tarafında sıfır satır kod** yazılması.
- Yeni sağlayıcı Agent'a yeni bir iş tipi ekletiyorsa çatı sızdırıyor demektir (§8, test 21).

### 0.5 Kapsam dışı (bilerek)

- **e-Fatura / e-Arşiv / e-İrsaliye.** 08 §6.4: *"Muhasebeye fatura kaydı yazmak ile GİB'e
  e-fatura göndermek aynı iş değil."* Bu ikinci bir eksendir, bu çatının içine girmez.
- Bulut sağlayıcılar (Paraşüt, KolayBi vb.). Çatı onları kapsayacak şekilde tasarlanır
  (`transport: DIRECT`), ama bu turda tek satır sağlayıcı kodu tarif edilmez.
- SAP / BC / NetSuite. 08 §4'teki gerekçe geçerli.

---

## 1. Doğrulanan ve doğrulanmayan — kanıt tablosu

Aşağıdaki satırlar bu oturumda kaynaktan okundu. **Hiçbir sağlayıcıya gerçek kimlikle tek bir
çağrı yapılmadı.**

### 1.1 `logo-rest` — Tiger 3 / Tiger Wings (+ Enterprise)

| Bilgi | Durum | Kaynak |
|---|---|---|
| Desteklenen ürünler: *"Tiger 3, Tiger Wings, Tiger 3 Enterprise ve Tiger Wings Enterprise"* | **DOĞRULANDI** | logoyazilimdestek |
| **GO3, Start, Tiger Plus, Go Plus desteklenmiyor** | **DOĞRULANDI** | logoyazilimdestek |
| Ayrı lisans yok: *"Logo Objects kullanım lisansınızın olması ... yeterlidir"* | **DOĞRULANDI** | logoyazilimdestek |
| Kurulum: `ERP_DİZİNİ\RESTServis\LogoRestServiceSetup.exe`; yapılandırma `RestServiceWSManager.exe` (yönetici) | **DOĞRULANDI** | logoyazilimdestek |
| Varsayılan port **32001** (değiştirilebilir) | **DOĞRULANDI** | logoyazilimdestek |
| Token: `POST [host]:[port]/api/v1/token`, `Content-Type: application/json`, `Authorization: Basic base64(ClientId:Secret)`, gövde `grant_type=password`, `username`, `password`, **`firmno`** | **DOĞRULANDI** | logoyazilimdestek (Postman rehberi) |
| ClientId/ClientSecret *"yalnızca Logo Çözüm Ortaklarına verilir"* | **DOĞRULANDI** | logoyazilimdestek |
| Token ömrü (`expires_in`), yenileme akışı, rate limit | **DOĞRULANMADI** | — |
| Veri endpoint yolları, alan adları, hata kodu sözlüğü | **DOĞRULANMADI** | — |
| Dönem (`donemno`) nasıl veriliyor | **DOĞRULANMADI** | — |

**Mimari sonuç:** `firmno` token isteğinin içindedir → **token firma başına alınır.** Token
cache anahtarı `(integrationId, companyNo)`. Bu, 07 §2'den sapmanın kanıtıdır (§0.3/1).

### 1.2 `logo-objects` — GO3 / Go Plus / Tiger Plus

| Bilgi | Durum | Kaynak |
|---|---|---|
| Teknoloji: COM, `UnityApplication` nesnesi | **DOĞRULANDI** (ikincil) | kemalbayat |
| Oturum: `Login(kullanıcı, şifre, firmaNo, dönemNo)` — dönem `0` aktif dönem | **DOĞRULANDI** (ikincil) | kemalbayat |
| Veri nesneleri `IData` / `ILines` kalıbı | **DOĞRULANDI** (ikincil) | kemalbayat |
| COM kayıt gereği (`register.bat` benzeri kurulum adımı) | **DOĞRULANDI** (ikincil) | kemalbayat |
| Logo'nun **aynı makinede kurulu** olma şartı | **ÖRTÜLÜ — teknik olarak zorunlu** | COM in-proc/local server doğası |
| x86/x64 bit uyumu, apartment modeli (STA/MTA), eşzamanlı oturum sınırı | **DOĞRULANMADI** | — |
| Nesne/metot/alan adları, hata kodları | **DOĞRULANMADI** | — |
| Resmî açık geliştirici dokümanı | **YOK** | 08 §4 ile aynı bulgu |

**Mimari sonuç:** GO3 için REST yolu **yoktur**. Tek yol COM'dur ve COM ancak Logo'nun kurulu
olduğu Windows makinesinde çalışır → **Agent zorunludur, tartışmaya kapalıdır.**

### 1.3 `netsis` — NetOpenX

| Bilgi | Durum | Kaynak |
|---|---|---|
| Teknoloji: *"COM teknolojisinde dll formatında sunulmaktadır"*, `NetOpenX50.dll`, kurulu setin `TEMELSET` klasöründe | **DOĞRULANDI** (ikincil) | netopenx.net |
| *"NetOpenX Runtime Lisansına ihtiyaç duyulmaktadır"*, **kullanılacak istemci sayısına göre** | **DOĞRULANDI** (ikincil) | netopenx.net |
| Lisans Çözüm Ortağı üzerinden Logo'dan alınır | **DOĞRULANDI** (ikincil) | netopenx.net |
| **NOX REST katmanı gerçekten kullanımda** (fatura, cari, sipariş uçları; `401 Authorization has been denied` hatası biliniyor → token tabanlı yetkilendirme) | **KISMİ** — varlığı forum kayıtlarıyla doğrulandı, sözleşmesi doğrulanmadı | forum.logo.com.tr |
| Minimum Netsis sürümü, endpoint yolları, login şeması (şube/firma/kullanıcı) | **DOĞRULANMADI** | — |

**Mimari sonuç:** Netsis'te **iki protokol birden** vardır (COM + REST). Bu, tek bir çatının
her iki sınıfı da taşıyabildiğini sınamak için **en ucuz laboratuvardır** — aynı ERP, aynı veri
modeli, iki taşıma. Faz D'de REST sınıfının referansı olarak `netsis` önerilir.

### 1.4 Üç varyantın ortak sonucu: rota tek

| Varyant | Protokol | Nerede çalışır | Rota |
|---|---|---|---|
| `logo-rest` | REST, port 32001 | Müşteri sunucusu (LAN) | `AGENT+API` |
| `logo-objects` | COM | Logo'nun kurulu olduğu makine | `AGENT+API` |
| `netsis` | COM ve/veya NOX REST | Müşteri sunucusu (LAN) | `AGENT+API` |

Üçü de `AGENT+API`. **Hiçbiri internete açık değildir ve açılmamalıdır** — müşteriye
"32001 portunu dışarı açın" demek bir entegrasyon yöntemi değil, bir güvenlik olayıdır.
Agent'ın varlık sebebi budur.

---

## 2. Uçtan uca akış — tek resim

```
┌──────────────── KroptOS Bulut ────────────────┐        ┌──── Müşteri Ağı (LAN) ────┐
│                                               │        │                           │
│  Frontend /t/{tenant}/accounting              │        │  ┌─────────────────────┐  │
│        │ apiFetch + tenant header'ları        │        │  │  KroptOS Agent      │  │
│        ▼                                      │        │  │  (Windows Service)  │  │
│  AccountingModule (NestJS)                    │        │  │                     │  │
│        │                                      │        │  │  ├ Tünel istemcisi  │  │
│        ▼                                      │        │  │  ├ İş çalıştırıcı   │  │
│  AccountingConnector  ← protokolü konuşur     │        │  │  ├ Yerel kasa (DPAPI)│ │
│        │                                      │        │  │  └ COM köprüsü(x86) │  │
│        ▼                                      │        │  └──────┬──────────────┘  │
│  AccountingTransport                          │        │         │                 │
│   ├ DirectTransport  (bulut sağlayıcı)        │        │    ┌────┴────┐            │
│   └ AgentTransport ──┐                        │        │    ▼         ▼            │
│                      │                        │        │  REST:32001  COM          │
│  AgentGateway (WSS) ◄┼════ giden mTLS tünel ══╪════════╪► /api/v1/... UnityApp/NOX │
│        │             │    (müşteri dışarı     │        │              │            │
│  Redis pub/sub       │     bağlanır, içeri    │        │              ▼            │
│  agent:{agentId}     │     port açılmaz)      │        │      Logo / Netsis DB     │
│        │             │                        │        │                           │
│  BullMQ: accounting-read / accounting-write   │        └───────────────────────────┘
│  Postgres: Integration/Company/Job/DocumentLink│
└───────────────────────────────────────────────┘
```

Üç kural bu resimden okunur:

1. **Bağlantı yönü daima içeriden dışarıdır.** KroptOS müşteri ağına bağlanmaz; Agent
   KroptOS'a bağlanır. Müşteride açılacak tek bir gelen port yoktur.
2. **Connector protokolü konuşur, Agent taşır.** `AccountingConnector` "fatura yaz" der;
   nereye ve nasıl gittiğini `AccountingTransport` bilir. (08 §2.2)
3. **ERP kimliği tünelin müşteri tarafında kalır.** Yukarı çıkan tek şey iş sonucudur.

---

## 3. Klasör yerleşimi

Repo `integrations/marketplaces/` kalıbını kullanıyor; muhasebe onun kardeşidir.
`accounting/domain|application|infrastructure/` gibi ayrı bir katman ağacı **kurulmaz**.

```
packages/backend/src/integrations/accounting/
├── core/
│   ├── AccountingConnector.ts           # port
│   ├── AccountingConnectorFactory.ts
│   ├── AccountingProviderRegistry.ts    # açık kayıt (06 §4.0)
│   ├── AccountingCapabilities.ts
│   ├── AccountingCredentialSchema.ts    # storage: SERVER_ENCRYPTED | AGENT_LOCAL
│   ├── AccountingTypes.ts               # ortak nesne modeli
│   ├── AccountingErrors.ts
│   ├── AccountingSessionKey.ts          # (integrationId, companyNo, periodNo)
│   ├── AccountingDocumentRef.ts         # dış referans / idempotency
│   ├── transport/
│   │   ├── AccountingTransport.ts       # port
│   │   ├── DirectTransport.ts           # bulut sağlayıcılar
│   │   └── AgentTransport.ts            # AgentGateway'e iş bırakır
│   └── __conformance__/                 # Faz C
├── logo-rest/                           # Tiger 3 / Wings
├── logo-objects/                        # GO3 / Go Plus / Tiger Plus
├── netsis/                              # NetOpenX (COM ve/veya NOX REST)
└── _template/                           # iskelet üretici hedefi

packages/backend/src/modules/accounting/          # Module + Controller + Service + dto/
packages/backend/src/modules/agent/               # AgentGateway, enrollment, job dispatch

agent/                                            # YENİ workspace — .NET, pnpm'e bağlı değil
├── src/KroptOS.Agent.Host/                       # .NET 8, Windows Service, 64-bit
├── src/KroptOS.Agent.ComBridge/                  # .NET Framework 4.8, x86, ayrı süreç
├── src/KroptOS.Agent.Protocol/                   # zarf tipleri (TS karşılığı üretilir)
└── installer/                                    # MSI / imzalı kurulum
```

> `agent/` monorepo'nun içinde ama pnpm workspace'i **değildir**; `pnpm build` onu derlemez.
> Protokol tipleri tek kaynaktan (`Protocol`) üretilir ve TS tarafına kod üretimiyle taşınır —
> iki dilde elle yazılan zarf tanımı ilk sürüm uyuşmazlığında sessizce bozulur.

---

## 4. KroptOS Agent — taşıma katmanı

### 4.1 Runtime kararı: neden .NET, neden iki süreç

**Zorunluluk:** `logo-objects` ve `netsis` COM'dur. COM'u güvenilir çağıran tek pratik runtime
Windows üzerinde .NET'tir. Node.js COM köprüleri (edge/winax sınıfı) üretimde bakım riski
taşır ve Logo/Netsis tarafında hiçbir referansı yoktur.

**İki süreç, çünkü COM tek süreçte üç şeyi birden bozar:**

| Risk | Neden | Karşı önlem |
|---|---|---|
| Bit uyumu | COM sunucusu x86 ise x64 sürecin içine **hiç** yüklenemez | COM köprüsü ayrı **x86** süreç |
| Çökme | ERP COM nesnesinin çökmesi tüm Agent'ı düşürür | Ayrı süreç → sadece köprü ölür, Host onu yeniden doğurur |
| Sızıntı | Uzun ömürlü COM oturumları bellek/handle sızdırır | Köprü süreci N iş ya da T dakika sonra **planlı olarak** geri dönüştürülür |

```
KroptOS.Agent.Host  (x64, .NET 8, Windows Service, LocalSystem değil — özel servis hesabı)
   │  named pipe (yerel, ACL'li)
   ├── ComBridge #1  (x86, .NET Framework 4.8, STA thread)  → firma 1 / dönem 0 oturumu
   └── ComBridge #2  (x86)                                  → firma 2 / dönem 0 oturumu
```

**STA zorunluluğu:** COM nesneleri aksi kanıtlanana kadar STA varsayılır; köprü her ERP
oturumunu **kendi STA thread'inde** tutar ve o thread'e serileştirir. MTA'dan çağırmak
çalışıyormuş gibi görünüp yarış altında bozulur.

**Oturum 0 (Session 0) uyarısı:** Windows servisleri masaüstü göremez. COM sunucusu herhangi
bir koşulda modal pencere açarsa iş **sonsuza kadar asılı kalır** — hata da vermez.
Karşı önlem: her köprü çağrısında sert zaman aşımı (`jobTimeoutSec`, varsayılan 120) ve aşımda
**süreci öldürmek**, iptal etmeye çalışmak değil. COM çağrısı iptal edilemez.

> **DOCUMENTATION_REQUIRED:** LogoObjects ve NetOpenX'in bit genişliği, apartment modeli ve
> eşzamanlı oturum sınırı doğrulanmadı. Faz B'deki "COM duman testi" (§9) bu üç bilgiyi
> ölçmeden `logo-objects` ve `netsis`-COM `MOCK_READY`'den öteye geçmez.

### 4.2 Tünel: giden, tek, çoğullanmış

| Özellik | Karar | Gerekçe |
|---|---|---|
| Yön | **Yalnızca giden** (Agent → KroptOS) | Müşteride gelen port / VPN / statik IP istenmez |
| Taşıma | WebSocket over TLS (`wss`), **mTLS** ile karşılıklı doğrulama | Sertifika tabanlı kimlik, iptal edilebilir |
| Çoğullama | Tek bağlantı, `jobId` ile korelasyon | Kurumsal proxy arkasında tek çıkış |
| Proxy | HTTP CONNECT + kurumsal proxy kimlik desteği (Windows entegre kimlik dahil) | Müşteri ağlarının çoğunda proxy vardır |
| Kalp atışı | 30 sn ping / 90 sn ölü sayma | Ölü bağlantı tespiti |
| Yeniden bağlanma | Üstel geri çekilme + jitter, üst sınır 60 sn | Kitlesel yeniden bağlanma fırtınasını önler |
| Protokol sürümü | Her mesajda `protocolVersion`; sunucu **N ve N-1**'i kabul eder | Agent güncellemesi zorunlu kesinti yaratmaz |

**Dağıtık tuzak — atlanırsa üretimde bulunur:** Backend birden fazla node ile çalışır; WS
soketi **tek bir node'un belleğindedir**. Başka bir node'daki BullMQ worker'ı o Agent'a iş
gönderemez. Çözüm: soketi tutan node `agent:{agentId}` Redis kanalına abone olur; iş bırakan
node o kanala yayınlar. `AgentInstance.connectedNodeId` yalnızca gözlem içindir, yönlendirme
için kullanılmaz (bayat olur).

### 4.3 İş zarfı ve teslim semantiği

```ts
// agent/src/KroptOS.Agent.Protocol — tek kaynak, TS karşılığı üretilir
interface AgentJob {
  jobId: string;              // uuid v4 — sunucu üretir
  protocolVersion: number;
  agentId: string;
  integrationId: string;
  companyKey: {               // §5.3 — oturum anahtarı
    companyNo: string;
    periodNo?: string;
    branchCode?: string;      // netsis
  };
  type: AgentJobType;         // KAPALI kümedir — §4.5
  payload: unknown;           // tipi job type'a bağlı, şema ile doğrulanır
  idempotencyKey: string;     // yazma işleri için zorunlu, okuma işlerinde null
  attempt: number;
  notBefore?: string;         // ISO — planlı işler
  ttlSec: number;             // aşılırsa Agent çalıştırmadan reddeder
  jobTimeoutSec: number;
}

interface AgentResult {
  jobId: string;
  status: 'OK' | 'FAILED' | 'RETRYABLE';
  data?: unknown;
  errorCode?: string;         // Agent'ın normalize ettiği kod
  errorRaw?: string;          // ERP'nin ham mesajı — kırpılmış, PII taranmış
  durationMs: number;
  agentVersion: string;
  fromCache: boolean;         // §4.3.2
}
```

#### 4.3.1 En az bir kez teslim — ve bunun bedeli

Tünel kopabilir; kopma "iş çalışmadı" demek **değildir**. Sunucu cevap alamadığında iş ya
hiç ulaşmamıştır, ya çalışmış cevabı kaybolmuştur. Bu ayrım ağdan okunamaz.

Bu yüzden teslim **en az bir kez**tir ve idempotency Agent'ta çözülür:

#### 4.3.2 Agent yerel tekrar-koruma kasası

Agent, tamamladığı her yazma işinin sonucunu yerel dayanıklı bir depoda tutar:

```
idempotencyKey → { jobId, status, data, completedAt }   TTL: 7 gün
```

Aynı `idempotencyKey` ile ikinci kez iş gelirse **ERP'ye gidilmez**, saklanan sonuç
`fromCache: true` ile döner. Bu tek mekanizma, "tünel koptu, fatura iki kez yazıldı"
senaryosunun **tek gerçek panzehiridir** — sunucu tarafındaki claim satırı (§7.3) onu
tamamlar ama yerine geçmez.

TTL 7 gün, çünkü daha kısa bir pencerede uzun süre çevrimdışı kalmış bir Agent yeniden
bağlandığında eski işleri tekrar çalıştırır.

#### 4.3.3 Sıra ve eşzamanlılık

| Kural | Değer |
|---|---|
| Yazma işleri: `(integrationId, companyKey)` başına | **aynı anda 1** |
| Okuma işleri: aynı anahtar başına | yapılandırılabilir, varsayılan 2 |
| ERP oturum havuzu | firma/dönem başına 1 canlı oturum, boşta 10 dk sonra kapanır |

Gerekçe: NetOpenX Runtime lisansı **istemci sayısına göre** satılır (§1.3). Sınırsız
eşzamanlılık müşteriye fatura çıkarır ve lisans hatasıyla entegrasyonu durdurur. Eşzamanlılık
tavanı bir performans ayarı değil, **bir lisans ve veri bütünlüğü sınırıdır.**

### 4.4 Güven modeli

#### 4.4.1 Kayıt (enrollment) — tek kullanımlık, süreli, kiracıya bağlı

1. Panelde yetkili kullanıcı (`agent.manage`) **kayıt kodu** üretir:
   tek kullanımlık, TTL 15 dk, `(agencyId, clientId)` kapsamlı, üretildiği an audit'lenir.
2. Agent kurulumunda bu kod girilir. Agent, makinede **dışa aktarılamaz** bir anahtar çifti
   üretir (Windows CNG, `NCRYPT_ALLOW_EXPORT_FLAG` verilmez) ve CSR gönderir.
3. KroptOS kodu doğrular, kısa ömürlü bir **istemci sertifikası** imzalar, `agentId` atar,
   kodu yakar.
4. Özel anahtar makineden **hiç çıkmaz.** Yedekten geri dönen bir sunucu yeniden kayıt olur —
   bu bir arıza değil, istenen davranıştır.

#### 4.4.2 İptal — sertifika süresini beklemez

Sertifika kimliktir; **yetki** her bağlantıda verilen kısa ömürlü oturum belirtecidir
(önerilen 15 dk, tünel üzerinden yenilenir). `AgentInstance.status = REVOKED` yapıldığında:

- yeni oturum belirteci verilmez → en geç 15 dk içinde Agent iş alamaz hale gelir,
- açık tünel derhal kapatılır,
- Agent, reddedilme sebebini `REVOKED` olarak alırsa **yerel kasasını siler** ve durur.

Yalnızca sertifika iptaline dayanmak yanlıştır: CRL/OCSP yayılması dakikalar sürer ve bu
süre boyunca iptal edilmiş bir Agent yazma yapabilir.

#### 4.4.3 ERP kimliği — panelden girilir, sunucu **göremez**

Karar #3 "kimlik Agent'ta kalır" der. Bunun saf uygulaması müşteriyi sunucu başına oturup
yerel bir araçla şifre girmeye zorlar — kötü UX, ve çok kiracılı bir üründe sürdürülemez.

Çözüm, kimliği panelden alıp **sunucunun okuyamayacağı** biçimde taşımaktır:

```
1. Panel, ilgili Agent'ın AÇIK anahtarını çeker (AgentInstance.publicKey).
2. Tarayıcıda, alan alan, ERP credential'ı bu açık anahtarla şifrelenir
   (hibrit: rastgele simetrik anahtar + açık anahtarla sarmalama).
3. Sunucuya YALNIZCA şifreli blob gider. Sunucunun özel anahtarı yoktur.
4. Blob `AgentCredentialEnvelope` olarak bir kez kuyruğa konur, Agent'a iletilir,
   Agent çözer, yerel kasasına (DPAPI, makine kapsamı + agent anahtarı) yazar.
5. Teslim onayı gelince sunucudaki blob SİLİNİR. Kalıcı kayıt: sadece
   `credentialSetAt`, `credentialSetBy`, `fingerprint` (blob'un hash'i).
```

Sonuç:

- Panelden kimlik girme ve **değiştirme** çalışır (iyi UX),
- KroptOS veritabanının tamamı sızsa bile hiçbir ERP şifresi çıkmaz,
- KVKK/ISO tarafında savunulabilir bir cümle kurulur: *"ERP kimlik bilgileri hizmet
  sağlayıcının erişebileceği hiçbir ortamda tutulmaz."*

**Kural:** ERP credential'ı **asla** cevapta, log'da, `auditLog`'da, hata mesajında,
`IntegrationLog.payload`'da görünmez. Panelde yalnızca durum gösterilir:
`Tanımlı değil` / `Tanımlı (12.09.2026, faruk@…)` / `Geçersiz (son hata: kimlik reddedildi)`.

#### 4.4.4 Agent bir uzaktan kabuk değildir

Bu, çatının en önemli tek güvenlik kuralıdır. Müşteri sunucusunda çalışan, buluttan komut
alan bir yazılım tanım gereği bir arka kapıdır — **olmadığını yapısal olarak kanıtlamak
gerekir**, sözle değil.

| Yasak | Kural |
|---|---|
| Serbest komut çalıştırma | `AgentJobType` **kapalı bir kümedir**; kümede olmayan tip → iş reddedilir, `IntegrationLog`'a `warn` |
| Sunucudan gelen serbest SQL | **Yasak.** `AGENT+SQL` rotasında yalnızca Agent'ın kendi sürümüyle gelen, **adlandırılmış, parametreli, salt okunur** sorgu kataloğu çalışır |
| Sunucudan kod/eklenti indirme | Yasak. Güncelleme yalnızca imzalı kurulum paketiyle (§4.6) |
| Dosya sistemi erişimi | Yalnızca Agent'ın kendi `ProgramData` dizini |
| Ağ erişimi | Yalnızca KroptOS uç noktası + yapılandırmada tanımlı ERP adresi |

`AGENT+SQL`'in ikinci kuralı (08 §6.2 önerisiyle aynı): **yazma yalnızca API/COM üzerinden.**
Doğrudan SQL yazmak ERP'nin iş mantığını (stok hareketi, muhasebe fişi, dönem kontrolü)
atlar; hatanın faturası müşteriye çıkar ve geri dönüşü yoktur.

### 4.5 İş tipleri — kapalı küme (v1)

```ts
type AgentJobType =
  | 'CONNECTION_TEST'
  | 'COMPANY_LIST'           // firma/dönem keşfi
  | 'WAREHOUSE_LIST'         // ERP depo kodları
  | 'PRODUCT_SEARCH'         // kart arama (eşleme ekranı)
  | 'PRODUCT_FETCH'          // tek kart
  | 'STOCK_SNAPSHOT'         // tam sayım
  | 'STOCK_DELTA'            // imleçli değişim
  | 'PARTNER_UPSERT'         // cari kart
  | 'PARTNER_FETCH'
  | 'RECEIPT_PUSH'           // tahsilat
  | 'INVOICE_PUSH'
  | 'INVOICE_FIND_BY_REF'    // §7.3 — asılı kalan yazmanın tek çıkışı
  | 'INVOICE_CANCEL';
```

Yeni bir sağlayıcı bu listeye ekleme yaptırıyorsa çatı sağlayıcıya sızmıştır (§8, test 21).
Sağlayıcıya özgü ihtiyaçlar `payload.providerExtras` ile taşınır (06 §4.8 kuralları aynen).

### 4.6 Kurulum, güncelleme, sürüm uyumu

| Konu | Karar |
|---|---|
| Paket | İmzalı MSI. Authenticode imzası doğrulanmadan kurulmaz |
| Hesap | LocalSystem **değil** — kısıtlı özel servis hesabı. COM/ERP erişimi için gereken minimum hak |
| Güncelleme | Sunucu **yeni sürüm var** der; Agent paketi imza doğrulayarak indirir, kurar. Sunucu ikili kod göndermez |
| Kademe | Kanallar: `canary` → `stable`. Kiracı bazlı kademeli yayın |
| Geri alma | Bir önceki sürüm yerelde tutulur; başlatma sağlık kontrolü 3 kez başarısız olursa otomatik geri alınır |
| Sürüm uyumu | Sunucu `protocolVersion` N ve N-1 kabul eder. Eski Agent **çalışmaya devam eder**, yalnızca yeni iş tiplerini reddeder |
| Zorunlu yükseltme | Yalnızca güvenlik düzeltmesinde; panelde uyarı + gün sayacı, sonra iş verilmez |

### 4.7 Gözlem

| Sinyal | Nerede |
|---|---|
| `lastHeartbeatAt`, `agentVersion`, `osVersion`, ERP sürümü, saat farkı | `AgentInstance` |
| İş sayaçları: kuyrukta / çalışıyor / başarılı / başarısız | Agent → kalp atışı içinde |
| Her iş: süre, durum, hata kodu (payload **maskeli**) | `IntegrationLog` |
| Tekrarlayan arıza | Problem kuyruğu: `agent_offline`, `erp_auth_failed`, `erp_session_limit`, `mapping_missing`, `stock_sync_stale`, `invoice_stuck` |

**Saat farkı özellikle ölçülür:** ERP'ye tarihli kayıt yazılıyor ve Logo REST'te şifre
hash'ine benzer tarih bağımlı akışlar başka sağlayıcılarda görüldü (08, Mikro satırı).
Sunucu ile Agent arasında 5 dakikadan fazla fark varsa uyarı üretilir.

### 4.8 Çevrimdışı davranış

- Agent çevrimdışıyken sunucu iş **biriktirir**, `ttlSec` dolan işi `EXPIRED` yapar ve
  kuyruktan düşürür (sessizce atmaz — problem kuyruğuna yazar).
- Stok okuma işleri birikmez: aynı `(integration, company)` için kuyrukta yalnızca **en son**
  `STOCK_DELTA` durur (coalescing). 12 saat çevrimdışı kalan bir Agent döndüğünde 24 kez stok
  çekmez.
- Yazma işleri **birikir ve sırası korunur** — biri düşerse sonrakiler bloke olur; sessizce
  atlanmaz.
- Panelde bağlantı durumu üç değerlidir: `Bağlı` / `Bağlı değil (son görülme: …)` / `İptal edildi`.

---

## 5. Backend connector çekirdeği

### 5.1 `AccountingConnector` portu

```ts
export abstract class AccountingConnector {
  abstract readonly providerId: AccountingProviderId;
  abstract readonly capabilities: AccountingCapabilities;

  // zorunlu
  abstract testConnection(ctx: AccountingContext): Promise<ConnectionTestResult>;
  abstract listCompanies(ctx: AccountingContext): Promise<ErpCompany[]>;

  // yetenek bazlı — SUPPORTED değilse çağrı SAHTE BAŞARI DÖNDÜRMEZ
  abstract listWarehouses?(ctx: AccountingContext): Promise<ErpWarehouse[]>;
  abstract searchProducts?(ctx: AccountingContext, q: ProductQuery): Promise<ErpProduct[]>;
  abstract fetchStock?(ctx: AccountingContext, q: StockQuery): Promise<ErpStockLine[]>;
  abstract upsertPartner?(ctx: AccountingContext, p: PartnerInput): Promise<ErpPartnerRef>;
  abstract pushReceipt?(ctx: AccountingContext, r: ReceiptInput): Promise<ErpDocumentRef>;
  abstract pushInvoice?(ctx: AccountingContext, i: InvoiceInput): Promise<ErpDocumentRef>;
  abstract findInvoiceByRef?(ctx: AccountingContext, ref: string): Promise<ErpDocumentRef | null>;
  abstract cancelInvoice?(ctx: AccountingContext, ref: ErpDocumentRef): Promise<CancelResult>;
}
```

`AccountingContext` **kimlik taşımaz** — oturum anahtarı ve transport taşır:

```ts
interface AccountingContext {
  integrationId: string;
  companyKey: CompanyKey;        // companyNo + periodNo? + branchCode?
  environment: 'MOCK' | 'TEST' | 'PRODUCTION';
  transport: AccountingTransport;
  isTestMode: boolean;
}
```

Bu imza, kararın koda yansımasıdır: **backend ERP şifresini görmediği için taşıyamaz.**
Connector "şu işi yap" der, `transport` onu ya doğrudan HTTP ile ya Agent'a iş bırakarak
gerçekleştirir; kimliği yalnızca Agent bilir.

### 5.2 `AccountingTransport` — rotanın soyutlandığı tek yer

```ts
export interface AccountingTransport {
  readonly kind: 'DIRECT' | 'AGENT';
  execute<T>(op: TransportOperation): Promise<T>;
}
```

- `DirectTransport`: bulut sağlayıcı. `op`'u HTTP çağrısına çevirir, credential'ı
  `AccountingCredentialService` ile çözer (klasik yol, 06 §4.4).
- `AgentTransport`: `op`'u `AgentJob` zarfına sarar, `AgentGateway`'e bırakır, sonucu bekler.
  Zaman aşımı, yeniden deneme ve `fromCache` yorumu burada yapılır.

**Sonuç:** `logo-rest` connector'ı Agent'ı bilmez. Aynı connector, müşteri bir gün ERP'yi
bulutta barındırırsa `DirectTransport` ile çalışır — tek satır değişmeden. 08 §2.2'nin
uygulanışı budur.

### 5.3 Oturum anahtarı — çatının en kolay atlanan parçası

```ts
type CompanyKey = { companyNo: string; periodNo?: string; branchCode?: string };
type SessionKey = `${integrationId}:${companyNo}:${periodNo ?? '-'}:${branchCode ?? '-'}`;
```

`SessionKey` şunların hepsinin anahtarıdır: token cache, ERP oturum havuzu, throttle sayacı,
yazma serileştirme kilidi.

**Neden 07 §2'den sapıldı:** Logo REST'te `firmno` token isteğinin gövdesindedir (§1.1);
LogoObjects'te `Login(user, pass, firmaNo, dönemNo)` firmayı ve dönemi oturuma kilitler.
Token bağlantı düzeyinde cache'lenirse **2 numaralı firmanın token'ıyla 3 numaralı firmaya
kayıt atılır** — ve bu hata exception vermez, yanlış firmada doğru görünen bir fiş bırakır.
07'deki kural kargoda doğruydu (hesap numarası istek parametresiydi); burada firma **kimliğin
bir parçasıdır**, bu yüzden anahtara girer.

### 5.4 Yetenek, hazırlık ve descriptor

06 §4.3 modeli aynen kullanılır (`CapabilityStatus`, `IntegrationReadiness`). Muhasebeye özgü
üç ek alan:

```ts
interface AccountingProviderDescriptor {
  id: AccountingProviderId;            // 'logo-rest' | 'logo-objects' | 'netsis' | ...
  displayName: string;
  vendorFamily: string;                // 'logo' — üçü aynı aileden, ama AYRI sağlayıcı
  productScope: string[];              // ['Tiger 3','Tiger Wings', ...] — §1.1 kapsamı
  protocol: 'REST' | 'COM' | 'SQL' | 'MIXED' | 'UNKNOWN';
  supportedRoutes: Array<'DIRECT' | 'AGENT'>;
  erpClass: 'ERP' | 'PRE_ACCOUNTING';  // 08 §2.4 — stok vaadi bu alana bakar
  requiresPeriod: boolean;             // logo-objects: true
  requiresBranch: boolean;             // netsis: muhtemelen true (DOCUMENTATION_REQUIRED)
  commercialPrerequisite?: string;     // i18n anahtarı: "Logo Çözüm Ortağı kaydı gerekir"
  licensePrerequisite?: string;        // "NetOpenX Runtime lisansı (kullanıcı sayısına göre)"
  readiness: IntegrationReadiness;
  documentationStatus: 'DOCUMENTATION_REQUIRED' | 'PARTIAL' | 'VERIFIED';
  lastVerifiedAt: string | null;
  credentialSchema: CredentialFieldSpec[];
  capabilities: AccountingCapabilities;
}
```

`commercialPrerequisite` ve `licensePrerequisite` **kod alanı değil, satış alanıdır** ve
panelde bağlantı kurulmadan **önce** gösterilir. 08 §6.5'in uyarısı: *"Ticari kanal bugün
açılmazsa Faz D kodla hızlanmaz."* Bu iki alan o uyarıyı ürüne taşır.

### 5.5 Credential şeması — `storage` alanı eklenir

06 §4.4'teki `CredentialFieldSpec`'e tek alan eklenir:

```ts
storage: 'SERVER_ENCRYPTED' | 'AGENT_LOCAL';
```

| Sağlayıcı | Alan | storage |
|---|---|---|
| `logo-rest` | `clientId`, `clientSecret`, `username`, `password` | `AGENT_LOCAL` |
| `logo-rest` | `baseUrl`, `port` | `SERVER_ENCRYPTED` (sır değil, yapılandırma) |
| `logo-objects` | `username`, `password` | `AGENT_LOCAL` |
| `netsis` | `username`, `password`, `dbUser`, `dbPassword` | `AGENT_LOCAL` |
| bulut sağlayıcı | tümü | `SERVER_ENCRYPTED` |

Frontend formu bu şemadan üretilir; `AGENT_LOCAL` alanlar §4.4.3'teki uçtan uca şifreli
yolla gider, `SERVER_ENCRYPTED` alanlar mevcut `encryption.util` yolundan. **İki yol tek
formda birleşir, kullanıcı farkı görmez** — ama kod farkı asla karıştırmaz.

### 5.6 Sağlayıcıdan bağımsız nesne modeli

Çekirdek nesneler Logo'nun değil KroptOS'un dilinde tanımlanır (`ErpProduct`, `ErpStockLine`,
`ErpPartner`, `InvoiceInput`, `ErpDocumentRef`). Logo/Netsis alan adları **yalnızca**
`*/mapper.ts` dosyalarında görünür.

**Yasak:** `LOGICALREF`, `FICHENO`, `CLIENTREF` gibi ERP'ye özgü adların çekirdek tipe
sızması. Bugün Logo'ya sızan bir alan, yarın Paraşüt connector'ında anlamsız `null` olur.

> **DOCUMENTATION_REQUIRED:** Bu belge Logo/Netsis tablo, alan, nesne ya da metot adlarını
> **doğrulanmış bilgi olarak kullanmaz.** Yukarıdaki üç ad yalnızca "çekirdeğe girmemesi
> gereken şeyin" örneği olarak, yasak listesinde geçmektedir.

---

## 6. Veri modeli

### 6.1 Kiracı seviyesi — verilmesi gereken karar

Mevcut `ErpStockSettings` **`agencyId String @unique`** ile tanımlı: bir ajansın **tek bir**
ERP bağlantısı olabiliyor. Bu, çok müşterili bir ajansta ilk gün kırılır — çünkü ERP bir
ajansa değil, **bir tüzel kişiye** aittir ve tüzel kişi KroptOS hiyerarşisinde `Client`'tır.

**Öneri:** muhasebe bağlantısı `agencyId` + `clientId` düzeyinde tutulur (`clientId`
nullable — ajansın kendi ERP'si için). `storeId` **kullanılmaz**: mağazalar aynı tüzel
kişinin satış noktalarıdır, ayrı muhasebeleri yoktur.

Bu, mevcut şemadan bir sapmadır ve bilinçli alınmalıdır. Alınmazsa alternatif tek yol her
müşteri için ayrı ajans açmaktır — ki bu, ürünün kiracı modelini bozar.

### 6.2 Modeller

> Alan adları öneridir; `schema.prisma` konvansiyonlarına (cuid id, `createdAt/updatedAt`,
> soft delete gereken yerde `deletedAt`, tenant index'i) uyar.

```prisma
model AccountingIntegration {          // KİMLİK
  id            String    @id @default(cuid())
  agencyId      String
  clientId      String?
  provider      String    // 'logo-rest' | 'logo-objects' | 'netsis' | 'parasut' | ...
  displayName   String
  route         String    // 'DIRECT' | 'AGENT'          ← bağlantının özelliği (08 §2.2)
  environment   String    @default("MOCK") // MOCK | TEST | PRODUCTION
  agentId       String?   // route='AGENT' ise zorunlu
  config        Json      // baseUrl, port, timeout — SIR DEĞİL
  credentialRef Json?     // SERVER_ENCRYPTED alanlar (şifreli). AGENT_LOCAL alanlar burada YOK
  credentialSetAt   DateTime?
  credentialSetBy   String?
  credentialFingerprint String?
  status        String    @default("disconnected")
  lastTestAt    DateTime?
  lastErrorCode String?
  isActive      Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  @@unique([agencyId, clientId, provider, displayName])
  @@index([agencyId])
  @@index([agentId])
}

model AccountingCompany {              // FİRMA EKSENİ (08 §2.3)
  id            String   @id @default(cuid())
  integrationId String
  agencyId      String   // denormalize — tenant filtresi join'siz çalışsın
  companyNo     String
  periodNo      String?
  branchCode    String?
  title         String?
  currency      String   @default("TRY")
  defaultAccountCodes Json?     // hesap planı eşlemeleri
  invoiceSeries String?
  isDefault     Boolean  @default(false)
  isActive      Boolean  @default(true)

  @@unique([integrationId, companyNo, periodNo, branchCode])
  @@index([agencyId])
}

model AgentInstance {
  id              String    @id @default(cuid())
  agencyId        String
  clientId        String?
  name            String    // "MERKEZ-SRV01"
  status          String    @default("PENDING") // PENDING|ACTIVE|OFFLINE|REVOKED
  publicKey       String    // §4.4.3 uçtan uca şifreleme için
  certFingerprint String?
  agentVersion    String?
  osVersion       String?
  protocolVersion Int?
  clockSkewSec    Int?
  lastHeartbeatAt DateTime?
  connectedNodeId String?   // YALNIZCA gözlem — yönlendirme Redis pub/sub ile
  enrolledAt      DateTime?
  revokedAt       DateTime?
  revokedBy       String?

  @@unique([agencyId, name])
  @@index([agencyId])
  @@index([status])
}

model AgentEnrollmentCode {
  id         String    @id @default(cuid())
  agencyId   String
  clientId   String?
  codeHash   String    @unique   // kodun kendisi SAKLANMAZ
  createdBy  String
  expiresAt  DateTime
  usedAt     DateTime?
  usedByAgentId String?

  @@index([agencyId])
}

model AgentJob {
  id             String    @id @default(cuid())
  agencyId       String
  agentId        String
  integrationId  String
  companyKey     String    // SessionKey — §5.3
  type           String
  payload        Json      // MASKELİ — credential asla girmez
  idempotencyKey String?
  status         String    @default("queued") // queued|dispatched|running|ok|failed|expired
  attempt        Int       @default(0)
  notBefore      DateTime?
  expiresAt      DateTime
  startedAt      DateTime?
  finishedAt     DateTime?
  durationMs     Int?
  errorCode      String?
  resultRef      Json?
  createdAt      DateTime  @default(now())

  @@unique([agentId, idempotencyKey])   // null'lar çakışmaz (Postgres)
  @@index([agencyId])
  @@index([agentId, status])
  @@index([integrationId, companyKey, status])
}

model AccountingDocumentLink {          // İDEMPOTENCY + DEFTER (§7.3)
  id            String    @id @default(cuid())
  agencyId      String
  integrationId String
  companyKey    String
  sourceType    String    // 'ORDER' | 'RETURN' | 'PAYMENT'
  sourceId      String    // KroptOS kaydının id'si
  externalRef   String    // KroptOS'un ürettiği dış referans — ERP'ye yazılır
  erpDocumentId String?   // ERP'nin döndürdüğü kimlik — claim anında NULL
  erpDocumentNo String?
  status        String    @default("claimed") // claimed|written|failed|cancelled|stuck
  lastError     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([agencyId, integrationId, companyKey, sourceType, sourceId])
  @@unique([integrationId, companyKey, externalRef])
  @@index([agencyId])
  @@index([status])
}

model AccountingSyncCursor {
  id            String   @id @default(cuid())
  integrationId String
  companyKey    String
  stream        String   // 'STOCK' | 'PRODUCT' | 'PARTNER'
  cursor        String?  // ERP'nin verdiği imleç ya da son değişim damgası
  lastFullSyncAt DateTime?
  lastDeltaAt    DateTime?
  staleSince     DateTime?

  @@unique([integrationId, companyKey, stream])
}
```

### 6.3 Mevcut modellerle ilişki — yerine değil, üstüne

| Mevcut | Akıbet |
|---|---|
| `ErpStockSettings` | **Korunur, kullanımdan kaldırılır (deprecate).** Backfill: her satır → 1 `AccountingIntegration` + 1 `AccountingCompany` (`companyNo`, `periodNo` oradan gelir) |
| `LogoWarehouseMapping` | Korunur; `integrationId` + `companyKey` alanları eklenir. `agencyId`-tekil varsayımı kalkar |
| `LogoProductMapping` | Aynı. Ayrıca `status` sözlüğü (`matched`/`unmatched`) korunur, yeni sözlük tanımlanmaz |
| `Product.erpCode` / `erpId` | Korunur — tek ERP'li müşteride hızlı yol olarak kalır; çok ERP'de `LogoProductMapping` otoritedir |
| `StockSourceSettings.mode` | Korunur; `'logo'`/`'netsis'` değerleri artık bağlantı kaydına işaret eder |
| `StockMovement.source = 'LOGO'` | Korunur. Yeni sağlayıcılar için `'ERP'` değeri eklenir, `'LOGO'` geriye dönük kalır |

**Frontend taşınana kadar eski model silinmez.** Çift yazma değil, **tek yön okuma**: yeni
kod yeni modelden okur, eski ekranlar eski modelden okumaya devam eder, backfill tek yönlüdür.

### 6.4 Migration politikası

06 §4.10 aynen: **`prisma migrate dev` / `pnpm db:migrate` ÇALIŞTIRILMAZ.** Şema diff'i
`npx prisma migrate diff ... --script > docs/plans/muhasebe-agent-catisi.sql` olarak üretilir,
lokale `pnpm db:push` ile uygulanır, SQL dosyası PR'a girer.

---

## 7. Dört akışın semantiği

### 7.0 Sınıf uyarısı — vaat sağlayıcıya değil sınıfa verilir

08 §2.4: gerçek stok yalnızca ERP sınıfında anlamlıdır. Logo ailesinin üçü de `erpClass: 'ERP'`
olduğu için dört akış da anlamlıdır. Bulut ön muhasebe eklendiğinde `erpClass: 'PRE_ACCOUNTING'`
olur ve stok akışı **panelde gösterilmez** — desteklenmeyen bir akışı gri göstermek yerine hiç
göstermemek doğru davranıştır.

### 7.1 Ürün kartı eşleşmesi — diğer üçünün ön koşulu

Sıra zorunludur: **eşleme olmadan ne stok okunur ne fatura yazılır.**

| Adım | Davranış |
|---|---|
| Otomatik eşleme | Sırayla: barkod → SKU = ERP stok kodu → isim benzerliği (**yalnızca öneri**, otomatik kabul edilmez) |
| Toplu ekran | `/t/{tenant}/accounting/mapping` — eşleşmeyenler listesi, tekil ve toplu eşleme, CSV içe/dışa aktarma |
| Eşleşmeyen ürün | Stok senkronunda **atlanır ve sayılır**; sayı eşiği aşarsa problem kuyruğuna `mapping_missing` |
| Varyant | `ErpStockSettings.variantTracking` mevcut alanı korunur; varyantlı ERP kartı `variantCode` ile eşlenir |
| Kart oluşturma | KroptOS'tan ERP'ye kart açma **ilk fazda kapalıdır.** Yanlış açılmış bir stok kartı ERP'de silinemez, sadece pasifleştirilir — geri dönüşü olmayan bir yazma |

### 7.2 Stok: ERP → KroptOS (salt okuma)

```
ERP  ──STOCK_SNAPSHOT / STOCK_DELTA──►  Agent  ──►  KroptOS
```

| Kural | Değer |
|---|---|
| Yön | **Tek yön, okuma.** İlk fazda KroptOS ERP'ye stok yazmaz |
| Depo kapsamı | `ErpStockSettings.erpDepotCodes` + `LogoWarehouseMapping`. Eşlenmemiş ERP deposu **yok sayılmaz**, uyarı üretir |
| Tam sayım | Günde 1 kez (gece), `AccountingSyncCursor.lastFullSyncAt` |
| Delta | `syncPeriodMinutes` (mevcut alan, varsayılan 30) |
| İmleç güvenilmezse | Sağlayıcı güvenilir değişim damgası veremiyorsa **delta yoktur**; yalnızca tam sayım çalışır ve `capabilities.stockDelta = 'NOT_SUPPORTED'` olur. Sahte delta, sessizce eskiyen stok demektir |
| Yazma | `Inventory` + `StockMovement` (`source: 'ERP'`, `reference: syncSessionId`) |
| Bayatlık | Son başarılı senkron üzerinden `3 × syncPeriodMinutes` geçtiyse `stock_sync_stale` problem kaydı **ve panelde uyarı**. Bayat stokla pazaryerine bildirim yapmak aşırı satışa yol açar |

**Kritik:** stok bayatlığı sessiz kalmamalıdır. Kargo dokümanı §6'daki asimetri kuralı burada
birebir geçerli — *eksik bilginin maliyeti bir fazladan çekim, yanlış bilginin maliyeti
satılmış olmayan stoktur.*

### 7.3 Fatura: KroptOS → ERP (tek yazma akışı)

Bu, çatının **en riskli** akışıdır: geri alınamayan bir yazma.

#### 7.3.1 Üç katmanlı idempotency

```
1. SUNUCU CLAIM (ağ çağrısından ÖNCE)
   AccountingDocumentLink satırı: status='claimed', erpDocumentId=NULL
   externalRef = deterministik üretilir (aşağıda)
   → P2002 (agencyId, integrationId, companyKey, sourceType, sourceId)
       = yarış; kazananı OKU ve DÖN, ERP'ye HİÇ gitme

2. AGENT KASASI (tünel kopmasına karşı)
   idempotencyKey = externalRef
   Agent aynı anahtarı görürse ERP'ye gitmez, saklı sonucu döner (§4.3.2)

3. ERP DIŞ REFERANSI (gerçek kanıt)
   externalRef, sağlayıcının bildirdiği bir alana YAZILIR
   findInvoiceByRef(externalRef) ile geri okunabilir
```

Üçü de gereklidir ve hiçbiri diğerinin yerine geçmez:
katman 1 eşzamanlı iki isteği, katman 2 kopan tüneli, katman 3 **her ikisi de başarısız
olduğunda gerçeği** yakalar.

```
externalRef = `KRP-${sourceType}-${sourceId}`        # deterministik, tahmin edilebilir
```

> **DOCUMENTATION_REQUIRED:** `externalRef`'in Logo/Netsis tarafında **hangi alana**
> yazılacağı doğrulanmadı (özel kod, açıklama, belge no vb. adaylardır). Alan doğrulanmadan
> `pushInvoice` yeteneği `DOCUMENTATION_REQUIRED` kalır ve **üretimde açılmaz.**
> Alan yoksa 7.3.3 geçerlidir.

#### 7.3.2 Asılı kalan yazma (stuck claim)

Zaman aşımı ya da bilinmeyen hata → `status = 'stuck'`. Tek güvenli çıkış:

```
INVOICE_FIND_BY_REF(externalRef)
  → bulundu   → erpDocumentId yaz, status='written'   (yazılmış, cevabı kaybolmuş)
  → bulunamadı→ status='failed', yeniden denenebilir  (yazılmamış)
```

`findInvoiceByRef` **atlanamaz.** Sağlayıcı destekleyemiyorsa 7.3.3 geçerlidir.

#### 7.3.3 `findInvoiceByRef` yoksa: otomatik yazma kapalıdır

Bu, çatının vermesi gereken **dürüst** karardır. Dış referansla geri okunamayan bir ERP'ye
otomatik fatura yazmak, her zaman aşımında "acaba yazıldı mı" sorusunu operasyona havale
etmek demektir. Karşılığı çift kesilmiş faturadır.

Bu durumda `pushInvoice` yeteneği `CONTRACT_REQUIRED` işaretlenir ve akış
**onaylı moda** düşer: KroptOS fatura taslağını hazırlar, kullanıcı panelde onaylar, sistem
yazar ve **sonucu kullanıcıya doğrulatır**. Yavaştır; yanlış değildir.

#### 7.3.4 İptal — iki adım, kargodaki gibi

```
cancelInvoice(ref)
  → ERP onayladı        → status='cancelled'
  → ERP reddetti        → status='written', operasyona "ERP'den manuel iptal gerekiyor"
  → belge hiç yok       → status='cancelled' (KroptOS tarafı kapanır)
```

Üç dalda da **KroptOS tarafı kapanır** — açık kalan bir claim sonraki denemeyi kilitler.

İptal sonrası yeniden yazma gerekirse `externalRef` yeni bir sürüm alır (`KRP-ORDER-123:2`),
`sourceId` değişmez. Kargo çatısındaki `orderId:2` kalıbının aynısı.

#### 7.3.5 Dönem sınırı

Kapanmış bir muhasebe dönemine yazma **denenmez**: `AccountingCompany.periodNo` ile gelen
faturanın tarihi uyuşmuyorsa iş daha Agent'a gitmeden reddedilir ve operasyona anlaşılır bir
hata döner. ERP'nin dönem hatasını yorumlamaya çalışmak, sağlayıcı başına ayrı hata kodu
sözlüğü demektir.

### 7.4 Cari + tahsilat

| Konu | Karar |
|---|---|
| Cari kart | `PARTNER_UPSERT`. Eşleştirme anahtarı: VKN/TCKN → yoksa ERP cari kodu → **isim asla anahtar değildir** |
| Yeni cari açma | Açık (ürün kartından farklı olarak) — ama **yalnızca fatura akışının ön adımı olarak**, toplu cari aktarımı ilk fazda yok |
| Tahsilat | `RECEIPT_PUSH`, idempotency `KRP-PAYMENT-{paymentId}`, fatura ile aynı üç katman |
| Bakiye okuma | İlk fazda **yok.** Bakiye ERP'nin gerçeğidir; KroptOS'ta kopyalamak iki kaynaklı gerçek yaratır |
| Mutabakat | Kapsam dışı |

---

## 8. Uygunluk test paketi

`accounting/core/__conformance__/connector-conformance.spec.ts` — registry'deki **her**
connector otomatik kapsanır (06 §5 kalıbı).

06 §5'teki 20 testin muhasebeye uyarlanan karşılıkları geçerlidir (yetenek eksiksizliği,
sahte başarı yasağı, `readiness < PRODUCTION_READY` iken ağ isteği yapılmaması,
`lastVerifiedAt` zorunluluğu, mock işaretleri, credential maskeleme, tenant izolasyonu,
registry-connector tutarlılığı, geçersiz credential'da retry yasağı, `providerExtras` şema
dışı anahtar reddi). Ek olarak **muhasebeye özgü on bir test**:

| # | Test |
|---|---|
| 21 | Registry'deki hiçbir sağlayıcı `AgentJobType` kümesine ekleme yapmıyor (çatı sızıntısı kontrolü) |
| 22 | Token/oturum cache anahtarı `SessionKey` içeriyor: iki farklı `companyNo` **aynı token'ı paylaşmıyor** |
| 23 | `AccountingContext` içinde hiçbir credential alanı yok (tip düzeyinde ve çalışma zamanında) |
| 24 | `AGENT_LOCAL` işaretli bir alan sunucu tarafında **hiçbir koşulda** persist edilmiyor |
| 25 | Aynı `(sourceType, sourceId)` ile iki `pushInvoice` → tek `AccountingDocumentLink`; P2002 dalında connector **çağrılmıyor**; çağrı sırası `['claim','connector']` |
| 26 | `pushInvoice` zaman aşımı → satır `stuck`, exception yutulmuyor, `INVOICE_FIND_BY_REF` çağrılabiliyor |
| 27 | `findInvoiceByRef` yeteneği `SUPPORTED` değilken otomatik `pushInvoice` **reddediliyor** (onaylı mod zorunlu) — §7.3.3 |
| 28 | İptalin üç dalında da KroptOS tarafı kapanıyor |
| 29 | `erpClass: 'PRE_ACCOUNTING'` sağlayıcıda stok yeteneği `NOT_SUPPORTED` ve panelde gösterilmiyor |
| 30 | Stok delta imleci güvenilir değilse `stockDelta = 'NOT_SUPPORTED'` ve yalnızca tam sayım çalışıyor |
| 31 | Kapanmış döneme yazma denemesi connector'a **ulaşmadan** reddediliyor |

**Agent tarafı için ayrı paket** (`agent/tests/`):

| # | Test |
|---|---|
| A1 | Aynı `idempotencyKey` ile ikinci iş → ERP'ye çağrı **yok**, `fromCache: true` |
| A2 | Kapalı küme dışı `type` → iş reddediliyor, çalıştırılmıyor, loglanıyor |
| A3 | `REVOKED` cevabı → yerel kasa siliniyor, Agent duruyor |
| A4 | COM köprüsü çöktüğünde Host ayakta kalıyor, köprü yeniden doğuyor, iş `RETRYABLE` dönüyor |
| A5 | `jobTimeoutSec` aşımında köprü süreci **öldürülüyor** (iptal denenmiyor) |
| A6 | Yazma işleri `(integration, company)` başına serileşiyor; okuma tavanı aşılmıyor |
| A7 | Çevrimdışı → `STOCK_DELTA` işleri coalesce oluyor, yazma işleri sıralı birikiyor |
| A8 | `ttlSec` dolan iş `EXPIRED`, sessizce atılmıyor |
| A9 | Credential blob'u çözüldükten sonra bellekte kalmıyor; hiçbir log satırında görünmüyor |

**Kabul kriteri (06 §5 ile aynı):** yeni bir connector eklendiğinde uygunluk paketine **tek
satır** eklenmeden kapsanıyor olmalı.

**Kanıt sınırı:** bu testler Prisma mock'u üzerinden çalışır; gerçek unique index'in yarışı
kilitlediğini kanıtlamaz. Tablolar açıldıktan sonra iki eşzamanlı `POST /api/accounting/invoices`
ile entegrasyon testi yazılır — asıl kanıt odur.

---

## 9. Faz planı

| Faz | İçerik | Çıktı | Bağımlılık |
|---|---|---|---|
| **A** | Veri modeli + connector çekirdeği + transport soyutlaması + registry. Sağlayıcı kodu yok | `db push` + SQL diff, `accounting/core/` | — |
| **B** | **Agent v0 + COM duman testi** | Uçtan uca boru + COM gerçeklerinin ölçümü | A |
| **C** | Uygunluk paketi + `_template` + `pnpm accounting:new` | 31 + 9 test, iskelet üretici | A, B |
| **D** | Referans #1: REST sınıfı (`netsis` NOX REST önerilir) | `TEST_READY` | C |
| **E** | Referans #2: COM sınıfı (`logo-objects` / GO3) | `TEST_READY` | D |
| **F** | Üçüncü varyant (`logo-rest` / Tiger) + frontend tamamlanması | `SCAFFOLDED` → `TEST_READY` | E |

### 9.1 Faz B neden erken ve neden iki parçalı

**B1 — Boru:** Agent enrollment, tünel, iş döngüsü, kalp atışı, yerel kasa ve `MOCK`
connector. ERP yok. Bu aşamada kanıtlanan şey: *iş sunucudan çıkıyor, müşteri sunucusunda
çalışıyor, sonuç geri geliyor, tünel kopunca iş ikilenmiyor.*

**B2 — COM duman testi:** Logo'nun kurulu olduğu **tek bir** test makinesinde, `logo-objects`
için asgari üç soruya cevap alınır ve sonuç dokümana yazılır:

1. COM sunucusu x86 mı x64 mü?
2. Apartment modeli STA mı? Servis hesabı (Session 0) altında oturum açılabiliyor mu?
3. Eşzamanlı kaç oturum açılabiliyor, lisans hangi noktada reddediyor?

Bu üç cevap alınmadan `logo-objects` ve `netsis`-COM **`MOCK_READY`'den öteye geçmez.**
Faz B'de ölçülmezse Faz E'de öğrenilir — ve Faz E'de öğrenilen bir bit uyumsuzluğu Agent
mimarisini yeniden yazdırır.

> Bu, 06 §1'deki "spekülatif soyutlama" riskine karşı bu çatının asıl savunmasıdır:
> **en pahalı bilinmeyen en erken fazda ölçülür.**

### 9.2 Gün 0'da başlayan ticari işler (kod beklemez)

08 §6.5 ve 06 §8 adım 1 birleşimi. Bunlar **yazılım işi değildir** ve kodla hızlanmaz:

| İş | Kim | Neden gün 0 |
|---|---|---|
| Logo Çözüm Ortağı kaydı / ClientId-Secret kanalı | Satış | `logo-rest` bu olmadan **hiç** test edilemez (§1.1) |
| NetOpenX Runtime lisansı — kaç istemci? | Satış + müşteri | Lisans kullanıcı sayısına bağlı, müşteriye maliyet çıkar (§1.3) |
| Test ortamı olan bir müşteri (GO3 ve Tiger için ayrı) | Satış | Üretim ERP'sinde test yazma yapılmaz |
| Logo kurulu bir test sunucusu (B2 için) | Ops | COM duman testi bunsuz yapılamaz |

---

## 10. Onboarding runbook — üç varyant

`accounting/README.md`'ye girecek akış:

| # | Adım | `logo-rest` (Tiger 3/Wings) | `logo-objects` (GO3) | `netsis` |
|---|---|---|---|---|
| 0 | Ürün ve sürüm tespiti | Tiger 3 / Wings mi? GO3 ise **bu satır değil** | GO3 / Go Plus / Tiger Plus | Netsis sürümü + NOX REST var mı |
| 1 | Ticari ön koşul | Logo Çözüm Ortağı → ClientId/Secret | Logo Objects kullanım hakkı | NetOpenX Runtime lisansı (istemci sayısı) |
| 2 | REST servis / COM kurulumu | `LogoRestServiceSetup.exe`, port (vars. 32001) | COM kayıt adımı | NOX kurulumu / `NetOpenX50.dll` kaydı |
| 3 | `pnpm accounting:new <id>` | iskelet + registry `SCAFFOLDED` | aynı | aynı |
| 4 | Agent kurulumu + kayıt kodu | müşteri sunucusuna MSI | **aynı makinede, Logo ile** | müşteri sunucusuna |
| 5 | Mock senaryolar | `MOCK_READY` | `MOCK_READY` | `MOCK_READY` |
| 6 | Kimlik girişi (§4.4.3) | clientId/secret + kullanıcı/şifre | kullanıcı/şifre | kullanıcı/şifre/şube |
| 7 | Firma + dönem keşfi | `COMPANY_LIST`, `firmno` doğrulanır | firma no + dönem no | firma + şube |
| 8 | Alan eşlemesi + durum/hata sözlüğü | dokümandan | dokümandan/deneyle | dokümandan |
| 9 | Uygunluk paketi yeşil | 31/31 + 9/9 | aynı | aynı |
| 10 | Test credential ile gerçek çağrı | `TEST_READY`, `lastVerifiedAt` | aynı | aynı |
| 11 | Canlı: önce **okuma**, sonra **onaylı yazma**, en son otomatik yazma | `PRODUCTION_READY` | aynı | aynı |

**Adım 11'in sırası pazarlık konusu değildir.** Bir müşteride ilk gün otomatik fatura yazmaya
başlamak, çatının bütün idempotency çalışmasını tek bir yanlış eşlemeyle çöpe atar.

---

## 11. Frontend

| Sayfa | İçerik |
|---|---|
| `/t/{tenant}/accounting` | Bağlantı kartları (registry'den üretilir), durum rozeti, ticari ön koşul uyarısı |
| `/t/{tenant}/accounting/[id]` | Firma/dönem listesi, credential formu (şemadan üretilir), test bağlantısı, yetenek matrisi |
| `/t/{tenant}/accounting/mapping` | Ürün ve depo eşlemesi, eşleşmeyenler, toplu işlem, CSV |
| `/t/{tenant}/accounting/jobs` | İş kuyruğu, problem kuyruğu, asılı claim'ler ve **çözme aksiyonu** (`INVOICE_FIND_BY_REF`) |
| `/t/{tenant}/agents` | Agent listesi, kayıt kodu üretme, sürüm, son görülme, iptal |

Konvansiyonlar (00 §6): `'use client'`, `apiFetch`, mantık `hooks/useXxx.ts`,
`useAuth().tenantContext`, `kp-*` token'ları, `@heroicons/react/24/outline`,
`useTranslations` + `messages/*.json` (12 dil), sidebar `navigation.accounting`.

**RBAC izinleri:** `accounting.read`, `accounting.manage`, `accounting.credential.manage`,
`accounting.invoice.push`, `agent.read`, `agent.manage`. Seed'e eklenir.
`accounting.credential.manage` ve `agent.manage` **ayrı izinlerdir** — Agent kurabilen kişi
otomatik olarak ERP şifresi girebilen kişi değildir.

---

## 12. Yasaklar

06 §9'un tamamı geçerlidir. Muhasebeye özgü ekler:

- Logo/Netsis **endpoint yolu, tablo adı, alan adı, nesne/metot adı, hata kodu, durum kodu
  uydurmak** — doğrulanmadıysa `DOCUMENTATION_REQUIRED`
- **Doğrudan SQL ile ERP'ye yazmak** (08 §6.2) — okuma bile adlandırılmış katalog sorgusuyla
- ERP credential'ını sunucuda persist etmek, loglamak, audit'e yazmak, cevapta döndürmek
- Token'ı firma ekseninden bağımsız cache'lemek (§5.3)
- `findInvoiceByRef` olmadan otomatik fatura yazmayı açmak (§7.3.3)
- Agent'a serbest komut / serbest SQL / uzaktan kod gönderilebilecek bir kapı bırakmak (§4.4.4)
- Müşteriden **gelen port açmasını** istemek (32001 dahil)
- Zaman aşımına uğrayan bir COM çağrısını "iptal etmeye çalışmak" — süreç öldürülür
- `LOGICALREF` sınıfı ERP'ye özgü adları çekirdek tiplere sızdırmak
- Gerçek çağrı yapılmadan `TEST_READY` / `PRODUCTION_READY` / `lastVerifiedAt` işaretlemek
- Mock sonucu gerçek gibi göstermek, sahte belge no üretmek
- `prisma migrate dev` çalıştırmak
- e-Fatura göndermeyi bu çatının içine gömmek (§0.5)

---

## 13. Kanıt sınırı

**Hiçbir Logo / Netsis kurulumuna, hiçbir gerçek kimlikle, tek bir çağrı yapılmadı.**
Bu doküman bir tasarımdır; ölçüm değildir.

Kesin olarak doğrulananlar §1'deki "DOĞRULANDI" satırlarıyla sınırlıdır ve kaynakları
§14'tedir. Bunların çoğu **ikincil kaynaktır** (resmî Logo geliştirici portalı GO3 ve
NetOpenX için açık değildir) ve test credential'ıyla doğrulanana kadar
`DOCUMENTATION_REQUIRED` sayılmalıdır.

Doğrulanmadı ve tasarıma **kesin bilgi olarak girmedi:** token ömürleri ve yenileme akışı,
rate limit değerleri, endpoint yolları (§1.1'deki token yolu hariç), alan adı eşlemeleri,
hata ve durum kodu sözlükleri, COM bit genişliği ve apartment modeli, eşzamanlı oturum
sınırları, NOX REST'in sözleşmesi ve minimum sürümü, `externalRef`'in yazılacağı ERP alanı.

Bu dokümanda tarif edilen **hiçbir kod yazılmadı.** Repoda `integrations/accounting/`,
`modules/agent/` ve `agent/` yoktur. 07 §0'ın kuralı burada da geçerlidir:
**bir katmanın "var" olduğunun kanıtı `git ls-files`'tır, oturum özeti değil.**

---

## 14. Kaynaklar

- Logo REST Servis rehberi (desteklenen ürünler, port, lisans) —
  https://logoyazilimdestek.com/logo-rest-servis-rehberi/
- Logo REST Servis token alma (Postman; `/api/v1/token`, Basic + `firmno`) —
  https://logoyazilimdestek.com/logo-rest-servis-token-alma-postman/
- Logo REST Servis kurulumu — https://www.datasource.com.tr/blog-logo-rest-servis-kurulumu.html
- Logo Objects ile fatura (UnityApplication, `Login(user, pass, firma, dönem)`) —
  https://www.kemalbayat.com.tr/2017/02/22/logo-objects-ile-fatura-kesmek-yontem-1/
- NetOpenX nedir (COM, `NetOpenX50.dll`, Runtime lisansı kullanıcı sayısına göre) —
  https://netopenxnet.blogspot.com/2021/01/netopenx-nedir.html
- NetOpenX kaynakları — http://www.netopenx.com/netopenx-baslangic/
- NOX REST kullanımının forum kayıtları (401 / yetkilendirme) —
  https://forum.logo.com.tr/
- Logo Polaris — Tiger Uyarlama Araçları → Logo REST Servis Ayarları / Logo Objects REST Servis —
  https://polaris.logo.cloud/
- Proje içi: `claude/06_KARGO_ON_ENTEGRASYON_CATISI.md`, `claude/07_KARGO_BAGLANTI_MODELI.md`,
  `claude/08_MUHASEBE_BAGLANTI_MATRISI.md`, `00_PROJECT_CONTEXT.md`,
  `03_ROUTE_AND_MODULE_MAP.md`, `packages/backend/prisma/schema.prisma`