import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Alert,
    ActivityIndicator, Platform, Modal, TextInput, Pressable, Switch,
} from 'react-native';
import { UserPlus, Trash2, Briefcase, X, ChevronDown, ShieldAlert } from 'lucide-react-native';
import { supabase } from '../../../config/supabase';

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
    is_manual: boolean;
    created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ROLES = ['admin', 'pm', 'supervisor', 'foreman', 'worker', 'warehouse', 'shop'] as const;

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    admin:      { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
    pm:         { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    foreman:    { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
    supervisor: { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe' },
    worker:     { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
    warehouse:  { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
    shop:       { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
};

const getRoleBadge = (role: string) => ROLE_COLORS[role] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };

// ─── User Profile Modal ─────────────────────────────────────────────────────

function UserProfileModal({
    user,
    jobs,
    assignments,
    visible,
    onClose,
    onSave,
    onAssignJob,
    onRemoveAssignment,
    onToggleManual,
}: {
    user: Profile;
    jobs: Job[];
    assignments: Assignment[];
    visible: boolean;
    onClose: () => void;
    onSave: (id: string, data: { full_name: string; email: string; role: string }) => Promise<void>;
    onAssignJob: (userId: string, jobId: string) => Promise<void>;
    onRemoveAssignment: (assignmentId: string) => Promise<void>;
    onToggleManual: (assignmentId: string, isManual: boolean) => Promise<void>;
}) {
    const [fullName, setFullName] = useState(user.full_name || '');
    const [email, setEmail] = useState(user.email || '');
    const [role, setRole] = useState(user.role);
    const [showRolePicker, setShowRolePicker] = useState(false);
    const [showJobPicker, setShowJobPicker] = useState(false);
    const [saving, setSaving] = useState(false);

    // Reset form when user changes
    useEffect(() => {
        setFullName(user.full_name || '');
        setEmail(user.email || '');
        setRole(user.role);
        setShowRolePicker(false);
        setShowJobPicker(false);
    }, [user]);

    const assignedJobIds = assignments.map(a => a.job_id);
    const unassignedJobs = jobs.filter(j => !assignedJobIds.includes(j.id));
    const badge = getRoleBadge(role);

    const handleSave = async () => {
        setSaving(true);
        await onSave(user.id, { full_name: fullName, email, role });
        setSaving(false);
    };

    const hasChanges =
        fullName !== (user.full_name || '') ||
        email !== (user.email || '') ||
        role !== user.role;

    const handleRemove = (assignmentId: string) => {
        const doRemove = () => onRemoveAssignment(assignmentId);
        if (Platform.OS === 'web') {
            if (window.confirm('Remove this assignment?')) doRemove();
        } else {
            Alert.alert('Confirm', 'Remove this assignment?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: doRemove },
            ]);
        }
    };

    const getJobName = (jobId: string) =>
        jobs.find(j => j.id === jobId)?.name || 'Unknown Job';

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-center items-center px-4">
                <View className="bg-white rounded-2xl w-full" style={{ maxWidth: 480, maxHeight: '90%' }}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
                        <Text className="text-slate-900 text-lg font-bold">User Profile</Text>
                        <TouchableOpacity onPress={onClose} className="p-1">
                            <X size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="px-5 py-4" contentContainerStyle={{ paddingBottom: 20 }}>
                        {/* ── Personal Info ── */}
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-3">
                            Personal Information
                        </Text>

                        <Text className="text-slate-600 text-xs font-medium mb-1">Full Name</Text>
                        <TextInput
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="Enter full name"
                            placeholderTextColor="#94a3b8"
                            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 mb-3 bg-white"
                        />

                        <Text className="text-slate-600 text-xs font-medium mb-1">Email</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter email"
                            placeholderTextColor="#94a3b8"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 mb-3 bg-white"
                        />

                        {/* ── Role Selector ── */}
                        <Text className="text-slate-600 text-xs font-medium mb-1">Role</Text>
                        <TouchableOpacity
                            onPress={() => setShowRolePicker(!showRolePicker)}
                            className="border border-slate-200 rounded-lg px-3 py-2.5 flex-row items-center justify-between mb-1 bg-white"
                        >
                            <View className="flex-row items-center">
                                <View style={{
                                    backgroundColor: badge.bg,
                                    borderColor: badge.border,
                                    borderWidth: 1,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 10,
                                }}>
                                    <Text style={{ color: badge.text, fontSize: 11, fontWeight: '700' }}>
                                        {role.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                            <ChevronDown size={16} color="#94a3b8" />
                        </TouchableOpacity>

                        {showRolePicker && (
                            <View className="border border-slate-200 rounded-lg mb-3 bg-white overflow-hidden">
                                {ALL_ROLES.map(r => {
                                    const c = getRoleBadge(r);
                                    const isSelected = r === role;
                                    return (
                                        <TouchableOpacity
                                            key={r}
                                            onPress={() => { setRole(r); setShowRolePicker(false); }}
                                            className="flex-row items-center px-3 py-2.5 border-b border-slate-50"
                                            style={isSelected ? { backgroundColor: '#f8fafc' } : undefined}
                                        >
                                            <View style={{
                                                backgroundColor: c.bg,
                                                borderColor: c.border,
                                                borderWidth: 1,
                                                paddingHorizontal: 8,
                                                paddingVertical: 2,
                                                borderRadius: 10,
                                            }}>
                                                <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>
                                                    {r.toUpperCase()}
                                                </Text>
                                            </View>
                                            {isSelected && (
                                                <Text className="text-slate-400 text-xs ml-2">Current</Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {!showRolePicker && <View className="mb-3" />}

                        {/* ── Active Assignments ── */}
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-3 mt-2">
                            Active Assignments ({assignments.length})
                        </Text>

                        {assignments.length === 0 ? (
                            <View className="py-4 bg-slate-50 rounded-lg items-center mb-3">
                                <Text className="text-slate-400 text-sm">No active assignments</Text>
                            </View>
                        ) : (
                            <View className="mb-3">
                                {assignments.map(a => (
                                    <View key={a.id} className="bg-slate-50 rounded-lg mb-1.5 px-3 py-2.5">
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center flex-1">
                                                <Briefcase size={15} color="#64748b" />
                                                <Text className="text-slate-700 text-sm ml-2 flex-1" numberOfLines={1}>
                                                    {getJobName(a.job_id)}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handleRemove(a.id)}
                                                className="p-1.5 ml-2"
                                            >
                                                <Trash2 size={15} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                        {/* Manual Override Toggle */}
                                        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                                            <View className="flex-row items-center">
                                                <ShieldAlert size={12} color={a.is_manual ? '#f59e0b' : '#94a3b8'} />
                                                <Text className={`text-xs ml-1.5 font-medium ${a.is_manual ? 'text-amber-600' : 'text-slate-400'}`}>
                                                    {a.is_manual ? 'Manual Assignment Active' : 'Auto Assignment'}
                                                </Text>
                                            </View>
                                            <Switch
                                                value={!!a.is_manual}
                                                onValueChange={(val) => onToggleManual(a.id, val)}
                                                trackColor={{ false: '#e2e8f0', true: '#fbbf24' }}
                                                thumbColor={a.is_manual ? '#f59e0b' : '#f1f5f9'}
                                                style={{ transform: [{ scale: 0.75 }] }}
                                            />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Add Assignment */}
                        {!showJobPicker ? (
                            <TouchableOpacity
                                onPress={() => setShowJobPicker(true)}
                                className="flex-row items-center justify-center py-2.5 border border-dashed border-slate-300 rounded-lg mb-2"
                            >
                                <UserPlus size={15} color="#64748b" />
                                <Text className="text-slate-600 text-sm font-medium ml-2">Add Assignment</Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="border border-slate-200 rounded-lg mb-2 bg-white overflow-hidden">
                                <View className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                                    <Text className="text-slate-500 text-xs font-medium">Select a job:</Text>
                                </View>
                                {unassignedJobs.length === 0 ? (
                                    <View className="px-3 py-3">
                                        <Text className="text-slate-400 text-xs text-center">All jobs already assigned</Text>
                                    </View>
                                ) : (
                                    <ScrollView style={{ maxHeight: 180 }}>
                                        {unassignedJobs.map(job => (
                                            <TouchableOpacity
                                                key={job.id}
                                                onPress={() => { onAssignJob(user.id, job.id); setShowJobPicker(false); }}
                                                className="flex-row items-center py-2.5 px-3 border-b border-slate-50 active:bg-slate-50"
                                            >
                                                <Briefcase size={14} color="#3b82f6" />
                                                <Text className="text-slate-700 text-sm ml-2">{job.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                                <TouchableOpacity
                                    onPress={() => setShowJobPicker(false)}
                                    className="px-3 py-2 border-t border-slate-100"
                                >
                                    <Text className="text-slate-400 text-xs text-center">Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View className="flex-row px-5 py-4 border-t border-slate-100" style={{ gap: 10 }}>
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 py-2.5 border border-slate-200 rounded-lg items-center"
                        >
                            <Text className="text-slate-600 font-semibold text-sm">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={!hasChanges || saving}
                            className="flex-1 py-2.5 rounded-lg items-center"
                            style={{ backgroundColor: hasChanges ? '#0f172a' : '#cbd5e1' }}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text className="text-white font-semibold text-sm">Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── Job Assignment Manager ──────────────────────────────────────────────────

export function JobAssignmentManager() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [profilesRes, jobsRes, assignmentsRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, email, role'),
                supabase.from('jobs').select('id, name').ilike('status', 'active').order('name'),
                supabase.from('job_assignments').select('*'),
            ]);

            if (profilesRes.error) console.error('loadData profiles:', profilesRes.error);
            if (jobsRes.error) console.error('loadData jobs:', jobsRes.error);
            if (assignmentsRes.error) console.error('loadData assignments:', assignmentsRes.error);

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

    const saveProfile = async (userId: string, data: { full_name: string; email: string; role: string }) => {
        const { error } = await supabase
            .from('profiles')
            .update(data)
            .eq('id', userId);

        if (error) {
            const msg = error.message || 'Failed to update profile';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
            return;
        }

        await loadData();
        // Update selectedUser to reflect changes
        setSelectedUser(prev => prev ? { ...prev, ...data } : null);
    };

    const assignJob = async (userId: string, jobId: string) => {
        const existing = assignments.find(a => a.user_id === userId && a.job_id === jobId);
        if (existing) return;

        const userProfile = profiles.find(p => p.id === userId);
        const assignRole = userProfile?.role === 'pm' ? 'pm' : userProfile?.role || 'member';

        const { error } = await supabase.from('job_assignments').insert({
            user_id: userId,
            job_id: jobId,
            role: assignRole,
            is_manual: false,
        });

        if (error) {
            const msg = error.message || 'Failed to assign job';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
            return;
        }

        await loadData();
    };

    const removeAssignment = async (assignmentId: string) => {
        const { error } = await supabase.from('job_assignments').delete().eq('id', assignmentId);
        if (error) {
            const msg = error.message || 'Failed to remove assignment';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
            return;
        }
        await loadData();
    };

    const toggleManual = async (assignmentId: string, isManual: boolean) => {
        const { error } = await supabase
            .from('job_assignments')
            .update({ is_manual: isManual })
            .eq('id', assignmentId);

        if (error) {
            const msg = error.message || 'Failed to toggle manual override';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
            return;
        }
        await loadData();
    };

    const getUserAssignments = (userId: string) =>
        assignments.filter(a => a.user_id === userId);

    if (loading) {
        return (
            <View className="flex-1 bg-slate-50 justify-center items-center">
                <ActivityIndicator size="large" color="#334155" />
            </View>
        );
    }

    const nonAdminProfiles = profiles.filter(p => p.role !== 'admin');

    return (
        <>
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                {nonAdminProfiles.map(user => {
                    const userAssignments = getUserAssignments(user.id);
                    const badge = getRoleBadge(user.role);

                    return (
                        <TouchableOpacity
                            key={user.id}
                            onPress={() => setSelectedUser(user)}
                            className="mx-4 mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden active:bg-slate-50"
                        >
                            <View className="flex-row items-center p-4">
                                <View className="h-10 w-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                                    <Text className="text-sm font-bold text-slate-600">
                                        {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                                    </Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-900 font-semibold">{user.full_name || user.email || 'No name'}</Text>
                                    <View className="flex-row items-center mt-1">
                                        <View style={{
                                            backgroundColor: badge.bg,
                                            borderColor: badge.border,
                                            borderWidth: 1,
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 12,
                                        }}>
                                            <Text style={{ color: badge.text, fontSize: 11, fontWeight: '700' }}>
                                                {user.role.toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text className="text-slate-400 text-xs ml-2">
                                            {userAssignments.length} job{userAssignments.length !== 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                </View>
                                <ChevronDown size={18} color="#94a3b8" style={{ transform: [{ rotate: '-90deg' }] }} />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* User Profile Modal */}
            {selectedUser && (
                <UserProfileModal
                    user={selectedUser}
                    jobs={jobs}
                    assignments={getUserAssignments(selectedUser.id)}
                    visible={!!selectedUser}
                    onClose={() => setSelectedUser(null)}
                    onSave={saveProfile}
                    onAssignJob={assignJob}
                    onRemoveAssignment={removeAssignment}
                    onToggleManual={toggleManual}
                />
            )}
        </>
    );
}
