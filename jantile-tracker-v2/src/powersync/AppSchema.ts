import { Schema, Table, Column, ColumnType } from '@powersync/react-native';

export const AppSchema = new Schema([
    new Table({
        name: 'profiles',
        columns: [
            new Column({ name: 'role', type: ColumnType.TEXT }),
            new Column({ name: 'full_name', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'jobs',
        columns: [
            new Column({ name: 'name', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'address', type: ColumnType.TEXT }),
        ],
    }),
    new Table({
        name: 'tickets',
        columns: [
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'status', type: ColumnType.TEXT }),
            new Column({ name: 'type', type: ColumnType.TEXT }),
            new Column({ name: 'wizard_data', type: ColumnType.TEXT }), // JSON as TEXT
        ],
    }),
    new Table({
        name: 'inventory',
        columns: [
            new Column({ name: 'item_name', type: ColumnType.TEXT }),
            new Column({ name: 'quantity_on_hand', type: ColumnType.INTEGER }),
        ],
    }),
    new Table({
        name: 'daily_logs',
        columns: [
            new Column({ name: 'job_id', type: ColumnType.TEXT }),
            new Column({ name: 'date', type: ColumnType.TEXT }),
            new Column({ name: 'ppe_check', type: ColumnType.INTEGER }), // 0 or 1
        ],
    }),
]);
