-- Add notes column to transactions table if it doesn't exist
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes TEXT;

