import "../global.css";
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

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <PowerSyncWrapper>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <View className="flex-1 bg-slate-50 text-slate-900">
                    <Stack>
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="logistics/new-request" options={{ headerShown: false }} />
                    </Stack>
                </View>
                <StatusBar style="dark" />
            </ThemeProvider>
        </PowerSyncWrapper>
    );
}
