CREATE TABLE "AutoResponseRule" (
  "id" TEXT NOT NULL, "guildId" TEXT NOT NULL, "name" VARCHAR(50) NOT NULL,
  "matchType" TEXT NOT NULL DEFAULT 'contains', "trigger" VARCHAR(200) NOT NULL DEFAULT '',
  "responseType" TEXT NOT NULL DEFAULT 'text', "responseContent" VARCHAR(2000) NOT NULL,
  "randomResponses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "enabled" BOOLEAN NOT NULL DEFAULT true,
  "caseSensitive" BOOLEAN NOT NULL DEFAULT false, "priority" INTEGER NOT NULL DEFAULT 0,
  "stopOnMatch" BOOLEAN NOT NULL DEFAULT true, "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
  "perUserCooldownSeconds" INTEGER NOT NULL DEFAULT 0, "deleteAfterSeconds" INTEGER NOT NULL DEFAULT 0,
  "allowedChannelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "ignoredChannelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedRoleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "ignoredRoleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutoResponseRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutoResponseRule_guildId_enabled_priority_idx" ON "AutoResponseRule"("guildId", "enabled", "priority");
CREATE TABLE "AutoResponseCooldown" (
  "id" TEXT NOT NULL, "ruleId" TEXT NOT NULL, "scopeKey" TEXT NOT NULL,
  "lastTriggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutoResponseCooldown_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutoResponseCooldown_ruleId_scopeKey_key" ON "AutoResponseCooldown"("ruleId", "scopeKey");
CREATE INDEX "AutoResponseCooldown_lastTriggeredAt_idx" ON "AutoResponseCooldown"("lastTriggeredAt");
CREATE TABLE "AutoResponseLog" (
  "id" TEXT NOT NULL, "guildId" TEXT NOT NULL, "ruleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL, "channelId" TEXT NOT NULL, "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutoResponseLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutoResponseLog_guildId_status_createdAt_idx" ON "AutoResponseLog"("guildId", "status", "createdAt");
CREATE INDEX "AutoResponseLog_ruleId_createdAt_idx" ON "AutoResponseLog"("ruleId", "createdAt");
