import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    Users, FileBarChart, Hammer, Key, ChevronRight,
    LayoutDashboard, Building2, HardHat, Box, Factory
} from 'lucide-react-native';

const MenuButton = ({ title, icon: Icon, route }: { title: string, icon: any, route: string }) => {
    const router = useRouter();
    return (
        <TouchableOpacity
            onPress={() => router.push(route as any)}
            className="flex-row items-center justify-between p-4 bg-white border-b border-slate-100 active:bg-slate-50"
        >
            <View className="flex-row items-center flex-1">
                <View className="p-2 bg-slate-100 rounded-lg mr-4">
                    <Icon size={24} color="#334155" />
                </View>
                <View>
                    <Text className="text-slate-900 text-base font-semibold">{title}</Text>
                </View>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
        </TouchableOpacity>
    );
};

export default function MenuScreen() {
    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <View className="px-5 py-4 border-b border-slate-100">
                <Text className="text-slate-900 text-2xl font-bold">Menu</Text>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="mt-2">
                    <MenuButton
                        title="Dashboard"
                        icon={LayoutDashboard}
                        route="/(tabs)"
                    />
                    <MenuButton
                        title="Jobs"
                        icon={Building2}
                        route="/(tabs)/jobs"
                    />
                    <MenuButton
                        title="Warehouse"
                        icon={Box}
                        route="/(tabs)/warehouse"
                    />
                    <MenuButton
                        title="Field"
                        icon={HardHat}
                        route="/(tabs)/field"
                    />
                    <MenuButton
                        title="Shop"
                        icon={Factory}
                        route="/(tabs)/shop"
                    />
                    <MenuButton
                        title="Manpower"
                        icon={Users}
                        route="/(tabs)/manpower"
                    />
                    <MenuButton
                        title="Reports"
                        icon={FileBarChart}
                        route="/(tabs)/reports"
                    />
                    <MenuButton
                        title="Polishers"
                        icon={Hammer}
                        route="/(tabs)/polishers"
                    />
                    <MenuButton
                        title="Team Access"
                        icon={Key}
                        route="/(tabs)/team-access"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
