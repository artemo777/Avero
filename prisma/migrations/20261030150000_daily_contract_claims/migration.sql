CREATE TABLE "DailyContractClaim" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractDate" TEXT NOT NULL,
    "reward" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyContractClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyContractClaim_guildId_userId_contractDate_contractId_key"
ON "DailyContractClaim"("guildId", "userId", "contractDate", "contractId");

CREATE INDEX "DailyContractClaim_guildId_contractDate_idx"
ON "DailyContractClaim"("guildId", "contractDate");
