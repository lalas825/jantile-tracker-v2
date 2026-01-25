import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Search, Plus, MapPin, Layers, Box } from 'lucide-react-native';
import clsx from 'clsx';
import { MockJobStore, Job } from '../../services/MockJobStore';

const JobCard = ({ job, onPress }: { job: Job; onPress: (id: string) => void }) => {
    // Derived stats for the card
    const floorsCount = job.floors ? job.floors.length : 0;
    const unitsCount = job.floors ? job.floors.reduce((acc, f) => acc + f.units.length, 0) : 0;

    // Simulate status based on progress for now
    const status = job.progress === 100 ? 'Completed' : job.progress > 0 ? 'Active' : 'Pending';

    return (
        <TouchableOpacity
            onPress={() => onPress(job.id)}
            className="bg-white p-4 mb-3 rounded-xl border border-slate-200 shadow-sm"
        >
            {/* Top Row: Name & Status */}
            <View className="flex-row justify-between items-start mb-2">
                <Text className="text-lg font-bold text-slate-900 flex-1 mr-2" numberOfLines={1}>
                    {job.name}
                </Text>
                <View className={clsx(
                    "px-2 py-0.5 rounded-full",
                    status === 'Active' ? "bg-green-100" :
                        status === 'Pending' ? "bg-slate-100" : "bg-blue-100"
                )}>
                    <Text className={clsx(
                        "text-xs font-semibold",
                        status === 'Active' ? "text-green-700" :
                            status === 'Pending' ? "text-slate-600" : "text-blue-700"
                    )}>
                        {status.toUpperCase()}
                    </Text>
                </View>
            </View>

            {/* Middle Row: Address + ID */}
            <View className="flex-row items-center mb-3">
                <MapPin size={14} color="#64748b" className="mr-1" />
                <Text className="text-slate-500 text-xs flex-1 mr-2" numberOfLines={1}>
                    {job.address}
                </Text>
                <Text className="text-slate-400 text-xs font-mono">#{job.id}</Text>
            </View>

            {/* Stats Row */}
            <View className="flex-row items-center space-x-3 mb-3">
                <View className="flex-row items-center bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    <Layers size={14} color="#475569" className="mr-1.5" />
                    <Text className="text-slate-600 text-xs font-medium">{floorsCount} Floors</Text>
                </View>
                <View className="flex-row items-center bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    <Box size={14} color="#475569" className="mr-1.5" />
                    <Text className="text-slate-600 text-xs font-medium">{unitsCount} Units</Text>
                </View>
            </View>

            {/* Bottom: Progress Bar */}
            <View className="mt-1">
                <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-slate-400 font-medium">Progress</Text>
                    <Text className="text-xs text-blue-600 font-bold">{job.progress}%</Text>
                </View>
                <View className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <View
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${job.progress}%` }}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default function JobsScreen() {
    const router = useRouter();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Load jobs on focus to ensure we have the latest updates from the Detail screens
    useFocusEffect(
        useCallback(() => {
            setJobs(MockJobStore.getAllJobs());
        }, [])
    );

    const filteredJobs = jobs.filter(job =>
        job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.id.includes(searchQuery)
    );

    const handleNewJob = () => {
        console.log("Open Create Modal");
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50 pt-2" edges={['top']}>
            {/* Header Section */}
            <View className="px-4 pb-4 bg-slate-50">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-3xl font-bold text-slate-900 tracking-tight">Projects</Text>
                    <TouchableOpacity
                        onPress={handleNewJob}
                        className="flex-row items-center bg-red-700 px-4 py-2 rounded-lg shadow-sm active:bg-red-800"
                    >
                        <Plus size={18} color="white" className="mr-1" />
                        <Text className="text-white font-bold text-sm">New Job</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
                    <Search size={20} color="#94a3b8" />
                    <TextInput
                        placeholder="Search projects..."
                        placeholderTextColor="#94a3b8"
                        className="flex-1 ml-2 text-slate-900 text-base"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {/* Job List */}
            <FlatList
                data={filteredJobs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <JobCard
                        job={item}
                        onPress={(id) => router.push(`/jobs/${id}` as any)}
                    />
                )}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View className="items-center justify-center py-10">
                        <Text className="text-slate-400 text-base">No projects found</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}
