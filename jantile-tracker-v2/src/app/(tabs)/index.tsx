import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { MockJobStore } from '../../services/MockJobStore';

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
                <Text className="text-white font-bold text-xl">{Math.round(percentage)}%</Text>
            </View>
        </View>
    );
};

export default function Dashboard() {
    const router = useRouter();
    const [jobs, setJobs] = useState<any[]>([]);
    const [portfolio, setPortfolio] = useState({ totalHours: 0, totalIssues: 0, avgProgress: 0, activeJobs: 0 });
    const [refreshing, setRefreshing] = useState(false);

    const loadData = () => {
        const allJobs = MockJobStore.getAllJobs();
        setJobs(allJobs);

        let totalReg = 0, totalOT = 0, totalIssues = 0, totalProgress = 0;

        allJobs.forEach(job => {
            totalProgress += job.progress || 0;
            job.floors.forEach((f: any) => {
                f.units.forEach((u: any) => {
                    u.areas.forEach((a: any) => {
                        (a.timeLogs || []).forEach((l: any) => {
                            totalReg += l.regularHours || 0;
                            totalOT += l.otHours || 0;
                        });
                        (a.issues || []).forEach((i: any) => {
                            if (i.status === 'OPEN') totalIssues++;
                        });
                    });
                });
            });
        });

        setPortfolio({
            totalHours: totalReg + totalOT,
            totalIssues: totalIssues,
            avgProgress: allJobs.length > 0 ? Math.round(totalProgress / allJobs.length) : 0,
            activeJobs: allJobs.length
        });
        setRefreshing(false);
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="dark-content" />
            <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
            >
                {/* HEADER */}
                <View className="mb-6 mt-2 flex-row justify-between items-end">
                    <View>
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Overview</Text>
                        <Text className="text-3xl font-bold text-slate-900">Dashboard</Text>
                    </View>
                    <Image
                        source={{ uri: 'https://ui-avatars.com/api/?name=Juan+Restrepo&background=0D8ABC&color=fff' }}
                        className="w-10 h-10 rounded-full bg-slate-200"
                    />
                </View>

                {/* 1. PORTFOLIO SUMMARY CARD */}
                <View className="bg-slate-900 rounded-3xl shadow-lg mb-6 overflow-hidden">
                    <View className="flex-row p-6 items-center">
                        {/* Left Side: Stats */}
                        <View className="flex-1 pr-4">
                            <Text className="text-slate-400 text-xs font-bold uppercase mb-1 tracking-widest">Overall Progress</Text>
                            <Text className="text-white text-3xl font-bold mb-6">On Track</Text>

                            <View className="gap-3">
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="time" size={16} color="#94a3b8" />
                                    <Text className="text-slate-300 font-medium">{portfolio.totalHours} Total Hours</Text>
                                </View>
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="briefcase" size={16} color="#94a3b8" />
                                    <Text className="text-slate-300 font-medium">{portfolio.activeJobs} Active Jobs</Text>
                                </View>
                            </View>
                        </View>

                        {/* Right Side: The Donut Chart */}
                        <View className="items-center justify-center">
                            <DonutChart percentage={portfolio.avgProgress} radius={50} strokeWidth={12} color="#3b82f6" />
                        </View>
                    </View>
                </View>

                {/* 2. ISSUES & MANPOWER ROW */}
                <View className="flex-row gap-4 mb-8">
                    {/* Issues Card */}
                    <View className="flex-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <View className="flex-row justify-between items-start mb-2">
                            <View className={`p-2 rounded-xl ${portfolio.totalIssues > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                <Ionicons
                                    name={portfolio.totalIssues > 0 ? "alert-circle" : "checkmark-circle"}
                                    size={24}
                                    color={portfolio.totalIssues > 0 ? "#ef4444" : "#10b981"}
                                />
                            </View>
                            {portfolio.totalIssues > 0 && (
                                <View className="bg-red-100 px-2 py-1 rounded">
                                    <Text className="text-red-700 text-xs font-bold">Action Req.</Text>
                                </View>
                            )}
                        </View>

                        <Text className="text-3xl font-bold text-slate-800 mt-2">{portfolio.totalIssues}</Text>
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-wide mt-1">Open Issues</Text>

                        <View className="mt-4 pt-4 border-t border-slate-100">
                            <Text className="text-slate-400 text-xs">
                                {portfolio.totalIssues > 0
                                    ? "Delays possible across active jobs."
                                    : "All sites running smoothly."}
                            </Text>
                        </View>
                    </View>

                    {/* Manpower Card */}
                    <View className="flex-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 justify-between">
                        <View>
                            <View className="bg-blue-50 p-2 rounded-xl self-start mb-2">
                                <Ionicons name="people" size={24} color="#3b82f6" />
                            </View>
                            <Text className="text-3xl font-bold text-slate-800 mt-2">12</Text>
                            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wide mt-1">Manpower</Text>
                        </View>
                        <View className="mt-4 pt-4 border-t border-slate-100">
                            <Text className="text-slate-400 text-xs">Active on site today.</Text>
                        </View>
                    </View>
                </View>

                {/* 3. ACTIVE PROJECTS LIST */}
                <Text className="text-slate-800 font-bold text-lg mb-4">Active Projects</Text>
                {jobs.map((job) => (
                    <TouchableOpacity
                        key={job.id}
                        activeOpacity={0.9}
                        onPress={() => router.push(`/jobs/${job.id}`)}
                        className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-4"
                    >
                        <View className="flex-row justify-between items-start mb-4">
                            <View>
                                <Text className="text-lg font-bold text-slate-800">{job.name}</Text>
                                <Text className="text-slate-500 text-xs">{job.location}</Text>
                            </View>
                            <View className="bg-blue-50 px-2 py-1 rounded">
                                <Text className="text-blue-600 text-xs font-bold">#{job.id}</Text>
                            </View>
                        </View>

                        {/* Project Progress Bar */}
                        <View className="mb-2">
                            <View className="flex-row justify-between mb-1">
                                <Text className="text-xs font-bold text-slate-500">Completion</Text>
                                <Text className="text-xs font-bold text-slate-900">{job.progress}%</Text>
                            </View>
                            <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <View className="h-full bg-blue-600" style={{ width: `${job.progress}%` }} />
                            </View>
                        </View>

                        <View className="flex-row justify-end mt-2">
                            <Text className="text-xs text-blue-600 font-bold">Open Project →</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}