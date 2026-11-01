CREATE TABLE "MoneyRequest" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "MoneyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MoneyRequest_guildId_targetId_status_expiresAt_idx" ON "MoneyRequest"("guildId", "targetId", "status", "expiresAt");
CREATE INDEX "MoneyRequest_guildId_requesterId_createdAt_idx" ON "MoneyRequest"("guildId", "requesterId", "createdAt");
