/*
  Warnings:

  - You are about to drop the column `executed_price_usd` on the `trades` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "trades" DROP COLUMN "executed_price_usd";
