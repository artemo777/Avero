CREATE TABLE "AdminEconomyAudit" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "currency" VARCHAR(10),
    "amount" INTEGER,
    "itemId" VARCHAR(40),
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminEconomyAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminEconomyAudit_guildId_targetUserId_createdAt_idx"
ON "AdminEconomyAudit"("guildId", "targetUserId", "createdAt");

CREATE INDEX "AdminEconomyAudit_guildId_actorUserId_createdAt_idx"
ON "AdminEconomyAudit"("guildId", "actorUserId", "createdAt");
