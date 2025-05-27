-- Add columns for credit installment tracking to transactions table
-- Run this script against your Supabase database to update the schema.

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS is_credit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS installments INTEGER,
ADD COLUMN IF NOT EXISTS original_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS remaining_installments INTEGER;

-- Add an index for filtering credit transactions
CREATE INDEX IF NOT EXISTS transactions_is_credit_idx ON public.transactions(is_credit);

-- Optional: Add a check constraint for installments
-- This ensures data integrity for installment-based transactions.
-- Uncomment and run if you want this extra validation.
-- ALTER TABLE public.transactions
-- ADD CONSTRAINT check_installments CHECK (
--   (is_credit IS NULL OR is_credit = FALSE) OR
--   (is_credit = TRUE AND
--    installments IS NOT NULL AND installments > 0 AND
--    remaining_installments IS NOT NULL AND remaining_installments >= 0 AND remaining_installments <= installments AND
--    original_amount IS NOT NULL AND original_amount > 0)
-- );

-- Note: You might need to update existing rows if you enable the check constraint
-- and have existing data that violates it.

-- Update RLS policies if needed (usually not required for adding columns, but good practice to review)
-- Example: Ensure SELECT policy includes new columns if specific columns were listed previously.
-- The current policies use '*' which should automatically include new columns.

-- Refresh Supabase schema cache if necessary (usually automatic, but can be forced in Supabase dashboard)
