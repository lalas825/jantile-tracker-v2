import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AlertCircle, Camera, Search, Filter, TrendingDown, ClipboardList, MapPin, Truck } from 'lucide-react-native';
import { SupabaseService, formatDisplayDate } from '../../services/SupabaseService';

export default function DiscrepancyHistory() {
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterVendor, setFilterVendor] = useState<string | null>(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const history = await SupabaseService.getProcessedPOs();
            // Extract all claims from processed POs
            const allClaims = history.flatMap((po: any) =>
                (po.discrepancies || []).map((d: any) => ({
                    ...d,
                    po_number: po.po_number,
                    vendor: po.vendor,
                    job_name: po.job_name,
                    received_at: po.received_at,
                    material_name: po.items?.find((i: any) => i.material_id === d.material_id)?.product_name
                }))
            );
            setClaims(allClaims);

            const stats = await SupabaseService.getDiscrepancyAnalytics();
            setAnalytics(stats);
        } catch (err) {
            console.error("Failed to load claims history", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredClaims = useMemo(() => {
        return claims.filter((c: any) => {
            const matchesSearch =
                c.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.job_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.material_name?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesVendor = !filterVendor || c.vendor === filterVendor;
            return matchesSearch && matchesVendor;
        });
    }, [claims, searchQuery, filterVendor]);

    if (loading) return <ActivityIndicator size="large" color="#2563eb" className="mt-20" />;

    return (
        <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 32 }}>
            <View className="flex-row gap-8">
                {/* LEFT COLUMN: ANALYTICS & FILTERS */}
                <View className="w-80 gap-8">
                    {/* VENDOR LEADERBOARD */}
                    <View className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                        <View className="bg-red-50 p-6 flex-row items-center gap-3 border-b border-red-100">
                            <TrendingDown size={20} color="#dc2626" strokeWidth={2.5} />
                            <Text className="text-red-900 font-inter font-black uppercase tracking-tight text-sm">Vendor Damage Ranking</Text>
                        </View>
                        <View className="p-6 gap-4">
                            {(analytics || []).map((v: any, idx: number) => {
                                const rate = ((v.damaged / v.total) * 100).toFixed(0);
                                return (
                                    <View key={v.vendor} className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <Text className="text-slate-300 font-black text-xs">{idx + 1}</Text>
                                            <View>
                                                <Text className="font-bold text-slate-800 text-sm">{v.vendor}</Text>
                                                <Text className="text-[9px] text-slate-400 font-black uppercase">{v.total} Shipments</Text>
                                            </View>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`font-black text-sm ${parseInt(rate) > 20 ? 'text-red-600' : 'text-orange-500'}`}>{rate}%</Text>
                                            <Text className="text-[8px] text-slate-400 font-black uppercase">Failure Rate</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* SEARCH & FILTERS */}
                    <View className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm">
                        <Text className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4">Search Claims</Text>
                        <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 flex-row items-center gap-3 mb-4">
                            <Search size={16} color="#94a3b8" />
                            <TextInput
                                placeholder="PO#, Job, or Vendor..."
                                className="flex-1 text-sm font-bold text-slate-900"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <TouchableOpacity
                            onPress={() => loadData()}
                            className="bg-slate-900 py-4 rounded-xl items-center flex-row justify-center gap-2"
                        >
                            <Ionicons name="refresh" size={16} color="white" />
                            <Text className="text-white font-black uppercase text-xs tracking-widest">Refresh Logs</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* RIGHT COLUMN: LOGS & GALLERY */}
                <View className="flex-1 gap-8">
                    {/* PHOTO GALLERY BAR */}
                    <View className="bg-slate-900 rounded-[32px] p-6 shadow-xl">
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-row items-center gap-3">
                                <Camera size={20} color="white" />
                                <Text className="text-white font-inter font-black uppercase tracking-widest text-sm">Evidence Gallery</Text>
                            </View>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-4">
                            {claims.filter((c: any) => c.photo_url).map((c: any, i: number) => (
                                <TouchableOpacity
                                    key={i}
                                    className="w-24 h-24 bg-white/10 rounded-2xl overflow-hidden border border-white/20"
                                    onPress={() => Alert.alert("Evidence", `Claim for PO #${c.po_number}\nVendor: ${c.vendor}`)}
                                >
                                    <View className="items-center justify-center flex-1">
                                        <Camera size={24} color="#94a3b8" />
                                        <Text className="text-[8px] text-white/40 font-black mt-1 uppercase">Photo_{i + 1}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {claims.filter((c: any) => c.photo_url).length === 0 && (
                                <Text className="text-slate-500 font-bold italic text-xs">No documentation photos logged yet.</Text>
                            )}
                        </ScrollView>
                    </View>

                    {/* CLAIMS FEED */}
                    <View className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm">
                        <View className="p-8 border-b border-slate-100 flex-row justify-between items-center bg-slate-50/30">
                            <View className="flex-row items-center gap-3">
                                <ClipboardList size={20} color="#1e293b" />
                                <Text className="text-slate-900 font-inter font-black uppercase tracking-tight text-lg">Detailed Discrepancy Logs</Text>
                            </View>
                            <View className="bg-slate-200 px-3 py-1 rounded-lg">
                                <Text className="text-slate-600 font-black text-sm">{filteredClaims.length}</Text>
                            </View>
                        </View>

                        <View className="p-8 gap-4">
                            {filteredClaims.map((claim: any, idx: number) => (
                                <View key={claim.id || idx} className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex-row gap-6">
                                    <View className="bg-red-100 w-14 h-14 rounded-2xl items-center justify-center">
                                        <AlertCircle size={28} color="#dc2626" strokeWidth={2.5} />
                                    </View>

                                    <View className="flex-1">
                                        <View className="flex-row justify-between items-start mb-2">
                                            <View>
                                                <Text className="font-black text-slate-900 text-lg">{claim.material_name || 'Unknown Material'}</Text>
                                                <View className="flex-row items-center gap-2">
                                                    <Truck size={12} color="#64748b" />
                                                    <Text className="text-slate-500 font-bold text-xs uppercase">{claim.vendor} • PO #{claim.po_number}</Text>
                                                </View>
                                            </View>
                                            <View className="bg-white border border-red-200 px-3 py-1 rounded-full">
                                                <Text className="text-red-600 font-black text-[10px] uppercase">{claim.condition_flag === 'D' ? 'Damaged' : 'Missing'}</Text>
                                            </View>
                                        </View>

                                        <View className="flex-row items-center gap-4 mb-3">
                                            <View className="flex-row items-center gap-1.5">
                                                <MapPin size={12} color="#94a3b8" />
                                                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{claim.job_name}</Text>
                                            </View>
                                            <Text className="text-[10px] text-slate-300">•</Text>
                                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDisplayDate(claim.received_at)}</Text>
                                        </View>

                                        {claim.notes && (
                                            <View className="bg-white/50 p-4 rounded-xl border border-slate-100">
                                                <Text className="text-slate-600 text-xs italic font-bold">"{claim.notes}"</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View className="items-end gap-2">
                                        <View className="items-end">
                                            <Text className="text-red-700 font-black text-xl">-{claim.difference}</Text>
                                            <Text className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Units Recoverable</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}

                            {filteredClaims.length === 0 && (
                                <View className="py-20 items-center justify-center">
                                    <Text className="text-slate-400 font-bold italic">No claims matched your search criteria.</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}
