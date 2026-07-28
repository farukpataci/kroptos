# Başka bir makineye taşıma

Bu dosya, projenin çalışması için makinede neyin bulunması gerektiğini ve
taşınırken hangi kararların verilmesi gerektiğini kaydeder.

## Makinede gereken şeyler

| Gereksinim | Doğrulanan sürüm | Not |
|---|---|---|
| Node.js | v24.11.0 | `package.json`'da `engines` alanı yok, sürüm kilitli değil |
| pnpm | 11.9.0 | Monorepo `pnpm-workspace.yaml` ile sürülüyor |
| PostgreSQL | 16 | `docker-compose.yml` `postgres:16-alpine` kullanıyor |
| Redis | 7 | BullMQ kuyruklarına gerekli |
| Caddy | — | Yalnızca domain + TLS için; repoda **tutulmuyor** |

Caddy binary'si artık git'te değil. Windows'ta `caddy.exe`'yi repo köküne koyun
ya da PATH'e ekleyin; `start-caddy.bat` ikisini de bulur, bulamazsa açık hata
verir.

## Ortam değişkenleri

`.env` dosyaları git'te değil, `.env.example` dosyaları takipte. Yeni makinede:

```
cp packages/backend/.env.example  packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
```

`packages/backend/.env` içinde **mutlaka değiştirilmesi gerekenler** —
`.env.example`'daki değerler geliştirme içindir ve zayıftır:

- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY` — entegrasyon credential'ları bununla şifreleniyor
  (`common/utils/encryption.util.ts`, AES-256-CBC, anahtar 32 bayta
  doldurularak doğrudan kullanılıyor). **Değiştirirseniz kayıtlı tüm
  entegrasyon credential'ları çözülemez hale gelir.** Mevcut veriyi
  taşıyorsanız bu anahtarı da taşıyın; taşımıyorsanız entegrasyonların
  yeniden bağlanması gerekir.

  > **Dikkat:** `ENCRYPTION_KEY` tanımlı değilse kod sessizce kaynak koddaki
  > sabit bir anahtara düşüyor (`encryption.util.ts:7`). Yani yeni makinede bu
  > değişkeni koymayı unutmak hata vermez — tüm credential'lar herkese açık,
  > repoda yazılı bir anahtarla şifrelenir. Taşımadan sonra ilk doğrulanacak
  > şey budur.

- `CORS_ORIGINS` — frontend'in gerçek origin'i

## Kurulum sırası

```
pnpm install --frozen-lockfile   # pnpm-lock.yaml artık git'te
pnpm db:push                     # şema; migration geçmişi yok, bkz. aşağısı
pnpm build                       # shared -> backend -> frontend (topolojik)
```

`pnpm build` sırası bağımlılık grafiğinden geliyor: `@kroptos/shared` her iki
pakete de bağımlılık olduğu için önce derleniyor. Elle sıraya gerek yok.

## Veritabanı şeması

`prisma/migrations/` **yok ve bilinçli olarak yok**. Şema `prisma db push` ile
gidiyor (`deploy.bat` adım 3). Yıkıcı bir değişiklik olursa `db push`
`--accept-data-loss` ister; `deploy.bat` bu bayrağı geçmediği için deploy
durur ve eski sürüm çalışmaya devam eder.

Bir şema değişikliğinin güvenli olup olmadığını canlı veritabanı olmadan
görmek için:

```
npx prisma migrate diff \
  --from-schema-datamodel <eski-schema.prisma> \
  --to-schema-datamodel  ./prisma/schema.prisma --script
```

## Çalıştırma

`ecosystem.config.js` (pm2) göreli yol kullanıyor, taşınabilir:

- `kroptos-backend` → `./packages/backend/dist/main.js`
- `kroptos-frontend` → `next start -p 3000`, cwd `./packages/frontend`

`Caddyfile` `alqora.app` → `127.0.0.1:3000` ve `api.alqora.app` →
`127.0.0.1:3001` proxy'liyor. Domain değişirse tek düzeltilecek yer burası.

`.bat` dosyaları artık kendi bulundukları dizine `cd` ediyor (`%~dp0`), sabit
bir yola değil — repo herhangi bir klasörde durabilir.

## Hedef seçilince karara bağlanacaklar

Bunlar bilerek yapılmadı, çünkü nereye taşınacağına bağlılar:

- **`docker-compose.yml` şu an build edilemez.** `context: ./packages/backend`
  veriyor ama `packages/backend/Dockerfile` workspace kökünden kopyalıyor
  (`COPY pnpm-workspace.yaml .`). Ayrıca geliştirme amaçlı: `src` mount ediyor,
  `npm run dev` koşuyor (proje pnpm kullanıyor), secret'lar dosyada gömülü.
  Konteynere geçilecekse bunların hepsi düzeltilmeli.
- **Linux'a gidilecekse** `.bat` dosyaları ölü ağırlık; yerine `deploy.sh` ve
  systemd (ya da pm2) kurulumu gerekir.
- **`eticaret-system/`** — 132 takipli dosyalık, içinde ikinci bir Turborepo
  iskeleti (`eticaret-system/eticaret-system/`) barındıran terk edilmiş paralel
  proje. Ana uygulamayla bağı yok. Taşımadan önce silinmesi repo'yu belirgin
  şekilde hafifletir.
