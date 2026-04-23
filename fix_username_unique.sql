-- Run this in your Supabase SQL Editor to fix the username unique constraint issue

ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_username_key;
