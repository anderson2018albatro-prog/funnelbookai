-- Conversas do Construtor de Página de Vendas via chat (uma por página)
CREATE TABLE IF NOT EXISTS public.sales_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id uuid NOT NULL UNIQUE REFERENCES public.sales_pages(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_chats TO authenticated;
GRANT ALL ON public.sales_chats TO service_role;

ALTER TABLE public.sales_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_chats_select_own ON public.sales_chats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY sales_chats_insert_own ON public.sales_chats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY sales_chats_update_own ON public.sales_chats
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY sales_chats_delete_own ON public.sales_chats
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
