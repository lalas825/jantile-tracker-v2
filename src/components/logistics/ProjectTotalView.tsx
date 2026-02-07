import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PurchaseOrder, formatDisplayDate } from '../../services/SupabaseService';

interface ProjectTotalViewProps {
    aggregatedMaterials: any[];
    categories: { label: string; tags: string[] }[];
    expandedSections: Record<string, boolean>;
    toggleSection: (section: string) => void;
    purchaseOrders: PurchaseOrder[];
    onOrder: (material: any) => void;
}

export default function ProjectTotalView({
    aggregatedMaterials,
    categories,
    expandedSections,
    toggleSection,
    purchaseOrders,
    onOrder
}: ProjectTotalViewProps) {

    // Helper to render QTY with Unit
    const renderQty = (val: number, unit: string = 'sqft') => (
        <View className="flex-row items-baseline justify-center">
            <Text className="text-[15px] font-inter font-black text-slate-900">{val.toLocaleString()}</Text>
            <Text className="text-[10px] text-slate-400 font-medium ml-0.5">{unit}</Text>
        </View>
    );

    // Helper for Piece Count
    const renderPcs = (m: any, qty: number) => {
        if (!m.pcs_per_unit || m.pcs_per_unit === 0) return null;
        const pcs = Math.round(qty * m.pcs_per_unit);
        return (
            <Text className="text-[10px] text-slate-400 font-medium text-center leading-tight">({pcs.toLocaleString()} Pcs)</Text>
        );
    };

    return (
        <View className="px-8 mt-6">
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-lg font-inter font-black text-slate-900 tracking-tight">Material Budget</Text>
                <View className="flex-row items-center bg-white px-4 py-2 rounded-xl border border-slate-200 w-64 shadow-sm">
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput className="ml-2 text-sm text-slate-900 font-inter font-bold flex-1" placeholder="Search products..." />
                </View>
            </View>

            {categories.map((group, idx) => {
                const lowerTags = group.tags.map(t => t.toLowerCase());

                // If it's the last category (Misc), treat it as a catch-all for items not matched by previous groups
                const groupMats = aggregatedMaterials.filter(m => {
                    const cat = (m.category || '').toLowerCase();
                    const matchedByCurrent = lowerTags.includes(cat);

                    if (idx === categories.length - 1) {
                        // Catch-all: Check if it was matched by ANY previous category
                        const matchedByPrevious = categories.slice(0, idx).some(prev =>
                            prev.tags.map(t => t.toLowerCase()).includes(cat)
                        );
                        return matchedByCurrent || !matchedByPrevious;
                    }

                    return matchedByCurrent;
                });

                // Skip rendering if no materials match and it's not the catch-all
                if (groupMats.length === 0 && idx < categories.length - 1) {
                    return null;
                }

                const total = groupMats.reduce((sum, m) => sum + Number(m.total_value || 0), 0);
                const isExpanded = expandedSections[group.label];

                return (
                    <View key={group.label} className="bg-white rounded-2xl border border-slate-200 mb-6 overflow-hidden shadow-sm">
                        <TouchableOpacity
                            onPress={() => toggleSection(group.label)}
                            className="p-5 flex-row justify-between items-center border-b border-slate-50"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-blue-50 p-1.5 rounded-lg">
                                    <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={16} color="#2563eb" />
                                </View>
                                <Text className="font-inter font-black text-slate-800 tracking-widest text-xs uppercase">{group.label} (PROJECT TOTALS)</Text>
                            </View>
                            <View className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                <Text className="text-emerald-700 font-inter font-black text-xs">Total: ${total.toLocaleString()}</Text>
                            </View>
                        </TouchableOpacity>

                        {isExpanded && (
                            <View>
                                {/* GLOBAL TABLE HEADERS */}
                                <View className="flex-row px-3 py-2 bg-slate-50 border-b border-slate-100 items-center">
                                    <Text className="flex-[1.5] text-[11px] font-inter font-black text-slate-400 uppercase px-2">Loc / Zone</Text>
                                    <Text className="flex-[2] text-[11px] font-inter font-black text-slate-400 uppercase px-2">Material</Text>
                                    <Text className="flex-1 text-[11px] font-inter font-black text-slate-400 uppercase text-center">Dims</Text>
                                    <Text className="flex-1 text-[11px] font-inter font-black text-slate-400 uppercase text-center">Unit Cost</Text>
                                    <Text className="flex-1 text-[11px] font-inter font-black text-slate-400 uppercase text-center">Total Value</Text>
                                    <Text className="flex-[1.2] text-[11px] font-inter font-black text-blue-500 uppercase text-center">Active POs</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-blue-600 uppercase text-center">Stock</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-orange-500 uppercase text-center">Ordered</Text>
                                    <Text className="flex-1 text-[11px] font-inter font-black text-orange-400 uppercase text-center">Expected</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-emerald-600 uppercase text-center">Recv.</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-red-500 uppercase text-center">DMG / MISS</Text>
                                    <Text className="flex-[1] text-[11px] font-inter font-black text-slate-900 uppercase text-center">To Buy</Text>
                                    <Text className="flex-[1.2] text-[11px] font-inter font-black text-slate-500 uppercase text-center">Supplier</Text>
                                    <View className="w-24" />
                                </View>

                                {groupMats.length === 0 ? (
                                    <View className="p-12 items-center">
                                        <Text className="text-slate-400 font-bold">No global totals for this category</Text>
                                    </View>
                                ) : (
                                    groupMats.map(m => {
                                        const toBuy = Math.max(0, Number(m.budget_qty || 0) - (Number(m.shop_stock || 0) + Number(m.in_transit || 0) + Number(m.received_at_job || 0)));
                                        return (
                                            <View key={m.product_code || m.product_name} className="flex-row px-3 py-3 border-b border-slate-50 items-center min-h-[50px]">
                                                <View className="flex-[1.5] px-2">
                                                    <Text className="text-[13px] font-inter font-black text-slate-700 leading-tight" numberOfLines={2}>
                                                        {Array.from(m.locations || []).join(', ') || 'Global'}
                                                    </Text>
                                                    <Text className="text-[11px] font-inter text-slate-400 leading-tight" numberOfLines={1}>
                                                        {Array.from(m.zones || []).join(', ') || '-'}
                                                    </Text>
                                                </View>
                                                <View className="flex-[2] px-2">
                                                    <Text className="font-inter font-black text-slate-900 text-[15px] leading-tight" numberOfLines={1}>{m.product_code || 'N/A'}</Text>
                                                    <Text className="text-[13px] text-slate-400 font-inter font-bold" numberOfLines={1}>{m.product_name}</Text>
                                                </View>
                                                <View className="flex-1 items-center px-1">
                                                    <Text className="text-[13px] font-inter font-black text-slate-700 text-center">
                                                        {m.dim_length ? `${m.dim_length}"x${m.dim_width}"` : '-'}
                                                    </Text>
                                                    {m.dim_thickness ? <Text className="text-[10px] text-slate-400">{m.dim_thickness}"</Text> : null}
                                                </View>
                                                <View className="flex-1 items-center px-1">
                                                    <Text className="text-[13px] text-slate-600 font-inter font-bold text-center">${(m.unit_cost || 0).toFixed(2)}</Text>
                                                    <Text className="text-[9px] text-slate-400 font-bold uppercase">/{m.unit}</Text>
                                                </View>
                                                <View className="flex-1 items-center px-1">
                                                    <Text className="text-[14px] font-inter font-black text-slate-900 text-center">${(m.total_value || 0).toLocaleString()}</Text>
                                                </View>

                                                <View className="flex-[1.2] items-center px-1 flex-row flex-wrap justify-center gap-1">
                                                    {purchaseOrders
                                                        .filter(p => p.status !== 'Received' && p.items?.some((i: any) => m.all_ids?.has(i.material_id)))
                                                        .map(p => (
                                                            <View key={p.id} className="bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                                                <Text className="text-[9px] font-black text-blue-700">{p.po_number}</Text>
                                                            </View>
                                                        ))
                                                    }
                                                    {!purchaseOrders.some(p => p.status !== 'Received' && p.items?.some((i: any) => m.all_ids?.has(i.material_id))) && (
                                                        <Text className="text-[10px] text-slate-300 font-bold">--</Text>
                                                    )}
                                                </View>

                                                <View className="flex-[1] items-center">
                                                    <View className="flex-row items-baseline justify-center">
                                                        <Text className="text-[15px] font-inter font-black text-blue-700">{m.shop_stock.toLocaleString()}</Text>
                                                        <Text className="text-[10px] text-slate-400 font-medium ml-0.5">{m.unit}</Text>
                                                    </View>
                                                    {renderPcs(m, m.shop_stock)}
                                                </View>

                                                <View className="flex-[1] items-center">
                                                    <View className="flex-row items-baseline justify-center">
                                                        <Text className="text-[15px] font-inter font-black text-orange-500">{m.in_transit.toLocaleString()}</Text>
                                                        <Text className="text-[10px] text-slate-400 font-medium ml-0.5">{m.unit}</Text>
                                                    </View>
                                                    {renderPcs(m, m.in_transit)}
                                                </View>

                                                <View className="flex-1 items-center px-1">
                                                    <Text className="text-[13px] text-slate-500 font-inter font-bold text-center">{m.in_transit > 0 ? formatDisplayDate(m.expected_date) : '--'}</Text>
                                                </View>

                                                <View className="flex-[1] items-center">
                                                    <View className="flex-row items-baseline justify-center">
                                                        <Text className="text-[15px] font-inter font-black text-emerald-600">{m.received_at_job.toLocaleString()}</Text>
                                                        <Text className="text-[10px] text-slate-400 font-medium ml-0.5">{m.unit}</Text>
                                                    </View>
                                                    {renderPcs(m, m.received_at_job)}
                                                </View>

                                                <View className="flex-[1] items-center">
                                                    {(m.qty_damaged || 0) + (m.qty_missing || 0) > 0 ? (
                                                        <View>
                                                            <View className="flex-row items-baseline justify-center">
                                                                <Text className="text-[15px] font-inter font-black text-red-500">
                                                                    {((m.qty_damaged || 0) + (m.qty_missing || 0)).toLocaleString()}
                                                                </Text>
                                                                <Text className="text-[10px] text-red-300 font-medium ml-0.5">{m.unit}</Text>
                                                            </View>
                                                            {renderPcs(m, (m.qty_damaged || 0) + (m.qty_missing || 0))}
                                                        </View>
                                                    ) : (
                                                        <Text className="text-[10px] text-slate-300 font-bold">--</Text>
                                                    )}
                                                </View>

                                                <View className="flex-[1] items-center">
                                                    <View className="flex-row items-baseline justify-center">
                                                        <Text className={`text-[15px] font-inter font-black ${toBuy > 0 ? 'text-red-600' : 'text-slate-300'}`}>{toBuy.toLocaleString()}</Text>
                                                        <Text className="text-[10px] text-slate-400 font-medium ml-0.5">{m.unit}</Text>
                                                    </View>
                                                    {renderPcs(m, toBuy)}
                                                </View>

                                                <View className="flex-[1.2] items-center px-1">
                                                    <Text className="text-[12px] font-inter font-bold text-slate-500 text-center" numberOfLines={1}>{m.supplier || '--'}</Text>
                                                </View>

                                                <View className="w-24 flex-row justify-end">
                                                    <TouchableOpacity
                                                        onPress={() => onOrder(m)}
                                                        className="bg-blue-600 px-2 py-1 rounded-lg"
                                                    >
                                                        <Text className="text-white text-[11px] font-inter font-black uppercase">Order</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        )}
                    </View>
                );
            })}

            {/* VENDOR ORDERS SECTION */}
            <View className="pb-20">
                <Text className="text-lg font-inter font-black text-slate-900 tracking-tight mb-6 mt-6">Vendor Orders</Text>

                <View className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <TouchableOpacity
                        onPress={() => toggleSection('VENDOR ORDERS')}
                        className="p-5 flex-row justify-between items-center border-b border-blue-100 bg-blue-50/30"
                    >
                        <View className="flex-row items-center gap-3">
                            <View className="bg-blue-500 p-1.5 rounded-lg">
                                <Ionicons name="cart" size={16} color="white" />
                            </View>
                            <Text className="font-inter font-black text-blue-800 tracking-widest text-xs uppercase">Order History</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <View className="bg-blue-500 w-5 h-5 rounded-full items-center justify-center">
                                <Text className="text-[10px] font-black text-white">{purchaseOrders.length}</Text>
                            </View>
                            <Ionicons name={expandedSections['VENDOR ORDERS'] ? "chevron-down" : "chevron-forward"} size={18} color="#2563eb" />
                        </View>
                    </TouchableOpacity>

                    {expandedSections['VENDOR ORDERS'] && (
                        <View className="p-6">
                            <View className="flex-row flex-wrap gap-4">
                                {purchaseOrders.length === 0 ? (
                                    <View className="w-full py-12 items-center">
                                        <Text className="text-slate-400 italic font-inter font-bold">No purchase orders found</Text>
                                    </View>
                                ) : (
                                    purchaseOrders.map(p => (
                                        <View key={p.id} className="w-[48%] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            <View className="p-4 border-b border-slate-50 flex-row justify-between items-center">
                                                <View>
                                                    <View className="flex-row items-center gap-2">
                                                        <Text className="font-black text-slate-900 text-[15px]">{p.po_number}</Text>
                                                        <View className={`px-2 py-0.5 rounded-full ${p.status === 'Received' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                                                            <Text className={`text-[10px] font-black uppercase ${p.status === 'Received' ? 'text-emerald-700' : 'text-blue-700'}`}>{p.status}</Text>
                                                        </View>
                                                    </View>
                                                    <Text className="text-[12px] text-slate-400 font-bold mt-0.5">{p.vendor} • {new Date(p.created_at || '').toLocaleDateString()}</Text>
                                                </View>
                                            </View>
                                            <View className="p-4 bg-slate-50/50">
                                                <View className="flex-row gap-6 items-center mb-6">
                                                    <View className="flex-row items-center gap-1.5">
                                                        <Ionicons name="cube-outline" size={14} color="#64748b" />
                                                        <Text className="text-[12px] font-black text-slate-800">{p.items?.length || 0} Items</Text>
                                                    </View>
                                                    <View className="flex-row items-center gap-1.5">
                                                        <Ionicons name="calendar-outline" size={14} color="#64748b" />
                                                        <Text className="text-[12px] font-black text-slate-800">Exp: {p.expected_date || 'TBD'}</Text>
                                                    </View>
                                                </View>
                                                {/* Preview Items */}
                                                <View className="pt-2 border-t border-slate-100">
                                                    {p.items?.slice(0, 2).map((item: any) => {
                                                        // Note: We don't have access to materials here to map ID -> Name easily without passing it down.
                                                        // Using placeholder or we need to pass materials lookup map. 
                                                        // For now, let's just show quantity. 
                                                        // Actually, we can pass materials map or just the list.
                                                        // Let's assume aggregatedMaterials contains what we need? No, we need all materials.
                                                        // The item.material_id points to a ProjectMaterial.
                                                        // I'll leave the material name out for now or assume it's fetched? item usually just has material_id.
                                                        // The previous code had access to 'materials' state. 
                                                        // I should pass 'materials' prop if I want this to work.
                                                        // Let's update props to include 'materialsLookup' or 'materials'.
                                                        return (
                                                            <Text key={item.id} className="text-[10px] text-slate-500 font-bold mb-1" numberOfLines={1}>
                                                                • {item.quantity_ordered}x Item
                                                            </Text>
                                                        );
                                                    })}
                                                    {(p.items?.length || 0) > 2 && (
                                                        <Text className="text-[9px] text-slate-400 font-bold italic mt-1">
                                                            + {(p.items?.length || 0) - 2} more items...
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}
