import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryTicket, formatDisplayDate } from '../../services/SupabaseService';
import clsx from 'clsx';

interface LiveDeliveryTrackerProps {
    tickets: DeliveryTicket[];
    onUpdateStatus: (ticket: DeliveryTicket, newStatus: string) => void;
    onReceivePress?: (ticket: DeliveryTicket) => void;
    containerStyle?: string;
}

export default function LiveDeliveryTracker({
    tickets,
    onUpdateStatus,
    onReceivePress,
    containerStyle = "bg-slate-900 mx-8 mt-8 mb-2 p-6 rounded-[32px] shadow-2xl shadow-slate-200"
}: LiveDeliveryTrackerProps) {
    const liveTickets = tickets.filter(t => t.status === 'DISPATCHED' || t.status === 'IN_TRANSIT');

    if (liveTickets.length === 0) return null;

    return (
        <View className={containerStyle}>
            <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center gap-3">
                    <View className="bg-blue-500/20 p-2 rounded-xl">
                        <Ionicons name="airplane" size={20} color="#3b82f6" />
                    </View>
                    <View>
                        <Text className="text-white font-black text-lg tracking-tight">Live Delivery Tracker</Text>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Incoming Materials in Real-Time</Text>
                    </View>
                </View>
                <View className="bg-blue-500 px-3 py-1 rounded-full">
                    <Text className="text-white text-[10px] font-black">{liveTickets.length} ACTIVE</Text>
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-4">
                {liveTickets.map(t => (
                    <TouchableOpacity
                        key={t.id}
                        onPress={() => onReceivePress && onReceivePress(t)}
                        activeOpacity={0.9}
                        className="bg-white/5 border border-white/10 p-4 rounded-2xl w-64"
                    >
                        <View className="flex-row justify-between items-start mb-2">
                            <Text className="text-white font-black text-sm">#{t.ticket_number}</Text>
                            <View className={`px-2 py-0.5 rounded-md ${t.status === 'DISPATCHED' ? 'bg-indigo-500/20' : 'bg-yellow-500/20'}`}>
                                <Text className={`text-[8px] font-black uppercase ${t.status === 'DISPATCHED' ? 'text-indigo-400' : 'text-yellow-400'}`}>{t.status}</Text>
                            </View>
                        </View>
                        <Text className="text-slate-400 text-[10px] font-bold mb-3" numberOfLines={1}>
                            {t.items?.map((i: any) => `${i.product_name}`).join(', ')}
                        </Text>
                        <View className="flex-row items-center justify-between">
                            <View className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 items-end">
                                <Text className="text-[8px] font-black text-blue-400 uppercase">Expected Arrival</Text>
                                <Text className="text-xs font-black text-blue-600">{t.due_time || '07:00 AM'}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => onReceivePress && onReceivePress(t)}
                                className="bg-emerald-500 px-3 py-1 rounded-lg"
                            >
                                <Text className="text-white text-[9px] font-black uppercase">REVIEW & RECEIVE</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}
