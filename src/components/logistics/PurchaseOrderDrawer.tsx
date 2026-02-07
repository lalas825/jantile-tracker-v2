import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectMaterial, PurchaseOrder, formatDisplayDate } from '../../services/SupabaseService';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';

interface PurchaseOrderDrawerProps {
    visible: boolean;
    onClose: () => void;
    material: ProjectMaterial | null;
    existingPOs: PurchaseOrder[];
    onSave: (poData: any) => Promise<void>;
}

export default function PurchaseOrderDrawer({ visible, onClose, material, existingPOs, onSave }: PurchaseOrderDrawerProps) {
    const [poNumber, setPoNumber] = useState('');
    const [vendor, setVendor] = useState('');
    const [orderQty, setOrderQty] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [expectedDate, setExpectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'NEW' | 'EXISTING'>('NEW');
    const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    useEffect(() => {
        if (material) {
            const toBuy = Math.max(0, material.budget_qty - (material.shop_stock + material.received_at_job + material.in_transit));
            setOrderQty(toBuy > 0 ? toBuy.toString() : '0');
            setUnitCost(material.unit_cost?.toString() || '0');
            setVendor(material.supplier || '');
            setPoNumber('');
            setMode('NEW');
            setSelectedPoId(null);
            setExpectedDate(new Date().toISOString().split('T')[0]);
        }
    }, [material]);

    const activePOs = useMemo(() => {
        return existingPOs.filter(p => p.status !== 'Received').sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }, [existingPOs]);

    const vendorSuggestions = useMemo(() => {
        const unique = new Set(existingPOs.map(p => p.vendor).filter(Boolean));
        return Array.from(unique).sort();
    }, [existingPOs]);

    const handleSaveInternal = async () => {
        if (!material) return;
        if (mode === 'NEW' && !poNumber.trim()) {
            alert('Please enter a PO Number');
            return;
        }
        if (mode === 'EXISTING' && !selectedPoId) {
            alert('Please select an existing PO');
            return;
        }

        const qty = parseFloat(orderQty);
        if (!orderQty || qty <= 0) {
            alert('Please enter a valid quantity');
            return;
        }

        // Over budget check (Visual feedback instead of alert)
        // Note: Save is still allowed as per typical PM requirements, but with visual warning.

        setLoading(true);
        try {
            await onSave({
                mode,
                po_id: selectedPoId,
                po_number: poNumber,
                vendor,
                expected_date: expectedDate,
                material_id: material.id,
                qty: qty,
                cost: parseFloat(unitCost)
            });
            onClose();
        } catch (err: any) {
            alert('Error saving order: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderCalendar = () => {
        const monthStart = startOfMonth(calendarMonth);
        const monthEnd = endOfMonth(calendarMonth);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        return (
            <Modal visible={showCalendar} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl">
                        <View className="bg-slate-900 p-6 flex-row justify-between items-center">
                            <TouchableOpacity onPress={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                                <Ionicons name="chevron-back" size={20} color="white" />
                            </TouchableOpacity>
                            <Text className="text-white font-black uppercase tracking-widest">{format(calendarMonth, 'MMMM yyyy')}</Text>
                            <TouchableOpacity onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                                <Ionicons name="chevron-forward" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                        <View className="p-4">
                            <View className="flex-row mb-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                    <Text key={i} className="flex-1 text-center text-[10px] font-black text-slate-400">{d}</Text>
                                ))}
                            </View>
                            <View className="flex-row flex-wrap">
                                {days.map((day, i) => {
                                    const isCurrentMonth = isSameMonth(day, monthStart);
                                    const isSelected = isSameDay(day, new Date(expectedDate + 'T12:00:00'));
                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            className={`w-[14.28%] aspect-square items-center justify-center rounded-full ${isSelected ? 'bg-blue-600' : ''}`}
                                            onPress={() => {
                                                setExpectedDate(format(day, 'yyyy-MM-dd'));
                                                setShowCalendar(false);
                                            }}
                                        >
                                            <Text className={`text-xs font-bold ${isSelected ? 'text-white' : isCurrentMonth ? 'text-slate-800' : 'text-slate-200'}`}>
                                                {format(day, 'd')}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowCalendar(false)}
                            className="p-4 border-t border-slate-100 items-center"
                        >
                            <Text className="text-blue-600 font-black uppercase text-xs">Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View className="flex-1 bg-black/50 flex-row justify-end">
                <View className="w-full max-w-md bg-white h-full shadow-2xl">
                    <View className="bg-slate-900 p-6 pt-12 flex-row justify-between items-center">
                        <View>
                            <Text className="text-white font-inter font-black text-xl tracking-tight">Purchase Order</Text>
                            <Text className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-0.5">Procurement Gateway</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-white/10 p-2 rounded-lg">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 p-6">
                        {material && (
                            <View className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ordering Material</Text>
                                <Text className="text-lg font-black text-slate-900 leading-tight mb-1">{material.product_name}</Text>
                                <Text className="text-xs font-bold text-slate-500 mb-3">{material.product_code} • {material.category}</Text>
                                <View className="flex-row gap-4">
                                    <View>
                                        <Text className="text-[9px] font-black text-slate-400 uppercase">Budget</Text>
                                        <Text className="text-sm font-bold text-slate-700">{material.budget_qty.toLocaleString()} {material.unit}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-[9px] font-black text-slate-400 uppercase">To Buy</Text>
                                        <Text className="text-sm font-bold text-red-600">
                                            {Math.max(0, material.budget_qty - (material.shop_stock + material.received_at_job + material.in_transit)).toLocaleString()} {material.unit}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        <View className="flex-row bg-slate-100 p-1 rounded-xl mb-6">
                            <TouchableOpacity
                                onPress={() => setMode('NEW')}
                                className={`flex-1 py-2 items-center rounded-lg ${mode === 'NEW' ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Text className={`text-xs font-black uppercase ${mode === 'NEW' ? 'text-blue-600' : 'text-slate-400'}`}>New PO</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setMode('EXISTING')}
                                className={`flex-1 py-2 items-center rounded-lg ${mode === 'EXISTING' ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Text className={`text-xs font-black uppercase ${mode === 'EXISTING' ? 'text-blue-600' : 'text-slate-400'}`}>Add to Existing</Text>
                            </TouchableOpacity>
                        </View>

                        {mode === 'NEW' ? (
                            <View className="space-y-4 mb-8">
                                <View>
                                    <Text className="text-xs font-bold text-slate-500 mb-1.5 ml-1">PO Number</Text>
                                    <TextInput
                                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-black"
                                        placeholder="e.g. PO-24001"
                                        placeholderTextColor="#cbd5e1"
                                        value={poNumber}
                                        onChangeText={setPoNumber}
                                    />
                                </View>
                                <View>
                                    <Text className="text-xs font-bold text-slate-500 mb-1.5 ml-1">Vendor / Supplier</Text>
                                    <TextInput
                                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold"
                                        placeholder="Vendor Name"
                                        placeholderTextColor="#cbd5e1"
                                        value={vendor}
                                        onChangeText={setVendor}
                                    />
                                    {vendorSuggestions.length > 0 && !vendorSuggestions.includes(vendor) && (
                                        <ScrollView horizontal className="mt-2 flex-row gap-2" showsHorizontalScrollIndicator={false}>
                                            {vendorSuggestions.filter(v => v.toLowerCase().includes(vendor.toLowerCase())).map(v => (
                                                <TouchableOpacity
                                                    key={v}
                                                    onPress={() => setVendor(v)}
                                                    className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full"
                                                >
                                                    <Text className="text-[10px] font-bold text-slate-600">{v}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>
                                <View>
                                    <Text className="text-xs font-bold text-slate-500 mb-1.5 ml-1">Expected Delivery</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowCalendar(true)}
                                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex-row justify-between items-center"
                                    >
                                        <Text className="text-slate-900 font-bold">{formatDisplayDate(expectedDate)}</Text>
                                        <Ionicons name="calendar-outline" size={18} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View className="mb-8">
                                <Text className="text-xs font-bold text-slate-500 mb-1.5 ml-1">Select Active PO</Text>
                                {activePOs.length === 0 ? (
                                    <View className="bg-slate-50 p-4 rounded-xl border border-slate-200 items-center">
                                        <Text className="text-slate-400 text-xs font-bold">No active POs found</Text>
                                    </View>
                                ) : (
                                    activePOs.map(po => (
                                        <TouchableOpacity
                                            key={po.id}
                                            onPress={() => setSelectedPoId(po.id)}
                                            className={`p-4 border rounded-xl mb-2 flex-row justify-between items-center ${selectedPoId === po.id ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-200'}`}
                                        >
                                            <View>
                                                <Text className={`font-black ${selectedPoId === po.id ? 'text-blue-700' : 'text-slate-700'}`}>{po.po_number}</Text>
                                                <Text className="text-xs text-slate-400 font-bold">{po.vendor}</Text>
                                            </View>
                                            {selectedPoId === po.id && <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />}
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        )}

                        <View className="border-t border-slate-100 pt-6 mb-8">
                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Order Details</Text>
                            <View className="flex-row gap-4">
                                <View className="flex-1">
                                    <Text className="text-xs font-bold text-slate-500 mb-1.5 ml-1">Order Qty</Text>
                                    <View className="relative">
                                        <TextInput
                                            className={`bg-white border rounded-xl px-4 py-3 text-xl font-black ${material && (material.ordered_qty || 0) + (material.shop_stock || 0) + (material.received_at_job || 0) + (material.in_transit || 0) + (parseFloat(orderQty) || 0) > material.budget_qty
                                                    ? 'border-red-500 text-red-600'
                                                    : 'border-blue-200 text-blue-600'
                                                }`}
                                            keyboardType="numeric"
                                            value={orderQty}
                                            onChangeText={setOrderQty}
                                        />
                                        <Text className="absolute right-4 top-4 text-xs font-black text-slate-300 uppercase">{material?.unit}</Text>
                                    </View>
                                    {material && (material.ordered_qty || 0) + (material.shop_stock || 0) + (material.received_at_job || 0) + (material.in_transit || 0) + (parseFloat(orderQty) || 0) > material.budget_qty && (
                                        <Text className="text-red-500 text-[10px] font-black uppercase mt-1 ml-1 tracking-wider">Over the budget</Text>
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs font-bold text-slate-500 mb-1.5 ml-1">Unit Cost</Text>
                                    <View className="relative">
                                        <Text className="absolute left-4 top-4 text-slate-400 font-bold">$</Text>
                                        <TextInput
                                            className="bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-lg font-bold text-slate-700"
                                            keyboardType="numeric"
                                            value={unitCost}
                                            onChangeText={setUnitCost}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <View className="p-6 border-t border-slate-100 bg-slate-50">
                        <TouchableOpacity
                            onPress={handleSaveInternal}
                            disabled={loading}
                            className={`py-4 rounded-xl items-center shadow-lg shadow-blue-200 flex-row justify-center gap-2 ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
                        >
                            {loading && <View className="animate-spin"><Ionicons name="refresh" size={18} color="white" /></View>}
                            <Text className="text-white font-black uppercase tracking-widest text-sm">
                                {loading ? 'Processing...' : 'Confirm Order'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            {renderCalendar()}
        </Modal>
    );
}
