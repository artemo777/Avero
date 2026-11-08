ALTER TABLE "MemberProfile"
  ADD COLUMN "nextLevelXp" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN "totalMessages" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalVoiceSeconds" INTEGER NOT NULL DEFAULT 0;

UPDATE "MemberProfile" SET "nextLevelXp" = LEAST(2147483647::BIGINT, "xp"::BIGINT + 1000)::INTEGER;

-- Earlier Engauge rejections were confirmed not to have committed; deliver them locally.
UPDATE "ActivityXpAward" SET "status" = 'pending' WHERE "status" = 'rejected';

CREATE INDEX "MemberProfile_guildId_totalMessages_idx" ON "MemberProfile"("guildId", "totalMessages");
CREATE INDEX "MemberProfile_guildId_totalVoiceSeconds_idx" ON "MemberProfile"("guildId", "totalVoiceSeconds");

CREATE TABLE "EngaugeImportMarker" (
  "serverId" TEXT NOT NULL,
  "memberCount" INTEGER NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngaugeImportMarker_pkey" PRIMARY KEY ("serverId")
);
