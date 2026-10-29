CREATE TABLE "CurrencyPurchase" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CurrencyPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurrencyPurchase_guildId_userId_itemId_key"
    ON "CurrencyPurchase"("guildId", "userId", "itemId");
CREATE INDEX "CurrencyPurchase_guildId_userId_idx"
    ON "CurrencyPurchase"("guildId", "userId");
