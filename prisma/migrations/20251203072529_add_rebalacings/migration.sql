-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "completed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "rebalancings" (
    "id" SERIAL NOT NULL,
    "rebalancing_id" TEXT NOT NULL,
    "trade_hash" TEXT NOT NULL,
    "trade_id" TEXT,
    "amount" TEXT NOT NULL,
    "real_amount" TEXT,
    "tx_id" TEXT,
    "vault_address" TEXT,
    "optimex_status" TEXT,
    "mempool_verified" BOOLEAN NOT NULL DEFAULT false,
    "deposit_address" TEXT,
    "near_vault_tx_id" TEXT,
    "quote_id" TEXT,
    "oracle_price" TEXT,
    "quote_price" TEXT,
    "slippage_bps" INTEGER,
    "expected_usdc" TEXT,
    "actual_usdc" TEXT,
    "near_tx_id" TEXT,
    "near_deposit_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "trade_completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rebalancings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rebalancings_rebalancing_id_key" ON "rebalancings"("rebalancing_id");

-- CreateIndex
CREATE UNIQUE INDEX "rebalancings_trade_hash_key" ON "rebalancings"("trade_hash");

-- CreateIndex
CREATE INDEX "rebalancings_status_idx" ON "rebalancings"("status");

-- CreateIndex
CREATE INDEX "rebalancings_optimex_status_idx" ON "rebalancings"("optimex_status");

-- CreateIndex
CREATE INDEX "rebalancings_created_at_idx" ON "rebalancings"("created_at");

-- CreateIndex
CREATE INDEX "rebalancings_tx_id_idx" ON "rebalancings"("tx_id");
