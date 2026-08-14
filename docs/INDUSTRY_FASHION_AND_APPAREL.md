# Sektör Sayfası Şartnamesi — Moda & Tekstil (`fashion-and-apparel`)

> **Rota:** `/[locale]/industry/fashion-and-apparel`
> **Dosya:** `packages/frontend/src/app/[locale]/industry/[slug]/page.tsx` (mevcut dinamik rota)
> **Amaç:** Moda & Tekstil sektörüne özel, **diğer sektör sayfalarının kopyası olmayan** bir
> landing deneyimi. Yeni rota/`page.tsx` **açılmaz**; mevcut dinamik rota + `SECTOR_DATA_MAP`
> genişletilir ve sektöre özgü görselleştirmeler eklenir.

---

## 0. Neden yeni sayfa değil?

Tüm industry sayfaları tek bir `[slug]/page.tsx` altında, `SECTOR_DATA_MAP` (tip: `SectorData`)
nesnesiyle sürülüyor. `fashion-and-apparel` girdisi zaten var. Ayrı bir `fashion/page.tsx` açmak
**tekrar üretmek** demek olur ve DRY'ı bozar. Bu yüzden bu şartname iki şeyi tanımlar:

1. **İçerik katmanı** — `SECTOR_DATA_MAP['fashion-and-apparel']` içindeki metin/metrik/çözüm verisi
   (moda diline göre keskinleştirilmiş, jenerik olmayan kopya).
2. **Ayırt edici görsel katman** — sadece `slug === 'fashion-and-apparel'` iken render edilen,
   moda operasyonuna özgü mockup bileşenleri (varyant matrisi, askılı/raflı depo, iade hunisi,
   sezon şeridi, beden tablosu eşleme). Sayfayı "aynı şablon" hissinden çıkaran kısım burasıdır.

---

## 1. Değişmez tasarım kuralları (bu sayfada da geçerli)

- Sadece `kp-*` token sınıfları: `bg-kp-bg-primary/-secondary/-tertiary`, `text-kp-text-primary/-secondary/-tertiary`,
  `border-kp-border/-subtle`, `text-kp-accent`, `bg-kp-accent-muted`, `rounded-kp-sm|md|lg`,
  `shadow-kp-card|dropdown|glow`. **Ham hex/renk yasak** (mockup içi durum renkleri hariç:
  `green-500`/`yellow-500`/`red-500` yalnız "canlı konsol" simülasyonlarında, mevcut kalıba sadık kalınarak).
- İkonlar: sayfa içi inline SVG bileşenleri (`IconBarcode`, `IconTruck`, ...) mevcut kalıba uygun;
  dashboard tarafındaki gibi `@heroicons/react/24/outline` de kullanılabilir (`CheckCircleIcon` zaten kullanımda).
- i18n: metinler `isTr` ile ikiye ayrılır (`titleTr/titleEn` deseni). Yeni sabit metinler
  **tüm** `messages/*.json`'a değil, mevcut kalıba uyup component içinde `isTr ? ... : ...`
  olarak tutulur (industry sayfalarının mevcut konvansiyonu budur; dashboard'daki `useTranslations`
  kalıbından farklıdır — bu sayfa landing tarafında).
- Arka plan glow'ları, `Navbar`, `Footer`, hero grid (12 kolon), çözüm döngüsü (zig-zag `lg:order`)
  yapısı korunur; bu sayfanın **iskeleti** ortak, **içeriği ve sektörel mockupları** ayırt edicidir.
- Kaynak referanslar: `00_PROJECT_CONTEXT.md`, `01_FRONTEND_PAGE_ANATOMY.md`, `03_ROUTE_AND_MODULE_MAP.md`.

---

## 2. `SECTOR_DATA_MAP['fashion-and-apparel']` içerik şartnamesi

Aşağıdaki alanlar `SectorData` tipine birebir uyar. Kopya, moda operasyonunun gerçek acı
noktalarına (varyant patlaması, askılı depo, yüksek iade, sezon geçişi) odaklanır — jenerik
"tek merkezden yönetin" cümlelerinden kaçınılır.

### 2.1. Üst blok

| Alan | Değer (TR) |
|---|---|
| `titleTr` | `Moda & Tekstil E-Ticaret Entegrasyonu \| Alqora` |
| `tagTr` | `Moda & Tekstil Sektörü İçin Alqora` |
| `h1Tr` | `Varyant, Renk ve Beden Karmaşasını Alqora ile Çözün` |
| `descTr` | Giyim, ayakkabı ve aksesuar gruplarındaki geniş renk/beden/model varyasyonlarını tek katalogda yönetme; sezon geçişi talep dalgalanması, askılı depo süreçleri ve yüksek hacimli iade operasyonunu barkodla sıfır hataya indirme vaadi. |

> İngilizce karşılıkları `*En` alanlarına, mevcut dosyadaki üslupla yazılır.

### 2.2. Metrikler (`metricsTr` / `metricsEn`)

Moda için **anlamlı** KPI'lar seçilir (jenerik "toplam satış" değil):

| label (TR) | val | trend |
|---|---|---|
| Yeni Siparişler | `2,940` | `+28%` |
| İade Oranı | `%14.2` | `Kontrol Altında` |
| Askılı Raf Stok | `8,420 Adet` | `Düzenli` |

> İade oranının burada olması bilinçli: moda sektörünün ayırt edici metriği. Trend metni `+` ile
> başlamıyorsa mockup onu `text-kp-accent` ile, başlıyorsa `text-green-500` ile gösterir (mevcut kural).

### 2.3. Çözüm bölümleri (`solutions[]`, 6 adet)

Her biri `num, tag, title, desc, features[6], mockupType`. Moda'ya özgü altı çözüm:

1. **01 / Katalog Yönetimi** — *Beden, Renk ve Varyant Matrisi* → `mockupType: 'variant'`
   Parent-Child SKU, beden tablosu eşleme, renge özel stok kartı, hızlı varyant, varyant bazlı fiyat, toplu güncelleme.
2. **02 / Depo Operasyonu** — *Askılı ve Raflı Depolama Yönetimi* → `mockupType: 'variant'`
   Askılı raf lokasyonları, katlı ürün kutulama, barkodlu el terminali, optimize toplama rotası, yerleşim denetimi, toplu lokasyon.
3. **03 / Lojistik & İade** — *Yüksek İade Hacminin Hızlı Kontrolü* → `mockupType: 'variant'`
   İade kabul barkodlama, kullanılmışlık/kusur kontrolü, otomatik stok girişi, iade onayı, muhasebe bakiye, iade sebep analizi.
4. **04 / Sezonluk Kampanya** — *Sezon Geçişleri ve Stok Rezervi* → `mockupType: 'variant'`
   Ön satış tahsisi, güvenli stok tamponu, sezon etiketi, kampanya fiyat senkronu, geri sayım indirimi, kanal limitleri.
5. **05 / Kargo Hızı** — *Hızlı Paketleme ve Fatura Basımı* → `mockupType: 'variant'`
   Toplu kargo etiketi, e-Arşiv fatura, istasyon barkod doğrulaması, paket ağırlık kontrolü, otomatik desi, kurye listesi.
6. **06 / Pazaryeri Eşleşme** — *Çok Kanallı Moda Pazaryerleri* → `mockupType: 'variant'`
   Trendyol/Hepsiburada/Amazon/Shopify varyant eşleme, anlık stok güncelleme, iptal ücreti önleme.

### 2.4. SSS (`faqs[]`) — moda'ya özel, en az 5 soru

Örnek konu başlıkları (jenerik değil, sektörel):
- Tek üründeki onlarca beden/renk kombinasyonu pazaryerlerinde nasıl tek kartta yönetilir?
- Askıda ve rafta duran ürünler için toplama rotaları nasıl ayrışır?
- Yüksek iade hacminde kusur kontrolü ve tekrar stoğa alma ne kadar sürede tamamlanır?
- Sezon geçişinde ön satış/rezerv stok overselling'i nasıl engellenir?
- Farklı pazaryerlerinin beden tablosu farklılıkları nasıl eşlenir?

---

## 3. Ayırt edici görsel katman (sayfayı "kopya" olmaktan çıkaran kısım)

Aşağıdaki bloklar **yalnız** `slug === 'fashion-and-apparel'` iken render edilir. Diğer
sektörlerin mockuplarından (expiry/IMEI/desi/coldchain) tamamen farklıdırlar. Her biri `kp-*`
token'ları + `font-mono` "canlı konsol" estetiğiyle mevcut hero mockup diliyle uyumludur.

### 3.1. Hero mockup — Varyant / Renk / Beden × Raf Lokasyonu (mevcut)

Zaten var; korunur. Kolonlar: `Variant (Color/Size)`, `Rack Location`, `Stock`. Üç örnek satır
(🔴 RED/M, 🔵 BLUE/L, ⚫ BLACK/S) + biri `text-kp-accent` ile vurgulu. Bu tablo moda için imza görsel.

### 3.2. YENİ — Parent → Child SKU Varyant Matrisi (çözüm 01 yanı)

Ayırt edici ana bileşen. Tek Parent SKU altında beden (satır) × renk (sütun) matrisi; her hücre
stok adedi + durum rozeti. Amaç: "onlarca ürünü tek kartta yönetme" vaadini **gösteren** görsel.

```
Parent SKU: TSHIRT-BASIC-001
            S      M      L      XL
  🔴 RED   120    120     85     40
  🔵 BLUE   64     90    ●110    22     ← düşük stok hücresi kp-warning
  ⚫ BLACK 210    180    150     95
```
- Grid: `grid-cols-5` (ilk sütun renk etiketi), hücreler `bg-kp-bg-primary border border-kp-border-subtle rounded`.
- Kritik/düşük stok hücresi: `text-kp-warning` + küçük nokta; tükenen hücre `text-kp-danger`.
- Başlık: `{isTr ? 'Varyant Matrisi' : 'Variant Matrix'}`, `font-mono text-[11px]`.

### 3.3. YENİ — Askılı vs Raflı Depo İkili Görünüm (çözüm 02 yanı)

İki kolonlu bir "depo haritası": solda **Askılı** (ceket/elbise), sağda **Raflı/Kutulu** (tişört).
Her ürün için zone kodu + toplama sırası. Moda deposunun gerçek ayrımını görselleştirir.

- Sol kart: `Hanging — Zone H`, satırlar: `Ceket / H-12-A`, `Elbise / H-12-B` (askı ikonu).
- Sağ kart: `Boxed — Zone A`, satırlar: `Tişört / A-42-H`, `Sweat / A-43-A` (kutu ikonu).
- Altında `Optimize Toplama Rotası: H → A (adım: 6)` mini etiketi (`text-kp-accent`).

### 3.4. YENİ — İade İşleme Hunisi (çözüm 03 yanı)

Moda'nın kritik maliyeti olan iadeyi bir akış hunisi olarak gösterir:
`İade Kabul → Barkod Okut → Kusur/Kullanılmışlık Kontrol → [Onay] Tekrar Stok / [Ret] Karantina`.

- Dikey akış, her adım `bg-kp-bg-primary border border-kp-border-subtle rounded p-3`.
- Dallanma adımı: yeşil "Tekrar Stok" (`green-500`) ve sarı "Karantina" (`yellow-500`) iki kutu.
- Üstte küçük sayaç: `Bugün işlenen iade: 312` (`font-mono`).

### 3.5. YENİ — Sezon Geçiş Şeridi (çözüm 04 yanı)

Yatay zaman şeridi: `SS26 Ön Satış → Sezon Açılış → Pik → İndirim → Sezon Sonu`. Her aşamada
rezerv/tampon stok göstergesi. Overselling önleme mesajını taşır.

- `flex` yatay adımlar, aktif aşama `bg-kp-accent-muted text-kp-accent border-kp-accent/20`.
- Her aşama altında ince bir stok bar'ı (`bg-kp-accent/20` üzerine `bg-kp-accent` dolgu).

### 3.6. YENİ — Beden Tablosu / Pazaryeri Eşleme (çözüm 06 yanı)

Farklı pazaryerlerinin beden farklılıklarını eşleyen mini tablo (moda'ya çok özgü):

```
Alqora   Trendyol   Hepsiburada   Amazon
  S         S           36          Small
  M         M           38          Medium
  L         L           40          Large
```
- `font-mono text-[11px]`, başlık satırı `border-b border-kp-border font-bold`.
- Eşleşme doğrulanmış satırlar `text-kp-text-secondary`, eksik eşleşme `text-kp-warning`.

> Bu altı görselden en az **3.2, 3.3, 3.4** mutlaka eklenmelidir — sayfayı diğer sektörlerden
> görsel olarak ayıran çekirdek bunlardır. Diğerleri (3.5, 3.6) ikinci fazda eklenebilir.

---

## 4. Sayfa bölüm sırası (mevcut iskelet + sektörel eklentiler)

| # | Bölüm | Durum |
|---|---|---|
| 1 | `Navbar` | ortak |
| 2 | Hero (tag + h1 + desc + CTA'lar + **3.1 varyant/raf mockup**) | ortak iskelet, sektörel mockup |
| 3 | Çözüm döngüsü (6 çözüm, zig-zag) + her çözüm yanına ilgili **3.2–3.6** görseli | **ayırt edici** |
| 4 | Entegrasyon / Pazaryeri kartları (Trendyol, HB, Amazon, Shopify vurgulu) | ortak, moda odaklı sıralama |
| 5 | Operasyonel Yetenekler (fiyat/kampanya + iade otomasyonu) | ortak, metin moda'ya uyarlı |
| 6 | İletişim / Demo formu (ad, e-posta, telefon, sipariş hacmi, KVKK) | ortak |
| 7 | SSS akordeon (**2.4** moda soruları) | **ayırt edici içerik** |
| 8 | `Footer` | ortak |

---

## 5. Uygulama kontrol listesi

- [ ] `SECTOR_DATA_MAP['fashion-and-apparel']` içeriği bölüm 2'ye göre keskinleştirildi (metrik + 6 çözüm + SSS).
- [ ] `slug === 'fashion-and-apparel'` koşuluyla render edilen **3.2 Varyant Matrisi** bileşeni eklendi.
- [ ] **3.3 Askılı/Raflı ikili depo** görseli eklendi.
- [ ] **3.4 İade hunisi** görseli eklendi.
- [ ] (Opsiyonel) 3.5 sezon şeridi + 3.6 beden eşleme tablosu.
- [ ] Tüm renkler `kp-*` token'ı; yalnız canlı-konsol durum renkleri (`green/yellow/red-500`) mevcut kalıba sadık.
- [ ] TR/EN metinleri `isTr ? ... : ...` deseniyle çift dilli.
- [ ] `Navbar/MegaMenu` ve `Footer`'daki `fashion-and-apparel` linkleri çalışıyor (zaten mevcut).
- [ ] Yeni jenerik bir `page.tsx`/rota **açılmadı** — dinamik rota korundu.
- [ ] Diğer sektör sayfalarıyla yan yana bakıldığında hero + çözüm mockupları **görsel olarak farklı**.

---

## 6. Kısa gerekçe (tekrar önleme)

Bu sayfa diğer sektörlerden **iskeletle değil içerikle ve sektörel görselleştirmeyle** ayrışır.
Ortak `[slug]/page.tsx` mimarisi korunarak bakım maliyeti düşük tutulur; ayırt edicilik ise
`slug` koşullu moda-özel bileşenlerde (varyant matrisi, askılı/raflı depo, iade hunisi, sezon
şeridi, beden eşleme) yaratılır. Böylece "birbirini tekrar eden sayfa" hissi ortadan kalkar,
DRY bozulmaz.
