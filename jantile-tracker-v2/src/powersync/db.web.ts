// Web Fallback (Smart Mock)
// This ensures the app runs in the browser without crashing.

export const db = {
    init: async () => { },
    getAll: async () => [],
    get: async () => null,
    execute: async () => {
        console.warn('PowerSync DB execute called on web - this is a mock.');
        return { rows: { _array: [], length: 0, item: () => null } };
    },

    // Transaction Mocks (These run the callback immediately so the UI loads)
    writeTransaction: async (callback: any) => {
        return callback({
            execute: async () => ({ rows: { _array: [] } }),
            getAll: async () => [],
            get: async () => null
        });
    },
    readTransaction: async (callback: any) => {
        return callback({
            execute: async () => ({ rows: { _array: [] } }),
            getAll: async () => [],
            get: async () => null
        });
    },
    readLock: async (callback: any) => {
        return callback({
            execute: async () => ({ rows: { _array: [] } }),
            getAll: async () => [],
            get: async () => null
        });
    },

    // Legacy Support (Prevents crashes from old hooks)
    customQuery: async () => []
};