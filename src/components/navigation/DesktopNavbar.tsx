import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Search, Bell, LogOut } from 'lucide-react-native';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

const NavLink = ({ title, route }: { title: string, route: string }) => {
    const router = useRouter();
    const pathname = usePathname();
    const isActive = route === '/(tabs)' ? pathname === '/' || pathname === '/(tabs)' : pathname.startsWith(route);

    return (
        <TouchableOpacity onPress={() => router.push(route as any)} className="mx-0">
            <Text className={clsx(
                "text-base font-inter font-bold whitespace-nowrap transition-colors", // text-base (16px), font-bold
                isActive ? "text-red-700 font-black" : "text-slate-600 hover:text-red-700"
            )}>
                {title}
            </Text>
        </TouchableOpacity>
    );
};

export default function DesktopNavbar() {
    const { signOut, profile, user } = useAuth();

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
        : user?.email ? user.email.substring(0, 2).toUpperCase() : '??';

    return (
        <View className="h-16 bg-white border-b border-slate-200 flex-row items-center justify-between px-4 shadow-sm z-50">
            {/* Zone 1: The Brand */}
            <View className="mr-6">
                <Image
                    source={require('../../../assets/images/jantile-logo.png')}
                    style={{ width: 180, height: 40, resizeMode: 'contain' }}
                />
            </View>

            {/* Zone 2: The Navigation */}
            <View className="flex-1 flex-row items-center space-x-8 overflow-x-auto no-scrollbar">
                <NavLink title="Dashboard" route="/(tabs)" />
                <NavLink title="Jobs" route="/(tabs)/jobs" />
                <NavLink title="Warehouse" route="/(tabs)/warehouse" />
                <NavLink title="Field" route="/(tabs)/field" />
                <NavLink title="Shop" route="/(tabs)/shop" />
                <NavLink title="Manpower" route="/(tabs)/manpower" />
                <NavLink title="Reports" route="/(tabs)/reports" />
                <NavLink title="Polishers" route="/(tabs)/polishers" />
                <NavLink title="Team Access" route="/(tabs)/team-access" />
            </View>

            {/* Zone 3: The Tools */}
            <View className="flex-row items-center space-x-4 ml-4">
                {/* Search Bar */}
                <View className="bg-slate-100 rounded-md px-3 py-2 flex-row items-center w-48 focus-within:w-64 transition-all duration-300">
                    <Search size={16} className="text-slate-500" color="#64748b" />
                    <TextInput
                        placeholder="Search..."
                        placeholderTextColor="#94a3b8"
                        className="flex-1 ml-2 text-sm font-inter text-slate-700 outline-none h-full bg-transparent"
                    />
                </View>

                {/* Notification Icon */}
                <TouchableOpacity>
                    <Bell size={20} className="text-slate-500 hover:text-red-700" color="#64748b" />
                </TouchableOpacity>

                {/* Profile */}
                <View className="h-8 w-8 rounded-full bg-slate-200 items-center justify-center border border-slate-300">
                    <Text className="text-xs font-outfit font-black text-slate-600">{initials}</Text>
                </View>

                {/* Logout Button */}
                <TouchableOpacity onPress={() => signOut()} className="p-2 border border-slate-200 rounded-md hover:bg-slate-50">
                    <LogOut size={18} color="#64748b" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
