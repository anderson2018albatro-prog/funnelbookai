
ALTER TABLE public.presells
  ADD COLUMN IF NOT EXISTS extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS disclosure_text text DEFAULT 'Esta página pode conter links de afiliado. Podemos receber comissão por compras realizadas, sem custo adicional para você.',
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_presell_clicks(_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.presells
    SET click_count = click_count + 1
  WHERE slug = _slug AND is_published = true;
$$;

GRANT EXECUTE ON FUNCTION public.increment_presell_clicks(text) TO anon, authenticated;
