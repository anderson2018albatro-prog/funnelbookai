-- Permite criar páginas de venda sem estar vinculada a um ebook
ALTER TABLE public.sales_pages
  ALTER COLUMN ebook_id DROP NOT NULL;
