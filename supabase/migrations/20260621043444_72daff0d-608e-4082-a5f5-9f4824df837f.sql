
-- Public read of files in sales-assets
CREATE POLICY "sales-assets public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'sales-assets');

-- Authenticated users upload to a folder named with their uid
CREATE POLICY "sales-assets owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sales-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "sales-assets owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sales-assets' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'sales-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "sales-assets owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sales-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
