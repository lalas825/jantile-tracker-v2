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
                    <View key={areaId} className="bg-white border border-slate-200 mb-10 overflow-hidden shadow-sm mx-8 rounded-3xl">
                        <View className="p-5 bg-slate-900 flex-row justify-between items-center">
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
                                    onPress={() => onDeleteArea(areaId, isVirtual)}
                                    className="bg-red-500/20 w-8 h-8 rounded-lg items-center justify-center ml-1"
                                >
                                    <Ionicons name="trash-outline" size={16} color="#f87171" />
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
