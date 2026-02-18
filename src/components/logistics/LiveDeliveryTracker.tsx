import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Truck, ChevronRight, User, Timer } from 'lucide-react-native';
import { DeliveryTicket } from '../../services/SupabaseService';

interface LiveDeliveryTrackerProps {
    tickets: DeliveryTicket[];
    onReceivePress?: (ticket: DeliveryTicket) => void;
    containerStyle?: string;
}

export default function LiveDeliveryTracker({
    tickets,
    onReceivePress,
    containerStyle = "bg-white mx-8 mt-8 mb-4 p-8 rounded-[40px] border border-slate-200 shadow-xl shadow-slate-100"
}: LiveDeliveryTrackerProps) {
    const liveTickets = tickets.filter(t => t.status === 'DISPATCHED' || t.status === 'IN_TRANSIT');

    if (liveTickets.length === 0) return null;

    return (
        <View className={containerStyle}>
            <View className="flex-row justify-between items-center mb-8">
                <View className="flex-row items-center gap-4">
                    <View className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
                        <Truck size={24} color="white" strokeWidth={2.5} />
                    </View>
                    <View>
                        <Text className="text-slate-900 font-inter font-black text-2xl tracking-tight">Incoming Delivery</Text>
                        <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Real-time logistics tracking</Text>
                    </View>
                </View>
                <View className="bg-blue-600/10 px-4 py-2 rounded-2xl border border-blue-600/20">
                    <Text className="text-blue-600 text-xs font-black uppercase tracking-wider">{liveTickets.length} Active Shipments</Text>
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
                <View className="flex-row gap-6">
                    {liveTickets.map(t => (
                        <TouchableOpacity
                            key={t.id}
                            onPress={() => onReceivePress && onReceivePress(t)}
                            activeOpacity={0.9}
                            className="bg-slate-50 border border-slate-200 p-6 rounded-[32px] w-[340px] shadow-sm"
                        >
                            <View className="flex-row justify-between items-center mb-5">
                                <View className="flex-row items-center gap-2">
                                    <View className="bg-slate-200 px-2.5 py-1 rounded-lg">
                                        <Text className="text-slate-600 font-black text-[11px]">#{t.ticket_number}</Text>
                                    </View>
                                </View>
                                <View className={`px-3 py-1 rounded-full ${t.status === 'DISPATCHED' ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                                    <Text className="text-[10px] font-black uppercase text-white tracking-widest">{t.status}</Text>
                                </View>
                            </View>

                            <View className="mb-6">
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Materials</Text>
                                <Text className="text-slate-800 font-inter font-black text-base leading-tight" numberOfLines={2}>
                                    {t.items?.map((i: any) => i.product_name).join(', ') || 'No items listed'}
                                </Text>
                            </View>

                            <View className="flex-row gap-6 mb-8">
                                <View className="flex-1">
                                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">Driver / Truck</Text>
                                    <View className="flex-row items-center gap-2">
                                        <View className="bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm">
                                            <User size={14} color="#64748b" />
                                        </View>
                                        <Text className="text-slate-700 font-bold text-xs" numberOfLines={1}>{t.truck_id || 'Self Pick-up'}</Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">Expected</Text>
                                    <View className="flex-row items-center gap-2 bg-blue-600 px-3 py-1.5 rounded-xl shadow-md shadow-blue-100">
                                        <Timer size={14} color="white" />
                                        <Text className="text-white font-black text-sm">{t.due_time || '07:00 AM'}</Text>
                                    </View>
                                </View>
                            </View>

                            <View className="border-t border-slate-200 pt-5 flex-row items-center justify-between">
                                <Text className="text-slate-400 font-bold text-[11px]">Tap to verify components</Text>
                                <View className="bg-slate-900 px-4 py-2.5 rounded-2xl flex-row items-center gap-2 shadow-lg shadow-slate-200">
                                    <Text className="text-white text-[10px] font-black uppercase tracking-widest">Verify & Receive</Text>
                                    <ChevronRight size={14} color="white" />
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
