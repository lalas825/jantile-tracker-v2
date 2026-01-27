import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput, Platform, SafeAreaView, useWindowDimensions, Modal, FlatList, KeyboardAvoidingView, Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { MockJobStore } from '../../services/MockJobStore';

// --- CONFIGURATION (PROFESSIONAL PASTELS) ---
const COLORS = [
    { id: 'white', code: '#ffffff', border: '#cbd5e1' },
    { id: 'green', code: '#4ade80', border: '#16a34a' }, // Green 400
    { id: 'yellow', code: '#facc15', border: '#ca8a04' }, // Yellow 400
    { id: 'red', code: '#f87171', border: '#dc2626' }, // Red 400
    { id: 'purple', code: '#c084fc', border: '#9333ea' }, // Purple 400
    { id: 'blue', code: '#60a5fa', border: '#2563eb' }, // Blue 400
    { id: 'orange', code: '#fb923c', border: '#ea580c' }, // Orange 400
    { id: 'pink', code: '#f472b6', border: '#db2777' }, // Pink 400
    { id: 'teal', code: '#2dd4bf', border: '#0d9488' }, // Teal 400
    { id: 'gray', code: '#94a3b8', border: '#475569' }, // Slate 400
];

const TODAY_STR = new Date().toISOString().split('T')[0];
const LOGO_URL = "https://jantile.com/wp-content/uploads/2021/06/Logo.png";

// --- MOCK MANPOWER DATABASE ---
const MANPOWER_ROSTER = [
    { id: '1', name: 'Ardian Dodaj', role: 'Tile Foreman', avatar: 'AD' },
    { id: '2', name: 'David Zolaya', role: 'Tile Mechanic', avatar: 'DZ' },
    { id: '3', name: 'Irving Bravo', role: 'Marble Polisher', avatar: 'IB' },
    { id: '4', name: 'Juan Paulino', role: 'Marble Polisher', avatar: 'JP' },
    { id: '5', name: 'Jose Barros', role: 'Marble Polisher', avatar: 'JB' },
    { id: '6', name: 'Cesar Ushca', role: 'Marble Polisher', avatar: 'CU' },
    { id: '7', name: 'Edgar Guayara', role: 'Marble Polisher', avatar: 'EG' },
    { id: '8', name: 'Geovanny Saca', role: 'Marble Polisher', avatar: 'GS' },
];

// --- TYPES ---
interface JobLog {
    id: string; date: string; jobName: string; plNumber: string; unit: string; regHours: string; otHours: string; ticketNumber: string; isJantile: boolean; isTicket: boolean; statusColor: string; notes: string;
}
interface Worker {
    id: string; name: string; avatar: string; logs: JobLog[]; isExpanded: boolean;
}

// --- HELPER: Base64 Converter ---
const convertImageToBase64 = async (url: string) => {
    try {
        if (Platform.OS === 'web') {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } else {
            const fileUri = FileSystem.cacheDirectory + 'logo_temp.png';
            await FileSystem.downloadAsync(url, fileUri);
            const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
            return `data:image/png;base64,${base64}`;
        }
    } catch (error) {
        console.log("Logo conversion failed:", error);
        return url;
    }
};

// --- HELPER: Calendar ---
const RangeCalendar = ({ startDate, endDate, onRangeChange }: any) => {
    const [viewDate, setViewDate] = useState(new Date(startDate || new Date()));
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
    const handleDayPress = (day: number) => {
        const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        if (!startDate || (startDate && endDate)) onRangeChange({ start: selectedDate, end: null });
        else if (selectedDate < startDate) onRangeChange({ start: selectedDate, end: startDate });
        else onRangeChange({ start: startDate, end: selectedDate });
    };
    const renderDays = () => {
        const year = viewDate.getFullYear(); const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month); const firstDay = getFirstDayOfMonth(year, month);
        const slots = [];
        for (let i = 0; i < firstDay; i++) slots.push(<View key={`empty-${i}`} className="w-[14.28%] h-10" />);
        for (let day = 1; day <= daysInMonth; day++) {
            const current = new Date(year, month, day);
            const isStart = startDate && current.getTime() === startDate.getTime();
            const isEnd = endDate && current.getTime() === endDate.getTime();
            const isInRange = startDate && endDate && current > startDate && current < endDate;
            let bgClass = "bg-transparent"; let textClass = "text-slate-700";
            if (isStart || isEnd) { bgClass = "bg-blue-600 rounded-full"; textClass = "text-white font-bold"; }
            else if (isInRange) { bgClass = "bg-blue-100"; textClass = "text-blue-800"; }
            slots.push(<TouchableOpacity key={day} onPress={() => handleDayPress(day)} className={`w-[14.28%] h-10 items-center justify-center ${bgClass} mb-1`}><Text className={textClass}>{day}</Text></TouchableOpacity>);
        }
        return slots;
    };
    return (
        <View className="w-full">
            <View className="flex-row justify-between items-center mb-4">
                <TouchableOpacity onPress={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d) }} className="p-2 bg-slate-100 rounded-full"><Ionicons name="chevron-back" size={20} color="#334155" /></TouchableOpacity>
                <Text className="text-lg font-bold text-slate-800">{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                <TouchableOpacity onPress={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); setViewDate(d) }} className="p-2 bg-slate-100 rounded-full"><Ionicons name="chevron-forward" size={20} color="#334155" /></TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (<View key={d} className="w-[14.28%] items-center mb-2"><Text className="text-xs font-bold text-slate-400">{d}</Text></View>))}{renderDays()}</View>
        </View>
    );
};

// --- MAIN SCREEN ---
export default function PolishersScreen() {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const insets = useSafeAreaInsets();

    const [workers, setWorkers] = useState<Worker[]>([
        {
            id: '4', name: 'Juan Paulino', avatar: 'JP', isExpanded: true,
            logs: [{ id: '101', date: TODAY_STR, jobName: 'JFK Terminal 1', plNumber: '26903', unit: '31N PR-2H', regHours: '7', otHours: '', ticketNumber: '17137', isJantile: false, isTicket: true, statusColor: 'white', notes: 'Photo# 092223' }]
        },
        {
            id: '7', name: 'Edgar Guayara', avatar: 'EG', isExpanded: true,
            logs: [{ id: '201', date: TODAY_STR, jobName: '72 Park Ave', plNumber: '26900', unit: '31N Kitchen', regHours: '1', otHours: '', ticketNumber: '', isJantile: true, isTicket: false, statusColor: 'green', notes: 'Kitchen blue tape' }]
        }
    ]);

    const [activeJobs, setActiveJobs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [colorFilter, setColorFilter] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
    const [dateMode, setDateMode] = useState('Today');
    const [tempRange, setTempRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });

    // Modals
    const [customPickerVisible, setCustomPickerVisible] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<{ workerId: string, logId: string } | null>(null);
    const [addWorkerVisible, setAddWorkerVisible] = useState(false);

    useEffect(() => { setActiveJobs(MockJobStore.getAllJobs()); }, []);

    const formatDateStr = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const toISODate = (date: Date) => date.toISOString().split('T')[0];

    const handleDateTab = (tab: string) => {
        const today = new Date(); let start = new Date(today); let end = new Date(today);
        if (tab === 'Yesterday') { start.setDate(today.getDate() - 1); end.setDate(today.getDate() - 1); }
        else if (tab === 'Week') { const day = today.getDay(); const diff = today.getDate() - day + (day === 0 ? -6 : 1); start.setDate(diff); end.setDate(diff + 6); }
        else if (tab === 'Custom') { setTempRange({ start: dateRange.start, end: dateRange.end }); setCustomPickerVisible(true); return; }
        setDateRange({ start, end }); setDateMode(tab);
    };
    const shiftDate = (days: number) => { const s = new Date(dateRange.start); const e = new Date(dateRange.end); s.setDate(s.getDate() + days); e.setDate(e.getDate() + days); setDateRange({ start: s, end: e }); setDateMode('Custom'); };
    const applyCustomRange = () => { if (tempRange.start && tempRange.end) { setDateRange({ start: tempRange.start, end: tempRange.end }); setDateMode('Custom'); setCustomPickerVisible(false); } };

    const addJobRow = (workerId: string) => setWorkers(workers.map(w => w.id !== workerId ? w : { ...w, logs: [...w.logs, { id: Math.random().toString(), date: toISODate(dateRange.start), jobName: '', plNumber: '', unit: '', regHours: '', otHours: '', ticketNumber: '', isJantile: false, isTicket: false, statusColor: 'white', notes: '' }] }));
    const updateLog = (workerId: string, logId: string, field: keyof JobLog, value: any) => setWorkers(workers.map(w => w.id !== workerId ? w : { ...w, logs: w.logs.map(l => (l.id !== logId ? l : { ...l, [field]: value })) }));
    const deleteRow = (workerId: string, logId: string) => setWorkers(workers.map(w => w.id !== workerId ? w : { ...w, logs: w.logs.filter(l => l.id !== logId) }));
    const duplicateRow = (workerId: string, log: JobLog) => setWorkers(workers.map(w => w.id !== workerId ? w : { ...w, logs: [...w.logs, { ...log, id: Math.random().toString() }] }));
    const selectJobForLog = (jobName: string) => { if (pickerTarget) { updateLog(pickerTarget.workerId, pickerTarget.logId, 'jobName', jobName); setPickerVisible(false); setPickerTarget(null); } };
    const toggleExpand = (id: string) => setWorkers(workers.map(w => w.id === id ? { ...w, isExpanded: !w.isExpanded } : w));

    const getAvailablePolishers = () => {
        const existingIds = new Set(workers.map(w => w.id));
        return MANPOWER_ROSTER.filter(m => m.role === 'Marble Polisher' && !existingIds.has(m.id));
    };

    const handleAddWorker = (member: typeof MANPOWER_ROSTER[0]) => {
        const newWorker: Worker = {
            id: member.id, name: member.name, avatar: member.avatar, isExpanded: true,
            logs: []
        };
        setWorkers([...workers, newWorker]);
        setAddWorkerVisible(false);
    };

    const getVisibleLogs = (worker: Worker) => {
        return worker.logs.filter(log => {
            const logIso = log.date; const startIso = toISODate(dateRange.start); const endIso = toISODate(dateRange.end);
            if (logIso < startIso || logIso > endIso) return false;
            if (colorFilter && log.statusColor !== colorFilter) return false;
            if (searchQuery) { const q = searchQuery.toLowerCase(); if (!worker.name.toLowerCase().includes(q) && !(log.jobName || '').toLowerCase().includes(q) && !(log.plNumber || '').toLowerCase().includes(q) && !(log.unit || '').toLowerCase().includes(q) && !(log.ticketNumber || '').toLowerCase().includes(q) && !(log.notes || '').toLowerCase().includes(q)) return false; }
            return true;
        });
    };
    const filteredWorkers = workers.map(w => ({ ...w, visibleLogs: getVisibleLogs(w) }));
    const displayWorkers = filteredWorkers.filter(w => w.visibleLogs.length > 0 || w.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const totalHours = filteredWorkers.reduce((acc, w) => acc + w.visibleLogs.reduce((lAcc, l) => lAcc + (parseFloat(l.regHours) || 0) + (parseFloat(l.otHours) || 0), 0), 0);
    const ticketHours = filteredWorkers.reduce((acc, w) => acc + w.visibleLogs.filter(l => l.isTicket).reduce((lAcc, l) => lAcc + (parseFloat(l.regHours) || 0) + (parseFloat(l.otHours) || 0), 0), 0);
    const contractHours = totalHours - ticketHours;

    const generatePDF = async () => {
        const allRows = filteredWorkers.flatMap(w => w.visibleLogs.map(log => ({ ...log, workerName: w.name })));
        if (allRows.length === 0) { Alert.alert("No Data", "No logs for this period."); return; }

        const logoBase64 = await convertImageToBase64(LOGO_URL);
        const html = `<html><head><title>Jantile Report</title><style>@media print { body{-webkit-print-color-adjust: exact;} @page {margin:20px;} } body{font-family:Helvetica,sans-serif;padding:20px;color:#333} .header{display:flex;justify-content:space-between;border-bottom:3px solid #cc0000;padding-bottom:10px;margin-bottom:20px} .logo-img{height:50px;object-fit:contain} .report-title{font-size:22px;font-weight:800;color:#1e3a8a;margin:0} .meta{font-size:11px;color:#555;line-height:1.4} table{width:100%;border-collapse:collapse;font-size:10px} th{background:#1e3a8a!important;color:#fff!important;padding:8px;text-align:left;border:1px solid #0f3060} td{border:1px solid #ccc;padding:6px} .col-num{text-align:right;font-weight:bold} .total-row td{background:#e2e8f0!important;font-weight:bold;border-top:2px solid #1e3a8a}</style></head><body>
    <div class="header">
        <img src="${logoBase64}" class="logo-img" />
        <div style="text-align:right">
            <div class="report-title">POLISHING REPORT</div>
            <div class="meta">
                Period: ${formatDateStr(dateRange.start)} - ${formatDateStr(dateRange.end)}<br/>
                <b>Contract: ${contractHours.toFixed(1)} | Ticket: ${ticketHours.toFixed(1)} | Total: ${totalHours.toFixed(1)}</b>
            </div>
        </div>
    </div>
    <table><thead><tr><th>Date</th><th>Worker</th><th>Job/Unit</th><th>PL#</th><th>Tkt#</th><th>Desc</th><th class="col-num">Contr.</th><th class="col-num">Tkt</th></tr></thead><tbody>${allRows.map(l => { const t = (parseFloat(l.regHours) || 0) + (parseFloat(l.otHours) || 0); return `<tr><td>${l.date}</td><td>${l.workerName}</td><td><b>${l.jobName}</b><br/>${l.unit}</td><td>${l.plNumber}</td><td>${l.ticketNumber}</td><td>${l.notes}</td><td class="col-num">${!l.isTicket ? t.toFixed(1) : '-'}</td><td class="col-num" style="color:#cc0000">${l.isTicket ? t.toFixed(1) : '-'}</td></tr>` }).join('')}<tr class="total-row"><td colspan="6" style="text-align:right">TOTALS:</td><td class="col-num">${contractHours.toFixed(1)}</td><td class="col-num" style="color:#cc0000">${ticketHours.toFixed(1)}</td></tr></tbody></table></body></html>`;
        if (Platform.OS === 'web') { const f = document.createElement('iframe'); f.style.position = 'fixed'; f.style.width = '0'; f.style.height = '0'; document.body.appendChild(f); f.contentWindow?.document.write(html); f.contentWindow?.document.close(); setTimeout(() => { f.contentWindow?.print(); setTimeout(() => document.body.removeChild(f), 2000); }, 500); } else { const { uri } = await Print.printToFileAsync({ html }); await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' }); }
    };

    const ColorDot = ({ colorId, active, onPress }: any) => { const c = COLORS.find(x => x.id === colorId) || COLORS[0]; return <TouchableOpacity onPress={onPress} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.code, borderWidth: active ? 2 : 1, borderColor: active ? '#fff' : c.border, marginRight: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 }} />; };
    const RowColorPicker = ({ worker, log }: any) => (<ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2"><View className="flex-row">{COLORS.map(c => <TouchableOpacity key={c.id} onPress={() => updateLog(worker.id, log.id, 'statusColor', c.id)} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.code, borderWidth: 2, borderColor: log.statusColor === c.id ? '#000' : 'transparent', marginRight: 8 }} />)}</View></ScrollView>);
    const renderJobRow = (worker: Worker, log: JobLog) => {
        const currentColor = COLORS.find(c => c.id === log.statusColor) || COLORS[0];
        const rowStyle = { backgroundColor: currentColor.id === 'white' ? '#fff' : currentColor.code + '20', borderColor: currentColor.border };
        const JobSelector = () => (<TouchableOpacity onPress={() => { setPickerTarget({ workerId: worker.id, logId: log.id }); setPickerVisible(true); }} className="bg-white border border-slate-300 rounded-lg px-3 py-2 flex-row justify-between items-center"><Text className={`text-sm font-bold ${log.jobName ? 'text-slate-800' : 'text-slate-400'}`} numberOfLines={1}>{log.jobName || 'Select Job'}</Text><Ionicons name="chevron-down" size={16} color="#64748b" /></TouchableOpacity>);

        if (isMobile) {
            return (
                <View key={log.id} style={rowStyle} className="mb-4 p-3 rounded-xl border">
                    <View className="mb-2"><Text className="text-[10px] text-slate-400 font-bold uppercase mb-1">Job</Text><JobSelector /></View>
                    <View className="flex-row gap-2 mb-2"><View className="flex-1"><Text className="text-[10px] text-slate-400 font-bold uppercase mb-1">Unit</Text><TextInput value={log.unit} onChangeText={t => updateLog(worker.id, log.id, 'unit', t)} className="bg-white border border-slate-300 rounded-lg px-2 py-2 text-sm" /></View><View className="w-24"><Text className="text-[10px] text-slate-400 font-bold uppercase mb-1">PL #</Text><TextInput value={log.plNumber} onChangeText={t => updateLog(worker.id, log.id, 'plNumber', t)} className="bg-white border border-slate-300 rounded-lg px-2 py-2 text-sm" /></View></View>
                    <View className="flex-row gap-2 mb-2"><View className="w-20"><Text className="text-[10px] text-red-500 font-bold uppercase mb-1">Reg</Text><TextInput value={log.regHours} onChangeText={t => updateLog(worker.id, log.id, 'regHours', t)} className="bg-white border border-slate-300 rounded-lg px-2 py-2 text-sm text-center font-bold" keyboardType="numeric" /></View><View className="w-20"><Text className="text-[10px] text-red-600 font-bold uppercase mb-1">OT</Text><TextInput value={log.otHours} onChangeText={t => updateLog(worker.id, log.id, 'otHours', t)} className="bg-white border border-slate-300 rounded-lg px-2 py-2 text-sm text-center font-bold" keyboardType="numeric" /></View><View className="flex-1"><Text className="text-[10px] text-blue-500 font-bold uppercase mb-1">TKT #</Text><TextInput value={log.ticketNumber} onChangeText={t => updateLog(worker.id, log.id, 'ticketNumber', t)} className="bg-white border border-slate-300 rounded-lg px-2 py-2 text-sm" /></View></View>
                    <View className="flex-row gap-4 mb-2 items-center"><TouchableOpacity onPress={() => updateLog(worker.id, log.id, 'isJantile', !log.isJantile)} className="flex-row items-center gap-2"><View className={`w-5 h-5 border rounded justify-center items-center ${log.isJantile ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>{log.isJantile && <Ionicons name="checkmark" size={14} color="white" />}</View><Text className="text-slate-600 font-bold text-xs">Jantile</Text></TouchableOpacity><TouchableOpacity onPress={() => updateLog(worker.id, log.id, 'isTicket', !log.isTicket)} className="flex-row items-center gap-2"><View className={`w-5 h-5 border rounded justify-center items-center ${log.isTicket ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>{log.isTicket && <Ionicons name="checkmark" size={14} color="white" />}</View><Text className="text-slate-600 font-bold text-xs">Ticket</Text></TouchableOpacity></View>
                    <TextInput multiline value={log.notes} onChangeText={t => updateLog(worker.id, log.id, 'notes', t)} placeholder="Notes..." className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-700 mb-2" style={{ height: 40 }} />
                    <RowColorPicker worker={worker} log={log} />
                    <View className="flex-row justify-end gap-3 mt-2 pt-2 border-t border-black/5"><TouchableOpacity onPress={() => duplicateRow(worker.id, log)} className="p-1.5 bg-white border border-slate-200 rounded-lg"><Ionicons name="copy-outline" size={18} color="#3b82f6" /></TouchableOpacity><TouchableOpacity onPress={() => deleteRow(worker.id, log.id)} className="p-1.5 bg-white border border-slate-200 rounded-lg"><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity></View>
                </View>
            );
        }
        return (
            <View key={log.id} style={rowStyle} className="mb-3 p-3 rounded-xl border">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row items-center gap-3 h-12"><View className="w-48"><Text className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Job</Text><JobSelector /></View><View className="w-20"><Text className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">PL #</Text><TextInput value={log.plNumber} onChangeText={(t) => updateLog(worker.id, log.id, 'plNumber', t)} className="border border-slate-300 rounded-lg bg-white px-2 py-1 text-xs h-9" /></View><View className="w-24"><Text className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Unit</Text><TextInput value={log.unit} onChangeText={(t) => updateLog(worker.id, log.id, 'unit', t)} className="border border-slate-300 rounded-lg bg-white px-2 py-1 text-xs h-9" /></View><View className="w-14"><Text className="text-[10px] text-red-400 font-bold uppercase mb-0.5">Reg</Text><TextInput value={log.regHours} onChangeText={(t) => updateLog(worker.id, log.id, 'regHours', t)} className="border border-slate-300 rounded-lg bg-white px-1 py-1 text-xs h-9 text-center font-bold" /></View><View className="w-14"><Text className="text-[10px] text-red-600 font-bold uppercase mb-0.5">OT</Text><TextInput value={log.otHours} onChangeText={(t) => updateLog(worker.id, log.id, 'otHours', t)} className="border border-slate-300 rounded-lg bg-white px-1 py-1 text-xs h-9 text-center font-bold" /></View><View className="w-20"><Text className="text-[10px] text-blue-400 font-bold uppercase mb-0.5">TKT #</Text><TextInput value={log.ticketNumber} onChangeText={(t) => updateLog(worker.id, log.id, 'ticketNumber', t)} className="border border-slate-300 rounded-lg bg-white px-2 py-1 text-xs h-9" /></View><View className="flex-row items-center gap-2 ml-2 mt-4"><TouchableOpacity onPress={() => updateLog(worker.id, log.id, 'isJantile', !log.isJantile)} className="flex-row items-center gap-1"><View className={`w-4 h-4 border rounded justify-center items-center ${log.isJantile ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>{log.isJantile && <Ionicons name="checkmark" size={12} color="white" />}</View><Text className="text-[10px] text-slate-600 font-bold">Jan</Text></TouchableOpacity><TouchableOpacity onPress={() => updateLog(worker.id, log.id, 'isTicket', !log.isTicket)} className="flex-row items-center gap-1"><View className={`w-4 h-4 border rounded justify-center items-center ${log.isTicket ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>{log.isTicket && <Ionicons name="checkmark" size={12} color="white" />}</View><Text className="text-[10px] text-slate-600 font-bold">Tkt</Text></TouchableOpacity></View><View className="mt-4 ml-2"><RowColorPicker worker={worker} log={log} /></View><TouchableOpacity onPress={() => duplicateRow(worker.id, log)} className="ml-3 mt-4 p-1.5 hover:bg-slate-100 rounded-full"><Ionicons name="copy-outline" size={18} color="#3b82f6" /></TouchableOpacity><TouchableOpacity onPress={() => deleteRow(worker.id, log.id)} className="ml-1 mt-4 p-1.5 hover:bg-red-50 rounded-full"><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity></View>
                </ScrollView>
                <TextInput multiline value={log.notes} onChangeText={(t) => updateLog(worker.id, log.id, 'notes', t)} placeholder="Notes..." className="mt-2 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 bg-white" style={{ height: 40 }} />
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50" style={{ paddingTop: Platform.OS === 'android' ? insets.top + 10 : 0 }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* HEADER */}
            <View className="bg-white px-6 py-4 border-b border-slate-200 flex-row justify-between items-center" style={{ marginTop: Platform.OS === 'ios' ? -insets.top : 0, paddingTop: Platform.OS === 'ios' ? insets.top : 20 }}>
                <View className="flex-row items-center gap-3"><View className="bg-purple-100 p-2 rounded-xl"><MaterialCommunityIcons name="calendar-month" size={24} color="#9333ea" /></View><Text className="text-2xl font-bold text-slate-800">Polishers Hub</Text></View>
                <View className="flex-row gap-2">
                    <TouchableOpacity onPress={() => setAddWorkerVisible(true)} className="bg-blue-50 border border-blue-200 flex-row items-center px-3 py-2.5 rounded-lg gap-2">
                        <Ionicons name="add" size={18} color="#2563eb" />
                        {!isMobile && <Text className="text-blue-600 font-bold text-sm">Add Polisher</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={generatePDF} className="bg-slate-800 flex-row items-center px-4 py-2.5 rounded-lg gap-2">
                        <Ionicons name="download-outline" size={18} color="white" />
                        {!isMobile && <Text className="text-white font-medium text-sm">Download Report</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {/* FILTER BAR */}
            <View className="bg-white border-b border-slate-200 px-4 py-3">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 12, paddingRight: 20 }}>
                    <View className="flex-row items-center bg-slate-50 rounded-lg border border-slate-200 p-1"><TouchableOpacity onPress={() => shiftDate(-1)} className="p-2 border-r border-slate-200"><Ionicons name="chevron-back" size={16} color="#64748b" /></TouchableOpacity><View className="px-4"><Text className="text-sm font-bold text-slate-700">{formatDateStr(dateRange.start)} {dateRange.start.getTime() !== dateRange.end.getTime() ? `- ${formatDateStr(dateRange.end)}` : ''}</Text></View><TouchableOpacity onPress={() => shiftDate(1)} className="p-2 border-l border-slate-200"><Ionicons name="chevron-forward" size={16} color="#64748b" /></TouchableOpacity></View>
                    <View className="flex-row bg-slate-50 rounded-lg p-1.5 border border-slate-200">{['Today', 'Yesterday', 'Week', 'Custom'].map(d => (<TouchableOpacity key={d} onPress={() => handleDateTab(d)} className={`px-3 py-1.5 rounded-md ${dateMode === d ? 'bg-white shadow-sm border border-slate-200' : ''}`}><Text className={`text-xs font-medium ${dateMode === d ? 'text-blue-600' : 'text-slate-500'}`}>{d}</Text></TouchableOpacity>))}</View>
                    <View className="h-8 w-px bg-slate-200 mx-2" /><TouchableOpacity onPress={() => setColorFilter(null)} className={`px-2 py-1 rounded border ${!colorFilter ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200'}`}><Text className={`text-xs font-bold ${!colorFilter ? 'text-white' : 'text-slate-500'}`}>All</Text></TouchableOpacity><View className="flex-row gap-1">{COLORS.map(c => <ColorDot key={c.id} colorId={c.id} active={colorFilter === c.id} onPress={() => setColorFilter(colorFilter === c.id ? null : c.id)} />)}</View>
                    <View className="flex-row items-center bg-slate-100 border border-slate-200 rounded-full px-4 py-2 w-48 ml-4"><Ionicons name="search" size={16} color="#94a3b8" /><TextInput placeholder="Search..." value={searchQuery} onChangeText={setSearchQuery} className="flex-1 ml-2 text-sm bg-transparent" style={Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}} /></View>
                </ScrollView>
            </View>

            {/* CONTENT LIST */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                    {displayWorkers.map(worker => {
                        const visibleLogs = worker.visibleLogs;
                        const workerReg = visibleLogs.reduce((acc, l) => acc + (parseFloat(l.regHours) || 0), 0);
                        const workerOT = visibleLogs.reduce((acc, l) => acc + (parseFloat(l.otHours) || 0), 0);
                        return (
                            <View key={worker.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
                                <TouchableOpacity onPress={() => toggleExpand(worker.id)} className="flex-row items-center justify-between p-4 bg-slate-50 border-b border-slate-100"><View className="flex-row items-center gap-4"><View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center"><Text className="text-blue-600 font-bold text-base">{worker.avatar}</Text></View><View><Text className="font-bold text-slate-800 text-sm">{worker.name}</Text><Text className="text-[10px] text-slate-500 font-medium mt-0.5">({workerReg.toFixed(1)} Reg / {workerOT.toFixed(1)} OT)</Text></View></View><Ionicons name={worker.isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#64748b" /></TouchableOpacity>
                                {worker.isExpanded && (<View className="p-4"><View className="items-end mb-3"><TouchableOpacity onPress={() => addJobRow(worker.id)} className="flex-row items-center gap-2 border border-blue-200 bg-blue-50 px-2 py-1.5 rounded-lg"><Ionicons name="add" size={14} color="#2563eb" /><Text className="text-blue-600 text-[10px] font-bold uppercase">Add Job</Text></TouchableOpacity></View>{visibleLogs.length === 0 ? (<View className="items-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200"><Text className="text-slate-400 italic">No logs for this date.</Text></View>) : (visibleLogs.map((log) => renderJobRow(worker, log)))}</View>)}
                            </View>
                        );
                    })}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* FOOTER */}
            <View className="bg-white border-t border-slate-200 px-6 py-4 pb-10 flex-row justify-between items-center shadow-lg">
                {!isMobile && <Text className="text-slate-400 text-xs">Total for {formatDateStr(dateRange.start)}</Text>}
                <View className="flex-row items-end gap-8 flex-1 justify-end"><View className="items-end"><Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contract</Text><Text className="text-lg font-bold text-slate-700">{contractHours.toFixed(1)} <Text className="text-xs font-normal text-slate-400">Hrs</Text></Text></View><View className="items-end"><Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ticket</Text><Text className="text-lg font-bold text-slate-700">{ticketHours.toFixed(1)} <Text className="text-xs font-normal text-slate-400">Hrs</Text></Text></View><View className="items-end"><Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</Text><Text className="text-3xl font-bold text-slate-900">{totalHours.toFixed(1)} <Text className="text-base font-medium text-slate-500">Hrs</Text></Text></View></View>
            </View>

            {/* MODALS */}

            {/* 1. SELECT JOB MODAL */}
            <Modal visible={pickerVisible} animationType="slide" transparent><View className="flex-1 justify-end bg-black/50"><View className="bg-white rounded-t-3xl h-[60%] p-6"><Text className="text-lg font-bold text-slate-800 mb-4">Select Active Job</Text><FlatList data={activeJobs} keyExtractor={item => item.id} renderItem={({ item }) => (<TouchableOpacity onPress={() => selectJobForLog(item.name)} className="p-4 border-b border-slate-100 flex-row justify-between items-center"><Text className="text-base text-slate-700 font-medium">{item.name}</Text><Ionicons name="chevron-forward" size={16} color="#cbd5e1" /></TouchableOpacity>)} /><TouchableOpacity onPress={() => setPickerVisible(false)} className="mt-4 bg-slate-100 p-4 rounded-xl items-center"><Text className="font-bold text-slate-600">Cancel</Text></TouchableOpacity></View></View></Modal>

            {/* 2. CUSTOM DATE MODAL */}
            <Modal visible={customPickerVisible} animationType="fade" transparent><View className="flex-1 justify-center items-center bg-black/50"><View className="bg-white rounded-2xl p-6 w-[90%] max-w-sm shadow-xl"><Text className="text-lg font-bold text-slate-800 mb-2">Select Date Range</Text><Text className="text-xs text-slate-400 mb-4">Tap to select start and end dates.</Text><RangeCalendar startDate={tempRange.start} endDate={tempRange.end} onRangeChange={setTempRange} /><View className="flex-row gap-3 mt-6"><TouchableOpacity onPress={() => setCustomPickerVisible(false)} className="flex-1 bg-slate-100 rounded-lg p-3 items-center"><Text className="text-slate-600 font-bold">Cancel</Text></TouchableOpacity><TouchableOpacity onPress={applyCustomRange} className="flex-1 bg-blue-600 rounded-lg p-3 items-center"><Text className="text-white font-bold">Apply</Text></TouchableOpacity></View></View></View></Modal>

            {/* 3. ADD WORKER MODAL */}
            <Modal visible={addWorkerVisible} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl h-[70%] p-6">
                        <Text className="text-xl font-bold text-slate-800 mb-2">Add Marble Polisher</Text>
                        <Text className="text-sm text-slate-500 mb-4">Select a crew member to add to today's report.</Text>
                        <FlatList
                            data={getAvailablePolishers()}
                            keyExtractor={item => item.id}
                            ListEmptyComponent={<Text className="text-center text-slate-400 py-10">No available Marble Polishers found.</Text>}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => handleAddWorker(item)} className="flex-row items-center gap-4 p-4 border-b border-slate-100">
                                    <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center"><Text className="text-blue-600 font-bold">{item.avatar}</Text></View>
                                    <Text className="text-lg font-bold text-slate-800">{item.name}</Text>
                                    <Ionicons name="add-circle" size={24} color="#2563eb" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity onPress={() => setAddWorkerVisible(false)} className="mt-4 bg-slate-100 p-4 rounded-xl items-center"><Text className="font-bold text-slate-600">Cancel</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}