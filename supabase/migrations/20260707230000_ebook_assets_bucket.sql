-- Bucket público para ilustrações de ebook (capa + capítulos, geradas por IA ou upload)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ebook-assets', 'ebook-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ebook-assets public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ebook-assets');

CREATE POLICY "ebook-assets owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ebook-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ebook-assets owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ebook-assets' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'ebook-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ebook-assets owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ebook-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
