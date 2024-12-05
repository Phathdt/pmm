-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "script_deadline" TIMESTAMP(3),
ADD COLUMN     "trade_deadline" TIMESTAMP(3),
ADD COLUMN     "user_deposit_tx" TEXT,
ADD COLUMN     "user_deposit_vault" TEXT;
