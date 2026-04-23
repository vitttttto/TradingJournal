-- Create suggestions table
CREATE TABLE IF NOT EXISTS public.suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    username TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status TEXT DEFAULT 'pending'
);

-- Enable RLS for suggestions
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create suggestions" ON public.suggestions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all suggestions" ON public.suggestions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_settings WHERE user_settings.user_id = auth.uid() AND user_settings.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage suggestions" ON public.suggestions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_settings WHERE user_settings.user_id = auth.uid() AND user_settings.role = 'admin'
        )
    );

-- Create global_settings table
CREATE TABLE IF NOT EXISTS public.global_settings (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for global_settings
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global_settings" ON public.global_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage global_settings" ON public.global_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_settings WHERE user_settings.user_id = auth.uid() AND user_settings.role = 'admin'
        )
    );

-- Insert initial Maintenance Mode setting
INSERT INTO public.global_settings (id, value) VALUES ('maintenance_mode', '{"enabled": false, "message": "Down for maintenance"}') ON CONFLICT (id) DO NOTHING;

-- Add lab_state to user_settings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'lab_state') THEN
        ALTER TABLE public.user_settings ADD COLUMN lab_state JSONB;
    END IF;
END $$;
