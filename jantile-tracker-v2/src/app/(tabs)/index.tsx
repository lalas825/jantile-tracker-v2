import React from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressChart, BarChart } from 'react-native-chart-kit';
import { Image } from 'expo-image';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
    backgroundGradientFrom: '#1e293b', // slate-800
    backgroundGradientTo: '#1e293b',
    color: (opacity = 1) => `rgba(52, 211, 153, ${opacity})`, // emerald-400
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`, // White labels
};

const Header = () => (
    <View className="flex-row justify-between items-center mb-6">
        <Text className="text-3xl font-bold text-white">Overview</Text>
        <View className="h-10 w-10 bg-slate-700 rounded-full items-center justify-center">
            <Text className="text-white font-bold">JD</Text>
        </View>
    </View>
);

const GlobalHealthWidget = () => {
    const data = {
        labels: ["Health"],
        data: [0.22]
    }
    return (
        <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 items-center">
            <Text className="text-slate-400 font-medium mb-2 w-full">Global Health</Text>
            <ProgressChart
                data={data}
                width={screenWidth - 60}
                height={160}
                strokeWidth={16}
                radius={50}
                chartConfig={chartConfig}
                hideLegend={false}
            />
            <Text className="text-emerald-400 font-bold text-3xl absolute top-[85px]">22%</Text>
        </View>
    );
};

const JobVelocityWidget = () => {
    const data = {
        labels: ["Job A", "Job B", "Job C"],
        datasets: [
            {
                data: [20, 45, 28]
            }
        ]
    };

    return (
        <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6">
            <Text className="text-slate-400 font-medium mb-4">Job Velocity (Hrs vs Budget)</Text>
            <BarChart
                data={data}
                width={screenWidth - 60}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                    ...chartConfig,
                    fillShadowGradient: '#3b82f6', // blue-500
                    fillShadowGradientOpacity: 1,
                    color: () => '#3b82f6',
                }}
                verticalLabelRotation={0}
                showValuesOnTopOfBars
            />
        </View>
    );
};

const JobCard = ({ title, progress }: { title: string, progress: number }) => (
    <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-3">
        <View className="flex-row justify-between items-center mb-3">
            <Text className="text-white font-bold text-lg">{title}</Text>
            <View className="bg-emerald-900/50 px-2 py-1 rounded">
                <Text className="text-emerald-400 text-xs font-bold">Active</Text>
            </View>
        </View>

        <View className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <View className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
        </View>
    </View>
)

const ActiveProjectsWidget = () => (
    <View className="mb-20">
        <Text className="text-slate-400 font-medium mb-4">Active Projects</Text>
        <JobCard title="36w 66th St" progress={60} />
        <JobCard title="72 Park Ave" progress={35} />
        <JobCard title="10 Hudson Yards" progress={85} />
    </View>
)

export default function Dashboard() {
    return (
        <SafeAreaView className="flex-1 bg-slate-900" edges={['top']}>
            <ScrollView className="px-5 pt-4">
                <Header />
                <GlobalHealthWidget />
                <JobVelocityWidget />
                <ActiveProjectsWidget />
            </ScrollView>
        </SafeAreaView>
    );
}
