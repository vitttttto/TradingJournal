-- Run this SQL in your Supabase SQL Editor to fix the "View Only" issue.

-- If you have a table named "trades_with_names" that is view only:
ALTER TABLE public.trades_with_names ADD PRIMARY KEY (id);

-- Also, if you created trades_v2 by copying data and it is also view only, fix it here:
ALTER TABLE public.trades_v2 ADD PRIMARY KEY (id);

-- If you are missing the UUID default generation on the ID column for new inserts, add it:
ALTER TABLE public.trades_with_names ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.trades_v2 ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Make sure Row Level Security is enabled on trades_v2 so the app can fetch/save securely
ALTER TABLE public.trades_v2 ENABLE ROW LEVEL SECURITY;
