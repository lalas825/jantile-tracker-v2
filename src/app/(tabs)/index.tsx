import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StatusBar, Image, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { SupabaseService } from '../../services/SupabaseService';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@powersync/react';


// --- CHART COMPONENT ---
const DonutChart = ({ percentage, radius = 40, strokeWidth = 10, color = "#3b82f6" }: any) => {
    const circumference = 2 * Math.PI * radius;
    const halfCircle = radius + strokeWidth;
    const strokeDashoffset = circumference - (circumference * percentage) / 100;

    return (
        <View style={{ width: halfCircle * 2, height: halfCircle * 2, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={halfCircle * 2} height={halfCircle * 2} viewBox={`0 0 ${halfCircle * 2} ${halfCircle * 2}`}>
                <G rotation="-90" origin={`${halfCircle}, ${halfCircle}`}>
                    {/* Background Circle */}
                    <Circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="transparent"
                        stroke="#334155" // Dark Slate
                        strokeWidth={strokeWidth}
                        strokeOpacity={0.5}
                    />
                    {/* Progress Circle */}
                    <Circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                    />
                </G>
            </Svg>
            {/* Text Inside */}
            <View className="absolute items-center justify-center">
                <Text className="text-white font-outfit font-black text-xl">{Math.round(percentage)}%</Text>
            </View>
        </View>
    );
};

export default function Dashboard() {
    const { profile, user } = useAuth();
    const router = useRouter();
    const [jobs, setJobs] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // --- POWER SYNC REAL-TIME TELEMETRY ---
    const { data: openIssuesCount } = useQuery("SELECT count(*) as count FROM job_issues WHERE status = 'open'");
    const { data: resolvedIssuesCount } = useQuery("SELECT count(*) as count FROM job_issues WHERE status = 'resolved'");
    const { data: rejectedTicketsCount } = useQuery("SELECT count(*) as count FROM delivery_tickets WHERE status = 'REJECTED'");
    const { data: manpowerCount } = useQuery("SELECT count(*) as count FROM crew_checkins WHERE check_out IS NULL");
    const { data: progressData } = useQuery("SELECT avg(progress) as avg_progress FROM areas");
    const { data: activeJobsCount } = useQuery("SELECT count(*) as count FROM jobs WHERE status = 'Active'");

    // --- WEB FALLBACKS (Supabase direct) ---
    const [webStats, setWebStats] = useState({ openIssues: 0, resolvedIssues: 0, rejectedTickets: 0, manpower: 0, avgProgress: 0, activeJobs: 0 });

    const stats = Platform.OS === 'web' ? webStats : {
        openIssues: (openIssuesCount?.[0] as any)?.count || 0,
        resolvedIssues: (resolvedIssuesCount?.[0] as any)?.count || 0,
        rejectedTickets: (rejectedTicketsCount?.[0] as any)?.count || 0,
        manpower: (manpowerCount?.[0] as any)?.count || 0,
        avgProgress: (progressData?.[0] as any)?.avg_progress || 0,
        activeJobs: (activeJobsCount?.[0] as any)?.count || 0
    };

    const loadData = async () => {
        try {
            const activeJobs = await SupabaseService.getActiveJobs();
            const mappedJobs = activeJobs.map(job => ({
                id: job.id,
                name: job.name,
                location: 'Location Pending',
                status: job.status,
                progress: 0,
                floors: []
            }));
            setJobs(mappedJobs);

            // Web: Supabase direct telemetry
            if (Platform.OS === 'web') {
                const sb = SupabaseService.supabase;

                // 1. Avg Progress: Compute from nested areas in activeJobs
                let totalAreas = 0;
                let totalProgress = 0;
                activeJobs.forEach((job: any) => {
                    job.floors?.forEach((f: any) => {
                        f.units?.forEach((u: any) => {
                            u.areas?.forEach((a: any) => {
                                if (a.progress != null) {
                                    totalAreas++;
                                    totalProgress += a.progress;
                                }
                            });
                        });
                    });
                });
                const avgProgress = totalAreas > 0 ? Math.round(totalProgress / totalAreas) : 0;

                // 2. Open Issues
                let openIssues = 0;
                try {
                    openIssues = await SupabaseService.getGlobalOpenIssuesCount();
                } catch (e) {
                    console.error('Failed to get open issues count', e);
                }

                // 3. Rejected Tickets
                let rejectedTickets = 0;
                try {
                    const { count, error } = await sb.from('delivery_tickets').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED');
                    if (!error) rejectedTickets = count || 0;
                } catch (e) { }

                // 4. Manpower (Workers with assigned jobs)
                let manpower = 0;
                try {
                    const { data, error } = await sb.from('workers').select('id, assigned_job_ids');
                    if (!error && data) {
                        manpower = data.filter((w: any) => {
                            const ids = w.assigned_job_ids;
                            return ids && ids !== '' && ids !== '[]';
                        }).length;
                    }
                } catch (e) { }

                setWebStats({
                    openIssues,
                    resolvedIssues: 0,
                    rejectedTickets,
                    manpower,
                    avgProgress,
                    activeJobs: activeJobs.length,
                });
            }
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        }
        setRefreshing(false);
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
            >
                {/* HEADER */}
                <View className="mb-6 mt-2 flex-row justify-between items-end">
                    <View>
                        <Text className="text-slate-500 text-xs font-inter font-bold uppercase tracking-wider mb-1">Overview</Text>
                        <Text className="text-3xl font-outfit font-black text-slate-900">Dashboard</Text>
                    </View>
                    <View className="flex-row items-center gap-4">
                        <View className="items-end">
                            <Text className="text-slate-400 text-[10px] font-inter font-bold uppercase tracking-widest">Welcome back</Text>
                            <Text className="text-xl font-outfit font-black text-slate-900 tracking-tight">
                                {profile?.full_name || user?.email?.split('@')[0] || 'User'}
                            </Text>
                        </View>
                        <Image
                            source={{ uri: `https://ui-avatars.com/api/?name=${profile?.full_name || user?.email || 'User'}&background=0D8ABC&color=fff` }}
                            className="w-10 h-10 rounded-full bg-slate-200"
                        />
                    </View>
                </View>

                {/* 1. PORTFOLIO SUMMARY CARD */}
                <View className="bg-slate-900 rounded-3xl shadow-lg mb-6 overflow-hidden">
                    <View className="flex-row p-6 items-center">
                        {/* Left Side: Stats */}
                        <View className="flex-1 pr-4">
                            <Text className="text-slate-400 text-[10px] font-inter font-bold uppercase mb-1 tracking-widest">Overall Progress</Text>
                            <Text className="text-white text-3xl font-outfit font-black mb-6">On Track</Text>

                            <View className="gap-3">
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="briefcase" size={16} color="#94a3b8" />
                                    <View>
                                        <Text className="text-white text-[24px] font-inter font-black">
                                            {stats.activeJobs}
                                        </Text>
                                        <Text className="text-slate-400 text-[10px] font-inter font-bold uppercase">
                                            Active Jobs
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Right Side: The Donut Chart */}
                        <View className="items-center justify-center">
                            <DonutChart percentage={stats.avgProgress} radius={50} strokeWidth={12} color="#3b82f6" />
                        </View>
                    </View>
                </View>

                {/* 2. TELEMETRY & COMMAND CARD ROW */}
                <View className="flex-row gap-4 mb-4">
                    {/* Issues Card */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/(tabs)/field')}
                        className="flex-1 bg-white p-5 rounded-3xl shadow-sm border border-slate-100"
                    >
                        <View className="flex-row justify-between items-start mb-2">
                            <View className={`p-2 rounded-xl ${(stats.openIssues + stats.rejectedTickets) > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                <Ionicons
                                    name={(stats.openIssues + stats.rejectedTickets) > 0 ? "alert-circle" : "checkmark-circle"}
                                    size={24}
                                    color={(stats.openIssues + stats.rejectedTickets) > 0 ? "#ef4444" : "#10b981"}
                                />
                            </View>
                        </View>

                        <View className="mt-2">
                            <Text className="text-[24px] font-inter font-black text-slate-900">
                                {stats.openIssues + stats.rejectedTickets}
                            </Text>
                            <Text className="text-slate-500 text-[10px] font-inter font-bold uppercase tracking-wide mt-1">Open Issues</Text>
                        </View>

                        <View className="mt-4 pt-4 border-t border-slate-100">
                            <Text className="text-slate-400 text-[10px] font-inter font-medium">
                                {(stats.openIssues + stats.rejectedTickets) > 0
                                    ? "Delays possible across active jobs."
                                    : "All sites running smoothly."}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Manpower Card */}
                    <View className="flex-1 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 justify-between">
                        <View>
                            <View className="bg-blue-50 p-2 rounded-xl self-start mb-2">
                                <Ionicons name="people" size={24} color="#3b82f6" />
                            </View>
                            <Text className="text-[24px] font-inter font-black text-slate-900 mt-2">
                                {stats.manpower}
                            </Text>
                            <Text className="text-slate-500 text-[10px] font-inter font-bold uppercase tracking-wide mt-1">Manpower</Text>
                        </View>
                        <View className="mt-4 pt-4 border-t border-slate-100">
                            <Text className="text-slate-400 text-[10px] font-inter font-medium">Active on site today.</Text>
                        </View>
                    </View>
                </View>

                {/* COMMAND CARDS ROW (NEW) */}
                <View className="flex-row gap-4 mb-8">
                    {/* Pending Approvals */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/(tabs)/field')} // Field ops handles approvals
                        className="flex-1 bg-emerald-50 p-5 rounded-3xl border border-emerald-100"
                    >
                        <View className="flex-row justify-between items-start mb-2">
                            <View className="bg-emerald-100 p-2 rounded-xl">
                                <Ionicons name="shield-checkmark" size={24} color="#059669" />
                            </View>
                        </View>
                        <Text className="text-emerald-900 font-inter font-black text-lg mt-2">Pending Approvals</Text>
                        <Text className="text-emerald-600 text-[10px] font-inter font-bold uppercase">Review Needed</Text>
                    </TouchableOpacity>

                    {/* Delivery Tracker */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/(tabs)/field')} // Or a dedicated delivery view if one exists
                        className="flex-1 bg-blue-50 p-5 rounded-3xl border border-blue-100"
                    >
                        <View className="flex-row justify-between items-start mb-2">
                            <View className="bg-blue-100 p-2 rounded-xl">
                                <Ionicons name="bus" size={24} color="#2563eb" />
                            </View>
                        </View>
                        <Text className="text-blue-900 font-inter font-black text-lg mt-2">Delivery Tracker</Text>
                        <Text className="text-blue-600 text-[10px] font-inter font-bold uppercase">Live Updates</Text>
                    </TouchableOpacity>
                </View>

                {/* 3. QUICK ACCESS GRID */}
                <Text className="text-slate-800 font-bold text-lg mb-4">Quick Access Modules</Text>

                <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
                    {[
                        { title: 'Projects/Jobs', icon: 'briefcase', color: '#3b82f6', route: '/jobs', bg: 'bg-blue-50' },
                        { title: 'Polishers Hub', icon: 'construct', color: '#f97316', route: '/polishers', bg: 'bg-orange-50' },
                        { title: 'Manpower', icon: 'people', color: '#8b5cf6', route: '/manpower', bg: 'bg-violet-50' },
                        { title: 'Warehouse', icon: 'cube', color: '#10b981', route: '/warehouse', bg: 'bg-emerald-50' },
                        { title: 'Field Ops', icon: 'map', color: '#6366f1', route: '/field', bg: 'bg-indigo-50' },
                        { title: 'Shop', icon: 'hammer', color: '#f59e0b', route: '/shop', bg: 'bg-amber-50' },
                        { title: 'Reports', icon: 'bar-chart', color: '#f43f5e', route: '/reports', bg: 'bg-rose-50' },
                        { title: 'Team Access', icon: 'key', color: '#64748b', route: '/team-access', bg: 'bg-slate-50' },
                    ].map((item, idx) => (
                        <View
                            key={idx}
                            style={{
                                width: useWindowDimensions().width > 768 ? '25%' : '50%',
                                padding: 8
                            }}
                        >
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => router.push(item.route as any)}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex-1 hover:border-blue-400 group h-40 justify-between"
                            >
                                <View className="flex-row justify-between items-start">
                                    <View className={item.bg + " p-3 rounded-xl"}>
                                        <Ionicons name={item.icon as any} size={28} color={item.color} />
                                    </View>
                                    <Ionicons name="arrow-forward-circle-outline" size={20} color="#cbd5e1" />
                                </View>
                                <View>
                                    <Text className="text-slate-900 font-bold text-base leading-tight">
                                        {item.title}
                                    </Text>
                                    <Text className="text-slate-400 font-medium text-[10px] uppercase tracking-wider mt-1">
                                        Open Module
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}