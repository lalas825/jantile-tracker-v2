import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, TextInput, useWindowDimensions, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box, Truck, CheckCircle2, Circle, Clock, ChevronDown, ChevronRight, AlertCircle, Calendar, Download, ArrowDownCircle, Camera, Edit3, Trash2, XCircle, Save, Undo2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { SupabaseService, PurchaseOrder, PurchaseOrderItem, formatDisplayDate } from '../../services/SupabaseService';

type ItemCondition = 'Verified' | 'Damaged' | 'Missing';

interface GranularReceipt {
    qty_received: string;
    pieces_received?: string;
    crates_received?: string;
    multiplier_mode?: 'Pcs' | 'SQFT';
    pieces_per_crate_override?: string;
    sqft_per_crate_override?: string;
    pieces_ordered?: number;
    receipt_mode: 'Bulk' | 'Granular';
    condition: ItemCondition;
    notes: string;
    photo_url?: string;
}

export default function ReceivingList() {
    const { width, height } = useWindowDimensions();
    const isLargeScreen = width > 1440;

    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [processedPos, setProcessedPos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
    const [viewingDiscrepancy, setViewingDiscrepancy] = useState<any | null>(null);
    const [reverting, setReverting] = useState(false);

    // Notes Modal State
    const [noteModal, setNoteModal] = useState<{ poId: string, itemId: string, text: string } | null>(null);

    // Track granular receipt data per PO and per Item
    const [receiptData, setReceiptData] = useState<Record<string, Record<string, GranularReceipt>>>({});

    useEffect(() => {
        if (viewingDiscrepancy) {
            console.log("DEBUG: Modal Opening for PO:", viewingDiscrepancy.po_number);
            console.log("DEBUG: Modal Data:", JSON.stringify(viewingDiscrepancy));
        }
    }, [viewingDiscrepancy]);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const activePos = await SupabaseService.getReceivingPOs();
            setPos(activePos);

            const history = await SupabaseService.getProcessedPOs();
            setProcessedPos(history);

            // Auto-expand jobs
            const initialExpanded: Record<string, boolean> = {};
            activePos.forEach(p => {
                initialExpanded[p.job_name || 'Unassigned Project'] = true;
            });
            setExpandedJobs(prev => ({ ...prev, ...initialExpanded }));

            // Initialize receipt data with defaults
            const initialReceipts: Record<string, Record<string, GranularReceipt>> = {};
            activePos.forEach(p => {
                initialReceipts[p.id] = {};
                p.items?.forEach((item: any) => {
                    const isTile = item.unit?.toLowerCase() === 'sqft';
                    const pcsPerUnit = item.pcs_per_unit || 1;
                    const expectedPcs = Math.round(item.quantity_ordered * pcsPerUnit);

                    const category = item.material_category?.toLowerCase() || '';
                    const defaultMode = (category.includes('tile') || category.includes('stone')) ? 'Bulk' : 'Granular';

                    initialReceipts[p.id][item.id] = {
                        qty_received: String(item.quantity_ordered),
                        pieces_received: isTile ? String(expectedPcs) : undefined,
                        pieces_ordered: isTile ? expectedPcs : undefined,
                        multiplier_mode: 'Pcs',
                        receipt_mode: defaultMode,
                        condition: 'Verified',
                        notes: ''
                    };
                });
            });
            setReceiptData(initialReceipts);
        } catch (error) {
            console.error("Receiving Error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const toggleJob = (jobName: string) => {
        setExpandedJobs(prev => ({ ...prev, [jobName]: !prev[jobName] }));
    };

    const updateItemReceipt = (poId: string, itemId: string, updates: Partial<GranularReceipt>) => {
        setReceiptData(prev => ({
            ...prev,
            [poId]: {
                ...(prev[poId] || {}),
                [itemId]: {
                    ...(prev[poId]?.[itemId] || { qty_received: '0', condition: 'Verified', notes: '' }),
                    ...updates
                }
            }
        }));
    };

    const handleReceive = async (po: PurchaseOrder) => {
        try {
            const poReceipts = receiptData[po.id];
            if (!poReceipts) return;

            const receipts = (po.items || []).map(item => {
                const data = poReceipts[item.id];
                return {
                    material_id: item.material_id,
                    qty_received: parseFloat(data.qty_received) || 0,
                    qty_ordered: item.quantity_ordered,
                    condition: data.condition,
                    notes: data.notes,
                    photo_url: data.photo_url,
                    pieces_received: data.pieces_received !== undefined ? parseInt(data.pieces_received) : undefined,
                    pieces_ordered: data.pieces_ordered,
                    receipt_mode: data.receipt_mode,
                    crates_received: data.crates_received ? parseFloat(data.crates_received) : undefined,
                    pieces_per_crate: item.pieces_per_crate
                };
            });

            await SupabaseService.receivePurchaseOrder(po.id, receipts);
            Alert.alert("Success", `PO #${po.po_number} received into stock.`);
            loadData();
        } catch (err) {
            console.error("Receive Error:", err);
            Alert.alert("Error", "Failed to process intake");
        }
    };

    const handleReorder = async (po: any) => {
        try {
            const shortfalls = (po.discrepancies || []).filter((d: any) => d.difference > 0);
            if (shortfalls.length === 0) {
                Alert.alert("Info", "No shortfalls found to re-order.");
                return;
            }

            const items = shortfalls.map((s: any) => ({
                material_id: s.material_id,
                qty: s.difference
            }));

            await SupabaseService.createReorderPO(po.id, items, 'SYSTEM');
            Alert.alert("Success", "Draft re-order PO has been created and linked.");
            setViewingDiscrepancy(null);
            loadData();
        } catch (err) {
            console.error("Reorder Error:", err);
            Alert.alert("Error", "Failed to create re-order");
        }
    };

    const getPOStatus = (po: PurchaseOrder) => {
        if (!po.expected_date) return 'Expected';
        const today = new Date().toISOString().split('T')[0];
        return po.expected_date < today ? 'Overdue' : 'Expected';
    };

    const pickImage = async (poId: string, itemId: string) => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "We need camera permissions to take photos of items.");
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const uri = result.assets[0].uri;
                updateItemReceipt(poId, itemId, { photo_url: uri });
            }
        } catch (err) {
            console.error("Camera Error:", err);
            Alert.alert("Error", "Could not launch camera on this device.");
        }
    };

    // Grouping
    const unscheduled = useMemo(() =>
        pos.filter(p => !p.expected_date),
        [pos]);

    const posByJob = useMemo(() => {
        const scheduled = pos.filter(p => p.expected_date);
        const groups: Record<string, PurchaseOrder[]> = {};
        scheduled.forEach(p => {
            const name = p.job_name || 'Unassigned Project';
            if (!groups[name]) groups[name] = [];
            groups[name].push(p);
        });
        return groups;
    }, [pos]);

    const handleRevertIntake = async (po: any) => {
        const performRevert = async () => {
            setReverting(true);
            try {
                await SupabaseService.revertPurchaseOrderIntake(po.id, 'WAREHOUSE-ADMIN');
                setViewingDiscrepancy(null);
                await loadData();
                if (Platform.OS === 'web') {
                    alert("Success: Intake reverted. The PO is now back in the receiving queue.");
                } else {
                    Alert.alert("Success", "Intake reverted. The PO is now back in the receiving queue.");
                }
            } catch (err) {
                console.error("Revert error:", err);
                const msg = "Failed to revert intake. Please check connection.";
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert("Error", msg);
            } finally {
                setReverting(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Confirm Edit: This will undo the intake records for this shipment and move it back to the active queue. Stock levels will be correctly adjusted. Continue?")) {
                performRevert();
            }
            return;
        }

        Alert.alert(
            "Confirm Edit",
            "This will undo the intake records for this shipment and move it back to the active queue. Stock levels will be correctly adjusted. Continue?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Yes, Edit", style: "destructive", onPress: performRevert }
            ]
        );
    };

    if (loading) {
        return <ActivityIndicator size="large" color="#2563eb" className="mt-20" />;
    }

    const renderPOCard = (p: PurchaseOrder) => {
        const poStatus = getPOStatus(p);
        const cardWidth = isLargeScreen ? 'w-[24%]' : 'w-full';

        return (
            <View key={p.id} className={`${cardWidth} mb-4 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm`}>
                {/* Card Header - Optimized for TV */}
                <View className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-3">
                        <View className="flex-row items-baseline gap-1">
                            <Text className="text-[10px] font-black text-slate-400 uppercase">PO</Text>
                            <Text className="text-xl font-inter font-black text-slate-900">#{p.po_number}</Text>
                        </View>

                        <View className="w-[1px] h-4 bg-slate-200" />

                        <Text className="text-[11px] font-inter font-black text-slate-600 uppercase tracking-tight">{p.vendor}</Text>
                    </View>

                    <View className="flex-row items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                        <Clock size={10} color={poStatus === 'Overdue' ? '#dc2626' : '#4f46e5'} strokeWidth={3} />
                        <Text className={`font-black text-[10px] uppercase ${poStatus === 'Overdue' ? 'text-red-600' : 'text-indigo-600'}`}>
                            {formatDisplayDate(p.expected_date)}
                        </Text>
                        <Text className="text-[9px] font-black text-slate-400 border-l border-slate-100 pl-1.5 uppercase">Expected</Text>
                    </View>
                </View>

                {/* Material Checklist - Granular Verification */}
                <View className="p-5">
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Material Intake Verification</Text>
                    <View className="gap-4">
                        {(p.items || []).map((item: any) => {
                            const isTile = item.unit?.toLowerCase() === 'sqft';
                            const pcsPerUnit = Number(item.pcs_per_unit) || 1;
                            const expectedPcs = Math.round((Number(item.quantity_ordered) || 0) * pcsPerUnit);

                            const data = receiptData[p.id]?.[item.id] || {
                                qty_received: String(item.quantity_ordered),
                                pieces_received: isTile ? String(expectedPcs) : undefined,
                                pieces_ordered: isTile ? expectedPcs : undefined,
                                condition: 'Verified',
                                notes: ''
                            };

                            // Reactive Piece calculation from SQFT
                            const calculatedPcs = isTile && data.qty_received
                                ? Math.round(Number(data.qty_received) * pcsPerUnit)
                                : 0;
                            return (
                                <View key={item.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                                    <View className="mb-4">
                                        <View className="flex-row justify-between items-start mb-1">
                                            <View>
                                                <Text className="text-lg font-black text-slate-900 tracking-tight">{item.product_code || 'NO CODE'}</Text>
                                                <Text className="text-xs font-medium text-slate-500 mt-0.5">
                                                    {item.product_name}
                                                    {(item.dims?.length && item.dims?.width) ? ` | ${item.dims?.length}x${item.dims?.width}` : ''}
                                                </Text>
                                            </View>

                                            <View className="bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 flex-row items-center gap-1.5">
                                                <Text className="text-[10px] font-black text-indigo-700 uppercase">
                                                    Exp: {item.quantity_ordered} {item.unit || 'pcs'}
                                                </Text>
                                                {isTile && (
                                                    <View className="bg-indigo-200 w-[1px] h-3" />
                                                )}
                                                {isTile && (
                                                    <Text className="text-[10px] font-black text-indigo-700 uppercase">
                                                        {expectedPcs} Pcs
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                        <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">{item.material_category}</Text>
                                    </View>

                                    {/* Dual-Mode Intake & Condition Verification */}
                                    <View className="flex-row justify-between items-center mb-4">
                                        <View className="flex-row bg-slate-200/50 p-1 rounded-xl self-start">
                                            {(['Bulk', 'Granular'] as const).map(m => (
                                                <TouchableOpacity
                                                    key={m}
                                                    onPress={() => {
                                                        const current = receiptData[p.id]?.[item.id];
                                                        let updates: any = { receipt_mode: m };

                                                        if (m === 'Bulk' && current?.pieces_received) {
                                                            // Carry over from Granular to Bulk
                                                            const pcs = Number(current.pieces_received);
                                                            const ppc = item.pieces_per_crate || 0;
                                                            if (ppc > 0) {
                                                                updates.crates_received = String(pcs / ppc);
                                                            }
                                                        }

                                                        updateItemReceipt(p.id, item.id, updates);
                                                    }}
                                                    className={`px-4 py-1.5 rounded-lg ${data.receipt_mode === m ? 'bg-white shadow-sm' : ''}`}
                                                >
                                                    <Text className={`text-[9px] font-black uppercase ${data.receipt_mode === m ? 'text-indigo-600' : 'text-slate-500'}`}>
                                                        {m === 'Bulk' ? 'Bulk (Crates)' : 'Granular (SQFT/Pcs)'}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Condition Toggle relocated to top */}
                                        <View className="flex-row bg-slate-200/50 p-1 rounded-xl h-8 items-center">
                                            {(['Verified', 'Damaged', 'Missing'] as ItemCondition[]).map(cond => (
                                                <TouchableOpacity
                                                    key={cond}
                                                    onPress={() => updateItemReceipt(p.id, item.id, { condition: cond })}
                                                    className={`px-3 h-full items-center justify-center rounded-lg ${data.condition === cond ? 'bg-white shadow-sm' : ''}`}
                                                >
                                                    <Text className={`text-[9px] font-black uppercase ${data.condition === cond ? (cond === 'Verified' ? 'text-green-600' : 'text-red-600') : 'text-slate-500'}`}>
                                                        {cond.charAt(0)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    <View className="flex-row items-end gap-3 mb-4">
                                        {data.receipt_mode === 'Bulk' ? (
                                            <View className="flex-1">
                                                <Text className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">
                                                    {item.unit?.toLowerCase() === 'sqft' ? 'Crates / Skids Received' : `${item.unit} Received (Bulk)`}
                                                </Text>
                                                <View className="bg-white rounded-xl h-10 border border-slate-200 shadow-sm overflow-hidden flex-row items-center">
                                                    <TextInput
                                                        className="flex-1 font-inter font-black text-sm text-slate-900 h-full px-3"
                                                        style={{ outlineStyle: 'none' } as any}
                                                        value={data.crates_received || ''}
                                                        onChangeText={(val) => {
                                                            const crates = Number(val);
                                                            const ppc_from_db = item.pieces_per_crate || 0;
                                                            const ppc_override = Number(data.pieces_per_crate_override) || 0;

                                                            // Logic: DB value > Override value > Fallback to 1
                                                            const effective_ppc = ppc_from_db > 0 ? ppc_from_db : (ppc_override > 0 ? ppc_override : 1);

                                                            const sqft_per_piece = item.sqft_per_piece ||
                                                                ((item.dims?.length && item.dims?.width) ? (Number(item.dims.length) * Number(item.dims.width)) / 144 : (1 / (Number(item.pcs_per_unit) || 1)));

                                                            const totalPieces = Math.round(crates * effective_ppc);
                                                            const totalSqft = totalPieces * (sqft_per_piece || 1);

                                                            updateItemReceipt(p.id, item.id, {
                                                                crates_received: val,
                                                                qty_received: totalSqft.toFixed(2),
                                                                pieces_received: String(totalPieces)
                                                            });
                                                        }}
                                                        keyboardType="numeric"
                                                        placeholder="0"
                                                        placeholderTextColor="#cbd5e1"
                                                    />
                                                    {(!item.pieces_per_crate || item.pieces_per_crate === 0) && (
                                                        <View className="flex-row items-center border-l border-slate-100 bg-amber-50/20">
                                                            <View className="w-[1px] h-6 bg-slate-200" />

                                                            {/* Multiplier Mode Selection Dropdown (Styled as toggle) */}
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    const currentMode = data.multiplier_mode || 'Pcs';
                                                                    const nextMode = currentMode === 'Pcs' ? 'SQFT' : 'Pcs';
                                                                    updateItemReceipt(p.id, item.id, { multiplier_mode: nextMode });
                                                                }}
                                                                className="flex-row items-center px-2 h-full border-r border-slate-100 bg-amber-100/30"
                                                            >
                                                                <Text className="text-[10px] font-black text-amber-600 uppercase mr-1">
                                                                    {data.multiplier_mode || 'Pcs'}/Crt
                                                                </Text>
                                                                <ChevronDown size={10} color="#d97706" />
                                                            </TouchableOpacity>

                                                            {/* Unified Multiplier Input with improved visibility */}
                                                            <TextInput
                                                                className="w-20 font-inter font-black text-[12px] text-amber-900 h-full px-2 text-center"
                                                                style={{ outlineStyle: 'none' } as any}
                                                                value={(data.multiplier_mode === 'SQFT') ? (data.sqft_per_crate_override || '') : (data.pieces_per_crate_override || '')}
                                                                onChangeText={(val) => {
                                                                    const isPcsMode = (data.multiplier_mode || 'Pcs') === 'Pcs';
                                                                    const sqft_per_piece = item.sqft_per_piece ||
                                                                        ((item.dims?.length && item.dims?.width) ? (Number(item.dims.length) * Number(item.dims.width)) / 144 : (1 / (Number(item.pcs_per_unit) || 1)));

                                                                    if (isPcsMode) {
                                                                        const ppc = Number(val) || 0;
                                                                        const spc = ppc * sqft_per_piece;
                                                                        updateItemReceipt(p.id, item.id, {
                                                                            pieces_per_crate_override: val,
                                                                            sqft_per_crate_override: spc > 0 ? spc.toFixed(2) : ''
                                                                        });

                                                                        if (data.crates_received) {
                                                                            const crates = Number(data.crates_received);
                                                                            const totalPieces = Math.round(crates * ppc);
                                                                            const totalSqft = totalPieces * (sqft_per_piece || 1);
                                                                            updateItemReceipt(p.id, item.id, {
                                                                                qty_received: totalSqft.toFixed(2),
                                                                                pieces_received: String(totalPieces)
                                                                            });
                                                                        }
                                                                    } else {
                                                                        const spc = Number(val) || 0;
                                                                        const ppc = Math.round(spc / (sqft_per_piece || 1));
                                                                        updateItemReceipt(p.id, item.id, {
                                                                            sqft_per_crate_override: val,
                                                                            pieces_per_crate_override: ppc > 0 ? String(ppc) : ''
                                                                        });

                                                                        if (data.crates_received) {
                                                                            const crates = Number(data.crates_received);
                                                                            const totalSqft = crates * spc;
                                                                            const totalPieces = Math.round(totalSqft / (sqft_per_piece || 1));
                                                                            updateItemReceipt(p.id, item.id, {
                                                                                qty_received: totalSqft.toFixed(2),
                                                                                pieces_received: String(totalPieces)
                                                                            });
                                                                        }
                                                                    }
                                                                }}
                                                                keyboardType="numeric"
                                                                placeholder="Value"
                                                                placeholderTextColor="#d97706"
                                                            />
                                                        </View>
                                                    )}
                                                    <View className="bg-slate-50 h-full px-3 justify-center border-l border-slate-100">
                                                        <Box size={14} color="#94a3b8" />
                                                    </View>
                                                </View>
                                                <View className="flex-row items-center gap-1 mt-1.5 ml-1">
                                                    <Text className="text-[9px] font-bold text-slate-400 uppercase">Real-time Summary:</Text>
                                                    <Text className="text-[10px] font-black text-indigo-600">
                                                        {item.unit?.toLowerCase() === 'sqft'
                                                            ? `${data.qty_received} ${item.unit} | ${data.pieces_received || 0} Pcs`
                                                            : `${data.pieces_received || 0} ${item.unit || 'units'}`
                                                        }
                                                    </Text>
                                                </View>
                                            </View>
                                        ) : (
                                            <>
                                                <View className="flex-1">
                                                    <Text className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">
                                                        {item.unit?.toLowerCase() === 'sqft' ? 'SQFT Received' : `${item.unit} Received`}
                                                    </Text>
                                                    <View className="bg-white rounded-xl h-10 border border-slate-200 shadow-sm overflow-hidden">
                                                        <TextInput
                                                            className="flex-1 font-inter font-black text-sm text-slate-900 h-full px-3"
                                                            style={{ outlineStyle: 'none' } as any}
                                                            value={data.qty_received}
                                                            onChangeText={(val) => {
                                                                const isTile = item.unit?.toLowerCase() === 'sqft';
                                                                if (isTile) {
                                                                    const sqft = Number(val);
                                                                    const sqft_per_piece = item.sqft_per_piece ||
                                                                        ((item.dims?.length && item.dims?.width) ? (Number(item.dims.length) * Number(item.dims.width)) / 144 : (1 / (Number(item.pcs_per_unit) || 1)));
                                                                    const pcs = Math.round(sqft / (sqft_per_piece || 1));
                                                                    updateItemReceipt(p.id, item.id, {
                                                                        qty_received: val,
                                                                        pieces_received: String(pcs)
                                                                    });
                                                                } else {
                                                                    // For bags/boxes, qty and pieces are the same
                                                                    updateItemReceipt(p.id, item.id, {
                                                                        qty_received: val,
                                                                        pieces_received: val
                                                                    });
                                                                }
                                                            }}
                                                            keyboardType="numeric"
                                                            placeholder="0.00"
                                                        />
                                                    </View>
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Pieces Received</Text>
                                                    <View className="bg-white rounded-xl h-10 border border-slate-200 shadow-sm overflow-hidden">
                                                        <TextInput
                                                            className="flex-1 font-inter font-black text-sm text-slate-900 h-full px-3"
                                                            style={{ outlineStyle: 'none' } as any}
                                                            value={data.pieces_received || ''}
                                                            onChangeText={(val) => {
                                                                const isTile = item.unit?.toLowerCase() === 'sqft';
                                                                if (isTile) {
                                                                    const pcs = Number(val);
                                                                    const sqft_per_piece = item.sqft_per_piece ||
                                                                        ((item.dims?.length && item.dims?.width) ? (Number(item.dims.length) * Number(item.dims.width)) / 144 : (1 / (Number(item.pcs_per_unit) || 1)));
                                                                    const sqft = pcs * sqft_per_piece;
                                                                    updateItemReceipt(p.id, item.id, {
                                                                        pieces_received: val,
                                                                        qty_received: sqft.toFixed(2)
                                                                    });
                                                                } else {
                                                                    // For bags/boxes, qty and pieces are the same
                                                                    updateItemReceipt(p.id, item.id, {
                                                                        pieces_received: val,
                                                                        qty_received: val
                                                                    });
                                                                }
                                                            }}
                                                            keyboardType="numeric"
                                                            placeholder="0"
                                                        />
                                                    </View>
                                                </View>
                                            </>
                                        )}

                                    </View>

                                    {/* Previews: Photo & Note */}
                                    {(data.photo_url || data.notes) && (
                                        <View className="flex-row gap-3 mb-4 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                                            {data.photo_url && (
                                                <View className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                                    <Image
                                                        source={{ uri: data.photo_url }}
                                                        className="w-full h-full"
                                                        resizeMode="cover"
                                                    />
                                                </View>
                                            )}
                                            {data.notes && (
                                                <View className="flex-1 justify-center">
                                                    <Text className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Note Snippet</Text>
                                                    <Text className="text-xs text-slate-600 font-bold leading-tight" numberOfLines={3}>
                                                        {data.notes}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Line Item Actions */}
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity
                                                onPress={() => pickImage(p.id, item.id)}
                                                className={`p-2 rounded-lg border ${data.photo_url ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}
                                            >
                                                <Camera size={14} color={data.photo_url ? '#4f46e5' : '#64748b'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setNoteModal({ poId: p.id, itemId: item.id, text: data.notes || '' })}
                                                className={`p-2 rounded-lg border ${data.notes ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}
                                            >
                                                <Edit3 size={14} color={data.notes ? '#4f46e5' : '#64748b'} />
                                            </TouchableOpacity>
                                        </View>
                                        {(data.condition !== 'Verified' || (parseFloat(data.qty_received) < (item.quantity_ordered - 0.01))) && (
                                            <View className="flex-row items-center gap-1.5">
                                                <AlertCircle size={14} color="#dc2626" strokeWidth={2.5} />
                                                <Text className="text-red-600 font-black text-[9px] uppercase tracking-wider">Discrepancy Detected</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Action Bar */}
                    <View className="mt-6 pt-4 border-t border-slate-100">
                        <TouchableOpacity
                            onPress={() => handleReceive(p)}
                            className="bg-indigo-600 px-8 py-3.5 rounded-2xl flex-row items-center justify-center gap-3 shadow-xl shadow-indigo-100"
                        >
                            <ArrowDownCircle size={18} color="white" strokeWidth={2.5} />
                            <Text className="text-white font-inter font-black uppercase tracking-widest text-xs">
                                Receive into Stock
                            </Text>
                        </TouchableOpacity>
                        <Text className="text-slate-400 text-[8px] font-bold uppercase text-center mt-2 tracking-widest">
                            REAL-TIME SUMMARY: Verified items will update project stock instantly
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <>
            <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="p-8">
                    {/* 1. UNSCHEDULED BANNER */}
                    {unscheduled.length > 0 && (
                        <View className="mb-10 bg-blue-50 border border-blue-200 rounded-3xl overflow-hidden shadow-sm">
                            <View className="bg-blue-100/50 px-8 py-5 flex-row items-center gap-4 border-b border-blue-200">
                                <Clock size={22} color="#2563eb" strokeWidth={2.5} />
                                <Text className="text-blue-900 font-inter font-black uppercase tracking-tight text-base">
                                    Expected Shipments (Needs Date)
                                </Text>
                                <View className="bg-blue-600 px-3 py-1 rounded-lg ml-auto shadow-md">
                                    <Text className="text-white font-black text-sm">{unscheduled.length}</Text>
                                </View>
                            </View>
                            <View className="p-6 flex-row flex-wrap gap-4">
                                {unscheduled.map(p => (
                                    <View key={p.id} className="bg-white border border-blue-200/50 rounded-2xl p-5 flex-row justify-between items-center w-full lg:w-[calc(50%-8px)] shadow-sm">
                                        <View>
                                            <View className="flex-row items-center gap-2 mb-1.5">
                                                <Text className="bg-blue-100 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded uppercase">Inbound</Text>
                                                <Text className="text-slate-400 font-black text-[11px] uppercase tracking-wider">PO #{p.po_number}</Text>
                                            </View>
                                            <Text className="text-xl font-inter font-black text-slate-900 uppercase">{p.vendor}</Text>
                                            <Text className="text-slate-500 font-bold text-xs mt-1 uppercase tracking-tight">{p.job_name || 'Project Name'}</Text>
                                        </View>
                                        <View className="items-end gap-3">
                                            <TouchableOpacity className="bg-indigo-600 px-5 py-2.5 rounded-xl flex-row items-center gap-2 shadow-lg shadow-indigo-100">
                                                <Calendar size={16} color="white" strokeWidth={2.5} />
                                                <Text className="text-white font-black text-xs uppercase tracking-widest">Set Expected Date</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* 2. RECEIVING QUEUE */}
                    <View className="mb-10">
                        <View className="flex-row items-center gap-4 mb-8">
                            <Download size={24} color="#1e293b" strokeWidth={2.5} />
                            <Text className="text-slate-900 font-inter font-black uppercase tracking-tight text-lg">Receiving Bay Queue</Text>
                            <View className="bg-slate-200 px-2.5 py-0.5 rounded-lg ml-1">
                                <Text className="text-slate-600 font-black text-base">{Object.values(posByJob).flat().length}</Text>
                            </View>
                        </View>

                        {Object.entries(posByJob).map(([jobName, jobPos]) => (
                            <View key={jobName} className="mb-8">
                                {/* Job Site Header (Dark Styled) */}
                                <TouchableOpacity
                                    onPress={() => toggleJob(jobName)}
                                    className="bg-slate-900 rounded-3xl px-8 py-5 flex-row justify-between items-center shadow-xl shadow-slate-200"
                                >
                                    <View className="flex-row items-center gap-5">
                                        <View className="bg-white/10 p-3 rounded-2xl">
                                            <Truck size={24} color="white" strokeWidth={2.5} />
                                        </View>
                                        <View>
                                            <Text className="text-xl font-inter font-black text-white tracking-tight uppercase">{jobName}</Text>
                                            <View className="flex-row items-center gap-2 mt-1">
                                                <Box size={14} color="#94a3b8" />
                                                <Text className="text-slate-400 font-bold text-[11px] uppercase">Active Inbound Job Site</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center gap-6">
                                        <View className="bg-indigo-600 px-4 py-1.5 rounded-full">
                                            <Text className="text-white font-black text-xs uppercase tracking-widest">{jobPos.length} Expected Shipments</Text>
                                        </View>
                                        <View className={`p-1.5 rounded-full ${expandedJobs[jobName] ? 'bg-white/10' : ''}`}>
                                            <ChevronDown
                                                size={24}
                                                color="white"
                                                style={{
                                                    transform: [{ rotate: expandedJobs[jobName] ? '180deg' : '0deg' }]
                                                }}
                                            />
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                {expandedJobs[jobName] && (
                                    <View className={`mt-6 flex-row flex-wrap gap-4 ${isLargeScreen ? 'justify-start' : 'flex-col pl-4 border-l-2 border-slate-100 ml-10'}`}>
                                        {jobPos.map(p => renderPOCard(p))}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>

                    {/* 3. RECENT ACTIVITY */}
                    <View>
                        <View className="flex-row items-center gap-4 mb-8">
                            <CheckCircle2 size={24} color="#1e293b" strokeWidth={2.5} />
                            <Text className="text-slate-900 font-inter font-black uppercase tracking-tight text-lg">Recently Processed Shipments</Text>
                        </View>

                        <View className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm">
                            {processedPos.length === 0 ? (
                                <View className="p-20 items-center justify-center">
                                    <View className="bg-slate-50 p-6 rounded-full mb-6">
                                        <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
                                    </View>
                                    <Text className="text-slate-400 font-bold text-lg italic text-center max-w-sm">No recent transactions. Processed shipments will appear here for verification history.</Text>
                                </View>
                            ) : (
                                <View className="p-6 gap-3">
                                    {processedPos.map(po => {
                                        const hasDisc = po.status === 'Received with Discrepancy';
                                        return (
                                            <TouchableOpacity
                                                key={po.id}
                                                onPress={() => setViewingDiscrepancy(po)}
                                                className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex-row justify-between items-center"
                                            >
                                                <View className="flex-row items-center gap-4">
                                                    <View className={`w-12 h-12 rounded-xl items-center justify-center ${hasDisc ? 'bg-red-100' : 'bg-green-100'}`}>
                                                        {hasDisc ? (
                                                            <AlertCircle size={24} color="#dc2626" strokeWidth={2.5} />
                                                        ) : (
                                                            <CheckCircle2 size={24} color="#16a34a" strokeWidth={2.5} />
                                                        )}
                                                    </View>
                                                    <View>
                                                        <View className="flex-row items-center gap-2">
                                                            <Text className="font-black text-slate-900 text-base">PO #{po.po_number}</Text>
                                                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{po.job_name}</Text>
                                                        </View>
                                                        <Text className="text-xs text-slate-500 font-bold uppercase">{po.vendor} • Processed {formatDisplayDate(po.received_at)}</Text>
                                                    </View>
                                                </View>
                                                <View className="items-end gap-1">
                                                    <View className={`px-3 py-1 rounded-full ${hasDisc ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                                                        <Text className={`text-[9px] font-black uppercase ${hasDisc ? 'text-red-600' : 'text-green-600'}`}>
                                                            {po.status}
                                                        </Text>
                                                    </View>
                                                    {hasDisc && (
                                                        <Text className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">View Report</Text>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Discrepancy Detail Modal */}
            <Modal
                visible={!!viewingDiscrepancy}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setViewingDiscrepancy(null)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                    <View style={{ backgroundColor: 'white', width: '100%', maxWidth: 1200, borderRadius: 40, overflow: 'hidden', maxHeight: height * 0.9, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
                        {/* Header */}
                        <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 32, paddingVertical: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={{ color: 'white', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 14, marginBottom: 4 }}>PO Intake Report</Text>
                                <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>
                                    #{String(viewingDiscrepancy?.po_number || 'N/A')} | {String(viewingDiscrepancy?.job_name || 'N/A')}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setViewingDiscrepancy(null)} style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 99 }}>
                                <XCircle size={20} color="white" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1, padding: 32 }}>
                            {(!viewingDiscrepancy?.items || viewingDiscrepancy.items.length === 0) ? (
                                <View style={{ paddingVertical: 80, alignItems: 'center' }}>
                                    <Text style={{ color: '#94a3b8', fontWeight: 'bold', fontStyle: 'italic' }}>No item details available for this report.</Text>
                                </View>
                            ) : (
                                viewingDiscrepancy.items.map((item: any, idx: number) => {
                                    const claim = (viewingDiscrepancy.discrepancies || []).find((d: any) => d.material_id === item.material_id);
                                    return (
                                        <View key={item.id || idx} style={{ marginBottom: 32, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 32 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                                                <View style={{ flex: 1, marginRight: 16 }}>
                                                    <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, marginBottom: 4 }}>{item.product_name || 'Material Details'}</Text>
                                                    <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{item.product_code || item.material_category || 'General Material'}</Text>
                                                </View>
                                                <View style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 99, backgroundColor: claim?.condition_flag === 'D' ? '#fef2f2' : (claim?.condition_flag === 'M' ? '#fff7ed' : '#ecfdf5') }}>
                                                    <Text style={{ fontWeight: '900', fontSize: 10, textTransform: 'uppercase', color: claim?.condition_flag === 'D' ? '#dc2626' : (claim?.condition_flag === 'M' ? '#ea580c' : '#059669') }}>
                                                        {claim?.condition_flag === 'D' ? 'Damaged' : (claim?.condition_flag === 'M' ? 'Missing' : 'Verified OK')}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
                                                <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Expected</Text>
                                                    <Text style={{ color: '#334155', fontWeight: '900', fontSize: 14 }}>{item.quantity_ordered} {item.unit || 'SQFT'}</Text>
                                                </View>
                                                <View style={{ flex: 1, backgroundColor: '#f5f3ff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#ede9fe' }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Received</Text>
                                                    <Text style={{ color: '#4f46e5', fontWeight: '900', fontSize: 14 }}>{claim ? claim.received_qty : (item.received_qty || 0)} {item.unit || 'SQFT'}</Text>
                                                </View>
                                            </View>

                                            {(claim?.notes || claim?.photo_url) && (
                                                <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 24, padding: 24, overflow: 'hidden' }}>
                                                    {claim.photo_url && (
                                                        <View style={{ marginBottom: 20, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center' }}>
                                                            <Image source={{ uri: claim.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                                        </View>
                                                    )}
                                                    {claim.notes && (
                                                        <View>
                                                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Intake Notes</Text>
                                                            <Text style={{ color: '#334155', fontWeight: '700', fontSize: 14, fontStyle: 'italic', lineHeight: 20 }}>"{claim.notes}"</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>

                        {/* Footer Buttons */}
                        <View style={{ padding: 32, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', gap: 16, justifyContent: 'center', alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={() => setViewingDiscrepancy(null)}
                                style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 }}
                            >
                                <Text style={{ color: '#475569', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>Close Report</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => handleRevertIntake(viewingDiscrepancy)}
                                disabled={reverting}
                                style={{ backgroundColor: '#4f46e5', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: reverting ? 0.7 : 1 }}
                            >
                                {reverting ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Undo2 size={16} color="white" />
                                        <Text style={{ color: 'white', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>Edit Intake</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Notes Modal */}
            <Modal
                visible={!!noteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setNoteModal(null)}
            >
                <View className="flex-1 bg-slate-900/60 backdrop-blur-sm justify-center items-center p-6">
                    <View className="bg-white w-full max-lg rounded-[32px] overflow-hidden shadow-2xl">
                        <View className="bg-slate-900 p-6 flex-row justify-between items-center">
                            <View className="flex-row items-center gap-3">
                                <Edit3 size={20} color="white" />
                                <Text className="text-white font-inter font-black uppercase tracking-widest text-sm">Add Intake Notes</Text>
                            </View>
                            <TouchableOpacity onPress={() => setNoteModal(null)}>
                                <XCircle size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View className="p-8">
                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Verification Details / Damages / Discrepancies</Text>
                            <View className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[160px]">
                                <TextInput
                                    multiline
                                    numberOfLines={6}
                                    className="flex-1 font-inter font-bold text-slate-700 text-sm"
                                    style={{ textAlignVertical: 'top', outlineStyle: 'none' } as any}
                                    placeholder="Type inspection notes here..."
                                    placeholderTextColor="#94a3b8"
                                    value={noteModal?.text}
                                    onChangeText={(val) => setNoteModal(prev => prev ? { ...prev, text: val } : null)}
                                    autoFocus
                                />
                            </View>
                        </View>

                        <View className="p-6 bg-slate-50 border-t border-slate-100 flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => {
                                    if (noteModal) {
                                        updateItemReceipt(noteModal.poId, noteModal.itemId, { notes: noteModal.text });
                                        setNoteModal(null);
                                    }
                                }}
                                className="flex-1 bg-indigo-600 py-4 rounded-2xl items-center flex-row justify-center gap-2 shadow-lg shadow-indigo-100"
                            >
                                <Save size={18} color="white" strokeWidth={2.5} />
                                <Text className="text-white font-black uppercase tracking-widest text-xs">Save Note</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}
