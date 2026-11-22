CREATE TABLE "AiMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" VARCHAR(40) NOT NULL DEFAULT 'general',
    "content" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiMemory_userId_content_key" ON "AiMemory"("userId", "content");
CREATE INDEX "AiMemory_userId_updatedAt_idx" ON "AiMemory"("userId", "updatedAt");
