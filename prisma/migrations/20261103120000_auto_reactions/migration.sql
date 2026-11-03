CREATE TABLE "AutoReactionSetting" (
  "guildId" TEXT NOT NULL,
  "emoji" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "ignoredChannelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutoReactionSetting_pkey" PRIMARY KEY ("guildId")
);
