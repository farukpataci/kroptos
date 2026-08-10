# `IntegrationSettings` tablosunun kaldırılması — plan

**Durum:** planlandı, UYGULANMADI. Bir sonraki sürümün işi.
**Tarih:** 2026-08-10

## Neden

`IntegrationSettings` (çoğul) modeli, System Settings ekranının kendi
başına yazdığı ikinci bir entegrasyon kaydıydı. `Integration` ile arasında
hiçbir foreign key veya senkronizasyon yoktu; `/integrations` üzerinden
bağlanan bir pazaryeri bu ekranda sonsuza kadar `disconnected` görünüyordu.

`fix(integrations): System Settings'te pazaryerleri kalıcı olarak pasif
görünüyordu` commit'i ile:

- Okuma yolu `Integration`'dan türetiliyor — tablo artık okunmuyor.
- Yazma yolu (`PUT /system/integration-settings/:provider`) 410 Gone dönüyor.
- Servis ve model `@deprecated` olarak işaretlendi.

Yani tablo bugün **hiçbir kod yolundan okunmuyor veya yazılmıyor**. Geriye
yalnızca şemadan düşürülmesi kaldı.

## Kaldırmadan önce ölçülenler (2026-08-10)

Salt-okunur sayım, içerik dökülmeden:

```
IntegrationSettings
  total rows: 4
  config non-empty: 0
  config holding credential-shaped keys: 0

AuditLog (entityType='IntegrationSettings')
  total rows: 10
  newValue holding credential-shaped keys: 0
```

**Sonuç: redaksiyon migration'ı GEREKMİYOR.** Dört satırın hiçbirinde
`config` dolu değil, on audit kaydının hiçbirinde credential şeklinde
anahtar yok. Risk yapısaldı (ekrandaki form `apiKey`/`apiSecret`'i düz
metin olarak `config`'e yazıyordu ve audit `newValue`'ya tüm satırı
kopyalıyordu), ama fiilen hiç veri birikmemiş. Form kaldırıldığı ve yazma
yolu kapandığı için bu yol artık kapalı.

> Bu ölçüm kaldırma anında **tekrarlanmalı**. Aradaki sürümde tabloya veri
> yazan bir yol kalmadığı varsayımı, ölçülmeden doğru kabul edilmemeli.

## Adımlar

1. **Ölçümü tekrarla.** Yukarıdaki sayımı yeniden al. `config non-empty`
   veya audit'te credential anahtarı çıkarsa, önce redaksiyon adımı
   uygulanır (aşağıda), sonra düşürme yapılır.

2. **410 uç noktasının hâlâ çağrılıp çağrılmadığını kontrol et.**
   `ApiLog` üzerinden `endpoint LIKE '%system/integration-settings%'` ve
   `statusCode = 410` sorgula. Çağrı geliyorsa, kaldırmadan önce çağıran
   istemci güncellenmeli — 410'u 404'e çevirmek hata ayıklamayı zorlaştırır.

3. **Şema değişikliği.** `packages/backend/prisma/schema.prisma` içinden
   `model IntegrationSettings { ... }` bloğunu sil.

4. **Migration'ı ayrı adım olarak üret ve gözden geçir.**

   > Not: bu depo deploy'da `prisma db push` kullanıyor, migration geçmişi
   > tutmuyor (bkz. `db-schema-deploy-strategy`). `db push` tabloyu
   > **veri kaybı uyarısıyla** düşürür. Kasıtlı olduğu için kabul edilir,
   > ama önce 1. adımdaki ölçüm yapılmadan çalıştırılmamalı.

   ```sql
   -- Geri dönüşü yok: bu tabloyu düşürmeden önce 1. adımı uygula.
   DROP TABLE "IntegrationSettings";
   ```

5. **Kodu temizle.**
   - `packages/backend/src/modules/settings/services/integration-settings.service.ts`
     — `findAll` `Integration`'dan türetmeye devam ettiği için servis KALIR,
     yalnızca `update()` ve `@deprecated` notları kaldırılır.
   - `packages/backend/src/modules/settings/controllers/integration-settings.controller.ts`
     — `@Put('/:provider')` bloğu kaldırılır.
   - Adı artık yanıltıcı: servis `IntegrationSettings` tablosuyla ilgisi
     kalmadığı için `IntegrationStatusSummaryService` gibi bir isme
     taşınması değerlendirilir.

6. **Testler.** `integration-settings.service.spec.ts` içindeki `update`
   describe bloğu kaldırılır; `findAll` testleri aynen kalır.

## Redaksiyon adımı (yalnızca 1. adım kirli çıkarsa)

```sql
-- config içeriğini boşalt; şema değişmez.
UPDATE "IntegrationSettings" SET "config" = '{}'::jsonb;

-- Audit geçmişindeki kopyaları temizle.
UPDATE "AuditLog"
   SET "newValue" = jsonb_set("newValue", '{config}', '"[REDACTED]"'::jsonb)
 WHERE "entityType" = 'IntegrationSettings'
   AND "newValue" ? 'config';
```

Çalıştırmadan önce etkilenecek satır sayısı `SELECT count(*)` ile alınır ve
sonrasında tekrar ölçülerek sıfıra indiği gösterilir.

## Kırıcı değişiklik notu

`PUT /system/integration-settings/:provider` zaten 410 dönüyor; tablo
düşünce davranış değişmez. `GET /system/integration-settings` yanıt şekli
korunur — türetilmiş satırlar eski alan adlarını (`status`, `isActive`,
`lastSyncAt`, `errorCount`, `config`) aynen taşır. Bu yüzden tablo
düşürmek istemci için görünür bir değişiklik üretmez.
