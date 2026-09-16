-- P12 Adım 2 / 0: uygulama DB rolü + RLS yardımcı fonksiyonu.
-- Uygulanma: superuser ile (DATABASE_MIGRATION_URL)
--   psql "$DATABASE_MIGRATION_URL" -v app_password='<gizli>' -f prisma/scripts/p12-rls-00-role.sql
-- Ardından backend .env: DATABASE_URL=postgresql://kroptos_app:<gizli>@host:5432/eticaret
--                        DATABASE_MIGRATION_URL=postgresql://postgres:...@host:5432/eticaret
--
-- Neden ayrı rol: superuser ve tablo sahibi RLS'i her zaman atlar. Politikalar ancak
-- NOSUPERUSER + NOBYPASSRLS bir rolle bağlanan uygulama için hüküm sürer.
-- Şema değişikliği (db push) ve seed superuser bağlantısıyla yapılır.

\set ON_ERROR_STOP on

-- psql değişkeni dollar-quoted blok içinde açılmaz; oturum GUC'u üzerinden taşınır.
SELECT set_config('app.setup_password', :'app_password', false);
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kroptos_app') THEN
    EXECUTE format('CREATE ROLE kroptos_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %L', current_setting('app.setup_password'));
  ELSE
    EXECUTE format('ALTER ROLE kroptos_app NOSUPERUSER NOBYPASSRLS PASSWORD %L', current_setting('app.setup_password'));
  END IF;
END $body$;
SELECT set_config('app.setup_password', '', false);

GRANT CONNECT ON DATABASE eticaret TO kroptos_app;
GRANT USAGE ON SCHEMA public TO kroptos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kroptos_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO kroptos_app;
-- db push sonrası yeni tablolar da otomatik erişilebilir olsun (postgres'in yarattıkları)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kroptos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO kroptos_app;

-- Politika yardımcısı. Bypass yalnız açıkça 'on' ise; app.agency_id yoksa/boşsa hiçbir satır eşleşmez.
CREATE OR REPLACE FUNCTION public.app_rls_allowed(row_agency text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $fn$
  SELECT current_setting('app.rls_bypass', true) = 'on'
      OR (row_agency IS NOT NULL AND row_agency = current_setting('app.agency_id', true));
$fn$;

GRANT EXECUTE ON FUNCTION public.app_rls_allowed(text) TO kroptos_app;

-- Doğrulama: uygulama rolü RLS'i atlayamamalı
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'kroptos_app';
