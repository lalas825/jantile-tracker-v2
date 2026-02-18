import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectMaterial, SupabaseService } from '../../services/SupabaseService';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

interface AllocateStockModalProps {
    visible: boolean;
    onClose: () => void;
    material: ProjectMaterial | null;
    onSuccess: () => void;
}

export default function AllocateStockModal({ visible, onClose, material, onSuccess }: AllocateStockModalProps) {
    const { session } = useAuth();
    const [jobs, setJobs] = useState<any[]>([]);
    const [selectedJob, setSelectedJob] = useState<any | null>(null);
    const [areas, setAreas] = useState<any[]>([]);
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
    const [qty, setQty] = useState('');
    const [jobSearch, setJobSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);

    useEffect(() => {
        if (visible) {
            loadJobs();
            setQty('');
            setSelectedJob(null);
            setAreas([]);
            setSelectedAreaId(null);
            setJobSearch('');
        }
    }, [visible]);

    const loadJobs = async () => {
        setIsLoadingJobs(true);
        try {
            const data = await SupabaseService.getActiveJobs();
            setJobs(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingJobs(false);
        }
    };

    const loadAreas = async (jobId: string) => {
        try {
            const data = await SupabaseService.getProjectAreas(jobId);
            setAreas(data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleJobSelect = (job: any) => {
        setSelectedJob(job);
        loadAreas(job.id);
        setJobSearch('');
    };

    const handleConfirm = async () => {
        if (!material || !selectedJob || !qty) {
            Alert.alert("Error", "Please select a job and enter a quantity");
            return;
        }

        const quantity = parseFloat(qty);
        if (isNaN(quantity) || quantity <= 0) {
            Alert.alert("Error", "Please enter a valid quantity");
            return;
        }

        if (quantity > (material.shop_stock || 0)) {
            Alert.alert("Error", "Entered quantity exceeds available stock");
            return;
        }

        setIsSaving(true);
        try {
            await SupabaseService.allocateGeneralStock({
                sourceMaterialId: material.id,
                jobId: selectedJob.id,
                jobName: selectedJob.name,
                areaId: selectedAreaId || undefined,
                qty: quantity,
                category: material.category,
                productName: material.product_name,
                productCode: material.product_code,
                unit: material.unit || 'SQFT',
                userId: session?.user?.id || 'unknown'
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to allocate stock");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredJobs = jobs.filter(j =>
        j.name.toLowerCase().includes(jobSearch.toLowerCase()) ||
        (j.address || '').toLowerCase().includes(jobSearch.toLowerCase())
    );

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 bg-black/50 justify-center items-center p-4">
                <View className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <View className="p-6 border-b border-slate-100 flex-row justify-between items-center bg-slate-50/50">
                        <View>
                            <Text className="text-xl font-black text-slate-900 tracking-tight">Ship to Job</Text>
                            <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {material?.product_code || material?.product_name}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <Ionicons name="close" size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-6 max-h-[600px]">
                        {!selectedJob ? (
                            <View>
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Select Target Project</Text>
                                <View className="bg-slate-50 border border-slate-100 rounded-2xl flex-row items-center px-4 mb-4">
                                    <Ionicons name="search" size={18} color="#94a3b8" />
                                    <TextInput
                                        className="flex-1 p-4 font-inter font-bold text-slate-700"
                                        placeholder="Search jobs..."
                                        value={jobSearch}
                                        onChangeText={setJobSearch}
                                        style={{ outline: 'none' }}
                                    />
                                </View>

                                {isLoadingJobs ? (
                                    <ActivityIndicator size="small" color="#2563eb" className="py-4" />
                                ) : (
                                    <View className="gap-2">
                                        {filteredJobs.slice(0, 5).map(job => (
                                            <TouchableOpacity
                                                key={job.id}
                                                onPress={() => handleJobSelect(job)}
                                                className="bg-white border border-slate-100 p-4 rounded-2xl flex-row justify-between items-center active:bg-slate-50"
                                            >
                                                <View>
                                                    <Text className="font-black text-slate-900">{job.name}</Text>
                                                    <Text className="text-[10px] font-bold text-slate-400">{job.address || 'No Address'}</Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View className="gap-6">
                                {/* Selected Job Display */}
                                <View className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Shipping To</Text>
                                        <Text className="text-lg font-black text-blue-900">{selectedJob.name}</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setSelectedJob(null)}
                                        className="bg-white px-3 py-1.5 rounded-lg border border-blue-100"
                                    >
                                        <Text className="text-[10px] font-black text-blue-600 uppercase">Change</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Area Selection */}
                                <View>
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Target Area (Optional)</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                        <TouchableOpacity
                                            onPress={() => setSelectedAreaId(null)}
                                            className={clsx(
                                                "px-5 py-3 rounded-2xl border-2",
                                                !selectedAreaId ? "bg-slate-900 border-slate-900" : "bg-white border-slate-100"
                                            )}
                                        >
                                            <Text className={clsx("text-xs font-black uppercase tracking-tight", !selectedAreaId ? "text-white" : "text-slate-400")}>Unspecified</Text>
                                        </TouchableOpacity>
                                        {areas.map(area => (
                                            <TouchableOpacity
                                                key={area.id}
                                                onPress={() => setSelectedAreaId(area.id)}
                                                className={clsx(
                                                    "px-5 py-3 rounded-2xl border-2",
                                                    selectedAreaId === area.id ? "bg-slate-900 border-slate-900" : "bg-white border-slate-100"
                                                )}
                                            >
                                                <Text className={clsx("text-xs font-black uppercase tracking-tight", selectedAreaId === area.id ? "text-white" : "text-slate-400")}>{area.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Quantity Input */}
                                <View>
                                    <View className="flex-row justify-between items-end mb-2 px-1">
                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity to ship</Text>
                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available: {material?.shop_stock} {material?.unit || 'SQFT'}</Text>
                                    </View>
                                    <View className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex-row items-center justify-between">
                                        <TextInput
                                            className="flex-1 text-2xl font-black text-slate-900 h-10"
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            value={qty}
                                            onChangeText={setQty}
                                            style={{ outline: 'none' }}
                                        />
                                        <Text className="text-sm font-black text-slate-400 uppercase ml-2">{material?.unit || 'SQFT'}</Text>
                                    </View>
                                </View>

                                <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex-row gap-3 items-start">
                                    <Ionicons name="information-circle" size={20} color="#64748b" />
                                    <Text className="flex-1 text-[11px] font-medium text-slate-500 leading-4">
                                        Confirming this will create a new <Text className="font-black text-slate-900">Delivery Ticket (Draft)</Text> for this job and deduct the stock from the general inventory.
                                    </Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View className="p-6 bg-slate-50 border-t border-slate-100 flex-row gap-3">
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 bg-white border border-slate-200 p-4 rounded-2xl items-center"
                        >
                            <Text className="text-slate-600 font-black uppercase tracking-widest text-xs">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleConfirm}
                            disabled={isSaving || !selectedJob || !qty}
                            className={clsx(
                                "flex-[2] p-4 rounded-2xl items-center flex-row justify-center gap-2 shadow-lg",
                                !selectedJob || !qty ? "bg-slate-200" : "bg-blue-600 shadow-blue-100"
                            )}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Ionicons name="send" size={16} color="white" />
                                    <Text className="text-white font-black uppercase tracking-widest text-xs">Confirm Allocation</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
