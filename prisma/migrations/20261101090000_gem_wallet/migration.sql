ALTER TABLE "CurrencyAccount"
ADD COLUMN "gemBalance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CurrencyTransaction"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'coins';
