import { Tabs, router } from 'expo-router';
import { LayoutDashboard, Briefcase, Truck, Box, Wrench, Menu } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: true, // Enable header for Hamburger
                headerStyle: {
                    backgroundColor: '#0f172a', // bg-slate-900
                    borderBottomColor: '#1e293b', // border-slate-800
                    borderBottomWidth: 1,
                    shadowOpacity: 0,
                    elevation: 0,
                },
                headerTintColor: '#fff', // White title
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/menu')}
                        style={{ marginLeft: 16 }}
                    >
                        <Menu color="#fff" size={24} />
                    </TouchableOpacity>
                ),
                tabBarStyle: {
                    backgroundColor: '#0f172a',
                    borderTopColor: '#1e293b',
                    borderTopWidth: 1,
                },
                tabBarActiveTintColor: '#34d399',
                tabBarInactiveTintColor: '#64748b',
            }}
            sceneContainerStyle={{ backgroundColor: '#0f172a' }}
        >
            {/* --- VISIBLE TABS --- */}
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="jobs"
                options={{
                    title: 'Jobs',
                    tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="field"
                options={{
                    title: 'Field',
                    tabBarIcon: ({ color, size }) => <Truck size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="warehouse"
                options={{
                    title: 'Warehouse',
                    tabBarIcon: ({ color, size }) => <Box size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="shop"
                options={{
                    title: 'Shop',
                    tabBarIcon: ({ color, size }) => <Wrench size={size} color={color} />,
                }}
            />

            {/* --- HIDDEN TABS --- */}
            <Tabs.Screen name="menu" options={{ href: null, title: 'Menu' }} />
            <Tabs.Screen name="manpower" options={{ href: null, title: 'Manpower' }} />
            <Tabs.Screen name="reports" options={{ href: null, title: 'Reports' }} />
            <Tabs.Screen name="polishers" options={{ href: null, title: 'Polishers' }} />
            <Tabs.Screen name="team-access" options={{ href: null, title: 'Team Access' }} />

            {/* Old screens to hide/ignore or reuse if needed */}
            <Tabs.Screen name="logistics" options={{ href: null }} />
        </Tabs>
    );
}
