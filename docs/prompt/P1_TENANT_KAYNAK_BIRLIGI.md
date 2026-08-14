# GÖREV: P1 — TENANT BAĞLAMI KAYNAK BİRLİĞİ

> Bu dosya `docs/prompt/00_IYILESTIRME_PAKETI.md` › Blok C › P1 bloğunun **yerini alır**.
> Paketteki özgün P1 ("TenantGuard'ı eksik olan her controller'a ekle") hedefi
> P0 envanteri sonrası geçersiz sayılmıştır — gerekçe aşağıda.
>
> Kullanım: Blok A + Blok B + bu dosya, aynı mesaja arka arkaya yapıştırılır.

GİRDİ (üçünü de oku):
- `docs/API_CONTRACT.md` → §20 TUTARSIZ tablosu, guard/izin sütunları
- `docs/prompt/KESIF_SONUCU.md` → §3 GRUP-1 / GRUP-2 / GRUP-3 ayrımı
- `p1-input-bulkaction-audit-actor.md` → doğrulanmamış akraba bulgu

DİKKAT: Bu görevin hedefi "TenantGuard'ı her controller'a eklemek" DEĞİLDİR.
O hedef geçersizdir. Gerçek sorun aşağıda.

## TESPİT

Tenant bağlamı iki ayrı kaynaktan okunuyor ve bu kaynaklar birbirinden sapabilir:

- GRUP-1 (9 controller): `req.activeAgency` / `activeClient` / `activeStore`
  → TenantMiddleware'in header'lardan doğrulayarak kurduğu aktif bağlam
- GRUP-2 (20 controller): `req.user.agencyId`
  → JWT payload'ındaki sabit değer, token yenilenene kadar değişmez

Kullanıcı tenant değiştirdiğinde `/auth/switch-tenant` yeni token veriyor, yani
pencere dar. Ama iki doğruluk kaynağı kalıcı bir tutarsızlık ve her yeni
endpoint hangi kalıbı seçeceğine bakarak yazılıyor.

Ayrıca dört ayrı sorun daha var (aşağıda önem sırasına göre).

## AMAÇ

Tenant bağlamının tek bir doğrulanmış kaynaktan okunmasını sağlamak ve
guard/izin boşluklarını kapatmak.

## KAPSAM İÇİ — beş iş, bu sırayla

### İŞ 1 (EN ÖNCELİKLİ) — Doğrulamasız header fallback'i kaldır

`integration-log.controller.ts` ve `audit.controller.ts` şu kalıbı kullanıyor:

```ts
req.user?.agencyId || req.headers['x-agency-id']
```

Ham header, hiçbir doğrulamadan geçmeden tenant filtresi oluyor. Kullanıcının
o agency'ye erişimi olup olmadığı kontrol edilmiyor.

- Bu iki controller'ı doğrulanmış aktif bağlama taşı.
- Faz A'da: bu fallback'in gerçekten sömürülebilir olduğunu KANITLA
  (kendi makinende, kendi token'ınla, salt GET). Kanıtlayamıyorsan söyle.

### İŞ 2 — İki kaynağı teke indir

GRUP-2'deki 20 controller'ı (**ProfileController HARİÇ** — P0 onu temize çıkardı)
`req.user.agencyId` yerine aktif bağlamdan okuyacak şekilde çevir.

- GRUP-3'e (`agency`, `client`, `store`, `rbac`) DOKUNMA. Onlar üyelik üzerinden
  çalışıyor ve bu kasıtlı: "erişebildiğim tenant'ları listele" endpoint'i
  tanımı gereği tek bir aktif tenant'a filtrelenemez.

### İŞ 3 — PermissionGuard boşlukları

Sınıf seviyesinde `PermissionGuard` hiç olmayanlar:
`audit.controller.ts`, `integration-log.controller.ts`, `profile.controller.ts`

Kısmi kapsama (P0 §bulgu c):

| Controller | Endpoint | İzinli |
|---|---|---|
| `agency.controller.ts` | 6 | 3 |
| `client.controller.ts` | 5 | 3 |
| `store.controller.ts` | 5 | 3 |

- Guard'ı ekle ve izinsiz endpoint'lere `@RequirePermission` ver.
- `files.controller.ts` AYRI: hiç guard yok, imzalı token ile korunduğu
  iddia ediliyor ama P0 bunu DOĞRULAYAMADI. Önce doğrula, sonra karar ver.
- `auth.controller.ts`'e DOKUNMA (login/register kasıtlı public).

### İŞ 4 — İzin adlandırma çatallanması

İki kalıp yan yana yaşıyor:

- nokta: `products.read`, `orders.update`, `warehouse.manage` … (28 adet)
- iki nokta: `agency:create`, `agency:write`, `client:create`,
  `client:write`, `store:create`, `store:write` (6 adet)

Aynı kaynak için iki ad birden var: `rbac.controller.ts` `agencies.read`
derken `agency.controller.ts` `agency:create` diyor.

- Blok A kuralı `'kaynak.aksiyon'` biçimini şart koşuyor. İki nokta kalıbını
  noktaya çevir.
- KRİTİK: Bu izinler seed'de tanımlı mı? Tanımlı değilse PermissionGuard
  bugün ne yapıyor — geçiriyor mu, reddediyor mu? Faz A'da bunu doğrula.
  Adları değiştirmek seed'i de değiştirmeyi gerektirebilir.

### İŞ 5 — TenantGuard'ın kaderine karar ver

Guard şu an ölü kod: super_admin'i baştan geçiriyor, `tenantPublicId` yoksa
`return true` diyor, frontend `x-tenant-id` hiç göndermiyor, yazdığı
`request.tenant`'ı hiçbir controller okumuyor.

Faz A'da iki seçeneği de değerlendir ve GEREKÇELİ öner:

- (a) Sil — ölü kod, TenantMiddleware zaten işi yapıyor
- (b) İşlevsel hale getir — ama o zaman ne işe yarayacak, middleware'den
  farkı ne olacak?

Kararı kullanıcı verecek. Faz A'da uygulama.

## KAPSAM DIŞI

- Response şekli, zarf konvansiyonu, tip birleştirme (P2)
- Sayfalama (P3)
- i18n (P4)
- `bulkAction`'ın audit aktörü sorunu — `p1-input` notundaki bulgu.
  DOĞRULA ve raporla, ama DÜZELTME. Ayrı bir görev olacak.
- Yeni izin adı icat etme (eksikleri sadece listele)
- TenantMiddleware'in iç mantığını değiştirme
- DB'ye kalıcı yazma. Kalıcı olmayan doğrulama yazması (transaction içinde
  yaz-oku-rollback, veya fixture ekle-doğrula-sil) BENİM ONAYIMLA yapılabilir.
  Onay almadan yazma. Yazdıysan öncesi/sonrası satır sayısını göster.
  Seed değişikliği gerekiyorsa ÖNER, uygulama.

## FAZ A'DA ÖNCE ŞUNLARI CEVAPLA

1. TenantMiddleware `req`'e tam olarak hangi alanları koyuyor ve hangi
   doğrulamaları yapıyor? (satır referanslı)
2. Aktif bağlamı OLMADAN çalışması gereken endpoint var mı? Örneğin agency
   seviyesinde çalışan sistem ayarları — `storeId` beklemeleri doğru mu?
3. 34 iznin kaçı seed'de tanımlı? Tanımsız bir izinle PermissionGuard ne
   yapıyor?
4. İŞ 2'deki 20 controller'ın hepsi gerçekten aynı kalıba mı geçmeli, yoksa
   ProfileController gibi başka istisnalar var mı? Her birini tek tek
   değerlendir — P0 zaten bir yanlış sınıflandırma buldu.

## KABUL KRİTERİ

- Hiçbir controller ham header'ı doğrulamadan tenant filtresi olarak
  kullanmıyor
- Hiçbir controller (GRUP-3 hariç) `req.user.agencyId`'yi tenant filtresi
  olarak kullanmıyor
- Değişen her endpoint için "önce/sonra" tablosu var: guard seti, izin adı,
  bağlam kaynağı
- Tek bir izin adlandırma kalıbı kaldı
- İstisna bırakılan her controller için gerekçe yazılmış
- `pnpm build` ve type-check geçiyor

## HACİM UYARISI

Bu görev eski P1'den büyük: 20+ controller, 34 izin, 5 ayrı iş kolu.
Tek oturumda bitmeyebilir. Bağlamın dolduğunu hissedersen DUR ve söyle.
Yarım bırakılmış İŞ 1, uydurulmuş İŞ 1-5'ten iyidir.
İşleri sırayla yap; İŞ 1 tek başına bile değerli bir commit'tir.
