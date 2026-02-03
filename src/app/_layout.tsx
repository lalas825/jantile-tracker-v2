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
import { ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
    useFonts,
    Outfit_400Regular,
    Outfit_700Bold,
    Outfit_900Black
} from '@expo-google-fonts/outfit';
import {
    Inter_400Regular,
    Inter_700Bold,
    Inter_900Black
} from '@expo-google-fonts/inter';

import { AuthProvider, useAuth } from '../context/AuthContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

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

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [loaded, error] = useFonts({
        Outfit_400Regular,
        Outfit_700Bold,
        Outfit_900Black,
        Inter_400Regular,
        Inter_700Bold,
        Inter_900Black,
    });

    useEffect(() => {
        if (loaded || error) {
            SplashScreen.hideAsync();
        }
    }, [loaded, error]);

    if (!loaded && !error) {
        return null;
    }

    return (
        <AuthProvider>
            <PowerSyncWrapper>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <View className="flex-1 bg-slate-50 text-slate-900 font-inter">
                        <RootLayoutNav />
                    </View>
                    <StatusBar style="dark" />
                </ThemeProvider>
            </PowerSyncWrapper>
        </AuthProvider>
    );
}
