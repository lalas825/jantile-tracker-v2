import { Schema, Table, Column, ColumnType } from '@powersync/react-native';

export const AppSchema = new Schema([
    new Table({
        name: 'workers',
        columns: [
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'role', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'phone', type: ColumnType.TEXT }),
            new Column({ name: 'email', type: ColumnType.TEXT }),
            new Column({ name: 'assigned_job_ids', type: ColumnType.TEXT }),
            new Column({ name: 'avatar', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'jobs',
        columns: [
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'job_number', type: ColumnType.TEXT }),
            new Column({ name: 'address', type: ColumnType.TEXT }),
            new Column({ name: 'general_contractor', type: ColumnType.TEXT }),
            new Column({ name: 'total_units', type: ColumnType.INTEGER }),
            new Column({ name: 'completion_percentage', type: ColumnType.TEXT }),
            new Column({ name: 'budget_total', type: ColumnType.TEXT }),
            new Column({ name: 'foreman_email', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'tickets',
        columns: [
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'created_by', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'wizard_data', type: ColumnType.TEXT }),
            new Column({ name: 'ticket_number', type: ColumnType.TEXT }),
            new Column({ name: 'pdf_url', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'production_logs',
        columns: [
            new Column({ name: 'date', type: ColumnType.TEXT }),
            new Column({ name: 'worker_id', type: ColumnType.TEXT }),
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'reg_hours', type: ColumnType.TEXT }),
            new Column({ name: 'ot_hours', type: ColumnType.TEXT }),
            new Column({ name: 'job_name', type: ColumnType.TEXT }),
            new Column({ name: 'pl_number', type: ColumnType.TEXT }),
            new Column({ name: 'unit', type: ColumnType.TEXT }),
            new Column({ name: 'ticket_number', type: ColumnType.TEXT }),
            new Column({ name: 'is_jantile', type: ColumnType.INTEGER }),
            new Column({ name: 'is_ticket', type: ColumnType.INTEGER }),
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'status_color', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'floors',
        columns: [
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'description', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'units',
        columns: [
            new Column({ name: 'floor_id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'description', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'areas',
        columns: [
            new Column({ name: 'unit_id', type: ColumnType.TEXT }),
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'description', type: ColumnType.TEXT }),
            new Column({ name: 'drawing_page', type: ColumnType.TEXT }), // New Drawing Page
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'progress', type: ColumnType.INTEGER }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'checklist_items',
        columns: [
            new Column({ name: 'area_id', type: ColumnType.TEXT }),
            new Column({ name: 'text', type: ColumnType.TEXT }),
            new Column({ name: 'completed', type: ColumnType.INTEGER }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'position', type: ColumnType.INTEGER }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'profiles',
        columns: [
            new Column({ name: 'full_name', type: ColumnType.TEXT }),
            new Column({ name: 'email', type: ColumnType.TEXT }),
            new Column({ name: 'role', type: ColumnType.TEXT }),
            new Column({ name: 'avatar_url', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'area_photos',
        columns: [
            new Column({ name: 'area_id', type: ColumnType.TEXT }),
            new Column({ name: 'url', type: ColumnType.TEXT }),
            new Column({ name: 'storage_path', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'job_issues',
        columns: [
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'area_id', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'priority', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'description', type: ColumnType.TEXT }),
            new Column({ name: 'photo_url', type: ColumnType.TEXT }),
            new Column({ name: 'created_by', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'issue_comments',
        columns: [
            new Column({ name: 'issue_id', type: ColumnType.TEXT }),
            new Column({ name: 'user_id', type: ColumnType.TEXT }),
            new Column({ name: 'user_name', type: ColumnType.TEXT }),
            new Column({ name: 'message', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'offline_photos',
        columns: [
            new Column({ name: 'area_id', type: ColumnType.TEXT }),
            new Column({ name: 'local_uri', type: ColumnType.TEXT }),
            new Column({ name: 'filename', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }), // 'queued', 'uploading', 'failed'
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ],
        localOnly: true
    }),
    new Table({
        name: 'project_materials',
        columns: [
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'area_id', type: ColumnType.TEXT }),
            new Column({ name: 'sub_location', type: ColumnType.TEXT }),
            new Column({ name: 'category', type: ColumnType.TEXT }),
            new Column({ name: 'supplier', type: ColumnType.TEXT }),
            new Column({ name: 'product_code', type: ColumnType.TEXT }),
            new Column({ name: 'product_name', type: ColumnType.TEXT }),
            new Column({ name: 'product_specs', type: ColumnType.TEXT }),
            new Column({ name: 'zone', type: ColumnType.TEXT }),
            new Column({ name: 'net_qty', type: ColumnType.REAL }),
            new Column({ name: 'waste_percent', type: ColumnType.REAL }),
            new Column({ name: 'budget_qty', type: ColumnType.REAL }),
            new Column({ name: 'unit_cost', type: ColumnType.TEXT }),
            new Column({ name: 'total_value', type: ColumnType.TEXT }),
            new Column({ name: 'ordered_qty', type: ColumnType.REAL }),
            new Column({ name: 'shop_stock', type: ColumnType.REAL }),
            new Column({ name: 'in_transit', type: ColumnType.REAL }),
            new Column({ name: 'received_at_job', type: ColumnType.REAL }),
            new Column({ name: 'unit', type: ColumnType.TEXT }),
            new Column({ name: 'pcs_per_unit', type: ColumnType.INTEGER }),
            new Column({ name: 'expected_date', type: ColumnType.TEXT }),
            new Column({ name: 'grout_info', type: ColumnType.TEXT }),
            new Column({ name: 'caulk_info', type: ColumnType.TEXT }),
            new Column({ name: 'dim_length', type: ColumnType.REAL }),
            new Column({ name: 'dim_width', type: ColumnType.REAL }),
            new Column({ name: 'dim_thickness', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'delivery_tickets',
        columns: [
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'ticket_number', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'items', type: ColumnType.TEXT }), // JSON string
            new Column({ name: 'destination', type: ColumnType.TEXT }),
            new Column({ name: 'requested_date', type: ColumnType.TEXT }),
            new Column({ name: 'due_date', type: ColumnType.TEXT }),
            new Column({ name: 'due_time', type: ColumnType.TEXT }),
            new Column({ name: 'scheduled_time', type: ColumnType.TEXT }), // New for Calendar v2.1
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'created_by', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'purchase_orders',
        columns: [
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'po_number', type: ColumnType.TEXT }),
            new Column({ name: 'vendor', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'order_date', type: ColumnType.TEXT }),
            new Column({ name: 'expected_date', type: ColumnType.TEXT }),
            new Column({ name: 'scheduled_time', type: ColumnType.TEXT }), // New for Calendar v2.1
            new Column({ name: 'total_amount', type: ColumnType.REAL }), // or TEXT if keeping string based
            new Column({ name: 'notes', type: ColumnType.TEXT }),
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
            new Column({ name: 'updated_at', type: ColumnType.TEXT }),
        ]
    }),
    new Table({
        name: 'po_items',
        columns: [
            new Column({ name: 'po_id', type: ColumnType.TEXT }),
            new Column({ name: 'material_id', type: ColumnType.TEXT }),
            new Column({ name: 'quantity_ordered', type: ColumnType.REAL }),
            new Column({ name: 'item_cost', type: ColumnType.REAL }), // or TEXT
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ]
    }),
]);
