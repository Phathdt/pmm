-- CreateTable
CREATE TABLE "transfers" (
    "id" SERIAL NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "token_address" TEXT,
    "to_address" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evm_transfer_details" (
    "id" SERIAL NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "nonce" TEXT,
    "gas_limit" TEXT,
    "gas_price" TEXT,
    "max_fee_per_gas" TEXT,
    "max_priority_fee_per_gas" TEXT,
    "transaction_type" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "replacement_count" INTEGER NOT NULL DEFAULT 0,
    "parent_transfer_id" TEXT,
    "block_number" TEXT,
    "confirmation_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evm_transfer_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_transfers" (
    "id" SERIAL NOT NULL,
    "trade_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfers_transfer_id_key" ON "transfers"("transfer_id");

-- CreateIndex
CREATE INDEX "transfers_status_idx" ON "transfers"("status");

-- CreateIndex
CREATE INDEX "transfers_platform_idx" ON "transfers"("platform");

-- CreateIndex
CREATE INDEX "transfers_platform_network_id_idx" ON "transfers"("platform", "network_id");

-- CreateIndex
CREATE INDEX "transfers_created_at_idx" ON "transfers"("created_at");

-- CreateIndex
CREATE INDEX "transfers_transfer_id_idx" ON "transfers"("transfer_id");

-- CreateIndex
CREATE INDEX "evm_transfer_details_transfer_id_idx" ON "evm_transfer_details"("transfer_id");

-- CreateIndex
CREATE INDEX "evm_transfer_details_nonce_idx" ON "evm_transfer_details"("nonce");

-- CreateIndex
CREATE INDEX "evm_transfer_details_parent_transfer_id_idx" ON "evm_transfer_details"("parent_transfer_id");

-- CreateIndex
CREATE INDEX "evm_transfer_details_block_number_idx" ON "evm_transfer_details"("block_number");

-- CreateIndex
CREATE INDEX "evm_transfer_details_transaction_type_idx" ON "evm_transfer_details"("transaction_type");

-- CreateIndex
CREATE INDEX "trade_transfers_trade_id_idx" ON "trade_transfers"("trade_id");

-- CreateIndex
CREATE INDEX "trade_transfers_transfer_id_idx" ON "trade_transfers"("transfer_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_transfers_trade_id_transfer_id_key" ON "trade_transfers"("trade_id", "transfer_id");
