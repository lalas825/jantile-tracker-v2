import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService } from '../../../services/SupabaseService';
import ProductionTab from '../../../components/jobs/ProductionTab';
import LogisticsTab from '../../../components/jobs/LogisticsTab';

const TABS = [
    { id: 'PRODUCTION', label: 'Production', icon: 'layers' },
    { id: 'LOGISTICS', label: 'Logistics', icon: 'cube' },
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

    const fetchJob = React.useCallback(async () => {
        const fetchedJob = await SupabaseService.getJob(id as string);
        if (fetchedJob) {
            setJob(fetchedJob);
        }
        setLoading(false);
    }, [id]);

    useEffect(() => {
        fetchJob();
    }, [fetchJob]);

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
            case 'LOGISTICS':
                // Optimistic UI updates for Logistics
                return (
                    <LogisticsTab
                        job={job}
                        onRefreshJob={fetchJob}
                        onAreaUpdated={(areaId, updates) => {
                            // OPTIMISTIC UPDATE: Mutate local state immediately
                            const newJob = { ...job };
                            if (newJob.floors) {
                                newJob.floors.forEach((f: any) => {
                                    if (f.units) {
                                        f.units.forEach((u: any) => {
                                            if (u.areas) {
                                                const area = u.areas.find((a: any) => a.id === areaId);
                                                if (area) {
                                                    // Apply updates
                                                    Object.assign(area, updates);
                                                }
                                            }
                                        });
                                    }
                                });
                            }
                            setJob(newJob);
                        }}
                    />
                );
            case 'ISSUES':
            case 'ISSUES':
                return <JobIssuesTab jobId={job.id} />;
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
            <View className="px-6 py-4 border-b border-slate-100 bg-white flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                    <TouchableOpacity
                        onPress={() => router.push('/jobs')}
                        className="p-2.5 bg-slate-50 rounded-xl active:bg-slate-100"
                    >
                        <Ionicons name="arrow-back" size={20} color="#334155" />
                    </TouchableOpacity>
                    <View>
                        <View className="flex-row items-center gap-2">
                            <Text className="text-2xl font-black text-slate-900 tracking-tight">{job.name}</Text>
                        </View>
                        <View className="flex-row items-center gap-2 mt-0.5">
                            <Text className="text-slate-500 text-xs font-bold">{job.general_contractor || 'No GC'}</Text>
                            <Text className="text-slate-300 text-xs">•</Text>
                            <Text className="text-slate-500 text-xs">{job.address || 'No Address'}</Text>
                            {job.floors && (
                                <>
                                    <Text className="text-slate-300 text-xs">•</Text>
                                    <Text className="text-slate-500 text-xs font-semibold">
                                        {job.floors.length} Floors
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                <TouchableOpacity className="p-2 bg-slate-50 rounded-full active:bg-slate-100">
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

// 3. JOB ISSUES TAB COMPONENT
function JobIssuesTab({ jobId }: { jobId: string }) {
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const loadIssues = async () => {
            try {
                const data = await SupabaseService.getJobIssues(jobId);
                setIssues(data);
            } catch (err) {
                console.error("Failed to load job issues:", err);
            } finally {
                setLoading(false);
            }
        };
        loadIssues();
    }, [jobId]);

    if (loading) return <ActivityIndicator className="py-20" color="#3b82f6" />;

    return (
        <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-slate-900 font-bold text-lg">Job Activity Feed</Text>
                <View className="bg-blue-100 px-3 py-1 rounded-full">
                    <Text className="text-blue-700 font-bold text-xs">{issues.length} Total</Text>
                </View>
            </View>

            {issues.length === 0 ? (
                <View className="py-20 items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200">
                    <Ionicons name="shield-checkmark" size={48} color="#94a3b8" />
                    <Text className="text-slate-500 font-bold mt-4">No reported issues</Text>
                    <Text className="text-slate-400 text-xs mt-1">This job site is running smoothly.</Text>
                </View>
            ) : (
                <View className="flex-row flex-wrap gap-4">
                    {issues.map(issue => (
                        <TouchableOpacity
                            key={issue.id}
                            onPress={() => router.push(`/job-issues/${issue.id}` as any)}
                            style={Platform.OS === 'web' ? { width: '22%', minWidth: 280 } : { width: '100%' }}
                            className="bg-white p-5 rounded-2xl mb-4 border border-slate-200 shadow-sm"
                        >
                            <View className="flex-row justify-between items-start mb-3">
                                <View className="flex-1 mr-4">
                                    <View className={`px-2 py-0.5 rounded border self-start mb-2 ${issue.status === 'open' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <Text className={`text-[9px] font-black uppercase ${issue.status === 'open' ? 'text-red-600' : 'text-emerald-700'}`}>{issue.status}</Text>
                                    </View>
                                    <View className="flex-row flex-wrap items-center">
                                        <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                            {issue.job_name}
                                            {issue.floor_name && ` • ${issue.floor_name}`}
                                            {issue.unit_name && ` • ${issue.unit_name}`}
                                            {issue.area_name && ` • ${issue.area_name}`}
                                        </Text>
                                    </View>
                                    <Text className="font-bold text-slate-900 mt-1">{issue.type}</Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-[10px] text-slate-400 font-bold">{new Date(issue.created_at).toLocaleDateString()}</Text>
                                    <Text className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 whitespace-nowrap">PRIORITY: {issue.priority}</Text>
                                </View>
                            </View>
                            <Text className="text-slate-600 text-xs mb-4" numberOfLines={2}>{issue.description}</Text>

                            <View className="flex-row items-center justify-between pt-3 border-t border-slate-50">
                                <View className="flex-1">
                                    <Text className="text-[10px] text-slate-400 font-bold mb-2">BY: {issue.created_by}</Text>
                                    {issue.status === 'open' && (
                                        <TouchableOpacity
                                            onPress={async (e) => {
                                                e.stopPropagation();
                                                await SupabaseService.updateIssueStatus(issue.id, 'resolved');
                                                const data = await SupabaseService.getJobIssues(jobId);
                                                setIssues(data);
                                            }}
                                            className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 self-start mt-1 flex-row items-center gap-1.5"
                                        >
                                            <Ionicons name="checkmark-circle" size={12} color="#059669" />
                                            <Text className="text-emerald-700 text-[10px] font-black uppercase">Mark Resolved</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}
