DROP POLICY IF EXISTS "SalesPages: public read" ON public.sales_pages;
CREATE POLICY "SalesPages: public read published" ON public.sales_pages FOR SELECT TO anon USING (public_url IS NOT NULL);