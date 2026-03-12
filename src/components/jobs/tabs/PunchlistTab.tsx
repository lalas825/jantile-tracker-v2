import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    ActivityIndicator, Image, Platform, Alert, Modal, Dimensions
} from 'react-native';
import { ClipboardCheck, Plus, Printer, CheckCircle2, MapPin, X, ChevronRight } from 'lucide-react-native';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { SupabaseService } from '../../../services/SupabaseService';
import ReportPunchlistItemModal from '../../modals/ReportPunchlistItemModal';

interface PunchlistTabProps {
    job: any;
}

// Exported so jobs/[id].tsx can exclude these from the Job Issues tab
export const PUNCHLIST_TYPES = [
    'Incomplete Work', 'Damage', 'Wrong Material',
    'Missing Item', 'Quality Issue', 'Touch-Up', 'Other Punch'
];

async function getLogoDataUrl(): Promise<string> {
    try {
        const asset = Asset.fromModule(require('@/assets/images/jantile-logo.png'));
        await asset.downloadAsync();
        if (Platform.OS === 'web') {
            return asset.uri;
        }
        const base64 = await FileSystem.readAsStringAsync(asset.localUri!, {
            encoding: 'base64',
        });
        return `data:image/png;base64,${base64}`;
    } catch {
        return '';
    }
}

function buildReportHtml(items: any[], job: any, logoSrc: string): string {
    const openItems = items.filter(i => i.status === 'open');
    const resolvedItems = items.filter(i => i.status === 'resolved');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const itemCards = (list: any[]) => list.map((item) => {
        const location = [item.floor_name, item.unit_name, item.area_name].filter(Boolean).join(' › ');
        const photoHtml = item.photo_url
            ? `<img src="${item.photo_url}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:10px;" crossorigin="anonymous" />`
            : '';
        return `
        <div style="break-inside:avoid;border:1px solid #fef3c7;border-radius:12px;padding:14px;margin-bottom:12px;background:#fff;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="background:#fefce8;border:1px solid #fde68a;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;color:#d97706;">${item.plNumber}</span>
                <span style="font-size:12px;font-weight:700;color:#334155;">${item.type}</span>
            </div>
            ${photoHtml}
            ${location ? `<div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px;">${location}</div>` : ''}
            <div style="font-size:12px;color:#475569;line-height:1.5;margin-bottom:8px;">${item.description}</div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:6px;">
                <span>${item.created_by}</span>
                <span>${new Date(item.created_at).toLocaleDateString()}</span>
            </div>
        </div>`;
    }).join('');

    const openSection = openItems.length > 0
        ? `<h2 style="color:#d97706;margin-bottom:12px;">Open Items (${openItems.length})</h2>
           <div style="column-count:2;column-gap:16px;margin-bottom:40px;">${itemCards(openItems)}</div>`
        : `<div style="margin-bottom:40px;padding:24px;background:#f0fdf4;border-radius:12px;text-align:center;color:#16a34a;font-weight:700;">All punchlist items resolved</div>`;

    const resolvedSection = resolvedItems.length > 0
        ? `<h2 style="color:#16a34a;margin-bottom:12px;">Resolved Items (${resolvedItems.length})</h2>
           <div style="column-count:2;column-gap:16px;">${itemCards(resolvedItems)}</div>`
        : '';

    return `<!DOCTYPE html>
<html><head>
    <meta charset="UTF-8"/>
    <title>Punchlist Report — ${job.name}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#fff; color:#1e293b; }
        h2 { font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
        @media print { .no-print { display:none!important; } }
    </style>
</head>
<body style="padding:40px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #fef3c7;">
        ${logoSrc
            ? `<img src="${logoSrc}" style="height:48px;object-fit:contain;" />`
            : `<div style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;">JANTILE</div>`}
        <div style="text-align:right;">
            <div style="font-size:22px;font-weight:900;color:#0f172a;">Punchlist Report</div>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">${job.name}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Generated ${dateStr}</div>
        </div>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:32px;">
        <div style="flex:1;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;">
            <div style="font-size:28px;font-weight:900;color:#d97706;">${openItems.length}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#d97706;margin-top:2px;">Open Items</div>
        </div>
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;">
            <div style="font-size:28px;font-weight:900;color:#16a34a;">${resolvedItems.length}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#16a34a;margin-top:2px;">Resolved Items</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
            <div style="font-size:28px;font-weight:900;color:#0f172a;">${items.length}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-top:2px;">Total Items</div>
        </div>
    </div>

    ${openSection}
    ${resolvedSection}

    <div style="margin-top:48px;padding-top:16px;border-top:1px solid #fef3c7;font-size:10px;color:#94a3b8;text-align:center;">
        Generated by Jantile Tracker &bull; ${dateStr}
    </div>
</body></html>`;
}

export default function PunchlistTab({ job }: PunchlistTabProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'open' | 'resolved'>('open');
    const [showModal, setShowModal] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const loadItems = useCallback(async () => {
        try {
            const data = await SupabaseService.getJobIssues(job.id);
            const punchItems = data
                .filter((i: any) => PUNCHLIST_TYPES.includes(i.type))
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((i: any, idx: number) => ({
                    ...i,
                    plNumber: `PL-${String(idx + 1).padStart(3, '0')}`,
                }));
            setItems(punchItems);
        } catch (err) {
            console.error('Failed to load punchlist items:', err);
        } finally {
            setLoading(false);
        }
    }, [job.id]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const handleMarkComplete = async (itemId: string) => {
        try {
            await SupabaseService.updateIssueStatus(itemId, 'resolved');
            setSelectedItem(null);
            await loadItems();
        } catch (err) {
            console.error('Failed to resolve punchlist item:', err);
        }
    };

    const handlePrintReport = async () => {
        if (items.length === 0) {
            Alert.alert('No Items', 'There are no punchlist items to include in the report.');
            return;
        }
        setPrinting(true);
        try {
            const logoSrc = await getLogoDataUrl();
            const html = buildReportHtml(items, job, logoSrc);
            if (Platform.OS === 'web') {
                const win = (window as any).open('', '_blank');
                if (win) {
                    win.document.write(html);
                    win.document.close();
                    win.focus();
                    setTimeout(() => win.print(), 500);
                }
            } else {
                await Print.printAsync({ html });
            }
        } catch (err) {
            console.error('Print failed:', err);
            Alert.alert('Print Error', 'Failed to generate the report. Please try again.');
        } finally {
            setPrinting(false);
        }
    };

    const filteredItems = items.filter(i => i.status === filter);
    const openCount = items.filter(i => i.status === 'open').length;
    const resolvedCount = items.filter(i => i.status === 'resolved').length;
    const { width } = Dimensions.get('window');
    const isDesktop = Platform.OS === 'web' && width > 768;

    return (
        <View className="flex-1">
            <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Action Row */}
                <View className="flex-row gap-3 mb-6">
                    <TouchableOpacity
                        onPress={() => setShowModal(true)}
                        className="flex-1 bg-amber-500 h-12 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm"
                    >
                        <Plus size={18} color="white" />
                        <Text className="text-white font-black uppercase text-xs tracking-widest">Add Item</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handlePrintReport}
                        disabled={printing}
                        className={`h-12 px-5 rounded-2xl flex-row items-center justify-center gap-2 border ${printing ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-200'}`}
                    >
                        {printing ? (
                            <ActivityIndicator size="small" color="#64748b" />
                        ) : (
                            <>
                                <Printer size={16} color="#475569" />
                                <Text className="text-slate-700 font-black uppercase text-xs tracking-widest">Print Report</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <View className="flex-row gap-3 mb-6">
                    <View className="flex-1 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                        <Text className="text-3xl font-black text-amber-600">{openCount}</Text>
                        <Text className="text-amber-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Open</Text>
                    </View>
                    <View className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                        <Text className="text-3xl font-black text-emerald-600">{resolvedCount}</Text>
                        <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Resolved</Text>
                    </View>
                    <View className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <Text className="text-3xl font-black text-slate-700">{items.length}</Text>
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Total</Text>
                    </View>
                </View>

                {/* Filter Tabs */}
                <View className="flex-row mb-6 bg-slate-200/50 p-1 rounded-xl self-start">
                    <TouchableOpacity
                        onPress={() => setFilter('open')}
                        className={`px-6 py-2 rounded-lg ${filter === 'open' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-sm font-bold ${filter === 'open' ? 'text-slate-900' : 'text-slate-500'}`}>
                            Open ({openCount})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setFilter('resolved')}
                        className={`px-6 py-2 rounded-lg ${filter === 'resolved' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-sm font-bold ${filter === 'resolved' ? 'text-slate-900' : 'text-slate-500'}`}>
                            Resolved ({resolvedCount})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {loading ? (
                    <ActivityIndicator color="#f59e0b" className="py-20" />
                ) : filteredItems.length === 0 ? (
                    <View className="py-20 items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200">
                        <View className="bg-amber-50 p-5 rounded-full mb-4">
                            <ClipboardCheck size={40} color="#f59e0b" />
                        </View>
                        <Text className="text-slate-600 font-bold text-base">
                            {filter === 'open' ? 'No open punchlist items' : 'No resolved items yet'}
                        </Text>
                        <Text className="text-slate-400 text-xs mt-1 text-center px-8">
                            {filter === 'open'
                                ? 'All items are complete — great work!'
                                : 'Completed items will appear here.'}
                        </Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap gap-4">
                        {filteredItems.map(item => {
                            const location = [item.floor_name, item.unit_name, item.area_name].filter(Boolean);
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => setSelectedItem(item)}
                                    activeOpacity={0.7}
                                    style={isDesktop
                                        ? { width: 'calc(33.33% - 11px)', minWidth: 260 } as any
                                        : { width: '100%' }}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                                >
                                    {/* Amber accent bar */}
                                    <View style={{ height: 3, backgroundColor: item.status === 'open' ? '#f59e0b' : '#10b981' }} />

                                    {/* Photo thumbnail */}
                                    {item.photo_url && (
                                        <Image
                                            source={{ uri: item.photo_url }}
                                            style={{ width: '100%', height: 120 }}
                                            resizeMode="cover"
                                        />
                                    )}

                                    <View className="p-4">
                                        {/* PL# + status */}
                                        <View className="flex-row items-center gap-2 flex-wrap mb-2">
                                            <View className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                                <Text className="text-amber-700 text-xs font-black tracking-widest">{item.plNumber}</Text>
                                            </View>
                                            <View className={`px-2 py-0.5 rounded border ${item.status === 'open'
                                                ? 'bg-amber-50 border-amber-100'
                                                : 'bg-emerald-50 border-emerald-100'}`}>
                                                <Text className={`text-[9px] font-black uppercase ${item.status === 'open' ? 'text-amber-600' : 'text-emerald-700'}`}>
                                                    {item.status === 'open' ? 'Open' : 'Resolved'}
                                                </Text>
                                            </View>
                                            <View className="flex-1" />
                                            <ChevronRight size={14} color="#cbd5e1" />
                                        </View>

                                        <Text className="text-slate-900 font-bold text-sm mb-1">{item.type}</Text>

                                        {/* Location */}
                                        {location.length > 0 && (
                                            <View className="flex-row items-center gap-1.5 mb-1.5">
                                                <MapPin size={10} color="#94a3b8" />
                                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest" numberOfLines={1}>
                                                    {location.join(' › ')}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Notes */}
                                        <Text className="text-slate-500 text-xs leading-relaxed" numberOfLines={2}>
                                            {item.description}
                                        </Text>

                                        {/* Footer */}
                                        <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-slate-50">
                                            <Text className="text-slate-300 text-[10px] font-bold">{item.created_by}</Text>
                                            <Text className="text-slate-300 text-[10px]">
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Detail Modal */}
            <Modal visible={!!selectedItem} animationType="fade" transparent>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl overflow-hidden shadow-2xl" style={isDesktop ? { width: 520 } : { width: '100%', maxWidth: 420 }}>
                        {/* Photo */}
                        {selectedItem?.photo_url && (
                            <Image
                                source={{ uri: selectedItem.photo_url }}
                                style={{ width: '100%', height: 240 }}
                                resizeMode="cover"
                            />
                        )}

                        <View className="p-6">
                            {/* Header */}
                            <View className="flex-row items-center justify-between mb-4">
                                <View className="flex-row items-center gap-2">
                                    <View className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                                        <Text className="text-amber-700 text-sm font-black tracking-widest">{selectedItem?.plNumber}</Text>
                                    </View>
                                    <View className={`px-2.5 py-1 rounded border ${selectedItem?.status === 'open'
                                        ? 'bg-amber-50 border-amber-100'
                                        : 'bg-emerald-50 border-emerald-100'}`}>
                                        <Text className={`text-[10px] font-black uppercase ${selectedItem?.status === 'open' ? 'text-amber-600' : 'text-emerald-700'}`}>
                                            {selectedItem?.status === 'open' ? 'Open' : 'Resolved'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedItem(null)} className="p-2 bg-slate-100 rounded-full">
                                    <X size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <Text className="text-slate-900 font-black text-lg mb-2">{selectedItem?.type}</Text>

                            {/* Location */}
                            {selectedItem && [selectedItem.floor_name, selectedItem.unit_name, selectedItem.area_name].filter(Boolean).length > 0 && (
                                <View className="flex-row items-center gap-1.5 mb-3">
                                    <MapPin size={12} color="#94a3b8" />
                                    <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                        {[selectedItem.floor_name, selectedItem.unit_name, selectedItem.area_name].filter(Boolean).join(' › ')}
                                    </Text>
                                </View>
                            )}

                            {/* Description */}
                            <Text className="text-slate-600 text-sm leading-relaxed mb-4">{selectedItem?.description}</Text>

                            {/* Meta */}
                            <View className="flex-row justify-between pt-3 border-t border-slate-100 mb-5">
                                <Text className="text-slate-400 text-xs font-bold">BY: {selectedItem?.created_by}</Text>
                                <Text className="text-slate-400 text-xs">{selectedItem ? new Date(selectedItem.created_at).toLocaleDateString() : ''}</Text>
                            </View>

                            {/* Actions */}
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => setSelectedItem(null)}
                                    className="flex-1 h-12 rounded-2xl items-center justify-center bg-slate-100 border border-slate-200"
                                >
                                    <Text className="text-slate-600 font-black uppercase text-xs tracking-widest">Close</Text>
                                </TouchableOpacity>
                                {selectedItem?.status === 'open' && (
                                    <TouchableOpacity
                                        onPress={() => handleMarkComplete(selectedItem.id)}
                                        className="flex-1 h-12 rounded-2xl flex-row items-center justify-center gap-2 bg-emerald-500"
                                    >
                                        <CheckCircle2 size={16} color="white" />
                                        <Text className="text-white font-black uppercase text-xs tracking-widest">Complete</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <ReportPunchlistItemModal
                isVisible={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={loadItems}
                jobId={job.id}
                floors={job.floors ?? []}
            />
        </View>
    );
}
