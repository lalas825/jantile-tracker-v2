import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, TextInput, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box, Truck, CheckCircle2, Circle, Clock, ChevronDown, ChevronRight, AlertCircle, Calendar, Download, ArrowDownCircle, Camera, Edit3, Trash2, XCircle } from 'lucide-react-native';
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
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 1440;

    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [processedPos, setProcessedPos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
    const [viewingDiscrepancy, setViewingDiscrepancy] = useState<any | null>(null);

    // Track granular receipt data per PO and per Item
    const [receiptData, setReceiptData] = useState<Record<string, Record<string, GranularReceipt>>>({});

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

    if (loading && pos.length === 0) {
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
                            const pcsPerUnit = item.pcs_per_unit || 1;
                            const expectedPcs = Math.round(item.quantity_ordered * pcsPerUnit);

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
                                                    {(item.dims?.length && item.dims?.width) ? ` | ${item.dims.length}x${item.dims.width}` : ''}
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
                                                                ((item.dims?.length && item.dims?.width) ? (item.dims.length * item.dims.width) / 144 : (1 / (item.pcs_per_unit || 1)));

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
                                                                        ((item.dims?.length && item.dims?.width) ? (item.dims.length * item.dims.width) / 144 : (1 / (item.pcs_per_unit || 1)));

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
                                                                        ((item.dims?.length && item.dims?.width) ? (item.dims.length * item.dims.width) / 144 : (1 / (item.pcs_per_unit || 1)));
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
                                                                        ((item.dims?.length && item.dims?.width) ? (item.dims.length * item.dims.width) / 144 : (1 / (item.pcs_per_unit || 1)));
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

                                    {/* Line Item Actions */}
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity
                                                onPress={() => Alert.alert("Camera", "Launching warehouse camera...")}
                                                className={`p-2 rounded-lg border ${data.photo_url ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}
                                            >
                                                <Camera size={14} color={data.photo_url ? '#4f46e5' : '#64748b'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => Alert.alert("Notes", "Add intake notes...")}
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
                                            onPress={() => hasDisc ? setViewingDiscrepancy(po) : null}
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

            {/* Discrepancy Detail Modal (Simple Overlay for now) */}
            {viewingDiscrepancy && (
                <View className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm items-center justify-center p-8 z-50">
                    <View className="bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl">
                        <View className="bg-red-600 p-8 flex-row justify-between items-center">
                            <View>
                                <Text className="text-white text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Material Discrepancy Report</Text>
                                <Text className="text-white text-2xl font-inter font-black">PO #{viewingDiscrepancy.po_number}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setViewingDiscrepancy(null)} className="bg-white/10 p-2 rounded-full">
                                <ChevronDown size={28} color="white" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="max-h-[60vh] p-8">
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Line Item Issues</Text>

                            {(viewingDiscrepancy.discrepancies || []).map((d: any, idx: number) => {
                                const item = viewingDiscrepancy.items?.find((i: any) => i.material_id === d.material_id);
                                return (
                                    <View key={d.id || idx} className="mb-6 bg-red-50/50 border border-red-100 rounded-2xl p-5">
                                        <View className="flex-row justify-between items-start mb-4">
                                            <View>
                                                <Text className="font-black text-slate-900 text-base">{item?.product_name || 'Material'}</Text>
                                                <Text className="text-red-600 font-black text-[10px] uppercase tracking-widest">Condition: {d.condition_flag === 'D' ? 'Damaged' : 'Missing'}</Text>
                                            </View>
                                            <View className="bg-white px-3 py-1.5 rounded-xl border border-red-200 items-end">
                                                <Text className="text-[9px] text-red-600 font-black uppercase">Shortfall</Text>
                                                <Text className="text-xs font-black text-red-700">
                                                    -{d.difference} {item?.unit || 'units'}
                                                </Text>
                                                {d.pieces_difference !== undefined && d.pieces_difference > 0 && (
                                                    <Text className="text-[10px] font-black text-indigo-600 mt-0.5">
                                                        -{d.pieces_difference} Pcs
                                                    </Text>
                                                )}
                                            </View>
                                        </View>

                                        {d.notes && (
                                            <View className="mb-4">
                                                <Text className="text-[9px] font-black text-slate-400 uppercase mb-1">Notes</Text>
                                                <Text className="text-slate-700 text-sm font-bold italic">"{d.notes}"</Text>
                                            </View>
                                        )}

                                        {d.photo_url && (
                                            <View>
                                                <Text className="text-[9px] font-black text-slate-400 uppercase mb-2">Documentation</Text>
                                                <TouchableOpacity
                                                    className="bg-white border border-slate-200 rounded-xl p-3 flex-row items-center gap-3"
                                                    onPress={() => Alert.alert("Photo", "Viewing photo: " + d.photo_url)}
                                                >
                                                    <Camera size={16} color="#4f46e5" />
                                                    <Text className="text-indigo-600 font-black text-xs uppercase tracking-widest">Evidence_Intake_{idx + 1}.jpg</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <View className="p-8 bg-slate-50 border-t border-slate-100">
                            <View className="flex-row gap-4">
                                <TouchableOpacity
                                    onPress={() => handleReorder(viewingDiscrepancy)}
                                    className="flex-1 bg-indigo-600 py-5 rounded-2xl items-center flex-row justify-center gap-2"
                                >
                                    <Download size={20} color="white" />
                                    <Text className="text-white font-black uppercase tracking-widest">Re-Order Shortfall</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setViewingDiscrepancy(null)}
                                    className="flex-1 bg-slate-900 py-5 rounded-2xl items-center"
                                >
                                    <Text className="text-white font-black uppercase tracking-widest">Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}
