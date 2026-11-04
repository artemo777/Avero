CREATE TABLE "MemberMessageCounter" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberMessageCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemberMessageCounter_guildId_userId_key" ON "MemberMessageCounter"("guildId", "userId");
CREATE INDEX "MemberMessageCounter_guildId_count_idx" ON "MemberMessageCounter"("guildId", "count");

CREATE TABLE "AutoResponseMilestone" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "threshold" INTEGER NOT NULL,
  "responseContent" VARCHAR(1800) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutoResponseMilestone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutoResponseMilestone_guildId_threshold_key" ON "AutoResponseMilestone"("guildId", "threshold");
CREATE INDEX "AutoResponseMilestone_guildId_enabled_threshold_idx" ON "AutoResponseMilestone"("guildId", "enabled", "threshold");

CREATE TABLE "MemberMessageMilestoneAward" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "threshold" INTEGER NOT NULL,
  "countAtAward" INTEGER NOT NULL,
  "channelId" TEXT NOT NULL,
  "responseContent" VARCHAR(1800) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" VARCHAR(500),
  "claimedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberMessageMilestoneAward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemberMessageMilestoneAward_guildId_userId_threshold_key"
  ON "MemberMessageMilestoneAward"("guildId", "userId", "threshold");
CREATE INDEX "MemberMessageMilestoneAward_guildId_userId_status_idx"
  ON "MemberMessageMilestoneAward"("guildId", "userId", "status");
CREATE INDEX "MemberMessageMilestoneAward_status_claimedAt_idx"
  ON "MemberMessageMilestoneAward"("status", "claimedAt");
