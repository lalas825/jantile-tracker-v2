import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './AppSchema';

export const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: 'jantile_tracker.db',
});
