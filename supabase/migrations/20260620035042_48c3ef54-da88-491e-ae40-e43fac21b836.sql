-- Drop legacy project-based schema
DROP TABLE IF EXISTS public.sales_pages CASCADE;
DROP TABLE IF EXISTS public.ebooks CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- ============ EBOOKS ============
CREATE TABLE public.ebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  niche text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ebooks TO authenticated;
GRANT ALL ON public.ebooks TO service_role;

ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ebooks_select_own" ON public.ebooks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ebooks_insert_own" ON public.ebooks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ebooks_update_own" ON public.ebooks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ebooks_delete_own" ON public.ebooks FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ebooks_set_updated_at BEFORE UPDATE ON public.ebooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SALES_PAGES ============
CREATE TABLE public.sales_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ebook_id uuid NOT NULL REFERENCES public.ebooks(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  html_content text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_pages TO authenticated;
GRANT SELECT ON public.sales_pages TO anon;
GRANT ALL ON public.sales_pages TO service_role;

ALTER TABLE public.sales_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_pages_select_own" ON public.sales_pages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sales_pages_public_read" ON public.sales_pages FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "sales_pages_insert_own" ON public.sales_pages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sales_pages_update_own" ON public.sales_pages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sales_pages_delete_own" ON public.sales_pages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER sales_pages_set_updated_at BEFORE UPDATE ON public.sales_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER_CREDITS ============
CREATE TABLE public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_credits_select_own" ON public.user_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_credits_set_updated_at BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create credits on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, credits) VALUES (NEW.id, 10)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- Backfill credits for existing users
INSERT INTO public.user_credits (user_id, credits)
SELECT id, 10 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;