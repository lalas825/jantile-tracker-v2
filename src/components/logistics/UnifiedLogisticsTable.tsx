import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import PurchaseHistoryModal from './PurchaseHistoryModal';

const { width: viewportWidth } = Dimensions.get('window');

interface UnifiedLogisticsTableProps {
    materials: any[]; // ProjectMaterial or AggregatedMaterial
    viewMode: 'area' | 'project';
    onEditMaterial?: (material: any) => void;
    onDeleteMaterial?: (id: string) => void;
    onOrder?: (material: any) => void;
}

export default function UnifiedLogisticsTable({
    materials,
    viewMode,
    onEditMaterial,
    onDeleteMaterial,
    onOrder
}: UnifiedLogisticsTableProps) {

    const isProjectView = viewMode === 'project';
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedHistoryMaterial, setSelectedHistoryMaterial] = useState<any>(null);

    // Tech Spec Font Style (Inter 10pt as requested)
    const techSpecStyle = "font-inter font-bold text-[10px] text-slate-500 uppercase text-center";

    // Helper for Piece Count Calculation
    const getPcs = (qty: number, pcsPerUnit: number) => {
        if (!pcsPerUnit || pcsPerUnit === 0) return 0;
        return Math.round(qty * pcsPerUnit);
    };

    // Helper to render dual-unit quantities
    const renderDualUnit = (qty: number, m: any, colorClass: string = 'text-slate-600', isOrdered: boolean = false) => {
        const unit = m.unit || 'sqft';
        const pcs = getPcs(qty, m.pcs_per_unit || 1);

        return (
            <TouchableOpacity
                disabled={!isOrdered}
                onPress={() => {
                    setSelectedHistoryMaterial(m);
                    setHistoryModalVisible(true);
                }}
                className="items-center"
            >
                <View className="flex-row items-baseline">
                    <Text className={`text-[15px] font-inter font-black ${colorClass} ${isOrdered ? 'underline' : ''}`}>{Number(qty || 0).toLocaleString()}</Text>
                    <Text className="text-[10px] text-slate-400 font-medium ml-1">{unit}</Text>
                </View>
                {pcs > 0 && <Text className="text-[10px] text-slate-400 font-bold">({pcs.toLocaleString()} PCS)</Text>}
            </TouchableOpacity>
        );
    };

    const renderHeader = () => (
        <View className="flex-row px-5 py-3 bg-slate-50 border-y border-slate-100 items-center w-full min-w-[2000px]">
            {!isProjectView && <Text className="w-[120px] text-[11px] font-inter font-black text-slate-400 uppercase">LOC / ZONE</Text>}
            <Text className="w-[320px] text-[11px] font-inter font-black text-slate-400 uppercase px-2">MATERIAL</Text>

            <Text className="w-[80px] text-[11px] font-inter font-black text-slate-400 uppercase text-center">DIMS</Text>
            {!isProjectView && (
                <>
                    <Text className="w-[100px] text-[11px] font-inter font-black text-slate-400 uppercase text-center">GROUT</Text>
                    <Text className="w-[100px] text-[11px] font-inter font-black text-slate-400 uppercase text-center">CAULK</Text>
                </>
            )}

            <Text className="w-[90px] text-[11px] font-inter font-black text-slate-400 uppercase text-center">UNIT COST</Text>
            <Text className="w-[110px] text-[11px] font-inter font-black text-slate-400 uppercase text-center">TOTAL VALUE</Text>
            <Text className="w-[80px] text-[11px] font-inter font-black text-slate-400 uppercase text-center">NET</Text>
            <Text className="w-[70px] text-[11px] font-inter font-black text-slate-400 uppercase text-center">WASTE %</Text>
            <Text className="w-[90px] text-[11px] font-inter font-black text-slate-900 uppercase text-center">BUDGET</Text>

            {/* Mission 19-Column Additions */}
            <Text className="w-[140px] text-[11px] font-inter font-black text-blue-500 uppercase text-center">ACTIVE POs</Text>
            <Text className="w-[110px] text-[11px] font-inter font-black text-indigo-500 uppercase text-center">EXPECTED</Text>

            <Text className="w-[100px] text-[11px] font-inter font-black text-blue-600 uppercase text-center">ORDERED</Text>
            <Text className="w-[100px] text-[11px] font-inter font-black text-emerald-600 uppercase text-center">SHIPPED</Text>
            <Text className="w-[100px] text-[11px] font-inter font-black text-orange-500 uppercase text-center">IN TRANSIT</Text>
            <Text className="w-[100px] text-[11px] font-inter font-black text-red-500 uppercase text-center">DMG / MISS</Text>
            <Text className="w-[100px] text-[11px] font-inter font-black text-green-600 uppercase text-center">IN STOCK</Text>

            <Text className="w-[120px] text-[11px] font-inter font-black text-red-700 uppercase text-center underline">TO BUY</Text>

            <View className="flex-1" />
            <View className="w-[100px]" />
        </View>
    );

    const renderRow = (m: any) => {
        const unit = m.unit || 'sqft';
        const dmgMiss = Number(m.qty_damaged || 0) + Number(m.qty_missing || 0);

        // Mission Formula: To Buy = Budget - (Ordered - DMG/MISS)
        // Ordered here is the Reconciliation from POs
        const ordered = Number(m.ordered_qty || 0);
        const toBuy = Math.max(0, Number(m.budget_qty || 0) - (ordered - dmgMiss));

        return (
            <View key={m.id || `${m.product_code}-${m.product_name}-${m.area_id}`} className="flex-row px-3 py-3 border-b border-slate-50 items-center min-h-[70px] w-full min-w-[2000px]">
                {/* 1. LOC/ZONE */}
                {!isProjectView && (
                    <View className="w-[120px]">
                        <Text className="font-inter font-black text-slate-900 text-[13px] leading-tight" numberOfLines={1}>{m.sub_location || '--'}</Text>
                        <Text className="text-[10px] text-slate-400 font-inter font-bold uppercase tracking-tighter" numberOfLines={1}>{m.zone || 'No Zone'}</Text>
                    </View>
                )}

                {/* 2. MATERIAL */}
                <View className="w-[320px] px-2">
                    <Text className="font-inter font-black text-slate-900 text-[18px] leading-none" numberOfLines={1}>{m.product_code || 'N/A'}</Text>
                    <Text className="text-[11px] text-slate-400 font-inter font-bold" numberOfLines={1}>{m.product_name}</Text>
                </View>

                {/* 3. DIMS (Density 10pt) */}
                <View className="w-[80px] items-center">
                    <Text className={techSpecStyle}>
                        {m.dim_length && m.dim_width ? `${m.dim_length}x${m.dim_width}` : '--'}
                    </Text>
                    {m.dim_thickness && <Text className="text-[9px] text-slate-300 font-bold uppercase">{m.dim_thickness}</Text>}
                </View>

                {/* 4 & 5. GROUT / CAULK (Density 10pt) */}
                {!isProjectView && (
                    <>
                        <View className="w-[100px] items-center px-1">
                            <Text className={techSpecStyle} numberOfLines={2}>{m.grout_info || '--'}</Text>
                        </View>
                        <View className="w-[100px] items-center px-1">
                            <Text className={techSpecStyle} numberOfLines={2}>{m.caulk_info || '--'}</Text>
                        </View>
                    </>
                )}

                {/* 6. UNIT COST */}
                <View className="w-[90px] items-center">
                    <Text className="text-[13px] text-slate-600 font-inter font-bold text-center">${Number(m.unit_cost || 0).toFixed(2)}</Text>
                    <Text className="text-[9px] text-slate-400 font-bold uppercase">/{unit}</Text>
                </View>

                {/* 7. TOTAL VALUE */}
                <View className="w-[110px] items-center">
                    <Text className="text-[15px] font-inter font-black text-slate-900 text-center">${Number(m.total_value || 0).toLocaleString()}</Text>
                </View>

                {/* 8. NET */}
                <View className="w-[80px]">
                    {renderDualUnit(m.net_qty, m)}
                </View>

                {/* 9. WASTE % */}
                <View className="w-[70px] items-center">
                    <Text className="text-[13px] font-inter font-bold text-slate-400">{m.waste_percent || 0}%</Text>
                </View>

                {/* 10. BUDGET */}
                <View className="w-[90px]">
                    {renderDualUnit(m.budget_qty, m, 'text-slate-900')}
                </View>

                {/* 11. ACTIVE POs (MISSION) */}
                <View className="w-[140px] flex-row flex-wrap justify-center gap-1">
                    {m.active_pos && m.active_pos.length > 0 ? (
                        m.active_pos.map((po: any) => (
                            <TouchableOpacity
                                key={po.id}
                                onPress={() => router.push({
                                    pathname: '/(tabs)/warehouse',
                                    params: { tab: 'Receiving', poId: po.id }
                                })}
                                className={`px-1.5 py-0.5 rounded border ${po.status === 'Ordered' ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}
                            >
                                <Text className={`text-[9px] font-inter font-black ${po.status === 'Ordered' ? 'text-blue-700' : 'text-orange-700'}`}>
                                    #{po.po_number.split('-').pop()}
                                </Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text className="text-slate-200 font-black text-[10px]">NONE</Text>
                    )}
                </View>

                {/* 12. EXPECTED (MISSION) */}
                <View className="w-[110px] items-center">
                    {m.nearest_expected_date ? (
                        <View className="bg-indigo-50 px-2 py-1 rounded-lg">
                            <Text className="text-[11px] font-inter font-black text-indigo-700">{m.nearest_expected_date}</Text>
                        </View>
                    ) : (
                        <Text className="text-slate-300 font-black text-[12px]">--</Text>
                    )}
                </View>

                {/* 13. ORDERED (MISSION: Clickable for History) */}
                <View className="w-[100px]">
                    {renderDualUnit(ordered, m, 'text-blue-600', true)}
                </View>

                {/* 14. SHIPPED */}
                <View className="w-[100px]">
                    {renderDualUnit(m.received_at_job, m, 'text-emerald-600')}
                </View>

                {/* 15. IN TRANSIT */}
                <View className="w-[100px]">
                    {renderDualUnit(m.in_transit, m, Number(m.in_transit || 0) > 0 ? 'text-orange-500' : 'text-slate-300')}
                </View>

                {/* 16. DMG / MISS */}
                <View className="w-[100px]">
                    {renderDualUnit(dmgMiss, m, dmgMiss > 0 ? 'text-red-500' : 'text-slate-200')}
                </View>

                {/* 17. IN STOCK */}
                <View className="w-[100px]">
                    {renderDualUnit(m.shop_stock, m, Number(m.shop_stock || 0) > 0 ? 'text-green-600' : 'text-slate-300')}
                </View>

                {/* 18. TO BUY */}
                <View className="w-[120px] items-center bg-red-50/50 py-2 rounded-lg border border-red-100/50">
                    <View className="flex-row items-baseline">
                        <Text className={`text-[20px] font-inter font-black ${toBuy > 0 ? 'text-red-700' : 'text-slate-300'}`}>
                            {toBuy.toLocaleString()}
                        </Text>
                        <Text className="text-[10px] text-slate-400 font-medium ml-1">{unit}</Text>
                    </View>
                    {getPcs(toBuy, m.pcs_per_unit || 1) > 0 && <Text className="text-[11px] text-red-900 font-black">({getPcs(toBuy, m.pcs_per_unit || 1).toLocaleString()} PCS)</Text>}
                </View>

                <View className="flex-1" />

                {/* 19. ACTION BUTTONS */}
                <View className="w-[100px] flex-row justify-end gap-2 px-2">
                    {onOrder && (
                        <TouchableOpacity
                            onPress={() => onOrder(m)}
                            className="bg-blue-600 px-3 py-1.5 rounded-lg active:bg-blue-700"
                        >
                            <Text className="text-white text-[10px] font-inter font-black uppercase">Order</Text>
                        </TouchableOpacity>
                    )}
                    <View className="flex-row items-center gap-1">
                        {onEditMaterial && (
                            <TouchableOpacity onPress={() => onEditMaterial(m)} hitSlop={10}>
                                <Ionicons name="pencil" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                        {onDeleteMaterial && (
                            <TouchableOpacity onPress={() => onDeleteMaterial(m.id)} hitSlop={10}>
                                <Ionicons name="trash-outline" size={16} color="#f87171" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} className="w-full" contentContainerStyle={{ minWidth: '100%' }}>
            <View className="bg-white overflow-hidden min-w-[2000px] w-full px-5">
                {renderHeader()}
                <View className="w-full">
                    {materials.map(renderRow)}
                    {materials.length === 0 && (
                        <View className="py-20 items-center min-w-[1900px]">
                            <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
                            <Text className="text-slate-400 font-inter font-bold mt-4">No materials found in this section</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* History Modal */}
            {selectedHistoryMaterial && (
                <PurchaseHistoryModal
                    visible={historyModalVisible}
                    onClose={() => setHistoryModalVisible(false)}
                    materialName={selectedHistoryMaterial.product_name}
                    productCode={selectedHistoryMaterial.product_code}
                    history={selectedHistoryMaterial.all_pos || []}
                />
            )}
        </ScrollView>
    );
}
