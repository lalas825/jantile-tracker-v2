import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PurchaseOrder } from '../../services/SupabaseService';
import UnifiedLogisticsTable from './UnifiedLogisticsTable';

interface ProjectTotalViewProps {
    aggregatedMaterials: any[];
    categories: { label: string; tags: string[] }[];
    expandedSections: Record<string, boolean>;
    toggleSection: (section: string) => void;
    purchaseOrders: PurchaseOrder[];
    onOrder: (material: any) => void;
}

export default function ProjectTotalView({
    aggregatedMaterials,
    categories,
    expandedSections,
    toggleSection,
    purchaseOrders,
    onOrder
}: ProjectTotalViewProps) {

    return (
        <ScrollView className="mt-6 w-full">
            <View className="px-8 mb-8 flex-row justify-between items-center">
                <Text className="text-xl font-inter font-black text-slate-900 tracking-tight">Project Material Summary</Text>
                <View className="flex-row items-center bg-white px-4 py-2 rounded-xl border border-slate-200 w-64 shadow-sm">
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput className="ml-2 text-sm text-slate-900 font-inter font-bold flex-1" placeholder="Search product totals..." />
                </View>
            </View>

            {categories.map((group, idx) => {
                const lowerTags = group.tags.map(t => t.toLowerCase());

                const groupMats = aggregatedMaterials.filter(m => {
                    const cat = (m.category || '').toLowerCase();
                    const matchedByCurrent = lowerTags.includes(cat);

                    if (idx === categories.length - 1) {
                        const matchedByPrevious = categories.slice(0, idx).some(prev =>
                            prev.tags.map(t => t.toLowerCase()).includes(cat)
                        );
                        return matchedByCurrent || !matchedByPrevious;
                    }

                    return matchedByCurrent;
                });

                if (groupMats.length === 0 && idx < categories.length - 1) {
                    return null;
                }

                const totalValue = groupMats.reduce((sum, m) => sum + Number(m.total_value || 0), 0);
                const isExpanded = expandedSections[group.label];

                return (
                    <View key={group.label} className="bg-white border border-slate-200 mb-10 overflow-hidden shadow-sm mx-8 rounded-3xl">
                        <TouchableOpacity
                            onPress={() => toggleSection(group.label)}
                            className="p-5 flex-row justify-between items-center border-b border-slate-50"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-blue-50 p-1.5 rounded-lg">
                                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={16} color="#2563eb" />
                                </View>
                                <Text className="font-inter font-black text-slate-800 tracking-widest text-xs uppercase">{group.label} (TOTALS)</Text>
                            </View>
                            <View className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                <Text className="text-emerald-700 font-inter font-black text-xs">${totalValue.toLocaleString()}</Text>
                            </View>
                        </TouchableOpacity>

                        {isExpanded && (
                            <View>
                                {groupMats.length === 0 ? (
                                    <View className="p-12 items-center">
                                        <Text className="text-slate-400 font-bold italic">No materials found for this category</Text>
                                    </View>
                                ) : (
                                    <UnifiedLogisticsTable
                                        materials={groupMats}
                                        viewMode="project"
                                        onOrder={onOrder}
                                    />
                                )}
                            </View>
                        )}
                    </View>
                );
            })}

            {/* VENDOR ORDERS SECTION */}
            <View className="pb-20">
                <Text className="text-xl font-inter font-black text-slate-900 tracking-tight mb-8 mt-10 px-8">Vendor Order History</Text>
                <View className="bg-white border border-slate-200 shadow-sm overflow-hidden mx-8 rounded-3xl mb-10">
                    <TouchableOpacity
                        onPress={() => toggleSection('VENDOR ORDERS')}
                        className="p-5 flex-row justify-between items-center border-b border-blue-100 bg-blue-50/30"
                    >
                        <View className="flex-row items-center gap-3">
                            <View className="bg-blue-500 p-1.5 rounded-lg">
                                <Ionicons name="cart" size={16} color="white" />
                            </View>
                            <Text className="font-inter font-black text-blue-800 tracking-widest text-xs uppercase">PO LOG</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <View className="bg-blue-500 w-5 h-5 rounded-full items-center justify-center">
                                <Text className="text-[10px] font-black text-white">{purchaseOrders.length}</Text>
                            </View>
                            <Ionicons name={expandedSections['VENDOR ORDERS'] ? "chevron-down" : "chevron-forward"} size={18} color="#2563eb" />
                        </View>
                    </TouchableOpacity>

                    {expandedSections['VENDOR ORDERS'] && (
                        <View className="p-6">
                            <View className="flex-row flex-wrap gap-4">
                                {purchaseOrders.length === 0 ? (
                                    <View className="w-full py-12 items-center">
                                        <Text className="text-slate-400 italic font-inter font-bold">No purchase orders found</Text>
                                    </View>
                                ) : (
                                    purchaseOrders.map(p => (
                                        <View key={p.id} className="w-[48%] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            <View className="p-4 border-b border-slate-50 flex-row justify-between items-center">
                                                <View>
                                                    <View className="flex-row items-center gap-2">
                                                        <Text className="font-black text-slate-900 text-[15px]">{p.po_number}</Text>
                                                        <View className={`px-2 py-0.5 rounded-full ${p.status === 'Received' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                                                            <Text className={`text-[10px] font-black uppercase ${p.status === 'Received' ? 'text-emerald-700' : 'text-blue-700'}`}>{p.status}</Text>
                                                        </View>
                                                    </View>
                                                    <Text className="text-[12px] text-slate-400 font-bold mt-0.5">{p.vendor} • {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'TBD'}</Text>
                                                </View>
                                            </View>
                                            <View className="p-4 bg-slate-50/50">
                                                <View className="flex-row gap-6 items-center">
                                                    <View className="flex-row items-center gap-1.5">
                                                        <Ionicons name="cube-outline" size={14} color="#64748b" />
                                                        <Text className="text-[12px] font-black text-slate-800">{p.items?.length || 0} Items</Text>
                                                    </View>
                                                    <View className="flex-row items-center gap-1.5">
                                                        <Ionicons name="calendar-outline" size={14} color="#64748b" />
                                                        <Text className="text-[12px] font-black text-slate-800">Exp: {p.expected_date || 'TBD'}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );
}
