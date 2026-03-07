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
    const { width } = useWindowDimensions();
    const [jobs, setJobs] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Scope telemetry: admin/pm/warehouse/shop see global, others see only assigned jobs
    const isViewOnly = !!profile?.role && ['warehouse', 'shop'].includes(profile.role);
    const isGlobal = !profile?.role || ['admin', 'pm', 'warehouse', 'shop'].includes(profile.role);
    const uid = user?.id || '';
    const jobScope = isGlobal ? '' : ` AND job_id IN (SELECT job_id FROM job_assignments WHERE user_id = '${uid}')`;

    // --- POWER SYNC REAL-TIME TELEMETRY (scoped by assignments) ---
    const { data: openIssuesCount } = useQuery(`SELECT count(*) as count FROM job_issues WHERE status = 'open'${jobScope}`);
    const { data: resolvedIssuesCount } = useQuery(`SELECT count(*) as count FROM job_issues WHERE status = 'resolved'${jobScope}`);
    const { data: rejectedTicketsCount } = useQuery(`SELECT count(*) as count FROM delivery_tickets WHERE status = 'REJECTED'${jobScope}`);
    const { data: manpowerCount } = useQuery(`SELECT count(*) as count FROM crew_checkins WHERE check_out IS NULL${jobScope}`);
    const { data: progressData } = useQuery(
        isGlobal
            ? "SELECT avg(progress) as avg_progress FROM areas"
            : `SELECT avg(a.progress) as avg_progress FROM areas a JOIN units u ON a.unit_id = u.id JOIN floors f ON u.floor_id = f.id WHERE f.job_id IN (SELECT job_id FROM job_assignments WHERE user_id = '${uid}')`
    );
    const { data: activeJobsCount } = useQuery(
        isGlobal
            ? "SELECT count(*) as count FROM jobs WHERE status = 'Active'"
            : `SELECT count(*) as count FROM jobs WHERE status = 'Active' AND id IN (SELECT job_id FROM job_assignments WHERE user_id = '${uid}')`
    );

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
            const activeJobs = await SupabaseService.getActiveJobs({
                userId: user?.id,
                role: profile?.role,
            });
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

                // Collect assigned job IDs for scoped queries
                const assignedJobIds = activeJobs.map((j: any) => j.id);

                // 2. Open Issues (scoped to user's jobs for non-admin)
                let openIssues = 0;
                try {
                    if (isGlobal) {
                        openIssues = await SupabaseService.getGlobalOpenIssuesCount();
                    } else {
                        if (assignedJobIds.length > 0) {
                            const { count, error } = await sb.from('job_issues')
                                .select('*', { count: 'exact', head: true })
                                .eq('status', 'open')
                                .in('job_id', assignedJobIds);
                            if (!error) openIssues = count || 0;
                        }
                    }
                } catch (e) {
                    console.error('Failed to get open issues count', e);
                }

                // 3. Rejected Tickets (scoped)
                let rejectedTickets = 0;
                try {
                    let query = sb.from('delivery_tickets').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED');
                    if (!isGlobal && assignedJobIds.length > 0) {
                        query = query.in('job_id', assignedJobIds);
                    }
                    const { count, error } = await query;
                    if (!error) rejectedTickets = count || 0;
                } catch (e) { }

                // 4. Manpower (scoped to user's jobs)
                let manpower = 0;
                try {
                    if (isGlobal) {
                        const { data, error } = await sb.from('workers').select('id, assigned_job_ids');
                        if (!error && data) {
                            manpower = data.filter((w: any) => {
                                const ids = w.assigned_job_ids;
                                return ids && ids !== '' && ids !== '[]';
                            }).length;
                        }
                    } else {
                        // Count crew checkins for user's assigned jobs
                        if (assignedJobIds.length > 0) {
                            const { count, error } = await sb.from('crew_checkins')
                                .select('*', { count: 'exact', head: true })
                                .is('check_out', null)
                                .in('job_id', assignedJobIds);
                            if (!error) manpower = count || 0;
                        }
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
                    <View className="flex-1 bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                        <TouchableOpacity
                            activeOpacity={isViewOnly ? 1 : 0.7}
                            onPress={isViewOnly ? undefined : () => router.push('/(tabs)/field')}
                            disabled={isViewOnly}
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
                    </View>

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

                {/* COMMAND CARDS ROW — hidden for view-only roles */}
                {!isViewOnly && (
                <View className="flex-row gap-4 mb-8">
                    {/* Pending Approvals */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/(tabs)/field')}
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
                        onPress={() => router.push('/(tabs)/field')}
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
                )}

                {/* 3. QUICK ACCESS GRID (role-filtered) */}
                <Text className="text-slate-800 font-bold text-lg mb-4">Quick Access Modules</Text>

                <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
                    {[
                        { title: 'Projects/Jobs', icon: 'briefcase', color: '#3b82f6', route: '/jobs', bg: 'bg-blue-50', roles: ['admin', 'supervisor', 'pm', 'foreman'] },
                        { title: 'Warehouse', icon: 'cube', color: '#10b981', route: '/warehouse', bg: 'bg-emerald-50', roles: ['admin', 'supervisor', 'pm', 'warehouse'] },
                        { title: 'Field Ops', icon: 'map', color: '#6366f1', route: '/field', bg: 'bg-indigo-50', roles: ['admin', 'supervisor'] },
                        { title: 'Shop', icon: 'hammer', color: '#f59e0b', route: '/shop', bg: 'bg-amber-50', roles: ['admin', 'supervisor', 'pm', 'shop'] },
                        { title: 'Manpower', icon: 'people', color: '#8b5cf6', route: '/manpower', bg: 'bg-violet-50', roles: ['admin', 'supervisor'] },
                        { title: 'Polishers Hub', icon: 'construct', color: '#f97316', route: '/polishers', bg: 'bg-orange-50', roles: ['admin', 'supervisor'] },
                        { title: 'Team Access', icon: 'key', color: '#64748b', route: '/team-access', bg: 'bg-slate-50', roles: ['admin'] },
                    ].filter(item => !profile?.role || item.roles.includes(profile.role)).map((item, idx) => (
                        <View
                            key={idx}
                            style={{
                                width: width > 768 ? '25%' : '50%',
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