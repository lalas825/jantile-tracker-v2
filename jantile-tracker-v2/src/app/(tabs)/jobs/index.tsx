import React, { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Alert, RefreshControl, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MockJobStore } from '../../../services/MockJobStore';

export default function JobsListScreen() {
    const router = useRouter();
    const [jobs, setJobs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // MODAL STATE
    const [modalVisible, setModalVisible] = useState(false);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);

    // FORM FIELDS
    const [formName, setFormName] = useState('');
    const [formLocation, setFormLocation] = useState('');
    const [formGC, setFormGC] = useState('');
    const [formUnits, setFormUnits] = useState('');
    const [formEmail, setFormEmail] = useState('');

    const loadJobs = () => {
        const allJobs = MockJobStore.getAllJobs();
        setJobs([...allJobs]);
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadJobs();
        }, [])
    );

    // --- ACTIONS ---

    const handleSaveJob = () => {
        if (!formName.trim() || !formLocation.trim()) {
            if (Platform.OS === 'web') {
                alert("Missing Info: Please enter at least a Job Name and Address.");
            } else {
                Alert.alert("Missing Info", "Please enter at least a Job Name and Address.");
            }
            return;
        }

        if (editingJobId) {
            // Update Existing
            MockJobStore.updateJob(editingJobId, formName, formLocation, formGC, formUnits, formEmail);
        } else {
            // Create New
            MockJobStore.addJob(formName, formLocation, formGC, formUnits, formEmail);
        }

        setModalVisible(false);
        loadJobs();
        resetForm();
    };

    const handleDeleteJob = (id: string) => {
        if (Platform.OS === 'web') {
            // WEB CONFIRMATION
            if (confirm("Are you sure you want to delete this job? This cannot be undone.")) {
                MockJobStore.deleteJob(id);
                loadJobs();
            }
        } else {
            // MOBILE CONFIRMATION
            Alert.alert("Delete Job?", "Are you sure? This will remove all data for this project.", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        MockJobStore.deleteJob(id);
                        loadJobs();
                    }
                }
            ]);
        }
    };

    const openNewJobModal = () => {
        resetForm();
        setModalVisible(true);
    };

    const openEditModal = (job: any) => {
        setEditingJobId(job.id);
        setFormName(job.name);
        setFormLocation(job.location);
        setFormGC(job.generalContractor || '');
        setFormUnits(job.totalUnits || '');
        setFormEmail(job.foremanEmail || '');
        setModalVisible(true);
    };

    const resetForm = () => {
        setEditingJobId(null);
        setFormName('');
        setFormLocation('');
        setFormGC('');
        setFormUnits('');
        setFormEmail('');
    };

    // Filter Jobs
    const filteredJobs = jobs.filter(j =>
        j.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-50">

            {/* HEADER */}
            <View className="bg-white px-4 py-3 border-b border-slate-200 flex-row justify-between items-center">
                <Text className="text-2xl font-bold text-slate-800">Projects</Text>
                <TouchableOpacity
                    onPress={openNewJobModal}
                    className="bg-red-600 px-4 py-2 rounded-lg flex-row items-center gap-2"
                >
                    <Ionicons name="add" size={20} color="white" />
                    <Text className="text-white font-bold text-sm">New Job</Text>
                </TouchableOpacity>
            </View>

            {/* SEARCH BAR */}
            <View className="px-4 py-3 bg-white border-b border-slate-100">
                <View className="flex-row items-center bg-slate-100 rounded-lg px-3 py-2">
                    <Ionicons name="search" size={20} color="#94a3b8" />
                    <TextInput
                        placeholder="Search projects..."
                        className="flex-1 ml-2 text-slate-700"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {/* JOB LIST */}
            <ScrollView
                contentContainerStyle={{ padding: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadJobs} />}
            >
                {filteredJobs.length === 0 ? (
                    <View className="items-center py-10">
                        <Text className="text-slate-400">No projects found.</Text>
                    </View>
                ) : (
                    filteredJobs.map((job) => (
                        <View
                            key={job.id}
                            className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden"
                        >
                            {/* Card Header */}
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => router.push(`/jobs/${job.id}`)}
                                className="p-4"
                            >
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1">
                                        <Text className="text-lg font-bold text-slate-900 mb-1">{job.name}</Text>
                                        <View className="flex-row items-center gap-1 mb-1">
                                            <Ionicons name="location-outline" size={14} color="#64748b" />
                                            <Text className="text-slate-500 text-xs">{job.location}</Text>
                                        </View>
                                        {/* Show GC if exists */}
                                        {job.generalContractor ? (
                                            <Text className="text-slate-400 text-[10px] uppercase font-bold">{job.generalContractor}</Text>
                                        ) : null}
                                    </View>
                                    <View className={`px-2 py-1 rounded text-xs font-bold ${job.progress === 100 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                        <Text className={`text-xs font-bold ${job.progress === 100 ? 'text-green-700' : 'text-blue-700'}`}>
                                            {job.progress === 100 ? 'COMPLETED' : 'ACTIVE'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                <View className="mt-4">
                                    <View className="flex-row justify-between mb-1">
                                        <Text className="text-xs text-slate-400 font-medium">Progress</Text>
                                        <Text className="text-xs text-slate-800 font-bold">{job.progress || 0}%</Text>
                                    </View>
                                    <View className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <View
                                            className="h-full bg-blue-600 rounded-full"
                                            style={{ width: `${job.progress || 0}%` }}
                                        />
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* ACTION FOOTER */}
                            <View className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex-row justify-between items-center">
                                <View className="flex-row gap-4">
                                    <View className="flex-row items-center gap-1">
                                        <Ionicons name="layers-outline" size={16} color="#64748b" />
                                        <Text className="text-xs text-slate-500 font-medium">{job.floors?.length || 0} Floors</Text>
                                    </View>
                                    {job.totalUnits ? (
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="cube-outline" size={16} color="#64748b" />
                                            <Text className="text-xs text-slate-500 font-medium">{job.totalUnits} Units</Text>
                                        </View>
                                    ) : null}
                                </View>

                                {/* Edit / Delete Buttons */}
                                <View className="flex-row gap-3">
                                    <TouchableOpacity onPress={() => openEditModal(job)} className="p-1">
                                        <Ionicons name="create-outline" size={20} color="#3b82f6" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteJob(job.id)} className="p-1">
                                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* CREATE / EDIT MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 justify-end bg-black/50"
                >
                    <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-slate-900">
                                {editingJobId ? 'Edit Project' : 'New Project'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close-circle" size={30} color="#cbd5e1" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ gap: 16 }}>
                            <View>
                                <Text className="text-slate-500 text-xs font-bold uppercase mb-2">Project Name</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 text-base"
                                    placeholder="e.g. Skyline Tower"
                                    value={formName}
                                    onChangeText={setFormName}
                                />
                            </View>

                            <View>
                                <Text className="text-slate-500 text-xs font-bold uppercase mb-2">Address</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 text-base"
                                    placeholder="e.g. 123 Main St"
                                    value={formLocation}
                                    onChangeText={setFormLocation}
                                />
                            </View>

                            <View>
                                <Text className="text-slate-500 text-xs font-bold uppercase mb-2">General Contractor</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 text-base"
                                    placeholder="e.g. Turner Construction"
                                    value={formGC}
                                    onChangeText={setFormGC}
                                />
                            </View>

                            <View>
                                <Text className="text-slate-500 text-xs font-bold uppercase mb-2">Total Units</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 text-base"
                                    placeholder="e.g. 150"
                                    keyboardType="numeric"
                                    value={formUnits}
                                    onChangeText={setFormUnits}
                                />
                            </View>

                            <View>
                                <Text className="text-slate-500 text-xs font-bold uppercase mb-2">Foreman Email (Optional)</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 text-base"
                                    placeholder="foreman@jantile.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={formEmail}
                                    onChangeText={setFormEmail}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleSaveJob}
                                className="bg-blue-600 rounded-xl p-4 items-center mt-4 shadow-sm shadow-blue-200 mb-10"
                            >
                                <Text className="text-white font-bold text-lg">
                                    {editingJobId ? 'Update Project' : 'Create Job'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </SafeAreaView>
    );
}
