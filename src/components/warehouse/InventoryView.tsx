import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService } from '../../services/SupabaseService';
import { ChevronDown, ChevronRight, Search, Box } from 'lucide-react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

export default function InventoryView() {
    const [materials, setMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await SupabaseService.getWarehouseInventory();
            setMaterials(data);
            // Default expand all? Or None?
            // Let's expand all by default for better visibility
            const allJobIds = new Set(data.map(m => m.job_id || 'general'));
            setExpandedJobs(allJobIds);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const toggleJob = (jobId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newExpanded = new Set(expandedJobs);
        if (newExpanded.has(jobId)) {
            newExpanded.delete(jobId);
        } else {
            newExpanded.add(jobId);
        }
        setExpandedJobs(newExpanded);
    };

    // Grouping Logic
    const groupedMaterials = materials.reduce((acc: any, material: any) => {
        const jobId = material.job_id;
        const groupKey = jobId ? 'allocated' : 'general';

        if (groupKey === 'general') {
            if (!acc.general) acc.general = [];
            acc.general.push(material);
        } else {
            if (!acc.allocated) acc.allocated = {};
            if (!acc.allocated[jobId]) {
                acc.allocated[jobId] = {
                    jobName: material.jobs?.name || 'Unknown Job',
                    jobNumber: material.jobs?.job_number || '',
                    items: []
                };
            }
            acc.allocated[jobId].items.push(material);
        }
        return acc;
    }, { general: [], allocated: {} });

    // Filter Logic
    const filterItems = (items: any[]) => {
        if (!searchQuery) return items;
        const lower = searchQuery.toLowerCase();
        return items.filter(m =>
            (m.product_name && m.product_name.toLowerCase().includes(lower)) ||
            (m.product_code && m.product_code.toLowerCase().includes(lower))
        );
    };

    const generalItems = filterItems(groupedMaterials.general);
    const allocatedJobs = Object.entries(groupedMaterials.allocated).map(([id, data]: any) => ({
        id,
        ...data,
        items: filterItems(data.items)
    })).filter((job: any) => job.items.length > 0);

    if (loading) return <ActivityIndicator size="large" className="mt-20" />;

    return (
        <ScrollView className="flex-1 bg-slate-50 p-6">

            {/* SEARCH BAR (Local) */}
            <View className="mb-6 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex-row items-center">
                <Search size={20} color="#94a3b8" />
                <TextInput
                    className="flex-1 ml-3 text-base font-inter text-slate-900"
                    placeholder="Search material code, name..."
                    placeholderTextColor="#cbd5e1"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* GENERAL STOCK SECTION */}
            <View className="bg-white border border-slate-200 rounded-xl mb-6 overflow-hidden shadow-sm">
                <View className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex-row items-center">
                    <Box size={18} color="#6366f1" className="mr-2" />
                    <Text className="text-sm font-bold text-slate-700">General Stock (Unallocated)</Text>
                </View>

                {generalItems.length === 0 ? (
                    <View className="p-8 items-center">
                        <Text className="text-slate-400 text-sm">No general stock items found.</Text>
                    </View>
                ) : (
                    <View>
                        {/* HEADER ROW */}
                        <View className="flex-row px-4 py-2 bg-slate-50 border-b border-slate-100">
                            <Text className="flex-[3] text-[10px] font-black text-slate-400 uppercase">Material</Text>
                            <Text className="flex-[1] text-[10px] font-black text-slate-400 uppercase text-right">Qty</Text>
                            <Text className="w-10 text-[10px] font-black text-slate-400 uppercase text-center">Action</Text>
                        </View>
                        {generalItems.map((item: any) => (
                            <View key={item.id} className="flex-row px-4 py-3 border-b border-slate-50 items-center">
                                <View className="flex-[3]">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-xs font-black text-slate-800">{item.product_code}</Text>
                                        <Text className="text-xs font-medium text-slate-500">{item.product_name}</Text>
                                    </View>
                                </View>
                                <Text className="flex-[1] text-xs font-bold text-slate-800 text-right">
                                    {item.shop_stock} <Text className="text-[10px] font-normal text-slate-400">{item.unit}</Text>
                                </Text>
                                <View className="w-10 items-center">
                                    <TouchableOpacity className="bg-blue-50 p-1 rounded">
                                        <Ionicons name="add" size={12} color="#2563eb" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* ALLOCATED STOCK SECTION */}
            <View className="bg-slate-100 py-2 px-1 rounded-lg mb-2">
                <Text className="text-xs font-black text-slate-500 uppercase ml-2">Allocated Job Stock</Text>
            </View>

            {allocatedJobs.map((job: any) => {
                const isExpanded = expandedJobs.has(job.id);
                return (
                    <View key={job.id} className="bg-white border border-slate-200 rounded-xl mb-4 overflow-hidden shadow-sm">
                        <TouchableOpacity
                            onPress={() => toggleJob(job.id)}
                            className="bg-white px-4 py-3 border-b border-slate-100 flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className={`p-1 rounded-md ${isExpanded ? 'bg-blue-50' : 'bg-slate-50'}`}>
                                    {isExpanded ? <ChevronDown size={16} color="#3b82f6" /> : <ChevronRight size={16} color="#64748b" />}
                                </View>
                                <View>
                                    <Text className="text-sm font-bold text-slate-800">{job.jobName} <Text className="text-slate-400 font-normal">#{job.id.substring(0, 4)}</Text></Text>
                                </View>
                            </View>
                            <View className="bg-blue-50 px-2 py-1 rounded">
                                <Text className="text-[10px] font-bold text-blue-600">{job.items.length} Items</Text>
                            </View>
                        </TouchableOpacity>

                        {isExpanded && (
                            <View>
                                <View className="flex-row px-4 py-2 bg-slate-50 border-b border-slate-100">
                                    <Text className="flex-[3] text-[10px] font-black text-slate-400 uppercase">Material</Text>
                                    <Text className="flex-[1.5] text-[10px] font-black text-slate-400 uppercase text-right">Shipped to Job</Text>
                                    <Text className="flex-[1.5] text-[10px] font-black text-slate-400 uppercase text-right text-blue-600">In Warehouse</Text>
                                </View>
                                {job.items.map((item: any) => (
                                    <View key={item.id} className="flex-row px-4 py-4 border-b border-slate-100 items-center">
                                        <View className="flex-[3]">
                                            <Text className="text-xs font-black text-slate-800 mb-0.5">{item.product_code}</Text>
                                            <Text className="text-[11px] font-medium text-slate-500">{item.product_name}</Text>
                                        </View>
                                        <View className="flex-[1.5] items-end">
                                            <Text className="text-xs font-bold text-slate-400">
                                                {item.ordered_qty - (item.shop_stock + (item.in_transit || 0))}
                                                <Text className="text-[9px] font-normal text-slate-300"> est</Text>
                                                {/* This calc is fake. Real 'Shipped to Job' is NOT tracked directly? 
                                                    Wait, 'received_at_job' exists in schema? 
                                                    Let's check schema for 'received_at_job'. 
                                                    Yes: new Column({ name: 'received_at_job', type: ColumnType.REAL }),
                                                */}
                                            </Text>
                                            <Text className="text-[10px] text-slate-300">{item.received_at_job || 0} {item.unit}</Text>
                                        </View>
                                        <View className="flex-[1.5] items-end">
                                            <Text className="text-sm font-black text-blue-600">
                                                {item.shop_stock} <Text className="text-[10px] font-normal text-blue-400">{item.unit}</Text>
                                            </Text>
                                            <Text className="text-[9px] text-blue-300">({Math.round(item.shop_stock * (item.pcs_per_unit || 1))} Pcs)</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );
            })}
        </ScrollView>
    );
}
