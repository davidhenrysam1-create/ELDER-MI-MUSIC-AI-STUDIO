/*
# Elder Mi Music AI Studio — Core Schema

## Overview
Creates the foundational database tables for the Elder Mi Music AI Studio platform: projects, audio files, processing jobs, voice profiles, and export records. All tables are user-scoped with RLS policies so each producer can only access their own data.

## New Tables

1. `projects` — Main project entity. Each project belongs to one user and is associated with one of the three studios (vocal, mix, mastering).
   - id (uuid, PK)
   - name (text, not null)
   - studio (text, not null, check: vocal|mix|mastering)
   - status (text, default draft, check: draft|processing|completed|failed)
   - description (text, nullable)
   - genre (text, nullable)
   - user_id (uuid, FK to auth.users, default auth.uid())
   - created_at, updated_at (timestamptz)

2. `audio_files` — Uploaded audio files belonging to a project.
   - id (uuid, PK)
   - project_id (uuid, FK to projects, cascade delete)
   - filename, file_path, file_type (text)
   - file_size (bigint)
   - duration (float, nullable)
   - category (text: instrumental|lead_vocal|stem|mix|master|reference)
   - created_at (timestamptz)

3. `processing_jobs` — Background processing jobs for a project.
   - id (uuid, PK)
   - project_id (uuid, FK to projects, cascade delete)
   - job_type (text)
   - status (text: queued|processing|completed|failed)
   - parameters (jsonb)
   - result (jsonb, nullable)
   - error_message (text, nullable)
   - created_at, completed_at (timestamptz)

4. `voice_profiles` — User-defined voice profiles for vocal transformation.
   - id (uuid, PK)
   - name (text)
   - description (text, nullable)
   - consent_confirmed (boolean, default false)
   - user_id (uuid, FK to auth.users, default auth.uid())
   - created_at (timestamptz)

5. `exports` — Export records for finished audio.
   - id (uuid, PK)
   - project_id (uuid, FK to projects, cascade delete)
   - filename, file_path, format (text)
   - file_size (bigint)
   - created_at (timestamptz)

## Security
- RLS enabled on all tables.
- Grants: SELECT, INSERT, UPDATE, DELETE on all tables TO authenticated only.
- Policies: Owner-scoped using auth.uid() = user_id, either directly or through project ownership.
- Child tables (audio_files, processing_jobs, exports) check ownership through the parent projects table.
*/

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  studio text NOT NULL CHECK (studio IN ('vocal', 'mix', 'mastering')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'failed')),
  description text,
  genre text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;

DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS audio_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  duration float,
  category text NOT NULL DEFAULT 'stem' CHECK (category IN ('instrumental', 'lead_vocal', 'stem', 'mix', 'master', 'reference')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON audio_files TO authenticated;

DROP POLICY IF EXISTS "select_own_audio_files" ON audio_files;
CREATE POLICY "select_own_audio_files" ON audio_files FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_files.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_audio_files" ON audio_files;
CREATE POLICY "insert_own_audio_files" ON audio_files FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_files.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_audio_files" ON audio_files;
CREATE POLICY "update_own_audio_files" ON audio_files FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_files.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_files.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_audio_files" ON audio_files;
CREATE POLICY "delete_own_audio_files" ON audio_files FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = audio_files.project_id AND projects.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON processing_jobs TO authenticated;

DROP POLICY IF EXISTS "select_own_jobs" ON processing_jobs;
CREATE POLICY "select_own_jobs" ON processing_jobs FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = processing_jobs.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_jobs" ON processing_jobs;
CREATE POLICY "insert_own_jobs" ON processing_jobs FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = processing_jobs.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_jobs" ON processing_jobs;
CREATE POLICY "update_own_jobs" ON processing_jobs FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = processing_jobs.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = processing_jobs.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_jobs" ON processing_jobs;
CREATE POLICY "delete_own_jobs" ON processing_jobs FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = processing_jobs.project_id AND projects.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS voice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  consent_confirmed boolean NOT NULL DEFAULT false,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON voice_profiles TO authenticated;

DROP POLICY IF EXISTS "select_own_voice_profiles" ON voice_profiles;
CREATE POLICY "select_own_voice_profiles" ON voice_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_voice_profiles" ON voice_profiles;
CREATE POLICY "insert_own_voice_profiles" ON voice_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_voice_profiles" ON voice_profiles;
CREATE POLICY "update_own_voice_profiles" ON voice_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_voice_profiles" ON voice_profiles;
CREATE POLICY "delete_own_voice_profiles" ON voice_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_path text NOT NULL,
  format text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON exports TO authenticated;

DROP POLICY IF EXISTS "select_own_exports" ON exports;
CREATE POLICY "select_own_exports" ON exports FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_exports" ON exports;
CREATE POLICY "insert_own_exports" ON exports FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_exports" ON exports;
CREATE POLICY "update_own_exports" ON exports FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_exports" ON exports;
CREATE POLICY "delete_own_exports" ON exports FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = exports.project_id AND projects.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_project_id ON audio_files(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_id ON processing_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_exports_project_id ON exports(project_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);
