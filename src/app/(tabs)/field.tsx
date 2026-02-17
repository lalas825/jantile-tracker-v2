import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { AlertTriangle, Clock, CheckCircle2, ChevronRight, Filter, Search, ShieldCheck, XCircle, Package, Truck } from 'lucide-react-native';
import { SupabaseService, JobIssue, DeliveryTicket, ProjectMaterial } from '../../services/SupabaseService';
import { Ionicons } from '@expo/vector-icons';
import ReceiveMaterialModal from '../../components/modals/ReceiveMaterialModal';
import DeliveryTicketModal from '../../components/logistics/DeliveryTicketModal';
import { useAuth } from '../../context/AuthContext';
import { usePowerSync } from '@powersync/react';

type ActiveTab = 'issues' | 'approvals';

export default function FieldScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ActiveTab>('issues');
    const [issues, setIssues] = useState<JobIssue[]>([]);
    const [pendingTickets, setPendingTickets] = useState<DeliveryTicket[]>([]);
    const [activeTickets, setActiveTickets] = useState<DeliveryTicket[]>([]);
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
                const pending = tickets.filter(t => t.status?.toUpperCase() === 'PENDING_FIELD_REVIEW');
                const active = tickets.filter(t => ['SCHEDULED', 'SHIPPED'].includes(t.status?.toUpperCase()));

                console.log(`FieldHub: Loaded ${tickets.length} total tickets. Pending: ${pending.length}, Active: ${active.length}`);

                setPendingTickets(pending);
                setActiveTickets(active);
            } else {
                console.error("FieldHub: Failed to load tickets:", results[1].reason);
            }

            if (results[2].status === 'fulfilled') {
                setMaterials(results[2].value as ProjectMaterial[]);
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

    const handleActionComplete = () => {
        loadData();
    };

    const handleApproval = async (ticketId: string, action: 'APPROVE' | 'REJECT') => {
        try {
            if (action === 'APPROVE') {
                // FIELD TAB = Supervisor context. Always approve as supervisor here.
                // The JobSite tab handles foreman approvals.
                await SupabaseService.approveDeliveryTicket(ticketId, 'supervisor');
            } else {
                await SupabaseService.updateTicketStatus(ticketId, 'REJECTED', rejectNotes[ticketId]);
            }
            loadData();
        } catch (error: any) {
            console.error("Approval error:", error);
            Alert.alert("Error", "Failed to update ticket status");
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-600 bg-red-50 border-red-100';
            case 'Medium': return 'text-orange-600 bg-orange-50 border-orange-100';
            case 'Low': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    const renderApprovals = () => {
        if (pendingTickets.length === 0 && activeTickets.length === 0) {
            return (
                <View className="py-20 items-center justify-center">
                    <View className="bg-emerald-50 p-6 rounded-full mb-4">
                        <ShieldCheck size={48} color="#059669" />
                    </View>
                    <Text className="text-slate-500 font-bold text-lg">No Active Logistics</Text>
                    <Text className="text-slate-400 text-sm mt-1 text-center px-10">
                        All delivery requests and shipments are current. You're all caught up!
                    </Text>
                </View>
            );
        }

        return (
            <View>
                {/* 1. PENDING APPROVALS SECTION */}
                {pendingTickets.length > 0 && (
                    <View className="mb-10">
                        <Text className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4">Awaiting Field Review</Text>
                        <View className="flex-row flex-wrap gap-4">
                            {pendingTickets.map((ticket) => (
                                <View
                                    key={ticket.id}
                                    style={Platform.OS === 'web' ? { width: '32%', minWidth: 320 } : { width: '100%' }}
                                    className="bg-white rounded-3xl mb-4 border border-slate-200 shadow-sm overflow-hidden"
                                >
                                    {/* Ticket Header */}
                                    <View className="p-5 border-b border-slate-50 flex-row justify-between items-center bg-slate-50/30">
                                        <View>
                                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{ticket.job_name || 'Project'}</Text>
                                            <Text className="text-lg font-black text-slate-900 tracking-tight">DT #{ticket.ticket_number}</Text>
                                        </View>
                                        <View className="flex-row items-center gap-2">
                                            {ticket.field_modified && (
                                                <View className="bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
                                                    <Text className="text-amber-600 text-[9px] font-black uppercase tracking-tight">Modified</Text>
                                                </View>
                                            )}
                                            <View className="bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                                                <Text className="text-orange-600 text-[9px] font-black uppercase">Field Review</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Approval Badges */}
                                    <View className="px-5 py-2 flex-row gap-2 border-b border-slate-50 bg-slate-50/20">
                                        <View className={`flex-row items-center px-2 py-0.5 rounded-full border ${ticket.foreman_approved ? 'bg-green-50 border-green-100' : 'bg-slate-100 border-slate-200'}`}>
                                            <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${ticket.foreman_approved ? 'bg-green-500' : 'bg-slate-300'}`} />
                                            <Text className={`text-[8px] font-black ${ticket.foreman_approved ? 'text-green-700' : 'text-slate-500'}`}>FOREMAN</Text>
                                        </View>
                                        <View className={`flex-row items-center px-2 py-0.5 rounded-full border ${ticket.supervisor_approved ? 'bg-green-50 border-green-100' : 'bg-slate-100 border-slate-200'}`}>
                                            <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${ticket.supervisor_approved ? 'bg-green-500' : 'bg-slate-300'}`} />
                                            <Text className={`text-[8px] font-black ${ticket.supervisor_approved ? 'text-green-700' : 'text-slate-500'}`}>SUPERVISOR</Text>
                                        </View>
                                    </View>

                                    {/* Items List */}
                                    <View className="p-5">
                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Items Breakdown</Text>
                                        {ticket.items.map((item, idx) => (
                                            <View key={idx} className="flex-row justify-between items-center mb-3">
                                                <View className="flex-1 mr-4">
                                                    <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>{item.product_name}</Text>
                                                    <Text className="text-[10px] text-slate-400 font-medium">
                                                        {item.product_code} {item.dimensions ? `| ${item.dimensions}` : ''}
                                                    </Text>
                                                </View>
                                                <View className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 min-w-[70px] items-center">
                                                    <Text className="text-xs font-black text-slate-900">
                                                        {item.qty.toLocaleString()} {item.unit || 'SQFT'}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}

                                        {/* Modals trigger for Field Review */}
                                        <View className="flex-row justify-end mb-4 pr-1">
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSelectedTicket(ticket);
                                                    setTicketModalVisible(true);
                                                }}
                                                className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex-row items-center gap-2"
                                            >
                                                <Ionicons name="create-outline" size={14} color="#64748b" />
                                                <Text className="text-[10px] font-black text-slate-500 uppercase">Edit Qty / Items</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View className="mt-4 pt-4 border-t border-slate-50">
                                            {/* Action Buttons */}
                                            <View className="flex-row gap-3">
                                                <TouchableOpacity
                                                    onPress={() => handleApproval(ticket.id, 'APPROVE')}
                                                    className="flex-1 bg-emerald-600 h-12 rounded-2xl items-center justify-center shadow-lg shadow-emerald-100 flex-row gap-2"
                                                >
                                                    <ShieldCheck size={16} color="white" />
                                                    <Text className="text-white font-black uppercase text-xs tracking-widest">
                                                        {ticket.supervisor_approved ? 'Supervisor ✓ Approved' : 'Supervisor Approve'}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        if (!rejectNotes[ticket.id]) {
                                                            Alert.alert("Reason Required", "Please enter a reason for rejection.");
                                                            return;
                                                        }
                                                        handleApproval(ticket.id, 'REJECT');
                                                    }}
                                                    className="w-12 h-12 bg-white border border-slate-200 rounded-2xl items-center justify-center"
                                                >
                                                    <XCircle size={20} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>

                                            <TextInput
                                                className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 h-10"
                                                placeholder="Add rejection note here..."
                                                value={rejectNotes[ticket.id] || ''}
                                                onChangeText={(v) => setRejectNotes(prev => ({ ...prev, [ticket.id]: v }))}
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )
                }

                {/* 2. ACTIVE DELIVERIES SECTION (NEW) */}
                {
                    activeTickets.length > 0 && (
                        <View>
                            <Text className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4">Active Shipments & Deliveries</Text>
                            <View className="flex-row flex-wrap gap-4">
                                {activeTickets.map((ticket) => (
                                    <View
                                        key={ticket.id}
                                        style={Platform.OS === 'web' ? { width: '32%', minWidth: 320 } : { width: '100%' }}
                                        className="bg-white rounded-3xl mb-4 border border-slate-200 shadow-sm overflow-hidden"
                                    >
                                        {/* Ticket Header */}
                                        <View className="p-5 border-b border-slate-50 flex-row justify-between items-center bg-blue-50/30">
                                            <View>
                                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{ticket.job_name || 'Project'}</Text>
                                                <Text className="text-lg font-black text-slate-900 tracking-tight">DT #{ticket.ticket_number}</Text>
                                            </View>
                                            <View className="bg-blue-100 px-3 py-1 rounded-full border border-blue-200">
                                                <Text className="text-blue-600 text-[9px] font-black uppercase">
                                                    {ticket.status === 'SHIPPED' ? 'In Transit' : 'Scheduled'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Items List */}
                                        <View className="p-5">
                                            {ticket.items.map((item, idx) => (
                                                <View key={idx} className="flex-row justify-between items-center mb-3">
                                                    <View className="flex-1 mr-4">
                                                        <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>{item.product_name}</Text>
                                                    </View>
                                                    <Text className="text-xs font-black text-slate-900">
                                                        {item.qty.toLocaleString()} {item.unit || 'SQFT'}
                                                    </Text>
                                                </View>
                                            ))}

                                            <View className="mt-4 pt-4 border-t border-slate-50">
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setSelectedTicket(ticket);
                                                        setReceiveModalVisible(true);
                                                    }}
                                                    className="bg-slate-900 h-12 rounded-2xl items-center justify-center shadow-lg shadow-slate-200"
                                                >
                                                    <View className="flex-row items-center gap-2">
                                                        <Package size={16} color="white" />
                                                        <Text className="text-white font-black uppercase text-xs tracking-widest">Receive Material</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )
                }
            </View >
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* HEADER */}
            <View className="px-6 py-6 bg-white border-b border-slate-200">
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Central Hub</Text>
                        <Text className="text-3xl font-black text-slate-900 tracking-tight">
                            {activeTab === 'issues' ? 'Field Issues' : 'Global Approvals'}
                        </Text>
                    </View>
                    <View className="flex-row bg-slate-100 p-1 rounded-2xl">
                        <TouchableOpacity
                            onPress={() => setActiveTab('issues')}
                            className={`px-4 py-2 rounded-xl ${activeTab === 'issues' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`text-[10px] font-black uppercase ${activeTab === 'issues' ? 'text-slate-900' : 'text-slate-400'}`}>Issues</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('approvals')}
                            className={`px-4 py-2 rounded-xl ${activeTab === 'approvals' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <View className="flex-row items-center gap-2">
                                <Text className={`text-[10px] font-black uppercase ${activeTab === 'approvals' ? 'text-slate-900' : 'text-slate-400'}`}>Approvals</Text>
                                {pendingTickets.length > 0 && (
                                    <View className="bg-orange-500 w-4 h-4 rounded-full items-center justify-center">
                                        <Text className="text-[8px] text-white font-black">{pendingTickets.length}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {activeTab === 'issues' && (
                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            onPress={() => setIssueFilter('open')}
                            className={`px-4 py-2 rounded-lg border flex-row items-center gap-2 ${issueFilter === 'open' ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
                        >
                            <AlertTriangle size={16} color={issueFilter === 'open' ? 'white' : '#64748b'} />
                            <Text className={`font-bold text-sm ${issueFilter === 'open' ? 'text-white' : 'text-slate-600'}`}>
                                Open ({issues.filter(i => i.status === 'open').length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setIssueFilter('resolved')}
                            className={`px-4 py-2 rounded-lg border flex-row items-center gap-2 ${issueFilter === 'resolved' ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
                        >
                            <CheckCircle2 size={16} color={issueFilter === 'resolved' ? 'white' : '#64748b'} />
                            <Text className={`font-bold text-sm ${issueFilter === 'resolved' ? 'text-white' : 'text-slate-600'}`}>
                                Resolved ({issues.filter(i => i.status === 'resolved').length})
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* CONTENT */}
            <ScrollView
                className="flex-1 px-4 pt-4"
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            >
                {activeTab === 'issues' ? (
                    filteredIssues.length === 0 ? (
                        <View className="py-20 items-center justify-center">
                            <View className="bg-slate-100 p-6 rounded-full mb-4">
                                <CheckCircle2 size={48} color="#94a3b8" />
                            </View>
                            <Text className="text-slate-500 font-bold text-lg">No {issueFilter} issues found</Text>
                            <Text className="text-slate-400 text-sm mt-1 text-center px-10">
                                {issueFilter === 'open' ? "Great! All job sites are currently running smoothly." : "Resolved issues will appear here for your records."}
                            </Text>
                        </View>
                    ) : (
                        <View className="flex-row flex-wrap gap-4">
                            {filteredIssues.map((issue) => (
                                <TouchableOpacity
                                    key={issue.id}
                                    onPress={() => router.push(`/job-issues/${issue.id}` as any)}
                                    activeOpacity={0.7}
                                    style={Platform.OS === 'web' ? { width: '24%', minWidth: 280 } : { width: '100%' }}
                                    className="bg-white p-5 rounded-2xl mb-4 border border-slate-200 shadow-sm"
                                >
                                    <View className="flex-row justify-between items-start mb-3">
                                        <View className="flex-1 mr-4">
                                            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                                                {issue.job_name}
                                                {issue.floor_name && ` • ${issue.floor_name}`}
                                                {issue.unit_name && ` • ${issue.unit_name}`}
                                                {issue.area_name && ` • ${issue.area_name}`}
                                            </Text>
                                            <Text className="text-lg font-bold text-slate-900 leading-tight">{issue.type}</Text>
                                        </View>
                                        <View className={`px-2 py-1 rounded border ${getPriorityColor(issue.priority)}`}>
                                            <Text className="text-[10px] font-black uppercase tracking-tighter">{issue.priority}</Text>
                                        </View>
                                    </View>

                                    <Text className="text-slate-600 text-sm mb-4 line-clamp-2" numberOfLines={2}>
                                        {issue.description}
                                    </Text>

                                    <View className="flex-row items-center justify-between pt-4 border-t border-slate-50">
                                        <View className="flex-1">
                                            <View className="flex-row items-center gap-4 mb-2">
                                                <View className="flex-row items-center gap-1.5">
                                                    <Clock size={12} color="#94a3b8" />
                                                    <Text className="text-slate-400 text-[10px]">{new Date(issue.created_at).toLocaleDateString()}</Text>
                                                </View>
                                                <Text className="text-slate-400 text-[10px] font-bold uppercase">BY: {issue.created_by}</Text>
                                            </View>

                                            {issue.status === 'open' && (
                                                <TouchableOpacity
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        SupabaseService.updateIssueStatus(issue.id, 'resolved').then(() => loadData());
                                                    }}
                                                    className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 self-start mt-1 flex-row items-center gap-1.5"
                                                >
                                                    <CheckCircle2 size={12} color="#059669" />
                                                    <Text className="text-emerald-700 text-[10px] font-black uppercase">Mark Resolved</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        <ChevronRight size={18} color="#cbd5e1" />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )
                ) : (
                    renderApprovals()
                )}
            </ScrollView>

            <ReceiveMaterialModal
                isVisible={receiveModalVisible}
                onClose={() => setReceiveModalVisible(false)}
                ticket={selectedTicket}
                onSuccess={handleActionComplete}
            />

            {ticketModalVisible && selectedTicket && (
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
            )}
        </SafeAreaView>
    );
}
