CREATE TABLE "CurrencyAccount" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lastDailyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CurrencyAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurrencyAccount_guildId_userId_key"
    ON "CurrencyAccount"("guildId", "userId");
CREATE INDEX "CurrencyAccount_guildId_balance_idx"
    ON "CurrencyAccount"("guildId", "balance");

CREATE TABLE "CurrencyTransaction" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CurrencyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CurrencyTransaction_guildId_userId_createdAt_idx"
    ON "CurrencyTransaction"("guildId", "userId", "createdAt");
CREATE INDEX "CurrencyTransaction_guildId_type_createdAt_idx"
    ON "CurrencyTransaction"("guildId", "type", "createdAt");
