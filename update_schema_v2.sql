CREATE TABLE IF NOT EXISTS public.suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    name TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert suggestions" ON public.suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view suggestions" ON public.suggestions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.global_settings (
    id TEXT PRIMARY KEY,
    maintenance_mode BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view global_settings" ON public.global_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update global_settings" ON public.global_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = auth.uid() AND role = 'admin')
);
INSERT INTO public.global_settings (id, maintenance_mode) VALUES ('default', false) ON CONFLICT DO NOTHING;

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lab_state JSONB;
