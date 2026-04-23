-- WARNING: This will delete all existing data in these tables.
-- Run this in your Supabase SQL Editor to start completely fresh.

-- 1. Drop existing tables and policies to start fresh
DROP TABLE IF EXISTS public.friendships CASCADE;
DROP TABLE IF EXISTS public.trades CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- 2. Create user_settings table
CREATE TABLE public.user_settings (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    access_status TEXT DEFAULT 'pending',
    theme_id TEXT,
    accent_color TEXT,
    gradient_start TEXT,
    gradient_mid TEXT,
    gradient_end TEXT,
    panel_tint TEXT,
    text_color TEXT,
    glass_opacity NUMERIC,
    single_color BOOLEAN,
    breakeven_low NUMERIC,
    breakeven_high NUMERIC,
    auto_fill_pnl BOOLEAN DEFAULT false,
    friends_private BOOLEAN DEFAULT false,
    friends_share_details BOOLEAN DEFAULT false,
    manual_trade_symbol TEXT,
    accounts_library JSONB,
    confluence_library JSONB,
    mistake_library JSONB,
    entry_library JSONB,
    saved_presets JSONB,
    lab_state JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any user_settings" ON public.user_settings FOR SELECT USING (true);
CREATE POLICY "Users can insert their own user_settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own user_settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any user_settings" ON public.user_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Create friendships table
CREATE TABLE public.friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    friend_id UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can insert friendships" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own friendships" ON public.friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete their own friendships" ON public.friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 4. Create trades table
CREATE TABLE public.trades (
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
    bought_timestamp BIGINT,
    sold_timestamp BIGINT,
    duration NUMERIC,
    direction TEXT,
    account_id TEXT,
    commission NUMERIC,
    max_points_profit NUMERIC,
    notes TEXT,
    confluence_tags JSONB,
    mistake_tags JSONB,
    entry_tags JSONB,
    images JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trades and friends' trades" ON public.trades FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.friendships 
        WHERE status = 'accepted' 
        AND ((user_id = auth.uid() AND friend_id = trades.user_id) OR (friend_id = auth.uid() AND user_id = trades.user_id))
    )
);
CREATE POLICY "Users can insert their own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- 5. Create suggestions table
DROP TABLE IF EXISTS public.suggestions CASCADE;
CREATE TABLE public.suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    suggestion TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'discarded', 'implemented')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own suggestions" ON public.suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own suggestions" ON public.suggestions FOR SELECT USING (auth.uid() = user_id);
-- Admins need to be able to see all suggestions
CREATE POLICY "Admins can view all suggestions" ON public.suggestions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update all suggestions" ON public.suggestions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = auth.uid() AND role = 'admin')
);

-- 6. Create global_settings table
DROP TABLE IF EXISTS public.global_settings CASCADE;
CREATE TABLE public.global_settings (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view global_settings" ON public.global_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update global_settings" ON public.global_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can insert global_settings" ON public.global_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = auth.uid() AND role = 'admin')
);

-- Insert default maintenance mode setting
INSERT INTO public.global_settings (id, value) VALUES ('maintenance_mode', '{"enabled": false, "message": "brb"}'::jsonb) ON CONFLICT (id) DO NOTHING;
