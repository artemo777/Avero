ALTER TABLE "AutoReactionRolePerk" ALTER COLUMN "roleId" DROP NOT NULL;
ALTER TABLE "AutoReactionRolePerk" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "AutoReactionRolePerk_guildId_userId_key" ON "AutoReactionRolePerk"("guildId", "userId");
ALTER TABLE "AutoReactionRolePerk" ADD CONSTRAINT "AutoReactionRolePerk_exactly_one_target_check" CHECK ((("roleId" IS NOT NULL)::int + ("userId" IS NOT NULL)::int) = 1);
