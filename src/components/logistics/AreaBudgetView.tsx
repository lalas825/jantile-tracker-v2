import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectMaterial } from '../../services/SupabaseService';

interface AreaBudgetViewProps {
    materialsByArea: Record<string, ProjectMaterial[]>;
    allAreas: any[];
    expandedAreas: Record<string, boolean>;
    toggleArea: (areaId: string) => void;
    onAddMaterial: (areaId: string) => void;
    onEditMaterial: (material: ProjectMaterial) => void;
    onDeleteMaterial: (id: string) => void;
    onDeleteArea: (id: string) => void;
    onEditArea: (id: string) => void;
}

export default function AreaBudgetView({
    materialsByArea,
    allAreas,
    expandedAreas,
    toggleArea,
    onAddMaterial,
    onEditMaterial,
    onDeleteMaterial,
    onDeleteArea,
    onEditArea
}: AreaBudgetViewProps) {
    return (
        <View>
            {allAreas.map(area => {
                const areaId = area.id;
                const areaMats = materialsByArea[areaId] || [];
                const areaName = area?.name || 'New Area';
                const areaTotal = areaMats.reduce((sum, m) => sum + (m.total_value || 0), 0);
                const isExpanded = expandedAreas[areaId] !== false; // Default to expanded

                // Split into Main and Sundries (Robust case-insensitive check)
                const mainCategories = ['tile', 'stone', 'base'];
                const sundryCategories = ['grout', 'setting materials', 'sundries', 'consumable', 'grout/caulk', 'tools'];

                const mainMaterials = areaMats.filter(m => {
                    const cat = (m.category || '').toLowerCase();
                    return mainCategories.includes(cat) || (!sundryCategories.includes(cat) && cat !== 'generic');
                });

                const sundries = areaMats.filter(m => sundryCategories.includes((m.category || '').toLowerCase()));

                // Catch any remaining (e.g. 'Generic' if not matching main)
                const others = areaMats.filter(m => !mainMaterials.includes(m) && !sundries.includes(m));

                const renderMaterialRow = (m: ProjectMaterial) => {
                    const wasteQty = (m.net_qty || 0) * ((m.waste_percent || 0) / 100);
                    const toBuy = Math.max(0, m.budget_qty - (m.shop_stock + m.received_at_job));
                    const unit = m.unit || 'sqft';

                    // Helper for Piece Count
                    const renderPcs = (qty: number) => {
                        const cat = (m.category || '').toLowerCase();
                        const isSundry = sundryCategories.includes(cat);

                        // Don't show piece counts for sundries/grout
                        if (isSundry) return null;

                        if (!m.pcs_per_unit || m.pcs_per_unit === 0) return null;

                        const pcs = Math.round(qty * m.pcs_per_unit);
                        // Hide if result is 1 piece (redundant for non-tile)
                        if (pcs === 1 && !mainCategories.includes(cat)) return null;

                        return (
                            <Text className="text-[10px] text-slate-400 font-medium text-center leading-tight">({pcs.toLocaleString()} Pcs)</Text>
                        );
                    };

                    const renderQuantityWithUnit = (qty: number, isNet: boolean = false) => {
                        const cat = (m.category || '').toLowerCase();
                        // For Net Qty on Grout/Setting Materials, always show 'sqft'
                        const displayUnit = (isNet && (cat === 'grout' || cat === 'setting materials')) ? 'sqft' : unit;

                        return (
                            <View className="flex-row items-baseline justify-center">
                                <Text className="text-[14px] font-inter font-bold text-slate-600">{qty?.toLocaleString() || 0}</Text>
                                <Text className="text-[10px] text-slate-400 font-medium ml-0.5">{displayUnit}</Text>
                            </View>
                        );
                    };

                    return (
                        <View key={m.id} className="flex-row px-3 py-3 border-b border-slate-50 items-center min-h-[50px]">
                            <View className="flex-[1.2]">
                                <Text className="font-inter font-black text-slate-900 text-[14px] leading-tight" numberOfLines={1}>{m.sub_location || '--'}</Text>
                                <Text className="text-[11px] text-slate-400 font-inter font-bold uppercase tracking-tighter" numberOfLines={1}>{m.zone || 'No Zone'}</Text>
                            </View>
                            <View className="flex-[2] px-2">
                                <Text className="font-inter font-black text-slate-900 text-[15px] leading-tight" numberOfLines={1}>{m.product_code || 'N/A'}</Text>
                                <Text className="text-[13px] text-slate-400 font-inter font-bold" numberOfLines={1}>{m.product_name}</Text>
                            </View>
                            <View className="flex-1 items-center">
                                <Text className="text-[13px] text-slate-600 font-inter font-bold text-center" numberOfLines={1}>
                                    {m.dim_length && m.dim_width ? `${m.dim_length}x${m.dim_width}` : '--'}
                                </Text>
                                {m.dim_thickness && <Text className="text-[10px] text-slate-400 font-bold uppercase">{m.dim_thickness}</Text>}
                            </View>
                            <View className="flex-1 items-center px-1">
                                <Text className="text-[13px] text-slate-600 font-inter font-bold text-center" numberOfLines={2}>{m.grout_info || '--'}</Text>
                            </View>
                            <View className="flex-1 items-center px-1">
                                <Text className="text-[13px] text-slate-600 font-inter font-bold text-center" numberOfLines={2}>{m.caulk_info || '--'}</Text>
                            </View>
                            <View className="flex-[0.8] items-center">
                                {renderQuantityWithUnit(m.net_qty, true)}
                                {renderPcs(m.net_qty || 0)}
                            </View>
                            <View className="flex-[0.7] items-center">
                                <Text className="text-[13px] font-inter font-bold text-slate-400">{m.waste_percent || 0}%</Text>
                            </View>
                            <View className="flex-[0.8] items-center">
                                {renderQuantityWithUnit(wasteQty, true)}
                            </View>
                            <View className="flex-[1] items-center">
                                {renderQuantityWithUnit(m.budget_qty)}
                                {renderPcs(m.budget_qty)}
                            </View>
                            <View className="flex-[1] items-center">
                                {renderQuantityWithUnit(m.shop_stock)}
                                {renderPcs(m.shop_stock)}
                            </View>
                            <View className="flex-[1] items-center">
                                {renderQuantityWithUnit(m.received_at_job)}
                                {renderPcs(m.received_at_job)}
                            </View>
                            <View className="flex-[1] items-center">
                                <View className="flex-row items-baseline justify-center">
                                    <Text className={`text-[15px] font-inter font-black ${toBuy > 0 ? 'text-red-600' : 'text-slate-300'}`}>{toBuy.toLocaleString()}</Text>
                                    <Text className="text-[10px] text-slate-400 font-medium ml-0.5">{unit}</Text>
                                </View>
                                {renderPcs(toBuy)}
                            </View>
                            <View className="w-20 flex-row justify-end gap-3 px-2">
                                <TouchableOpacity onPress={() => onEditMaterial(m)}>
                                    <Ionicons name="pencil-outline" size={18} color="#94a3b8" />
                                </TouchableOpacity>
                                <Pressable
                                    onPress={() => {
                                        console.log("[AreaBudgetView] Delete clicked for material:", m.id);
                                        onDeleteMaterial(m.id);
                                    }}
                                    hitSlop={15}
                                    style={({ pressed }) => [
                                        { opacity: pressed ? 0.5 : 1 },
                                        Platform.OS === 'web' ? { cursor: 'pointer' } : {}
                                    ]}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#f87171" />
                                </Pressable>
                            </View>
                        </View>
                    );
                };

                return (
                    <View key={areaId} className="bg-white rounded-2xl border border-slate-200 mb-8 overflow-hidden shadow-md">
                        <View className="p-4 bg-slate-900 flex-row justify-between items-center">
                            <View className="flex-row items-center gap-4">
                                <TouchableOpacity
                                    onPress={() => toggleArea(areaId)}
                                    className="bg-white/10 w-8 h-8 rounded-lg items-center justify-center"
                                >
                                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={16} color="white" />
                                </TouchableOpacity>
                                <View>
                                    <Text className="text-white font-inter font-black text-lg tracking-tight">{areaName}</Text>
                                    <Text className="text-blue-400 text-[13px] font-inter font-black uppercase tracking-widest">
                                        {area?.description || 'Area Logistics Breakdown'}
                                    </Text>
                                </View>
                            </View>
                            <View className="flex-row items-center gap-2">
                                <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 mr-2">
                                    <View>
                                        <Text className="text-white font-inter font-black text-xs">Value: ${areaTotal.toLocaleString()}</Text>
                                        <Text className="text-[8px] text-white/40 font-bold">M:{mainMaterials.length} S:{sundries.length} O:{others.length}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => onEditArea(areaId)}
                                    className="bg-white/10 w-8 h-8 rounded-lg items-center justify-center mr-1"
                                >
                                    <Ionicons name="pencil" size={14} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => onAddMaterial(areaId)}
                                    className="bg-blue-600 w-8 h-8 rounded-lg items-center justify-center"
                                >
                                    <Ionicons name="add" size={18} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => onDeleteArea(areaId)}
                                    className="bg-red-500/20 w-8 h-8 rounded-lg items-center justify-center ml-1"
                                >
                                    <Ionicons name="trash-outline" size={16} color="#f87171" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {isExpanded && (
                            <>
                                <View className="flex-row px-3 py-2 bg-slate-50 border-b border-slate-100 items-center">
                                    <Text className="flex-[1.2] text-[11px] font-inter font-black text-slate-400 uppercase">LOC / ZONE</Text>
                                    <Text className="flex-[2] text-[11px] font-inter font-black text-slate-400 uppercase px-2">MATERIAL</Text>
                                    <Text className="flex-1 text-[11px] font-inter font-black text-slate-400 uppercase text-center">DIMS</Text>
                                    <Text className="flex-1 text-[11px] font-inter font-black text-slate-400 uppercase text-center">GROUT</Text>
                                    <Text className="flex-1 text-[11px] font-inter font-black text-slate-400 uppercase text-center">CAULK</Text>
                                    <Text className="flex-[0.8] text-[11px] font-inter font-black text-slate-400 uppercase text-center">NET</Text>
                                    <Text className="flex-[0.7] text-[11px] font-inter font-black text-slate-400 uppercase text-center">WASTE %</Text>
                                    <Text className="flex-[0.8] text-[11px] font-inter font-black text-slate-400 uppercase text-center">WASTE</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-slate-900 uppercase text-center">BUDGET</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-blue-600 uppercase text-center">STOCK</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-emerald-600 uppercase text-center">SHIPPED</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-slate-900 uppercase text-center">TO BUY</Text>
                                    <View className="w-20" />
                                </View>

                                {mainMaterials.map(renderMaterialRow)}

                                {sundries.length > 0 && (
                                    <>
                                        <View className="px-3 py-3 bg-indigo-50/30 border-y border-indigo-100 flex-row items-center gap-2">
                                            <Ionicons name="layers" size={16} color="#6366f1" />
                                            <Text className="text-[14px] font-inter font-black text-indigo-800 uppercase tracking-widest">SETTING MATERIALS & SUNDRIES</Text>
                                        </View>
                                        {sundries.map(renderMaterialRow)}
                                    </>
                                )}

                                {others.length > 0 && (
                                    <>
                                        <View className="px-3 py-3 bg-slate-100 border-y border-slate-200 flex-row items-center gap-2">
                                            <Ionicons name="help-circle" size={16} color="#64748b" />
                                            <Text className="text-[14px] font-inter font-black text-slate-600 uppercase tracking-widest">MISC / OTHER ITEMS</Text>
                                        </View>
                                        {others.map(renderMaterialRow)}
                                    </>
                                )}
                            </>
                        )}
                    </View>
                );
            })}

        </View>
    );
}
