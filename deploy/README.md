# deploy/

`deploy.ps1` bir commit'i sunucuda ayrı klasörde derler, gerekiyorsa veritabanını yedekleyip
migration uygular, çalışan sürümü değiştirir ve sağlığı doğrular. Sağlık kontrolü başarısızsa
önceki sürüme kendiliğinden döner. Yol haritası: `docs/plans/surekli-teslim-yol-haritasi.md`.

| Dosya | Ne |
|---|---|
| `deploy.ps1` | Deploy betiği (Windows PowerShell 5.1) |
| `ecosystem.config.js` | pm2 süreçleri; `<Root>\current` altından çalışır |
| `environments/*.psd1` | Ortam ayarları (sır yok): kök klasör, dal, portlar, pm2 adları |
| `preflight-catchup.js` | Yetişme migration'ı işaretlenmeden deploy edilmesini engeller |

## Sunucudaki düzen (ortam başına)

```
C:\kroptos\production\
  repo\                 git kopyası (yalnız fetch)
  releases\<sha>\       her sürüm kendi klasöründe (git worktree)
  releases\<sha>.built  derleme tamamlandı işareti
  current               çalışan sürüme junction — pm2 buradan çalışır
  shared\backend.env    sırlar (repoda yok); her sürümün packages\backend\.env'ine kopyalanır
  shared\frontend.env   NEXT_PUBLIC_API_URL (derleme anında gömülür)
  backups\              migration öncesi pg_dump yedekleri
  deploy.log            her adımın komutu ve çıktısı
```

## Akış

1. Kilit (`deploy.lock`): aynı ortama iki deploy aynı anda çalışmaz.
2. `shared\backend.env` kontrolü: zorunlu anahtarlar ve `APP_ENV` = ortamın beklediği değer.
   Yanlış ortamın sırları kopyalanmışsa deploy durur.
3. `git fetch`, commit'i `releases\<sha>`'ya worktree olarak açar.
4. `pnpm install --frozen-lockfile`, `prisma generate`, shared + backend + frontend derlemesi.
   **Çalışan sürüme dokunulmaz;** burada bir hata olursa site etkilenmez.
5. Ön kontrol (`preflight-catchup.js`) → `prisma migrate status`:
   - bekleyen migration yoksa devam;
   - varsa önce `pg_dump` yedeği (`backups\`), sonra `migrate deploy`;
   - durum okunamıyorsa (ör. "failed" migration) deploy durur.
6. `check-rls`: kiracı tablolarının hepsinde RLS.
7. `current` yeni sürüme çevrilir, `pm2 startOrReload`.
8. Sağlık: `/api/health` → `sha` yeni commit'le aynı ve frontend 200. Süre: `HealthTimeoutSec`.
   - Başarısızsa `current` önceki sürüme döner, pm2 yeniden yüklenir, önceki sürümün sağlığı doğrulanır.
9. Başarılıysa son `KeepReleases` sürüm tutulur; çalışan ve bir önceki sürüm asla silinmez.

Çıkış kodları: `0` tamam · `1` başarısız (site eski sürümde çalışıyor) · `2` kritik (geri dönülen sürüm de sağlıksız).

**Migration'lar geri alınmaz.** Geri dönüşte yeni şema eski kodla çalışmak zorundadır. Kolon/tablo
silme ve yeniden adlandırma iki sürüme bölünür: önce kod eski kolonu kullanmayı bırakır, sonraki
sürümde şema siler.

## İlk kurulum (sunucuda, ortam başına bir kez)

Ön koşul: git, Node 24, pnpm 12.8.1, pm2 ve PostgreSQL araçları (`pg_dump.exe`) kurulu.
`environments\<ortam>.psd1` içindeki `PgDump` yolunu sunucudaki kuruluma göre düzeltin.

```powershell
$Root = 'C:\kroptos\production'
New-Item -ItemType Directory -Force "$Root\shared" | Out-Null

# Sırlar: mevcut canlı .env'den kopyalanır, APP_ENV eklenir.
Copy-Item 'C:\Users\Administrator\Desktop\kroptos\packages\backend\.env' "$Root\shared\backend.env"
Add-Content "$Root\shared\backend.env" 'APP_ENV=production'
Set-Content "$Root\shared\frontend.env" 'NEXT_PUBLIC_API_URL=https://api.alqora.app/api'
```

`shared\backend.env`'in bir kopyası (özellikle `ENCRYPTION_KEY`) parola yöneticisinde olmalı.

Mevcut kurulumdan (`Desktop\kroptos`, kök `ecosystem.config.js`) bu düzene geçiş, eski
`kroptos-backend` / `kroptos-frontend` süreçlerinin aynı adla yeni yerden başlatılmasıdır.
`pm2 reload` var olan sürecin klasörünü değiştirmediği için `deploy.ps1`, `current` dışından
çalışan aynı adlı süreci önce siler (`pm2-foreign.js`), sonra yeni yerden başlatır. Bu yalnız
ilk devirde olur; provada kesinti ~16 sn sürdü. Redis ve Caddy süreçleri değişmez.
Eski klasör (`Desktop\kroptos`) devirden sonra silinmez: geri dönüş yolu olarak kalır.

## Elle çalıştırma

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Environment production
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy.ps1 -Environment production -Ref <sha>
```

`-Ref` verilmezse ortamın dalının (`origin/main`, `origin/staging`) son commit'i deploy edilir.
Belirli bir eski sürüme dönmek için o sürümün sha'sı `-Ref` ile verilir (derlenmişse yeniden kullanılır).

## Sorun giderme

| Belirti | Ne yapılır |
|---|---|
| "Başka bir deploy sürüyor" | Çalışan deploy yoksa `<Root>\deploy.lock`'u silin |
| "... kayıtlı değil ama nesneleri veritabanında zaten var" | Yetişme migration'ını işaretleyin (mesajdaki komut) |
| "migrate status beklenmeyen çıktı" | `deploy.log`'a bakın; "failed" migration varsa `prisma migrate resolve` ile çözülür |
| "PATH'te bulunamadı: ..." | Deploy'u çalıştıran hesabın (runner servisi dahil) PATH'ine git / node / pnpm / pm2 ekleyin |
| "Filename too long" ya da "UYARI: LongPathsEnabled kapalı" | Yönetici PowerShell: `Set-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem LongPathsEnabled 1` (yeniden başlatma gerekmez, yeni süreçlerde geçerli) |
| "APP_ENV=..., beklenen ..." | `shared\backend.env` yanlış ortamın dosyası; düzeltin |
| Geri dönüş oldu | `deploy.log`'da sağlık kontrolünün son mesajı; sürüm `releases\<sha>` altında incelenebilir |
| Yedekten dönmek | `pg_restore --clean -d <url> backups\<dosya>.dump` — önce siteyi durdurun |
