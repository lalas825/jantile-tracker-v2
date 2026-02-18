import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Box, Truck, CheckCircle2, Circle, Clock, ChevronDown, ChevronRight, AlertCircle, Calendar, User, Edit3, Settings } from 'lucide-react-native';
import { SupabaseService, DeliveryTicket, formatDisplayDate } from '../../services/SupabaseService';
import FleetManagementModal from './FleetManagementModal';

// ── Fallback data if DB table is empty ─────────────────────────────────
const DEFAULT_DRIVERS = [
    { id: 'driver-1', name: 'Carlos M.' },
    { id: 'driver-2', name: 'Miguel R.' },
    { id: 'driver-3', name: 'David L.' },
    { id: 'driver-4', name: 'Jose P.' },
    { id: 'driver-5', name: 'Alex T.' },
];

const DEFAULT_TRUCKS = [
    { id: 'truck-1', name: 'Truck #101 – Ford F-450' },
    { id: 'truck-2', name: 'Truck #102 – Isuzu NPR' },
    { id: 'truck-3', name: 'Truck #103 – Ram 5500' },
    { id: 'truck-4', name: 'Truck #104 – Hino 268' },
    { id: 'truck-5', name: 'Flatbed #201' },
];

export default function OutboundList() {
    const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
    const [checkedItems, setCheckedItems] = useState<Record<string, Record<string, boolean>>>({});

    // ── New enhanced state ──────────────────────────────────────────────
    const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
    const [selectedTrucks, setSelectedTrucks] = useState<Record<string, string>>({});
    const [editableNotes, setEditableNotes] = useState<Record<string, string>>({});
    const [editableDates, setEditableDates] = useState<Record<string, string>>({});
    const [editableTimes, setEditableTimes] = useState<Record<string, string>>({});
    const [showFleetModal, setShowFleetModal] = useState(false);

    // ── Dynamic fleet data from Supabase ─────────────────────────────────
    const [DRIVERS, setDRIVERS] = useState(DEFAULT_DRIVERS);
    const [TRUCKS, setTRUCKS] = useState(DEFAULT_TRUCKS);

    const loadFleet = useCallback(async () => {
        try {
            const [drivers, trucks] = await Promise.all([
                SupabaseService.getFleetResources('driver'),
                SupabaseService.getFleetResources('truck'),
            ]);
            if (drivers.length > 0) setDRIVERS(drivers);
            if (trucks.length > 0) setTRUCKS(trucks);
        } catch (err) {
            console.error('Fleet load error:', err);
        }
    }, []);


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

            // Initialize editable notes/dates/times from ticket data
            const notesInit: Record<string, string> = {};
            const datesInit: Record<string, string> = {};
            const timesInit: Record<string, string> = {};
            allTickets.forEach(t => {
                notesInit[t.id] = t.notes || t.destination || '';
                datesInit[t.id] = t.requested_date || '';
                timesInit[t.id] = t.scheduled_time || t.due_time || '07:00';
            });
            setEditableNotes(notesInit);
            setEditableDates(datesInit);
            setEditableTimes(timesInit);
        } catch (error) {
            console.error("Outbound Error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        loadFleet();
    }, [loadData, loadFleet]);

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
        return ticket.items.every((item: any) => !item.material_id || checks[item.material_id]);
    };

    const [truckIds, setTruckIds] = useState<Record<string, string>>({});

    // ── Save date/time/notes back to Supabase ───────────────────────────
    const handleSaveField = async (ticket: DeliveryTicket, field: 'notes' | 'date' | 'time') => {
        try {
            const payload: any = {
                id: ticket.id,
                ticket_number: ticket.ticket_number,
                job_id: ticket.job_id,
                job_name: ticket.job_name,
                status: ticket.status,
                items: ticket.items,
            };
            if (field === 'notes') payload.notes = editableNotes[ticket.id] || '';
            if (field === 'date') payload.requested_date = editableDates[ticket.id] || ticket.requested_date;
            if (field === 'time') {
                payload.scheduled_time = editableTimes[ticket.id] || ticket.scheduled_time;
                payload.due_time = editableTimes[ticket.id] || ticket.due_time;
            }
            await SupabaseService.saveDeliveryTicket(payload);
        } catch (err) {
            console.error('Save field error:', err);
        }
    };

    const handleDispatch = async (ticket: DeliveryTicket) => {
        console.log("Dispatch pressed for:", ticket.ticket_number);
        if (!isTicketFullyChecked(ticket)) {
            const checks = checkedItems[ticket.id] || {};
            const missing = ticket.items
                .filter((item: any) => item.material_id && !checks[item.material_id])
                .map((item: any) => item.product_name || 'Unknown Item')
                .join('\n');

            const msg = `Please verify the following items:\n\n${missing}`;
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert("Incomplete", msg);
            }
            return;
        }

        // Build truck label from selections
        const driverName = selectedDrivers[ticket.id] || '';
        const truckName = selectedTrucks[ticket.id] || '';
        const combinedTruckId = truckIds[ticket.id] || [driverName, truckName].filter(Boolean).join(' – ') || '';

        if (!combinedTruckId) {
            const msg = "Please select a driver and/or truck before dispatching.";
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert("Missing Info", msg);
            }
            return;
        }

        try {
            await SupabaseService.updateTicketStatus(ticket.id, 'IN_TRANSIT', undefined, combinedTruckId);
            loadData();
            setTruckIds(prev => {
                const updated = { ...prev };
                delete updated[ticket.id];
                return updated;
            });
        } catch (err: any) {
            console.error("Dispatch Error:", err);
            const msg = `Failed to dispatch ticket: ${err.message || JSON.stringify(err)}`;
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert("Error", msg);
            }
        }
    };

    // Grouping
    const unscheduled = useMemo(() =>
        tickets.filter(t => (t.status || '').toUpperCase() === 'PENDING_APPROVAL'),
        [tickets]);

    const scheduledByJob = useMemo(() => {
        const scheduled = tickets.filter(t => (t.status || '').toUpperCase() === 'SCHEDULED');
        const groups: Record<string, DeliveryTicket[]> = {};
        scheduled.forEach(t => {
            const name = t.job_name || 'Unassigned Project';
            if (!groups[name]) groups[name] = [];
            groups[name].push(t);
        });
        return groups;
    }, [tickets]);

    const inTransit = useMemo(() =>
        tickets.filter(t => ['IN_TRANSIT', 'DISPATCHED'].includes((t.status || '').toUpperCase())),
        [tickets]);

    if (loading && tickets.length === 0) {
        return <ActivityIndicator size="large" color="#2563eb" className="mt-20" />;
    }

    return (
        <>
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
                            <TouchableOpacity
                                onPress={() => setShowFleetModal(true)}
                                className="ml-auto flex-row items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
                            >
                                <Settings size={13} color="#64748b" />
                                <Text className="text-[10px] font-black text-slate-500 uppercase">Manage Fleet</Text>
                            </TouchableOpacity>
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

                                                        {/* ── Editable Date & Time ─────────────── */}
                                                        <View className="flex-row items-center gap-3 mt-2">
                                                            <View className="flex-row items-center gap-1.5">
                                                                <Calendar size={13} color="#3b82f6" strokeWidth={2.5} />
                                                                {Platform.OS === 'web' ? (
                                                                    <input
                                                                        type="date"
                                                                        value={editableDates[t.id] || t.requested_date || ''}
                                                                        onChange={(e) => {
                                                                            setEditableDates(prev => ({ ...prev, [t.id]: e.target.value }));
                                                                        }}
                                                                        onBlur={() => handleSaveField(t, 'date')}
                                                                        style={{
                                                                            border: '1px solid #e2e8f0',
                                                                            borderRadius: 6,
                                                                            padding: '4px 8px',
                                                                            fontSize: 11,
                                                                            fontWeight: 900,
                                                                            color: '#2563eb',
                                                                            background: '#eff6ff',
                                                                            cursor: 'pointer',
                                                                            textTransform: 'uppercase',
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <Text className="text-blue-600 font-black text-[11px] uppercase tracking-wider">
                                                                        {formatDisplayDate(t.requested_date)}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                            <Text className="text-slate-300">•</Text>
                                                            <View className="flex-row items-center gap-1.5">
                                                                <Clock size={13} color="#3b82f6" strokeWidth={2.5} />
                                                                {Platform.OS === 'web' ? (
                                                                    <input
                                                                        type="time"
                                                                        value={editableTimes[t.id] || t.scheduled_time || '07:00'}
                                                                        onChange={(e) => {
                                                                            setEditableTimes(prev => ({ ...prev, [t.id]: e.target.value }));
                                                                        }}
                                                                        onBlur={() => handleSaveField(t, 'time')}
                                                                        style={{
                                                                            border: '1px solid #e2e8f0',
                                                                            borderRadius: 6,
                                                                            padding: '4px 8px',
                                                                            fontSize: 11,
                                                                            fontWeight: 900,
                                                                            color: '#2563eb',
                                                                            background: '#eff6ff',
                                                                            cursor: 'pointer',
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <Text className="text-blue-600 font-black text-[11px] uppercase tracking-wider">
                                                                        {t.scheduled_time || '07:00 AM'}
                                                                    </Text>
                                                                )}
                                                            </View>
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
                                                                <View className="ml-3 flex-1 justify-center">
                                                                    <Text className="text-sm text-slate-700 font-medium" numberOfLines={2}>
                                                                        <Text className={`font-black ${checkedItems[t.id]?.[item.material_id] ? 'text-blue-900' : 'text-slate-900'}`}>
                                                                            {item.product_code || 'No Code'}
                                                                        </Text>
                                                                        <Text className="text-slate-400"> | </Text>
                                                                        <Text className={checkedItems[t.id]?.[item.material_id] ? 'text-blue-800' : 'text-slate-700'}>
                                                                            {item.product_name}
                                                                        </Text>
                                                                        {(item.dimensions || (item.dim_length && item.dim_width)) && (
                                                                            <>
                                                                                <Text className="text-slate-400"> | </Text>
                                                                                <Text className="text-slate-500 italic text-xs">
                                                                                    {item.dimensions || `${item.dim_length}x${item.dim_width}`}
                                                                                </Text>
                                                                            </>
                                                                        )}
                                                                    </Text>
                                                                </View>
                                                                <View className="items-end">
                                                                    <Text className="text-sm font-black text-slate-900">{item.qty} {item.unit}</Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>

                                                    {/* ── Editable Driver Instructions / Notes ── */}
                                                    <View className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                        <View className="flex-row items-center gap-2 mb-2">
                                                            <AlertCircle size={14} color="#64748b" />
                                                            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Driver Instructions / Notes</Text>
                                                            <Edit3 size={12} color="#94a3b8" />
                                                        </View>
                                                        <TextInput
                                                            className="text-slate-700 text-xs font-bold leading-5 bg-white border border-slate-200 rounded-lg p-3"
                                                            value={editableNotes[t.id] || ''}
                                                            onChangeText={(txt) => setEditableNotes(prev => ({ ...prev, [t.id]: txt }))}
                                                            onBlur={() => handleSaveField(t, 'notes')}
                                                            placeholder="Add driver instructions or delivery notes..."
                                                            placeholderTextColor="#94a3b8"
                                                            multiline
                                                            numberOfLines={3}
                                                            style={{ minHeight: 60, textAlignVertical: 'top' } as any}
                                                        />
                                                    </View>

                                                    {/* ── Driver Bubble Selector ────────────── */}
                                                    <View className="mt-4">
                                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Driver</Text>
                                                        <View className="flex-row flex-wrap gap-2">
                                                            {DRIVERS.map(d => (
                                                                <TouchableOpacity
                                                                    key={d.id}
                                                                    onPress={() => {
                                                                        setSelectedDrivers(prev => ({ ...prev, [t.id]: prev[t.id] === d.name ? '' : d.name }));
                                                                        setTruckIds(prev => {
                                                                            const newDriver = selectedDrivers[t.id] === d.name ? '' : d.name;
                                                                            const truckPart = selectedTrucks[t.id] || '';
                                                                            return { ...prev, [t.id]: [newDriver, truckPart].filter(Boolean).join(' – ') };
                                                                        });
                                                                    }}
                                                                    className={`px-3 py-2 rounded-full flex-row items-center gap-1.5 border ${selectedDrivers[t.id] === d.name ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
                                                                >
                                                                    <User size={12} color={selectedDrivers[t.id] === d.name ? '#fff' : '#64748b'} />
                                                                    <Text className={`text-xs font-bold ${selectedDrivers[t.id] === d.name ? 'text-white' : 'text-slate-700'}`}>{d.name}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </View>

                                                    {/* ── Truck Bubble Selector ────────────── */}
                                                    <View className="mt-3">
                                                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Truck</Text>
                                                        <View className="flex-row flex-wrap gap-2">
                                                            {TRUCKS.map(tr => (
                                                                <TouchableOpacity
                                                                    key={tr.id}
                                                                    onPress={() => {
                                                                        setSelectedTrucks(prev => ({ ...prev, [t.id]: prev[t.id] === tr.name ? '' : tr.name }));
                                                                        setTruckIds(prev => {
                                                                            const driverPart = selectedDrivers[t.id] || '';
                                                                            const newTruck = selectedTrucks[t.id] === tr.name ? '' : tr.name;
                                                                            return { ...prev, [t.id]: [driverPart, newTruck].filter(Boolean).join(' – ') };
                                                                        });
                                                                    }}
                                                                    className={`px-3 py-2 rounded-full flex-row items-center gap-1.5 border ${selectedTrucks[t.id] === tr.name ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
                                                                >
                                                                    <Truck size={12} color={selectedTrucks[t.id] === tr.name ? '#fff' : '#64748b'} />
                                                                    <Text className={`text-xs font-bold ${selectedTrucks[t.id] === tr.name ? 'text-white' : 'text-slate-700'}`} numberOfLines={1}>{tr.name}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </View>

                                                    {/* Action Bar */}
                                                    <View className="mt-6 flex-row items-center justify-end pt-6 border-t border-slate-100">
                                                        <TouchableOpacity
                                                            onPress={() => handleDispatch(t)}
                                                            className={`px-8 py-3 rounded-xl flex-row items-center gap-2 shadow-lg ${isTicketFullyChecked(t) && (truckIds[t.id] || selectedDrivers[t.id]) ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-400 shadow-slate-200'}`}
                                                        >
                                                            <Truck size={18} color="white" strokeWidth={2.5} />
                                                            <Text className="text-white font-inter font-black uppercase tracking-widest text-xs">
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
            <FleetManagementModal
                visible={showFleetModal}
                onClose={() => setShowFleetModal(false)}
                onUpdated={loadFleet}
            />
        </>
    );
}
