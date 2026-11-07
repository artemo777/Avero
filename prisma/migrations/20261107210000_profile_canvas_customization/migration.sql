ALTER TABLE "MemberProfile"
  ADD COLUMN "profileAccentColor" INTEGER NOT NULL DEFAULT 9141503,
  ADD COLUMN "profileBanner" TEXT NOT NULL DEFAULT 'midnight',
  ADD COLUMN "equippedAvatarDecorationId" TEXT,
  ADD COLUMN "profileShowcaseBadgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "MemberProfile" ADD COLUMN "profileBio" TEXT;
