-- Convert TradeStatus enum to string
-- This migration safely converts the enum column to text without data loss

-- Step 1: Add new temporary text column
ALTER TABLE "trades" ADD COLUMN "status_temp" TEXT;

-- Step 2: Copy data from enum column to text column
UPDATE "trades" SET "status_temp" = "status"::text;

-- Step 3: Drop the old enum column (this removes the index and constraints)
ALTER TABLE "trades" DROP COLUMN "status";

-- Step 4: Create new status column as text with constraints
ALTER TABLE "trades" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Step 5: Create index on the new status column
CREATE INDEX "trades_status_idx" ON "trades"("status");

-- Step 6: Copy data from temp column to new status column
UPDATE "trades" SET "status" = "status_temp";

-- Step 7: Drop the temporary column
ALTER TABLE "trades" DROP COLUMN "status_temp";

-- Step 8: Drop the TradeStatus enum type (only if no other tables use it)
DROP TYPE IF EXISTS "TradeStatus";