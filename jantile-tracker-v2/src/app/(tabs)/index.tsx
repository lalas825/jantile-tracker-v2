import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Header = () => (
    <View className="flex-row justify-between items-center mb-6">
        <Text className="text-3xl font-bold text-slate-900">Overview</Text>
        <View className="h-10 w-10 bg-slate-200 rounded-full items-center justify-center">
            <Text className="text-slate-900 font-bold">JD</Text>
        </View>
    </View>
);

const JobCard = ({ title, progress }: { title: string, progress: number }) => (
    <View className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-3">
        <View className="flex-row justify-between items-center mb-3">
            <Text className="text-slate-900 font-bold text-lg">{title}</Text>
            <View className="bg-emerald-100 px-2 py-1 rounded">
                <Text className="text-emerald-700 text-xs font-bold">Active</Text>
            </View>
        </View>

        <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <View className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
        </View>
    </View>
)

const ActiveProjectsWidget = () => (
    <View className="mb-20">
        <Text className="text-slate-900 font-medium mb-4">Active Projects</Text>
        <JobCard title="36w 66th St" progress={60} />
        <JobCard title="72 Park Ave" progress={35} />
        <JobCard title="10 Hudson Yards" progress={85} />
    </View>
)

export default function Dashboard() {
    return (
        <SafeAreaView className="flex-1 bg-slate-50 text-slate-900" edges={['top']} style={{ backgroundColor: '#f8fafc' }}>
            <ScrollView className="px-5 pt-4">
                <Header />

                {/* Charts Disabled for Web Debug */}
                <View className="p-6 bg-white rounded-xl mb-6 border border-slate-200 shadow-sm">
                    <Text className="text-slate-400 font-bold opacity-50 text-center">Charts Temporarily Disabled for Web Debug</Text>
                </View>

                {/* Second placeholder for the second chart */}
                <View className="p-6 bg-white rounded-xl mb-6 border border-slate-200 shadow-sm">
                    <Text className="text-slate-400 font-bold opacity-50 text-center">Charts Temporarily Disabled for Web Debug</Text>
                </View>

                <ActiveProjectsWidget />
            </ScrollView>
        </SafeAreaView>
    );
}
