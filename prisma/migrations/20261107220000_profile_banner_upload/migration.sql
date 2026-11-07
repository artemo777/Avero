ALTER TABLE "MemberProfile"
  ADD COLUMN "profileBannerImage" BYTEA,
  ADD COLUMN "profileBannerImageType" TEXT;

UPDATE "MemberProfile"
SET "profileShowcaseBadgeIds" = ARRAY["equippedBadgeItemId"]
WHERE "equippedBadgeItemId" IS NOT NULL
  AND cardinality("profileShowcaseBadgeIds") = 0;
