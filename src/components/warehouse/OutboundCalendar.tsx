import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO } from 'date-fns';
import { SupabaseService, DeliveryTicket } from '../../services/SupabaseService';
import CalendarWeekView from './CalendarWeekView';
import CalendarMonthView from './CalendarMonthView';
import { Truck } from 'lucide-react-native';

export default function OutboundCalendar() {
    const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [currentDate, setCurrentDate] = useState(new Date());

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const allTickets = await SupabaseService.getAllDeliveryTickets();
            const scheduled = allTickets.filter(t => t.status === 'Scheduled' || t.status === 'scheduled');
            setTickets(scheduled);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEventUpdate = async (event: any, newDate: string, newTime: string) => {
        try {
            // Optimistic update
            const updatedTickets = tickets.map(t =>
                t.id === event.id
                    ? { ...t, requested_date: newDate, scheduled_time: newTime }
                    : t
            );
            setTickets(updatedTickets);

            await SupabaseService.updateDeliveryTicketTime(event.id, newDate, newTime);
        } catch (error) {
            Alert.alert("Sync Error", "Failed to move ticket.");
            loadData(); // Revert
        }
    };

    const handleDispatch = async (ticket: DeliveryTicket) => {
        if (!confirm(`Dispatch Ticket #${ticket.ticket_number}?`)) return;
        try {
            await SupabaseService.updateTicketStatus(ticket, 'In Transit');
            loadData(); // Refresh list to remove it (since we filter for Scheduled)
        } catch (err) {
            Alert.alert("Error", "Failed to dispatch");
        }
    };

    // Transform tickets to calendar events
    const calendarEvents = tickets.map(t => ({
        id: t.id,
        title: `#${t.ticket_number} - ${t.destination}`,
        subtitle: t.destination,
        status: t.status,
        date: t.requested_date || format(new Date(), 'yyyy-MM-dd'),
        time: t.scheduled_time || '08:00',
        color: 'bg-blue-100 border-l-4 border-blue-500',
        data: t
    }));

    const renderCard = (event: any) => {
        const ticket = event.data as DeliveryTicket;
        return (
            <View className="bg-white rounded-md shadow-sm border border-slate-200 p-2 h-full flex-col justify-between overflow-hidden">
                <View>
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-[10px] font-black text-blue-700 bg-blue-50 px-1 rounded">
                            #{ticket.ticket_number}
                        </Text>
                    </View>
                    <Text numberOfLines={2} className="text-[11px] font-bold text-slate-800 leading-tight">
                        {ticket.destination}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => handleDispatch(ticket)}
                    className="bg-blue-600 py-1 rounded items-center mt-1"
                >
                    <View className="flex-row items-center gap-1">
                        <Truck size={8} color="white" />
                        <Text className="text-[9px] font-bold text-white uppercase">Dispatch</Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading && tickets.length === 0) return <ActivityIndicator size="large" className="mt-20" />;

    return (
        <View className="flex-1 bg-white">
            {/* HEADER */}
            <View className="flex-row justify-between items-center px-6 py-3 border-b border-slate-200">
                <View className="flex-row items-center gap-4">
                    <View className="flex-row items-center bg-slate-100 rounded-lg p-0.5">
                        <TouchableOpacity onPress={() => setCurrentDate(d => subWeeks(d, 1))} className="p-1 px-2">
                            <Ionicons name="chevron-back" size={18} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setCurrentDate(new Date())} className="px-3">
                            <Text className="font-bold text-slate-600 text-xs text-center min-w-[60px]">
                                {viewMode === 'week' ? 'Current Week' : 'Today'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setCurrentDate(d => addWeeks(d, 1))} className="p-1 px-2">
                            <Ionicons name="chevron-forward" size={18} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-lg font-inter font-black text-slate-800">
                        {format(currentDate, 'MMMM yyyy')}
                    </Text>
                </View>

                {/* VIEW TOGGLE */}
                <View className="flex-row bg-slate-100 p-1 rounded-lg">
                    <TouchableOpacity
                        onPress={() => setViewMode('week')}
                        className={`px-3 py-1.5 rounded-md ${viewMode === 'week' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-xs font-bold ${viewMode === 'week' ? 'text-slate-900' : 'text-slate-500'}`}>Week</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setViewMode('month')}
                        className={`px-3 py-1.5 rounded-md ${viewMode === 'month' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-xs font-bold ${viewMode === 'month' ? 'text-slate-900' : 'text-slate-500'}`}>Month</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* CONTENT */}
            {viewMode === 'week' ? (
                <CalendarWeekView
                    events={calendarEvents}
                    currentDate={currentDate}
                    onEventUpdate={handleEventUpdate}
                    renderCard={renderCard}
                />
            ) : (
                <CalendarMonthView
                    events={calendarEvents}
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
