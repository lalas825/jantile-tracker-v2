import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ShopScreen() {
    return (
        <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
            <Text className="text-white text-2xl font-bold">SHOP</Text>
            <Text className="text-slate-400 mt-2">Fabrication & Tools</Text>
        </SafeAreaView>
    );
}
