import React from 'react';
import { View, Text } from 'react-native';

export default function DirectOrdersView() {
    return (
        <View className="p-8 items-center justify-center flex-1">
            <View className="bg-slate-100 p-6 rounded-full mb-4">
                <Text className="text-3xl">🛒</Text>
            </View>
            <Text className="text-lg font-bold text-slate-700">Direct Orders</Text>
            <Text className="text-slate-400 mt-2 text-center max-w-xs">Purchase Orders destined directly for job sites (drop-ship) will appear here.</Text>
        </View>
    );
}
