-- SAFE LOGISTICS MIGRATION (Idempotent)
-- Run this in Supabase SQL Editor to safely upgrade your schema.

-- 1. Create Tables if missing
CREATE TABLE IF NOT EXISTS project_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    ticket_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add missing columns to project_materials
DO $$ 
BEGIN 
    -- Column additions with existence checks
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='area_id') THEN
        ALTER TABLE project_materials ADD COLUMN area_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='sub_location') THEN
        ALTER TABLE project_materials ADD COLUMN sub_location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='category') THEN
        ALTER TABLE project_materials ADD COLUMN category TEXT NOT NULL DEFAULT 'Generic';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='product_code') THEN
        ALTER TABLE project_materials ADD COLUMN product_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='product_name') THEN
        ALTER TABLE project_materials ADD COLUMN product_name TEXT NOT NULL DEFAULT 'Unnamed Material';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='product_specs') THEN
        ALTER TABLE project_materials ADD COLUMN product_specs TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='zone') THEN
        ALTER TABLE project_materials ADD COLUMN zone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='net_qty') THEN
        ALTER TABLE project_materials ADD COLUMN net_qty NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='waste_percent') THEN
        ALTER TABLE project_materials ADD COLUMN waste_percent NUMERIC DEFAULT 10;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='budget_qty') THEN
        ALTER TABLE project_materials ADD COLUMN budget_qty NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='unit_cost') THEN
        ALTER TABLE project_materials ADD COLUMN unit_cost NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='total_value') THEN
        ALTER TABLE project_materials ADD COLUMN total_value NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='ordered_qty') THEN
        ALTER TABLE project_materials ADD COLUMN ordered_qty NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='shop_stock') THEN
        ALTER TABLE project_materials ADD COLUMN shop_stock NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='in_transit') THEN
        ALTER TABLE project_materials ADD COLUMN in_transit NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='received_at_job') THEN
        ALTER TABLE project_materials ADD COLUMN received_at_job NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='unit') THEN
        ALTER TABLE project_materials ADD COLUMN unit TEXT DEFAULT 'sqft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='pcs_per_unit') THEN
        ALTER TABLE project_materials ADD COLUMN pcs_per_unit NUMERIC DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='expected_date') THEN
        ALTER TABLE project_materials ADD COLUMN expected_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='grout_info') THEN
        ALTER TABLE project_materials ADD COLUMN grout_info TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='caulk_info') THEN
        ALTER TABLE project_materials ADD COLUMN caulk_info TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='dim_length') THEN
        ALTER TABLE project_materials ADD COLUMN dim_length NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='dim_width') THEN
        ALTER TABLE project_materials ADD COLUMN dim_width NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='dim_thickness') THEN
        ALTER TABLE project_materials ADD COLUMN dim_thickness TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='supplier') THEN
        ALTER TABLE project_materials ADD COLUMN supplier TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='updated_at') THEN
        ALTER TABLE project_materials ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 3. Add missing columns to delivery_tickets
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='status') THEN
        ALTER TABLE delivery_tickets ADD COLUMN status TEXT DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='items') THEN
        ALTER TABLE delivery_tickets ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='destination') THEN
        ALTER TABLE delivery_tickets ADD COLUMN destination TEXT NOT NULL DEFAULT 'Unassigned';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='requested_date') THEN
        ALTER TABLE delivery_tickets ADD COLUMN requested_date DATE DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='due_date') THEN
        ALTER TABLE delivery_tickets ADD COLUMN due_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='due_time') THEN
        ALTER TABLE delivery_tickets ADD COLUMN due_time TIME;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='notes') THEN
        ALTER TABLE delivery_tickets ADD COLUMN notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='created_by') THEN
        ALTER TABLE delivery_tickets ADD COLUMN created_by UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='updated_at') THEN
        ALTER TABLE delivery_tickets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='delivery_tickets' AND COLUMN_NAME='updated_at') THEN
        ALTER TABLE delivery_tickets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 4. Add missing columns to areas (Specific for Drawing Page feature)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='areas' AND COLUMN_NAME='drawing_page') THEN
        ALTER TABLE areas ADD COLUMN drawing_page TEXT;
    END IF;

    -- New for Base Calculator
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='project_materials' AND COLUMN_NAME='linear_feet') THEN
        ALTER TABLE project_materials ADD COLUMN linear_feet NUMERIC DEFAULT 0;
    END IF;

    -- New for Domain Isolation
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='areas' AND COLUMN_NAME='type') THEN
        ALTER TABLE areas ADD COLUMN type TEXT DEFAULT 'production';
    END IF;
END $$;

-- 4. Re-apply Policies (Safe)
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON project_materials;
CREATE POLICY "Allow read access for authenticated users" ON project_materials FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow write access for PMs/Admins" ON project_materials;
CREATE POLICY "Allow write access for PMs/Admins" ON project_materials FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON delivery_tickets;
CREATE POLICY "Allow read access for authenticated users" ON delivery_tickets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow write access for PMs/Admins" ON delivery_tickets;
CREATE POLICY "Allow write access for PMs/Admins" ON delivery_tickets FOR ALL TO authenticated USING (true);

-- 6. Add missing columns to units
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='units' AND COLUMN_NAME='type') THEN
        ALTER TABLE units ADD COLUMN type TEXT;
    END IF;
END $$;

-- 7. Update Publications
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'powersync' AND tablename = 'project_materials') THEN
        ALTER PUBLICATION powersync ADD TABLE project_materials;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'powersync' AND tablename = 'delivery_tickets') THEN
        ALTER PUBLICATION powersync ADD TABLE delivery_tickets;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Publication might not exist yet, or other issues
    RAISE NOTICE 'Publication update skipped: %', SQLERRM;
END $$;
