import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './AppSchema';

export let db: any;

try {
    db = new PowerSyncDatabase({
        schema: AppSchema,
        dbFilename: 'jantile_tracker.db',
    });
} catch (e) {
    console.warn("PowerSyncDatabase failed to initialize (expected in Expo Go):", e);
    // Export a minimal mock so imports don't explode (Wrapper handles nulls)
    db = {
        init: async () => { },
        getAll: async () => [],
        execute: async () => { },
        writeTransaction: async () => { }
    };
}
