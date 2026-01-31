import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TeamAccessScreen() {
    return (
        <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center" style={{ backgroundColor: '#f8fafc' }}>
            <Text className="text-slate-900 text-2xl font-bold">TEAM ACCESS</Text>
            <Text className="text-slate-500 mt-2">Permissions & Roles</Text>
        </SafeAreaView>
    );
}
