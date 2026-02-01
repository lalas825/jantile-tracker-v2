import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { AlertTriangle, Clock, CheckCircle2, ChevronRight, Filter, Search } from 'lucide-react-native';
import { SupabaseService, JobIssue } from '../../services/SupabaseService';

export default function FieldScreen() {
    const router = useRouter();
    const [issues, setIssues] = useState<JobIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'open' | 'resolved'>('open');
    const [refreshing, setRefreshing] = useState(false);

    const loadIssues = async () => {
        try {
            const data = await SupabaseService.getJobIssues();
            setIssues(data);
        } catch (error) {
            console.error("Failed to load global issues:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { loadIssues(); }, []));

    const filteredIssues = issues.filter(i => i.status === filter);

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-600 bg-red-50 border-red-100';
            case 'Medium': return 'text-orange-600 bg-orange-50 border-orange-100';
            case 'Low': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* HEADER */}
            <View className="px-6 py-6 bg-white border-b border-slate-200">
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Central Hub</Text>
                        <Text className="text-3xl font-bold text-slate-900">Job Issues</Text>
                    </View>
                    <TouchableOpacity className="p-2 bg-slate-100 rounded-full">
                        <Search size={20} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* FILTER TABS */}
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={() => setFilter('open')}
                        className={`px-4 py-2 rounded-lg border flex-row items-center gap-2 ${filter === 'open' ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
                    >
                        <AlertTriangle size={16} color={filter === 'open' ? 'white' : '#64748b'} />
                        <Text className={`font-bold text-sm ${filter === 'open' ? 'text-white' : 'text-slate-600'}`}>
                            Open ({issues.filter(i => i.status === 'open').length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setFilter('resolved')}
                        className={`px-4 py-2 rounded-lg border flex-row items-center gap-2 ${filter === 'resolved' ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
                    >
                        <CheckCircle2 size={16} color={filter === 'resolved' ? 'white' : '#64748b'} />
                        <Text className={`font-bold text-sm ${filter === 'resolved' ? 'text-white' : 'text-slate-600'}`}>
                            Resolved ({issues.filter(i => i.status === 'resolved').length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ISSUES LIST */}
            <ScrollView
                className="flex-1 px-4 pt-4"
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadIssues(); }} />}
            >
                {filteredIssues.length === 0 ? (
                    <View className="py-20 items-center justify-center">
                        <View className="bg-slate-100 p-6 rounded-full mb-4">
                            <CheckCircle2 size={48} color="#94a3b8" />
                        </View>
                        <Text className="text-slate-500 font-bold text-lg">No {filter} issues found</Text>
                        <Text className="text-slate-400 text-sm mt-1 text-center px-10">
                            {filter === 'open' ? "Great! All job sites are currently running smoothly." : "Resolved issues will appear here for your records."}
                        </Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap gap-4">
                        {filteredIssues.map((issue) => (
                            <TouchableOpacity
                                key={issue.id}
                                onPress={() => router.push(`/job-issues/${issue.id}` as any)}
                                activeOpacity={0.7}
                                style={Platform.OS === 'web' ? { width: '24%', minWidth: 280 } : { width: '100%' }}
                                className="bg-white p-5 rounded-2xl mb-4 border border-slate-200 shadow-sm"
                            >
                                <View className="flex-row justify-between items-start mb-3">
                                    <View className="flex-1 mr-4">
                                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                                            {issue.job_name}
                                            {issue.floor_name && ` • ${issue.floor_name}`}
                                            {issue.unit_name && ` • ${issue.unit_name}`}
                                            {issue.area_name && ` • ${issue.area_name}`}
                                        </Text>
                                        <Text className="text-lg font-bold text-slate-900 leading-tight">{issue.type}</Text>
                                    </View>
                                    <View className={`px-2 py-1 rounded border ${getPriorityColor(issue.priority)}`}>
                                        <Text className="text-[10px] font-black uppercase tracking-tighter">{issue.priority}</Text>
                                    </View>
                                </View>

                                <Text className="text-slate-600 text-sm mb-4 line-clamp-2" numberOfLines={2}>
                                    {issue.description}
                                </Text>

                                <View className="flex-row items-center justify-between pt-4 border-t border-slate-50">
                                    <View className="flex-1">
                                        <View className="flex-row items-center gap-4 mb-2">
                                            <View className="flex-row items-center gap-1.5">
                                                <Clock size={12} color="#94a3b8" />
                                                <Text className="text-slate-400 text-[10px]">{new Date(issue.created_at).toLocaleDateString()}</Text>
                                            </View>
                                            <Text className="text-slate-400 text-[10px] font-bold uppercase">BY: {issue.created_by}</Text>
                                        </View>

                                        {issue.status === 'open' && (
                                            <TouchableOpacity
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    SupabaseService.updateIssueStatus(issue.id, 'resolved').then(() => loadIssues());
                                                }}
                                                className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 self-start mt-1 flex-row items-center gap-1.5"
                                            >
                                                <CheckCircle2 size={12} color="#059669" />
                                                <Text className="text-emerald-700 text-[10px] font-black uppercase">Mark Resolved</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <ChevronRight size={18} color="#cbd5e1" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

