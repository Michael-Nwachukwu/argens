-- Global (platform-wide) marketplace kill-switch, keyed by provider id.
-- Absence of a row = provider enabled. A row with enabled=false pauses the
-- provider for everyone, overriding per-user MarketplaceServiceSetting.

-- CreateTable
CREATE TABLE "GlobalServiceSetting" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalServiceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalServiceSetting_providerId_key" ON "GlobalServiceSetting"("providerId");
