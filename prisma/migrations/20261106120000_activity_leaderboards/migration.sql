CREATE TABLE "ActivityBoardSetting" (
  "guildId" TEXT NOT NULL,
  "dailyChannelId" TEXT,
  "dailyMessageId" TEXT,
  "weeklyChannelId" TEXT,
  "weeklyMessageId" TEXT,
  "messageWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "voiceWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "weeklyResetDay" INTEGER NOT NULL DEFAULT 1,
  "updateIntervalSeconds" INTEGER NOT NULL DEFAULT 60,
  "voiceMinParticipants" INTEGER NOT NULL DEFAULT 2,
  "ignoredChannelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityBoardSetting_pkey" PRIMARY KEY ("guildId")
);
CREATE TABLE "ActivityStat" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodType" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "messages" INTEGER NOT NULL DEFAULT 0,
  "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityStat_guildId_userId_periodType_periodKey_key" ON "ActivityStat"("guildId", "userId", "periodType", "periodKey");
CREATE INDEX "ActivityStat_guildId_periodType_periodKey_idx" ON "ActivityStat"("guildId", "periodType", "periodKey");
CREATE TABLE "ActivityMessageReceipt" (
  "messageId" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityMessageReceipt_pkey" PRIMARY KEY ("messageId")
);
CREATE INDEX "ActivityMessageReceipt_createdAt_idx" ON "ActivityMessageReceipt"("createdAt");
CREATE TABLE "ActivityVoiceSession" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "lastSettledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityVoiceSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityVoiceSession_guildId_userId_key" ON "ActivityVoiceSession"("guildId", "userId");
CREATE TABLE "ActivityRewardRule" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "periodType" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "roleId" TEXT,
  "coins" INTEGER NOT NULL DEFAULT 0,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityRewardRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityRewardRule_guildId_periodType_position_key" ON "ActivityRewardRule"("guildId", "periodType", "position");
CREATE INDEX "ActivityRewardRule_guildId_periodType_enabled_idx" ON "ActivityRewardRule"("guildId", "periodType", "enabled");
CREATE TABLE "ActivityRewardClaim" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "periodType" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "roleId" TEXT,
  "coins" INTEGER NOT NULL DEFAULT 0,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  CONSTRAINT "ActivityRewardClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityRewardClaim_guildId_periodType_periodKey_position_key" ON "ActivityRewardClaim"("guildId", "periodType", "periodKey", "position");
CREATE INDEX "ActivityRewardClaim_guildId_periodType_periodKey_idx" ON "ActivityRewardClaim"("guildId", "periodType", "periodKey");