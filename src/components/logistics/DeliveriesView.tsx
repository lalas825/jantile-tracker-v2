import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryTicket } from '../../services/SupabaseService';

interface DeliveriesViewProps {
    tickets: DeliveryTicket[];
    onCreateTicket: () => void;
    onUpdateStatus: (ticket: DeliveryTicket, newStatus: string) => void;
    onDeleteTicket: (id: string) => void;
}

const STATUS_COLUMNS = [
    { id: 'draft', label: 'Drafts', color: 'bg-slate-100', dot: 'bg-slate-400' },
    { id: 'pending_approval', label: 'PM Approval', color: 'bg-orange-50', dot: 'bg-orange-400' },
    { id: 'scheduled', label: 'Scheduled', color: 'bg-blue-50', dot: 'bg-blue-500' },
    { id: 'in_transit', label: 'In Transit', color: 'bg-indigo-50', dot: 'bg-indigo-500' },
    { id: 'received', label: 'Received', color: 'bg-emerald-50', dot: 'bg-emerald-500' }
];

export default function DeliveriesView({
    tickets,
    onCreateTicket,
    onUpdateStatus,
    onDeleteTicket
}: DeliveriesViewProps) {

    return (
        <ScrollView horizontal className="flex-1 bg-slate-50">
            <View className="flex-row p-6 gap-4 min-w-full">
                {STATUS_COLUMNS.map(col => {
                    const colTickets = tickets.filter(t => t.status === col.id);

                    return (
                        <View key={col.id} className="w-[300px] flex-col h-full rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                            {/* Header */}
                            <View className={`p-4 border-b border-slate-100 flex-row justify-between items-center ${col.color}`}>
                                <View className="flex-row items-center gap-2">
                                    <View className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                    <Text className="font-inter font-black text-slate-700 uppercase tracking-tight text-xs">{col.label}</Text>
                                </View>
                                <View className="bg-white/50 px-2 py-0.5 rounded text-xs">
                                    <Text className="font-bold text-slate-500 text-[10px]">{colTickets.length}</Text>
                                </View>
                            </View>

                            {/* Content */}
                            <ScrollView className="flex-1 p-3" contentContainerStyle={{ gap: 12 }}>
                                {colTickets.length === 0 ? (
                                    <View className="py-10 items-center justify-center opacity-50">
                                        <Text className="text-slate-300 font-bold italic text-xs">Empty</Text>
                                    </View>
                                ) : (
                                    colTickets.map(t => (
                                        <View key={t.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm active:opacity-75">
                                            <View className="flex-row justify-between items-start mb-2">
                                                <View>
                                                    <Text className="font-black text-slate-900 text-sm">#{t.ticket_number}</Text>
                                                    <Text className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(t.requested_date).toLocaleDateString()}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => onDeleteTicket(t.id)}>
                                                    <Ionicons name="ellipsis-horizontal" size={16} color="#94a3b8" />
                                                </TouchableOpacity>
                                            </View>

                                            <View className="flex-row items-center gap-1.5 mb-3">
                                                <Ionicons name="business-outline" size={12} color="#64748b" />
                                                <Text className="text-[11px] font-bold text-slate-600 truncate" numberOfLines={1}>{t.destination || 'No destination'}</Text>
                                            </View>

                                            <View className="flex-row items-center justify-between pt-2 border-t border-slate-50">
                                                <View className="flex-row items-center gap-1">
                                                    <Ionicons name="cube-outline" size={12} color="#64748b" />
                                                    <Text className="text-[11px] font-bold text-slate-500">{t.items?.length || 0} Items</Text>
                                                </View>

                                                {/* ACTION BUTTON (Move Forward) */}
                                                {col.id !== 'received' && (
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            const nextStatus = STATUS_COLUMNS[STATUS_COLUMNS.findIndex(c => c.id === col.id) + 1]?.id;
                                                            if (nextStatus) onUpdateStatus(t, nextStatus);
                                                        }}
                                                        className="bg-blue-50 px-2 py-1 rounded flex-row items-center gap-1"
                                                    >
                                                        <Text className="text-[9px] font-black text-blue-600 uppercase">Advance</Text>
                                                        <Ionicons name="arrow-forward" size={10} color="#2563eb" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    ))
                                )}
                            </ScrollView>

                            {/* Footer Action (Only for Drafts - maybe create new here?) */}
                            {col.id === 'draft' && (
                                <TouchableOpacity
                                    onPress={onCreateTicket}
                                    className="p-3 border-t border-slate-100 flex-row items-center justify-center gap-2 bg-slate-50/50"
                                >
                                    <Ionicons name="add" size={14} color="#64748b" />
                                    <Text className="text-slate-600 font-bold text-xs">New Ticket</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}
