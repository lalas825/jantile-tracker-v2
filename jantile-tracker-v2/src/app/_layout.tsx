import "../global.css";
import "../polyfills";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { View } from 'react-native';

import { useColorScheme } from '../hooks/use-color-scheme';
import { PowerSyncWrapper } from '../components/PowerSyncWrapper';

export const unstable_settings = {
    anchor: '(tabs)',
};

import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';

function RootLayoutNav() {
    const { session, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === 'login';

        if (!session && !inAuthGroup) {
            // Redirect to the login page if not signed in
            router.replace('/login');
        } else if (session && inAuthGroup) {
            // Redirect away from the login page if already signed in
            router.replace('/(tabs)');
        }
    }, [session, isLoading, segments]);

    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="logistics/new-request" options={{ headerShown: false }} />
        </Stack>
    );
}

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
