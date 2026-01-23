import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Users, FileBarChart, Hammer, Key } from 'lucide-react-native';

const MenuButton = ({ title, subtitle, icon: Icon, route }: { title: string, subtitle: string, icon: any, route: string }) => {
    const router = useRouter();
    return (
        <TouchableOpacity
            onPress={() => router.push(route)}
            className="flex-row items-center p-5 bg-white rounded-xl mb-4 border border-slate-200 shadow-sm"
        >
            <View className="p-3 bg-slate-100 rounded-full mr-4">
                <Icon size={28} color="#94a3b8" />
            </View>
            <View>
                <Text className="text-slate-900 text-xl font-bold">{title}</Text>
                <Text className="text-slate-500">{subtitle}</Text>
            </View>
        </TouchableOpacity>
    );
};

export default function MenuScreen() {
    return (
        <SafeAreaView className="flex-1 bg-slate-50 px-5 pt-8" style={{ backgroundColor: '#f8fafc' }}>
            <Text className="text-slate-900 text-3xl font-bold mb-8">More Options</Text>

            <ScrollView>
                <MenuButton
                    title="Manpower"
                    subtitle="Crew Scheduling"
                    icon={Users}
                    route="/(tabs)/manpower"
                />
                <MenuButton
                    title="Reports"
                    subtitle="Analytics & Exports"
                    icon={FileBarChart}
                    route="/(tabs)/reports"
                />
                <MenuButton
                    title="Polishers"
                    subtitle="Equipment Management"
                    icon={Hammer}
                    route="/(tabs)/polishers"
                />
                <MenuButton
                    title="Team Access"
                    subtitle="Permissions & Roles"
                    icon={Key}
                    route="/(tabs)/team-access"
                />
            </ScrollView>
        </SafeAreaView>
    );
}
