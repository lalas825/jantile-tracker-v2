import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TileCalculatorProps {
    visible: boolean;
    onClose: () => void;
    onApply: (qty: number) => void;
    initialQty?: number;
    unitCost?: number;
}

export default function TileCalculator({ visible, onClose, onApply, initialQty = 0, unitCost = 0 }: TileCalculatorProps) {
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [thickness, setThickness] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [sqftMode, setSqftMode] = useState(true);

    const [totalSqft, setTotalSqft] = useState(0);
    const [estimatedCost, setEstimatedCost] = useState(0);

    useEffect(() => {
        const l = parseFloat(length) || 0;
        const w = parseFloat(width) || 0;
        const q = parseFloat(quantity) || 0;

        const calculatedSqft = (l * w * q) / 144;
        setTotalSqft(calculatedSqft);
        setEstimatedCost(calculatedSqft * unitCost);
    }, [length, width, quantity, unitCost]);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-center items-center p-4">
                <View className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                    <View className="bg-blue-600 p-6 flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3">
                            <View className="bg-white/20 p-2 rounded-xl">
                                <Ionicons name="calculator" size={24} color="white" />
                            </View>
                            <Text className="text-xl font-bold text-white">Tile Calculator</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-white/10 rounded-full">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-6">
                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-1">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Length (in)</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-lg font-bold text-slate-900"
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={length}
                                    onChangeText={setLength}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Width (in)</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-lg font-bold text-slate-900"
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={width}
                                    onChangeText={setWidth}
                                />
                            </View>
                        </View>

                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-1">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Thickness (in)</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-lg font-bold text-slate-900"
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={thickness}
                                    onChangeText={setThickness}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quantity (pcs)</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-lg font-bold text-slate-900"
                                    placeholder="1"
                                    keyboardType="numeric"
                                    value={quantity}
                                    onChangeText={setQuantity}
                                />
                            </View>
                        </View>

                        <View className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-slate-500 font-bold">Total SQFT</Text>
                                <Text className="text-2xl font-black text-blue-600">{totalSqft.toFixed(2)}</Text>
                            </View>
                            <View className="flex-row justify-between items-center pt-4 border-t border-slate-200">
                                <Text className="text-slate-500 font-bold">Est. Cost (${unitCost.toFixed(2)}/sqft)</Text>
                                <Text className="text-xl font-black text-slate-900">${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => onApply(totalSqft)}
                            className="bg-blue-600 p-4 rounded-xl items-center shadow-lg shadow-blue-200"
                        >
                            <Text className="text-white font-black uppercase tracking-widest">Apply to Budget</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onClose}
                            className="mt-4 p-4 rounded-xl items-center"
                        >
                            <Text className="text-slate-400 font-bold">Cancel</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
