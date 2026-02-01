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
        name: 'offline_photos',
        columns: [
            new Column({ name: 'area_id', type: ColumnType.TEXT }),
            new Column({ name: 'local_uri', type: ColumnType.TEXT }),
            new Column({ name: 'filename', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }), // 'queued', 'uploading', 'failed'
            new Column({ name: 'created_at', type: ColumnType.TEXT }),
        ]
    }),
]);
