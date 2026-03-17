-- ============================================================
-- STEP 1: Ticket Work + Digital Signature System
-- Tables: work_tickets, document_signatures
-- Storage: signatures bucket
-- ============================================================

-- ── 1. work_tickets table ──────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_tickets') THEN
    CREATE TABLE work_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      ticket_number SERIAL,
      service_date DATE NOT NULL DEFAULT CURRENT_DATE,
      work_description TEXT NOT NULL,
      trade TEXT NOT NULL DEFAULT 'Tile',
      labor JSONB NOT NULL DEFAULT '[]',
      materials JSONB NOT NULL DEFAULT '[]',
      gc_notes TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      signature_token UUID,
      created_by UUID REFERENCES profiles(id),
      foreman_name TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    RAISE NOTICE 'Created work_tickets table.';
  ELSE
    -- Add missing columns if table already exists
    BEGIN ALTER TABLE work_tickets ADD COLUMN signature_token UUID; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE work_tickets ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE work_tickets ADD COLUMN foreman_name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE work_tickets ADD COLUMN gc_notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE work_tickets ADD COLUMN created_by UUID REFERENCES profiles(id); EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE work_tickets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now(); EXCEPTION WHEN duplicate_column THEN NULL; END;

    RAISE NOTICE 'work_tickets already exists — ensured missing columns.';
  END IF;
END $$;

-- Add CHECK constraint for status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'work_tickets_status_check'
  ) THEN
    ALTER TABLE work_tickets ADD CONSTRAINT work_tickets_status_check
      CHECK (status IN ('draft', 'pending_signature', 'signed', 'declined'));
  END IF;
END $$;

-- ── 2. document_signatures table (shared) ──────────────────

CREATE TABLE IF NOT EXISTS document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id),
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_role TEXT DEFAULT 'gc',
  signature_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  ip_address TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'document_signatures_status_check'
  ) THEN
    ALTER TABLE document_signatures ADD CONSTRAINT document_signatures_status_check
      CHECK (status IN ('pending', 'signed', 'declined'));
  END IF;
END $$;

-- ── 3. Indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_work_tickets_signature_token
  ON work_tickets(signature_token)
  WHERE signature_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_tickets_job_id
  ON work_tickets(job_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_signatures_token
  ON document_signatures(token);

CREATE INDEX IF NOT EXISTS idx_document_signatures_document
  ON document_signatures(document_type, document_id);

-- ── 4. Supabase Storage bucket: signatures ─────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can read (public signatures)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'signatures_public_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY signatures_public_read ON storage.objects
      FOR SELECT USING (bucket_id = 'signatures');
  END IF;
END $$;

-- Storage policies: authenticated users can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'signatures_auth_upload' AND tablename = 'objects'
  ) THEN
    CREATE POLICY signatures_auth_upload ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'signatures');
  END IF;
END $$;

-- ── 5. RLS Policies ────────────────────────────────────────

ALTER TABLE work_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- work_tickets: SELECT for users with job access or admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'work_tickets_select' AND tablename = 'work_tickets'
  ) THEN
    CREATE POLICY work_tickets_select ON work_tickets
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM job_assignments ja
          WHERE ja.job_id = work_tickets.job_id
            AND ja.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      );
  END IF;
END $$;

-- work_tickets: INSERT for admin, supervisor, pm, foreman
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'work_tickets_insert' AND tablename = 'work_tickets'
  ) THEN
    CREATE POLICY work_tickets_insert ON work_tickets
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'supervisor', 'pm', 'foreman')
        )
      );
  END IF;
END $$;

-- work_tickets: UPDATE for admin, supervisor, pm, foreman
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'work_tickets_update' AND tablename = 'work_tickets'
  ) THEN
    CREATE POLICY work_tickets_update ON work_tickets
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'supervisor', 'pm', 'foreman')
        )
      );
  END IF;
END $$;

-- work_tickets: DELETE for admin, supervisor, pm, foreman
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'work_tickets_delete' AND tablename = 'work_tickets'
  ) THEN
    CREATE POLICY work_tickets_delete ON work_tickets
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'supervisor', 'pm', 'foreman')
        )
      );
  END IF;
END $$;

-- document_signatures: SELECT for all authenticated (token-based access at app level)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'document_signatures_select' AND tablename = 'document_signatures'
  ) THEN
    CREATE POLICY document_signatures_select ON document_signatures
      FOR SELECT USING (true);
  END IF;
END $$;

-- document_signatures: INSERT for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'document_signatures_insert' AND tablename = 'document_signatures'
  ) THEN
    CREATE POLICY document_signatures_insert ON document_signatures
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- document_signatures: UPDATE for all (token-based access at app level)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'document_signatures_update' AND tablename = 'document_signatures'
  ) THEN
    CREATE POLICY document_signatures_update ON document_signatures
      FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'Migration complete: work_tickets + document_signatures + signatures bucket + RLS policies.'; END $$;
