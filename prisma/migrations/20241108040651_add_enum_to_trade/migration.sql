/*
  Warnings:

  - The `status` column on the `trades` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'QUOTE_PROVIDED', 'COMMITTED', 'SETTLING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "trades" DROP COLUMN "status",
ADD COLUMN     "status" "TradeStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "trades_status_idx" ON "trades"("status");
