-- Run this in your Supabase SQL Editor to set up the necessary tables and RLS policies

-- 1. Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE,
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
    friends_private BOOLEAN DEFAULT false,
    confluence_library JSONB,
    mistake_library JSONB,
    entry_library JSONB,
    saved_presets JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies for user_settings
CREATE POLICY "Users can view any user_settings"
    ON public.user_settings FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own user_settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own user_settings"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- 2. Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    friend_id UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, friend_id)
);

-- Enable RLS for friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policies for friendships
CREATE POLICY "Users can view their own friendships"
    ON public.friendships FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friendships"
    ON public.friendships FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friendships"
    ON public.friendships FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their own friendships"
    ON public.friendships FOR DELETE
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 3. Update trades table (if not already existing)
CREATE TABLE IF NOT EXISTS public.trades (
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
    confluence_tags JSONB,
    mistake_tags JSONB,
    entry_tags JSONB,
    images JSONB,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for trades
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Policies for trades
CREATE POLICY "Users can view their own trades and friends' trades"
    ON public.trades FOR SELECT
    USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.friendships 
            WHERE status = 'accepted' 
            AND ((user_id = auth.uid() AND friend_id = trades.user_id) OR (friend_id = auth.uid() AND user_id = trades.user_id))
        )
    );

CREATE POLICY "Users can insert their own trades"
    ON public.trades FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
    ON public.trades FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades"
    ON public.trades FOR DELETE
    USING (auth.uid() = user_id);
