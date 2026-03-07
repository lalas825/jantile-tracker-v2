import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, UserPlus, Trash2, Briefcase, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: string;
}

interface Job {
    id: string;
    name: string;
}

interface Assignment {
    id: string;
    user_id: string;
    job_id: string;
    role: string;
    created_at: string;
}

// ─── Admin Guard ─────────────────────────────────────────────────────────────

export default function AdminScreen() {
    const { profile, isLoading } = useAuth();
    const router = useRouter();

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center" edges={['top']}>
                <ActivityIndicator size="large" color="#334155" />
            </SafeAreaView>
        );
    }

    if (profile?.role !== 'admin') {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center" edges={['top']}>
                <Shield size={48} color="#dc2626" />
                <Text className="text-slate-900 text-xl font-bold mt-4">Access Denied</Text>
                <Text className="text-slate-500 mt-2 text-center px-8">
                    Only administrators can access this page.
                </Text>
                <TouchableOpacity
                    onPress={() => router.replace('/(tabs)')}
                    className="mt-6 px-6 py-3 bg-slate-900 rounded-lg"
                >
                    <Text className="text-white font-semibold">Go to Dashboard</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return <JobAssignmentManager />;
}

// ─── Job Assignment Manager (Admin Only) ─────────────────────────────────────

function JobAssignmentManager() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [assigningUser, setAssigningUser] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [profilesRes, jobsRes, assignmentsRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, email, role'),
                supabase.from('jobs').select('id, name').eq('status', 'Active').order('name'),
                supabase.from('job_assignments').select('*'),
            ]);

            if (profilesRes.data) setProfiles(profilesRes.data);
            if (jobsRes.data) setJobs(jobsRes.data);
            if (assignmentsRes.data) setAssignments(assignmentsRes.data);
        } catch (e: any) {
            console.error('Admin loadData error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const assignJob = async (userId: string, jobId: string) => {
        const existing = assignments.find(a => a.user_id === userId && a.job_id === jobId);
        if (existing) return;

        const userProfile = profiles.find(p => p.id === userId);
        const assignRole = userProfile?.role === 'pm' ? 'pm' : userProfile?.role || 'member';

        const { error } = await supabase.from('job_assignments').insert({
            user_id: userId,
            job_id: jobId,
            role: assignRole,
        });

        if (error) {
            const msg = error.message || 'Failed to assign job';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
            return;
        }

        await loadData();
    };

    const removeAssignment = async (assignmentId: string) => {
        const doRemove = async () => {
            const { error } = await supabase.from('job_assignments').delete().eq('id', assignmentId);
            if (error) {
                const msg = error.message || 'Failed to remove assignment';
                Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
                return;
            }
            await loadData();
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Remove this job assignment?')) doRemove();
        } else {
            Alert.alert('Confirm', 'Remove this job assignment?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: doRemove },
            ]);
        }
    };

    const getUserAssignments = (userId: string) =>
        assignments.filter(a => a.user_id === userId);

    const getUnassignedJobs = (userId: string) => {
        const assignedJobIds = getUserAssignments(userId).map(a => a.job_id);
        return jobs.filter(j => !assignedJobIds.includes(j.id));
    };

    const getJobName = (jobId: string) =>
        jobs.find(j => j.id === jobId)?.name || 'Unknown Job';

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
            case 'pm': return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
            case 'foreman': return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
            case 'warehouse': return { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' };
            default: return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center" edges={['top']}>
                <ActivityIndicator size="large" color="#334155" />
            </SafeAreaView>
        );
    }

    // Filter out admins — they have global access, no need to assign
    const nonAdminProfiles = profiles.filter(p => p.role !== 'admin');

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* Header */}
            <View className="px-5 py-4 bg-white border-b border-slate-200">
                <View className="flex-row items-center">
                    <Shield size={22} color="#dc2626" />
                    <Text className="text-slate-900 text-xl font-bold ml-2">Admin Panel</Text>
                </View>
                <Text className="text-slate-500 text-sm mt-1">
                    Manage job assignments for team members
                </Text>
            </View>

            {/* Stats */}
            <View className="flex-row px-4 py-3 bg-white border-b border-slate-100">
                <View className="flex-1 items-center">
                    <Text className="text-slate-900 text-lg font-bold">{nonAdminProfiles.length}</Text>
                    <Text className="text-slate-500 text-xs">Users</Text>
                </View>
                <View className="flex-1 items-center">
                    <Text className="text-slate-900 text-lg font-bold">{jobs.length}</Text>
                    <Text className="text-slate-500 text-xs">Active Jobs</Text>
                </View>
                <View className="flex-1 items-center">
                    <Text className="text-slate-900 text-lg font-bold">{assignments.length}</Text>
                    <Text className="text-slate-500 text-xs">Assignments</Text>
                </View>
            </View>

            {/* User List */}
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                {nonAdminProfiles.map(user => {
                    const userAssignments = getUserAssignments(user.id);
                    const unassignedJobs = getUnassignedJobs(user.id);
                    const isExpanded = expandedUser === user.id;
                    const isAssigning = assigningUser === user.id;
                    const badgeColor = getRoleBadgeColor(user.role);

                    return (
                        <View key={user.id} className="mx-4 mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
                            {/* User Header */}
                            <TouchableOpacity
                                onPress={() => setExpandedUser(isExpanded ? null : user.id)}
                                className="flex-row items-center justify-between p-4"
                            >
                                <View className="flex-row items-center flex-1">
                                    <View className="h-10 w-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                                        <Text className="text-sm font-bold text-slate-600">
                                            {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                                        </Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-slate-900 font-semibold">{user.full_name || user.email}</Text>
                                        <View className="flex-row items-center mt-1">
                                            <View style={{ backgroundColor: badgeColor.bg, borderColor: badgeColor.border, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                                <Text style={{ color: badgeColor.text, fontSize: 11, fontWeight: '700' }}>
                                                    {user.role.toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text className="text-slate-400 text-xs ml-2">
                                                {userAssignments.length} job{userAssignments.length !== 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                {isExpanded ? <ChevronUp size={20} color="#94a3b8" /> : <ChevronDown size={20} color="#94a3b8" />}
                            </TouchableOpacity>

                            {/* Expanded: Assigned Jobs + Add */}
                            {isExpanded && (
                                <View className="border-t border-slate-100 px-4 pb-4">
                                    {/* Current Assignments */}
                                    {userAssignments.length === 0 ? (
                                        <Text className="text-slate-400 text-sm py-3 text-center">No jobs assigned</Text>
                                    ) : (
                                        userAssignments.map(a => (
                                            <View key={a.id} className="flex-row items-center justify-between py-2 border-b border-slate-50">
                                                <View className="flex-row items-center flex-1">
                                                    <Briefcase size={16} color="#64748b" />
                                                    <Text className="text-slate-700 text-sm ml-2 flex-1">{getJobName(a.job_id)}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => removeAssignment(a.id)}
                                                    className="p-2"
                                                >
                                                    <Trash2 size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    )}

                                    {/* Add Job Button / Job Picker */}
                                    {!isAssigning ? (
                                        <TouchableOpacity
                                            onPress={() => setAssigningUser(user.id)}
                                            className="flex-row items-center justify-center mt-3 py-2 border border-dashed border-slate-300 rounded-lg"
                                        >
                                            <UserPlus size={16} color="#64748b" />
                                            <Text className="text-slate-600 text-sm font-medium ml-2">Assign Job</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View className="mt-3">
                                            <Text className="text-slate-500 text-xs font-medium mb-2">Select a job to assign:</Text>
                                            {unassignedJobs.length === 0 ? (
                                                <Text className="text-slate-400 text-xs text-center py-2">All jobs already assigned</Text>
                                            ) : (
                                                unassignedJobs.map(job => (
                                                    <TouchableOpacity
                                                        key={job.id}
                                                        onPress={() => { assignJob(user.id, job.id); setAssigningUser(null); }}
                                                        className="flex-row items-center py-2 px-3 bg-slate-50 rounded-lg mb-1 active:bg-slate-100"
                                                    >
                                                        <Briefcase size={14} color="#3b82f6" />
                                                        <Text className="text-slate-700 text-sm ml-2">{job.name}</Text>
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                            <TouchableOpacity
                                                onPress={() => setAssigningUser(null)}
                                                className="mt-1"
                                            >
                                                <Text className="text-slate-400 text-xs text-center">Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}
