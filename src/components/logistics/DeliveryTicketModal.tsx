import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectMaterial, SupabaseService } from '../../services/SupabaseService';
import { useAuth } from '../../context/AuthContext';

interface DeliveryTicketModalProps {
    visible: boolean;
    onClose: () => void;
    materials: ProjectMaterial[];
    jobId: string;
    onSuccess: () => void;
}

type Step = 'DESTINATION' | 'MATERIALS' | 'REVIEW';

export default function DeliveryTicketModal({ visible, onClose, materials, jobId, onSuccess }: DeliveryTicketModalProps) {
    const { session } = useAuth();
    const [step, setStep] = useState<Step>('DESTINATION');
    const [destination, setDestination] = useState<'shop' | 'inventory'>('inventory');
    const [selectedMaterials, setSelectedMaterials] = useState<Record<string, number>>({});
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueTime, setDueTime] = useState('07:00 AM');
    const [isSaving, setIsSaving] = useState(false);

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
        const val = parseFloat(qty) || 0;
        setSelectedMaterials(prev => ({ ...prev, [id]: val }));
    };

    const handleSave = async (status: 'draft' | 'submitted') => {
        setIsSaving(true);
        try {
            const items = Object.entries(selectedMaterials).map(([id, qty]) => {
                const mat = materials.find(m => m.id === id);
                return {
                    material_id: id,
                    product_name: mat?.product_name,
                    qty,
                    unit: mat?.unit
                };
            }).filter(item => item.qty > 0);

            if (items.length === 0) {
                alert("Please select at least one material with quantity > 0");
                setIsSaving(false);
                return;
            }

            await SupabaseService.saveDeliveryTicket({
                job_id: jobId,
                ticket_number: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
                status,
                items,
                destination: destination === 'inventory' ? 'Inventory' : 'Shop',
                requested_date: new Date().toISOString().split('T')[0],
                due_date: dueDate,
                due_time: dueTime,
                notes,
                created_by: session?.user?.id
            });

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
                        <Text className="text-sm font-black text-slate-400 uppercase tracking-widest mb-10 text-center">Step 1: Where is it going?</Text>
                        <View className="flex-row gap-6">
                            <TouchableOpacity
                                onPress={() => setDestination('inventory')}
                                className={`flex-1 p-10 rounded-[40px] border-2 items-center gap-4 ${destination === 'inventory' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <Ionicons name="cube" size={48} color={destination === 'inventory' ? '#2563eb' : '#94a3b8'} />
                                <Text className={`text-lg font-black uppercase tracking-tight ${destination === 'inventory' ? 'text-blue-600' : 'text-slate-400'}`}>Inventory</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setDestination('shop')}
                                className={`flex-1 p-10 rounded-[40px] border-2 items-center gap-4 ${destination === 'shop' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <Ionicons name="business" size={48} color={destination === 'shop' ? '#2563eb' : '#94a3b8'} />
                                <Text className={`text-lg font-black uppercase tracking-tight ${destination === 'shop' ? 'text-blue-600' : 'text-slate-400'}`}>The Shop</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={() => setStep('MATERIALS')}
                            className="bg-blue-600 mt-16 p-5 rounded-2xl items-center shadow-xl shadow-blue-200"
                        >
                            <Text className="text-white font-black uppercase tracking-widest text-sm">Next: Select Materials</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 'MATERIALS':
                const groups = [
                    { label: 'Tile & Stone', tags: ['Tile', 'Stone'] },
                    { label: 'Setting Materials & Sundries', tags: ['Setting Materials', 'Sundries', 'Misc'] }
                ];
                return (
                    <View className="flex-1">
                        <ScrollView className="p-8">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Step 2 of 3</Text>
                                <TouchableOpacity onPress={onClose}><Text className="text-slate-400 font-bold">Cancel</Text></TouchableOpacity>
                            </View>

                            {groups.map(group => {
                                const groupMats = materials.filter(m => group.tags.includes(m.category));
                                if (groupMats.length === 0) return null;
                                return (
                                    <View key={group.label} className="mb-10">
                                        <View className="flex-row justify-between items-center mb-4 px-2">
                                            <Text className="text-sm font-black text-slate-900 tracking-tight">{group.label}</Text>
                                            <Text className="text-[10px] font-black text-slate-400 uppercase">{groupMats.length} Items</Text>
                                        </View>
                                        <View className="flex-row flex-wrap gap-4">
                                            {groupMats.map(m => {
                                                const isSelected = selectedMaterials[m.id] !== undefined;
                                                const val = selectedMaterials[m.id] || 0;
                                                const shortage = val > (m.shop_stock || 0);
                                                return (
                                                    <TouchableOpacity
                                                        key={m.id}
                                                        onPress={() => toggleMaterial(m.id)}
                                                        className={`w-[48%] bg-white border-2 rounded-3xl p-5 shadow-sm ${isSelected ? (shortage ? 'border-red-400 bg-red-50/10' : 'border-blue-600 shadow-blue-100') : 'border-slate-100'}`}
                                                    >
                                                        <View>
                                                            <Text className="font-black text-slate-900 text-sm mb-0.5">{m.product_code || 'Product'}</Text>
                                                            <Text className="text-[10px] text-slate-500 font-bold mb-3">{m.category}</Text>

                                                            <View className="flex-row items-center gap-2 mb-4">
                                                                <View className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                                    <Text className="text-[8px] font-bold text-slate-500">{m.product_specs}</Text>
                                                                </View>
                                                            </View>

                                                            <View className={`border-2 rounded-2xl p-4 items-center justify-center relative ${isSelected ? (shortage ? 'border-red-400' : 'border-blue-600') : 'border-slate-100'}`}>
                                                                <TextInput
                                                                    className={`text-2xl font-black ${isSelected ? (shortage ? 'text-red-600' : 'text-blue-600') : 'text-slate-300'}`}
                                                                    keyboardType="numeric"
                                                                    value={isSelected ? val.toString() : '0.00'}
                                                                    onChangeText={(v) => isSelected && updateQty(m.id, v)}
                                                                    editable={isSelected}
                                                                />
                                                                <Text className="absolute right-3 bottom-2 text-[8px] font-black text-slate-400 uppercase">{m.unit}</Text>
                                                            </View>

                                                            <View className="mt-4 flex-row justify-between items-center">
                                                                <View>
                                                                    <Text className="text-[8px] font-black text-slate-400 uppercase">Inventory</Text>
                                                                    <Text className={`text-[10px] font-black ${shortage ? 'text-red-500' : 'text-slate-800'}`}>{m.shop_stock} {m.unit}</Text>
                                                                </View>
                                                                {isSelected && shortage && (
                                                                    <View className="flex-row items-center gap-1">
                                                                        <Ionicons name="alert-circle" size={10} color="#ef4444" />
                                                                        <Text className="text-[8px] font-black text-red-500 uppercase">Short {val - m.shop_stock} {m.unit}</Text>
                                                                    </View>
                                                                )}
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
                                <Text className="text-2xl font-black text-slate-900 mb-6">Demo Job</Text>

                                <View className="flex-row gap-2">
                                    <View className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2">
                                        <Text className="text-[10px] font-bold text-slate-400">From:</Text>
                                        <Text className="text-[10px] font-black text-slate-900 uppercase">{destination}</Text>
                                    </View>
                                    <View className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2">
                                        <Text className="text-[10px] font-bold text-slate-400">Due:</Text>
                                        <Text className="text-[10px] font-black text-slate-900">{dueDate}</Text>
                                        <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
                                    </View>
                                    <View className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2">
                                        <Text className="text-[10px] font-black text-slate-900">{dueTime}</Text>
                                        <Ionicons name="time-outline" size={12} color="#94a3b8" />
                                    </View>
                                </View>
                            </View>

                            <View className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">
                                <View className="p-4 bg-slate-50/50 border-b border-slate-100 flex-row justify-between items-center">
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</Text>
                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</Text>
                                </View>
                                {selectedList.map(m => (
                                    <View key={m.id} className="p-5 border-b border-slate-50 flex-row justify-between items-start">
                                        <View>
                                            <Text className="font-black text-slate-900 text-sm">{m.product_name}</Text>
                                            <Text className="text-[10px] text-slate-500 font-bold mt-0.5">{m.category}</Text>
                                        </View>
                                        <View className="items-end">
                                            <View className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 min-w-[80px] items-center">
                                                <Text className="text-sm font-black text-slate-800">{selectedMaterials[m.id]}</Text>
                                            </View>
                                            <Text className="text-[9px] font-black text-slate-400 uppercase mt-1.5">{m.unit}</Text>
                                        </View>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    onPress={() => setStep('MATERIALS')}
                                    className="p-4 items-center border-t border-slate-100"
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="add" size={16} color="#2563eb" />
                                        <Text className="text-[10px] font-black text-blue-600 uppercase">Add More Items</Text>
                                    </View>
                                </TouchableOpacity>
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
                            <TouchableOpacity onPress={() => setStep('MATERIALS')} className="px-4"><Text className="text-slate-400 font-bold text-sm">Back</Text></TouchableOpacity>

                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => handleSave('draft')}
                                    className="bg-white border border-slate-200 px-6 py-3.5 rounded-2xl items-center"
                                >
                                    <Text className="text-slate-900 font-bold text-sm">Save Draft</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleSave('submitted')}
                                    className="bg-blue-600 px-10 py-3.5 rounded-2xl items-center shadow-lg shadow-blue-200 flex-row gap-2"
                                >
                                    <Ionicons name="checkmark-circle" size={18} color="white" />
                                    <Text className="text-white font-black uppercase tracking-widest text-xs">Submit Order</Text>
                                </TouchableOpacity>
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
                </View>
            </View>
        </Modal>
    );
}
