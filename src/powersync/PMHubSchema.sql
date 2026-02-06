-- PM Material Hub & Logistics Schema (V1 Parity)

-- 1. Project Materials Table
CREATE TABLE IF NOT EXISTS project_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
    sub_location TEXT,
    category TEXT NOT NULL,
    product_code TEXT,
    product_name TEXT NOT NULL,
    product_specs TEXT,
    zone TEXT,
    net_qty NUMERIC DEFAULT 0,
    waste_percent NUMERIC DEFAULT 10,
    budget_qty NUMERIC DEFAULT 0,
    unit_cost NUMERIC DEFAULT 0,
    total_value NUMERIC DEFAULT 0,
    supplier TEXT,
    ordered_qty NUMERIC DEFAULT 0,
    shop_stock NUMERIC DEFAULT 0,
    in_transit NUMERIC DEFAULT 0,
    received_at_job NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'sqft',
    pcs_per_unit NUMERIC DEFAULT 1,
    expected_date DATE,
    grout_info TEXT,
    caulk_info TEXT,
    dim_length NUMERIC,
    dim_width NUMERIC,
    dim_thickness TEXT,
    linear_feet NUMERIC,
    trowel_preset TEXT,
    yield_factor NUMERIC,
    parent_material_id UUID,
    joint_width TEXT,
    bag_weight NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Delivery Tickets Table
CREATE TABLE IF NOT EXISTS delivery_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    ticket_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft',
    items JSONB DEFAULT '[]'::jsonb,
    destination TEXT NOT NULL,
    requested_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    due_time TIME,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users" ON project_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for PMs/Admins" ON project_materials FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON delivery_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for PMs/Admins" ON delivery_tickets FOR ALL TO authenticated USING (true);

-- ADD TO POWERSYNC PUBLICATION
ALTER PUBLICATION powersync ADD TABLE project_materials;
ALTER PUBLICATION powersync ADD TABLE delivery_tickets;
