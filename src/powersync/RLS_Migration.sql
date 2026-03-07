-- =============================================================================
-- JANTILE RLS SECURITY MIGRATION (Idempotent)
-- Run this in Supabase SQL Editor.
-- Creates job_assignments table, helper functions, and RLS policies.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS throughout.
--
-- NOTE: Explicit ::uuid casts are used on all FK columns because some tables
-- store foreign keys as TEXT while primary keys are UUID.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLE: job_assignments (NEW)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','pm','foreman','viewer')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, job_id)
);

-- Indexes for fast lookup in RLS policies
CREATE INDEX IF NOT EXISTS idx_ja_user ON job_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_ja_job  ON job_assignments(job_id);

-- Add to PowerSync publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'powersync' AND tablename = 'job_assignments'
    ) THEN
        ALTER PUBLICATION powersync ADD TABLE job_assignments;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Publication update skipped: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2a. HELPER FUNCTION: is_admin()
--     SECURITY DEFINER bypasses RLS to avoid infinite recursion when
--     checking profiles from within profiles policies.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id::uuid = auth.uid() AND role = 'admin'
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. HELPER FUNCTION: user_has_job_access(job_id)
--     Returns TRUE if caller is admin OR has a job_assignments record.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_has_job_access(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    -- Only 'admin' has global access. All other roles (pm, foreman,
    -- supervisor, warehouse) must have a job_assignments record.
    SELECT public.is_admin()
    OR EXISTS (
        SELECT 1 FROM job_assignments
        WHERE user_id = auth.uid() AND job_id = p_job_id
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HELPER FUNCTION: job_id_for_area(area_id)
--    Resolves the hierarchy: areas → units → floors → jobs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_id_for_area(p_area_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT f.job_id::uuid
    FROM areas a
    JOIN units u ON a.unit_id::uuid = u.id
    JOIN floors f ON u.floor_id::uuid = f.id
    WHERE a.id = p_area_id
    LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS: profiles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON profiles;

-- Each user reads their own profile
CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT
    USING (id::uuid = auth.uid());

-- Admin can read all profiles (uses SECURITY DEFINER function to avoid recursion)
CREATE POLICY "profiles_select_admin"
    ON profiles FOR SELECT
    USING (public.is_admin());

-- Each user edits their own profile only
CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    USING  (id::uuid = auth.uid())
    WITH CHECK (id::uuid = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS: job_assignments
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ja_select_own"   ON job_assignments;
DROP POLICY IF EXISTS "ja_select_admin" ON job_assignments;
DROP POLICY IF EXISTS "ja_insert_admin" ON job_assignments;
DROP POLICY IF EXISTS "ja_delete_admin" ON job_assignments;

-- Users see their own assignments
CREATE POLICY "ja_select_own"
    ON job_assignments FOR SELECT
    USING (user_id = auth.uid());

-- Admin sees all assignments
CREATE POLICY "ja_select_admin"
    ON job_assignments FOR SELECT
    USING (
        public.is_admin()
    );

-- Only admin can create assignments
CREATE POLICY "ja_insert_admin"
    ON job_assignments FOR INSERT
    WITH CHECK (
        public.is_admin()
    );

-- Only admin can delete assignments
CREATE POLICY "ja_delete_admin"
    ON job_assignments FOR DELETE
    USING (
        public.is_admin()
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS: jobs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON jobs;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON jobs;

-- New restrictive policies
DROP POLICY IF EXISTS "jobs_select" ON jobs;
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_update" ON jobs;
DROP POLICY IF EXISTS "jobs_delete" ON jobs;

CREATE POLICY "jobs_select"
    ON jobs FOR SELECT
    USING (public.user_has_job_access(id));

CREATE POLICY "jobs_insert"
    ON jobs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id::uuid = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "jobs_update"
    ON jobs FOR UPDATE
    USING  (public.user_has_job_access(id))
    WITH CHECK (public.user_has_job_access(id));

CREATE POLICY "jobs_delete"
    ON jobs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id::uuid = auth.uid() AND role = 'admin'
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS: floors (direct job_id FK)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON floors;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON floors;
DROP POLICY IF EXISTS "floors_access" ON floors;

CREATE POLICY "floors_access"
    ON floors FOR ALL
    USING  (public.user_has_job_access(job_id::uuid))
    WITH CHECK (public.user_has_job_access(job_id::uuid));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS: units (via floors.job_id)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON units;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON units;
DROP POLICY IF EXISTS "units_access" ON units;

CREATE POLICY "units_access"
    ON units FOR ALL
    USING (
        public.user_has_job_access(
            (SELECT f.job_id::uuid FROM floors f WHERE f.id = floor_id::uuid)
        )
    )
    WITH CHECK (
        public.user_has_job_access(
            (SELECT f.job_id::uuid FROM floors f WHERE f.id = floor_id::uuid)
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS: areas (via job_id_for_area helper)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON areas;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON areas;
DROP POLICY IF EXISTS "areas_access" ON areas;

CREATE POLICY "areas_access"
    ON areas FOR ALL
    USING  (public.user_has_job_access(public.job_id_for_area(id)))
    WITH CHECK (public.user_has_job_access(public.job_id_for_area(id)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RLS: checklist_items (via area → job hierarchy)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON checklist_items;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON checklist_items;
DROP POLICY IF EXISTS "checklist_select" ON checklist_items;
DROP POLICY IF EXISTS "checklist_insert" ON checklist_items;
DROP POLICY IF EXISTS "checklist_update" ON checklist_items;
DROP POLICY IF EXISTS "checklist_delete" ON checklist_items;

CREATE POLICY "checklist_select"
    ON checklist_items FOR SELECT
    USING (public.user_has_job_access(public.job_id_for_area(area_id::uuid)));

CREATE POLICY "checklist_insert"
    ON checklist_items FOR INSERT
    WITH CHECK (public.user_has_job_access(public.job_id_for_area(area_id::uuid)));

CREATE POLICY "checklist_update"
    ON checklist_items FOR UPDATE
    USING  (public.user_has_job_access(public.job_id_for_area(area_id::uuid)))
    WITH CHECK (public.user_has_job_access(public.job_id_for_area(area_id::uuid)));

CREATE POLICY "checklist_delete"
    ON checklist_items FOR DELETE
    USING (public.user_has_job_access(public.job_id_for_area(area_id::uuid)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RLS: area_photos (via area → job hierarchy)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE area_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON area_photos;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON area_photos;
DROP POLICY IF EXISTS "area_photos_access" ON area_photos;

CREATE POLICY "area_photos_access"
    ON area_photos FOR ALL
    USING  (public.user_has_job_access(public.job_id_for_area(area_id::uuid)))
    WITH CHECK (public.user_has_job_access(public.job_id_for_area(area_id::uuid)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RLS: job_issues (direct job_id FK)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE job_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON job_issues;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON job_issues;
DROP POLICY IF EXISTS "job_issues_access" ON job_issues;

CREATE POLICY "job_issues_access"
    ON job_issues FOR ALL
    USING  (public.user_has_job_access(job_id::uuid))
    WITH CHECK (public.user_has_job_access(job_id::uuid));

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. RLS: issue_comments (via job_issues.job_id)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON issue_comments;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON issue_comments;
DROP POLICY IF EXISTS "issue_comments_access" ON issue_comments;

CREATE POLICY "issue_comments_access"
    ON issue_comments FOR ALL
    USING (
        public.user_has_job_access(
            (SELECT ji.job_id::uuid FROM job_issues ji WHERE ji.id = issue_id::uuid)
        )
    )
    WITH CHECK (
        public.user_has_job_access(
            (SELECT ji.job_id::uuid FROM job_issues ji WHERE ji.id = issue_id::uuid)
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RLS: system_notifications (own rows only)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON system_notifications;
DROP POLICY IF EXISTS "Allow write access for PMs/Admins"         ON system_notifications;
DROP POLICY IF EXISTS "notifications_own" ON system_notifications;

CREATE POLICY "notifications_own"
    ON system_notifications FOR ALL
    USING  (user_id::uuid = auth.uid())
    WITH CHECK (user_id::uuid = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE. Verify with:
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
-- ─────────────────────────────────────────────────────────────────────────────
