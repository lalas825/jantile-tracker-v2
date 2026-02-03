import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService, ProjectMaterial, DeliveryTicket } from '../../services/SupabaseService';
import { randomUUID } from 'expo-crypto';
import { usePowerSync } from '@powersync/react';
import AddBudgetItemModal from '../logistics/AddBudgetItemModal';
import DeliveryTicketModal from '../logistics/DeliveryTicketModal';

interface OfficeTabProps {
    job: any;
}

export default function OfficeTab({ job }: OfficeTabProps) {
    const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
    const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const powersync = usePowerSync();
    const status = powersync?.currentStatus;

    // Modal States
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [ticketVisible, setTicketVisible] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<ProjectMaterial | null>(null);
    const [viewMode, setViewMode] = useState<'area' | 'global'>('area');
    const [lockedAreaId, setLockedAreaId] = useState<string | undefined>(undefined);
    const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});

    const allUnits = useMemo(() => {
        return job.floors?.flatMap((f: any) => f.units || []) || [];
    }, [job]);

    // Collapsible States
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'TILE & STONE': true,
        'SETTING MATERIALS & SUNDRIES': true,
        'DELIVERY MANAGEMENT': true
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const toggleArea = (areaId: string) => {
        setExpandedAreas(prev => ({ ...prev, [areaId]: !prev[areaId] }));
    };

    const loadData = async () => {
        try {
            const [mats, tkts] = await Promise.all([
                SupabaseService.getProjectMaterials(job.id),
                SupabaseService.getDeliveryTickets(job.id)
            ]);
            setMaterials(mats);
            setTickets(tkts);
        } catch (err) {
            console.error("OfficeTab Load Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [job.id]);

    const handleSaveMaterial = async (materialData: any) => {
        try {
            const db = powersync;
            const { _new_area, ...materialPayload } = materialData;

            if (_new_area && db) {
                // Atomic Area + Material creation
                await db.writeTransaction(async (tx) => {
                    const areaId = materialData.area_id || randomUUID();
                    const now = new Date().toISOString();

                    // 1. Create Unit (if needed) & Area
                    let finalUnitId = _new_area.unit_id;

                    if (_new_area._new_unit_name) {
                        const firstFloorId = job.floors?.[0]?.id;
                        if (!firstFloorId) throw new Error("Job must have at least one floor to create a unit");

                        finalUnitId = randomUUID();
                        await tx.execute(
                            `INSERT INTO units (id, floor_id, name, created_at) VALUES (?, ?, ?, ?)`,
                            [finalUnitId, firstFloorId, _new_area._new_unit_name, now]
                        );
                    }

                    await tx.execute(
                        `INSERT INTO areas (id, unit_id, name, status, progress, created_at) VALUES (?, ?, ?, 'NOT_STARTED', 0, ?)`,
                        [areaId, finalUnitId, _new_area.name, now]
                    );

                    // 2. Create Material linked to new area
                    const materialId = materialData.id || randomUUID();
                    const finalPayload = { ...materialPayload, id: materialId, area_id: areaId, job_id: job.id };

                    await tx.execute(
                        `INSERT INTO project_materials (
                            id, job_id, area_id, sub_location, category, product_code, product_name, product_specs, zone, 
                            net_qty, waste_percent, budget_qty, unit_cost, total_value, ordered_qty, shop_stock, in_transit, 
                            received_at_job, unit, pcs_per_unit, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            finalPayload.id, finalPayload.job_id, finalPayload.area_id, finalPayload.sub_location || null, finalPayload.category,
                            finalPayload.product_code || null, finalPayload.product_name, finalPayload.product_specs || null, finalPayload.zone || null,
                            finalPayload.net_qty || 0, finalPayload.waste_percent || 10, finalPayload.budget_qty || 0,
                            finalPayload.unit_cost || 0, finalPayload.total_value || 0,
                            finalPayload.ordered_qty || 0, finalPayload.shop_stock || 0, finalPayload.in_transit || 0,
                            finalPayload.received_at_job || 0, finalPayload.unit || 'sqft', finalPayload.pcs_per_unit || 1,
                            now
                        ]
                    );
                });
            } else {
                let areaId = materialData.area_id;
                if (_new_area) {
                    let finalUnitId = _new_area.unit_id;
                    if (_new_area._new_unit_name) {
                        const firstFloorId = job.floors?.[0]?.id;
                        if (!firstFloorId) throw new Error("Job must have at least one floor to create a unit");
                        finalUnitId = await SupabaseService.addUnit(firstFloorId, _new_area._new_unit_name);
                    }
                    areaId = await SupabaseService.addArea(finalUnitId, _new_area.name);
                }

                await SupabaseService.saveProjectMaterial({
                    ...materialPayload,
                    area_id: areaId,
                    job_id: job.id
                });
            }
            setAddModalVisible(false);
            setLockedAreaId(undefined);
            setSelectedMaterial(null);
            await loadData();
        } catch (err: any) {
            console.error("Save Material Error:", err);
            const msg = err.message || err.details || JSON.stringify(err);
            alert(`Failed to save material: ${msg}`);
        }
    };

    const handleDeleteTicket = async (id: string) => {
        if (!confirm("Are you sure you want to delete this ticket?")) return;
        try {
            await SupabaseService.deleteDeliveryTicket(id);
            await loadData();
        } catch (err) {
            console.error("Delete Ticket Error:", err);
            alert("Failed to delete ticket");
        }
    };

    const handleDeleteMaterial = async (id: string) => {
        if (!confirm("GLOBAL IMPACT WARNING: deleting this item will remove it from the project budget and procurement totals. Proceed?")) return;
        try {
            await SupabaseService.deleteProjectMaterial(id);
            await loadData();
        } catch (err) {
            console.error("Delete Error:", err);
            alert("Failed to delete item");
        }
    };

    const handleDeleteArea = async (areaId: string) => {
        const area = allAreas.find((a: any) => a.id === areaId);
        const name = area?.name || "this area";
        if (!confirm(`GLOBAL IMPACT WARNING: deleting "${name}" will permanently remove all associated budget items and reduce project-wide procurement counts. Proceed?`)) return;

        try {
            await SupabaseService.deleteArea(areaId);
            await loadData();
        } catch (err) {
            console.error("Delete Area Error:", err);
            alert("Failed to delete area");
        }
    };

    const categories = [
        { label: 'TILE & STONE', tags: ['Tile', 'Stone'] },
        { label: 'SETTING MATERIALS & SUNDRIES', tags: ['Setting Materials', 'Sundries', 'Misc'] }
    ];

    const getMaterialsForGroup = (tags: string[]) => {
        return materials.filter(m => tags.includes(m.category));
    };

    const getGroupTotal = (tags: string[]) => {
        return getMaterialsForGroup(tags).reduce((sum, m) => sum + (m.total_value || 0), 0);
    };

    const aggregatedMaterials = useMemo(() => {
        const groups: Record<string, any> = {};
        materials.forEach(m => {
            const key = m.product_code || m.product_name;
            if (!groups[key]) {
                groups[key] = {
                    ...m,
                    net_qty: 0,
                    waste_qty: 0,
                    budget_qty: 0,
                    ordered_qty: 0,
                    shop_stock: 0,
                    in_transit: 0,
                    received_at_job: 0,
                    total_value: 0,
                    supplier: m.supplier, // Pass supplier through
                    // Capture dims from first item that has them
                    dim_length: m.dim_length,
                    dim_width: m.dim_width,
                    dim_thickness: m.dim_thickness,
                    // Arrays to collect unique locs/zones
                    locations: new Set<string>(),
                    zones: new Set<string>()
                };
            }
            if (m.sub_location) groups[key].locations.add(m.sub_location);
            if (m.zone) groups[key].zones.add(m.zone);

            groups[key].net_qty += m.net_qty || 0;
            groups[key].waste_qty += (m.net_qty || 0) * ((m.waste_percent || 0) / 100);
            groups[key].budget_qty += m.budget_qty || 0;
            groups[key].ordered_qty += m.ordered_qty || 0;
            groups[key].shop_stock += m.shop_stock || 0;
            groups[key].in_transit += m.in_transit || 0;
            groups[key].received_at_job += m.received_at_job || 0;
            // Total Project Value is aggregate of (Area Budget * Unit Cost)
            groups[key].total_value += (m.budget_qty || 0) * (m.unit_cost || 0);
        });
        return Object.values(groups);
    }, [materials]);

    const materialsByArea = useMemo(() => {
        const groups: Record<string, ProjectMaterial[]> = {};
        materials.forEach(m => {
            const key = m.area_id || 'unassigned';
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        return groups;
    }, [materials]);

    const allAreas = job.floors?.flatMap((f: any) =>
        f.units?.flatMap((u: any) => u.areas || []) || []
    ) || [];

    if (loading) return <ActivityIndicator className="py-20" color="#3b82f6" />;

    return (
        <ScrollView className="flex-1 bg-slate-100">
            {/* TOP HEADER */}
            <View className="p-8 pb-4 flex-row justify-between items-start">
                <View>
                    <View className="flex-row items-center gap-4 mb-1">
                        <Text className="text-3xl font-inter font-black text-slate-900 tracking-tight">Office Logistics</Text>
                        <View className="flex-row bg-slate-200 p-1 rounded-xl">
                            <TouchableOpacity
                                onPress={() => setViewMode('area')}
                                className={`px-4 py-1.5 rounded-lg flex-row items-center gap-2 ${viewMode === 'area' ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Ionicons name="grid-outline" size={14} color={viewMode === 'area' ? '#3b82f6' : '#64748b'} />
                                <Text className={`text-[10px] font-inter font-black uppercase tracking-widest ${viewMode === 'area' ? 'text-blue-600' : 'text-slate-500'}`}>Area-First</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setViewMode('global')}
                                className={`px-4 py-1.5 rounded-lg flex-row items-center gap-2 ${viewMode === 'global' ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Ionicons name="globe-outline" size={14} color={viewMode === 'global' ? '#3b82f6' : '#64748b'} />
                                <Text className={`text-[10px] font-inter font-black uppercase tracking-widest ${viewMode === 'global' ? 'text-blue-600' : 'text-slate-500'}`}>Global Hub</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text className="text-slate-500 font-inter font-bold text-sm">{job.name}</Text>
                </View>

                <View className="flex-row gap-3">
                    <TouchableOpacity className="bg-white px-5 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2 shadow-sm">
                        <Ionicons name="cloud-upload-outline" size={18} color="#64748b" />
                        <Text className="text-slate-600 font-inter font-bold">Import CSV</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            setSelectedMaterial(null);
                            setAddModalVisible(true);
                        }}
                        className="bg-white px-5 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2 shadow-sm"
                    >
                        <Ionicons name="add" size={20} color="#64748b" />
                        <Text className="text-slate-600 font-inter font-bold">Add Item</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setTicketVisible(true)}
                        className="bg-blue-600 px-6 py-2.5 rounded-xl flex-row items-center gap-2 shadow-lg shadow-blue-200"
                    >
                        <Ionicons name="document-text" size={20} color="white" />
                        <Text className="text-white font-inter font-black uppercase tracking-widest text-xs">Create Ticket</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* MATERIAL BUDGET SECTION */}
            <View className="px-8 mt-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-lg font-inter font-black text-slate-900 tracking-tight">Material Budget</Text>
                    <View className="flex-row items-center bg-white px-4 py-2 rounded-xl border border-slate-200 w-64 shadow-sm">
                        <Ionicons name="search" size={16} color="#94a3b8" />
                        <TextInput className="ml-2 text-sm text-slate-900 font-inter font-bold flex-1" placeholder="Search products..." />
                    </View>
                </View>

                {viewMode === 'global' ? (
                    categories.map(group => {
                        const groupMats = aggregatedMaterials.filter(m => group.tags.includes(m.category));
                        const total = groupMats.reduce((sum, m) => sum + (m.total_value || 0), 0);
                        const isExpanded = expandedSections[group.label];

                        return (
                            <View key={group.label} className="bg-white rounded-2xl border border-slate-200 mb-6 overflow-hidden shadow-sm">
                                <TouchableOpacity
                                    onPress={() => toggleSection(group.label)}
                                    className="p-5 flex-row justify-between items-center border-b border-slate-50"
                                >
                                    <View className="flex-row items-center gap-3">
                                        <View className="bg-blue-50 p-1.5 rounded-lg">
                                            <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={16} color="#2563eb" />
                                        </View>
                                        <Text className="font-inter font-black text-slate-800 tracking-widest text-xs uppercase">{group.label} (PROJECT TOTALS)</Text>
                                    </View>
                                    <View className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                        <Text className="text-emerald-700 font-inter font-black text-xs">Total: ${total.toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View>
                                        {/* GLOBAL TABLE HEADERS */}
                                        <View className="flex-row px-3 py-2 bg-slate-50 border-b border-slate-100 items-center">
                                            <Text className="flex-[1.5] text-[12px] font-inter font-black text-slate-400 uppercase px-2">Loc / Zone</Text>
                                            <Text className="flex-[2] text-[12px] font-inter font-black text-slate-400 uppercase px-2">Material</Text>
                                            <Text className="flex-1 text-[12px] font-inter font-black text-slate-400 uppercase text-center">Dims</Text>
                                            <Text className="flex-1 text-[12px] font-inter font-black text-slate-400 uppercase text-center">Unit Cost</Text>
                                            <Text className="flex-1 text-[12px] font-inter font-black text-slate-400 uppercase text-center">Total Value</Text>
                                            <Text className="flex-[0.8] text-[12px] font-inter font-black text-blue-600 uppercase text-center">Stock</Text>
                                            <Text className="flex-[0.8] text-[12px] font-inter font-black text-orange-500 uppercase text-center">Transit</Text>
                                            <Text className="flex-1 text-[12px] font-inter font-black text-orange-400 uppercase text-center">Expected</Text>
                                            <Text className="flex-[0.8] text-[12px] font-inter font-black text-emerald-600 uppercase text-center">Recv.</Text>
                                            <Text className="flex-[0.8] text-[12px] font-inter font-black text-slate-900 uppercase text-center">To Buy</Text>
                                            <Text className="flex-[1.2] text-[12px] font-inter font-black text-slate-500 uppercase text-center">Supplier</Text>
                                            <View className="w-24" />
                                        </View>

                                        {groupMats.length === 0 ? (
                                            <View className="p-12 items-center">
                                                <Text className="text-slate-400 font-bold">No global totals for this category</Text>
                                            </View>
                                        ) : (
                                            groupMats.map(m => {
                                                const toBuy = Math.max(0, m.budget_qty - (m.shop_stock + m.in_transit));
                                                return (
                                                    <View key={m.product_code || m.product_name} className="flex-row px-3 py-2 border-b border-slate-50 items-center">
                                                        <View className="flex-[1.5] px-2">
                                                            <Text className="text-[14px] font-inter font-black text-slate-700 leading-tight" numberOfLines={2}>
                                                                {Array.from(m.locations || []).join(', ') || 'Global'}
                                                            </Text>
                                                            <Text className="text-[12px] font-inter text-slate-400 leading-tight" numberOfLines={1}>
                                                                {Array.from(m.zones || []).join(', ') || '-'}
                                                            </Text>
                                                        </View>
                                                        <View className="flex-[2] px-2">
                                                            <Text className="font-inter font-black text-slate-900 text-[17px] leading-tight" numberOfLines={1}>{m.product_code || 'N/A'}</Text>
                                                            <Text className="text-[14px] text-slate-400 font-inter font-bold" numberOfLines={1}>{m.product_name}</Text>
                                                        </View>
                                                        <View className="flex-1 items-center px-1">
                                                            <Text className="text-[12px] font-inter font-black text-slate-700 text-center">
                                                                {m.dim_length ? `${m.dim_length}"x${m.dim_width}"` : '-'}
                                                            </Text>
                                                            {m.dim_thickness ? <Text className="text-[9px] text-slate-400">{m.dim_thickness}"</Text> : null}
                                                        </View>
                                                        <View className="flex-1 items-center px-1">
                                                            <Text className="text-[15px] text-slate-600 font-inter font-bold text-center">${(m.unit_cost || 0).toFixed(2)}</Text>
                                                            <Text className="text-[10px] text-slate-400 font-bold uppercase">{m.unit}</Text>
                                                        </View>
                                                        <View className="flex-1 items-center px-1">
                                                            <Text className="text-[17px] font-inter font-black text-slate-900 text-center">${(m.total_value || 0).toLocaleString()}</Text>
                                                        </View>
                                                        <View className="flex-[0.8] items-center">
                                                            <Text className="text-[17px] font-inter font-black text-blue-700">{m.shop_stock.toLocaleString()}</Text>
                                                        </View>
                                                        <View className="flex-[0.8] items-center">
                                                            <Text className="text-[17px] font-inter font-black text-orange-500">{m.in_transit.toLocaleString()}</Text>
                                                        </View>
                                                        <View className="flex-1 items-center px-1">
                                                            <Text className="text-[14px] text-slate-500 font-inter font-bold text-center">{m.in_transit > 0 ? (m.expected_date || 'TBD') : '--'}</Text>
                                                        </View>
                                                        <View className="flex-[0.8] items-center">
                                                            <Text className="text-[17px] font-inter font-black text-emerald-600">{m.received_at_job.toLocaleString()}</Text>
                                                        </View>
                                                        <View className="flex-[0.8] items-center">
                                                            <Text className={`text-[17px] font-inter font-black ${toBuy > 0 ? 'text-red-600' : 'text-slate-300'}`}>{toBuy.toLocaleString()}</Text>
                                                        </View>
                                                        <View className="flex-[1.2] items-center px-1">
                                                            <Text className="text-[13px] font-inter font-bold text-slate-500 text-center" numberOfLines={1}>{m.supplier || '--'}</Text>
                                                        </View>
                                                        <View className="w-24 flex-row justify-end">
                                                            <TouchableOpacity className="bg-blue-600 px-2 py-1 rounded-lg">
                                                                <Text className="text-white text-[12px] font-inter font-black uppercase">Order Full</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                );
                                            })
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })
                ) : (
                    // AREA-FIRST VIEW
                    Object.keys(materialsByArea).map(areaId => {
                        const areaMats = materialsByArea[areaId];
                        const area = allAreas.find((a: any) => a.id === areaId);
                        const areaName = area?.name || 'Project Wide / Global';
                        const areaTotal = areaMats.reduce((sum, m) => sum + (m.total_value || 0), 0);
                        const isExpanded = expandedAreas[areaId] !== false; // Default to expanded

                        // Split into Main and Sundries
                        const mainMaterials = areaMats.filter(m => !['Grout', 'Setting Materials', 'Sundries', 'Consumable'].includes(m.category));
                        const sundries = areaMats.filter(m => ['Grout', 'Setting Materials', 'Sundries', 'Consumable', 'Grout/Caulk'].includes(m.category));

                        const renderMaterialRow = (m: ProjectMaterial) => {
                            const wasteQty = (m.net_qty || 0) * ((m.waste_percent || 0) / 100);
                            const toBuy = Math.max(0, m.budget_qty - (m.shop_stock + m.received_at_job));
                            return (
                                <View key={m.id} className="flex-row px-3 py-2 border-b border-slate-50 items-center">
                                    <View className="flex-[1.2]">
                                        <Text className="font-inter font-black text-slate-900 text-[15px] leading-tight" numberOfLines={1}>{m.sub_location || '--'}</Text>
                                        <Text className="text-[12px] text-slate-400 font-inter font-bold uppercase tracking-tighter" numberOfLines={1}>{m.zone || 'No Zone'}</Text>
                                    </View>
                                    <View className="flex-[2] px-2">
                                        <Text className="font-inter font-black text-slate-900 text-[17px] leading-tight" numberOfLines={1}>{m.product_code || 'N/A'}</Text>
                                        <Text className="text-[14px] text-slate-400 font-inter font-bold" numberOfLines={1}>{m.product_name}</Text>
                                    </View>
                                    <View className="flex-1 items-center">
                                        <Text className="text-[15px] text-slate-600 font-inter font-bold text-center" numberOfLines={1}>
                                            {m.dim_length && m.dim_width ? `${m.dim_length}x${m.dim_width}` : '--'}
                                        </Text>
                                        {m.dim_thickness && <Text className="text-[11px] text-slate-400 font-bold uppercase">{m.dim_thickness}</Text>}
                                    </View>
                                    <View className="flex-1 items-center px-1">
                                        <Text className="text-[14px] text-slate-600 font-inter font-bold text-center" numberOfLines={2}>{m.grout_info || '--'}</Text>
                                    </View>
                                    <View className="flex-1 items-center px-1">
                                        <Text className="text-[14px] text-slate-600 font-inter font-bold text-center" numberOfLines={2}>{m.caulk_info || '--'}</Text>
                                    </View>
                                    <View className="flex-[0.7] items-center">
                                        <Text className="text-[15px] font-inter font-bold text-slate-600">{m.net_qty?.toLocaleString() || 0}</Text>
                                    </View>
                                    <View className="flex-[0.7] items-center">
                                        <Text className="text-[14px] font-inter font-bold text-slate-400">{m.waste_percent || 0}%</Text>
                                    </View>
                                    <View className="flex-[0.7] items-center">
                                        <Text className="text-[14px] font-inter font-bold text-slate-400">{wasteQty.toFixed(1)}</Text>
                                    </View>
                                    <View className="flex-[0.8] items-center">
                                        <Text className="text-[17px] font-inter font-black text-slate-900">{m.budget_qty.toLocaleString()}</Text>
                                    </View>
                                    <View className="flex-[0.7] items-center">
                                        <Text className="text-[15px] font-inter font-bold text-blue-600">{m.shop_stock.toLocaleString()}</Text>
                                    </View>
                                    <View className="flex-[0.7] items-center">
                                        <Text className="text-[15px] font-inter font-bold text-emerald-600">{m.received_at_job.toLocaleString()}</Text>
                                    </View>
                                    <View className="flex-[0.9] items-center">
                                        <Text className={`text-[17px] font-inter font-black ${toBuy > 0 ? 'text-red-600' : 'text-slate-300'}`}>{toBuy.toLocaleString()}</Text>
                                    </View>
                                    <View className="w-20 flex-row justify-end gap-3">
                                        <TouchableOpacity onPress={() => { setSelectedMaterial(m); setAddModalVisible(true); }}>
                                            <Ionicons name="pencil-outline" size={18} color="#cbd5e1" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDeleteMaterial(m.id)}>
                                            <Ionicons name="trash-outline" size={18} color="#fee2e2" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        };

                        return (
                            <View key={areaId} className="bg-white rounded-2xl border border-slate-200 mb-8 overflow-hidden shadow-md">
                                <View className="p-4 bg-slate-900 flex-row justify-between items-center">
                                    <View className="flex-row items-center gap-4">
                                        <TouchableOpacity
                                            onPress={() => toggleArea(areaId)}
                                            className="bg-white/10 w-8 h-8 rounded-lg items-center justify-center"
                                        >
                                            <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={16} color="white" />
                                        </TouchableOpacity>
                                        <View>
                                            <Text className="text-white font-inter font-black text-lg tracking-tight">{areaName}</Text>
                                            <Text className="text-blue-400 text-[13px] font-inter font-black uppercase tracking-widest">Area Logistics Breakdown</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 mr-2">
                                            <Text className="text-white font-inter font-black text-xs">Value: ${areaTotal.toLocaleString()}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedMaterial(null);
                                                setLockedAreaId(areaId);
                                                setAddModalVisible(true);
                                            }}
                                            className="bg-blue-600 w-8 h-8 rounded-lg items-center justify-center"
                                        >
                                            <Ionicons name="add" size={18} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteArea(areaId)}
                                            className="bg-red-500/20 w-8 h-8 rounded-lg items-center justify-center ml-1"
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#f87171" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {isExpanded && (
                                    <>
                                        <View className="flex-row px-3 py-2 bg-slate-50 border-b border-slate-100 items-center">
                                            <Text className="flex-[1.2] text-[12px] font-inter font-black text-slate-400 uppercase">LOC / ZONE</Text>
                                            <Text className="flex-[2] text-[12px] font-inter font-black text-slate-400 uppercase px-2">MATERIAL</Text>
                                            <Text className="flex-1 text-[12px] font-inter font-black text-slate-400 uppercase text-center">DIMS</Text>
                                            <Text className="flex-1 text-[12px] font-inter font-black text-slate-400 uppercase text-center">GROUT</Text>
                                            <Text className="flex-1 text-[12px] font-inter font-black text-slate-400 uppercase text-center">CAULK</Text>
                                            <Text className="flex-[0.7] text-[12px] font-inter font-black text-slate-400 uppercase text-center">NET</Text>
                                            <Text className="flex-[0.7] text-[12px] font-inter font-black text-slate-400 uppercase text-center">WASTE %</Text>
                                            <Text className="flex-[0.7] text-[12px] font-inter font-black text-slate-400 uppercase text-center">WASTE</Text>
                                            <Text className="flex-[0.8] text-[12px] font-inter font-black text-slate-900 uppercase text-center">BUDGET</Text>
                                            <Text className="flex-[0.7] text-[12px] font-inter font-black text-blue-600 uppercase text-center">STOCK</Text>
                                            <Text className="flex-[0.7] text-[12px] font-inter font-black text-emerald-600 uppercase text-center">RECV.</Text>
                                            <Text className="flex-[0.9] text-[12px] font-inter font-black text-slate-900 uppercase text-center">TO BUY</Text>
                                            <View className="w-20" />
                                        </View>

                                        {mainMaterials.map(renderMaterialRow)}

                                        {sundries.length > 0 && (
                                            <>
                                                <View className="px-3 py-3 bg-indigo-50/30 border-y border-indigo-100 flex-row items-center gap-2">
                                                    <Ionicons name="layers" size={16} color="#6366f1" />
                                                    <Text className="text-[14px] font-inter font-black text-indigo-800 uppercase tracking-widest">SETTING MATERIALS & SUNDRIES</Text>
                                                </View>
                                                {sundries.map(renderMaterialRow)}
                                            </>
                                        )}
                                    </>
                                )}
                            </View>
                        );
                    })
                )}
            </View>

            {/* DELIVERY MANAGEMENT SECTION */}
            <View className="px-8 mt-12 pb-20">
                <Text className="text-lg font-inter font-black text-slate-900 tracking-tight mb-6">Delivery Management</Text>

                <View className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <TouchableOpacity
                        onPress={() => toggleSection('DELIVERY MANAGEMENT')}
                        className="p-5 flex-row justify-between items-center border-b border-emerald-100 bg-emerald-50/30"
                    >
                        <View className="flex-row items-center gap-3">
                            <View className="bg-emerald-500 p-1.5 rounded-lg">
                                <Ionicons name="checkmark-circle" size={16} color="white" />
                            </View>
                            <Text className="font-inter font-black text-emerald-800 tracking-widest text-xs uppercase">Received History</Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <View className="bg-emerald-500 w-5 h-5 rounded-full items-center justify-center">
                                <Text className="text-[10px] font-black text-white">{tickets.length}</Text>
                            </View>
                            <Ionicons name={expandedSections['DELIVERY MANAGEMENT'] ? "chevron-down" : "chevron-forward"} size={18} color="#059669" />
                        </View>
                    </TouchableOpacity>

                    {expandedSections['DELIVERY MANAGEMENT'] && (
                        <View className="p-6">
                            <View className="flex-row flex-wrap gap-4">
                                {tickets.length === 0 ? (
                                    <View className="w-full py-12 items-center">
                                        <Text className="text-slate-400 italic font-inter font-bold">No delivery history found</Text>
                                    </View>
                                ) : (
                                    tickets.map(t => (
                                        <View key={t.id} className="w-[48%] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            <View className="p-4 border-b border-slate-50 flex-row justify-between items-center">
                                                <View>
                                                    <View className="flex-row items-center gap-2">
                                                        <Text className="font-black text-slate-900 text-[15px]">#{t.ticket_number}</Text>
                                                        <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                                                            <Text className="text-[10px] font-black text-emerald-700 uppercase">{t.status}</Text>
                                                        </View>
                                                    </View>
                                                    <Text className="text-[12px] text-slate-400 font-bold mt-0.5">Ticket #{t.ticket_number} • Received: {new Date(t.requested_date).toLocaleDateString()}</Text>
                                                </View>
                                                <TouchableOpacity>
                                                    <Ionicons name="print-outline" size={16} color="#cbd5e1" />
                                                </TouchableOpacity>
                                            </View>
                                            <View className="p-4 bg-slate-50/50">
                                                <View className="flex-row gap-6 items-center mb-6">
                                                    <View className="flex-row items-center gap-1.5">
                                                        <Ionicons name="cube-outline" size={14} color="#64748b" />
                                                        <Text className="text-[12px] font-black text-slate-800">{t.items?.length || 0} Items</Text>
                                                    </View>
                                                    <View className="flex-row items-center gap-1.5">
                                                        <Ionicons name="business-outline" size={14} color="#64748b" />
                                                        <Text className="text-[12px] font-black text-slate-800">{t.destination}</Text>
                                                    </View>
                                                </View>
                                                <View className="flex-row justify-between items-center pt-4 border-t border-slate-100">
                                                    <View className="flex-row gap-2">
                                                        <View className="bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg items-center">
                                                            <Text className="text-[10px] font-black text-emerald-600 uppercase">Sup.</Text>
                                                            <Text className="text-[10px] font-black text-emerald-600 uppercase">Approved</Text>
                                                        </View>
                                                        <View className="bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg items-center">
                                                            <Text className="text-[10px] font-black text-emerald-600 uppercase">Foreman</Text>
                                                            <Text className="text-[10px] font-black text-emerald-600 uppercase">Recv.</Text>
                                                        </View>
                                                    </View>
                                                    <View className="flex-row gap-3">
                                                        <TouchableOpacity><Ionicons name="eye-outline" size={18} color="#94a3b8" /></TouchableOpacity>
                                                        <TouchableOpacity><Ionicons name="pencil-outline" size={18} color="#94a3b8" /></TouchableOpacity>
                                                        <TouchableOpacity onPress={() => handleDeleteTicket(t.id)}><Ionicons name="trash-outline" size={18} color="#94a3b8" /></TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {/* MODALS */}
            <AddBudgetItemModal
                visible={addModalVisible}
                onClose={() => { setAddModalVisible(false); setLockedAreaId(undefined); }}
                onSave={handleSaveMaterial}
                initialData={selectedMaterial}
                areas={allAreas}
                units={allUnits}
                lockedAreaId={lockedAreaId}
            />

            <DeliveryTicketModal
                visible={ticketVisible}
                onClose={() => setTicketVisible(false)}
                materials={materials}
                jobId={job.id}
                onSuccess={loadData}
            />
        </ScrollView>
    );
}
