import { Tabs, router, Slot } from 'expo-router';
import { LayoutDashboard, Briefcase, Truck, Box, Wrench, Menu } from 'lucide-react-native';
import { TouchableOpacity, useWindowDimensions, View, Image } from 'react-native';
import DesktopNavbar from '../../components/navigation/DesktopNavbar';

export default function TabLayout() {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    if (isDesktop) {
        return (
            <View className="flex-1 bg-slate-50">
                <DesktopNavbar />
                <Slot />
            </View>
        );
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: true, // Enable header for Hamburger
                headerStyle: {
                    backgroundColor: '#ffffff', // bg-white
                    borderBottomColor: '#e2e8f0', // border-slate-200
                    borderBottomWidth: 1,
                },
                headerShadowVisible: true, // Shadow enabled
                // Replace text title with Logo
                headerTitle: () => (
                    <Image
                        source={require('../../../assets/images/jantile-logo.png')}
                        style={{ width: 140, height: 35, resizeMode: 'contain' }}
                    />
                ),
                headerTitleAlign: 'center', // Ensure logo is centered
                headerTintColor: '#0f172a', // Slate-900 (Back button/Menu)
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/menu')}
                        style={{ marginLeft: 16 }}
                    >
                        <Menu color="#0f172a" size={24} />
                    </TouchableOpacity>
                ),
                tabBarStyle: {
                    display: 'none', // Hide bottom tabs for Drawer-Only navigation
                    backgroundColor: '#ffffff',
                    borderTopColor: '#e2e8f0',
                    borderTopWidth: 1,
                },
                tabBarActiveTintColor: '#3b82f6', // blue-500 for active
                tabBarInactiveTintColor: '#64748b', // slate-500
            }}
            sceneContainerStyle={{ backgroundColor: '#f8fafc' }}
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
