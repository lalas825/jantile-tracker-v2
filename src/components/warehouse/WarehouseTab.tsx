import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box, Truck, ArrowRight, ArrowLeft, CheckCircle, ShoppingCart, AlertCircle } from 'lucide-react-native';
import { SupabaseService } from '../../services/SupabaseService';

// Sub-components
import OutboundCalendar from './OutboundCalendar';
import OutboundList from './OutboundList';
import ReceivingCalendar from './ReceivingCalendar';
import ReceivingList from './ReceivingList';
import InventoryView from './InventoryView';
import DirectOrdersView from './DirectOrdersView';
import DeliveredHistory from './DeliveredHistory';
import DiscrepancyHistory from './DiscrepancyHistory';

type ViewMode = 'outbound' | 'receiving' | 'inventory' | 'direct' | 'delivered' | 'claims';
type SubViewMode = 'list' | 'board';

export default function WarehouseTab() {
    const [viewMode, setViewMode] = useState<ViewMode>('outbound');
    const [subViewMode, setSubViewMode] = useState<SubViewMode>('list');
    const [receivingSubView, setReceivingSubView] = useState<SubViewMode>('list');
    const [searchQuery, setSearchQuery] = useState('');

    const [counts, setCounts] = useState({ outbound: 0, receiving: 0 });

    useEffect(() => {
        const loadCounts = async () => {
            try {
                const tickets = await SupabaseService.getAllDeliveryTickets();
                const outboundCount = tickets.filter(t => t.status === 'Scheduled' || t.status === 'scheduled' || t.status === 'pending_approval').length;

                const pos = await SupabaseService.getReceivingPOs();
                const receivingCount = pos.length;

                setCounts({ outbound: outboundCount, receiving: receivingCount });
            } catch (err) {
                console.error("Failed to load warehouse counts", err);
            }
        };
        loadCounts();
    }, [viewMode]);

    const renderTab = (mode: ViewMode, label: string, icon: any, count?: number) => {
        const isActive = viewMode === mode;
        const Icon = icon;

        return (
            <TouchableOpacity
                onPress={() => setViewMode(mode)}
                className={`flex-row items-center px-4 py-2.5 rounded-t-lg gap-2 border-b-2 transition-all ${isActive ? 'border-blue-600 bg-blue-50/50' : 'border-transparent hover:bg-slate-50'}`}
            >
                <Icon size={16} color={isActive ? '#2563eb' : '#64748b'} strokeWidth={2.5} />
                <Text className={`text-[13px] font-inter font-bold tracking-tight ${isActive ? 'text-blue-700' : 'text-slate-500'}`}>
                    {label}
                </Text>
                {count !== undefined && count > 0 && (
                    <View className={`px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Text className={`text-[10px] font-black ${isActive ? 'text-blue-700' : 'text-slate-500'}`}>{count}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-slate-50">
            {/* MAIN HEADER */}
            <View className="bg-white border-b border-slate-200 pt-6 px-8 pb-0">
                <View className="flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center gap-3">
                        <View className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                            <Box size={24} color="white" strokeWidth={2.5} />
                        </View>
                        <View>
                            <Text className="text-2xl font-inter font-black text-slate-900 tracking-tight">Warehouse Management</Text>
                        </View>
                    </View>

                    {/* GLOBAL SEARCH & TOGGLES */}
                    <View className="flex-row items-center gap-6">
                        {viewMode === 'outbound' && (
                            <View className="flex-row bg-slate-100 p-1 rounded-xl">
                                <TouchableOpacity
                                    onPress={() => setSubViewMode('list')}
                                    className={`flex-row items-center gap-2 px-4 py-1.5 rounded-lg ${subViewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                                >
                                    <Ionicons name="list" size={16} color={subViewMode === 'list' ? '#2563eb' : '#64748b'} />
                                    <Text className={`text-xs font-black uppercase tracking-tight ${subViewMode === 'list' ? 'text-blue-700' : 'text-slate-500'}`}>List</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setSubViewMode('board')}
                                    className={`flex-row items-center gap-2 px-4 py-1.5 rounded-lg ${subViewMode === 'board' ? 'bg-white shadow-sm' : ''}`}
                                >
                                    <Ionicons name="apps" size={16} color={subViewMode === 'board' ? '#2563eb' : '#64748b'} />
                                    <Text className={`text-xs font-black uppercase tracking-tight ${subViewMode === 'board' ? 'text-blue-700' : 'text-slate-500'}`}>Board</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {viewMode === 'receiving' && (
                            <View className="flex-row bg-slate-100 p-1 rounded-xl">
                                <TouchableOpacity
                                    onPress={() => setReceivingSubView('list')}
                                    className={`flex-row items-center gap-2 px-4 py-1.5 rounded-lg ${receivingSubView === 'list' ? 'bg-white shadow-sm' : ''}`}
                                >
                                    <Ionicons name="list" size={16} color={receivingSubView === 'list' ? '#2563eb' : '#64748b'} />
                                    <Text className={`text-xs font-black uppercase tracking-tight ${receivingSubView === 'list' ? 'text-blue-700' : 'text-slate-500'}`}>List</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setReceivingSubView('board')}
                                    className={`flex-row items-center gap-2 px-4 py-1.5 rounded-lg ${receivingSubView === 'board' ? 'bg-white shadow-sm' : ''}`}
                                >
                                    <Ionicons name="apps" size={16} color={receivingSubView === 'board' ? '#2563eb' : '#64748b'} />
                                    <Text className={`text-xs font-black uppercase tracking-tight ${receivingSubView === 'board' ? 'text-blue-700' : 'text-slate-500'}`}>Board</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <View className="flex-row items-center bg-white border border-slate-200 rounded-xl px-4 py-2 w-80 shadow-sm focus:border-blue-400">
                            <Ionicons name="search" size={18} color="#94a3b8" />
                            <TextInput
                                className="flex-1 ml-3 text-sm font-inter text-slate-900"
                                placeholder="Search..."
                                placeholderTextColor="#cbd5e1"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>
                </View>

                {/* NAVIGATION TABS */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {renderTab('outbound', 'Outbound', ArrowRight, counts.outbound)}
                    {renderTab('receiving', 'Receiving Bay', ArrowLeft, counts.receiving)}
                    {renderTab('inventory', 'Warehouse Inventory', Box)}
                    {renderTab('direct', 'Direct Orders', ShoppingCart)}
                    {renderTab('delivered', 'Delivered', CheckCircle)}
                    {renderTab('claims', 'Discrepancy History', AlertCircle)}
                </ScrollView>
            </View>

            {/* CONTENT AREA */}
            <View className="flex-1">
                {viewMode === 'outbound' && (subViewMode === 'list' ? <OutboundList /> : <OutboundCalendar />)}
                {viewMode === 'receiving' && (receivingSubView === 'list' ? <ReceivingList /> : <ReceivingCalendar />)}
                {viewMode === 'inventory' && <InventoryView />}
                {viewMode === 'direct' && <DirectOrdersView />}
                {viewMode === 'delivered' && <DeliveredHistory />}
                {viewMode === 'claims' && <DiscrepancyHistory />}
            </View>
        </View>
    );
}
