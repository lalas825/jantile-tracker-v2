import { createClient } from '@supabase/supabase-js';

// Web-specific Supabase client using localStorage instead of SecureStore
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // localStorage is the default on web, no custom adapter needed
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Enable for web OAuth redirects
    },
});
