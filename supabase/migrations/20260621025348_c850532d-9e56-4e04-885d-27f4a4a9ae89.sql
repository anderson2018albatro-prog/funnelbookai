ALTER TABLE public.ebooks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.sales_pages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS error_message text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ebooks TO authenticated;
GRANT ALL ON public.ebooks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_pages TO authenticated;
GRANT SELECT ON public.sales_pages TO anon;
GRANT ALL ON public.sales_pages TO service_role;
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;

CREATE INDEX IF NOT EXISTS ebooks_user_created_idx ON public.ebooks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_pages_user_created_idx ON public.sales_pages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_pages_ebook_id_idx ON public.sales_pages(ebook_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_credits_user_id_unique_idx ON public.user_credits(user_id);

ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ebooks_select_own ON public.ebooks;
DROP POLICY IF EXISTS ebooks_insert_own ON public.ebooks;
DROP POLICY IF EXISTS ebooks_update_own ON public.ebooks;
DROP POLICY IF EXISTS ebooks_delete_own ON public.ebooks;
CREATE POLICY ebooks_select_own ON public.ebooks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ebooks_insert_own ON public.ebooks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ebooks_update_own ON public.ebooks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ebooks_delete_own ON public.ebooks FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sales_pages_select_own ON public.sales_pages;
DROP POLICY IF EXISTS sales_pages_public_read ON public.sales_pages;
DROP POLICY IF EXISTS sales_pages_insert_own ON public.sales_pages;
DROP POLICY IF EXISTS sales_pages_update_own ON public.sales_pages;
DROP POLICY IF EXISTS sales_pages_delete_own ON public.sales_pages;
CREATE POLICY sales_pages_select_own ON public.sales_pages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY sales_pages_public_read ON public.sales_pages FOR SELECT TO anon USING (is_published = true AND status = 'completed');
CREATE POLICY sales_pages_insert_own ON public.sales_pages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY sales_pages_update_own ON public.sales_pages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY sales_pages_delete_own ON public.sales_pages FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_credits_select_own ON public.user_credits;
CREATE POLICY user_credits_select_own ON public.user_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);