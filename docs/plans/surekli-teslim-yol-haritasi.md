# Sürekli Teslim — push'tan alqora.app'e

**Tarih:** 2026-10-02
**Durum:** Onaylandı, Faz 1'den başlanıyor.

**Hedef:** Kod lokalde yazılır. `staging` dalına push → `stg.alqora.app` güncellenir.
`main`'e merge → `alqora.app` güncellenir. Elle sunucuya girip deploy yok.

---

## Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Canlı domain | `alqora.app`, `api.alqora.app` (Caddyfile, `start-caddy.bat`) | — |
| Şema | **Prisma migration** (`prisma migrate deploy`), `db push` canlıda **yok** | 2026-09-15'ten beri repo bu düzende (`0_init` baseline). Canlıya yalnız PR'da gözden geçirilmiş SQL gider. |
| RLS | Yeni tablonun politikası **aynı migration dosyasında** | Ayrı psql betiği unutuldu (2026-10-02, `60d263c`: AutomationRule/AutomationRun RLS'siz kalmıştı) |
| Deploy aracı | GitHub Actions + sunucuda self-hosted runner (Windows servisi) | Sunucu dışarı bağlanır; port/SSH açılmaz |
| Ortamlar | lokal → staging → production, aynı sunucu | Staging: canlı veri kopyasında şema ve sürüm provası |
| Dal kuralı | `main` = canlı, `staging` = staging; ikisine de yalnız CI'dan geçmiş kod | — |

---

## Faz 0 — Güvence (sunucuda, kullanıcı)

- [ ] `packages/backend/.env` ve `ENCRYPTION_KEY` parola yöneticisinde (2026-08-08'de kaybolmuştu)
- [ ] Canlı DB `pg_dump` yedeği **ve** boş bir DB'ye geri yükleme denemesi
- [ ] Canlıda çalışan commit: `git log -1` veya `https://api.alqora.app/api/health` → `sha`
- [x] Canlıda migration durumu (2026-10-02, DB `eticaret`): 3 migration uygulanmış,
      "Database schema is up to date"; şema sunucudaki `schema.prisma` ile fark yok
- [ ] **Yetişme migration'ını canlıda işaretle** (çalıştırmadan) — 5. adım. Yeni kod sunucuya
      çekildikten sonra, **herhangi bir deploy'dan önce**:
      `node prisma/scripts/with-migration-url.js npx prisma migrate resolve --applied 20261002000000_manual_scripts_catchup`
      Önce canlıda nesnelerin var olduğu doğrulanır: `pnpm db:check-rls` (RLS eksik: 0) ve 14 tablonun varlığı.
      İşaretlenmeden deploy edilirse `migrate deploy` dosyayı çalıştırmaya kalkar, ilk `CREATE TYPE`'ta
      düşer ve migration "failed" kalır.

## Faz 1 — Repo hazırlığı

| # | İş | Durum |
|---|---|---|
| 4 | Eski "`db push` kullan, migration YASAK" notlarını migration kuralıyla değiştir (package.json, README, SECURITY_CHECKLIST, deploy.bat) | ✅ 2026-10-02 |
| 5 | RLS'i migration'ın parçası yap: yetişme migration'ı (`20261002000000_manual_scripts_catchup`) + `pnpm db:check-rls` | ✅ lokal 2026-10-02 · canlıda işaretleme bekliyor (Faz 0) |
| 6 | Ortam anahtarları: `APP_ENV`, `OUTBOUND_HTTP` + `OUTBOUND_ALLOWLIST` (global fetch kapısı), `NOTIFICATIONS_DELIVERY` (SMTP/Netgsm → console). Staging'de varsayılan **kapalı** | ✅ 2026-10-02 · uygulama içinden uçtan uca engelleme staging kurulumunda (Faz 2) ölçülecek |
| 7 | Staging veri temizleme betiği: entegrasyon kimlik bilgileri silinir, müşteri e-posta/telefon maskelenir (`pnpm db:sanitize-staging --confirm kroptos_stg`) | ✅ 2026-10-02 |
| 8 | CI workflow (`.github/workflows/ci.yml`): install, `prisma generate`, build, test; boş Postgres'te migration + şema farkı + RLS + rol kontrolü; `main`/`staging` dal koruması | ✅ workflow 2026-10-05 (Linux/Docker provasında yeşil) · dal koruması GitHub ayarlarında bekliyor · geçici: `manifest.i18n` hariç, 1 katalog testi askıda |
| 9 | `deploy.ps1`: ortam parametreli; ayrı klasörde build → DB yedeği → `migrate deploy` → `pm2 reload` → `/api/health` `sha` kontrolü → başarısızsa önceki sürüme dönüş | |

## Faz 2 — Staging kurulumu

| # | İş |
|---|---|
| 10 | DNS: `stg.alqora.app`, `api.stg.alqora.app` |
| 11 | Sunucuda `kroptos-stg` klasörü, ayrı `.env` (`APP_ENV=staging`, farklı `JWT_SECRET`, Redis 6380). **Veritabanı ayrı bir Postgres örneğinde** (ör. 5433): roller küme genelidir; aynı örnekte `kroptos_app` hem canlıya hem staging'e bağlanabilir, staging `.env`'i canlı parolasını taşır |
| 12 | pm2: `kroptos-stg-backend` (3101), `kroptos-stg-frontend` (3100) |
| 13 | Caddy: staging blokları, `basic_auth` ile kapalı, `X-Robots-Tag: noindex` |
| 14 | İlk veri: canlı yedeği → `kroptos_stg` → 7. adımdaki temizleme |

`NEXT_PUBLIC_API_URL` build anında gömülür; staging frontend'i ayrı build edilir.

## Faz 3 — Otomatik deploy

| # | İş |
|---|---|
| 15 | Self-hosted runner, Windows servisi olarak |
| 16 | `staging` push → staging deploy |
| 17 | `main` push → canlı deploy |
| 18 | Deploy sonucu GitHub'da + bildirim |

## Faz 4 — Gözlem

| # | İş |
|---|---|
| 19 | Dış uptime izleyici: `api.alqora.app/api/health` dakikada bir |
| 20 | pm2 log rotasyonu; staging verisini haftalık yenileme (kopyala + temizle) |

---

## Günlük akış (kurulduktan sonra)

1. `feature/...` dalında kodla, lokalde dene.
2. Şema değiştiyse: `pnpm --filter @kroptos/backend db:migrate:new -- --name <ad>`,
   üretilen SQL'i oku, yeni tablo varsa RLS bloğunu ekle.
3. `staging`'e merge + push → `stg.alqora.app`'te test.
4. `main`'e merge + push → `alqora.app`.

## Riskler

- **Staging'de canlı kimlik bilgisi.** Temizleme (7) yapılmadan staging'e canlı kopyası yüklenmez;
  aksi halde staging worker'ları müşterinin gerçek pazaryeri hesabına yazar.
- **Uygulama rolü DDL yapamaz.** `DATABASE_URL` = `kroptos_app` (NOBYPASSRLS, tablo sahibi değil).
  Migration her zaman `DATABASE_MIGRATION_URL` (superuser) ile çalışır
  (`prisma/scripts/with-migration-url.js`).
- **Windows'ta Prisma motoru kilitlenir.** Çalışan backend `prisma generate`'i EPERM ile düşürür;
  deploy ayrı klasörde build ederek bunu atlar.
