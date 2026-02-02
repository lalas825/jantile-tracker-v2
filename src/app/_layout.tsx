import "../global.css";
import "../polyfills";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { View } from 'react-native';

import { useColorScheme } from '../hooks/use-color-scheme';
import { PowerSyncWrapper } from '../components/PowerSyncWrapper';

import { useEffect } from 'react';

import { AuthProvider, useAuth } from '../context/AuthContext';

export const unstable_settings = {
    initialRouteName: '(tabs)',
};

function AuthGuard() {
    const { session, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === 'login';

        if (!session && !inAuthGroup) {
            router.replace('/login');
        } else if (session && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [session, isLoading, segments]);

    return null;
}

function RootLayoutNav() {
    const { session, isLoading } = useAuth();

    // Background Photo Sync Trigger
    useEffect(() => {
        if (session) {
            console.log("🚀 Background Sync: Trigger active for session", session.user.id);
            const { OfflinePhotoService } = require('../services/OfflinePhotoService');
            // Initial check
            OfflinePhotoService.processQueue().catch(console.error);

            // Check every minute
            const interval = setInterval(() => {
                OfflinePhotoService.processQueue().catch(console.error);
            }, 60000);
            return () => clearInterval(interval);
        }
    }, [session]);

    return (
        <View style={{ flex: 1 }}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="logistics/new-request" options={{ headerShown: false }} />
            </Stack>

            <AuthGuard />

            {isLoading && (
                <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: '#f8fafc',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000
                }}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            )}
        </View>
    );
}

// Helper component to avoid using hooks in RootLayout default export
import { ActivityIndicator } from 'react-native';

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <AuthProvider>
            <PowerSyncWrapper>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <View className="flex-1 bg-slate-50 text-slate-900">
                        <RootLayoutNav />
                    </View>
                    <StatusBar style="dark" />
                </ThemeProvider>
            </PowerSyncWrapper>
        </AuthProvider>
    );
}
