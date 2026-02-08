import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface PurchaseHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    materialName: string;
    productCode: string;
    history: any[];
}

export default function PurchaseHistoryModal({
    visible,
    onClose,
    materialName,
    productCode,
    history
}: PurchaseHistoryModalProps) {

    const navigateToReceiving = (poId: string) => {
        onClose();
        // Navigate to Warehouse Receiving Bay with PO context
        router.push({
            pathname: '/(tabs)/warehouse',
            params: { tab: 'Receiving', poId: poId }
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-center items-center px-4">
                <View className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <View className="bg-slate-900 p-6 flex-row justify-between items-center">
                        <View>
                            <Text className="text-white font-inter font-black text-xl tracking-tight">Purchase Audit Trail</Text>
                            <Text className="text-blue-400 text-xs font-inter font-black uppercase tracking-widest mt-1">
                                {productCode} • {materialName}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-white/10 p-2 rounded-xl">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View className="p-6 max-h-[600px]">
                        <View className="flex-row border-b border-slate-100 pb-3 mb-3">
                            <Text className="w-[120px] text-[10px] font-inter font-black text-slate-400 uppercase">PO #</Text>
                            <Text className="w-[100px] text-[10px] font-inter font-black text-slate-400 uppercase text-center">Date</Text>
                            <Text className="flex-1 text-[10px] font-inter font-black text-slate-400 uppercase">Vendor</Text>
                            <Text className="w-[100px] text-[10px] font-inter font-black text-slate-400 uppercase text-center">Ordered Qty</Text>
                            <Text className="w-[100px] text-[10px] font-inter font-black text-slate-400 uppercase text-center">Status</Text>
                            <Text className="w-[100px] text-[10px] font-inter font-black text-slate-400 uppercase text-center">DMG/MISS Link</Text>
                        </View>

                        <ScrollView>
                            {history.length === 0 ? (
                                <View className="py-20 items-center">
                                    <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
                                    <Text className="text-slate-400 font-inter font-bold mt-4">No order history found for this item</Text>
                                </View>
                            ) : (
                                history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(item => (
                                    <View key={item.id} className="flex-row py-4 border-b border-slate-50 items-center">
                                        <TouchableOpacity
                                            onPress={() => navigateToReceiving(item.id)}
                                            className="w-[120px]"
                                        >
                                            <Text className="font-inter font-black text-blue-600 text-[14px] underline">{item.po_number}</Text>
                                        </TouchableOpacity>

                                        <Text className="w-[100px] text-center font-inter font-medium text-slate-500 text-[12px]">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </Text>

                                        <Text className="flex-1 font-inter font-bold text-slate-900 text-[13px]">{item.vendor}</Text>

                                        <Text className="w-[100px] text-center font-inter font-black text-slate-900 text-[14px]">
                                            {Number(item.quantity || 0).toLocaleString()}
                                        </Text>

                                        <View className="w-[100px] items-center">
                                            <View className={`px-2 py-1 rounded-full ${item.status === 'Received' ? 'bg-emerald-100' :
                                                item.status === 'Partial' ? 'bg-orange-100' : 'bg-blue-100'
                                                }`}>
                                                <Text className={`text-[9px] font-inter font-black uppercase ${item.status === 'Received' ? 'text-emerald-700' :
                                                    item.status === 'Partial' ? 'text-orange-700' : 'text-blue-700'
                                                    }`}>{item.status}</Text>
                                            </View>
                                        </View>

                                        <View className="w-[100px] items-center">
                                            <TouchableOpacity
                                                className="flex-row items-center gap-1"
                                                onPress={() => navigateToReceiving(item.id)}
                                            >
                                                <Ionicons name="warning-outline" size={14} color="#f87171" />
                                                <Text className="text-[10px] font-inter font-black text-red-500 uppercase">Dmg Link</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>

                    {/* Footer */}
                    <View className="p-6 bg-slate-50 flex-row justify-end">
                        <TouchableOpacity
                            onPress={onClose}
                            className="bg-slate-200 px-6 py-2 rounded-xl"
                        >
                            <Text className="text-slate-600 font-inter font-black uppercase text-xs">Close Audit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
