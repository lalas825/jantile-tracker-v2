import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectMaterial } from '../../services/SupabaseService';
import UnifiedLogisticsTable from './UnifiedLogisticsTable';

interface AreaBudgetViewProps {
    materialsByArea: Record<string, ProjectMaterial[]>;
    allAreas: any[];
    expandedAreas: Record<string, boolean>;
    toggleArea: (areaId: string) => void;
    onAddMaterial: (areaId: string) => void;
    onEditMaterial: (material: ProjectMaterial) => void;
    onDeleteMaterial: (id: string) => void;
    onDeleteArea: (id: string, isVirtual: boolean) => void;
    onEditArea: (id: string) => void;
    onOrder: (material: any) => void;
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
    onEditArea,
    onOrder
}: AreaBudgetViewProps) {
    return (
        <ScrollView className="flex-1">
            {allAreas.map(area => {
                const areaId = area.id;
                const isVirtual = !!area.is_virtual;
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

                return (
                    <View key={areaId} className="bg-white border border-slate-200 mb-10 overflow-hidden shadow-xl shadow-slate-100 mx-8 rounded-[32px]">
                        <View className="px-6 py-5 bg-slate-50 flex-row justify-between items-center border-b border-slate-200">
                            <View className="flex-row items-center gap-4">
                                <TouchableOpacity
                                    onPress={() => toggleArea(areaId)}
                                    className="bg-white border border-slate-200 w-10 h-10 rounded-xl items-center justify-center shadow-sm"
                                >
                                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={18} color="#64748b" />
                                </TouchableOpacity>
                                <View>
                                    <Text className="text-slate-900 font-inter font-black text-xl tracking-tight">{areaName}</Text>
                                    <Text className="text-blue-600 text-[11px] font-inter font-black uppercase tracking-widest mt-0.5">
                                        {area?.description || 'Area Logistics Breakdown'}
                                    </Text>
                                </View>
                            </View>
                            <View className="flex-row items-center gap-3">
                                <View className="bg-white px-4 py-2 rounded-2xl border border-slate-200 mr-2 shadow-sm">
                                    <View className="flex-row items-center gap-3">
                                        <View>
                                            <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-0.5">Area Value</Text>
                                            <Text className="text-slate-900 font-inter font-black text-sm">${areaTotal.toLocaleString()}</Text>
                                        </View>
                                        <View className="w-px h-6 bg-slate-200 mx-1" />
                                        <View>
                                            <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-0.5">Summary</Text>
                                            <Text className="text-slate-700 font-bold text-[10px]">M:{mainMaterials.length} S:{sundries.length} O:{others.length}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View className="flex-row items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                                    <TouchableOpacity
                                        onPress={() => onEditArea(areaId)}
                                        className="w-10 h-10 rounded-xl items-center justify-center"
                                    >
                                        <Ionicons name="pencil" size={16} color="#64748b" />
                                    </TouchableOpacity>
                                    <View className="w-px h-6 bg-slate-100" />
                                    <TouchableOpacity
                                        onPress={() => onDeleteArea(areaId, isVirtual)}
                                        className="w-10 h-10 rounded-xl items-center justify-center"
                                    >
                                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => onAddMaterial(areaId)}
                                    className="bg-slate-900 w-11 h-11 rounded-2xl items-center justify-center shadow-lg shadow-slate-200 active:bg-slate-800"
                                >
                                    <Ionicons name="add" size={24} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {isExpanded && (
                            <View>
                                <UnifiedLogisticsTable
                                    materials={mainMaterials}
                                    viewMode="area"
                                    onEditMaterial={onEditMaterial}
                                    onDeleteMaterial={onDeleteMaterial}
                                    onOrder={onOrder}
                                />

                                {sundries.length > 0 && (
                                    <>
                                        <View className="px-5 py-3 bg-indigo-50 border-y border-indigo-100 flex-row items-center gap-2 w-full">
                                            <Ionicons name="layers" size={16} color="#6366f1" />
                                            <Text className="text-[14px] font-inter font-black text-indigo-800 uppercase tracking-widest">SETTING MATERIALS</Text>
                                        </View>
                                        <UnifiedLogisticsTable
                                            materials={sundries}
                                            viewMode="area"
                                            onEditMaterial={onEditMaterial}
                                            onDeleteMaterial={onDeleteMaterial}
                                            onOrder={onOrder}
                                        />
                                    </>
                                )}

                                {others.length > 0 && (
                                    <>
                                        <View className="px-5 py-3 bg-slate-100 border-y border-slate-200 flex-row items-center gap-2 w-full">
                                            <Ionicons name="help-circle" size={16} color="#64748b" />
                                            <Text className="text-[14px] font-inter font-black text-slate-600 uppercase tracking-widest">MISC / OTHER ITEMS</Text>
                                        </View>
                                        <UnifiedLogisticsTable
                                            materials={others}
                                            viewMode="area"
                                            onEditMaterial={onEditMaterial}
                                            onDeleteMaterial={onDeleteMaterial}
                                            onOrder={onOrder}
                                        />
                                    </>
                                )}
                            </View>
                        )}
                    </View>
                );
            })}

        </ScrollView>
    );
}
