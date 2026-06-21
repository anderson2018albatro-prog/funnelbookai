
ALTER TABLE public.sales_pages 
  ADD COLUMN IF NOT EXISTS blocks jsonb,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text;
