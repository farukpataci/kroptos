#!/usr/bin/env node
// Staging veri temizleme: canlı yedeğinden geri yüklenen bir staging DB'sini kullanıma hazırlar.
//
//   1. Kimlik bilgileri silinir: pazaryeri/kargo/muhasebe/e-ticaret entegrasyonları, bildirim
//      sağlayıcı sırları, ajan zarfları ve tünel sırları. Entegrasyonlar 'inactive' olur.
//   2. Oturum ve token'lar silinir: Session, RefreshToken, ApiKey, davetler, ajan kayıt kodları,
//      export indirme token'ları, kullanıcıların 2FA sırları.
//   3. Son müşteri (alıcı) kişisel verisi maskelenir: sipariş ad/e-posta/telefon/adres satırları,
//      gönderi alıcı adresi, bildirim alıcıları ve gövdeleri, içe aktarma anlık görüntüleri,
//      muhasebe cari eşlemesindeki ad/vergi no/anahtar. Ham API trafiği (IntegrationLog,
//      CarrierWebhookEvent, WebhookEvent) silinir; müşteri webhook adresleri kapatılır.
//
// KALIR: işletme verisi (ajans, client, mağaza, depo, ürün, stok) ve personel hesapları.
// Personelin e-posta ve parola özeti korunur ki staging'e giriş yapılabilsin; staging
// basic_auth arkasında durur (docs/plans/surekli-teslim-yol-haritasi.md, Faz 2).
//
// Güvenlik (hepsi sağlanmazsa hiçbir şey yazılmaz):
//   - APP_ENV=staging
//   - --confirm <db>  gerçek bağlantının current_database() değeriyle aynı
//   - DB adı PROTECTED_DATABASES listesinde değil (varsayılan: eticaret)
//   - bağlantı RLS'i atlıyor (superuser / BYPASSRLS); yoksa RLS satırları gizler, temizlik yarım kalır
//   - tek transaction; sonunda doğrulama başarısızsa her şey geri alınır
//
// Kullanım (packages/backend, staging .env ile):
//   node prisma/scripts/with-migration-url.js node prisma/scripts/sanitize-staging.js --confirm kroptos_stg
const { PrismaClient } = require('@prisma/client');

const PROTECTED = (process.env.PROTECTED_DATABASES || 'eticaret')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Deterministik maskeler: aynı satır her çalıştırmada aynı değeri alır (yeniden çalıştırma güvenli).
const NAME = (id) => `'Müşteri ' || upper(substr(md5(${id}), 1, 6))`;
const EMAIL = (id) => `'musteri+' || substr(md5(${id}), 1, 10) || '@example.invalid'`;
const PHONE = (id) => `'+90500' || lpad((abs(hashtext(${id})) % 10000000)::text, 7, '0')`;
const ADDR = (id) => `'Maskelenmiş adres ' || upper(substr(md5(${id}), 1, 6))`;

const STEPS = [
  // ---- 1. kimlik bilgileri
  ['Integration kimlik + inactive', `UPDATE "Integration" SET "credentialsEncrypted" = '', "status" = 'inactive'`],
  ['IntegrationSetting sırları', `UPDATE "IntegrationSetting" SET "secretsEncrypted" = NULL WHERE "secretsEncrypted" IS NOT NULL`],
  ['CarrierIntegration kimlik', `UPDATE "CarrierIntegration" SET "credentials" = ''`],
  ['AccountingIntegration kimlik', `UPDATE "AccountingIntegration" SET "credentials" = NULL, "credentialFingerprint" = NULL WHERE "credentials" IS NOT NULL OR "credentialFingerprint" IS NOT NULL`],
  ['NotificationProviderConfig sırları', `UPDATE "NotificationProviderConfig" SET "secretsEncrypted" = NULL WHERE "secretsEncrypted" IS NOT NULL`],
  ['AgentCredentialEnvelope', `DELETE FROM "AgentCredentialEnvelope"`],
  ['AgentInstance tünel sırrı', `UPDATE "AgentInstance" SET "tunnelSecret" = NULL WHERE "tunnelSecret" IS NOT NULL`],
  ['AgentEnrollmentCode', `DELETE FROM "AgentEnrollmentCode"`],
  // ---- 2. oturum ve token'lar
  ['Session', `DELETE FROM "Session"`],
  ['RefreshToken', `DELETE FROM "RefreshToken"`],
  ['ApiKey', `DELETE FROM "ApiKey"`],
  ['Invitation', `DELETE FROM "Invitation"`],
  ['OrderExportJob indirme token', `UPDATE "OrderExportJob" SET "downloadTokenHash" = NULL WHERE "downloadTokenHash" IS NOT NULL`],
  ['User 2FA sırrı', `UPDATE "User" SET "twoFactorSecret" = NULL, "twoFactorEnabled" = false WHERE "twoFactorSecret" IS NOT NULL OR "twoFactorEnabled"`],
  // ---- 3. son müşteri kişisel verisi
  ['Order alıcı bilgisi',
    `UPDATE "Order" SET
       "customerName" = ${NAME('"id"')},
       "customerEmail" = CASE WHEN "customerEmail" IS NULL THEN NULL ELSE ${EMAIL('"id"')} END,
       "customerPhone" = CASE WHEN "customerPhone" IS NULL THEN NULL ELSE ${PHONE('"id"')} END,
       "shippingFullName" = CASE WHEN "shippingFullName" IS NULL THEN NULL ELSE ${NAME('"id"')} END,
       "shippingPhone" = CASE WHEN "shippingPhone" IS NULL THEN NULL ELSE ${PHONE('"id"')} END,
       "shippingAddress" = CASE WHEN "shippingAddress" IS NULL THEN NULL ELSE ${ADDR('"id"')} END,
       "shippingLine1" = CASE WHEN "shippingLine1" IS NULL THEN NULL ELSE ${ADDR('"id"')} END,
       "shippingLine2" = NULL,
       "notes" = NULL`],
  ['Shipment alıcı adresi', `UPDATE "Shipment" SET "recipientAddress" = '{"masked": true}'::jsonb WHERE "recipientAddress" IS NOT NULL`],
  ['NotificationLog alıcı + gövde',
    `UPDATE "NotificationLog" SET "recipient" = 'maskelendi-' || substr(md5("id"), 1, 8), "subject" = NULL, "renderedBody" = '[staging: maskelendi]'`],
  ['OrderImportRowResult anlık görüntü', `UPDATE "OrderImportRowResult" SET "beforeSnapshot" = NULL WHERE "beforeSnapshot" IS NOT NULL`],
  ['AccountingContactMapping cari',
    `UPDATE "AccountingContactMapping" SET
       "displayName" = CASE WHEN "displayName" IS NULL THEN NULL ELSE ${NAME('"id"')} END,
       "taxNumber" = NULL,
       "kroptosKey" = 'k_' || md5("kroptosKey")
     WHERE "kroptosKey" NOT LIKE 'k\\_%'`],
  ['AccountingDocument ham yanıt', `UPDATE "AccountingDocument" SET "rawResponse" = NULL WHERE "rawResponse" IS NOT NULL`],
  ['IntegrationLog (ham API trafiği)', `DELETE FROM "IntegrationLog"`],
  ['CarrierWebhookEvent (ham gövde)', `DELETE FROM "CarrierWebhookEvent"`],
  ['WebhookEvent (ham gövde)', `DELETE FROM "WebhookEvent"`],
  ['WebhookSubscription adresi', `UPDATE "WebhookSubscription" SET "url" = 'https://staging.invalid/webhook-disabled'`],
  ['AuditLog IP', `UPDATE "AuditLog" SET "ipAddress" = NULL WHERE "ipAddress" IS NOT NULL`],
];

// Sonradan kontrol: her sorgu 0 dönmeli.
const CHECKS = [
  ['dolu Integration kimliği', `SELECT count(*)::int AS n FROM "Integration" WHERE "credentialsEncrypted" <> ''`],
  ['aktif Integration', `SELECT count(*)::int AS n FROM "Integration" WHERE "status" <> 'inactive'`],
  ['dolu CarrierIntegration kimliği', `SELECT count(*)::int AS n FROM "CarrierIntegration" WHERE "credentials" <> ''`],
  ['dolu AccountingIntegration kimliği', `SELECT count(*)::int AS n FROM "AccountingIntegration" WHERE "credentials" IS NOT NULL`],
  ['dolu bildirim sırrı', `SELECT count(*)::int AS n FROM "NotificationProviderConfig" WHERE "secretsEncrypted" IS NOT NULL`],
  ['oturum', `SELECT count(*)::int AS n FROM "Session"`],
  ['maskelenmemiş müşteri e-postası', `SELECT count(*)::int AS n FROM "Order" WHERE "customerEmail" IS NOT NULL AND "customerEmail" NOT LIKE '%@example.invalid'`],
  ['maskelenmemiş müşteri adı', `SELECT count(*)::int AS n FROM "Order" WHERE "customerName" NOT LIKE 'Müşteri %'`],
  ['ham entegrasyon trafiği', `SELECT count(*)::int AS n FROM "IntegrationLog"`],
];

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (process.env.APP_ENV !== 'staging') {
    throw new Error(`APP_ENV=staging değil ('${process.env.APP_ENV ?? ''}'). Bu betik yalnız staging'de çalışır.`);
  }
  const confirm = argValue('--confirm');
  if (!confirm) throw new Error('--confirm <veritabanı-adı> zorunlu.');

  const prisma = new PrismaClient();
  try {
    const [{ db, bypass }] = await prisma.$queryRawUnsafe(
      `SELECT current_database() AS db,
              (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`,
    );
    if (db !== confirm) throw new Error(`Bağlantı '${db}' veritabanına gidiyor, --confirm '${confirm}' dedi. Durduruldu.`);
    if (PROTECTED.includes(db)) throw new Error(`'${db}' korunan veritabanı (PROTECTED_DATABASES). Durduruldu.`);
    if (!bypass) throw new Error('Bağlantı RLS\'i atlamıyor; satırlar gizlenir, temizlik yarım kalır. DATABASE_MIGRATION_URL ile çalıştırın.');

    console.log(`Staging temizliği: ${db}`);
    await prisma.$transaction(
      async (tx) => {
        for (const [label, sql] of STEPS) {
          let n;
          try {
            n = await tx.$executeRawUnsafe(sql);
          } catch (err) {
            const cause = err.meta?.message || String(err.message).trim().split('\n').pop();
            throw new Error(`Adım başarısız: "${label}" — ${cause}\nHiçbir değişiklik kalmadı (rollback).`);
          }
          console.log(`  ${String(n).padStart(7)}  ${label}`);
        }
        const failed = [];
        for (const [label, sql] of CHECKS) {
          const [{ n }] = await tx.$queryRawUnsafe(sql);
          if (n !== 0) failed.push(`${label}: ${n}`);
        }
        if (failed.length) {
          throw new Error(`Doğrulama başarısız, hiçbir değişiklik kalmadı (rollback):\n  ${failed.join('\n  ')}`);
        }
      },
      { timeout: 10 * 60 * 1000 },
    );
    console.log(`Doğrulama: ${CHECKS.length}/${CHECKS.length} kontrol 0 döndü. Temizlik tamam.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
