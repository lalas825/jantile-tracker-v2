import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { View, Text, ScrollView, ActivityIndicator, Platform, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { SupabaseService, DeliveryTicket, ProjectMaterial } from '../../services/SupabaseService';
import { useQuery } from '@powersync/react';
import { useAuth } from '../../context/AuthContext';
import LiveDeliveryTracker from '../logistics/LiveDeliveryTracker';
import ReceiveMaterialModal from '../modals/ReceiveMaterialModal';
import DeliveryTicketModal from '../logistics/DeliveryTicketModal';

interface JobSiteTabProps {
    job: any;
}

export default function JobSiteTab({ job }: JobSiteTabProps) {
    const isWeb = Platform.OS === 'web';
    const { profile } = useAuth();
    const [receiveTicket, setReceiveTicket] = useState<DeliveryTicket | null>(null);
    const [modalTicket, setModalTicket] = useState<DeliveryTicket | null>(null);
    const [ticketModalVisible, setTicketModalVisible] = useState(false);

    // 1. DATA SOURCE (PowerSync or Web Fallback)
    const { data: tickets = [] } = useQuery(
        'SELECT * FROM delivery_tickets WHERE job_id = ? ORDER BY updated_at DESC',
        [job.id]
    );

    const [webTickets, setWebTickets] = useState<DeliveryTicket[]>([]);
    const [webMaterials, setWebMaterials] = useState<ProjectMaterial[]>([]);
    const [loading, setLoading] = useState(isWeb);

    const { data: materials = [] } = useQuery('SELECT * FROM project_materials WHERE job_id = ?', [job.id]);

    useEffect(() => {
        if (isWeb) {
            const fetchData = async () => {
                try {
                    const [tData, mData] = await Promise.all([
                        SupabaseService.getDeliveryTickets(job.id),
                        SupabaseService.getProjectMaterials(job.id)
                    ]);
                    setWebTickets(tData);
                    setWebMaterials(mData);
                } catch (err) {
                    console.error("Failed to fetch data on web:", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [job.id, isWeb]);

    const handleReceiveSuccess = () => {
        if (isWeb) {
            const fetchTickets = async () => {
                const data = await SupabaseService.getDeliveryTickets(job.id);
                setWebTickets(data);
            };
            fetchTickets();
        }
    };

    // 2. REAL-TIME TELEMETRY (Filtered by Job)
    const { data: issuesCount } = useQuery("SELECT count(*) as count FROM job_issues WHERE job_id = ? AND status = 'open'", [job.id]);
    const { data: siteManpower } = useQuery("SELECT count(*) as count FROM crew_checkins WHERE job_id = ? AND check_out IS NULL", [job.id]);
    const { data: siteProgress } = useQuery("SELECT avg(progress) as avg_progress FROM areas WHERE job_id = ?", [job.id]);

    // 3. DYNAMIC ACTIVITY FEED
    const { data: activityItems = [] } = useQuery(`
        SELECT 'alert-circle' as icon, 'text-red-500' as color, 'bg-red-50' as bg, type as title, description as sub, created_at as time 
        FROM job_issues WHERE job_id = ?
        UNION ALL
        SELECT 'truck' as icon, 'text-blue-500' as color, 'bg-blue-50' as bg, 'Delivery Update' as title, 'DT #' || ticket_number || ' is ' || status as sub, updated_at as time 
        FROM delivery_tickets WHERE job_id = ?
        ORDER BY time DESC LIMIT 5
    `, [job.id, job.id]);

    const stats = {
        issues: (issuesCount?.[0] as any)?.count || 0,
        manpower: (siteManpower?.[0] as any)?.count || 0,
        progress: Math.round((siteProgress?.[0] as any)?.avg_progress || 0)
    };

    const finalTickets = useMemo(() => {
        const raw = isWeb ? webTickets : tickets;
        return raw.map((t: any) => ({
            ...t,
            items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
        })) as DeliveryTicket[];
    }, [isWeb, webTickets, tickets]);

    const handleUpdateStatus = async (ticket: DeliveryTicket, newStatus: string) => {
        try {
            await SupabaseService.updateTicketStatus(ticket.id, newStatus);
            if (isWeb) {
                setWebTickets(prev => prev.map((t: any) => t.id === ticket.id ? { ...t, status: newStatus } : t));
            }
        } catch (err) {
            console.error("Update Status Error:", err);
            Alert.alert("Error", "Failed to update status");
        }
    };

    const handleApprove = async (ticket: DeliveryTicket, role: 'foreman' | 'supervisor') => {
        try {
            // JOBSITE TAB = Foreman context. Always approve as foreman here.
            await SupabaseService.approveDeliveryTicket(ticket.id, 'foreman');
            if (isWeb) {
                const updated = await SupabaseService.getDeliveryTickets(job.id);
                setWebTickets(updated);
            }
        } catch (err: any) {
            console.error("Approval Error:", err);
            Alert.alert("Error", "Failed to approve ticket");
        }
    };

    const handleEdit = (ticket: DeliveryTicket) => {
        setModalTicket(ticket);
        setTicketModalVisible(true);
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center py-20">
                <ActivityIndicator color="#3b82f6" />
            </View>
        );
    }

    return (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
            {/* 0. PENDING APPROVALS (High Priority) */}
            {finalTickets.some(t => t.status === 'PENDING_FIELD_REVIEW') && (
                <View className="bg-orange-50 mx-6 mt-6 p-6 rounded-[32px] border border-orange-100">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-3">
                            <View className="bg-orange-100 p-2 rounded-xl">
                                <Ionicons name="alert-circle" size={20} color="#ea580c" />
                            </View>
                            <View>
                                <Text className="text-orange-900 font-black text-lg tracking-tight">Awaiting Field Review</Text>
                                <Text className="text-orange-600/60 text-[10px] font-bold uppercase tracking-widest">Action Required</Text>
                            </View>
                        </View>
                        <View className="bg-orange-500 px-3 py-1 rounded-full shadow-sm">
                            <Text className="text-white text-[10px] font-black">{finalTickets.filter(t => t.status === 'PENDING_FIELD_REVIEW').length} WAITING</Text>
                        </View>
                    </View>

                    <View className="flex-row flex-wrap gap-4">
                        {finalTickets.filter(t => t.status === 'PENDING_FIELD_REVIEW').map(t => (
                            <View key={t.id} className="bg-white p-4 rounded-2xl border border-orange-100 shadow-sm" style={{ flexBasis: '31%', flexGrow: 0 }}>
                                <View className="flex-row justify-between items-start mb-3">
                                    <View className="flex-1 mr-2">
                                        <Text className="text-slate-900 font-black text-base">DT #{t.ticket_number}</Text>
                                        <View className="flex-row flex-wrap items-center gap-2">
                                            <Text className="text-slate-400 text-[10px] font-bold uppercase">{t.items?.length || 0} Items • {new Date(t.requested_date || t.updated_at).toLocaleDateString()}</Text>
                                            {t.field_modified && (
                                                <View className="bg-orange-100 px-1.5 py-0.5 rounded-md">
                                                    <Text className="text-orange-600 text-[8px] font-black uppercase tracking-tighter">MODIFIED</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View className="flex-row flex-wrap justify-end gap-1.5 max-w-[140px]">
                                        <TouchableOpacity
                                            onPress={() => handleEdit(t)}
                                            className="bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200"
                                        >
                                            <Ionicons name="create-outline" size={14} color="#475569" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (Platform.OS === 'web') {
                                                    if (confirm('Reject this ticket?')) handleUpdateStatus(t, 'REJECTED');
                                                } else {
                                                    Alert.alert(
                                                        'Confirm Rejection',
                                                        'Are you sure you want to reject this ticket?',
                                                        [
                                                            { text: 'Cancel', style: 'cancel' },
                                                            { text: 'Reject', onPress: () => handleUpdateStatus(t, 'REJECTED'), style: 'destructive' }
                                                        ]
                                                    );
                                                }
                                            }}
                                            className="bg-white border border-slate-200 px-2 py-1.5 rounded-lg"
                                        >
                                            <Ionicons name="close" size={12} color="#94a3b8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View className="bg-slate-50 p-2 rounded-xl">
                                    <Text className="text-slate-500 text-[10px] font-medium" numberOfLines={1}>
                                        {t.items?.map((i: any) => i.product_name).join(', ')}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* 1. LIVE DELIVERY TRACKER (Prioritized for Foreman) */}
            <LiveDeliveryTracker
                tickets={finalTickets}
                onReceivePress={(t: any) => setReceiveTicket(t)}
            />

            <ReceiveMaterialModal
                isVisible={!!receiveTicket}
                ticket={receiveTicket}
                onClose={() => setReceiveTicket(null)}
                onSuccess={handleReceiveSuccess}
            />

            {ticketModalVisible && (
                <DeliveryTicketModal
                    visible={ticketModalVisible}
                    onClose={() => {
                        setTicketModalVisible(false);
                        setModalTicket(null);
                    }}
                    onSuccess={() => {
                        setTicketModalVisible(false);
                        setModalTicket(null);
                        if (isWeb) {
                            SupabaseService.getDeliveryTickets(job.id).then(setWebTickets);
                        }
                    }}
                    jobId={job.id}
                    jobName={job.name}
                    initialData={modalTicket}
                    materials={isWeb ? webMaterials : materials as any}
                    isFieldReview={true}
                    role={'foreman'}
                />
            )}

            {/* 2. SITE STATUS OVERVIEW */}
            <View className="px-6 mt-8">
                <Text className="text-slate-900 font-black text-xl tracking-tight mb-4">Site Command Center</Text>

                <View className="flex-row flex-wrap gap-4">
                    {/* Progress Card */}
                    <View className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex-1 min-w-[160px]">
                        <View className="bg-emerald-50 w-10 h-10 rounded-full items-center justify-center mb-3">
                            <Ionicons name="trending-up" size={20} color="#10b981" />
                        </View>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Overall Progress</Text>
                        <View className="flex-row items-baseline gap-1">
                            <Text className="text-[24px] font-inter font-black text-slate-900">{stats.progress}%</Text>
                            <Text className="text-[10px] font-inter font-bold text-emerald-600 uppercase">Live</Text>
                        </View>
                    </View>

                    {/* Resources Card */}
                    <View className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex-1 min-w-[160px]">
                        <View className="bg-blue-50 w-10 h-10 rounded-full items-center justify-center mb-3">
                            <Ionicons name="people" size={20} color="#3b82f6" />
                        </View>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Manpower</Text>
                        <Text className="text-[24px] font-inter font-black text-slate-900">{stats.manpower} Active</Text>
                    </View>

                    {/* Pending Deliveries Card */}
                    <View className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex-1 min-w-[160px]">
                        <View className="bg-orange-50 w-10 h-10 rounded-full items-center justify-center mb-3">
                            <MaterialCommunityIcons name="truck-fast" size={20} color="#f59e0b" />
                        </View>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Deliveries</Text>
                        <Text className="text-[24px] font-inter font-black text-slate-900">
                            {finalTickets.filter(t => ['SCHEDULED', 'SHIPPED'].includes(t.status)).length}
                        </Text>
                    </View>

                    {/* Issues Card */}
                    <View className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex-1 min-w-[160px]">
                        <View className="bg-red-50 w-10 h-10 rounded-full items-center justify-center mb-3">
                            <Ionicons name="warning" size={20} color="#ef4444" />
                        </View>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Open Issues</Text>
                        <Text className="text-[24px] font-inter font-black text-slate-900">{stats.issues} Alerts</Text>
                    </View>
                </View>
            </View>

            {/* 3. RECENT ACTIVITY FEED */}
            <View className="px-6 mt-10">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-slate-900 font-black text-xl tracking-tight">Recent Activity</Text>
                </View>

                {activityItems.length === 0 ? (
                    <View className="bg-slate-50 py-10 rounded-3xl border border-dashed border-slate-200 items-center">
                        <Text className="text-slate-400 font-bold text-sm">No recent activity logged</Text>
                    </View>
                ) : (
                    <View className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        {(activityItems as any[]).map((item, idx) => (
                            <View key={idx} className={`p-4 flex-row items-center gap-4 ${idx !== (activityItems.length - 1) ? 'border-b border-slate-50' : ''}`}>
                                <View className={`${item.bg} w-10 h-10 rounded-2xl items-center justify-center`}>
                                    <Ionicons name={item.icon as any} size={18} color={item.bg === 'bg-red-50' ? '#ef4444' : '#3b82f6'} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-900 font-bold text-sm tracking-tight">{item.title}</Text>
                                    <Text className="text-slate-400 text-[10px] font-medium" numberOfLines={1}>{item.sub}</Text>
                                </View>
                                <Text className="text-slate-300 text-[9px] font-black uppercase">
                                    {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}
