ALTER TABLE "MemberProfile"
  ADD COLUMN "profileAccentColor" INTEGER NOT NULL DEFAULT 9149695,
  ADD COLUMN "profileBanner" TEXT NOT NULL DEFAULT 'midnight',
  ADD COLUMN "equippedAvatarDecorationId" TEXT,
  ADD COLUMN "profileShowcaseBadgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
