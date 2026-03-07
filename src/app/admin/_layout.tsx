import React from 'react';
import { View, useWindowDimensions, Platform } from 'react-native';
import { Slot } from 'expo-router';
import DesktopNavbar from '../../components/navigation/DesktopNavbar';

export default function AdminLayout() {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    return (
        <View className="flex-1 bg-slate-50">
            {isDesktop && <DesktopNavbar />}
            <Slot />
        </View>
    );
}
