import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { db } from '../powersync/db';

type Role = 'admin' | 'pm' | 'foreman' | 'supervisor' | 'worker' | 'warehouse' | 'shop';

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
    status: 'pending' | 'approved';
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
    admin: ['*'],
    supervisor: ['view_jobs', 'edit_daily_logs', 'view_my_tickets', 'view_logistics', 'edit_inventory'],
    pm: ['view_jobs', 'edit_daily_logs', 'view_my_tickets', 'view_logistics'],
    foreman: ['view_jobs', 'edit_daily_logs', 'view_my_tickets'],
    worker: ['view_jobs'],
    warehouse: ['view_logistics', 'edit_inventory'],
    shop: [],
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
            // 1. Try Local DB for quick initial render
            const localResult = await db.getAll(`SELECT * FROM profiles WHERE id = ?`, [userId]);

            if (localResult.length > 0) {
                const localProfile = localResult[0] as any;
                setProfile({
                    id: userId,
                    role: localProfile.role,
                    full_name: localProfile.full_name,
                    status: localProfile.status || 'approved',
                } as UserProfile);
                setIsLoading(false);
                // Don't return — always refresh from Supabase for authoritative status
            }

            // 2. Always fetch from Supabase (source of truth for status)
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                return; // Keep local profile if Supabase fails (offline)
            }

            if (data) {
                const userProfile = {
                    ...data,
                    status: data.status || 'approved',
                } as UserProfile;
                setProfile(userProfile);

                // 3. Cache to Local DB
                try {
                    await db.execute(
                        `INSERT OR REPLACE INTO profiles (id, role, full_name, email, status) VALUES (?, ?, ?, ?, ?)`,
                        [userProfile.id, userProfile.role, userProfile.full_name, data.email || null, userProfile.status]
                    );
                } catch (cacheErr) {
                    console.error('Error caching profile:', cacheErr);
                }
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
