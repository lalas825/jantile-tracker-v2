import React from 'react';
import { View } from 'react-native';
import WarehouseTab from '../../components/warehouse/WarehouseTab';

export default function WarehouseScreen() {
    return (
        <View className="flex-1 bg-slate-50">
            <WarehouseTab />
        </View>
    );
}
