# `prisma/seed.ts` canlı veritabanında çalıştırılamaz

**Durum:** açık iş, kargo işinin parçası değil. Kod değişikliği yapılmadı.
**Bulunma tarihi:** 2026-08-24, kargo izinleri DB'ye indirilirken.

Kargo izinleri (`carriers.*`, `shipments.*`) `seed.ts`'te tanımlıydı ama canlı
DB'de yoktu. Doğal çözüm `pnpm db:seed` çalıştırmaktı; dosya okununca bunun
yapılamayacağı görüldü. İzinler bunun yerine
`prisma/scripts/backfill-carrier-permissions.ts` ile indirildi (commit `1fb0f44`).

İzin döngüsünün kendisi (`prisma/seed.ts:67`) `upsert` ve zararsız. Sorun diğer
iki yazmada.

---

## 1. Super admin şifresini varsayılana geri alıyor

```ts
// prisma/seed.ts:298
const defaultUser = await prisma.user.upsert({
  where: { email: defaultEmail },
  update: { passwordHash: hashedPassword },   // ← her koşuda
  create: { ... },
});
```

`update` bloğu `passwordHash` içeriyor. Yani seed her çalıştığında
`superadmin@kroptos.com` hesabının şifresi `Password123!` oluyor — kurulumdan
sonra şifre değiştirilmiş olsa bile.

**Neden tehlikeli:** seed masum bir "eksikleri tamamla" komutu gibi duruyor.
Bir geliştirici yeni bir izin eklemek için çalıştırdığında, farkında olmadan
sistemdeki en yetkili hesabın şifresini herkesin bildiği bir değere düşürüyor.
Hiçbir uyarı çıkmıyor, log'da da görünmüyor.

**Önerilen düzeltme:** `passwordHash`'i `create` bloğuna al, `update`'i boş bırak.

```ts
await prisma.user.upsert({
  where: { email: defaultEmail },
  update: {},                                  // var olan hesaba dokunma
  create: { email: defaultEmail, passwordHash: hashedPassword, ... },
});
```

---

## 2. `permissions: { set }` elle verilmiş izinleri koparıyor

```ts
// prisma/seed.ts:269
await prisma.role.upsert({
  where: { name: roleDef.name },
  update: {
    permissions: { set: permConnects },        // ← liste TAMAMEN değişiyor
  },
  create: { ..., permissions: { connect: permConnects } },
});
```

`set` bir ilişkiyi "bu listeye eşitle" demektir: listede olmayan her bağ silinir.

**Neden tehlikeli:** dokuz seed rolünden birine (`agency_owner`, `store_manager`
vb.) UI'dan ya da elle fazladan bir izin verilmişse, seed'in bir sonraki koşusu
o izni sessizce koparıyor. Kayıp audit log'a düşmüyor; yalnızca kullanıcı bir
ekrana girip 403 aldığında fark ediliyor ve sebebi seed'e kadar geri
izlenemiyor.

**Önerilen düzeltme:** `set` yerine ekleyici bir yazma. `connectOrCreate` hem
izni yoksa oluşturur hem bağı ekler, mevcut bağlara dokunmaz:

```ts
update: {
  permissions: {
    connectOrCreate: roleDef.permissions.map((name) => ({
      where: { name },
      create: { name, description: descriptions[name] ?? name },
    })),
  },
},
```

Seed'in "rolden izin kaldırma" gibi bir görevi olacaksa bu açıkça ve ayrıca
yazılmalı — sessiz bir yan etki olarak değil.

---

## Kapsam

- Bu iki düzeltme dışında `seed.ts`'e dokunulmamalı.
- Düzeltmeden sonra bile canlı DB'de çalıştırmadan önce
  `backfill-carrier-permissions.ts`'teki gibi öncesi/sonrası satır sayımı alınmalı.
- Kargo tarafında bu dosyaya bağımlılık kalmadı; izinler zaten indirildi.
