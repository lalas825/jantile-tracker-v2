import React from 'react';
import { View } from 'react-native';
import WarehouseTab from '../../components/warehouse/WarehouseTab';
import { RoleGuard } from '../../features/admin';

export default function WarehouseScreen() {
    return (
        <RoleGuard allowed={['admin', 'pm', 'warehouse']}>
            <View className="flex-1 bg-slate-50">
                <WarehouseTab />
            </View>
        </RoleGuard>
    );
}
