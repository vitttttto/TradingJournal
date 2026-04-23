ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS auto_fill_pnl BOOLEAN DEFAULT false;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS accounts_library JSONB;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS account_id TEXT;
