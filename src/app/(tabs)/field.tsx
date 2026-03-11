import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform, TextInput, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { AlertTriangle, Clock, CheckCircle2, ChevronRight, ShieldCheck, XCircle, Package, Truck, Users, Activity, ListOrdered } from 'lucide-react-native';
import { SupabaseService, JobIssue, DeliveryTicket, ProjectMaterial } from '../../services/SupabaseService';
import { Ionicons } from '@expo/vector-icons';
import ReceiveMaterialModal from '../../components/modals/ReceiveMaterialModal';
import DeliveryTicketModal from '../../components/logistics/DeliveryTicketModal';
import { useAuth } from '../../context/AuthContext';
import { useQuery, usePowerSync } from '@powersync/react';
import { RoleGuard } from '../../features/admin';

type ActiveTab = 'action-center' | 'site-pulse' | 'logistics-radar';

export default function FieldScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ActiveTab>('action-center');
    const [issues, setIssues] = useState<JobIssue[]>([]);
    const [pendingTickets, setPendingTickets] = useState<DeliveryTicket[]>([]);
    const [activeTickets, setActiveTickets] = useState<DeliveryTicket[]>([]);
    const [allTickets, setAllTickets] = useState<DeliveryTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [issueFilter, setIssueFilter] = useState<'open' | 'resolved'>('open');
    const [refreshing, setRefreshing] = useState(false);
    const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

    const [selectedTicket, setSelectedTicket] = useState<DeliveryTicket | null>(null);
    const [receiveModalVisible, setReceiveModalVisible] = useState(false);
    const [ticketModalVisible, setTicketModalVisible] = useState(false);
    const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
    const { session, profile } = useAuth();
    const db = usePowerSync();
    const isWeb = Platform.OS === 'web';

    const handleActionComplete = () => {
        setReceiveModalVisible(false);
        setTicketModalVisible(false);
        setSelectedTicket(null);
        loadData();
    };

    const handleApproval = async (ticketId: string, action: 'APPROVE' | 'REJECT') => {
        try {
            if (action === 'APPROVE') {
                await SupabaseService.approveDeliveryTicket(ticketId, 'supervisor');
            } else {
                await SupabaseService.updateTicketStatus(ticketId, 'REJECTED_BY_FIELD', rejectNotes[ticketId]);
            }
            // Clear note and reload
            setRejectNotes(prev => {
                const updated = { ...prev };
                delete updated[ticketId];
                return updated;
            });
            loadData();
        } catch (error) {
            console.error('Error handling approval:', error);
            Alert.alert('Error', 'Failed to process approval.');
        }
    };

    // Telemetry Queries (using useQuery for Native, web fallbacks below)
    const { data: qManpower } = useQuery("SELECT id FROM crew_checkins WHERE check_out IS NULL OR check_out = ''");
    const { data: qTransit } = useQuery("SELECT id FROM delivery_tickets WHERE status IN ('IN_TRANSIT', 'SHIPPED', 'DISPATCHED')");
    // Overall Progress: avg area progress across all jobs (like Jobs page)
    const { data: qProgress } = useQuery("SELECT ROUND(AVG(progress)) as avg_progress FROM areas WHERE progress IS NOT NULL");
    // Manpower: workers assigned to active jobs
    const { data: qWorkers } = useQuery("SELECT id, assigned_job_ids FROM workers WHERE assigned_job_ids IS NOT NULL AND assigned_job_ids != '' AND assigned_job_ids != '[]'");

    // Web Fallbacks for Telemetry
    const [webManpower, setWebManpower] = useState(0);
    const [webTransit, setWebTransit] = useState(0);
    const [webProgress, setWebProgress] = useState(0);
    const [webWorkerCount, setWebWorkerCount] = useState(0);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch concurrently but handle individually to be robust
            const results = await Promise.allSettled([
                SupabaseService.getJobIssues(),
                SupabaseService.getAllDeliveryTickets(),
                isWeb ? SupabaseService.getAllProjectMaterials() : db.getAll<ProjectMaterial>('SELECT * FROM project_materials')
            ]);

            if (results[0].status === 'fulfilled') {
                setIssues(results[0].value);
            } else {
                console.error("FieldHub: Failed to load issues:", results[0].reason);
            }

            if (results[1].status === 'fulfilled') {
                const tickets = results[1].value;
                setAllTickets(tickets);
                const pending = tickets.filter(t => t.status?.toUpperCase() === 'PENDING_FIELD_REVIEW');
                const active = tickets.filter(t => ['SCHEDULED', 'SHIPPED', 'DISPATCHED', 'IN_TRANSIT'].includes(t.status?.toUpperCase()));

                console.log(`FieldHub: Loaded ${tickets.length} total tickets. Pending: ${pending.length}, Active: ${active.length}`);

                setPendingTickets(pending);
                setActiveTickets(active);
            } else {
                console.error("FieldHub: Failed to load tickets:", results[1].reason);
            }

            if (results[2].status === 'fulfilled') {
                setMaterials(results[2].value as ProjectMaterial[]);
            }

            // Web Fallbacks (Supabase direct — PowerSync local DB is empty on web)
            if (isWeb) {
                const sb = SupabaseService.supabase;

                // Transit: tickets that are dispatched/in transit/shipped
                try {
                    const { data: transitData, error } = await sb.from('delivery_tickets').select('id')
                        .in('status', ['IN_TRANSIT', 'SHIPPED', 'DISPATCHED']);
                    if (!error) setWebTransit(transitData?.length || 0);
                } catch (e) { console.warn("FieldHub: transit fetch failed:", e); }

                // Workers assigned to jobs
                try {
                    const { data: workersData, error } = await sb.from('workers').select('id, assigned_job_ids');
                    if (!error && workersData) {
                        const assignedCount = workersData.filter((w: any) => {
                            const ids = w.assigned_job_ids;
                            return ids && ids !== '' && ids !== '[]';
                        }).length;
                        setWebWorkerCount(assignedCount);
                    }
                } catch (e) { console.warn("FieldHub: workers fetch failed:", e); }

                // Active crew check-ins (wrapped in try-catch in case table is missing)
                try {
                    const { count: checkinCount, error } = await sb.from('crew_checkins')
                        .select('id', { count: 'exact', head: true })
                        .is('check_out', null);
                    if (!error) setWebManpower(checkinCount || 0);
                } catch (e) { console.warn("FieldHub: checkins fetch failed:", e); }

                // Avg area progress
                try {
                    const { data: areasData, error } = await sb.from('areas').select('progress').not('progress', 'is', null);
                    if (!error && areasData && areasData.length > 0) {
                        const avg = Math.round(areasData.reduce((s: number, a: any) => s + (a.progress || 0), 0) / areasData.length);
                        setWebProgress(avg);
                    }
                } catch (e) { console.warn("FieldHub: progress fetch failed:", e); }
            }

        } catch (error) {
            console.error("FieldHub: Critical error loading global data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const filteredIssues = issues.filter(i => i.status === issueFilter);

    const getPriorityColor = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case 'HIGH': return 'text-red-600 bg-red-50 border-red-100';
            case 'MEDIUM': return 'text-orange-600 bg-orange-50 border-orange-100';
            case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    // Derived Telemetry Data
    const checkedInCount = isWeb ? webManpower : (qManpower?.length || 0);
    const assignedWorkerCount = isWeb ? webWorkerCount : (qWorkers?.length || 0);
    const liveManpower = Math.max(checkedInCount, assignedWorkerCount);
    const liveTransit = isWeb ? webTransit : (qTransit?.length || 0);
    const progressPercent = isWeb ? webProgress : (qProgress?.[0]?.avg_progress || 0);
    const openIssues = issues.filter(i => i.status === 'open');
    const actionItemsCount = openIssues.length + pendingTickets.length;

    // Site Pulse Generator
    const sitePulseEvents = useMemo(() => {
        // Combine recent issues and tickets for a timeline
        const events = [
            ...issues.map(i => ({ type: 'issue', date: new Date(i.created_at), data: i })),
            ...activeTickets.map(t => ({ type: 'ticket', date: new Date(t.updated_at || t.created_at), data: t }))
        ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 50); // Limit to recent 50
        return events;
    }, [issues, activeTickets]);

    const renderActionCenter = () => {
        const sortedIssues = [...openIssues].sort((a, b) => {
            if (a.priority === 'High' && b.priority !== 'High') return -1;
            if (b.priority === 'High' && a.priority !== 'High') return 1;
            return 0;
        });

        if (sortedIssues.length === 0 && pendingTickets.length === 0) {
            return (
                <View className="py-20 items-center justify-center">
                    <View className="bg-emerald-50 p-6 rounded-full mb-4">
                        <ShieldCheck size={48} color="#059669" />
                    </View>
                    <Text className="text-slate-500 font-bold text-lg">No Action Items</Text>
                    <Text className="text-slate-400 text-sm mt-1 text-center px-10">
                        All clear. No pending reviews or open field issues.
                    </Text>
                </View>
            );
        }

        return (
            <View className="px-1">
                {/* 1. PENDING APPROVALS SECTION */}
                {pendingTickets.length > 0 && (
                    <View className="mb-8">
                        <View className="flex-row items-center gap-2 mb-4">
                            <View className="bg-orange-100 p-1.5 rounded-lg">
                                <AlertTriangle size={14} color="#ea580c" />
                            </View>
                            <Text className="text-slate-800 text-sm font-black uppercase tracking-widest">Requires Field Review</Text>
                        </View>
                        <View className="flex-row flex-wrap gap-4">
                            {pendingTickets.map((ticket) => (
                                <View
                                    key={ticket.id}
                                    style={Platform.OS === 'web' ? { width: '32%', minWidth: 320 } : { width: '100%' }}
                                    className="bg-white rounded-3xl mb-4 border border-orange-100 shadow-sm overflow-hidden"
                                >
                                    {/* Ticket Header */}
                                    <View className="p-4 border-b border-orange-50 flex-row justify-between items-center bg-orange-50/20">
                                        <View>
                                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{ticket.job_name || 'Project'}</Text>
                                            <Text className="text-lg font-black text-slate-900 tracking-tight">DT #{ticket.ticket_number}</Text>
                                        </View>
                                        <View className="flex-row items-center gap-2">
                                            {ticket.field_modified && (
                                                <View className="bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                                                    <Text className="text-amber-600 text-[9px] font-black uppercase tracking-tight">Modified</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Items List - Compact Data Dense */}
                                    <View className="p-4 bg-slate-50/30">
                                        {ticket.items.map((item, idx) => (
                                            <View key={idx} className="flex-row justify-between items-center mb-2">
                                                <View className="flex-1 mr-3">
                                                    <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>{item.product_name}</Text>
                                                    <Text className="text-[9px] text-slate-500 font-medium">
                                                        {item.product_code} {item.dimensions ? `| ${item.dimensions}` : ''}
                                                    </Text>
                                                </View>
                                                <View className="bg-white px-2 py-1 rounded-lg border border-slate-200 min-w-[60px] items-center">
                                                    <Text className="text-[11px] font-black text-slate-900">
                                                        {item.qty.toLocaleString()} {item.unit || 'SQF'}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Action Banner */}
                                    <View className="p-4 border-t border-slate-100">
                                        <View className="flex-row justify-end mb-3">
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSelectedTicket(ticket);
                                                    setTicketModalVisible(true);
                                                }}
                                                className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex-row items-center gap-1.5"
                                            >
                                                <Ionicons name="create-outline" size={12} color="#64748b" />
                                                <Text className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Modify Quantities</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View className="flex-row gap-2">
                                            <TouchableOpacity
                                                onPress={() => handleApproval(ticket.id, 'APPROVE')}
                                                className="flex-1 bg-emerald-600 h-10 rounded-xl items-center justify-center flex-row gap-1.5"
                                            >
                                                <ShieldCheck size={14} color="white" />
                                                <Text className="text-white font-black uppercase text-[10px] tracking-widest">Sign-Off</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (!rejectNotes[ticket.id]) {
                                                        Alert.alert("Reason Required", "Please enter a reason for rejection.");
                                                        return;
                                                    }
                                                    handleApproval(ticket.id, 'REJECT');
                                                }}
                                                className="w-10 h-10 bg-white border border-red-200 rounded-xl items-center justify-center"
                                            >
                                                <XCircle size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                        <TextInput
                                            className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[10px] text-slate-600 h-8"
                                            placeholder="Rejection note..."
                                            value={rejectNotes[ticket.id] || ''}
                                            onChangeText={(v) => setRejectNotes(prev => ({ ...prev, [ticket.id]: v }))}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* 2. OPEN ISSUES SECTION */}
                {sortedIssues.length > 0 && (
                    <View className="mb-10">
                        <View className="flex-row items-center gap-2 mb-4">
                            <View className="bg-red-100 p-1.5 rounded-lg">
                                <AlertTriangle size={14} color="#dc2626" />
                            </View>
                            <Text className="text-slate-800 text-sm font-black uppercase tracking-widest">Open Field Issues</Text>
                        </View>

                        <View className="flex-row flex-wrap gap-4">
                            {sortedIssues.map((issue) => {
                                const match = issue.type === 'Shortage' ? issue.description?.match(/DT #([a-fA-F0-9\-]{36})/) : null;
                                const linkedTicketId = match ? match[1] : null;

                                return (
                                    <TouchableOpacity
                                        key={issue.id}
                                        onPress={() => {
                                            if (linkedTicketId) {
                                                const ticket = allTickets.find(t => t.id === linkedTicketId);
                                                if (ticket) {
                                                    setSelectedTicket(ticket);
                                                    setTicketModalVisible(true);
                                                    return;
                                                }
                                            }
                                            router.push(`/job-issues/${issue.id}` as any);
                                        }}
                                        activeOpacity={0.7}
                                        style={Platform.OS === 'web' ? { width: '48%', minWidth: 280 } : { width: '100%' }}
                                        className="bg-white p-4 rounded-3xl mb-4 border border-slate-200 shadow-sm"
                                    >
                                        <View className="flex-row justify-between items-start mb-2">
                                            <View className="flex-1 mr-3">
                                                <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1">
                                                    {issue.job_name}
                                                    {issue.area_name && ` • ${issue.area_name}`}
                                                </Text>
                                                <Text className="text-base font-black text-slate-900 leading-tight">{issue.type}</Text>
                                            </View>
                                            <View className={`px-2 py-0.5 rounded border ${getPriorityColor(issue.priority)}`}>
                                                <Text className="text-[9px] font-black uppercase tracking-tighter">{issue.priority}</Text>
                                            </View>
                                        </View>

                                        <Text className="text-slate-500 text-xs mb-3 line-clamp-2" numberOfLines={2}>
                                            {issue.description}
                                        </Text>

                                        <View className="flex-row items-center justify-between pt-3 border-t border-slate-50">
                                            <View className="flex-row items-center gap-3">
                                                <View className="flex-row items-center gap-1">
                                                    <Clock size={10} color="#94a3b8" />
                                                    <Text className="text-slate-400 text-[9px]">{new Date(issue.created_at).toLocaleDateString()}</Text>
                                                </View>
                                                <Text className="text-slate-400 text-[9px] font-bold uppercase">BY: {issue.created_by}</Text>
                                            </View>
                                            <ChevronRight size={14} color="#cbd5e1" />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderSitePulse = () => {
        if (sitePulseEvents.length === 0) {
            return (
                <View className="py-20 items-center justify-center">
                    <View className="bg-slate-100 p-6 rounded-full mb-4">
                        <Activity size={48} color="#94a3b8" />
                    </View>
                    <Text className="text-slate-500 font-bold text-lg">No Activity</Text>
                    <Text className="text-slate-400 text-sm mt-1 text-center px-10">
                        The site pulse is quiet. Events will appear here as they happen.
                    </Text>
                </View>
            );
        }

        return (
            <View className="px-1 max-w-2xl mx-auto w-full">
                {sitePulseEvents.map((event, idx) => (
                    <View key={`${event.type}-${event.data.id}-${idx}`} className="flex-row mb-6">
                        {/* Timeline Node */}
                        <View className="items-center mr-4">
                            <View className={`w-8 h-8 rounded-full items-center justify-center z-10 ${event.type === 'issue' ? 'bg-red-100' : 'bg-blue-100'}`}>
                                {event.type === 'issue' ? <AlertTriangle size={14} color="#dc2626" /> : <Truck size={14} color="#2563eb" />}
                            </View>
                            {idx !== sitePulseEvents.length - 1 && (
                                <View className="w-0.5 bg-slate-200 flex-1 -mt-2 -mb-8 z-0" />
                            )}
                        </View>
                        {/* Event Content */}
                        <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mt-1">
                            <View className="flex-row justify-between items-start mb-1">
                                <Text className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{event.data.job_name || 'Project'}</Text>
                                <Text className="text-[9px] text-slate-400 font-bold">{event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                            {event.type === 'issue' ? (
                                <View>
                                    <Text className="text-sm font-black text-slate-900 leading-tight mb-1">Issue Reported: {(event.data as JobIssue).type}</Text>
                                    <Text className="text-xs text-slate-600 line-clamp-2">{(event.data as JobIssue).description}</Text>
                                </View>
                            ) : (
                                <View>
                                    <Text className="text-sm font-black text-slate-900 leading-tight mb-1">Shipment {(event.data as DeliveryTicket).status}</Text>
                                    <Text className="text-xs text-slate-600">DT #{(event.data as DeliveryTicket).ticket_number} • {(event.data as DeliveryTicket).items.length} items</Text>
                                </View>
                            )}
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    const renderLogisticsRadar = () => {
        if (activeTickets.length === 0) {
            return (
                <View className="py-20 items-center justify-center">
                    <View className="bg-blue-50 p-6 rounded-full mb-4">
                        <Truck size={48} color="#3b82f6" />
                    </View>
                    <Text className="text-slate-500 font-bold text-lg">No Active Shipments</Text>
                    <Text className="text-slate-400 text-sm mt-1 text-center px-10">
                        There are no deliveries currently en route.
                    </Text>
                </View>
            );
        }

        return (
            <View className="px-1">
                <View className="flex-row items-center gap-2 mb-4">
                    <View className="bg-blue-100 p-1.5 rounded-lg">
                        <Truck size={14} color="#2563eb" />
                    </View>
                    <Text className="text-slate-800 text-sm font-black uppercase tracking-widest">Active Deliveries</Text>
                </View>
                <View className="flex-row flex-wrap gap-4">
                    {activeTickets.map((ticket) => (
                        <View
                            key={ticket.id}
                            style={Platform.OS === 'web' ? { width: '32%', minWidth: 320 } : { width: '100%' }}
                            className="bg-white rounded-3xl mb-4 border border-blue-100 shadow-sm overflow-hidden"
                        >
                            {/* Ticket Header */}
                            <View className="p-4 border-b border-blue-50 flex-row justify-between items-center bg-blue-50/20">
                                <View>
                                    <Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">{ticket.job_name || 'Project'}</Text>
                                    <Text className="text-lg font-black text-slate-900 tracking-tight">DT #{ticket.ticket_number}</Text>
                                </View>
                                <View className="bg-blue-100 px-3 py-1 rounded-full border border-blue-200">
                                    <Text className="text-blue-600 text-[9px] font-black uppercase tracking-wider">
                                        {ticket.status === 'SHIPPED' ? 'In Transit' : ticket.status}
                                    </Text>
                                </View>
                            </View>

                            {/* Items List - Compact Data Dense */}
                            <View className="p-4 bg-slate-50/30">
                                {ticket.items.map((item, idx) => (
                                    <View key={idx} className="flex-row justify-between items-center mb-2">
                                        <View className="flex-1 mr-3">
                                            <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>{item.product_name}</Text>
                                            <Text className="text-[9px] text-slate-500 font-medium">
                                                {item.product_code} {item.dimensions ? `| ${item.dimensions}` : ''}
                                            </Text>
                                        </View>
                                        <View className="bg-white px-2 py-1 rounded-lg border border-slate-200 min-w-[60px] items-center">
                                            <Text className="text-[11px] font-black text-slate-900">
                                                {item.qty.toLocaleString()} {item.unit || 'SQF'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <View className="p-4 border-t border-slate-100">
                                <TouchableOpacity
                                    onPress={() => {
                                        setSelectedTicket(ticket);
                                        setReceiveModalVisible(true);
                                    }}
                                    className="bg-slate-900 h-10 rounded-xl items-center justify-center shadow-md shadow-slate-200"
                                >
                                    <View className="flex-row items-center gap-1.5">
                                        <Package size={14} color="white" />
                                        <Text className="text-white font-black uppercase text-[10px] tracking-widest">Receive Material</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <RoleGuard allowed={['admin', 'pm', 'supervisor']}>
            <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* TELEMETRY WIDGETS (TOP ROW) */}
            <View className="px-6 py-4 bg-slate-900 flex-row justify-between items-center overflow-x-auto no-scrollbar gap-2 z-10 border-b-4 border-slate-800">
                <View className="flex-1 min-w-[120px] bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
                    <Text className="text-slate-400 font-inter text-[10px] font-medium tracking-widest uppercase mb-1">Overall Progress</Text>
                    <Text className="text-white font-inter text-2xl font-black">{progressPercent}%</Text>
                </View>
                <View className="flex-1 min-w-[120px] bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
                    <Text className="text-slate-400 font-inter text-[10px] font-medium tracking-widest uppercase mb-1">Field Manpower</Text>
                    <Text className="text-white font-inter text-2xl font-black">{liveManpower}</Text>
                </View>
                <View className="flex-1 min-w-[120px] bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
                    <Text className="text-slate-400 font-inter text-[10px] font-medium tracking-widest uppercase mb-1">Logistics Radar</Text>
                    <View className="flex-row items-baseline gap-1">
                        <Text className="text-white font-inter text-2xl font-black">{liveTransit}</Text>
                        <Text className="text-slate-500 font-bold text-[10px] uppercase">En Route</Text>
                    </View>
                </View>
                <View className={`flex-1 min-w-[120px] rounded-2xl p-4 border ${actionItemsCount > 0 ? 'bg-orange-500/20 border-orange-500/50' : 'bg-slate-800/80 border-slate-700/50'}`}>
                    <Text className={`${actionItemsCount > 0 ? 'text-orange-400' : 'text-slate-400'} font-inter text-[10px] font-medium tracking-widest uppercase mb-1`}>Action Items</Text>
                    <Text className={`${actionItemsCount > 0 ? 'text-orange-400' : 'text-white'} font-inter text-2xl font-black`}>{actionItemsCount}</Text>
                </View>
            </View>

            {/* HEADER with Navigation Tabs */}
            <View className="px-6 py-4 bg-white border-b border-slate-200 z-0">
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-3xl font-black text-slate-900 tracking-tight">
                            Control Tower
                        </Text>
                    </View>
                    <View className="flex-row bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <TouchableOpacity
                            onPress={() => setActiveTab('action-center')}
                            className={`px-4 py-2 rounded-xl flex-row items-center gap-2 transition-colors ${activeTab === 'action-center' ? 'bg-white shadow-sm border border-slate-200' : ''}`}
                        >
                            <AlertTriangle size={14} color={activeTab === 'action-center' ? '#ea580c' : '#94a3b8'} />
                            <Text className={`text-[10px] font-black uppercase tracking-wider ${activeTab === 'action-center' ? 'text-slate-900' : 'text-slate-500'}`}>Action Center</Text>
                            {actionItemsCount > 0 && (
                                <View className="bg-orange-500 w-4 h-4 rounded-full items-center justify-center ml-1">
                                    <Text className="text-[8px] text-white font-black">{actionItemsCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setActiveTab('site-pulse')}
                            className={`px-4 py-2 rounded-xl flex-row items-center gap-2 transition-colors ${activeTab === 'site-pulse' ? 'bg-white shadow-sm border border-slate-200' : ''}`}
                        >
                            <Activity size={14} color={activeTab === 'site-pulse' ? '#3b82f6' : '#94a3b8'} />
                            <Text className={`text-[10px] font-black uppercase tracking-wider ${activeTab === 'site-pulse' ? 'text-slate-900' : 'text-slate-500'}`}>Site Pulse</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setActiveTab('logistics-radar')}
                            className={`px-4 py-2 rounded-xl flex-row items-center gap-2 transition-colors ${activeTab === 'logistics-radar' ? 'bg-white shadow-sm border border-slate-200' : ''}`}
                        >
                            <Truck size={14} color={activeTab === 'logistics-radar' ? '#8b5cf6' : '#94a3b8'} />
                            <Text className={`text-[10px] font-black uppercase tracking-wider ${activeTab === 'logistics-radar' ? 'text-slate-900' : 'text-slate-500'}`}>Logistics Radar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* CONTENT */}
            <ScrollView
                className="flex-1 px-4 pt-6"
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            >
                {activeTab === 'action-center' && renderActionCenter()}
                {activeTab === 'site-pulse' && renderSitePulse()}
                {activeTab === 'logistics-radar' && renderLogisticsRadar()}
            </ScrollView>

            <ReceiveMaterialModal
                isVisible={receiveModalVisible}
                onClose={() => setReceiveModalVisible(false)}
                ticket={selectedTicket}
                onSuccess={handleActionComplete}
            />

            {
                ticketModalVisible && selectedTicket && (
                    <DeliveryTicketModal
                        visible={ticketModalVisible}
                        onClose={() => setTicketModalVisible(false)}
                        materials={materials}
                        jobId={selectedTicket.job_id}
                        jobName={selectedTicket.job_name || 'Project'}
                        onSuccess={handleActionComplete}
                        initialData={selectedTicket}
                        isFieldReview={true}
                        role={'supervisor'}
                    />
                )
            }
            </SafeAreaView>
        </RoleGuard>
    );
}
