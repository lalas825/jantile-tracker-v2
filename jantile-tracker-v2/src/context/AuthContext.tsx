import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Role = 'admin' | 'pm' | 'foreman' | 'warehouse';

type Permission =
    | 'view_jobs'
    | 'edit_daily_logs'
    | 'view_my_tickets'
    | 'view_logistics'
    | 'edit_inventory'
    | '*';

interface UserProfile {
    id: string;
    role: Role;
    full_name: string;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    hasPermission: (permission: Permission) => boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    foreman: ['view_jobs', 'edit_daily_logs', 'view_my_tickets'],
    warehouse: ['view_logistics', 'edit_inventory'],
    pm: ['*'],
    admin: ['*'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setIsLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                // If we have a user but no profile yet, fetch it
                if (!profile || profile.id !== session.user.id) {
                    fetchProfile(session.user.id);
                }
            } else {
                setProfile(null);
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string) => {
        try {
            // TODO: Switch to querying local PowerSync DB once initialized for offline support.
            // For initialization, we fetch from Supabase directly.
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
            }

            if (data) {
                setProfile(data as UserProfile);
            }
        } catch (e) {
            console.error('Error fetching profile exception', e);
        } finally {
            setIsLoading(false);
        }
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!profile) return false;
        // Default to empty array if role is undefined or invalid
        const permissions = ROLE_PERMISSIONS[profile.role] || [];
        if (permissions.includes('*')) return true;
        return permissions.includes(permission);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, isLoading, hasPermission, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
