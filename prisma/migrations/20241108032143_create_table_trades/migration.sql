-- CreateTable
CREATE TABLE "trades" (
    "id" SERIAL NOT NULL,
    "trade_id" TEXT NOT NULL,
    "from_token_id" TEXT NOT NULL,
    "from_network_id" TEXT NOT NULL,
    "to_token_id" TEXT NOT NULL,
    "to_network_id" TEXT NOT NULL,
    "from_user" TEXT NOT NULL,
    "to_user" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "indicative_quote" TEXT,
    "commitment_quote" TEXT,
    "settlement_quote" TEXT,
    "executed_price_usd" DOUBLE PRECISION,
    "settlement_tx" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trades_trade_id_key" ON "trades"("trade_id");

-- CreateIndex
CREATE INDEX "trades_status_idx" ON "trades"("status");

-- CreateIndex
CREATE INDEX "trades_from_token_id_idx" ON "trades"("from_token_id");

-- CreateIndex
CREATE INDEX "trades_to_token_id_idx" ON "trades"("to_token_id");
