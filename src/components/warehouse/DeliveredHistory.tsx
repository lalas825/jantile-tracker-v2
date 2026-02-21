import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService, DeliveryTicket, ProjectMaterial } from '../../services/SupabaseService';
import DeliveryTicketModal from '../logistics/DeliveryTicketModal';

export default function DeliveredHistory() {
    const isWeb = Platform.OS === 'web';
    const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalTicket, setModalTicket] = useState<DeliveryTicket | null>(null);
    const [ticketMaterials, setTicketMaterials] = useState<ProjectMaterial[]>([]);

    const handleOpenTicket = async (t: DeliveryTicket) => {
        try {
            const materials = await SupabaseService.getProjectMaterials(t.job_id);
            setTicketMaterials(materials);
            setModalTicket(t);
        } catch (err) {
            console.error("Failed to load materials for ticket", err);
        }
    };

    useEffect(() => {
        const fetchCompletedDeliveries = async () => {
            try {
                setLoading(true);
                // Fetch all tickets across all jobs (jobId is omitted in custom query or filtered post-fetch)
                let allTickets: DeliveryTicket[] = [];

                if (isWeb) {
                    const { data, error } = await SupabaseService.supabase
                        .from('delivery_tickets')
                        .select('*')
                        .eq('status', 'RECEIVED')
                        .order('updated_at', { ascending: false });

                    if (!error && data) {
                        allTickets = data.map(t => ({
                            ...t,
                            items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
                        }));
                    }
                } else {
                    // This relies on the raw generic query to the local DB if accessible, otherwise fallback to web implementation above.
                    // For thoroughness, we map what's available or implement a custom method if needed.
                    const { data, error } = await SupabaseService.supabase
                        .from('delivery_tickets')
                        .select('*')
                        .eq('status', 'RECEIVED')
                        .order('updated_at', { ascending: false });

                    if (!error && data) {
                        allTickets = data.map(t => ({
                            ...t,
                            items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
                        }));
                    }
                }

                setTickets(allTickets);
            } catch (err) {
                console.error("Error fetching delivered history:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCompletedDeliveries();
    }, [isWeb]);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center py-20 bg-slate-50">
                <ActivityIndicator color="#10b981" />
            </View>
        );
    }

    if (tickets.length === 0) {
        return (
            <View className="p-8 items-center justify-center flex-1 bg-slate-50">
                <View className="bg-emerald-50 p-6 rounded-full mb-4">
                    <Ionicons name="checkmark-done-circle" size={48} color="#10b981" />
                </View>
                <Text className="text-lg font-bold text-slate-700">Delivery History</Text>
                <Text className="text-slate-400 mt-2 text-center max-w-xs">No completed deliveries have been archived yet.</Text>
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 100 }}>
            <View className="p-8">
                <View className="flex-row items-center gap-3 mb-6">
                    <View className="bg-emerald-50 w-10 h-10 rounded-2xl items-center justify-center">
                        <Ionicons name="archive" size={20} color="#10b981" />
                    </View>
                    <Text className="text-slate-900 font-inter font-black uppercase tracking-tight text-sm">Archived Deliveries</Text>
                    <Text className="text-slate-400 font-bold text-sm ml-1">{tickets.length}</Text>
                </View>

                <View className="flex-row flex-wrap gap-4">
                    {tickets.map(t => (
                        <TouchableOpacity
                            key={t.id}
                            onPress={() => handleOpenTicket(t)}
                            activeOpacity={0.7}
                            className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex-1"
                            style={{ flexBasis: '23%', minWidth: 280, maxWidth: '50%' }}
                        >
                            <View className="p-4 border-b border-slate-50 flex-row justify-between items-center bg-slate-50/30">
                                <View>
                                    <View className="flex-row items-center gap-2 mb-1">
                                        <Text className="text-[10px] font-black text-slate-400 uppercase">#{t.ticket_number}</Text>
                                        <View className="w-1 h-1 rounded-full bg-slate-300" />
                                        <Text className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Received</Text>
                                    </View>
                                    <Text className="text-slate-900 font-inter font-black text-base" numberOfLines={1}>{t.job_name || 'Project Name'}</Text>
                                    <Text className="text-slate-500 font-bold text-xs mt-0.5" numberOfLines={1}>
                                        {new Date(t.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    </Text>
                                </View>
                                <View className="items-end bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100 ml-2">
                                    <Ionicons name="checkmark-done" size={16} color="#10b981" />
                                </View>
                            </View>

                            <View className="p-4">
                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3" numberOfLines={1}>Material Manifest</Text>
                                <View className="gap-2">
                                    {(t.items || []).map((item: any, idx) => (
                                        <View key={item.material_id || idx} className="flex-row justify-between items-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                            <View className="flex-1 pr-2">
                                                <Text className="text-xs text-slate-700 font-medium font-bold" numberOfLines={1}>
                                                    {item.product_name || 'Unknown Item'}
                                                </Text>
                                                {item.product_code && (
                                                    <Text className="text-slate-400 text-[10px] mt-0.5 font-bold uppercase">{item.product_code}</Text>
                                                )}
                                            </View>
                                            <View className="items-end pl-2 border-l border-slate-200">
                                                <Text className="text-xs font-black text-slate-900">{item.qty} {item.unit}</Text>
                                                <View className={`mt-1 px-1.5 py-0.5 rounded ${item.condition === 'Missing' ? 'bg-red-100' : item.condition === 'Damaged' ? 'bg-orange-100' : 'bg-emerald-100'}`}>
                                                    <Text className={`text-[8px] font-black uppercase ${item.condition === 'Missing' ? 'text-red-700' : item.condition === 'Damaged' ? 'text-orange-700' : 'text-emerald-700'}`}>
                                                        {item.condition || 'Verified'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                {t.notes && (
                                    <View className="mt-4 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                                        <Text className="text-amber-800 text-[10px] font-medium leading-4">
                                            <Text className="font-bold uppercase">Notes: </Text>{t.notes}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {modalTicket && (
                <DeliveryTicketModal
                    visible={!!modalTicket}
                    onClose={() => setModalTicket(null)}
                    onSuccess={() => setModalTicket(null)}
                    jobId={modalTicket.job_id}
                    jobName={modalTicket.job_name || 'Project Name'}
                    initialData={modalTicket}
                    materials={ticketMaterials}
                    isFieldReview={true}
                    role={'foreman'}
                />
            )}
        </ScrollView>
    );
}
