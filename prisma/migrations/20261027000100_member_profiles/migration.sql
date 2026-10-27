CREATE TABLE "MemberProfile" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastMessageXpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberProfile_guildId_userId_key"
ON "MemberProfile"("guildId", "userId");

CREATE INDEX "MemberProfile_guildId_xp_idx"
ON "MemberProfile"("guildId", "xp");
