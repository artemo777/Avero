ALTER TABLE "GuildSettings"
  ADD COLUMN "profileName" TEXT,
  ADD COLUMN "profileBio" TEXT,
  ADD COLUMN "profileTheme" TEXT NOT NULL DEFAULT 'violet';