
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addWeeks, subWeeks } from 'date-fns';
import { SupabaseService, PurchaseOrder, DeliveryTicket, formatDisplayDate } from '../../services/SupabaseService';
import CalendarWeekView from './CalendarWeekView';
import CalendarMonthView from './CalendarMonthView';
import { PackageCheck, Truck, AlertTriangle } from 'lucide-react-native';

export default function WarehouseSchedule() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [currentDate, setCurrentDate] = useState(new Date());

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [allPos, allTickets] = await Promise.all([
                SupabaseService.getAllPurchaseOrders(),
                SupabaseService.getAllDeliveryTickets()
            ]);

            // Transform Inbound POs
            const inboundEvents = allPos
                .filter(p => p.status === 'Ordered' && p.expected_date)
                .map(p => ({
                    id: `PO-${p.id}`,
                    type: 'inbound',
                    title: `↑ ${p.vendor}`,
                    subtitle: `PO #${p.po_number}`,
                    status: p.status,
                    date: p.expected_date,
                    time: p.scheduled_time || '08:00', // Default if missing
                    color: 'bg-orange-100 border-l-4 border-orange-500',
                    data: p
                }));

            // Transform Outbound Tickets
            const outboundEvents = allTickets
                .filter(t => (t.status === 'Scheduled' || t.status === 'scheduled') && t.requested_date)
                .map(t => ({
                    id: `DT-${t.id}`,
                    type: 'outbound',
                    title: `↓ ${t.job_name || 'Project'}`,
                    subtitle: `DT #${t.ticket_number}`,
                    status: t.status,
                    date: t.requested_date,
                    time: t.scheduled_time || '08:00',
                    color: 'bg-blue-100 border-l-4 border-blue-500',
                    data: t
                }));

            setEvents([...inboundEvents, ...outboundEvents]);

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load schedule.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEventUpdate = async (event: any, newDate: string, newTime: string) => {
        try {
            // Optimistic Update
            setEvents(prev => prev.map(e =>
                e.id === event.id
                    ? { ...e, date: newDate, time: newTime }
                    : e
            ));

            if (event.type === 'inbound') {
                // Clean ID 'PO-' prefix if mapping back to real ID (wait, logic uses real ID for DB update)
                const realId = event.data.id;
                await SupabaseService.updatePurchaseOrderTime(realId, newDate, newTime);
            } else {
                const realId = event.data.id;
                await SupabaseService.updateDeliveryTicketTime(realId, newDate, newTime);
            }
        } catch (error) {
            Alert.alert("Sync Error", "Failed to reschedule event.");
            loadData(); // Revert
        }
    };

    const renderCard = (event: any) => {
        const isInbound = event.type === 'inbound';

        return (
            <View className={`rounded-md shadow-sm border p-2 h-full flex-col justify-between overflow-hidden ${isInbound ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                <View>
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className={`text-[9px] font-black px-1 rounded uppercase ${isInbound ? 'text-orange-700 bg-orange-100' : 'text-blue-700 bg-blue-100'}`}>
                            {isInbound ? 'Inbound' : 'Outbound'}
                        </Text>
                    </View>
                    <Text numberOfLines={1} className="text-[10px] font-black text-slate-800 leading-tight">
                        {event.title}
                    </Text>
                    <Text numberOfLines={1} className="text-[9px] font-medium text-slate-500 leading-tight">
                        {event.subtitle}
                    </Text>
                </View>
            </View>
        );
    };

    if (loading && events.length === 0) return <ActivityIndicator size="large" className="mt-20" color="#2563eb" />;

    return (
        <View className="flex-1 bg-white">
            {/* HEADER */}
            <View className="flex-row justify-between items-center px-6 py-4 border-b border-slate-200 bg-white">
                <View className="flex-row items-center gap-4">
                    <View className="flex-row items-center bg-slate-100 rounded-lg p-0.5">
                        <TouchableOpacity onPress={() => setCurrentDate(d => subWeeks(d, 1))} className="p-1 px-2">
                            <Ionicons name="chevron-back" size={18} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setCurrentDate(new Date())} className="px-3">
                            <Text className="font-bold text-slate-600 text-xs text-center min-w-[70px]">
                                {viewMode === 'week' ? 'Current Week' : 'Today'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setCurrentDate(d => addWeeks(d, 1))} className="p-1 px-2">
                            <Ionicons name="chevron-forward" size={18} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-xl font-inter font-black text-slate-800 tracking-tight">
                        {format(currentDate, 'MMMM yyyy')}
                    </Text>
                </View>

                {/* VIEW TOGGLE */}
                <View className="flex-row bg-slate-100 p-1 rounded-xl">
                    <TouchableOpacity
                        onPress={() => setViewMode('week')}
                        className={`px-4 py-2 rounded-lg ${viewMode === 'week' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-xs font-black uppercase tracking-tight ${viewMode === 'week' ? 'text-blue-700' : 'text-slate-500'}`}>Week</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setViewMode('month')}
                        className={`px-4 py-2 rounded-lg ${viewMode === 'month' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-xs font-black uppercase tracking-tight ${viewMode === 'month' ? 'text-blue-700' : 'text-slate-500'}`}>Month</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ERROR / WARNING BANNER (Placeholder) */}
            {/* Could summarize conflicts here if needed */}

            {/* CONTENT */}
            {viewMode === 'week' ? (
                <CalendarWeekView
                    events={events}
                    currentDate={currentDate}
                    onEventUpdate={handleEventUpdate}
                    renderCard={renderCard}
                />
            ) : (
                <CalendarMonthView
                    events={events}
                    currentDate={currentDate}
                    onDayPress={(date) => {
                        setCurrentDate(date);
                        setViewMode('week');
                    }}
                />
            )}
        </View>
    );
}
