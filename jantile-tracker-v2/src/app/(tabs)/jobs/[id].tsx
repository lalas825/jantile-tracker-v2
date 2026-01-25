import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import clsx from 'clsx';
import ProductionTab from '../../../components/jobs/ProductionTab';
import { MockJobStore, Job } from '../../../services/MockJobStore';

const TABS = ['Overview', 'Production', 'Logistics', 'Files'];

export default function JobHubScreen() {
    const { id } = useLocalSearchParams();
    const [activeTab, setActiveTab] = useState('Production');
    const [job, setJob] = useState<Job | null>(null);

    // Fetch Job Data on Focus
    useFocusEffect(
        useCallback(() => {
            const fetchedJob = MockJobStore.getJob(id as string || '101');
            if (fetchedJob) {
                setJob(fetchedJob);
            }
        }, [id])
    );

    const handleSync = () => {
        // In a real app, this would pull from API. 
        // Here we just re-fetch from our 'local' store to simulate a refresh.
        const fetchedJob = MockJobStore.getJob(id as string || '101');
        if (fetchedJob) setJob({ ...fetchedJob });
    };

    if (!job) return <View className="flex-1 bg-white items-center justify-center"><Text>Loading Job...</Text></View>;

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* 1. Header Section */}
            <View className="bg-white px-4 pt-4 pb-4 border-b border-slate-200">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1 mr-4">
                        <Text className="text-2xl font-bold text-slate-900 leading-tight">
                            {job.name} <Text className="text-slate-400 font-normal">#{job.id}</Text>
                        </Text>
                        <Text className="text-slate-500 text-xs mt-1" numberOfLines={2}>{job.address}</Text>

                        {/* Overall Job Progress */}
                        <View className="flex-row items-center mt-3">
                            <View className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden mr-2">
                                <View
                                    className="h-full bg-green-600 rounded-full"
                                    style={{ width: `${job.progress}%` }}
                                />
                            </View>
                            <Text className="text-slate-700 font-bold text-xs">{job.progress}% Complete</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={handleSync}
                        className="flex-row items-center border border-slate-300 rounded-lg px-3 py-1.5"
                    >
                        <RefreshCw size={14} color="#64748b" className="mr-1.5" />
                        <Text className="text-slate-600 text-xs font-semibold">Sync</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. Sticky Segmented Control */}
            <View className="bg-white border-b border-slate-200">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                    className="flex-row"
                >
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            className={clsx(
                                "padding-vertical-3 mr-6 border-b-2 py-3",
                                activeTab === tab ? "border-red-700" : "border-transparent"
                            )}
                        >
                            <Text className={clsx(
                                "text-sm font-medium",
                                activeTab === tab ? "text-red-700" : "text-slate-500"
                            )}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* 3. Content Area */}
            <View className="flex-1">
                {activeTab === 'Production' ? (
                    <ProductionTab />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <Text className="text-slate-400">Content for {activeTab} coming soon...</Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
