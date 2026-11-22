CREATE TABLE "ReputationVote" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "giverId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "reason" VARCHAR(180),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  CONSTRAINT "ReputationVote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReputationVote_guildId_receiverId_createdAt_idx" ON "ReputationVote"("guildId", "receiverId", "createdAt");
CREATE INDEX "ReputationVote_guildId_giverId_createdAt_idx" ON "ReputationVote"("guildId", "giverId", "createdAt");

CREATE TABLE "ReputationCooldown" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "giverId" TEXT NOT NULL,
  "lastGivenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReputationCooldown_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReputationCooldown_guildId_giverId_key" ON "ReputationCooldown"("guildId", "giverId");
