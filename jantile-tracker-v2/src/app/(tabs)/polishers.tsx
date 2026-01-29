import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList, TextInput, Platform, Alert, Dimensions, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { SupabaseService, UIWorkerWithLogs, UIJobLog, UICrewMember, formatDate } from '../../services/SupabaseService';
import ProductionRow from '../../components/ProductionRow';
import * as Crypto from 'expo-crypto';
import { usePolishersData } from '../../hooks/usePolishersData';
import { usePowerSyncQuery } from '@powersync/react-native';

// --- CONFIGURATION (PROFESSIONAL PASTELS) ---
const COLORS = [
    { id: 'white', code: '#ffffff', border: '#e2e8f0', dot: '#ffffff' },
    { id: 'green', code: '#dcfce7', border: '#86efac', dot: '#dcfce7' },
    { id: 'yellow', code: '#fef9c3', border: '#fde047', dot: '#fef9c3' },
    { id: 'red', code: '#fee2e2', border: '#fca5a5', dot: '#fee2e2' },
    { id: 'purple', code: '#f3e8ff', border: '#d8b4fe', dot: '#f3e8ff' },
    { id: 'blue', code: '#dbeafe', border: '#93c5fd', dot: '#dbeafe' },
    { id: 'orange', code: '#ffedd5', border: '#fdba74', dot: '#ffedd5' },
    { id: 'pink', code: '#fce7f3', border: '#f9a8d4', dot: '#fce7f3' },
    { id: 'teal', code: '#ccfbf1', border: '#5eead4', dot: '#ccfbf1' },
    { id: 'gray', code: '#f1f5f9', border: '#cbd5e1', dot: '#f1f5f9' },
];

const ColorDot = ({ colorId, active, onPress }: any) => {
    const c = COLORS.find(co => co.id === colorId);
    if (!c) return null;
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: c.dot,
                borderWidth: active ? 2 : 1,
                borderColor: active ? '#0f172a' : 'rgba(0,0,0,0.1)',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {active && <Ionicons name="checkmark" size={14} color={colorId === 'yellow' || colorId === 'white' ? 'black' : 'white'} />}
        </TouchableOpacity>
    );
}

export default function PolishersScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const isMobile = Dimensions.get('window').width < 768;

    // -- STATE --
    const [dateMode, setDateMode] = useState('Today');
    const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
    const [searchQuery, setSearchQuery] = useState('');
    const [colorFilter, setColorFilter] = useState<string | null>(null);

    // PowerSync Reactive Data
    const { workers: psWorkers, roster: psRoster } = usePolishersData(
        formatDate(dateRange.start),
        formatDate(dateRange.end)
    );

    const activeJobsResult = usePowerSyncQuery('SELECT * FROM jobs WHERE status = "active" ORDER BY name ASC');
    const activeJobs = activeJobsResult || [];

    // Modals
    const [customPickerVisible, setCustomPickerVisible] = useState(false);
    const [tempRange, setTempRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
    const [pickerVisible, setPickerVisible] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [addWorkerVisible, setAddWorkerVisible] = useState(false);

    // Debug State
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [showDebug, setShowDebug] = useState(false);
    const [devEmail, setDevEmail] = useState('');
    const [devPassword, setDevPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Use local date string to prevent timezone shifts (UTC vs Local)
    // NOW USING CENTRAL HELPERS from SupabaseService

    // Use local state only for optimistic UI if needed, otherwise rely on PS hooks
    const [workers, setWorkers] = useState<UIWorkerWithLogs[]>([]);

    useEffect(() => {
        setWorkers(psWorkers);
    }, [psWorkers]);

    const formatDateStr = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const handleDateTab = (tab: string) => {
        const today = new Date(); let start = new Date(today); let end = new Date(today);
        if (tab === 'Yesterday') { start.setDate(today.getDate() - 1); end.setDate(today.getDate() - 1); }
        else if (tab === 'Week') { const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1); start.setDate(diff); end.setDate(diff + 6); }
        else if (tab === 'Custom') {
            setTempRange({ start: dateRange.start, end: dateRange.end });
            setCurrentMonth(new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1));
            setCustomPickerVisible(true);
            return;
        }
        setDateRange({ start, end }); setDateMode(tab);
    };
    const shiftDate = (days: number) => { const s = new Date(dateRange.start); const e = new Date(dateRange.end); s.setDate(s.getDate() + days); e.setDate(e.getDate() + days); setDateRange({ start: s, end: e }); setDateMode('Custom'); };
    const applyCustomRange = () => { if (tempRange.start && tempRange.end) { setDateRange({ start: tempRange.start, end: tempRange.end }); setDateMode('Custom'); setCustomPickerVisible(false); } };

    const addJobRow = async (workerId: string) => {
        const newLogId = Crypto.randomUUID();
        try {
            const newLog: UIJobLog = {
                id: newLogId,
                date: formatDate(dateRange.start),
                jobName: '',
                plNumber: '',
                unit: '',
                regHours: '',
                otHours: '',
                ticketNumber: '',
                isJantile: false,
                isTicket: false,
                statusColor: 'white',
                notes: '',
                workerId: workerId
            };
            setWorkers(workers.map(w => w.id !== workerId ? w : { ...w, logs: [...w.logs, newLog] }));

            // 2. SAVE TO DATABASE (Live)
            await SupabaseService.upsertLog(
                newLogId,
                dateRange.start,
                workerId,
                'statusColor', // Just kick off the row with a default field
                'white'
            );
        } catch (error) {
            console.error("Add Job Error:", error);
            Alert.alert("Error", "Failed to create new job card: " + error);
        }
    };

    const updateLog = async (workerId: string, logId: string, field: keyof UIJobLog, value: any) => {
        setWorkers(prevWorkers => prevWorkers.map(w => w.id !== workerId ? w : {
            ...w, logs: w.logs.map(l => (l.id !== logId ? l : { ...l, [field]: value }))
        }));

        // DB SAVE (Now passing logId)
        try {
            await SupabaseService.upsertLog(logId, dateRange.start, workerId, field, value);
        } catch (e: any) {
            Alert.alert("Save Error", `Could not save: ${e.message}`);
        }
    };

    const deleteRow = async (workerId: string, logId: string) => {
        setWorkers(workers.map(w => w.id !== workerId ? w : { ...w, logs: w.logs.filter(l => l.id !== logId) }));
        try { await SupabaseService.deleteLog(logId); } catch (e) { Alert.alert("Error", "Failed to delete log."); }
    };

    const duplicateRow = async (workerId: string, log: UIJobLog) => {
        const newLogId = Crypto.randomUUID();
        const newLog = { ...log, id: newLogId };
        setWorkers(workers.map(w => w.id !== workerId ? w : { ...w, logs: [...w.logs, newLog] }));

        try {
            // Save each field of the newly duplicated row
            // In a real app we might want a bulk upsert, but for now we can just save the ID
            // to establish the row, then the user usually edits.
            await SupabaseService.upsertLog(newLogId, dateRange.start, workerId, 'statusColor', log.statusColor || 'white');
            // We could loop through all fields here if desired, but typically duplicate 
            // is followed by an edit, and creating the row with the color is enough to start.
        } catch (e) {
            console.error("Duplicate Save Error:", e);
        }
    };

    const toggleExpand = (id: string) => setWorkers(workers.map(w => w.id === id ? { ...w, isExpanded: !w.isExpanded } : w));
    const getAvailablePolishers = () => {
        const existingIds = new Set(workers.map(w => w.id));
        return psRoster.filter(m => !existingIds.has(m.id));
    };

    const handleAddWorker = (member: UICrewMember) => {
        const newWorker: UIWorkerWithLogs = {
            id: member.id, name: member.name, avatar: member.avatar, isExpanded: true, logs: []
        };
        setWorkers([...workers, newWorker]);
        setAddWorkerVisible(false);
    };

    // --- FOOTER CALCULATIONS ---
    const contractHours = workers.reduce((sum, w) =>
        sum + w.logs.reduce((s, l) => s + (l.isTicket ? 0 : parseFloat(l.regHours || '0') + parseFloat(l.otHours || '0')), 0)
        , 0);

    const ticketHours = workers.reduce((sum, w) =>
        sum + w.logs.reduce((s, l) => s + (l.isTicket ? parseFloat(l.regHours || '0') + parseFloat(l.otHours || '0') : 0), 0)
        , 0);

    const totalHours = workers.reduce((sum, w) =>
        sum + w.logs.reduce((s, l) => s + (parseFloat(l.regHours || '0') + parseFloat(l.otHours || '0')), 0)
        , 0);

    const generatePDF = async () => {
        try {
            const html = `<html><body><h1>Report ${formatDateStr(dateRange.start)}</h1><p>Total Hours: ${totalHours}</p></body></html>`;
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) { Alert.alert("Error", "Could not generate PDF"); }
    };

    const displayWorkers = workers.map(w => ({
        ...w,
        logs: w.logs.filter(l => {
            const matchSearch = !searchQuery || JSON.stringify(l).toLowerCase().includes(searchQuery.toLowerCase()) || w.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchColor = !colorFilter || l.statusColor === colorFilter;
            return matchSearch && matchColor;
        })
    })).filter(w => w.logs.length > 0 || (searchQuery === '' && !colorFilter));

    const renderJobRow = ({ item }: { item: UIJobLog }) => {
        if (Platform.OS === 'web') {
            return (
                <ProductionRow
                    key={item.id}
                    log={item}
                    activeJobs={activeJobs}
                    onUpdate={(field, value) => updateLog(item.workerId, item.id, field as keyof UIJobLog, value)}
                    onDelete={() => deleteRow(item.workerId, item.id)}
                    onDuplicate={() => duplicateRow(item.workerId, item)}
                />
            );
        }
        return <View><Text>Native Row Placeholder</Text></View>;
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50" style={{ paddingTop: Platform.OS === 'android' ? insets.top + 10 : 0 }}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="flex-row items-center justify-between mb-6 px-6 pt-6 bg-white border-b border-slate-200 pb-6">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-slate-100 rounded-xl items-center justify-center border border-slate-200">
                        <Ionicons name="construct" size={20} color="#64748b" />
                    </View>
                    <TouchableOpacity onLongPress={() => setShowDebug(!showDebug)}>
                        <Text className="text-2xl font-bold text-slate-900">Polishers Hub</Text>
                    </TouchableOpacity>
                </View>
                <View className="flex-row gap-3">
                    <TouchableOpacity onPress={() => setAddWorkerVisible(true)} className="flex-row items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                        <Ionicons name="add" size={18} color="#2563eb" />
                        <Text className="font-semibold text-blue-600">Add Polisher</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={generatePDF} className="flex-row items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg shadow-sm">
                        <Ionicons name="download-outline" size={18} color="white" />
                        <Text className="font-semibold text-white">Download Report</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {showDebug && (
                <View className="mx-4 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Text className="font-bold text-yellow-800 mb-2">Sync Status</Text>
                    <Text className="text-xs font-mono text-slate-700 leading-5 mb-3">{debugInfo || 'Connected to PowerSync'}</Text>
                    <View className="flex-row gap-2 mb-3">
                        <TouchableOpacity onPress={async () => {
                            const { error } = await SupabaseService.supabase.auth.signOut();
                        }} className="bg-red-200 px-3 py-1 rounded">
                            <Text className="text-xs font-bold text-red-900">Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <View className="bg-white border-b border-slate-200 px-4 py-3">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 12, paddingRight: 20 }}>
                    <View className="flex-row items-center bg-slate-50 rounded-lg border border-slate-200 p-1"><TouchableOpacity onPress={() => shiftDate(-1)} className="p-2 border-r border-slate-200"><Ionicons name="chevron-back" size={16} color="#64748b" /></TouchableOpacity><View className="px-4"><Text className="text-sm font-bold text-slate-700">{formatDateStr(dateRange.start)} {dateRange.start.getTime() !== dateRange.end.getTime() ? `- ${formatDateStr(dateRange.end)}` : ''}</Text></View><TouchableOpacity onPress={() => shiftDate(1)} className="p-2 border-l border-slate-200"><Ionicons name="chevron-forward" size={16} color="#64748b" /></TouchableOpacity></View>
                    <View className="flex-row bg-slate-50 rounded-lg p-1.5 border border-slate-200">{['Today', 'Yesterday', 'Week', 'Custom'].map(d => (<TouchableOpacity key={d} onPress={() => handleDateTab(d)} className={`px-3 py-1.5 rounded-md ${dateMode === d ? 'bg-white shadow-sm border border-slate-200' : ''}`}><Text className={`text-xs font-medium ${dateMode === d ? 'text-blue-600' : 'text-slate-500'}`}>{d}</Text></TouchableOpacity>))}</View>
                    <View className="h-8 w-px bg-slate-200 mx-2" /><TouchableOpacity onPress={() => setColorFilter(null)} className={`px-2 py-1 rounded border ${!colorFilter ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}><Text className={`text-xs font-bold ${!colorFilter ? 'text-white' : 'text-slate-500'}`}>All</Text></TouchableOpacity><View className="flex-row gap-1">{COLORS.map(c => <ColorDot key={c.id} colorId={c.id} active={colorFilter === c.id} onPress={() => setColorFilter(colorFilter === c.id ? null : c.id)} />)}</View>
                    <View className="flex-row items-center bg-slate-100 border border-slate-200 rounded-full px-4 py-2 w-48 ml-4"><Ionicons name="search" size={16} color="#94a3b8" /><TextInput placeholder="Search..." value={searchQuery} onChangeText={setSearchQuery} className="flex-1 ml-2 text-sm bg-transparent" /></View>
                </ScrollView>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
                {displayWorkers.map(worker => (
                    <View key={worker.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
                        <TouchableOpacity onPress={() => toggleExpand(worker.id)} className="flex-row items-center justify-between p-4 bg-white border-b border-slate-50">
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center border-2 border-white shadow-sm"><Text className="text-blue-700 font-bold">{worker.avatar}</Text></View>
                                <View><Text className="font-bold text-slate-800 text-base">{worker.name}</Text><Text className="text-xs text-slate-500 font-medium">({worker.logs.length} Log{worker.logs.length !== 1 ? 's' : ''})</Text></View>
                            </View>
                            <Ionicons name={worker.isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#94a3b8" />
                        </TouchableOpacity>
                        {worker.isExpanded && (
                            <View className="p-3 bg-white">
                                {worker.logs.map(log => renderJobRow({ item: log }))}
                                <TouchableOpacity onPress={() => addJobRow(worker.id)} className="flex-row items-center justify-center py-3 border-2 border-dashed border-slate-200 rounded-xl mt-2 active:bg-slate-50">
                                    <Ionicons name="add" size={20} color="#94a3b8" />
                                    <Text className="text-slate-400 font-bold ml-2">ADD JOB</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ))}
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 safe-bottom">
                <View className="flex-row justify-between items-center max-w-4xl mx-auto w-full">
                    <Text className="text-xs text-slate-400 font-medium">
                        Total for {formatDateStr(dateRange.start)}
                        {dateRange.start.getTime() !== dateRange.end.getTime() ? ` - ${formatDateStr(dateRange.end)}` : ''}
                    </Text>
                    <View className="flex-row gap-8">
                        <View><Text className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Contract</Text><View className="flex-row items-baseline"><Text className="text-lg font-bold text-slate-800">{contractHours.toFixed(1)}</Text><Text className="text-xs text-slate-500 ml-1">Hrs</Text></View></View>
                        <View><Text className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Ticket</Text><View className="flex-row items-baseline"><Text className="text-lg font-bold text-slate-800">{ticketHours.toFixed(1)}</Text><Text className="text-xs text-slate-500 ml-1">Hrs</Text></View></View>
                        <View><Text className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">TOTAL</Text><View className="flex-row items-baseline"><Text className="text-2xl font-bold text-slate-900">{totalHours.toFixed(1)}</Text><Text className="text-sm text-slate-600 ml-1">Hrs</Text></View></View>
                    </View>
                </View>
            </View>

            <Modal visible={addWorkerVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
                        <Text className="text-xl font-bold text-slate-800 mb-4">Add Crew Member</Text>
                        <FlatList
                            data={getAvailablePolishers()}
                            keyExtractor={i => i.id}
                            style={{ maxHeight: 300 }}
                            ListEmptyComponent={
                                <View className="py-8 items-center">
                                    <Ionicons name="people-outline" size={32} color="#cbd5e1" />
                                    <Text className="text-slate-400 mt-2 text-center">No available Marble Polishers found.</Text>
                                    <Text className="text-[10px] text-slate-300 mt-1">Make sure roles are set in Manpower.</Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => handleAddWorker(item)} className="flex-row items-center p-3 border-b border-slate-100 active:bg-slate-50">
                                    <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center mr-3"><Text className="text-xs font-bold text-slate-600">{item.avatar}</Text></View>
                                    <Text className="font-semibold text-slate-700">{item.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity onPress={() => setAddWorkerVisible(false)} className="mt-4 py-3 bg-slate-100 rounded-xl items-center"><Text className="font-bold text-slate-600">Cancel</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* CUSTOM RANGE MODAL (PREMIUM DYNAMIC CALENDAR) */}
            <Modal visible={customPickerVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl overflow-hidden">
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-xl font-black text-slate-800 tracking-tight">Select Range</Text>
                                <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                                <TouchableOpacity
                                    onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                                    className="p-2 rounded-full bg-slate-50 border border-slate-100"
                                >
                                    <Ionicons name="chevron-back" size={16} color="#64748b" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                                    className="p-2 rounded-full bg-slate-50 border border-slate-100"
                                >
                                    <Ionicons name="chevron-forward" size={16} color="#64748b" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setCustomPickerVisible(false)} className="bg-slate-50 p-2 rounded-full border border-slate-100 ml-2">
                                    <Ionicons name="close" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Calendar Core */}
                        <View className="mb-6">
                            <View className="flex-row mb-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                                    <Text key={day} className="w-[14.28%] text-center text-[10px] font-black text-slate-300">{day}</Text>
                                ))}
                            </View>
                            <View className="flex-row flex-wrap">
                                {(() => {
                                    const year = currentMonth.getFullYear();
                                    const month = currentMonth.getMonth();
                                    const firstDay = new Date(year, month, 1).getDay();
                                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                                    const cells = [];
                                    for (let i = 0; i < firstDay; i++) cells.push(<View key={`empty-${i}`} style={{ width: '14.28%', height: 44 }} />);

                                    for (let d = 1; d <= daysInMonth; d++) {
                                        const date = new Date(year, month, d);
                                        const isStart = tempRange.start && date.toDateString() === tempRange.start.toDateString();
                                        const isEnd = tempRange.end && date.toDateString() === tempRange.end.toDateString();
                                        const inRange = tempRange.start && tempRange.end && date > tempRange.start && date < tempRange.end;

                                        cells.push(
                                            <TouchableOpacity
                                                key={`day-${d}`}
                                                onPress={() => {
                                                    if (!tempRange.start || (tempRange.start && tempRange.end)) {
                                                        setTempRange({ start: date, end: null });
                                                    } else {
                                                        if (date < tempRange.start) {
                                                            setTempRange({ start: date, end: tempRange.start });
                                                        } else {
                                                            setTempRange({ ...tempRange, end: date });
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    width: '14.28%',
                                                    height: 44,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: (isStart || isEnd) ? '#0f172a' : inRange ? '#f1f5f9' : 'transparent',
                                                    borderTopLeftRadius: isStart ? 12 : 0,
                                                    borderBottomLeftRadius: isStart ? 12 : 0,
                                                    borderTopRightRadius: isEnd ? 12 : 0,
                                                    borderBottomRightRadius: isEnd ? 12 : 0,
                                                }}
                                            >
                                                <Text className={`text-sm font-bold ${(isStart || isEnd) ? 'text-white' : 'text-slate-600'}`}>{d}</Text>
                                            </TouchableOpacity>
                                        );
                                    }
                                    return cells;
                                })()}
                            </View>
                        </View>

                        <View className="bg-slate-900 rounded-3xl p-5 shadow-inner">
                            <View className="flex-row justify-between items-center">
                                <View>
                                    <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Duration</Text>
                                    <Text className="text-white font-bold text-sm">
                                        {tempRange.start ? formatDateStr(tempRange.start) : '—'}
                                        {tempRange.end ? ` to ${formatDateStr(tempRange.end)}` : ''}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={applyCustomRange}
                                    disabled={!tempRange.start || !tempRange.end}
                                    className={`w-12 h-12 rounded-2xl items-center justify-center ${(!tempRange.start || !tempRange.end) ? 'bg-slate-800' : 'bg-blue-600'}`}
                                >
                                    <Ionicons name="arrow-forward" size={24} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}