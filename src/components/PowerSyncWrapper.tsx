import { ReactNode, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { PowerSyncContext } from '@powersync/react';
import { db } from '../powersync/db';
import { SupabaseConnector } from '../powersync/SupabaseConnector';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuth } from '../context/AuthContext';

// Native version - provides PowerSync context with proper initialization
// Mock DB for Expo Go / Fallback
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
    const { session } = useAuth();

    // Immediate check for Expo Go to avoid any Provider rendering issues
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        // Even in Expo Go, provide a mock context to prevent crashes in children hook calls
        return (
            <PowerSyncContext.Provider value={mockDb}>
                {children}
            </PowerSyncContext.Provider>
        );
    }

    const [isReady, setIsReady] = useState(false);
    const [dbInstance, setDbInstance] = useState<any>(mockDb); // Start with safe mock

    useEffect(() => {
        let isLoopActive = true;
        let statusInterval: ReturnType<typeof setInterval> | null = null;
        let statusTimeout: ReturnType<typeof setTimeout> | null = null;

        console.log("PowerSyncWrapper: Starting init check. Session:", !!session);

        const initDb = async () => {
            try {
                console.log("PowerSyncWrapper: Initializing DB...");
                await db.init();
                console.log("PowerSyncWrapper: DB Init Success.");

                if (!isLoopActive) return;

                // Render UI immediately with local data — don't wait for network
                setDbInstance(db);
                setIsReady(true);

                // Connect to backend in background (non-blocking)
                try {
                    await db.disconnect();
                } catch { /* ignore if not connected */ }

                const connector = new SupabaseConnector();
                db.connect(connector).then(() => {
                    console.log("PowerSyncWrapper: Connected to backend.");
                    console.log("PowerSyncWrapper: Sync status after connect:", JSON.stringify(db.currentStatus));

                    // Log sync status periodically
                    statusInterval = setInterval(() => {
                        if (db.currentStatus) {
                            console.log("PowerSyncWrapper: Sync status:", JSON.stringify(db.currentStatus));
                        }
                    }, 5000);
                    statusTimeout = setTimeout(() => {
                        if (statusInterval) clearInterval(statusInterval);
                        statusInterval = null;
                    }, 30000);
                }).catch((connectErr: any) => {
                    console.warn("PowerSyncWrapper: Backend connect failed (offline?):", connectErr?.message || connectErr);
                });
            } catch (e: any) {
                console.error('CRITICAL PowerSync init error:', e?.message || e);
                const failedDb = {
                    ...mockDb,
                    currentStatus: {
                        ...mockDb.currentStatus,
                        lastDisconnectError: e.message || e
                    }
                };
                setDbInstance(failedDb);
                setIsReady(true);
            }
        };

        if (session) {
            initDb();
        } else {
            console.log("PowerSyncWrapper: No session, allowing render for login.");
            setIsReady(true); // Let it render so they can log in
        }

        return () => {
            isLoopActive = false;
            if (statusInterval) clearInterval(statusInterval);
            if (statusTimeout) clearTimeout(statusTimeout);
        };
    }, [session]); // RE-RUN when session changes!


    return (
        <PowerSyncContext.Provider value={dbInstance}>
            <View style={{ flex: 1 }}>
                {children}
                {!isReady && session && (
                    <View style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.7)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999
                    }}>
                        <ActivityIndicator size="large" color="#34d399" />
                        <Text style={{ color: '#94a3b8', marginTop: 16 }}>Syncing Database...</Text>
                    </View>
                )}
            </View>
        </PowerSyncContext.Provider>
    );
};
