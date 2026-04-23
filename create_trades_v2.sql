-- 1. Create the new table structured identically to the old one
CREATE TABLE public.trades_v2 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    symbol TEXT,
    _price_format TEXT,
    _price_format_type TEXT,
    _tick_size NUMERIC,
    buy_fill_id TEXT,
    sell_fill_id TEXT,
    qty NUMERIC,
    buy_price NUMERIC,
    sell_price NUMERIC,
    pnl NUMERIC,
    bought_timestamp NUMERIC,
    sold_timestamp NUMERIC,
    duration NUMERIC,
    direction TEXT,
    commission NUMERIC,
    max_points_profit NUMERIC,
    account_id TEXT,
    notes TEXT,
    confluence_tags JSONB,
    mistake_tags JSONB,
    entry_tags JSONB,
    images JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Copy all data from trades to trades_v2
INSERT INTO public.trades_v2 (
    id, user_id, symbol, _price_format, _price_format_type, _tick_size,
    buy_fill_id, sell_fill_id, qty, buy_price, sell_price, pnl,
    bought_timestamp, sold_timestamp, duration, direction, commission,
    max_points_profit, account_id, notes, confluence_tags, mistake_tags,
    entry_tags, images, source, created_at
)
SELECT 
    id, user_id, symbol, _price_format, _price_format_type, _tick_size,
    buy_fill_id, sell_fill_id, qty, buy_price, sell_price, pnl,
    bought_timestamp, sold_timestamp, duration, direction, commission,
    max_points_profit, account_id, notes, confluence_tags, mistake_tags,
    entry_tags, images, source, created_at
FROM public.trades;

-- 3. Enable RLS on the new table
ALTER TABLE public.trades_v2 ENABLE ROW LEVEL SECURITY;

-- 4. Recreate the RLS policies for the new table
CREATE POLICY "Users can view their own trades and friends' trades" ON public.trades_v2 FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.friendships 
        WHERE status = 'accepted' 
        AND ((user_id = auth.uid() AND friend_id = trades_v2.user_id) OR (friend_id = auth.uid() AND user_id = trades_v2.user_id))
    )
);
CREATE POLICY "Users can insert their own trades" ON public.trades_v2 FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trades" ON public.trades_v2 FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trades" ON public.trades_v2 FOR DELETE USING (auth.uid() = user_id);
