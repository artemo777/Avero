-- Consolidate all member-owned records into one reserved global scope.
-- Discord guild IDs are numeric snowflakes, so this namespace cannot collide with a real guild.
-- GuildSettings and MoneyRequest origin metadata intentionally remain guild-scoped.

WITH totals AS (
  SELECT "userId",
         SUM("balance")::INTEGER AS balance,
         SUM("gemBalance")::INTEGER AS "gemBalance",
         MAX("lastDailyAt") AS "lastDailyAt",
         MAX("lastWorkAt") AS "lastWorkAt",
         MAX("lastScavengeAt") AS "lastScavengeAt",
         MAX("lastGameRewardAt") AS "lastGameRewardAt",
         (ARRAY_AGG("dailyStreak" ORDER BY "lastDailyAt" DESC NULLS LAST, "updatedAt" DESC))[1] AS "dailyStreak",
         MIN("createdAt") AS "createdAt",
         MAX("updatedAt") AS "updatedAt"
  FROM "CurrencyAccount"
  GROUP BY "userId"
)
INSERT INTO "CurrencyAccount"
  ("id", "guildId", "userId", "balance", "gemBalance", "lastDailyAt", "dailyStreak",
   "lastWorkAt", "lastScavengeAt", "lastGameRewardAt", "createdAt", "updatedAt")
SELECT 'global_' || md5("userId"), '__avero_global__', "userId", balance, "gemBalance",
       "lastDailyAt", "dailyStreak", "lastWorkAt", "lastScavengeAt", "lastGameRewardAt",
       "createdAt", "updatedAt"
FROM totals
ON CONFLICT ("guildId", "userId") DO UPDATE SET
  "balance" = EXCLUDED."balance",
  "gemBalance" = EXCLUDED."gemBalance",
  "lastDailyAt" = EXCLUDED."lastDailyAt",
  "dailyStreak" = EXCLUDED."dailyStreak",
  "lastWorkAt" = EXCLUDED."lastWorkAt",
  "lastScavengeAt" = EXCLUDED."lastScavengeAt",
  "lastGameRewardAt" = EXCLUDED."lastGameRewardAt",
  "createdAt" = EXCLUDED."createdAt",
  "updatedAt" = EXCLUDED."updatedAt";
DELETE FROM "CurrencyAccount" WHERE "guildId" <> '__avero_global__';

-- Merge profile progress; use the most recently updated profile for equipped cosmetics.
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "updatedAt" DESC, "createdAt" ASC, "id" ASC) AS rn,
         SUM("xp") OVER (PARTITION BY "userId") AS total_xp,
         MAX("level") OVER (PARTITION BY "userId") AS max_level,
         MAX("lastMessageXpAt") OVER (PARTITION BY "userId") AS latest_xp_at,
         MIN("createdAt") OVER (PARTITION BY "userId") AS first_created,
         MAX("updatedAt") OVER (PARTITION BY "userId") AS latest_updated
  FROM "MemberProfile"
), merged AS (
  SELECT "userId", total_xp, max_level, latest_xp_at, first_created, latest_updated,
         "equippedBadgeItemId", "equippedTitleId"
  FROM ranked WHERE rn = 1
)
INSERT INTO "MemberProfile"
  ("id", "guildId", "userId", "xp", "level", "lastMessageXpAt",
   "equippedBadgeItemId", "equippedTitleId", "createdAt", "updatedAt")
SELECT 'global_' || md5("userId"), '__avero_global__', "userId", total_xp, max_level,
       latest_xp_at, "equippedBadgeItemId", "equippedTitleId", first_created, latest_updated
FROM merged
ON CONFLICT ("guildId", "userId") DO UPDATE SET
  "xp" = EXCLUDED."xp", "level" = EXCLUDED."level",
  "lastMessageXpAt" = EXCLUDED."lastMessageXpAt",
  "equippedBadgeItemId" = EXCLUDED."equippedBadgeItemId",
  "equippedTitleId" = EXCLUDED."equippedTitleId",
  "createdAt" = EXCLUDED."createdAt", "updatedAt" = EXCLUDED."updatedAt";
DELETE FROM "MemberProfile" WHERE "guildId" <> '__avero_global__';

-- Ownership is a set: keep one row per user/item and preserve the earliest acquisition.
WITH merged AS (
  SELECT "userId", "itemId", MIN("purchasedAt") AS "purchasedAt"
  FROM "CurrencyPurchase" GROUP BY "userId", "itemId"
)
INSERT INTO "CurrencyPurchase" ("id", "guildId", "userId", "itemId", "purchasedAt")
SELECT 'global_' || md5("userId" || ':' || "itemId"), '__avero_global__', "userId", "itemId", "purchasedAt"
FROM merged
ON CONFLICT ("guildId", "userId", "itemId") DO UPDATE SET "purchasedAt" = LEAST("CurrencyPurchase"."purchasedAt", EXCLUDED."purchasedAt");
DELETE FROM "CurrencyPurchase" WHERE "guildId" <> '__avero_global__';

WITH merged AS (
  SELECT DISTINCT ON ("userId", "titleId")
         "userId", "titleId", "source", "acquiredAt"
  FROM "MemberTitle"
  ORDER BY "userId", "titleId", "acquiredAt" ASC, "id" ASC
)
INSERT INTO "MemberTitle" ("id", "guildId", "userId", "titleId", "source", "acquiredAt")
SELECT 'global_' || md5("userId" || ':' || "titleId"), '__avero_global__', "userId", "titleId", "source", "acquiredAt"
FROM merged
ON CONFLICT ("guildId", "userId", "titleId") DO NOTHING;
DELETE FROM "MemberTitle" WHERE "guildId" <> '__avero_global__';

-- Keep the most recently active career, preserve the greatest progress and latest cooldown.
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "updatedAt" DESC, "lastShiftAt" DESC NULLS LAST, "id" ASC) AS rn,
         MAX("shifts") OVER (PARTITION BY "userId") AS max_shifts,
         MAX("promotions") OVER (PARTITION BY "userId") AS max_promotions,
         MAX("lastShiftAt") OVER (PARTITION BY "userId") AS latest_shift,
         MIN("createdAt") OVER (PARTITION BY "userId") AS first_created,
         MAX("updatedAt") OVER (PARTITION BY "userId") AS latest_updated
  FROM "MemberJob"
), merged AS (
  SELECT "userId", "jobId", max_shifts, max_promotions, latest_shift, first_created, latest_updated
  FROM ranked WHERE rn = 1
)
INSERT INTO "MemberJob"
  ("id", "guildId", "userId", "jobId", "shifts", "promotions", "lastShiftAt", "createdAt", "updatedAt")
SELECT 'global_' || md5("userId"), '__avero_global__', "userId", "jobId",
       max_shifts, max_promotions, latest_shift, first_created, latest_updated
FROM merged
ON CONFLICT ("guildId", "userId") DO UPDATE SET
  "jobId" = EXCLUDED."jobId", "shifts" = EXCLUDED."shifts",
  "promotions" = EXCLUDED."promotions", "lastShiftAt" = EXCLUDED."lastShiftAt",
  "createdAt" = EXCLUDED."createdAt", "updatedAt" = EXCLUDED."updatedAt";
DELETE FROM "MemberJob" WHERE "guildId" <> '__avero_global__';

-- Claims are globally unique per user/date/contract. Keep the earliest record so
-- a reward claimed in one server cannot be claimed again in another.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "userId", "contractDate", "contractId"
    ORDER BY "claimedAt" ASC, "id" ASC
  ) AS rn
  FROM "DailyContractClaim"
)
DELETE FROM "DailyContractClaim" c USING ranked r
WHERE c."id" = r."id" AND r.rn > 1;
UPDATE "DailyContractClaim" SET "guildId" = '__avero_global__';

-- Preserve the full ledger (including same-day actions in different servers),
-- but make it queryable as one account history.
UPDATE "CurrencyTransaction" SET "guildId" = '__avero_global__';
