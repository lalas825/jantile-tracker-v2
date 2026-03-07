import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';

interface RoleGuardProps {
    allowed: string[];
    children: React.ReactNode;
}

/**
 * Wraps content that should only be visible to users with specific roles.
 * Redirects non-authorized users to the dashboard.
 *
 * Usage:
 *   <RoleGuard allowed={['admin', 'pm']}>
 *       <SensitiveContent />
 *   </RoleGuard>
 */
export function RoleGuard({ allowed, children }: RoleGuardProps) {
    const { profile, isLoading } = useAuth();
    const router = useRouter();

    const hasAccess = !!profile && allowed.includes(profile.role);

    useEffect(() => {
        if (!isLoading && !hasAccess) {
            router.replace('/(tabs)');
        }
    }, [isLoading, hasAccess]);

    if (isLoading || !hasAccess) {
        return (
            <View className="flex-1 bg-slate-50 justify-center items-center">
                <ActivityIndicator size="large" color="#334155" />
            </View>
        );
    }

    return <>{children}</>;
}

/**
 * Inline visibility helper — renders children only if user has one of the allowed roles.
 * Does NOT redirect; simply hides content.
 *
 * Usage:
 *   <RoleVisible allowed={['admin', 'pm']}>
 *       <NavLink title="Reports" route="/reports" />
 *   </RoleVisible>
 */
export function RoleVisible({ allowed, children }: RoleGuardProps) {
    const { profile } = useAuth();
    if (!profile || !allowed.includes(profile.role)) return null;
    return <>{children}</>;
}
