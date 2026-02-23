import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, Platform, Dimensions, Image, Alert } from 'react-native';
import { X, Camera, CheckCircle2, AlertCircle, Package, Truck, Info, MapPin } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SupabaseService, DeliveryTicket } from '../../services/SupabaseService';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

interface ReceiveMaterialModalProps {
    isVisible: boolean;
    onClose: () => void;
    ticket: DeliveryTicket | null;
    onSuccess: () => void;
}

export default function ReceiveMaterialModal({ isVisible, onClose, ticket, onSuccess }: ReceiveMaterialModalProps) {
    const { user } = useAuth();
    const [receipts, setReceipts] = useState<any[]>([]);
    const [stagingNotes, setStagingNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const { width } = Dimensions.get('window');
    const isDesktop = width > 768;

    useEffect(() => {
        if (isVisible && ticket) {
            setReceipts(ticket.items.map(item => ({
                material_id: item.material_id,
                product_name: item.product_name,
                qty_expected: item.qty,
                qty_received: item.qty,
                condition: 'Verified',
                notes: '',
                unit: item.unit
            })));
        }
    }, [isVisible, ticket]);

    const handleUpdateQty = (idx: number, val: string) => {
        const num = parseFloat(val) || 0;
        const newReceipts = [...receipts];
        newReceipts[idx].qty_received = num;
        if (num < newReceipts[idx].qty_expected) {
            newReceipts[idx].condition = 'Missing';
        } else if (num === newReceipts[idx].qty_expected) {
            newReceipts[idx].condition = 'Verified';
        }
        setReceipts(newReceipts);
    };

    const toggleCondition = (idx: number) => {
        const newReceipts = [...receipts];
        const current = newReceipts[idx].condition;
        if (current === 'Verified') newReceipts[idx].condition = 'Damaged';
        else if (current === 'Damaged') newReceipts[idx].condition = 'Missing';
        else newReceipts[idx].condition = 'Verified';
        setReceipts(newReceipts);
    };

    const handleSave = async () => {
        if (!ticket || !user) return;
        setLoading(true);
        try {
            await SupabaseService.receiveDeliveryTicket(
                ticket.id,
                receipts.map(r => ({
                    material_id: r.material_id,
                    product_name: r.product_name,
                    qty_received: r.qty_received,
                    qty_expected: r.qty_expected,
                    condition: r.condition,
                    notes: r.notes || stagingNotes
                })),
                user.id
            );
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to receive ticket:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!ticket) return null;

    return (
        <Modal visible={isVisible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
                <View className={clsx(
                    "bg-white shadow-2xl h-[90%] rounded-t-3xl overflow-hidden",
                    isDesktop ? "self-center w-[600px] mb-10 rounded-3xl h-[80%]" : "w-full"
                )}>
                    {/* Header */}
                    <View className="px-6 py-4 border-b border-slate-100 flex-row justify-between items-center bg-slate-50/50">
                        <View>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Receive Material</Text>
                            <Text className="text-xl font-black text-slate-900 tracking-tight">DT #{ticket.ticket_number}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-200 rounded-full">
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
                        <View className="mb-6 flex-row items-center gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <Info size={20} color="#3b82f6" />
                            <Text className="text-blue-800 text-xs font-medium flex-1">
                                Verify quantities for each item below. Mark any damages or missing quantities to auto-trigger alerts.
                            </Text>
                        </View>

                        {receipts.map((item, idx) => (
                            <View key={idx} className="mb-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                <View className="flex-row justify-between items-start mb-4">
                                    <View className="flex-1 mr-4">
                                        <Text className="text-slate-900 font-bold text-base leading-tight">{item.product_name}</Text>
                                        <Text className="text-slate-400 text-xs font-medium uppercase mt-1">Expected: {item.qty_expected} {item.unit}</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => toggleCondition(idx)}
                                        className={clsx(
                                            "px-3 py-1 rounded-full border",
                                            item.condition === 'Verified' ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                                                item.condition === 'Damaged' ? "bg-red-50 border-red-200 text-red-600" :
                                                    "bg-orange-50 border-orange-200 text-orange-600"
                                        )}
                                    >
                                        <Text className="text-[10px] font-black uppercase">{item.condition}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View className="flex-row gap-4 items-center">
                                    <View className="flex-1">
                                        <Text className="text-slate-500 text-[10px] font-bold uppercase mb-1">Verify Quantity</Text>
                                        <TextInput
                                            className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-lg font-black text-slate-900 h-14"
                                            keyboardType="numeric"
                                            value={item.qty_received.toString()}
                                            onChangeText={(v) => handleUpdateQty(idx, v)}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => Alert.alert('Add Photo', 'In-app camera and photo upload will be available in the next update.')}
                                        className="w-14 h-14 bg-slate-100 rounded-xl items-center justify-center border border-slate-200"
                                    >
                                        <Camera size={24} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        <Text className="text-slate-900 font-bold text-base mb-2">Site Staging Notes</Text>
                        <TextInput
                            className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-700 min-h-[100px]"
                            multiline
                            placeholder="e.g. Staged at North Bay, 4th Floor..."
                            value={stagingNotes}
                            onChangeText={setStagingNotes}
                        />
                    </ScrollView>

                    {/* Footer */}
                    <View className="p-6 border-t border-slate-100 bg-white">
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={loading}
                            className={clsx(
                                "h-14 rounded-2xl items-center justify-center shadow-lg",
                                loading ? "bg-slate-400" : "bg-slate-900"
                            )}
                        >
                            <View className="flex-row items-center gap-2">
                                <CheckCircle2 size={20} color="white" />
                                <Text className="text-white font-black uppercase text-sm tracking-widest">
                                    {loading ? "Completing..." : "Complete Receipt"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
