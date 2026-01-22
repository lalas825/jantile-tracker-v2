import { Schema, Column, Table } from '@powersync/react-native';

export const AppSchema = new Schema({
    profiles: new Table({
        role: new Column({ type: Schema.Type.TEXT }),
        full_name: new Column({ type: Schema.Type.TEXT }),
    }),
    jobs: new Table({
        name: new Column({ type: Schema.Type.TEXT }),
        status: new Column({ type: Schema.Type.TEXT }),
        address: new Column({ type: Schema.Type.TEXT }),
    }),
    tickets: new Table({
        job_id: new Column({ type: Schema.Type.TEXT }),
        status: new Column({ type: Schema.Type.TEXT }),
        type: new Column({ type: Schema.Type.TEXT }),
        wizard_data: new Column({ type: Schema.Type.TEXT }), // Storing JSON as TEXT
    }),
    inventory: new Table({
        item_name: new Column({ type: Schema.Type.TEXT }),
        quantity_on_hand: new Column({ type: Schema.Type.INTEGER }),
    }),
    daily_logs: new Table({
        job_id: new Column({ type: Schema.Type.TEXT }),
        date: new Column({ type: Schema.Type.TEXT }),
        ppe_check: new Column({ type: Schema.Type.INTEGER }), // 0 or 1
    }),
});
