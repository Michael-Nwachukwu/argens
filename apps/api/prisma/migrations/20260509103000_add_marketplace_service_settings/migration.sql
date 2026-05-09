CREATE TABLE "MarketplaceServiceSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceServiceSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceServiceSetting_userId_serviceId_key" ON "MarketplaceServiceSetting"("userId", "serviceId");
CREATE INDEX "MarketplaceServiceSetting_userId_idx" ON "MarketplaceServiceSetting"("userId");

ALTER TABLE "MarketplaceServiceSetting"
ADD CONSTRAINT "MarketplaceServiceSetting_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
