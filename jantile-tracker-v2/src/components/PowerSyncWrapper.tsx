import { ReactNode, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { PowerSyncContext } from '@powersync/react-native';
import { db } from '../powersync/db';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Native version - provides PowerSync context with proper initialization
// Mock DB for Expo Go / Fallback
const mockDb = {
    getAll: async () => [],
    writeTransaction: async () => { },
    execute: async () => { },
    init: async () => { },
} as any;

export const PowerSyncWrapper = ({ children }: { children: ReactNode }) => {
    // Immediate check for Expo Go to avoid any Provider rendering issues
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        return <>{children}</>;
    }

    const [isReady, setIsReady] = useState(false);
    const [dbInstance, setDbInstance] = useState<any>(mockDb); // Start with safe mock

    useEffect(() => {
        const initDb = async () => {
            try {
                // Initialize/open the database
                await db.init();
                setDbInstance(db);
                setIsReady(true);
            } catch (e: any) {
                console.warn('PowerSync init error (expected in Expo Go):', e);
                // Fallback to mock DB to allow UI to render
                setDbInstance(mockDb);
                setIsReady(true);
            }
        };

        initDb();
    }, []);

    if (!isReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
                <ActivityIndicator size="large" color="#34d399" />
                <Text style={{ color: '#94a3b8', marginTop: 16 }}>Loading...</Text>
            </View>
        );
    }

    // Double safety: If we ended up with mockDb (e.g. init failed), skip Provider
    if (dbInstance === mockDb) {
        return <>{children}</>;
    }

    return (
        <PowerSyncContext.Provider value={dbInstance}>
            {children}
        </PowerSyncContext.Provider>
    );
};
