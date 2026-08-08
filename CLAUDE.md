# Kroptos - Claude Talimat Dosyası

## Proje Yapısı
Proje bir monorepo yapısına sahiptir:
- `packages/frontend/`: Frontend uygulamasının yer aldığı dizin.
- Diğer backend paketleri veya servisleri.

---

## Kalıp Kuralları

Aşağıdaki kurallar bu depoda BİRDEN FAZLA KEZ gerçekleşmiş hatalardan
çıkarıldı. Her biri canlı bir bug'ın genellemesidir; teorik değildir.
Yeni kod yazarken ve review yaparken bunlara uy.

### 1. Tenant kapsaması sorgunun HER katmanına iner

`agencyId` parametresi almak yetmez, onu `where`'e KOYMAK gerekir.
En sık hata: üst sorgu kapsanır, `include` içindeki ilişkiler kapsanmaz.

```ts
// YANLIŞ - agencyId sadece imzada; sorgu tüm ajansların kullanıcılarını döner
const users = await prisma.user.findMany({
  where: { deletedAt: null },
  include: { userRoles: { where: { deletedAt: null } } },
});

// DOĞRU - hem satır seçimi hem her include kapsanır
const users = await prisma.user.findMany({
  where: { deletedAt: null, userRoles: { some: { agencyId, deletedAt: null } } },
  include: {
    userRoles: { where: { agencyId, deletedAt: null } },
    storeUsers: { where: { deletedAt: null, store: { agencyId, deletedAt: null } } },
  },
});
```

Kontrol sorusu: **fonksiyona iki farklı ajansın verisi geldiğinde hangi
satırlar dönerdi?** Cevap "hepsi" ise sızıntı vardır.

Gerçek vaka: `settings/services/users.service.ts` `findAll` — üç katmanda
birden kapsamsızdı (satır seçimi, `userRoles`, `storeUsers`).

### 2. Ham header asla tenant filtresi olamaz

```ts
req.user?.agencyId || req.headers['x-agency-id']   // YASAK
```

Header doğrulanmamış istemci girdisidir; kullanıcının o ajansa erişimi
kontrol edilmeden filtre olursa yatay yetki atlaması olur. Tenant bağlamı
yalnızca doğrulanmış aktif bağlamdan (`TenantMiddleware`'in yazdığı alan)
veya JWT'den okunur.

### 3. Rol eşleşmesi KAPSAMA'dır, tam eşitlik değil

Hiyerarşi: ajans → client → mağaza. Üstteki rol alttaki her şeyi kapsar.
`clientId: dto.clientId || undefined` kalıbı iki yönde birden bozuktur:
değer verilince tam eşleşme arar (ajans geneli rolü eler → hatalı 403),
verilmeyince filtreyi tamamen kaldırır (mağaza rolüne ajans geneli token
verir → yetki genişlemesi).

Kapsama `OR` bloğuyla yazılır ve `TenantMiddleware`'deki karşılığıyla
AYNI olmak zorundadır — iki yerde ayrışırsa guard ile token uyumsuz kalır.

### 4. Çok satır dönebilen rol seçimi deterministik olmalı

`findFirst` rastgele satır döndürür; token'ın izin kümesi buna bağlı
kalırsa aynı kullanıcı farklı isteklerde farklı yetkiyle çalışır.
`findMany` + açık seçim kuralı (en özel kapsam kazanır) kullan.

### 5. İzin adları: `kaynak.aksiyon` ve seed'de tanımlı

Tek biçim nokta ayracıdır: `products.read`, `orders.update`.
`agency:create` gibi iki nokta kalıbı kullanma.
Yeni bir `@RequirePermission` eklerken iznin `prisma/seed.ts`'te tanımlı
olduğunu doğrula — tanımsız izin guard'ı sessizce yanlış tarafa düşürür.

### 6. Audit log alan adları şemadan doğrulanır

`AuditLog` alan adları (`tenantId`, `entityType`, `entityId`, `action`…)
elle yazılmaz, `schema.prisma`'dan teyit edilir. Yanlış alan adıyla yazılan
audit helper'ları sessizce çalışıp eksik kayıt üretir. Transaction içinde
yazarken `tx`'i `Prisma.TransactionClient` olarak tiple, `any` değil.

### 7. "Doğrulandı" demenin eşiği

Mock'lu birim testi canlı kanıt DEĞİLDİR — özellikle sorgunun *şeklini*
test ediyorsan, çünkü yanlış kapsamda da mock aynı cevabı döner.
Tenant/izin davranışı için canlı doğrulama protokolü:

1. Değişiklik öncesi ilgili tabloların satır sayısını al.
2. Geçici fixture ekle, gerçek HTTP çağrısıyla ölç.
3. Fixture'ı `finally` içinde sil.
4. Satır sayılarını tekrar al ve **başa döndüğünü** göster.

Ölçülemeyen bir iddia `DOĞRULANAMADI` olarak işaretlenir; sessizce
"çalışıyor" denmez. Ölçüm sonucu commit mesajının gövdesine yazılır.
