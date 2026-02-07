import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box, Truck, CheckCircle2, Circle, Clock, ChevronDown, ChevronRight, AlertCircle, Calendar } from 'lucide-react-native';
import { SupabaseService, DeliveryTicket, formatDisplayDate } from '../../services/SupabaseService';

export default function OutboundList() {
    const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
    const [checkedItems, setCheckedItems] = useState<Record<string, Record<string, boolean>>>({});

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const allTickets = await SupabaseService.getOutboundTickets();
            setTickets(allTickets);

            // Auto-expand jobs that have scheduled tickets
            const initialExpanded: Record<string, boolean> = {};
            allTickets.forEach(t => {
                if (t.status === 'scheduled' || t.status === 'Scheduled') {
                    initialExpanded[t.job_name || 'Unknown'] = true;
                }
            });
            setExpandedJobs(prev => ({ ...prev, ...initialExpanded }));
        } catch (error) {
            console.error("Outbound Error:", error);
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

    const toggleItemCheck = (ticketId: string, itemId: string) => {
        setCheckedItems(prev => {
            const ticketChecks = prev[ticketId] || {};
            return {
                ...prev,
                [ticketId]: {
                    ...ticketChecks,
                    [itemId]: !ticketChecks[itemId]
                }
            };
        });
    };

    const isTicketFullyChecked = (ticket: DeliveryTicket) => {
        if (!ticket.items || ticket.items.length === 0) return true;
        const checks = checkedItems[ticket.id] || {};
        return ticket.items.every((item: any) => checks[item.material_id]);
    };

    const handleDispatch = async (ticket: DeliveryTicket) => {
        if (!isTicketFullyChecked(ticket)) {
            Alert.alert("Incomplete", "Please verify all items before dispatching.");
            return;
        }

        try {
            await SupabaseService.updateTicketStatus(ticket, 'in_transit');
            // In a real app, this would also trigger a notification to the foreman
            loadData();
        } catch (err) {
            Alert.alert("Error", "Failed to dispatch ticket");
        }
    };

    // Grouping
    const unscheduled = useMemo(() =>
        tickets.filter(t => t.status === 'pending_approval'),
        [tickets]);

    const scheduledByJob = useMemo(() => {
        const scheduled = tickets.filter(t => t.status === 'scheduled' || t.status === 'Scheduled');
        const groups: Record<string, DeliveryTicket[]> = {};
        scheduled.forEach(t => {
            const name = t.job_name || 'Unassigned Project';
            if (!groups[name]) groups[name] = [];
            groups[name].push(t);
        });
        return groups;
    }, [tickets]);

    const inTransit = useMemo(() =>
        tickets.filter(t => t.status === 'in_transit'),
        [tickets]);

    if (loading && tickets.length === 0) {
        return <ActivityIndicator size="large" color="#2563eb" className="mt-20" />;
    }

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 100 }}>
            <View className="p-8">
                {/* 1. UNSCHEDULED BANNER */}
                {unscheduled.length > 0 && (
                    <View className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
                        <View className="bg-amber-100/50 px-6 py-4 flex-row items-center gap-3 border-b border-amber-200">
                            <Clock size={18} color="#d97706" strokeWidth={2.5} />
                            <Text className="text-amber-800 font-inter font-black uppercase tracking-tight text-sm">
                                Approved Requests (Needs Date)
                            </Text>
                            <View className="bg-amber-200/50 px-2 py-0.5 rounded ml-auto">
                                <Text className="text-amber-900 font-bold text-xs">{unscheduled.length}</Text>
                            </View>
                        </View>
                        <View className="p-4 gap-3">
                            {unscheduled.map(t => (
                                <View key={t.id} className="bg-white border border-amber-200/50 rounded-xl p-4 flex-row justify-between items-center group">
                                    <View>
                                        <View className="flex-row items-center gap-2 mb-1">
                                            <Text className="bg-amber-100 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Unscheduled</Text>
                                            <Text className="text-slate-400 font-black text-[10px]">#{t.ticket_number}</Text>
                                        </View>
                                        <Text className="text-base font-inter font-black text-slate-900">{t.job_name || 'Project Name'}</Text>
                                        <Text className="text-slate-500 font-bold text-xs mt-0.5 italic">"{t.notes || 'Material Request from Field'}"</Text>
                                    </View>
                                    <View className="items-end gap-2">
                                        <View className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 flex-row items-center gap-2">
                                            <Calendar size={14} color="#64748b" />
                                            <Text className="text-slate-400 font-bold text-xs uppercase">Select Ship Date & Time</Text>
                                            <TouchableOpacity className="bg-blue-600 px-3 py-1.5 rounded-md ml-2 shadow-sm shadow-blue-200">
                                                <Text className="text-white font-black uppercase text-[10px]">Schedule</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* 2. SCHEDULED QUEUE */}
                <View className="mb-8">
                    <View className="flex-row items-center gap-3 mb-6">
                        <Box size={20} color="#64748b" strokeWidth={2.5} />
                        <Text className="text-slate-900 font-inter font-black uppercase tracking-tight text-sm">Scheduled Queue</Text>
                        <Text className="text-slate-400 font-bold text-sm ml-1">{Object.values(scheduledByJob).flat().length}</Text>
                    </View>

                    {Object.entries(scheduledByJob).map(([jobName, jobTickets]) => (
                        <View key={jobName} className="mb-4">
                            <TouchableOpacity
                                onPress={() => toggleJob(jobName)}
                                className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex-row justify-between items-center shadow-sm"
                            >
                                <View className="flex-row items-center gap-4">
                                    <View className="bg-blue-50 p-2 rounded-xl">
                                        <Box size={20} color="#2563eb" strokeWidth={2.5} />
                                    </View>
                                    <Text className="text-lg font-inter font-black text-slate-800 tracking-tight">{jobName}</Text>
                                </View>
                                <View className="flex-row items-center gap-4">
                                    <View className="bg-blue-50 px-3 py-1 rounded-full">
                                        <Text className="text-blue-700 font-black text-[10px] uppercase">{jobTickets.length} Shipments</Text>
                                    </View>
                                    <ChevronDown size={20} color="#94a3b8" />
                                </View>
                            </TouchableOpacity>

                            {expandedJobs[jobName] && (
                                <View className="mt-4 gap-4 pl-4 border-l-2 border-slate-100 ml-8">
                                    {jobTickets.map(t => (
                                        <View key={t.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            {/* Card Header */}
                                            <View className="p-4 border-b border-slate-50 flex-row justify-between items-center bg-slate-50/30">
                                                <View>
                                                    <View className="flex-row items-center gap-2 mb-1">
                                                        <Text className="text-[10px] font-black text-slate-400 uppercase">#{t.ticket_number}</Text>
                                                        <View className="w-1 h-1 rounded-full bg-slate-300" />
                                                        <Text className="bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Scheduled</Text>
                                                    </View>
                                                    <Text className="text-slate-900 font-inter font-black text-base">{jobName}</Text>
                                                    <View className="flex-row items-center gap-1.5 mt-1">
                                                        <Clock size={12} color="#3b82f6" strokeWidth={2.5} />
                                                        <Text className="text-blue-600 font-black text-[11px] uppercase tracking-wider">
                                                            {formatDisplayDate(t.requested_date)} • {t.scheduled_time || '07:00 AM'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View className="items-end">
                                                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dispatch Mode</Text>
                                                    <View className="flex-row items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                                        <Truck size={14} color="#64748b" />
                                                        <Text className="text-[10px] font-black text-slate-600 uppercase">Priority Delivery</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Material Checklist */}
                                            <View className="p-4">
                                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Material Checklist</Text>
                                                <View className="gap-2">
                                                    {(t.items || []).map((item: any) => (
                                                        <TouchableOpacity
                                                            key={item.material_id}
                                                            onPress={() => toggleItemCheck(t.id, item.material_id)}
                                                            className={`flex-row items-center p-3 rounded-xl border ${checkedItems[t.id]?.[item.material_id] ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}
                                                        >
                                                            {checkedItems[t.id]?.[item.material_id] ? (
                                                                <CheckCircle2 size={18} color="#2563eb" strokeWidth={2.5} />
                                                            ) : (
                                                                <Circle size={18} color="#cbd5e1" strokeWidth={2.5} />
                                                            )}
                                                            <View className="ml-3 flex-1">
                                                                <Text className={`font-black text-sm ${checkedItems[t.id]?.[item.material_id] ? 'text-blue-900' : 'text-slate-900'}`}>
                                                                    {item.product_code || item.product_name}
                                                                </Text>
                                                                <Text className="text-[10px] text-slate-500 font-medium">
                                                                    {item.product_name}
                                                                    {(item.dim_length && item.dim_width) ? ` | ${item.dim_length}x${item.dim_width}` : ''}
                                                                </Text>
                                                            </View>
                                                            <View className="items-end">
                                                                <Text className="text-sm font-black text-slate-900">{item.qty} {item.unit}</Text>
                                                            </View>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>

                                                {/* Logistics Notes */}
                                                {(t.notes || t.destination) && (
                                                    <View className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                        <View className="flex-row items-center gap-2 mb-2">
                                                            <AlertCircle size={14} color="#64748b" />
                                                            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Driver Instructions / Notes</Text>
                                                        </View>
                                                        <Text className="text-slate-700 text-xs font-bold leading-5">
                                                            {t.notes || `Deliver to: ${t.destination}`}
                                                        </Text>
                                                    </View>
                                                )}

                                                {/* Action Bar */}
                                                <View className="mt-6 flex-row items-center justify-between pt-6 border-t border-slate-50">
                                                    <View className="flex-row items-center gap-4">
                                                        <TouchableOpacity className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                            <Ionicons name="pencil-outline" size={16} color="#94a3b8" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity className="bg-red-50 p-2 rounded-lg border border-red-50">
                                                            <Ionicons name="trash-outline" size={16} color="#f87171" />
                                                        </TouchableOpacity>
                                                    </View>

                                                    <TouchableOpacity
                                                        onPress={() => handleDispatch(t)}
                                                        className={`px-8 py-3 rounded-xl flex-row items-center gap-2 shadow-lg ${isTicketFullyChecked(t) ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-100 opacity-50'}`}
                                                        disabled={!isTicketFullyChecked(t)}
                                                    >
                                                        <Truck size={18} color={isTicketFullyChecked(t) ? "white" : "#94a3b8"} strokeWidth={2.5} />
                                                        <Text className={`font-inter font-black uppercase tracking-widest text-xs ${isTicketFullyChecked(t) ? 'text-white' : 'text-slate-400'}`}>
                                                            Dispatch
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {!isTicketFullyChecked(t) && (
                                                    <Text className="text-slate-400 text-[9px] font-bold uppercase text-right mt-2 mr-1">Verify all items to enable dispatch</Text>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}
                </View>

                {/* 3. ACTIVE: IN TRANSIT */}
                <View>
                    <View className="flex-row items-center gap-3 mb-6">
                        <Truck size={20} color="#64748b" strokeWidth={2.5} />
                        <Text className="text-slate-900 font-inter font-black uppercase tracking-tight text-sm">Active: In Transit</Text>
                        <Text className="text-slate-400 font-bold text-sm ml-1">{inTransit.length}</Text>
                    </View>

                    {inTransit.length === 0 ? (
                        <View className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] py-16 items-center justify-center">
                            <Truck size={40} color="#cbd5e1" strokeWidth={1} />
                            <Text className="text-slate-400 font-bold text-sm mt-4 italic">No trucks on the road.</Text>
                        </View>
                    ) : (
                        <View className="gap-4">
                            {inTransit.map(t => (
                                <View key={t.id} className="bg-blue-600 border border-blue-500 rounded-2xl p-6 flex-row justify-between items-center shadow-lg shadow-blue-100">
                                    <View className="flex-row items-center gap-6">
                                        <View className="bg-white/20 p-3 rounded-2xl">
                                            <Truck size={24} color="white" />
                                        </View>
                                        <View>
                                            <View className="flex-row items-center gap-2 mb-1">
                                                <Text className="text-white/60 font-black text-[10px] uppercase tracking-widest">Dispatched</Text>
                                                <View className="w-1 h-1 rounded-full bg-blue-300" />
                                                <Text className="text-white font-black text-[10px]">#{t.ticket_number}</Text>
                                            </View>
                                            <Text className="text-white font-inter font-black text-lg tracking-tight">{t.job_name || 'Destination'}</Text>
                                            <Text className="text-blue-100 font-bold text-xs mt-0.5">Estimated Arrival: 45 min</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity className="bg-white px-6 py-2.5 rounded-xl border border-blue-500 shadow-sm">
                                        <Text className="text-blue-600 font-black uppercase text-xs tracking-widest">Track Driver</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );
}
