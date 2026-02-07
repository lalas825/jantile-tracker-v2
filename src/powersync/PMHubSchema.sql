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
    in_warehouse_qty NUMERIC DEFAULT 0,
    in_transit NUMERIC DEFAULT 0,
    received_at_job NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'sqft',
    pcs_per_unit NUMERIC DEFAULT 1,
    pieces_per_crate NUMERIC DEFAULT 0,
    qty_damaged NUMERIC DEFAULT 0,
    qty_missing NUMERIC DEFAULT 0,
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
    scheduled_time TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    po_number TEXT NOT NULL,
    vendor TEXT,
    status TEXT DEFAULT 'Ordered',
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    scheduled_time TEXT,
    total_amount NUMERIC DEFAULT 0,
    notes TEXT,
    received_at TIMESTAMPTZ,
    received_by UUID,
    parent_po_id UUID REFERENCES purchase_orders(id), -- Link for re-orders
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PO Items Table
CREATE TABLE IF NOT EXISTS po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES project_materials(id) ON DELETE CASCADE,
    quantity_ordered NUMERIC NOT NULL,
    received_qty NUMERIC,
    item_cost NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Material Claims (Discrepancy Tracking)
CREATE TABLE IF NOT EXISTS material_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES project_materials(id) ON DELETE CASCADE,
    expected_qty NUMERIC NOT NULL,
    received_qty NUMERIC NOT NULL,
    difference NUMERIC NOT NULL,
    pieces_expected NUMERIC, -- New for Tile
    pieces_received NUMERIC, -- New for Tile
    pieces_difference NUMERIC, -- New for Tile
    condition_flag TEXT NOT NULL, -- 'V' | 'D' | 'M'
    notes TEXT,
    photo_url TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. System Notifications
CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- The recipient (e.g. PM)
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    type TEXT DEFAULT 'alert', -- 'alert' | 'update' | 'info'
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users" ON project_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for PMs/Admins" ON project_materials FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON delivery_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for PMs/Admins" ON delivery_tickets FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for PMs/Admins" ON purchase_orders FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON po_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for PMs/Admins" ON po_items FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read access for authenticated users" ON material_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access for PMs/Admins" ON material_claims FOR ALL TO authenticated USING (true);

-- ADD TO POWERSYNC PUBLICATION
ALTER PUBLICATION powersync ADD TABLE project_materials;
ALTER PUBLICATION powersync ADD TABLE delivery_tickets;
ALTER PUBLICATION powersync ADD TABLE purchase_orders;
ALTER PUBLICATION powersync ADD TABLE po_items;
ALTER PUBLICATION powersync ADD TABLE material_claims;
ALTER PUBLICATION powersync ADD TABLE system_notifications;
