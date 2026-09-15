-- AlterTable: AccountingIntegration (K14 - eşzamanlılık tavanı lisans sınırı)
ALTER TABLE "AccountingIntegration" ADD COLUMN IF NOT EXISTS "maxSessions" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: AccountingCompany (D6 - kayıt parametreleri)
ALTER TABLE "AccountingCompany" ADD COLUMN IF NOT EXISTS "postingDefaults" JSONB;
