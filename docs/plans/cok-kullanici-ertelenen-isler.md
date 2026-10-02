# Çok kullanıcılı yapı — ertelenen işler

**Durum:** açık iş, planlanmadı. Kod değişikliği yapılmadı.

Kaynak: `docs/Kroptos_cok_kullanici_promptlari_v2.md` › "Ertelenen işler" bölümü.
P1–P12 seti tamamlanınca prompt dosyası silindi (2026-10-02); bu iki madde o
setin kapsamı dışında bırakılmıştı ve hâlâ açık. Dosyanın tamamı git geçmişinde.

## 1. StoreUser ↔ UserRole örtüşmesi

İki ayrı üyelik modeli var, ikisi de `roleId` taşıyor (`schema.prisma` › `UserRole`,
`StoreUser`). `PATCH /users/:id/stores` StoreUser'a, `rbac/assign` UserRole'e yazıyor.
Hangisinin kanon olduğu belirsiz. Çok kullanıcılı yapı oturduktan sonra birleştirilmeli.

## 2. PLATFORM_ADMIN_EMAILS allowlist'i

`PlatformAdminGuard` e-posta listesine bakıyor
(`packages/backend/src/common/constants/platform-admin.ts`). Env tabanlı allowlist
ölçeklenmez; kalıcı çözüm gerekiyor. Kodda varsayılan liste hâlâ
`faruk.pataci@gmail.com`; yerelde `.env` ile `superadmin@kroptos.com` verildi.

## Kapanan

- ~~`eticaret-system/` arşivi~~ — klasör `84bf57f` ile kaldırıldı.
