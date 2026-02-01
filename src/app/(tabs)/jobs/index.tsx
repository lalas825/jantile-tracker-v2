import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, RefreshControl, Modal, Alert, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SupabaseService } from '../../../services/SupabaseService';
import { useQuery as usePowerSyncQuery } from '@powersync/react';
import { useSafeStatus } from '../../../hooks/useSafeStatus';
import clsx from 'clsx';

export default function JobsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [jobs, setJobs] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const status = useSafeStatus();
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Fetch User Email
    useEffect(() => {
        SupabaseService.supabase.auth.getUser().then(({ data }) => {
            setUserEmail(data.user?.email || 'Anonymous');
        });
    }, []);

    const [modalVisible, setModalVisible] = useState(false);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: '',
        jobNumber: '',
        address: '',
        gc: '',
        units: '',
        email: ''
    });

    const calculateJobProgress = (job: any) => {
        // Prefer pre-calculated stats from SQL (Native)
        if (job.computed_progress !== undefined) return job.computed_progress;
        if (job.overall_progress !== undefined) return job.overall_progress;

        let totalAreas = 0;
        let totalProgress = 0;

        job.floors?.forEach((floor: any) => {
            floor.units?.forEach((unit: any) => {
                unit.areas?.forEach((area: any) => {
                    totalAreas++;
                    totalProgress += (area.progress || 0);
                });
            });
        });

        return totalAreas === 0 ? 0 : Math.round(totalProgress / totalAreas);
    };

    // --- DATA FETCHING ---

    // 1. FETCH JOBS
    const loadJobs = async () => {
        setRefreshing(true);
        try {
            const data = await SupabaseService.getActiveJobs();
            setJobs(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadJobs();
        }, [])
    );

    // 0. REACTIVE FETCH (PowerSync)
    // We use a powerful subquery to fetch stats reactively for the Projects list
    const psJobs = usePowerSyncQuery(
        `SELECT
            j.*,
            (SELECT COUNT(*) FROM floors f WHERE f.job_id = j.id) as floor_count,
            (SELECT COUNT(*) FROM units u JOIN floors f ON u.floor_id = f.id WHERE f.job_id = j.id) as unit_count,
            (SELECT AVG(a.progress) FROM areas a JOIN units u ON a.unit_id = u.id JOIN floors f ON u.floor_id = f.id WHERE f.job_id = j.id) as overall_progress
         FROM jobs j
         WHERE LOWER(j.status) = 'active'
         ORDER BY j.name ASC`
    ).data || [];

    // Sync PowerSync data to state on Native (including pre-calculated stats)
    useEffect(() => {
        if (Platform.OS !== 'web' && Array.isArray(psJobs)) {
            const mapped = psJobs.map((j: any) => ({
                ...j,
                computed_progress: j.overall_progress || 0
            }));
            setJobs(mapped);
        }
    }, [psJobs]);

    // 2. HANDLE CREATE / UPDATE
    const handleSaveJob = async () => {
        if (!form.name.trim()) {
            alert("Project Name is required");
            return;
        }

        try {
            const jobData = {
                name: form.name,
                address: form.address,
                status: 'active',
                general_contractor: form.gc,
                // total_units: form.units, // If column exists
            };

            if (editingJobId) {
                await SupabaseService.updateJob(editingJobId, jobData);
            } else {
                await SupabaseService.createJob(jobData);
            }

            setModalVisible(false);
            setEditingJobId(null);
            setForm({ name: '', jobNumber: '', address: '', gc: '', units: '', email: '' });
            loadJobs();
        } catch (error: any) {
            console.error("Save Failed:", error);
            alert(`Failed to save job: ${error.message || JSON.stringify(error)}`);
        }
    };

    const handleEditPress = (job: any) => {
        setEditingJobId(job.id);
        setForm({
            name: job.name,
            jobNumber: job.job_number || '',
            address: job.address || '',
            gc: job.general_contractor || '',
            units: job.total_units?.toString() || '',
            email: job.foreman_email || ''
        });
        setModalVisible(true);
    };

    const handleDeleteJob = async (jobId: string) => {
        const confirmDelete = () => {
            if (Platform.OS === 'web') {
                return window.confirm("Are you sure you want to delete this project? This will remove all floors, units, and areas.");
            }
            return new Promise((resolve) => {
                Alert.alert(
                    "Delete Project",
                    "Are you sure you want to delete this project? This will remove all floors, units, and areas.",
                    [
                        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                        { text: "Delete", style: "destructive", onPress: () => resolve(true) }
                    ]
                );
            });
        };

        const shouldDelete = await confirmDelete();
        if (shouldDelete) {
            try {
                await SupabaseService.deleteJob(jobId);
                loadJobs();
            } catch (error: any) {
                alert("Failed to delete job: " + error.message);
            }
        }
    };

    return (
        <View className="flex-1 bg-slate-50" style={{ paddingTop: insets.top }}>

            {/* HEADER */}
            <View className="px-6 py-6 border-b border-slate-200 flex-row justify-between items-center bg-white">
                <Text className="text-2xl font-bold text-slate-900">Projects</Text>
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="bg-slate-900 px-4 py-2 rounded-lg flex-row items-center shadow-sm"
                >
                    <Ionicons name="add" size={20} color="white" />
                    <Text className="text-white font-bold ml-1">New Job</Text>
                </TouchableOpacity>
            </View>

            {/* SEARCH */}
            <View className="px-6 py-4 bg-slate-50">
                <View className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex-row items-center shadow-sm">
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <TextInput
                        placeholder="Search projects..."
                        value={search}
                        onChangeText={setSearch}
                        className="ml-2 flex-1 text-sm bg-transparent"
                        style={{ outline: 'none' }}
                    />
                </View>
            </View>

            {/* JOB LIST */}
            <ScrollView
                contentContainerStyle={{ padding: 24 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} />}
            >
                {jobs.filter(j => j.name.toLowerCase().includes(search.toLowerCase())).map((job) => {
                    const progress = calculateJobProgress(job);
                    const floorCount = job.floors?.length || 0;
                    const unitCount = job.floors?.reduce((acc: number, f: any) => acc + (f.units?.length || 0), 0) || 0;

                    return (
                        <View
                            key={job.id}
                            className="bg-white rounded-2xl border border-slate-200 mb-4 shadow-sm overflow-hidden"
                        >
                            <TouchableOpacity
                                onPress={() => router.push(`/jobs/${job.id}`)}
                                activeOpacity={0.7}
                                className="p-4"
                            >
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1">
                                        <Text className="text-lg font-bold text-gray-900">{job.name}</Text>
                                        <Text className="text-xs text-gray-500 mt-1">{job.address || 'No Location Set'}</Text>
                                    </View>
                                    <View className="items-end gap-2">
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity
                                                onPress={() => handleEditPress(job)}
                                                className="p-2 bg-slate-50 rounded-lg border border-slate-100"
                                            >
                                                <Ionicons name="pencil" size={16} color="#64748b" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteJob(job.id)}
                                                className="p-2 bg-red-50 rounded-lg border border-red-100"
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                        <View className="bg-green-50 px-2 py-1 rounded border border-green-100">
                                            <Text className="text-[10px] font-bold text-green-700 uppercase">ACTIVE</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                <View className="mt-4">
                                    <View className="flex-row justify-between items-center mb-1.5">
                                        <Text className="text-[10px] font-bold text-gray-400 uppercase">Overall Progress</Text>
                                        <Text className="text-xs font-black text-gray-700">{progress}%</Text>
                                    </View>
                                    <View className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                                        <View
                                            className={clsx("h-full rounded-full", progress >= 100 ? "bg-green-500" : "bg-blue-500")}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </View>
                                </View>

                                {/* Stats Row */}
                                <View className="flex-row mt-4 pt-4 border-t border-gray-50 items-center justify-between">
                                    <View className="flex-row items-center">
                                        <View className="flex-row items-center mr-4">
                                            <Ionicons name="layers-outline" size={14} color="#94a3b8" />
                                            <Text className="text-xs text-slate-500 ml-1">
                                                {job.floor_count || job.floors?.length || 0} Floors
                                            </Text>
                                        </View>
                                        <View className="flex-row items-center">
                                            <Ionicons name="cube-outline" size={14} color="#94a3b8" />
                                            <Text className="text-xs text-slate-500 ml-1">
                                                {job.unit_count || job.floors?.reduce((acc: number, f: any) => acc + (f.units?.length || 0), 0) || 0} Units
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                })}

                {jobs.length === 0 && (
                    <View className="items-center mt-10">
                        <Text className="text-gray-400">No active jobs found.</Text>
                        <TouchableOpacity onPress={() => setModalVisible(true)}>
                            <Text className="text-blue-500 font-bold mt-2">Create your first job</Text>
                        </TouchableOpacity>
                    </View>
                )}


            </ScrollView>

            {/* --- MODAL V1 --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
            >
                <View className="flex-1 justify-center items-center bg-black/50 backdrop-blur-sm p-4">
                    <View className="bg-white rounded-xl w-full max-w-[500px] shadow-2xl overflow-hidden">

                        {/* Header */}
                        <View className="px-6 py-4 border-b border-gray-100 flex-row justify-between items-center">
                            <Text className="text-lg font-bold text-gray-900">{editingJobId ? 'Edit Project' : 'New Project'}</Text>
                            <TouchableOpacity onPress={() => {
                                setModalVisible(false);
                                setEditingJobId(null);
                                setForm({ name: '', jobNumber: '', address: '', gc: '', units: '', email: '' });
                            }}>
                                <Ionicons name="close" size={24} color="#9ca3af" />
                            </TouchableOpacity>
                        </View>

                        {/* Form Fields */}
                        <ScrollView className="p-6 max-h-[600px]">
                            {/* Project Name */}
                            <Text className="text-xs font-bold text-gray-500 mb-1 ml-1">Project Name</Text>
                            <TextInput
                                className="border border-gray-200 rounded-lg p-3 mb-4 text-base bg-white focus:border-blue-500 outline-none"
                                value={form.name}
                                onChangeText={(t) => setForm({ ...form, name: t })}
                                placeholder="e.g. Skyline Tower"
                            />

                            {/* Job Number */}
                            <Text className="text-xs font-bold text-gray-500 mb-1 ml-1">Job Number</Text>
                            <TextInput
                                className="border border-gray-200 rounded-lg p-3 mb-4 text-base bg-white focus:border-blue-500 outline-none"
                                value={form.jobNumber}
                                onChangeText={(t) => setForm({ ...form, jobNumber: t })}
                                placeholder="e.g. 25-104"
                            />

                            {/* Address */}
                            <Text className="text-xs font-bold text-gray-500 mb-1 ml-1">Address</Text>
                            <TextInput
                                className="border border-gray-200 rounded-lg p-3 mb-4 text-base bg-white focus:border-blue-500 outline-none"
                                value={form.address}
                                onChangeText={(t) => setForm({ ...form, address: t })}
                                placeholder="e.g. 123 Main St, New York, NY"
                            />

                            {/* General Contractor */}
                            <Text className="text-xs font-bold text-gray-500 mb-1 ml-1">General Contractor</Text>
                            <TextInput
                                className="border border-gray-200 rounded-lg p-3 mb-4 text-base bg-white focus:border-blue-500 outline-none"
                                value={form.gc}
                                onChangeText={(t) => setForm({ ...form, gc: t })}
                                placeholder="e.g. Turner Construction"
                            />

                            {/* Total Units */}
                            <Text className="text-xs font-bold text-gray-500 mb-1 ml-1">Total Units</Text>
                            <TextInput
                                className="border border-gray-200 rounded-lg p-3 mb-4 text-base bg-white focus:border-blue-500 outline-none"
                                value={form.units}
                                onChangeText={(t) => setForm({ ...form, units: t })}
                                placeholder="e.g. 150"
                                keyboardType="numeric"
                            />

                            {/* Foreman Email */}
                            <Text className="text-xs font-bold text-gray-500 mb-1 ml-1">Foreman Email (Optional)</Text>
                            <TextInput
                                className="border border-gray-200 rounded-lg p-3 mb-2 text-base bg-white focus:border-blue-500 outline-none"
                                value={form.email}
                                onChangeText={(t) => setForm({ ...form, email: t })}
                                placeholder="foreman@jantile.com"
                                keyboardType="email-address"
                            />
                        </ScrollView>

                        {/* Footer Buttons */}
                        <View className="px-6 py-4 border-t border-gray-100 flex-row justify-end gap-3 bg-gray-50">
                            <TouchableOpacity
                                onPress={() => {
                                    setModalVisible(false);
                                    setEditingJobId(null);
                                    setForm({ name: '', jobNumber: '', address: '', gc: '', units: '', email: '' });
                                }}
                                className="px-4 py-2 rounded-lg"
                            >
                                <Text className="text-gray-600 font-bold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveJob}
                                className="bg-[#2563eb] px-6 py-2 rounded-lg shadow-sm"
                            >
                                <Text className="text-white font-bold">
                                    {editingJobId ? 'Save Changes' : 'Create Job'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}



