import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MockJobStore } from '../../../services/MockJobStore';
import ProductionTab from '../../../components/jobs/ProductionTab';

// 1. DEFINE THE NEW MENU STRUCTURE
const TABS = [
    { id: 'PRODUCTION', label: 'Production', icon: 'layers' },
    { id: 'OFFICE', label: 'Office', icon: 'briefcase' },
    { id: 'JOBSITE', label: 'Job Site', icon: 'construct' },
    { id: 'ISSUES', label: 'Job Issues', icon: 'alert-circle' },
    { id: 'SAFETY', label: 'Safety', icon: 'shield-checkmark' },
    { id: 'DOCUMENTS', label: 'Documents', icon: 'document-text' },
    { id: 'PUNCHLIST', label: 'Punchlist', icon: 'checkbox' },
    { id: 'PAYROLL', label: 'Payroll', icon: 'cash' },
    { id: 'ANALYTICS', label: 'Analytics', icon: 'bar-chart' },
];

export default function JobDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [job, setJob] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('PRODUCTION'); // Default to Production
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate fetching data
        const fetchedJob = MockJobStore.getJob(id as string);
        if (fetchedJob) {
            setJob(fetchedJob);
        }
        setLoading(false);
    }, [id]);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    if (!job) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <Text className="text-slate-500">Job not found.</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-blue-600 font-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // 2. RENDER CONTENT BASED ON TAB
    const renderContent = () => {
        switch (activeTab) {
            case 'PRODUCTION':
                return <ProductionTab job={job} setJob={setJob} />;
            default:
                // Placeholder for the new tabs
                return (
                    <View className="flex-1 justify-center items-center p-10 bg-slate-50 mt-10 rounded-2xl border border-dashed border-slate-300 mx-4">
                        <View className="bg-slate-100 p-6 rounded-full mb-4">
                            <Ionicons
                                name={TABS.find(t => t.id === activeTab)?.icon as any}
                                size={48}
                                color="#94a3b8"
                            />
                        </View>
                        <Text className="text-xl font-bold text-slate-700 mb-2">
                            {TABS.find(t => t.id === activeTab)?.label}
                        </Text>
                        <Text className="text-slate-400 text-center">
                            This module is under development.{"\n"}Check back soon for updates.
                        </Text>
                    </View>
                );
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            {/* HEADER */}
            <View className="px-4 py-3 border-b border-slate-100 bg-white flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-50 rounded-full">
                        <Ionicons name="arrow-back" size={20} color="#334155" />
                    </TouchableOpacity>
                    <View>
                        <View className="flex-row items-center gap-2">
                            <Text className="text-xl font-bold text-slate-900">{job.name}</Text>
                            <View className="bg-blue-100 px-2 py-0.5 rounded">
                                <Text className="text-blue-700 text-[10px] font-bold">#{job.id}</Text>
                            </View>
                        </View>
                        <Text className="text-slate-500 text-xs">{job.location}</Text>
                    </View>
                </View>

                <TouchableOpacity className="p-2">
                    <Ionicons name="ellipsis-horizontal" size={20} color="#64748b" />
                </TouchableOpacity>
            </View>

            {/* SCROLLABLE TAB BAR */}
            <View className="border-b border-slate-200 bg-white">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                >
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => setActiveTab(tab.id)}
                            className={`mr-6 py-3 border-b-2 ${activeTab === tab.id ? 'border-blue-600' : 'border-transparent'
                                }`}
                        >
                            <View className="flex-row items-center gap-2">
                                <Ionicons
                                    name={tab.icon as any}
                                    size={16}
                                    color={activeTab === tab.id ? '#2563eb' : '#64748b'}
                                />
                                <Text
                                    className={`text-sm font-semibold ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-500'
                                        }`}
                                >
                                    {tab.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* CONTENT AREA */}
            <View className="flex-1 bg-slate-50">
                {renderContent()}
            </View>
        </SafeAreaView>
    );
}
