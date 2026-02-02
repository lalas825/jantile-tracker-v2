import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Alert, Modal, FlatList, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../powersync/db';
import { SupabaseService, UIWorkerWithLogs, UIJobLog, UICrewMember, formatDate, getInitials } from '../../services/SupabaseService';
import ProductionRow from '../../components/ProductionRow';
import * as Crypto from 'expo-crypto';
import { usePowerSyncQuery } from '@powersync/react';

import { supabase } from '../../lib/supabase';

// RECONSTRUCTION PHASE 9
// Objective: Phase 8 + Supabase Realtime (Web) + Forced Refresh (Native).

const COLORS = [
    { id: 'white', code: '#ffffff', border: '#e2e8f0', inputBg: '#f8fafc', dot: '#ffffff' },
    { id: 'green', code: '#dcfce7', border: '#bbf7d0', inputBg: '#f0fdf4', dot: '#86efac' },
    { id: 'yellow', code: '#fef9c3', border: '#fef08a', inputBg: '#fefce8', dot: '#fde047' },
    { id: 'red', code: '#fee2e2', border: '#fecaca', inputBg: '#fef2f2', dot: '#fca5a5' },
    { id: 'purple', code: '#f3e8ff', border: '#e9d5ff', inputBg: '#faf5ff', dot: '#d8b4fe' },
    { id: 'blue', code: '#dbeafe', border: '#bfdbfe', inputBg: '#eff6ff', dot: '#93c5fd' },
    { id: 'orange', code: '#ffedd5', border: '#fed7aa', inputBg: '#fff7ed', dot: '#fdba74' },
    { id: 'pink', code: '#fce7f3', border: '#fbcfe8', inputBg: '#fdf2f8', dot: '#f9a8d4' },
    { id: 'teal', code: '#ccfbf1', border: '#99f6e4', inputBg: '#f0fdfa', dot: '#5eead4' },
    { id: 'gray', code: '#f1f5f9', border: '#e2e8f0', inputBg: '#f8fafc', dot: '#cbd5e1' },
];

const ColorDot = ({ colorId, active, onPress }: any) => {
    const c = COLORS.find(co => co.id === colorId);
    if (!c) return null;
    return (
        <TouchableOpacity onPress={onPress} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.dot, borderWidth: 1, borderColor: active ? '#0f172a' : 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' }} />
    );
};

export default function PolishersScreen() {
    return <PolishersContent />;
}

function PolishersContent() {
    const isMobile = Dimensions.get('window').width < 768;

    // --- STATE ---
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Normalize dates to midnight local time to avoid timezone jumping
    const getToday = () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const [dateMode, setDateMode] = useState('Today');
    const [dateRange, setDateRange] = useState({ start: getToday(), end: getToday() });
    const [searchQuery, setSearchQuery] = useState('');
    const [colorFilter, setColorFilter] = useState<string | null>(null);
    const [psRoster, setPsRoster] = useState<any[]>([]);
    const [activeJobs, setActiveJobs] = useState<any[]>([]);

    // --- DATA FETCHING ---
    const isActuallyWeb = Platform.OS === 'web';
    const [webLogs, setWebLogs] = useState<UIWorkerWithLogs[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [optimisticLogs, setOptimisticLogs] = useState<Record<string, Partial<UIJobLog>>>({});

    const psLogs = usePowerSyncQuery(
        `SELECT pl.*, w.name as worker_name, w.avatar as worker_avatar 
         FROM production_logs pl 
         LEFT JOIN workers w ON pl.worker_id = w.id 
         WHERE pl.date >= ? AND pl.date <= ?`,
        [formatDate(dateRange.start), formatDate(dateRange.end)]
    );

    // FETCH FOR WEB (Direct Supabase)
    useEffect(() => {
        if (isActuallyWeb || db.isMock) {
            const fetchWeb = async () => {
                try {
                    const data = await SupabaseService.getProductionLogs(formatDate(dateRange.start), formatDate(dateRange.end));
                    setWebLogs(data);
                    setFetchError(null);
                } catch (e: any) {
                    console.error("[Polishers] Web fetch error:", e);
                    setFetchError(e.message || "Failed to fetch logs from Supabase.");
                }
            };
            fetchWeb();
        }
    }, [dateRange.start.getTime(), dateRange.end.getTime(), refreshTrigger, db.isMock, isActuallyWeb]);

    // REALTIME FOR WEB & MOCK (Online Mode) ⚡
    useEffect(() => {
        // Only run real-time listener if we are using Supabase directly (Web or Expo Go/Mock)
        if (!isActuallyWeb && !db.isMock) return;

        const channel = supabase.channel('polishers-realtime');

        // Use type-safe subscription for production_logs changes
        (channel as any)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs' }, (payload: any) => {
                console.log('Realtime change detected:', payload);
                if (payload.new?.id) {
                    setOptimisticLogs(prev => {
                        const next = { ...prev };
                        delete next[payload.new.id];
                        return next;
                    });
                }
                triggerRefresh();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isActuallyWeb, db.isMock]);

    const workers = React.useMemo(() => {
        // --- Web / Mock Flow ---
        if (isActuallyWeb || db.isMock) {
            return webLogs.map(w => ({
                ...w,
                logs: w.logs.map(log => {
                    const opt = optimisticLogs[log.id];
                    if (!opt) return log;
                    return { ...log, ...opt };
                })
            }));
        }

        // --- Native (PowerSync) Flow ---
        const workerMap = new Map<string, UIWorkerWithLogs>();
        psLogs.forEach((log: any) => {
            if (!workerMap.has(log.worker_id)) {
                workerMap.set(log.worker_id, {
                    id: log.worker_id,
                    name: log.worker_name || 'Unknown Worker',
                    avatar: log.worker_avatar || '',
                    logs: [],
                    isExpanded: true
                });
            }

            // Apply Optimistic Overrides
            const opt = optimisticLogs[log.id] || {};
            workerMap.get(log.worker_id)?.logs.push({
                id: log.id,
                date: log.date,
                jobName: opt.jobName !== undefined ? opt.jobName : log.job_name,
                plNumber: opt.plNumber !== undefined ? opt.plNumber : log.pl_number,
                unit: opt.unit !== undefined ? opt.unit : log.unit,
                regHours: opt.regHours !== undefined ? opt.regHours : log.reg_hours,
                otHours: opt.otHours !== undefined ? opt.otHours : log.ot_hours,
                ticketNumber: opt.ticketNumber !== undefined ? opt.ticketNumber : log.ticket_number,
                isJantile: opt.isJantile !== undefined ? opt.isJantile : !!log.is_jantile,
                isTicket: opt.isTicket !== undefined ? opt.isTicket : !!log.is_ticket,
                statusColor: opt.statusColor !== undefined ? opt.statusColor : log.status_color,
                notes: opt.notes !== undefined ? opt.notes : log.notes,
                workerId: log.worker_id,
                jobId: opt.jobId !== undefined ? opt.jobId : log.job_id
            });
        });

        return Array.from(workerMap.values());
    }, [psLogs, webLogs, db.isMock, isActuallyWeb, refreshTrigger, optimisticLogs]);

    const totalLogs = React.useMemo(() => workers.reduce((acc, w) => acc + (w.logs?.length || 0), 0), [workers, refreshTrigger]);

    const totals = React.useMemo(() => {
        let contract = 0;
        let ticket = 0;
        let total = 0;
        let ot = 0;

        workers.forEach(w => {
            w.logs.forEach(l => {
                const reg = parseFloat(l.regHours) || 0;
                const over = parseFloat(l.otHours) || 0;
                total += reg;
                ot += over;
                // CONTRACT is the default unless specifically marked as TKT 🚀
                if (l.isTicket) ticket += reg;
                else contract += reg;
            });
        });

        return { contract, ticket, total, ot };
    }, [workers]);

    useEffect(() => {
        const fetchStatic = async () => {
            try {
                const workersList = await SupabaseService.getWorkers();
                setPsRoster(workersList.filter((w: any) =>
                    w.role?.toLowerCase().includes('polisher') &&
                    w.status === 'Active'
                ));
                const jobs = await SupabaseService.getActiveJobs();
                setActiveJobs(jobs);
            } catch (error) {
                console.error('[Polishers] Static data fetch error:', error);
            } finally {
                setIsLoadingInitial(false);
            }
        };
        fetchStatic();
    }, []);

    // Helper to refresh data manually (especially for Web)
    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

    // --- ACTIONS ---
    const updateLog = async (workerId: string, logId: string, field: string | Record<string, any>, value?: any) => {
        // OPTIMISTIC UPDATE 🚀
        const updates = typeof field === 'string' ? { [field]: value } : field;
        setOptimisticLogs(prev => ({
            ...prev,
            [logId]: { ...(prev[logId] || {}), ...updates }
        }));

        try {
            await SupabaseService.upsertLog(logId, dateRange.start, workerId, field, value);
            triggerRefresh(); // Force refresh to sync with DB
        } catch (e: any) {
            // Revert optimistic on error
            setOptimisticLogs(prev => {
                const next = { ...prev };
                delete next[logId];
                return next;
            });
            Alert.alert("Save Error", e.message || "Unknown error");
        }
    };

    const addJobRow = async (workerId: string) => {
        const id = Crypto.randomUUID();
        try {
            await SupabaseService.upsertLog(id, dateRange.start, workerId, 'statusColor', 'white');
            triggerRefresh();
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", "Failed to add job row: " + (e.message || ""));
        }
    };

    const deleteRow = async (logId: string) => {
        try {
            await SupabaseService.deleteLog(logId);
            triggerRefresh();
        } catch (e: any) {
            Alert.alert("Error", "Failed to delete: " + (e.message || ""));
        }
    };

    const duplicateRow = async (workerId: string, log: UIJobLog) => {
        try {
            await SupabaseService.upsertLog(Crypto.randomUUID(), dateRange.start, workerId, 'statusColor', log.statusColor || 'white');
            triggerRefresh();
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", "Failed to duplicate: " + (e.message || ""));
        }
    };

    const handleAddWorker = async (member: UICrewMember) => {
        const id = Crypto.randomUUID();
        try {
            await SupabaseService.upsertLog(id, dateRange.start, member.id, 'statusColor', 'white');
            setAddWorkerVisible(false);
            triggerRefresh();
        } catch (e: any) {
            console.error(e);
            Alert.alert("Error", "Failed to add worker: " + (e.message || ""));
        }
    };

    const handleDateTab = (tab: string) => {
        const today = getToday();
        let start = new Date(today); let end = new Date(today);
        if (tab === 'Yesterday') { start.setDate(today.getDate() - 1); end.setDate(today.getDate() - 1); }
        else if (tab === 'Week') { const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1); start.setDate(diff); end.setDate(diff + 6); }
        else if (tab === 'Custom') { setTempRange({ start: dateRange.start, end: dateRange.end }); setCurrentMonth(new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1)); setCustomPickerVisible(true); return; }
        setDateRange({ start, end }); setDateMode(tab);
    };

    const shiftDate = (days: number) => { const s = new Date(dateRange.start); const e = new Date(dateRange.end); s.setDate(s.getDate() + days); e.setDate(e.getDate() + days); setDateRange({ start: s, end: e }); setDateMode('Custom'); };
    const applyCustomRange = () => { if (tempRange.start && tempRange.end) { setDateRange({ start: tempRange.start, end: tempRange.end }); setDateMode('Custom'); setCustomPickerVisible(false); } };
    const formatDateStr = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const displayWorkers = workers.map(w => ({
        ...w,
        logs: w.logs.filter(l => {
            const matchSearch = !searchQuery || JSON.stringify(l).toLowerCase().includes(searchQuery.toLowerCase()) || w.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchColor = !colorFilter || l.statusColor === colorFilter;
            return matchSearch && matchColor;
        })
    })).filter(w => w.logs.length > 0 || (searchQuery === '' && !colorFilter));

    // Modals state
    const [customPickerVisible, setCustomPickerVisible] = useState(false);
    const [tempRange, setTempRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [addWorkerVisible, setAddWorkerVisible] = useState(false);
    const [selectedLogForJob, setSelectedLogForJob] = useState<{ workerId: string, logId: string } | null>(null);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top']}>
            {/* Header */}
            <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a' }}>Polishers Hub</Text>
                        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b' }}>{totalLogs}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => setAddWorkerVisible(true)} style={{ backgroundColor: '#eff6ff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 }}>
                        <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>+ Polisher</Text>
                    </TouchableOpacity>
                </View>

                {/* ERROR PANEL (If Web fetch fails) */}
                {fetchError && (
                    <View style={{ backgroundColor: '#fef2f2', borderBottomWidth: 1, borderColor: '#fecaca', padding: 8, marginTop: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="alert-circle" size={16} color="#dc2626" />
                        <Text style={{ fontSize: 12, color: '#991b1b', fontWeight: 'bold', marginLeft: 8 }}>
                            {fetchError}
                        </Text>
                    </View>
                )}

                {/* Date Controls */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 }}>
                        <TouchableOpacity onPress={() => shiftDate(-1)} style={{ padding: 6 }}><Ionicons name="chevron-back" size={20} color="#64748b" /></TouchableOpacity>
                        <Text style={{ marginHorizontal: 10, fontWeight: 'bold', fontSize: 13 }}>{formatDateStr(dateRange.start)}</Text>
                        <TouchableOpacity onPress={() => shiftDate(1)} style={{ padding: 6 }}><Ionicons name="chevron-forward" size={20} color="#64748b" /></TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                            {['Today', 'Yesterday', 'Week', 'Custom'].map(t => (
                                <TouchableOpacity key={t} onPress={() => handleDateTab(t)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: dateMode === t ? '#fff' : 'transparent', borderWidth: dateMode === t ? 1 : 0, borderColor: '#e2e8f0' }}>
                                    <Text style={{ fontSize: 12, fontWeight: 'medium', color: dateMode === t ? '#2563eb' : '#64748b' }}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                {/* Filters */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15, gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 5 }}>{COLORS.map(c => <ColorDot key={c.id} colorId={c.id} active={colorFilter === c.id} onPress={() => setColorFilter(colorFilter === c.id ? null : c.id)} />)}</View>
                    <TextInput placeholder="Search..." value={searchQuery} onChangeText={setSearchQuery} style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 6, fontSize: 13 }} />
                </View>
            </View>

            {isLoadingInitial ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#3b82f6" /></View>
            ) : (
                <View style={{ flex: 1 }}>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isMobile ? 15 : 30 }}>
                        {displayWorkers.map(worker => (
                            <View key={worker.id} style={{ backgroundColor: '#fff', borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }}>
                                <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fafcfd', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#1e293b' }}>{worker.name}</Text>
                                    <TouchableOpacity onPress={() => addJobRow(worker.id)} style={{ padding: 5 }}><Ionicons name="add-circle-outline" size={24} color="#3b82f6" /></TouchableOpacity>
                                </View>
                                <View style={{ padding: 10 }}>
                                    {worker.logs.map(log => (
                                        <ProductionRow
                                            key={log.id} log={log} activeJobs={activeJobs}
                                            onUpdate={(field, value) => updateLog(worker.id, log.id, field as keyof UIJobLog, value)}
                                            onDelete={() => deleteRow(log.id)} onDuplicate={() => duplicateRow(worker.id, log)}
                                            onSelectJob={() => setSelectedLogForJob({ workerId: worker.id, logId: log.id })}
                                        />
                                    ))}
                                </View>
                            </View>
                        ))}
                        {workers.length === 0 && <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#94a3b8' }}>No logs for this date.</Text></View>}
                        <View style={{ height: 100 }} />
                    </ScrollView>
                </View>
            )}

            {/* Bottom Summary Bar (V1 Classic Style) 📊 */}
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 12,
                backgroundColor: '#fff',
                borderTopWidth: 1,
                borderColor: '#e2e8f0',
            }}>
                {/* Left: Entry count & Date */}
                <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '600' }}>
                    Showing {totalLogs} entries ({formatDateStr(dateRange.start)} - {formatDateStr(dateRange.end)})
                </Text>

                {/* Right: Totals Group */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 15 }}>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: '800', letterSpacing: 0.5 }}>OT</Text>
                        <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>{totals.ot} hrs</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: '800', letterSpacing: 0.5 }}>CONTRACT</Text>
                        <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>{totals.contract} hrs</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 8, color: '#94a3b8', fontWeight: '800', letterSpacing: 0.5 }}>TICKET</Text>
                        <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>{totals.ticket} hrs</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                        <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '900', letterSpacing: 0.5 }}>TOTAL</Text>
                        <Text style={{ fontSize: 32, color: '#0f172a', fontWeight: '900' }}>{totals.total} Hrs</Text>
                    </View>
                </View>
            </View>

            {/* Modals (Phase 6 style) */}
            <Modal visible={addWorkerVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#fff', width: '100%', maxWidth: 350, borderRadius: 20, padding: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Add Crew Member</Text>
                        <FlatList
                            data={psRoster.filter(m => !workers.some(w => w.id === m.id))} keyExtractor={i => i.id} style={{ maxHeight: 300 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => handleAddWorker(item)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
                                    <Text>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity onPress={() => setAddWorkerVisible(false)} style={{ marginTop: 20, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center' }}>
                            <Text style={{ fontWeight: 'bold', color: '#64748b' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!selectedLogForJob} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#fff', width: '100%', maxWidth: 350, borderRadius: 20, padding: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Select Job</Text>
                        <FlatList
                            data={activeJobs} keyExtractor={i => i.id} style={{ maxHeight: 300 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => { if (selectedLogForJob) updateLog(selectedLogForJob.workerId, selectedLogForJob.logId, { jobId: item.id, jobName: item.name }); setSelectedLogForJob(null); }} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' }} >
                                    <Text>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity onPress={() => setSelectedLogForJob(null)} style={{ marginTop: 20, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center' }}>
                            <Text style={{ fontWeight: 'bold', color: '#64748b' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={customPickerVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#fff', width: '100%', maxWidth: 380, borderRadius: 30, padding: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View><Text style={{ fontSize: 20, fontWeight: '900', color: '#1e293b' }}>Select Range</Text><Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text></View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={{ padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 }}><Ionicons name="chevron-back" size={16} color="#475569" /></TouchableOpacity>
                                <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={{ padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 }}><Ionicons name="chevron-forward" size={16} color="#475569" /></TouchableOpacity>
                                <TouchableOpacity onPress={() => setCustomPickerVisible(false)} style={{ padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 }}><Ionicons name="close" size={18} color="#475569" /></TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', marginBottom: 10 }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (<Text key={`${day}-${idx}`} style={{ width: '14.28%', textAlign: 'center', fontSize: 10, fontWeight: '900', color: '#cbd5e1' }}>{day}</Text>))}</View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                {(() => {
                                    const year = currentMonth.getFullYear(); const month = currentMonth.getMonth();
                                    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
                                    const cells = [];
                                    for (let i = 0; i < firstDay; i++) cells.push(<View key={`empty-${i}`} style={{ width: '14.28%', height: 44 }} />);
                                    for (let d = 1; d <= daysInMonth; d++) {
                                        const date = new Date(year, month, d); const isStart = tempRange.start && date.toDateString() === tempRange.start.toDateString(); const isEnd = tempRange.end && date.toDateString() === tempRange.end.toDateString(); const inRange = tempRange.start && tempRange.end && date > tempRange.start && date < tempRange.end;
                                        cells.push(<TouchableOpacity key={`day-${d}`} onPress={() => { if (!tempRange.start || (tempRange.start && tempRange.end)) setTempRange({ start: date, end: null }); else if (date < tempRange.start) setTempRange({ start: date, end: tempRange.start }); else setTempRange({ ...tempRange, end: date }); }} style={{ width: '14.28%', height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: (isStart || isEnd) ? '#1e293b' : inRange ? '#f1f5f9' : 'transparent', borderTopLeftRadius: isStart ? 10 : 0, borderBottomLeftRadius: isStart ? 10 : 0, borderTopRightRadius: isEnd ? 10 : 0, borderBottomRightRadius: isEnd ? 10 : 0 }}><Text style={{ fontSize: 13, fontWeight: 'bold', color: (isStart || isEnd) ? '#fff' : '#475569' }}>{d}</Text></TouchableOpacity>);
                                    }
                                    return cells;
                                })()}
                            </View>
                        </View>
                        <TouchableOpacity onPress={applyCustomRange} disabled={!tempRange.start || !tempRange.end} style={{ backgroundColor: !tempRange.start || !tempRange.end ? '#cbd5e1' : '#2563eb', padding: 15, borderRadius: 15, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Apply Selection</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}