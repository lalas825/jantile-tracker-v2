import React from 'react';
import { View, Text } from 'react-native';

export default function DeliveredHistory() {
    return (
        <View className="p-8 items-center justify-center flex-1">
            <View className="bg-green-50 p-6 rounded-full mb-4">
                <Text className="text-3xl">✅</Text>
            </View>
            <Text className="text-lg font-bold text-slate-700">Delivery History</Text>
            <Text className="text-slate-400 mt-2 text-center max-w-xs">History of all completed deliveries and shipments will be archived here.</Text>
        </View>
    );
}
