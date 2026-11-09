-- Remove the retired XP, rank, and leaderboard subsystem.
-- Message milestone counters and unrelated economy/profile data remain intact.

DELETE FROM "AdminEconomyAudit" WHERE "action" = 'xp_add';

DROP TABLE IF EXISTS "ActivityRewardClaim";
DROP TABLE IF EXISTS "ActivityRewardRule";
DROP TABLE IF EXISTS "ActivityXpAward";
DROP TABLE IF EXISTS "ActivityXpThrottle";
DROP TABLE IF EXISTS "GuildMemberProgress";
DROP TABLE IF EXISTS "ActivityVoiceSession";
DROP TABLE IF EXISTS "ActivityMessageReceipt";
DROP TABLE IF EXISTS "ActivityStat";
DROP TABLE IF EXISTS "ActivityBoardSetting";

DROP INDEX IF EXISTS "MemberProfile_guildId_xp_idx";
ALTER TABLE "MemberProfile" DROP COLUMN IF EXISTS "xp";
ALTER TABLE "MemberProfile" DROP COLUMN IF EXISTS "level";
ALTER TABLE "MemberProfile" DROP COLUMN IF EXISTS "lastMessageXpAt";
