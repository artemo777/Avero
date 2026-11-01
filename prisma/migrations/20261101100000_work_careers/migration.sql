CREATE TABLE "MemberJob" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "shifts" INTEGER NOT NULL DEFAULT 0,
  "promotions" INTEGER NOT NULL DEFAULT 0,
  "lastShiftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemberJob_guildId_userId_key" ON "MemberJob"("guildId", "userId");
CREATE INDEX "MemberJob_guildId_jobId_idx" ON "MemberJob"("guildId", "jobId");
