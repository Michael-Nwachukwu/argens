-- Credits become expirable: per-grant amountRemaining (FIFO consumption by expiresAt).
-- Wallet.creditsBalance is dropped in favour of computing live from CreditGrant rows.

-- AlterTable
ALTER TABLE "CreditGrant" ADD COLUMN     "amountRemaining" DECIMAL(18,7) NOT NULL;

-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "creditsBalance";

-- CreateIndex
CREATE INDEX "CreditGrant_userId_expiresAt_idx" ON "CreditGrant"("userId", "expiresAt");
