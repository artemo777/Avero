CREATE TABLE "GuildSettings" (
  "guildId" TEXT NOT NULL,
  "gamesEnabled" BOOLEAN NOT NULL DEFAULT true,
  "currencyEnabled" BOOLEAN NOT NULL DEFAULT true,
  "dailyReward" INTEGER NOT NULL DEFAULT 100,
  "workMinReward" INTEGER NOT NULL DEFAULT 60,
  "workMaxReward" INTEGER NOT NULL DEFAULT 120,
  "boosterRoleId" TEXT,
  "funderRoleId" TEXT,
  "voterRoleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("guildId")
);