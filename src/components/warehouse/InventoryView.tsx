import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, LayoutAnimation, Platform, UIManager, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService } from '../../services/SupabaseService';
import { supabase } from '../../config/supabase';
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
    const [adjustmentModal, setAdjustmentModal] = useState({ visible: false, material: null as any, value: '' });

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await SupabaseService.getWarehouseInventory();
            setMaterials(data);

            const allJobIds = new Set(data.map(m => m.job_id).filter(id => id !== null));
            setExpandedJobs(allJobIds);
        } catch (error: any) {
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

    const handleManualAdjustment = async () => {
        if (!adjustmentModal.material || !adjustmentModal.value) return;
        try {
            const adjustment = parseFloat(adjustmentModal.value);
            if (isNaN(adjustment)) {
                Alert.alert("Invalid input", "Please enter a valid number");
                return;
            }

            await SupabaseService.manualStockUpdate(adjustmentModal.material.id, adjustment);
            setAdjustmentModal({ visible: false, material: null, value: '' });
            loadData();
            Alert.alert("Success", "Stock updated successfully");
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to update stock");
        }
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
                <View className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <Box size={18} color="#6366f1" className="mr-2" />
                        <Text className="text-sm font-bold text-slate-700">General Stock (Unallocated)</Text>
                    </View>
                    <View className="bg-slate-200 px-2 py-0.5 rounded">
                        <Text className="text-[10px] font-bold text-slate-600">{generalItems.length} SKUs</Text>
                    </View>
                </View>

                {generalItems.length === 0 ? (
                    <View className="p-8 items-center">
                        <Text className="text-slate-400 text-sm mb-4">No general stock items found.</Text>
                        <TouchableOpacity
                            className="bg-indigo-600 px-4 py-2 rounded-lg flex-row items-center gap-2"
                            onPress={() => {/* This would usually navigate to a 'Add Material' form */
                                Alert.alert("Feature coming soon", "To add new general stock, please use the 'Add material' feature in a job or global hub.");
                            }}
                        >
                            <Ionicons name="add-circle" size={18} color="white" />
                            <Text className="text-white font-bold">Create General SKU</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap p-3">
                        {generalItems.map((item: any) => (
                            <View key={item.id} className="w-full md:w-1/4 p-2">
                                <View className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-full justify-between">
                                    <View>
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.product_code}</Text>
                                            <TouchableOpacity
                                                className="bg-indigo-50 p-2 rounded-xl"
                                                onPress={() => setAdjustmentModal({ visible: true, material: item, value: '' })}
                                            >
                                                <Ionicons name="add" size={18} color="#6366f1" />
                                            </TouchableOpacity>
                                        </View>
                                        <Text className="text-lg font-black text-slate-900 mb-1 leading-tight">{item.product_name}</Text>
                                        <Text className="text-[10px] font-bold text-slate-400 uppercase">General Stock</Text>
                                    </View>

                                    <View className="mt-6">
                                        <Text className="text-2xl font-black text-slate-900">
                                            {Math.round(item.in_warehouse_qty || 0)} <Text className="text-xs font-bold text-slate-400 uppercase">{item.unit}</Text>
                                        </Text>
                                        <Text className="text-[10px] font-bold text-slate-300 uppercase">In Warehouse</Text>
                                    </View>
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

            {
                allocatedJobs.map((job: any) => {
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
                                <View className="flex-row flex-wrap p-3">
                                    {job.items.map((item: any) => (
                                        <View key={item.id} className="w-full md:w-1/4 p-2">
                                            <View className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm h-full justify-between">
                                                <View>
                                                    <View className="flex-row items-center justify-between mb-2">
                                                        <View className="flex-1 mr-2">
                                                            <View className="flex-row items-center gap-2">
                                                                <Text className="text-base font-black text-slate-900 tracking-tight">{item.product_code || 'NO CODE'}</Text>
                                                                {item.category === 'Tile' && (
                                                                    <View className="bg-amber-100 px-1.5 py-0.5 rounded">
                                                                        <Text className="text-[8px] font-black text-amber-700 uppercase">Tile</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <Text className="text-xs font-medium text-slate-500 mt-0.5" numberOfLines={1}>
                                                                {item.product_name}
                                                                {(item.dim_length && item.dim_width) ? ` | ${item.dim_length}x${item.dim_width}` : ''}
                                                            </Text>
                                                        </View>
                                                        <TouchableOpacity
                                                            className="bg-indigo-50 p-2 rounded-xl"
                                                            onPress={() => setAdjustmentModal({ visible: true, material: item, value: '' })}
                                                        >
                                                            <Ionicons name="add" size={18} color="#6366f1" />
                                                        </TouchableOpacity>
                                                    </View>

                                                    <View className="flex-row items-center gap-1 mt-2">
                                                        <Text className="text-[10px] font-bold text-slate-400 uppercase">Shipped:</Text>
                                                        <Text className="text-[10px] font-black text-slate-600 uppercase">
                                                            {Math.round(item.received_at_job || 0)} {item.unit || 'sqft'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <View className="mt-6 pt-4 border-t border-slate-50">
                                                    <Text className="text-2xl font-black text-indigo-600">
                                                        {Math.round(item.in_warehouse_qty || 0)} <Text className="text-xs font-bold text-indigo-400 uppercase">{item.unit || 'sqft'}</Text>
                                                    </Text>
                                                    <View className="flex-row items-center justify-between">
                                                        <Text className="text-[10px] font-bold text-slate-300 uppercase">In Warehouse</Text>
                                                        {item.category === 'Tile' && (
                                                            <Text className="text-[9px] font-bold text-indigo-300 uppercase">
                                                                ~{Math.round((item.in_warehouse_qty || 0) * (item.pcs_per_unit || 1))} PCS
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })
            }

            {/* ADJUSTMENT MODAL */}
            <Modal
                visible={adjustmentModal.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setAdjustmentModal({ ...adjustmentModal, visible: false })}
            >
                <View className="flex-1 bg-black/40 items-center justify-center p-6">
                    <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-lg font-black text-slate-900">Adjust Stock</Text>
                                <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{adjustmentModal.material?.product_name}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setAdjustmentModal({ ...adjustmentModal, visible: false })}
                                className="bg-slate-100 p-2 rounded-xl"
                            >
                                <Ionicons name="close" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View className="mb-6">
                            <Text className="text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Adjustment Amount (+/-)</Text>
                            <View className="bg-slate-50 border border-slate-200 rounded-2xl px-4 h-14 flex-row items-center shadow-inner">
                                <TextInput
                                    className="flex-1 text-lg font-black text-slate-900 h-full"
                                    placeholder="e.g. 50 or -10"
                                    keyboardType="numeric"
                                    value={adjustmentModal.value}
                                    onChangeText={(val) => setAdjustmentModal({ ...adjustmentModal, value: val })}
                                    autoFocus
                                    style={{ outlineStyle: 'none' } as any}
                                />
                                <Text className="text-xs font-black text-slate-400 ml-2">{adjustmentModal.material?.unit}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleManualAdjustment}
                            className="bg-indigo-600 h-14 rounded-2xl items-center justify-center shadow-lg shadow-indigo-200"
                        >
                            <Text className="text-white font-black text-base uppercase tracking-widest text-center px-4">Apply Adjustment</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView >
    );
}
