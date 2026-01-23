import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Search } from 'lucide-react-native';
import clsx from 'clsx';

const NavLink = ({ title, route }: { title: string, route: string }) => {
    const router = useRouter();
    const pathname = usePathname();
    // Simple active check: if pathname starts with route (handling index specially)
    const isActive = route === '/(tabs)' ? pathname === '/' || pathname === '/(tabs)' : pathname.startsWith(route);

    return (
        <TouchableOpacity onPress={() => router.push(route)} className="mx-4">
            <Text className={clsx(
                "font-medium text-lg",
                isActive ? "text-white font-bold" : "text-slate-300 hover:text-white"
            )}>
                {title}
            </Text>
        </TouchableOpacity>
    );
};

export default function DesktopNavbar() {
    return (
        <View className="h-16 bg-slate-900 flex-row items-center px-6 justify-between border-b border-slate-800">
            {/* Left: Brand */}
            <View>
                <Text className="text-white font-bold text-xl tracking-wider">JANTILE INC</Text>
            </View>

            {/* Center: Navigation Links */}
            <View className="flex-row items-center">
                <NavLink title="Dashboard" route="/(tabs)" />
                <NavLink title="Jobs" route="/(tabs)/jobs" />
                <NavLink title="Field" route="/(tabs)/field" />
                <NavLink title="Warehouse" route="/(tabs)/warehouse" />
                <NavLink title="Shop" route="/(tabs)/shop" />
                <NavLink title="Reports" route="/(tabs)/reports" />
            </View>

            {/* Right: Search Bar */}
            <View className="bg-slate-800 rounded-lg flex-row items-center px-3 py-1 border border-slate-700 w-64">
                <Search size={18} color="#94a3b8" />
                <TextInput
                    placeholder="Search anything..."
                    placeholderTextColor="#94a3b8"
                    className="flex-1 ml-2 text-white h-8 outline-none" // outline-none for web
                />
            </View>
        </View>
    );
}
