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
    getAll: async () => [],
    writeTransaction: async () => { },
    execute: async () => { },
    init: async () => { },
    currentStatus: { connected: false, uploading: false, downloading: false, lastSyncedAt: null },
} as any;



export const PowerSyncWrapper = ({ children }: { children: ReactNode }) => {
    // Immediate check for Expo Go to avoid any Provider rendering issues
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        // Even in Expo Go, provide a mock context to prevent crashes in children hook calls
        return (
            <PowerSyncContext.Provider value={mockDb}>
                {children}
            </PowerSyncContext.Provider>
        );
    }

    const { session } = useAuth();
    // const status = useStatus(); // Causes crash loop if used before provider is ready

    // useEffect(() => {
    //    console.log("PowerSync Status:", JSON.stringify(status));
    // }, [status]);

    const [isReady, setIsReady] = useState(false);
    const [dbInstance, setDbInstance] = useState<any>(mockDb); // Start with safe mock

    useEffect(() => {
        let isLoopActive = true;

        const initDb = async () => {
            try {
                await db.init();

                if (!isLoopActive) return;

                // CONNECT TO BACKEND
                const connector = new SupabaseConnector();

                await db.connect(connector);

                setDbInstance(db);
                setIsReady(true);
            } catch (e: any) {
                console.error('CRITICAL PowerSync init error:', e);
                // Fallback to mock DB to allow UI to render, BUT pass the error so it's visible
                const failedDb = {
                    ...mockDb,
                    currentStatus: {
                        ...mockDb.currentStatus,
                        lastDisconnectError: e.message || e // Pass the error object/string here
                    }
                };
                setDbInstance(failedDb);
                setIsReady(true);
            }
        };

        if (session) {
            initDb();
        } else {
            // alert("Waiting for session to log in...");
            setIsReady(true); // Let it render so they can log in
        }

        return () => { isLoopActive = false; };
    }, [session]); // RE-RUN when session changes!

    if (!isReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator size="large" color="#34d399" />
                <Text style={{ color: '#94a3b8', marginTop: 16 }}>Loading...</Text>
            </View>
        );
    }

    // Always provide context, even if it's the mock DB
    return (
        <PowerSyncContext.Provider value={dbInstance}>
            {children}
        </PowerSyncContext.Provider>
    );
};
