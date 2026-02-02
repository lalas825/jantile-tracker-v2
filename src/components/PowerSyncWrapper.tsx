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
    // const status = useStatus(); // Causes crash loop if used before provider is ready

    // useEffect(() => {
    //    console.log("PowerSync Status:", JSON.stringify(status));
    // }, [status]);

    const [isReady, setIsReady] = useState(false);
    const [dbInstance, setDbInstance] = useState<any>(mockDb); // Start with safe mock

    useEffect(() => {
        let isLoopActive = true;

        console.log("PowerSyncWrapper: Starting init check. Session:", !!session);

        const initDb = async () => {
            try {
                console.log("PowerSyncWrapper: Initializing DB...");
                await db.init();
                console.log("PowerSyncWrapper: DB Init Success.");

                if (!isLoopActive) return;

                // CONNECT TO BACKEND
                const connector = new SupabaseConnector();
                await db.connect(connector);
                console.log("PowerSyncWrapper: Connected to backend.");

                setDbInstance(db);
                setIsReady(true);
            } catch (e: any) {
                console.error('CRITICAL PowerSync init error:', e);
                // Fallback to mock DB to allow UI to render
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

        return () => { isLoopActive = false; };
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
