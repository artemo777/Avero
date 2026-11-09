-- These audit columns were used only by the retired admin XP grant path.
ALTER TABLE "AdminEconomyAudit" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "AdminEconomyAudit" DROP COLUMN IF EXISTS "amount";
