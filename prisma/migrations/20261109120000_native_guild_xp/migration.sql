CREATE TABLE "GuildMemberProgress" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "totalXp" INTEGER NOT NULL DEFAULT 0,
  "level" INTEGER NOT NULL DEFAULT 0,
  "nextLevelXp" INTEGER NOT NULL DEFAULT 1000,
  "messages" INTEGER NOT NULL DEFAULT 0,
  "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
  "currency" INTEGER NOT NULL DEFAULT 0,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuildMemberProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuildMemberProgress_guildId_userId_key" ON "GuildMemberProgress"("guildId", "userId");
CREATE INDEX "GuildMemberProgress_guildId_totalXp_idx" ON "GuildMemberProgress"("guildId", "totalXp");
CREATE INDEX "GuildMemberProgress_guildId_level_idx" ON "GuildMemberProgress"("guildId", "level");