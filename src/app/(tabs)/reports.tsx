import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoleGuard } from '../../features/admin';

export default function ReportsScreen() {
    return (
        <RoleGuard allowed={['admin', 'pm', 'supervisor']}>
            <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center" style={{ backgroundColor: '#f8fafc' }} edges={['top']}>
                <Text className="text-slate-900 text-2xl font-bold">REPORTS</Text>
                <Text className="text-slate-500 mt-2">Analytics & Exports</Text>
            </SafeAreaView>
        </RoleGuard>
    );
}
