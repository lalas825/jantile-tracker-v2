import { Tabs } from 'expo-router';
import { LayoutDashboard, Briefcase, Truck, HardHat, Menu } from 'lucide-react-native';
import clsx from 'clsx';
import { View } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#0f172a', // bg-slate-900
                    borderTopColor: '#1e293b', // border-slate-800
                    borderTopWidth: 1,
                },
                tabBarActiveTintColor: '#34d399', // text-emerald-400
                tabBarInactiveTintColor: '#64748b', // text-slate-500
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size }) => (
                        <LayoutDashboard size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="jobs"
                options={{
                    title: 'Jobs',
                    tabBarIcon: ({ color, size }) => (
                        <Briefcase size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="logistics"
                options={{
                    title: 'Logistics',
                    tabBarIcon: ({ color, size }) => (
                        <Truck size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="field"
                options={{
                    title: 'Field',
                    tabBarIcon: ({ color, size }) => (
                        <HardHat size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="menu"
                options={{
                    title: 'Menu',
                    tabBarIcon: ({ color, size }) => (
                        <Menu size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
