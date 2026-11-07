ALTER TABLE "ActivityBoardSetting" ALTER COLUMN "updateIntervalSeconds" SET DEFAULT 300;
UPDATE "ActivityBoardSetting" SET "updateIntervalSeconds" = 300;
