ALTER TABLE "ActivityRewardClaim" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "ActivityXpThrottle" (
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastMessageXpAt" TIMESTAMP(3),
  "voiceRemainderSeconds" INTEGER NOT NULL DEFAULT 0,
  "voiceMinutesAwarded" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ActivityXpThrottle_pkey" PRIMARY KEY ("guildId", "userId")
);

CREATE TABLE "ActivityXpAward" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityXpAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityXpAward_dedupeKey_key" ON "ActivityXpAward"("dedupeKey");
CREATE INDEX "ActivityXpAward_status_createdAt_idx" ON "ActivityXpAward"("status", "createdAt");
CREATE INDEX "ActivityXpAward_guildId_userId_createdAt_idx" ON "ActivityXpAward"("guildId", "userId", "createdAt");
