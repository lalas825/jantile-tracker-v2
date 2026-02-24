import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    ActivityIndicator, Image, Platform, Alert
} from 'react-native';
import { AlertTriangle, Plus, Printer, CheckCircle2, MapPin } from 'lucide-react-native';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { SupabaseService } from '../../../services/SupabaseService';
import ReportDeficiencyModal from '../../modals/ReportDeficiencyModal';

interface DeficientTabProps {
    job: any;
}

// Exported so jobs/[id].tsx can exclude these from the Job Issues tab
export const DEFICIENT_TYPES = [
    'Missing Prep Work', 'Broken Substrate', 'Plumbing Issue',
    'Structural Issue', 'Water Damage', 'Access Blocked', 'Other Deficiency'
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

    const tableHeaders = `
        <tr style="background:#fff7ed;">
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#c2410c;font-weight:700;text-align:left;">DL#</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#c2410c;font-weight:700;text-align:left;">Location</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#c2410c;font-weight:700;text-align:left;">Type</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#c2410c;font-weight:700;text-align:left;">Notes</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#c2410c;font-weight:700;text-align:left;">Reported By</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#c2410c;font-weight:700;text-align:left;">Date</th>
        </tr>`;

    const itemRows = (list: any[]) => list.map((item) => {
        const location = [item.floor_name, item.unit_name, item.area_name].filter(Boolean).join(' › ');
        return `
        <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #fed7aa;font-size:12px;font-weight:800;color:#ea580c;">${item.dlNumber}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fed7aa;font-size:12px;color:#334155;">${location || '—'}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fed7aa;font-size:12px;color:#334155;">${item.type}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fed7aa;font-size:12px;color:#475569;max-width:260px;">${item.description}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fed7aa;font-size:11px;color:#64748b;">${item.created_by}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fed7aa;font-size:11px;color:#64748b;white-space:nowrap;">${new Date(item.created_at).toLocaleDateString()}</td>
        </tr>`;
    }).join('');

    const openSection = openItems.length > 0
        ? `<h2 style="color:#ea580c;margin-bottom:12px;">Open Items (${openItems.length})</h2>
           <table style="margin-bottom:40px;">${tableHeaders}${itemRows(openItems)}</table>`
        : `<div style="margin-bottom:40px;padding:24px;background:#f0fdf4;border-radius:12px;text-align:center;color:#16a34a;font-weight:700;">All deficient items resolved</div>`;

    const resolvedSection = resolvedItems.length > 0
        ? `<h2 style="color:#16a34a;margin-bottom:12px;">Resolved Items (${resolvedItems.length})</h2>
           <table>${tableHeaders}${itemRows(resolvedItems)}</table>`
        : '';

    return `<!DOCTYPE html>
<html><head>
    <meta charset="UTF-8"/>
    <title>Deficient List Report — ${job.name}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#fff; color:#1e293b; }
        table { width:100%; border-collapse:collapse; }
        h2 { font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
        @media print { .no-print { display:none!important; } }
    </style>
</head>
<body style="padding:40px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #fed7aa;">
        ${logoSrc
            ? `<img src="${logoSrc}" style="height:48px;object-fit:contain;" />`
            : `<div style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;">JANTILE</div>`}
        <div style="text-align:right;">
            <div style="font-size:22px;font-weight:900;color:#0f172a;">Deficient List Report</div>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">${job.name}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Generated ${dateStr}</div>
        </div>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:32px;">
        <div style="flex:1;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;">
            <div style="font-size:28px;font-weight:900;color:#ea580c;">${openItems.length}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#ea580c;margin-top:2px;">Open Items</div>
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

    <div style="margin-top:48px;padding-top:16px;border-top:1px solid #fed7aa;font-size:10px;color:#94a3b8;text-align:center;">
        Generated by Jantile Tracker &bull; ${dateStr}
    </div>
</body></html>`;
}

export default function DeficientTab({ job }: DeficientTabProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'open' | 'resolved'>('open');
    const [showModal, setShowModal] = useState(false);
    const [printing, setPrinting] = useState(false);

    const loadItems = useCallback(async () => {
        try {
            const data = await SupabaseService.getJobIssues(job.id);
            const defItems = data
                .filter((i: any) => DEFICIENT_TYPES.includes(i.type))
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((i: any, idx: number) => ({
                    ...i,
                    dlNumber: `DL-${String(idx + 1).padStart(3, '0')}`,
                }));
            setItems(defItems);
        } catch (err) {
            console.error('Failed to load deficient items:', err);
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
            await loadItems();
        } catch (err) {
            console.error('Failed to resolve deficient item:', err);
        }
    };

    const handlePrintReport = async () => {
        if (items.length === 0) {
            Alert.alert('No Items', 'There are no deficient items to include in the report.');
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

    return (
        <View className="flex-1">
            <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Action Row */}
                <View className="flex-row gap-3 mb-6">
                    <TouchableOpacity
                        onPress={() => setShowModal(true)}
                        className="flex-1 bg-orange-500 h-12 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm"
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
                    <View className="flex-1 bg-orange-50 border border-orange-100 rounded-2xl p-4">
                        <Text className="text-3xl font-black text-orange-600">{openCount}</Text>
                        <Text className="text-orange-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Open</Text>
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
                    <ActivityIndicator color="#f97316" className="py-20" />
                ) : filteredItems.length === 0 ? (
                    <View className="py-20 items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200">
                        <View className="bg-orange-50 p-5 rounded-full mb-4">
                            <AlertTriangle size={40} color="#f97316" />
                        </View>
                        <Text className="text-slate-600 font-bold text-base">
                            {filter === 'open' ? 'No open deficiencies' : 'No resolved items yet'}
                        </Text>
                        <Text className="text-slate-400 text-xs mt-1 text-center px-8">
                            {filter === 'open'
                                ? 'All site conditions are ready — great job!'
                                : 'Completed items will appear here.'}
                        </Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap gap-4">
                        {filteredItems.map(item => {
                            const location = [item.floor_name, item.unit_name, item.area_name].filter(Boolean);
                            return (
                                <View
                                    key={item.id}
                                    style={Platform.OS === 'web'
                                        ? { width: 'calc(50% - 8px)', minWidth: 280 } as any
                                        : { width: '100%' }}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                                >
                                    {/* Orange accent bar */}
                                    <View style={{ height: 3, backgroundColor: item.status === 'open' ? '#f97316' : '#10b981' }} />

                                    <View className="p-5">
                                        {/* Top row: DL# + type + photo */}
                                        <View className="flex-row items-start justify-between mb-3">
                                            <View className="flex-1 mr-3">
                                                <View className="flex-row items-center gap-2 flex-wrap mb-2">
                                                    {/* DL# Badge */}
                                                    <View className="bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                                                        <Text className="text-orange-700 text-xs font-black tracking-widest">{item.dlNumber}</Text>
                                                    </View>
                                                    {/* Status badge */}
                                                    <View className={`px-2 py-0.5 rounded border self-start ${item.status === 'open'
                                                        ? 'bg-orange-50 border-orange-100'
                                                        : 'bg-emerald-50 border-emerald-100'}`}>
                                                        <Text className={`text-[9px] font-black uppercase ${item.status === 'open' ? 'text-orange-600' : 'text-emerald-700'}`}>
                                                            {item.status === 'open' ? 'Open' : 'Resolved'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text className="text-slate-900 font-bold text-base">{item.type}</Text>
                                            </View>
                                            {item.photo_url && (
                                                <Image
                                                    source={{ uri: item.photo_url }}
                                                    style={{ width: 56, height: 56, borderRadius: 10 }}
                                                    resizeMode="cover"
                                                />
                                            )}
                                        </View>

                                        {/* Location breadcrumb */}
                                        {location.length > 0 && (
                                            <View className="flex-row items-center gap-1.5 mb-2">
                                                <MapPin size={11} color="#94a3b8" />
                                                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                                    {location.join(' › ')}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Notes */}
                                        <Text className="text-slate-600 text-xs leading-relaxed mb-4" numberOfLines={3}>
                                            {item.description}
                                        </Text>

                                        {/* Footer */}
                                        <View className="flex-row items-center justify-between pt-3 border-t border-slate-50">
                                            <View>
                                                <Text className="text-slate-400 text-[10px] font-bold uppercase">BY: {item.created_by}</Text>
                                                <Text className="text-slate-300 text-[10px] mt-0.5">
                                                    {new Date(item.created_at).toLocaleDateString()}
                                                </Text>
                                            </View>
                                            {item.status === 'open' && (
                                                <TouchableOpacity
                                                    onPress={() => handleMarkComplete(item.id)}
                                                    className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 flex-row items-center gap-1.5"
                                                >
                                                    <CheckCircle2 size={12} color="#059669" />
                                                    <Text className="text-emerald-700 text-[10px] font-black uppercase">Mark Complete</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <ReportDeficiencyModal
                isVisible={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={loadItems}
                jobId={job.id}
                floors={job.floors ?? []}
            />
        </View>
    );
}
