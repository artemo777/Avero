CREATE TABLE "AutoReactionSetting" (
  "guildId" TEXT NOT NULL,
  "emoji" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "ignoredChannelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutoReactionSetting_pkey" PRIMARY KEY ("guildId")
);

-- Never carry the previous every-message behavior into the mention-only feature.
UPDATE "AutoReactionSetting" SET "enabled" = false, "emoji" = NULL;

CREATE TABLE "AutoReactionRolePerk" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AutoReactionRolePerk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutoReactionRolePerk_guildId_roleId_key"
  ON "AutoReactionRolePerk"("guildId", "roleId");
CREATE INDEX "AutoReactionRolePerk_guildId_idx"
  ON "AutoReactionRolePerk"("guildId");
