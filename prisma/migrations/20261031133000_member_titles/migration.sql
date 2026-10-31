ALTER TABLE "MemberProfile"
ADD COLUMN "equippedTitleId" TEXT;

CREATE TABLE "MemberTitle" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "titleId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'milestone',
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberTitle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberTitle_guildId_userId_titleId_key"
ON "MemberTitle"("guildId", "userId", "titleId");

CREATE INDEX "MemberTitle_guildId_userId_idx"
ON "MemberTitle"("guildId", "userId");
