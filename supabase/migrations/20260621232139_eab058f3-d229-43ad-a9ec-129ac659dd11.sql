
CREATE TABLE public.presells (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Presell',
  slug TEXT NOT NULL UNIQUE,
  source_url TEXT,
  affiliate_url TEXT NOT NULL DEFAULT '#',
  presell_type TEXT NOT NULL DEFAULT 'review',
  tone TEXT,
  language TEXT DEFAULT 'pt-BR',
  blocks JSONB,
  html_content TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  is_published BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presells TO authenticated;
GRANT SELECT ON public.presells TO anon;
GRANT ALL ON public.presells TO service_role;

ALTER TABLE public.presells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own presells" ON public.presells
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read published presells" ON public.presells
  FOR SELECT TO anon
  USING (is_published = true);

CREATE TRIGGER set_presells_updated_at
  BEFORE UPDATE ON public.presells
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX presells_user_id_idx ON public.presells(user_id);
CREATE INDEX presells_slug_idx ON public.presells(slug);
