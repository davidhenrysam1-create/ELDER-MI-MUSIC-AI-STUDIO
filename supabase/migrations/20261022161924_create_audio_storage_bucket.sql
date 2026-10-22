/*
# Create audio storage bucket

Creates a private storage bucket for user audio files. Files are scoped per user
under a `user_id/project_id/` path prefix. RLS policies ensure users can only
access their own audio files.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own audio" ON storage.objects;
CREATE POLICY "Users can upload own audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read own audio" ON storage.objects;
CREATE POLICY "Users can read own audio" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audio-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own audio" ON storage.objects;
CREATE POLICY "Users can update own audio" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audio-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'audio-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own audio" ON storage.objects;
CREATE POLICY "Users can delete own audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audio-files' AND (storage.foldername(name))[1] = auth.uid()::text);
