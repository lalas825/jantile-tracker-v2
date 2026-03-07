import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';

interface AdminGuardProps {
    children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
    const { profile, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && profile?.role !== 'admin') {
            router.replace('/(tabs)');
        }
    }, [isLoading, profile]);

    if (isLoading || profile?.role !== 'admin') {
        return (
            <View className="flex-1 bg-slate-50 justify-center items-center">
                <ActivityIndicator size="large" color="#334155" />
            </View>
        );
    }

    return <>{children}</>;
}
