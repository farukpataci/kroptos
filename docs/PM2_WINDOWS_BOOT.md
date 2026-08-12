# pm2 + Windows açılışta otomatik başlatma

Bu dosya, sunucudaki `kroptos-pm2-resurrect` adlı **Zamanlanmış Görev'in** (Task
Scheduler) ne olduğunu ve nasıl kaldırılacağını anlatır. Altı ay sonra "bu görev
de ne?" diye soran kişi için yazıldı.

Oluşturulma tarihi: 2026-08-12

---

## Neden var

Backend ve frontend, pm2 altında çalışıyor (`ecosystem.config.js`):

| pm2 adı            | ne çalıştırıyor                    | port |
| ------------------ | ---------------------------------- | ---- |
| `kroptos-backend`  | `packages/backend/dist/main.js`    | 3001 |
| `kroptos-frontend` | `next start` (`packages/frontend`) | 3000 |

pm2 Linux'ta `pm2 startup` ile kendini init sistemine (systemd) kaydeder.
**Windows'ta bu çalışmıyor:**

```
> pm2 startup
[PM2][ERROR] Init system not found
```

`pm2 save` yalnızca çalışan süreç listesini `C:\Users\Administrator\.pm2\dump.pm2`
dosyasına yazar; açılışta o listeyi geri yükleyecek bir mekanizma kurmaz. O yüzden
açılışta `pm2 resurrect` çalıştıran bir Zamanlanmış Görev kullanıyoruz.

Alternatifler (seçilmedi): `pm2-installer` pm2'yi gerçek bir Windows servisi olarak
kurar, daha sağlam ama sistem geneli değişiklik; `pm2-windows-startup` registry'nin
`Run` anahtarına yazar, yalnızca kullanıcı oturum açınca çalışır. Zamanlanmış görev
seçildi çünkü ek paket gerektirmiyor ve geri alması tek komut.

---

## Görev ne yapıyor

| alan          | değer                                                        |
| ------------- | ------------------------------------------------------------ |
| Görev adı     | `kroptos-pm2-resurrect`                                       |
| Tetikleyici   | Sistem açılışında (`AtStartup`), **1 dakika gecikmeli**       |
| Komut         | `cmd.exe /c "C:\Users\Administrator\AppData\Roaming\npm\pm2.cmd" resurrect` |
| Çalışma dizini| `C:\Users\Administrator\Desktop\kroptos`                       |
| Kullanıcı     | `Administrator`, `LogonType S4U` (oturum açılmasa da çalışır) |
| Yetki         | `RunLevel Highest`                                            |

1 dakikalık gecikme kasıtlı: açılışta veritabanı ve ağ servisleri hazır olmadan
backend ayağa kalkarsa bağlantı hatasıyla düşer.

**Kritik bağımlılık:** `pm2 resurrect`, `dump.pm2` dosyasındaki listeyi geri yükler.
Süreç listesini değiştirdiğinizde (`pm2 start` / `pm2 delete`) **`pm2 save`
çalıştırmayı unutmayın**, yoksa açılışta eski liste geri gelir.

```powershell
pm2 save   # mevcut listeyi dump.pm2'ye yaz
```

---

## Kurulum (yükseltilmiş PowerShell gerekir)

Görevi kaydetmek yönetici yetkisi ister. PowerShell'i **"Yönetici olarak çalıştır"**
ile açıp:

```powershell
C:\Users\Administrator\Desktop\kroptos\scripts\setup-pm2-boot-task.ps1
```

Script kendisi yükseltilmiş olup olmadığını kontrol eder, değilse hata verip çıkar.

---

## GERİ ALMA

Görevi tamamen kaldırmak için (yükseltilmiş PowerShell):

```powershell
Unregister-ScheduledTask -TaskName 'kroptos-pm2-resurrect' -Confirm:$false
```

Doğrulama — komut `False` yazdırmalı:

```powershell
[bool](Get-ScheduledTask -TaskName 'kroptos-pm2-resurrect' -ErrorAction SilentlyContinue)
```

Bu, süreçleri durdurmaz; yalnızca açılışta otomatik geri yüklemeyi kapatır.
Çalışan süreçleri de durdurmak istiyorsanız ayrıca `pm2 delete all`.

---

## Kontrol ve sorun giderme

```powershell
# Gorev duruyor mu, en son ne zaman calisti, sonucu ne
Get-ScheduledTask     -TaskName 'kroptos-pm2-resurrect' | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName 'kroptos-pm2-resurrect' | Select-Object LastRunTime, LastTaskResult, NextRunTime

# Yeniden baslatmadan gorevi elle tetikle (once pm2 kill ile temiz zemin)
Start-ScheduledTask -TaskName 'kroptos-pm2-resurrect'

# Sonuc
pm2 list
```

`LastTaskResult` `0` ise görev başarılı. Süreçler yine de gelmiyorsa sırayla bakın:

1. `dump.pm2` içeriği doğru mu — `pm2 save` unutulmuş olabilir.
2. `pm2 logs kroptos-backend --lines 50` — backend `.env` bulamamış olabilir.
   `ecosystem.config.js` içindeki `cwd: './packages/backend'` alanı bunun için var:
   `app.module.ts` → `envFilePath: '.env'` `process.cwd()`'ye göre çözülüyor ve repo
   kökünde `.env` **yok**. `cwd` silinirse backend `DATABASE_URL` ve
   `ENCRYPTION_KEY` olmadan başlar.

---

## İlgili dosyalar

- `ecosystem.config.js` — pm2 uygulama tanımları
- `scripts/setup-pm2-boot-task.ps1` — görevi kuran script
- `C:\Users\Administrator\.pm2\dump.pm2` — geri yüklenecek süreç listesi (repo dışı)
