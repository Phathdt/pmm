-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "apm" TEXT,
ADD COLUMN     "is_liquid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liquidation_id" TEXT,
ADD COLUMN     "position_id" TEXT;
