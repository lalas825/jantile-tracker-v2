import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput, Platform, useWindowDimensions, Modal, FlatList, KeyboardAvoidingView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { SupabaseService, UICrewMember } from '../../services/SupabaseService';
import { useQuery } from '@powersync/react';

// --- CONFIGURATION ---
const ROLES = [
    'Tile Foreman', 'Tile Mechanic', 'Tile Helper', 'Tender',
    'Marble Foreman', 'Marble Mechanic', 'Marble Helper', 'Marble Polisher'
];

export default function ManpowerScreen() {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const isDesktop = width >= 1024;

    // --- STATE ---
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All Roles');
    const [jobFilter, setJobFilter] = useState<{ id: string, name: string } | null>(null); // Null means 'All Jobs'
    const [statusFilter, setStatusFilter] = useState<'Active' | 'Inactive'>('Active');

    // Modals
    const [modalVisible, setModalVisible] = useState(false);
    const [roleFilterVisible, setRoleFilterVisible] = useState(false);
    const [jobFilterVisible, setJobFilterVisible] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formName, setFormName] = useState('');
    const [formRole, setFormRole] = useState(ROLES[0]);
    const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
    const [formPhone, setFormPhone] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formAssignedJobs, setFormAssignedJobs] = useState<string[]>([]);
    const [showRolePicker, setShowRolePicker] = useState(false);

    // --- PowerSync Reactive Data (Native Only) ---
    const { data: psCrew = [] } = useQuery(Platform.OS === 'web' ? 'SELECT 1 WHERE 0' : 'SELECT * FROM workers ORDER BY name ASC');
    const { data: psJobs = [] } = useQuery(Platform.OS === 'web' ? 'SELECT 1 WHERE 0' : 'SELECT * FROM jobs WHERE LOWER(status) = "active" ORDER BY name ASC');

    const [crew, setCrew] = useState<UICrewMember[]>([]);
    const [jobs, setJobs] = useState<any[]>([]);

    // Web Data Fetching
    const loadWebData = async () => {
        if (Platform.OS !== 'web') return;
        try {
            const [workers, activeJobs] = await Promise.all([
                SupabaseService.getWorkers(),
                SupabaseService.getActiveJobs()
            ]);
            setCrew(workers);
            setJobs(activeJobs);
        } catch (error) {
            console.error("Web Data Fetch Error:", error);
        }
    };

    useEffect(() => {
        loadWebData();
    }, []);

    // Native Data Sync
    useEffect(() => {
        if (Platform.OS === 'web') return;

        // Map PowerSync records to UICrewMember interface
        const mappedCrew: UICrewMember[] = psCrew.map((w: any) => ({
            id: w.id,
            name: w.name,
            role: w.role,
            status: w.status,
            phone: w.phone,
            email: w.email,
            address: w.address,
            assignedJobIds: w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : [],
            avatar: w.avatar || w.name.substring(0, 2).toUpperCase()
        }));
        setCrew(mappedCrew);
    }, [psCrew]);

    useEffect(() => {
        if (Platform.OS === 'web') return;
        setJobs(psJobs);
    }, [psJobs]);

    // --- ACTIONS ---
    const handleOpenModal = (member?: UICrewMember) => {
        if (member) {
            setEditingId(member.id);
            setFormName(member.name);
            setFormRole(member.role);
            setFormStatus(member.status);
            setFormPhone(member.phone || '');
            setFormEmail(member.email || '');
            setFormAssignedJobs(member.assignedJobIds || []);
        } else {
            setEditingId(null);
            setFormName('');
            setFormRole(ROLES[0]);
            setFormStatus('Active');
            setFormPhone('');
            setFormEmail('');
            setFormAssignedJobs([]);
        }
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            Alert.alert("Missing Name", "Please enter a name for the crew member.");
            return;
        }

        const memberData: Partial<UICrewMember> = {
            id: editingId || undefined,
            name: formName,
            role: formRole,
            status: formStatus,
            phone: formPhone,
            email: formEmail,
            assignedJobIds: formAssignedJobs,
            avatar: ''
        };

        try {
            console.log("[manpower] Saving worker:", memberData);
            await SupabaseService.saveWorker(memberData as any);
            console.log("[manpower] Save successful");

            // On Web, we must manually refresh the list since we don't have reactive PowerSync queries
            if (Platform.OS === 'web') {
                console.log("[manpower] Refreshing web data...");
                await loadWebData();
            }

            setModalVisible(false);
        } catch (error: any) {
            console.error("[manpower] Save Worker Error:", error);
            const msg = error.message || "Unknown error";
            if (Platform.OS === 'web') {
                window.alert("Error: Failed to save crew member: " + msg);
            } else {
                Alert.alert("Error", "Failed to save crew member: " + msg);
            }
        }
    };

    const toggleJobAssignment = (jobId: string) => {
        if (formAssignedJobs.includes(jobId)) {
            setFormAssignedJobs(formAssignedJobs.filter(id => id !== jobId));
        } else {
            setFormAssignedJobs([...formAssignedJobs, jobId]);
        }
    };

    // --- FILTERING ---
    const filteredCrew = crew.filter(c => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
        const matchesRole = roleFilter === 'All Roles' || c.role === roleFilter;
        const matchesStatus = c.status === statusFilter;
        const matchesJob = !jobFilter || c.assignedJobIds.includes(jobFilter.id); // Check assigned jobs

        return matchesSearch && matchesRole && matchesStatus && matchesJob;
    });

    // --- RENDERERS ---
    const renderCard = (member: UICrewMember) => (
        <TouchableOpacity
            key={member.id}
            onPress={() => handleOpenModal(member)}
            style={{ width: isDesktop ? '32%' : (isMobile ? '100%' : '48%') }}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4 flex-row items-center gap-4"
        >
            <View className="w-12 h-12 rounded-full bg-green-50 items-center justify-center border border-green-100">
                <FontAwesome5 name="user-alt" size={18} color="#16a34a" />
                <View className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${member.status === 'Active' ? 'bg-green-500' : 'bg-slate-400'}`} />
            </View>
            <View className="flex-1">
                <Text className="font-bold text-slate-800 text-base">{member.name}</Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    <Text className="text-xs text-slate-500 font-medium">{member.role}</Text>
                </View>
                {member.email ? <Text className="text-[10px] text-slate-400 mt-0.5" numberOfLines={1}>{member.email}</Text> : null}
                <Text className="text-[10px] text-slate-400 mt-1">{member.assignedJobIds.length} Active Jobs</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* HEADER */}
            <View className="bg-white px-6 py-5 border-b border-slate-200 flex-row justify-between items-center">
                <View>
                    <Text className="text-2xl font-bold text-slate-800">Manpower / Crew</Text>
                    <Text className="text-xs text-slate-500 mt-1">Manage employees, status, and job assignments.</Text>
                </View>
                <TouchableOpacity onPress={() => handleOpenModal()} className="bg-blue-600 px-4 py-2.5 rounded-lg flex-row items-center gap-2 shadow-sm shadow-blue-200">
                    <Ionicons name="add" size={18} color="white" />
                    {!isMobile && <Text className="text-white font-bold text-sm">Add Crew Member</Text>}
                </TouchableOpacity>
            </View>

            {/* FILTERS */}
            <View className="px-6 py-4">
                <View className="flex-row gap-3 items-center mb-4">
                    {/* Search */}
                    <View className="flex-1 bg-white border border-slate-200 rounded-lg flex-row items-center px-3 h-10">
                        <Ionicons name="search" size={18} color="#94a3b8" />
                        <TextInput
                            placeholder="Search by name, role, or email..."
                            className="flex-1 ml-2 text-sm bg-transparent"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}}
                        />
                    </View>

                    {/* Filter Buttons */}
                    {!isMobile && (
                        <View className="flex-row gap-2">
                            {/* ROLE FILTER */}
                            <TouchableOpacity onPress={() => setRoleFilterVisible(true)} className={`bg-white border px-4 h-10 justify-center rounded-lg flex-row items-center gap-2 ${roleFilter !== 'All Roles' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                                <Ionicons name="filter" size={14} color={roleFilter !== 'All Roles' ? '#2563eb' : '#64748b'} />
                                <Text className={`text-xs font-bold ${roleFilter !== 'All Roles' ? 'text-blue-600' : 'text-slate-600'}`}>{roleFilter}</Text>
                                <Ionicons name="chevron-down" size={12} color={roleFilter !== 'All Roles' ? '#2563eb' : '#64748b'} />
                            </TouchableOpacity>

                            {/* JOB FILTER */}
                            <TouchableOpacity onPress={() => setJobFilterVisible(true)} className={`bg-white border px-4 h-10 justify-center rounded-lg flex-row items-center gap-2 ${jobFilter ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                                <Ionicons name="briefcase" size={14} color={jobFilter ? '#2563eb' : '#64748b'} />
                                <Text className={`text-xs font-bold ${jobFilter ? 'text-blue-600' : 'text-slate-600'}`}>{jobFilter ? jobFilter.name : 'All Jobs'}</Text>
                                <Ionicons name="chevron-down" size={12} color={jobFilter ? '#2563eb' : '#64748b'} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Status Toggle */}
                    <View className="flex-row bg-slate-200 p-1 rounded-lg h-10 items-center">
                        <TouchableOpacity onPress={() => setStatusFilter('Active')} className={`px-4 py-1.5 rounded-md ${statusFilter === 'Active' ? 'bg-white shadow-sm' : ''}`}>
                            <Text className={`text-xs font-bold ${statusFilter === 'Active' ? 'text-green-600' : 'text-slate-500'}`}>Active</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setStatusFilter('Inactive')} className={`px-4 py-1.5 rounded-md ${statusFilter === 'Inactive' ? 'bg-white shadow-sm' : ''}`}>
                            <Text className={`text-xs font-bold ${statusFilter === 'Inactive' ? 'text-slate-600' : 'text-slate-500'}`}>Inactive</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* STATS */}
                <Text className="text-slate-500 text-sm font-bold mb-4">
                    <Ionicons name="people" size={16} /> Crew Members ({filteredCrew.length})
                </Text>

                {/* GRID */}
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    <View className="flex-row flex-wrap justify-between">
                        {filteredCrew.map(renderCard)}
                    </View>
                </ScrollView>
            </View>

            {/* --- MODALS --- */}

            {/* 1. ROLE FILTER MODAL */}
            <Modal visible={roleFilterVisible} animationType="fade" transparent>
                <TouchableOpacity activeOpacity={1} onPress={() => setRoleFilterVisible(false)} className="flex-1 bg-black/50 justify-center items-center">
                    <View className="bg-white rounded-xl w-[300px] p-4 max-h-[60%]">
                        <Text className="text-lg font-bold text-slate-800 mb-4 px-2">Filter by Role</Text>
                        <ScrollView>
                            <TouchableOpacity onPress={() => { setRoleFilter('All Roles'); setRoleFilterVisible(false); }} className="p-3 rounded-lg hover:bg-slate-50">
                                <Text className={`text-sm ${roleFilter === 'All Roles' ? 'font-bold text-blue-600' : 'text-slate-600'}`}>All Roles</Text>
                            </TouchableOpacity>
                            {ROLES.map(role => (
                                <TouchableOpacity key={role} onPress={() => { setRoleFilter(role); setRoleFilterVisible(false); }} className="p-3 rounded-lg hover:bg-slate-50">
                                    <Text className={`text-sm ${roleFilter === role ? 'font-bold text-blue-600' : 'text-slate-600'}`}>{role}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 2. JOB FILTER MODAL */}
            <Modal visible={jobFilterVisible} animationType="fade" transparent>
                <TouchableOpacity activeOpacity={1} onPress={() => setJobFilterVisible(false)} className="flex-1 bg-black/50 justify-center items-center">
                    <View className="bg-white rounded-xl w-[300px] p-4 max-h-[60%]">
                        <Text className="text-lg font-bold text-slate-800 mb-4 px-2">Filter by Assigned Job</Text>
                        <ScrollView>
                            <TouchableOpacity onPress={() => { setJobFilter(null); setJobFilterVisible(false); }} className="p-3 rounded-lg hover:bg-slate-50">
                                <Text className={`text-sm ${!jobFilter ? 'font-bold text-blue-600' : 'text-slate-600'}`}>All Jobs</Text>
                            </TouchableOpacity>
                            {jobs.map(job => (
                                <TouchableOpacity key={job.id} onPress={() => { setJobFilter(job); setJobFilterVisible(false); }} className="p-3 rounded-lg hover:bg-slate-50">
                                    <Text className={`text-sm ${jobFilter?.id === job.id ? 'font-bold text-blue-600' : 'text-slate-600'}`}>{job.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 3. ADD/EDIT WORKER MODAL */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-2xl h-[85%] w-full flex-1 mt-20 overflow-hidden">
                        <View className="px-6 py-4 border-b border-slate-100 flex-row justify-between items-center">
                            <Text className="text-xl font-bold text-slate-800">{editingId ? 'Edit Crew Member' : 'Add New Crew Member'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="p-6">
                            {/* Name */}
                            <View className="mb-4">
                                <Text className="text-xs font-bold text-slate-500 uppercase mb-1">Name</Text>
                                <TextInput value={formName} onChangeText={setFormName} placeholder="e.g. John Doe" className="bg-white border border-slate-300 rounded-lg p-3 text-base text-slate-800" />
                            </View>
                            {/* Role */}
                            <View className="mb-4 relative z-50">
                                <Text className="text-xs font-bold text-slate-500 uppercase mb-1">Role</Text>
                                <TouchableOpacity onPress={() => setShowRolePicker(!showRolePicker)} className="bg-white border border-slate-300 rounded-lg p-3 flex-row justify-between items-center"><Text className="text-base text-slate-800">{formRole}</Text><Ionicons name="chevron-down" size={16} color="#64748b" /></TouchableOpacity>
                                {showRolePicker && (
                                    <View className="bg-white border border-slate-200 rounded-lg mt-1 shadow-lg">
                                        {ROLES.map(role => (
                                            <TouchableOpacity key={role} onPress={() => { setFormRole(role); setShowRolePicker(false); }} className={`p-3 border-b border-slate-50 ${formRole === role ? 'bg-blue-50' : ''}`}><Text className={`text-sm ${formRole === role ? 'text-blue-600 font-bold' : 'text-slate-600'}`}>{role}</Text></TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                            {/* Status */}
                            <View className="mb-4">
                                <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Employment Status</Text>
                                <View className="flex-row bg-slate-100 p-1 rounded-lg self-start">
                                    <TouchableOpacity onPress={() => setFormStatus('Active')} className={`px-6 py-2 rounded-md ${formStatus === 'Active' ? 'bg-white shadow-sm border border-slate-200' : ''}`}><Text className={`font-bold text-sm ${formStatus === 'Active' ? 'text-green-600' : 'text-slate-400'}`}>Active</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => setFormStatus('Inactive')} className={`px-6 py-2 rounded-md ${formStatus === 'Inactive' ? 'bg-white shadow-sm border border-slate-200' : ''}`}><Text className={`font-bold text-sm ${formStatus === 'Inactive' ? 'text-slate-600' : 'text-slate-400'}`}>Inactive</Text></TouchableOpacity>
                                </View>
                            </View>
                            {/* Info */}
                            <View className="mb-6">
                                <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Personal Info</Text>
                                <View className="flex-row gap-3 mb-3">
                                    <View className="flex-1 bg-white border border-slate-300 rounded-lg flex-row items-center px-3 h-12"><Ionicons name="call-outline" size={18} color="#94a3b8" /><TextInput value={formPhone} onChangeText={setFormPhone} placeholder="Phone" className="flex-1 ml-2" keyboardType="phone-pad" /></View>
                                    <View className="flex-1 bg-white border border-slate-300 rounded-lg flex-row items-center px-3 h-12"><Ionicons name="mail-outline" size={18} color="#94a3b8" /><TextInput value={formEmail} onChangeText={setFormEmail} placeholder="Email" className="flex-1 ml-2" keyboardType="email-address" autoCapitalize="none" /></View>
                                </View>
                            </View>

                            {/* Jobs */}
                            <View className="mb-8">
                                <Text className="text-xs font-bold text-slate-500 uppercase mb-2">Assign to Active Jobs</Text>
                                <View className="bg-slate-50 border border-slate-200 rounded-xl max-h-60">
                                    <ScrollView nestedScrollEnabled className="p-2">
                                        {jobs.length === 0 ? (
                                            <Text className="p-4 text-slate-400 italic text-center">No active jobs found.</Text>
                                        ) : (
                                            jobs.map(job => {
                                                const isAssigned = formAssignedJobs.includes(job.id);
                                                return (
                                                    <TouchableOpacity
                                                        key={job.id}
                                                        onPress={() => toggleJobAssignment(job.id)}
                                                        className={`p-3 mb-1 rounded-lg flex-row items-center gap-3 ${isAssigned ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-transparent'}`}
                                                    >
                                                        <View className={`w-5 h-5 rounded border flex items-center justify-center ${isAssigned ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                                            {isAssigned && <Ionicons name="checkmark" size={14} color="white" />}
                                                        </View>
                                                        <Text className={`text-sm font-medium ${isAssigned ? 'text-blue-800' : 'text-slate-600'}`}>{job.name}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        )}
                                    </ScrollView>
                                </View>
                            </View>
                            <View className="h-20" />
                        </ScrollView>
                        <View className="p-4 border-t border-slate-100 bg-white flex-row justify-end gap-3 pb-8">
                            <TouchableOpacity onPress={() => setModalVisible(false)} className="px-6 py-3 rounded-lg"><Text className="font-bold text-slate-500">Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleSave} className="bg-blue-600 px-8 py-3 rounded-lg shadow-sm shadow-blue-200"><Text className="font-bold text-white">Save Worker</Text></TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}
