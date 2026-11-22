CREATE TABLE "GameSession" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" VARCHAR(40) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "payload" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GameSession_guildId_userId_status_idx" ON "GameSession"("guildId","userId","status");
CREATE INDEX "GameSession_expiresAt_idx" ON "GameSession"("expiresAt");
