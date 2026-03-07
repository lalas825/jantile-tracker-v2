import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, UserCheck, Clock } from 'lucide-react-native';
import { supabase } from '../../../config/supabase';
import { JobAssignmentManager } from './JobAssignmentManager';

interface PendingUser {
    id: string;
    full_name: string;
    email: string;
    role: string;
}

function PendingUsersSection() {
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState<string | null>(null);

    const loadPending = useCallback(async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('status', 'pending');

        if (error) console.error('Error loading pending users:', error);
        setPendingUsers(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { loadPending(); }, [loadPending]);

    const approveUser = async (userId: string) => {
        setApproving(userId);
        const { error } = await supabase
            .from('profiles')
            .update({ status: 'approved' })
            .eq('id', userId);

        if (error) {
            const msg = error.message || 'Failed to approve user';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
        } else {
            setPendingUsers(prev => prev.filter(u => u.id !== userId));
        }
        setApproving(null);
    };

    if (loading) {
        return (
            <View className="mx-4 mt-3 py-6 items-center">
                <ActivityIndicator size="small" color="#334155" />
            </View>
        );
    }

    return (
        <View className="mx-4 mt-3">
            <View className="flex-row items-center mb-2">
                <Clock size={16} color="#f59e0b" />
                <Text className="text-slate-700 text-sm font-bold ml-2">
                    Pending Approval ({pendingUsers.length})
                </Text>
            </View>
            {pendingUsers.length === 0 ? (
                <View className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-2 items-center">
                    <Text className="text-slate-400 text-sm">No pending users</Text>
                </View>
            ) : null}
            {pendingUsers.map(user => (
                <View key={user.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-2 flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-slate-900 font-semibold">
                            {user.full_name || user.email || 'No name'}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-0.5">
                            {user.email}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => approveUser(user.id)}
                        disabled={approving === user.id}
                        className="bg-emerald-600 rounded-lg px-4 py-2 ml-3"
                    >
                        {approving === user.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <View className="flex-row items-center">
                                <UserCheck size={14} color="#fff" />
                                <Text className="text-white text-xs font-bold ml-1">Approve</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
}

export function AdminDashboard() {
    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* Header */}
            <View className="px-5 py-4 bg-white border-b border-slate-200">
                <View className="flex-row items-center">
                    <Shield size={22} color="#dc2626" />
                    <Text className="text-slate-900 text-xl font-bold ml-2">Admin Dashboard</Text>
                </View>
                <Text className="text-slate-500 text-sm mt-1">
                    Manage job assignments and user access
                </Text>
            </View>

            {/* Pending Users */}
            <PendingUsersSection />

            {/* Job Assignment Manager */}
            <JobAssignmentManager />
        </SafeAreaView>
    );
}
