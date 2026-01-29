import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://qxeyoyeqvmkufsfrdxug.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZXlveWVxdm1rdWZzZnJkeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTQ0MTYsImV4cCI6MjA4NDY5MDQxNn0.YXG3UW3A7KWKeFazXova5kRq9_jPBM2SAQz81GYODwI';

// Safe Storage Adapter that works in Browser, Mobile, and Build environments
const ExpoStorageAdapter = {
    getItem: (key: string) => {
        if (Platform.OS === 'web') {
            // Check if running in a real browser window
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
            return localStorage.getItem(key);
        }
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string) => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
            localStorage.setItem(key, value);
            return;
        }
        SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string) => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
            localStorage.removeItem(key);
            return;
        }
        SecureStore.deleteItemAsync(key);
    },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: ExpoStorageAdapter as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
