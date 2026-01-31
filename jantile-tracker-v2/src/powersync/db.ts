import { PowerSyncDatabase } from '@powersync/react-native';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
// @ts-ignore
import { AppSchema } from './AppSchema';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// V2 Initialization
// PowerSync v2 manages the DB connection internally more robustly.
// Only construct the real DB if we're on a native platform AND not in Expo Go.
const realDb = (Platform.OS === 'web' || isExpoGo)
    ? null
    : new PowerSyncDatabase({
        schema: AppSchema,
        database: {
            dbFilename: 'jantile_tracker.db',
        },
    });

export const db = realDb || ({
    isMock: true,
    init: async () => { },
    connect: async () => { },
    execute: async () => { },
    getAll: async () => [],
    get: async () => null,
    watch: () => ({ close: () => { } }),
    watchSingle: () => ({ close: () => { } }),
    customQuery: () => ({ close: () => { } }), // Common method for hooks
    onChange: () => ({ close: () => { } }),
    currentStatus: { connected: false, uploading: false, downloading: false, lastSyncedAt: null },
} as any);

// Helper for debugging - logs queries if needed, or just let it be.
// In v2, we usually don't need the try/catch around construction unless strict checking is on.
// The real connection happens when `connect` is called in the provider or hook.