import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    ActivityIndicator, Image, Platform, Alert
} from 'react-native';
import { ShieldAlert, Plus, Printer, CheckCircle2, MapPin } from 'lucide-react-native';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { SupabaseService } from '../../../services/SupabaseService';
import ReportSafetyIssueModal from '../../modals/ReportSafetyIssueModal';

interface SafetyTabProps {
    job: any;
}

// These types are exclusively for safety issues — used to separate them from job issues
export const SAFETY_TYPES = ['Hazard', 'Near Miss', 'PPE Violation', 'Unsafe Condition', 'Equipment Issue', 'Environmental', 'Other Hazard'];

const PRIORITY_HEX: Record<string, string> = {
    High: '#ef4444',
    Medium: '#f97316',
    Low: '#3b82f6',
};

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

function buildReportHtml(issues: any[], job: any, logoSrc: string): string {
    const openIssues = issues.filter(i => i.status === 'open');
    const resolvedIssues = issues.filter(i => i.status === 'resolved');
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const tableHeaders = `
        <tr style="background:#f8fafc;">
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;text-align:left;">#</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;text-align:left;">Location</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;text-align:left;">Type</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;text-align:left;">Priority</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;text-align:left;">Notes</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;text-align:left;">Reported By</th>
            <th style="padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700;text-align:left;">Date</th>
        </tr>`;

    const issueRows = (list: any[]) => list.map((issue, idx) => {
        const location = [issue.floor_name, issue.unit_name, issue.area_name].filter(Boolean).join(' › ');
        const color = PRIORITY_HEX[issue.priority] ?? '#64748b';
        return `
        <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;font-weight:600;">${idx + 1}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;">${location || '—'}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;">${issue.type}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;">
                <span style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;">${issue.priority}</span>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;max-width:260px;">${issue.description}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;">${issue.created_by}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b;white-space:nowrap;">${new Date(issue.created_at).toLocaleDateString()}</td>
        </tr>`;
    }).join('');

    const openSection = openIssues.length > 0
        ? `<h2 style="color:#dc2626;margin-bottom:12px;">Open Issues (${openIssues.length})</h2>
           <table style="margin-bottom:40px;">${tableHeaders}${issueRows(openIssues)}</table>`
        : `<div style="margin-bottom:40px;padding:24px;background:#f0fdf4;border-radius:12px;text-align:center;color:#16a34a;font-weight:700;">No open issues — site is clear</div>`;

    const resolvedSection = resolvedIssues.length > 0
        ? `<h2 style="color:#16a34a;margin-bottom:12px;">Resolved Issues (${resolvedIssues.length})</h2>
           <table>${tableHeaders}${issueRows(resolvedIssues)}</table>`
        : '';

    return `<!DOCTYPE html>
<html><head>
    <meta charset="UTF-8"/>
    <title>Safety Report — ${job.name}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#fff; color:#1e293b; }
        table { width:100%; border-collapse:collapse; }
        h2 { font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
        @media print { .no-print { display:none!important; } }
    </style>
</head>
<body style="padding:40px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #f1f5f9;">
        ${logoSrc
            ? `<img src="${logoSrc}" style="height:48px;object-fit:contain;" />`
            : `<div style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em;">JANTILE</div>`}
        <div style="text-align:right;">
            <div style="font-size:22px;font-weight:900;color:#0f172a;">Safety Report</div>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">${job.name}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Generated ${dateStr}</div>
        </div>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:32px;">
        <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;">
            <div style="font-size:28px;font-weight:900;color:#dc2626;">${openIssues.length}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#ef4444;margin-top:2px;">Open Issues</div>
        </div>
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;">
            <div style="font-size:28px;font-weight:900;color:#16a34a;">${resolvedIssues.length}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#16a34a;margin-top:2px;">Resolved Issues</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
            <div style="font-size:28px;font-weight:900;color:#0f172a;">${issues.length}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-top:2px;">Total Issues</div>
        </div>
    </div>

    ${openSection}
    ${resolvedSection}

    <div style="margin-top:48px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:10px;color:#94a3b8;text-align:center;">
        Generated by Jantile Tracker &bull; ${dateStr}
    </div>
</body></html>`;
}

export default function SafetyTab({ job }: SafetyTabProps) {
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'open' | 'resolved'>('open');
    const [showReportModal, setShowReportModal] = useState(false);
    const [printing, setPrinting] = useState(false);

    const loadIssues = useCallback(async () => {
        try {
            const data = await SupabaseService.getJobIssues(job.id);
            setIssues(data.filter((i: any) => SAFETY_TYPES.includes(i.type)));
        } catch (err) {
            console.error('Failed to load safety issues:', err);
        } finally {
            setLoading(false);
        }
    }, [job.id]);

    useEffect(() => {
        loadIssues();
    }, [loadIssues]);

    const handleMarkResolved = async (issueId: string) => {
        try {
            await SupabaseService.updateIssueStatus(issueId, 'resolved');
            await loadIssues();
        } catch (err) {
            console.error('Failed to resolve issue:', err);
        }
    };

    const handlePrintReport = async () => {
        if (issues.length === 0) {
            Alert.alert('No Issues', 'There are no safety issues to include in the report.');
            return;
        }
        setPrinting(true);
        try {
            const logoSrc = await getLogoDataUrl();
            const html = buildReportHtml(issues, job, logoSrc);
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

    const filteredIssues = issues.filter(i => i.status === filter);
    const openCount = issues.filter(i => i.status === 'open').length;
    const resolvedCount = issues.filter(i => i.status === 'resolved').length;

    return (
        <View className="flex-1">
            <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Action Row */}
                <View className="flex-row gap-3 mb-6">
                    <TouchableOpacity
                        onPress={() => setShowReportModal(true)}
                        className="flex-1 bg-red-600 h-12 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm"
                    >
                        <Plus size={18} color="white" />
                        <Text className="text-white font-black uppercase text-xs tracking-widest">Report Issue</Text>
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
                    <View className="flex-1 bg-red-50 border border-red-100 rounded-2xl p-4">
                        <Text className="text-3xl font-black text-red-600">{openCount}</Text>
                        <Text className="text-red-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Open</Text>
                    </View>
                    <View className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                        <Text className="text-3xl font-black text-emerald-600">{resolvedCount}</Text>
                        <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Resolved</Text>
                    </View>
                    <View className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <Text className="text-3xl font-black text-slate-700">{issues.length}</Text>
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
                    <ActivityIndicator color="#ef4444" className="py-20" />
                ) : filteredIssues.length === 0 ? (
                    <View className="py-20 items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200">
                        <View className="bg-slate-100 p-5 rounded-full mb-4">
                            <ShieldAlert size={40} color="#94a3b8" />
                        </View>
                        <Text className="text-slate-600 font-bold text-base">
                            {filter === 'open' ? 'No open safety issues' : 'No resolved issues yet'}
                        </Text>
                        <Text className="text-slate-400 text-xs mt-1 text-center px-8">
                            {filter === 'open'
                                ? 'This job site has no active safety concerns.'
                                : 'Resolved issues will appear here once marked.'}
                        </Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap gap-4">
                        {filteredIssues.map(issue => {
                            const location = [issue.floor_name, issue.unit_name, issue.area_name].filter(Boolean);
                            const priorityColor = PRIORITY_HEX[issue.priority] ?? '#64748b';
                            return (
                                <View
                                    key={issue.id}
                                    style={Platform.OS === 'web'
                                        ? { width: 'calc(50% - 8px)', minWidth: 280 } as any
                                        : { width: '100%' }}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                                >
                                    {/* Priority accent bar */}
                                    <View style={{ height: 3, backgroundColor: issue.status === 'open' ? '#ef4444' : '#10b981' }} />

                                    <View className="p-5">
                                        {/* Top row: badges + photo */}
                                        <View className="flex-row items-start justify-between mb-3">
                                            <View className="flex-1 mr-3">
                                                <View className="flex-row items-center gap-2 flex-wrap mb-2">
                                                    <View className={`px-2 py-0.5 rounded border self-start ${issue.status === 'open'
                                                        ? 'bg-red-50 border-red-100'
                                                        : 'bg-emerald-50 border-emerald-100'}`}>
                                                        <Text className={`text-[9px] font-black uppercase ${issue.status === 'open' ? 'text-red-600' : 'text-emerald-700'}`}>
                                                            {issue.status}
                                                        </Text>
                                                    </View>
                                                    <View style={{
                                                        backgroundColor: `${priorityColor}18`,
                                                        borderColor: `${priorityColor}40`,
                                                        borderWidth: 1,
                                                        borderRadius: 4,
                                                        paddingHorizontal: 6,
                                                        paddingVertical: 2,
                                                    }}>
                                                        <Text style={{ color: priorityColor, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>
                                                            {issue.priority}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text className="text-slate-900 font-bold text-base">{issue.type}</Text>
                                            </View>
                                            {issue.photo_url && (
                                                <Image
                                                    source={{ uri: issue.photo_url }}
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

                                        {/* Description */}
                                        <Text className="text-slate-600 text-xs leading-relaxed mb-4" numberOfLines={3}>
                                            {issue.description}
                                        </Text>

                                        {/* Footer */}
                                        <View className="flex-row items-center justify-between pt-3 border-t border-slate-50">
                                            <View>
                                                <Text className="text-slate-400 text-[10px] font-bold uppercase">BY: {issue.created_by}</Text>
                                                <Text className="text-slate-300 text-[10px] mt-0.5">
                                                    {new Date(issue.created_at).toLocaleDateString()}
                                                </Text>
                                            </View>
                                            {issue.status === 'open' && (
                                                <TouchableOpacity
                                                    onPress={() => handleMarkResolved(issue.id)}
                                                    className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 flex-row items-center gap-1.5"
                                                >
                                                    <CheckCircle2 size={12} color="#059669" />
                                                    <Text className="text-emerald-700 text-[10px] font-black uppercase">Mark Resolved</Text>
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

            <ReportSafetyIssueModal
                isVisible={showReportModal}
                onClose={() => setShowReportModal(false)}
                onSuccess={loadIssues}
                jobId={job.id}
                floors={job.floors ?? []}
            />
        </View>
    );
}
