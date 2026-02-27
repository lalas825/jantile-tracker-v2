import { ReactNode, createContext } from 'react';
import { View } from 'react-native';

// DIAGNOSTIC: Use local context to isolate if @powersync/react import is the crash
const DiagnosticContext = createContext<any>(null);

// Mock DB for safe fallback
const mockDb = {
    isMock: true,
    getAll: async () => [],
    get: async () => null,
    execute: async () => { },
    init: async () => { },
    readLock: async (cb: any) => cb({ execute: async () => ({ rows: { _array: [] } }), getAll: async () => [], get: async () => null }),
    writeLock: async (cb: any) => cb({ execute: async () => ({ rows: { _array: [] } }), getAll: async () => [], get: async () => null }),
    writeTransaction: async (cb: any) => cb({ execute: async () => ({ rows: { _array: [] } }), getAll: async () => [], get: async () => null }),
    currentStatus: { connected: false, uploading: false, downloading: false, lastSyncedAt: null },
} as any;

export const PowerSyncWrapper = ({ children }: { children: ReactNode }) => {
    console.log('[PowerSyncWrapper] DIAGNOSTIC: rendering passthrough');
    return (
        <DiagnosticContext.Provider value={mockDb}>
            <View style={{ flex: 1 }}>
                {children}
            </View>
        </DiagnosticContext.Provider>
    );
};
