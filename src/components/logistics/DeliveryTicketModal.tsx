import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectMaterial, SupabaseService, formatDisplayDate, DeliveryTicket } from '../../services/SupabaseService';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';

interface DeliveryTicketModalProps {
    visible: boolean;
    onClose: () => void;
    materials: ProjectMaterial[];
    jobId: string;
    jobName: string;
    onSuccess: () => void;
    initialData?: DeliveryTicket | null;
    isFieldReview?: boolean;
    role?: 'foreman' | 'supervisor';
}

type Step = 'DESTINATION' | 'MATERIALS' | 'VENDOR_INTAKE' | 'REVIEW';

export default function DeliveryTicketModal({
    visible, onClose, materials, jobId, jobName, onSuccess,
    initialData, isFieldReview, role
}: DeliveryTicketModalProps) {
    const { session } = useAuth();
    const [step, setStep] = useState<Step>('DESTINATION');
    const [destination, setDestination] = useState<'warehouse' | 'vendor_direct'>('warehouse');
    const [selectedMaterials, setSelectedMaterials] = useState<Record<string, number>>({});
    const [vendorData, setVendorData] = useState({
        material_code: '',
        material_name: '',
        dimensions: '',
        qty: '',
        vendor_name: '',
        estimated_arrival: new Date().toISOString().split('T')[0]
    });
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueTime, setDueTime] = useState('07:00 AM');
    const [searchQuery, setSearchQuery] = useState('');
    const [inputUnits, setInputUnits] = useState<Record<string, 'sqft' | 'pcs'>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [pickerType, setPickerType] = useState<'due_date' | 'vendor_arrival'>('due_date');

    useEffect(() => {
        if (initialData && visible) {
            const isVendorDirect = initialData.destination === 'Vendor Direct';
            setDestination(isVendorDirect ? 'vendor_direct' : 'warehouse');
            setNotes(initialData.notes || '');
            setDueDate(initialData.due_date || new Date().toISOString().split('T')[0]);
            setDueTime(initialData.due_time || '07:00 AM');
            setStep('REVIEW'); // Start at review when editing

            if (isVendorDirect) {
                const firstItem = initialData.items?.[0] || {};
                setVendorData({
                    material_code: firstItem.product_code || '',
                    material_name: firstItem.product_name || '',
                    dimensions: firstItem.dimensions || '',
                    qty: String(firstItem.qty || ''),
                    vendor_name: firstItem.vendor_name || '',
                    estimated_arrival: initialData.due_date || new Date().toISOString().split('T')[0]
                });
            } else {
                const materialMap: Record<string, number> = {};
                (initialData.items || []).forEach((item: any) => {
                    if (item.material_id) {
                        materialMap[item.material_id] = item.qty || 0;
                    }
                });
                setSelectedMaterials(materialMap);
            }
        } else if (visible) {
            // Reset for new ticket
            setStep('DESTINATION');
            setDestination('warehouse');
            setSelectedMaterials({});
            setVendorData({
                material_code: '',
                material_name: '',
                dimensions: '',
                qty: '',
                vendor_name: '',
                estimated_arrival: new Date().toISOString().split('T')[0]
            });
            setNotes('');
            setDueDate(new Date().toISOString().split('T')[0]);
            setDueTime('07:00 AM');
        }
    }, [initialData, visible]);

    const onDateChange = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || new Date();
        setShowDatePicker(Platform.OS === 'ios');
        const formattedDate = currentDate.toISOString().split('T')[0];

        if (pickerType === 'due_date') {
            setDueDate(formattedDate);
        } else {
            setVendorData(prev => ({ ...prev, estimated_arrival: formattedDate }));
        }
    };

    const onTimeChange = (event: any, selectedTime?: Date) => {
        const currentTime = selectedTime || new Date();
        setShowTimePicker(Platform.OS === 'ios');
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h = hours % 12 || 12;
        const m = minutes < 10 ? `0${minutes}` : minutes;
        setDueTime(`${h}:${m} ${ampm}`);
    };

    const toggleMaterial = (id: string) => {
        setSelectedMaterials(prev => {
            const next = { ...prev };
            if (next[id] !== undefined) {
                delete next[id];
            } else {
                next[id] = 0;
            }
            return next;
        });
    };

    const updateQty = (id: string, qty: string) => {
        const mat = materials.find(m => m.id === id);
        const unit = inputUnits[id] || 'sqft';
        let val = parseFloat(qty) || 0;

        if (unit === 'pcs' && mat?.sqft_per_piece) {
            val = val * mat.sqft_per_piece;
        }

        setSelectedMaterials(prev => ({ ...prev, [id]: val }));
    };

    const toggleInputUnit = (id: string) => {
        setInputUnits(prev => ({
            ...prev,
            [id]: prev[id] === 'pcs' ? 'sqft' : 'pcs'
        }));
    };

    const handleSave = async (status: 'DRAFT' | 'PENDING_APPROVAL' | 'SCHEDULED' | 'PENDING_FIELD_REVIEW' | 'FIELD_APPROVED') => {
        setIsSaving(true);
        try {
            const isVendorDirect = destination === 'vendor_direct';
            let items = [];

            if (isVendorDirect) {
                items = [{
                    material_id: 'VENDOR_DIRECT_ID', // Placeholder or specific logic
                    product_name: vendorData.material_name,
                    product_code: vendorData.material_code,
                    qty: parseFloat(vendorData.qty) || 0,
                    unit: 'sqft', // Default for vendor direct manual intake
                    dimensions: vendorData.dimensions,
                    vendor_name: vendorData.vendor_name,
                    estimated_arrival: vendorData.estimated_arrival
                }];
            } else {
                items = Object.entries(selectedMaterials).map(([id, qty]) => {
                    const mat = materials.find(m => m.id === id);
                    return {
                        material_id: id,
                        product_name: mat?.product_name,
                        product_code: mat?.product_code,
                        category: mat?.category,
                        qty: typeof qty === 'string' ? (parseFloat(qty) || 0) : qty,
                        unit: mat?.unit,
                        dimensions: mat?.product_specs || (mat?.dim_length && mat?.dim_width ? `${mat?.dim_length}x${mat?.dim_width}${mat?.dim_thickness ? `x${mat?.dim_thickness}` : ''}` : null),
                        sqft_per_piece: mat?.sqft_per_piece
                    };
                }).filter(item => item.qty > 0);
            }

            if (items.length === 0) {
                alert("Please select at least one material with quantity > 0");
                setIsSaving(false);
                return;
            }

            // Check for modifications if in field review
            let fieldModified = initialData?.field_modified || false;
            if (isFieldReview && initialData) {
                const originalItems = (initialData.items || []).map((i: any) => `${i.material_id}:${i.qty}`).sort().join('|');
                const currentItems = items.map((i: any) => `${i.material_id}:${i.qty}`).sort().join('|');
                if (originalItems !== currentItems) {
                    fieldModified = true;
                }
            }

            const payload: any = {
                ...initialData,
                job_id: jobId,
                status,
                items,
                destination: isVendorDirect ? 'Vendor Direct' : 'Inventory',
                requested_date: initialData?.requested_date || new Date().toISOString().split('T')[0],
                due_date: isVendorDirect ? vendorData.estimated_arrival : dueDate,
                due_time: dueTime,
                notes,
                created_by: initialData?.created_by || session?.user?.id,
                job_name: jobName,
                field_modified: fieldModified,
                updated_at: new Date().toISOString()
            };

            // If a role is provided AND we are in field review, mark as approved
            if (isFieldReview) {
                // ROBUST ROLE MATCHING: Anyone who isn't a foreman acts as a supervisor/approver here
                if (role?.toLowerCase() === 'foreman') {
                    payload.foreman_approved = true;
                } else {
                    payload.supervisor_approved = true;
                }

                // AUTO-ADVANCE STATUS: If BOTH are now approved, move to FIELD_APPROVED
                if (payload.foreman_approved && payload.supervisor_approved) {
                    payload.status = 'FIELD_APPROVED';
                }
            }

            // If BOTH are approved and we are in field review, we might want to auto-move to FIELD_APPROVED
            // But let's follow the SupabaseService.approveDeliveryTicket logic if possible.
            // Actually, handleSave is for saving the whole ticket.

            await SupabaseService.saveDeliveryTicket(payload);

            // LOGISTICS SYNC: For Vendor Direct shipments, increment 'in_transit' and 'received_at_job' (Shipped)
            if (isVendorDirect && (status === 'PENDING_APPROVAL' || status === 'SCHEDULED')) {
                const matchingMaterial = materials.find(m =>
                    (m.product_code || '').toLowerCase() === vendorData.material_code.toLowerCase() ||
                    (m.product_name || '').toLowerCase() === vendorData.material_name.toLowerCase()
                );

                if (matchingMaterial) {
                    const intakeQty = parseFloat(vendorData.qty) || 0;
                    await SupabaseService.saveProjectMaterial({
                        ...matchingMaterial,
                        in_transit: (matchingMaterial.in_transit || 0) + intakeQty,
                        received_at_job: (matchingMaterial.received_at_job || 0) + intakeQty
                    });
                }
            }

            onSuccess();
            onClose();
        } catch (err) {
            console.error("Save Ticket Error:", err);
            alert("Failed to save ticket");
        } finally {
            setIsSaving(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 'DESTINATION':
                return (
                    <View className="p-8">
                        <Text className="text-sm font-black text-slate-400 uppercase tracking-widest mb-10 text-center">Step 1: Where is it coming from?</Text>
                        <View className="flex-row gap-6">
                            <TouchableOpacity
                                onPress={() => setDestination('warehouse')}
                                className={`flex-1 p-10 rounded-[40px] border-2 items-center gap-4 ${destination === 'warehouse' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <Ionicons name="cube" size={48} color={destination === 'warehouse' ? '#2563eb' : '#94a3b8'} />
                                <Text className={`text-sm font-black uppercase tracking-tight text-center ${destination === 'warehouse' ? 'text-blue-600' : 'text-slate-400'}`}>Warehouse Inventory</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setDestination('vendor_direct')}
                                className={`flex-1 p-10 rounded-[40px] border-2 items-center gap-4 ${destination === 'vendor_direct' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <Ionicons name="cart" size={48} color={destination === 'vendor_direct' ? '#2563eb' : '#94a3b8'} />
                                <Text className={`text-sm font-black uppercase tracking-tight text-center ${destination === 'vendor_direct' ? 'text-blue-600' : 'text-slate-400'}`}>Vendor Direct</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={() => setStep(destination === 'warehouse' ? 'MATERIALS' : 'VENDOR_INTAKE')}
                            className="bg-blue-600 mt-16 p-5 rounded-2xl items-center shadow-xl shadow-blue-200"
                        >
                            <Text className="text-white font-black uppercase tracking-widest text-sm">Next Step</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 'VENDOR_INTAKE':
                return (
                    <View className="flex-1">
                        <ScrollView className="p-8">
                            <View className="flex-row justify-between items-center mb-10">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 2: Manual Intake Entry</Text>
                                <TouchableOpacity onPress={onClose}><Text className="text-slate-400 font-bold">Cancel</Text></TouchableOpacity>
                            </View>

                            <View className="gap-6">
                                <View className="flex-row gap-4">
                                    <View className="flex-1">
                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Material Code</Text>
                                        <TextInput
                                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl font-inter font-black text-slate-900"
                                            placeholder="e.g., TL-200"
                                            value={vendorData.material_code}
                                            onChangeText={(v) => setVendorData(prev => ({ ...prev, material_code: v }))}
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Material Name</Text>
                                        <TextInput
                                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl font-inter font-bold text-slate-600"
                                            placeholder="e.g., Alaska White"
                                            value={vendorData.material_name}
                                            onChangeText={(v) => setVendorData(prev => ({ ...prev, material_name: v }))}
                                        />
                                    </View>
                                </View>

                                <View className="flex-row gap-4">
                                    <View className="flex-[2]">
                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Dimensions</Text>
                                        <TextInput
                                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl font-inter font-bold text-slate-600"
                                            placeholder="e.g., 24x48x3/8"
                                            value={vendorData.dimensions}
                                            onChangeText={(v) => setVendorData(prev => ({ ...prev, dimensions: v }))}
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Qty (SQFT)</Text>
                                        <TextInput
                                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl font-inter font-black text-blue-600"
                                            placeholder="0.00"
                                            keyboardType="numeric"
                                            value={vendorData.qty}
                                            onChangeText={(v) => setVendorData(prev => ({ ...prev, qty: v }))}
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Vendor Name</Text>
                                    <TextInput
                                        className="bg-slate-50 border border-slate-100 p-4 rounded-2xl font-inter font-bold text-slate-600"
                                        placeholder="e.g., Nemo Tile & Stone"
                                        value={vendorData.vendor_name}
                                        onChangeText={(v) => setVendorData(prev => ({ ...prev, vendor_name: v }))}
                                    />
                                </View>

                                <View>
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Estimated Arrival</Text>
                                    {Platform.OS === 'web' ? (
                                        <TextInput
                                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl font-inter font-black text-slate-900"
                                            placeholder="YYYY-MM-DD"
                                            {...({ type: 'date' } as any)}
                                            value={vendorData.estimated_arrival}
                                            onChangeText={(v) => setVendorData(prev => ({ ...prev, estimated_arrival: v }))}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setPickerType('vendor_arrival');
                                                setShowDatePicker(true);
                                            }}
                                            className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex-row justify-between items-center"
                                        >
                                            <Text className="font-inter font-black text-slate-900">{formatDisplayDate(vendorData.estimated_arrival)}</Text>
                                            <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </ScrollView>

                        <View className="p-8 border-t border-slate-100 bg-white flex-row justify-between items-center">
                            <TouchableOpacity onPress={() => setStep('DESTINATION')} className="px-4"><Text className="text-slate-400 font-bold text-sm">Back</Text></TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setStep('REVIEW')}
                                className="bg-blue-600 px-10 py-3.5 rounded-2xl items-center shadow-lg shadow-blue-200"
                            >
                                <Text className="text-white font-black uppercase tracking-widest text-xs">Review Shipment</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            case 'MATERIALS':
                const CATEGORY_GROUPS = [
                    { label: 'Tile & Stone', tags: ['tile', 'stone', 'slab', 'base'] },
                    { label: 'Setting Materials', tags: ['grout', 'caulk', 'thinset', 'schluter', 'underlayment', 'setting materials', 'sundries'] }
                ];

                const filteredMaterials = materials.filter(m => {
                    const q = searchQuery.toLowerCase();
                    return (m.product_code || '').toLowerCase().includes(q) ||
                        (m.product_name || '').toLowerCase().includes(q);
                });

                const groupedMaterials = filteredMaterials.reduce((acc, m) => {
                    const cat = (m.category || '').toLowerCase();
                    let matched = false;
                    for (const group of CATEGORY_GROUPS) {
                        if (group.tags.includes(cat)) {
                            if (!acc[group.label]) acc[group.label] = [];
                            acc[group.label].push(m);
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        const label = 'Misc / Other Items';
                        if (!acc[label]) acc[label] = [];
                        acc[label].push(m);
                    }
                    return acc;
                }, {} as Record<string, ProjectMaterial[]>);

                const groupLabels = [...CATEGORY_GROUPS.map((g: any) => g.label), 'Misc / Other Items'];

                return (
                    <View className="flex-1">
                        <View className="p-8 pb-4 border-b border-slate-50">
                            <View className="flex-row justify-between items-center mb-6">
                                <View>
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Step 2 of 3</Text>
                                    <Text className="text-xl font-black text-slate-900 tracking-tight">Select Materials</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} className="p-2"><Ionicons name="close" size={24} color="#94a3b8" /></TouchableOpacity>
                            </View>

                            <View className="bg-slate-100/50 flex-row items-center px-4 py-3 rounded-2xl border border-slate-200/50">
                                <Ionicons name="search" size={18} color="#94a3b8" />
                                <TextInput
                                    className="flex-1 ml-3 font-inter font-bold text-slate-900 text-sm"
                                    placeholder="Search by Code or Name..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        <ScrollView className="px-8 pt-4">

                            {groupLabels.map(label => {
                                const groupMats = groupedMaterials[label] || [];
                                if (groupMats.length === 0) return null;
                                return (
                                    <View key={label} className="mb-10">
                                        <View className="flex-row justify-between items-center mb-4 px-2">
                                            <Text className="text-sm font-black text-slate-900 tracking-tight">{label}</Text>
                                            <Text className="text-[10px] font-black text-slate-400 uppercase">{groupMats.length} Items</Text>
                                        </View>
                                        <View className="flex-row flex-wrap gap-4">
                                            {groupMats.map(m => {
                                                const isSelected = selectedMaterials[m.id] !== undefined;
                                                const val = selectedMaterials[m.id] || 0;
                                                const availableStock = Number(m.in_warehouse_qty || 0);
                                                const shortfall = val > availableStock;

                                                return (
                                                    <TouchableOpacity
                                                        key={m.id}
                                                        onPress={() => toggleMaterial(m.id)}
                                                        className={`w-[48%] bg-white border-2 rounded-[32px] p-5 shadow-sm ${isSelected ? (shortfall ? 'border-red-500 bg-red-50/10' : 'border-blue-600 shadow-blue-100 bg-blue-50/5') : 'border-slate-100'}`}
                                                    >
                                                        <View>
                                                            <View className="flex-row justify-between items-start mb-1">
                                                                <View className="flex-1">
                                                                    <Text className="font-black text-slate-900 text-[13px] leading-tight" numberOfLines={1}>{m.product_code || 'CODE'}</Text>
                                                                    <View className="flex-row items-center gap-1 flex-wrap mt-0.5">
                                                                        <Text className="text-[10px] font-bold text-slate-500" numberOfLines={1}>{m.product_name}</Text>
                                                                        {(() => {
                                                                            const dims = m.product_specs || (m.dim_length && m.dim_width ? `${m.dim_length}x${m.dim_width}${m.dim_thickness ? `x${m.dim_thickness}` : ''}` : null);
                                                                            if (!dims) return null;
                                                                            return <Text className="text-[10px] font-black text-slate-400">| {dims}</Text>;
                                                                        })()}
                                                                    </View>
                                                                </View>
                                                                {isSelected && (
                                                                    <View className={`rounded-full p-0.5 ${shortfall ? 'bg-red-500' : 'bg-blue-600'}`}>
                                                                        <Ionicons name="checkmark" size={10} color="white" />
                                                                    </View>
                                                                )}
                                                            </View>

                                                            <View className="flex-row items-center gap-1.5 mb-4">
                                                                <View className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                                    <Text className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{m.category}</Text>
                                                                </View>
                                                            </View>

                                                            {(() => {
                                                                const isTileOrStone = ['tile', 'stone', 'slab', 'base'].includes((m.category || '').toLowerCase());
                                                                const currentUnit = inputUnits[m.id] || 'sqft';
                                                                const displayVal = currentUnit === 'pcs' && m.sqft_per_piece
                                                                    ? Math.ceil(val / m.sqft_per_piece)
                                                                    : val;

                                                                return (
                                                                    <View className={`border-2 rounded-2xl h-14 items-center justify-center relative ${isSelected ? (shortfall ? 'border-red-500' : 'border-blue-600') : 'border-slate-100 bg-slate-50/30'}`}>
                                                                        <TextInput
                                                                            className={`text-xl font-black outline-none ${isSelected ? (shortfall ? 'text-red-500' : 'text-blue-600') : 'text-slate-300'}`}
                                                                            keyboardType="numeric"
                                                                            value={isSelected ? displayVal.toString() : '0'}
                                                                            onChangeText={(v) => isSelected && updateQty(m.id, v)}
                                                                            editable={isSelected}
                                                                            selectTextOnFocus
                                                                        />
                                                                        {isTileOrStone && isSelected ? (
                                                                            <TouchableOpacity
                                                                                onPress={() => toggleInputUnit(m.id)}
                                                                                className={`absolute right-2 bottom-2 px-3 py-1 rounded-lg border-2 ${currentUnit === 'pcs' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-100'}`}
                                                                            >
                                                                                <Text className={`text-[9px] font-black uppercase ${currentUnit === 'pcs' ? 'text-orange-600' : 'text-blue-600'}`}>{currentUnit}</Text>
                                                                            </TouchableOpacity>
                                                                        ) : (
                                                                            <Text className="absolute right-3 bottom-1.5 text-[8px] font-black text-slate-400 uppercase">{m.unit || 'SQFT'}</Text>
                                                                        )}
                                                                    </View>
                                                                );
                                                            })()}

                                                            <View className="mt-4 flex-row justify-between items-end">
                                                                <View className="flex-row items-end gap-2">
                                                                    <View>
                                                                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">In Whse</Text>
                                                                        <Text className={`text-[12px] font-black ${shortfall ? 'text-red-500' : 'text-slate-900'}`}>{availableStock.toLocaleString()} <Text className="text-[8px] text-slate-400">{m.unit || 'SQFT'}</Text></Text>
                                                                    </View>

                                                                    {isSelected && (
                                                                        <View className={`px-2 py-1 rounded-lg ${shortfall ? 'bg-red-50' : 'bg-green-50'}`}>
                                                                            <Text className={`text-[9px] font-inter font-bold ${shortfall ? 'text-red-500' : 'text-green-600'}`}>
                                                                                {(() => {
                                                                                    const isTileOrStone = ['tile', 'stone', 'slab', 'base'].includes((m.category || '').toLowerCase());
                                                                                    const getPcsText = (q: number) => {
                                                                                        if (isTileOrStone && m.sqft_per_piece && m.sqft_per_piece > 0) {
                                                                                            const pcs = Math.ceil(q / m.sqft_per_piece);
                                                                                            return ` (${pcs.toLocaleString()} PCS)`;
                                                                                        }
                                                                                        return '';
                                                                                    };

                                                                                    if (shortfall) {
                                                                                        const diff = Math.abs(val - availableStock);
                                                                                        return `SHORT ${diff.toLocaleString()} ${m.unit || 'SQFT'}${getPcsText(diff)}`;
                                                                                    }
                                                                                    const left = availableStock - val;
                                                                                    return `PROJECTED: ${left.toLocaleString()} ${m.unit || 'SQFT'} LEFT${getPcsText(left)}`;
                                                                                })()}
                                                                            </Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            </View>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                        <View className="p-8 border-t border-slate-100 bg-white flex-row justify-between items-center">
                            <TouchableOpacity onPress={() => setStep('DESTINATION')} className="px-4"><Text className="text-slate-400 font-bold text-sm">Back</Text></TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setStep('REVIEW')}
                                className="bg-blue-600 px-10 py-3.5 rounded-2xl items-center shadow-lg shadow-blue-200"
                            >
                                <Text className="text-white font-black uppercase tracking-widest text-xs">Next Step</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            case 'REVIEW':
                const selectedList = materials.filter(m => selectedMaterials[m.id] !== undefined);
                return (
                    <View className="flex-1">
                        <ScrollView className="p-8">
                            <View className="flex-row justify-between items-center mb-10">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 3 of 3</Text>
                                <TouchableOpacity onPress={onClose}><Text className="text-slate-400 font-bold">Cancel</Text></TouchableOpacity>
                            </View>

                            <View className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 items-center mb-8">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reviewing Shipment For</Text>
                                <Text className="text-2xl font-black text-slate-900 mb-6">{jobName}</Text>

                                <View className="flex-row gap-2">
                                    <View className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2">
                                        <Text className="text-[10px] font-bold text-slate-400">From:</Text>
                                        <Text className="text-[10px] font-black text-slate-900 uppercase">
                                            {destination === 'warehouse' ? 'WAREHOUSE' : 'VENDOR DIRECT'}
                                        </Text>
                                    </View>

                                    {Platform.OS === 'web' ? (
                                        <View className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2 relative">
                                            <Text className="text-[10px] font-bold text-slate-400">Arrival:</Text>
                                            <TextInput
                                                className="text-[10px] font-black text-slate-900 bg-transparent outline-none"
                                                {...({ type: 'date' } as any)}
                                                value={destination === 'vendor_direct' ? vendorData.estimated_arrival : dueDate}
                                                onChangeText={(v) => {
                                                    if (destination === 'vendor_direct') {
                                                        setVendorData(prev => ({ ...prev, estimated_arrival: v }));
                                                    } else {
                                                        setDueDate(v);
                                                    }
                                                }}
                                            />
                                            <Ionicons name="calendar-outline" size={12} color="#2563eb" />
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setPickerType(destination === 'vendor_direct' ? 'vendor_arrival' : 'due_date');
                                                setShowDatePicker(true);
                                            }}
                                            className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2 active:bg-slate-50"
                                        >
                                            <Text className="text-[10px] font-bold text-slate-400">Arrival:</Text>
                                            <Text className="text-[10px] font-black text-slate-900">
                                                {destination === 'vendor_direct' ? formatDisplayDate(vendorData.estimated_arrival) : formatDisplayDate(dueDate)}
                                            </Text>
                                            <Ionicons name="calendar-outline" size={12} color="#2563eb" />
                                        </TouchableOpacity>
                                    )}

                                    {destination === 'warehouse' && (
                                        Platform.OS === 'web' ? (
                                            <View className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2">
                                                <TextInput
                                                    className="text-[10px] font-black text-slate-900 bg-transparent outline-none"
                                                    {...({ type: 'time' } as any)}
                                                    value={(() => {
                                                        // Convert AM/PM to 24h for standard input
                                                        const [time, ampm] = dueTime.split(' ');
                                                        let [h, m] = time.split(':');
                                                        let hours = parseInt(h);
                                                        if (ampm === 'PM' && hours < 12) hours += 12;
                                                        if (ampm === 'AM' && hours === 12) hours = 0;
                                                        return `${hours.toString().padStart(2, '0')}:${m}`;
                                                    })()}
                                                    onChangeText={(v) => {
                                                        const [h, m] = v.split(':');
                                                        let hours = parseInt(h);
                                                        const ampm = hours >= 12 ? 'PM' : 'AM';
                                                        const displayH = hours % 12 || 12;
                                                        setDueTime(`${displayH}:${m} ${ampm}`);
                                                    }}
                                                />
                                                <Ionicons name="time-outline" size={12} color="#2563eb" />
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={() => setShowTimePicker(true)}
                                                className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2 active:bg-slate-50"
                                            >
                                                <Text className="text-[10px] font-black text-slate-900">{dueTime}</Text>
                                                <Ionicons name="time-outline" size={12} color="#2563eb" />
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>
                            </View>

                            <View className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">
                                <View className="p-4 bg-slate-50/50 border-b border-slate-100 flex-row justify-between items-center">
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</Text>
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</Text>
                                </View>
                                {destination === 'vendor_direct' ? (
                                    <View className="p-5 border-b border-slate-50 flex-row justify-between items-start">
                                        <View>
                                            <Text className="font-black text-slate-900 text-sm">{vendorData.material_name}</Text>
                                            <Text className="text-[10px] text-slate-500 font-bold mt-0.5">{vendorData.material_code} | {vendorData.dimensions}</Text>
                                            <Text className="text-[10px] text-indigo-500 font-black mt-2 uppercase">Vendor: {vendorData.vendor_name}</Text>
                                        </View>
                                        <View className="items-end">
                                            <View className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 min-w-[80px] items-center">
                                                <Text className="text-sm font-black text-blue-800">{vendorData.qty}</Text>
                                            </View>
                                            <Text className="text-[9px] font-black text-slate-400 uppercase mt-1.5">SQFT</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        {selectedList.map(m => (
                                            <View key={m.id} className="p-5 border-b border-slate-50 flex-row justify-between items-start">
                                                <View className="flex-1 mr-4">
                                                    <Text className="font-black text-slate-900 text-sm">{m.product_name}</Text>
                                                    <View className="flex-row items-center gap-1.5 mt-0.5">
                                                        <Text className="text-[10px] text-slate-500 font-bold">{m.category}</Text>
                                                        {(() => {
                                                            const dims = m.product_specs || (m.dim_length && m.dim_width ? `${m.dim_length}x${m.dim_width}${m.dim_thickness ? `x${m.dim_thickness}` : ''}` : null);
                                                            if (!dims) return null;
                                                            return <Text className="text-[10px] font-black text-slate-400">| {dims}</Text>;
                                                        })()}
                                                    </View>
                                                </View>
                                                <View className="items-end gap-2">
                                                    <View className={clsx(
                                                        "px-4 py-2 rounded-xl border min-w-[100px] items-center flex-row justify-center gap-2",
                                                        isFieldReview ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-200"
                                                    )}>
                                                        {isFieldReview ? (
                                                            <TextInput
                                                                className="text-sm font-black text-orange-900 w-full text-center outline-none"
                                                                keyboardType="numeric"
                                                                value={String(selectedMaterials[m.id])}
                                                                onChangeText={(v) => updateQty(m.id, v)}
                                                            />
                                                        ) : (
                                                            <Text className="text-sm font-black text-slate-800">
                                                                {selectedMaterials[m.id].toLocaleString()}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <Text className="text-[9px] font-black text-slate-400 uppercase">{m.unit || 'SQFT'}</Text>
                                                </View>
                                            </View>
                                        ))}
                                        {!isFieldReview && (
                                            <TouchableOpacity
                                                onPress={() => setStep('MATERIALS')}
                                                className="p-4 items-center border-t border-slate-100"
                                            >
                                                <View className="flex-row items-center gap-2">
                                                    <Ionicons name="add" size={16} color="#2563eb" />
                                                    <Text className="text-[10px] font-black text-blue-600 uppercase">Add More Items</Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                        {isFieldReview && (
                                            <TouchableOpacity
                                                onPress={() => setStep('MATERIALS')}
                                                className="p-4 items-center border-t border-slate-100"
                                            >
                                                <View className="flex-row items-center gap-2">
                                                    <Ionicons name="cart-outline" size={16} color="#ea580c" />
                                                    <Text className="text-[10px] font-black text-orange-600 uppercase">Request New Material</Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </View>

                            <View className="bg-white border border-slate-200 rounded-2xl p-6 mb-12">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Additional Notes / Instructions</Text>
                                <TextInput
                                    className="text-sm text-slate-700 leading-5 h-24"
                                    placeholder="Enter any special instructions for the driver or warehouse team..."
                                    multiline
                                    value={notes}
                                    onChangeText={setNotes}
                                />
                            </View>
                        </ScrollView>

                        <View className="p-8 border-t border-slate-100 bg-white flex-row justify-between items-center">
                            <TouchableOpacity onPress={() => setStep(destination === 'warehouse' ? 'MATERIALS' : 'VENDOR_INTAKE')} className="px-4"><Text className="text-slate-400 font-bold text-sm">Back</Text></TouchableOpacity>

                            <View className="flex-row gap-3">
                                {isFieldReview ? (
                                    <TouchableOpacity
                                        onPress={() => handleSave('PENDING_FIELD_REVIEW')}
                                        className="bg-orange-500 px-10 py-3.5 rounded-2xl items-center shadow-lg shadow-orange-100 flex-row gap-2"
                                    >
                                        <Ionicons name="checkmark-circle" size={16} color="white" />
                                        <Text className="text-white font-black uppercase tracking-widest text-[10px]">Submit Review</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            onPress={() => handleSave('DRAFT')}
                                            className="bg-white border border-slate-200 px-6 py-3.5 rounded-2xl items-center"
                                        >
                                            <Text className="text-slate-900 font-black uppercase tracking-tight text-[10px]">Save Draft</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleSave('PENDING_FIELD_REVIEW')}
                                            className="bg-orange-500 px-6 py-3.5 rounded-2xl items-center shadow-lg shadow-orange-100"
                                        >
                                            <Text className="text-white font-black uppercase tracking-tight text-[10px]">Request Approval</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleSave('SCHEDULED')}
                                            className="bg-blue-600 px-6 py-3.5 rounded-2xl items-center shadow-lg shadow-blue-200 flex-row gap-2"
                                        >
                                            <Ionicons name="send" size={14} color="white" />
                                            <Text className="text-white font-black uppercase tracking-widest text-[10px]">Send to Warehouse</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>
                );
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-center items-center p-4">
                <View className="bg-white rounded-[40px] w-full max-w-4xl h-[90vh] overflow-hidden shadow-2xl">
                    {renderStep()}

                    {/* Native Pickers */}
                    {showDatePicker && Platform.OS !== 'web' && (
                        <DateTimePicker
                            value={(() => {
                                const dateStr = pickerType === 'due_date' ? dueDate : vendorData.estimated_arrival;
                                // Parse YYYY-MM-DD manually to avoid timezone shift
                                const [year, month, day] = dateStr.split('-').map(Number);
                                return new Date(year, month - 1, day);
                            })()}
                            mode="date"
                            display="default"
                            onChange={onDateChange}
                        />
                    )}
                    {showTimePicker && Platform.OS !== 'web' && (
                        <DateTimePicker
                            value={(() => {
                                const [time, ampm] = dueTime.split(' ');
                                const [hours, minutes] = time.split(':');
                                const date = new Date();
                                let h = parseInt(hours);
                                if (ampm === 'PM' && h < 12) h += 12;
                                if (ampm === 'AM' && h === 12) h = 0;
                                date.setHours(h, parseInt(minutes));
                                return date;
                            })()}
                            mode="time"
                            display="default"
                            onChange={onTimeChange}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
