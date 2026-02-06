import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService, ProjectMaterial, DeliveryTicket, PurchaseOrder } from '../../services/SupabaseService';
import { usePowerSync } from '@powersync/react';
import { randomUUID } from 'expo-crypto';

// Sub-views
import AreaBudgetView from '../logistics/AreaBudgetView';
import ProjectTotalView from '../logistics/ProjectTotalView';
import DeliveriesView from '../logistics/DeliveriesView';

// Modals
// Modals
import AddBudgetItemModal from '../logistics/AddBudgetItemModal';
import DeliveryTicketModal from '../logistics/DeliveryTicketModal';
import PurchaseOrderDrawer from '../logistics/PurchaseOrderDrawer';
import EditAreaModal from '../logistics/EditAreaModal';

interface LogisticsTabProps {
    job: any;
    onAreaUpdated?: (areaId: string, updates: any) => void;
    onRefreshJob?: () => void;
}

type ViewMode = 'area' | 'project' | 'deliveries';

export default function LogisticsTab({ job, onAreaUpdated, onRefreshJob }: LogisticsTabProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('area');
    const [loading, setLoading] = useState(true);
    const powersync = usePowerSync();

    // Data State
    const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
    const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [rawAreas, setRawAreas] = useState<any[]>([]);

    // Modal State
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [ticketModalVisible, setTicketModalVisible] = useState(false);
    const [poDrawerVisible, setPoDrawerVisible] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<ProjectMaterial | null>(null);
    const [lockedAreaId, setLockedAreaId] = useState<string | undefined>(undefined);
    const [editAreaModalVisible, setEditAreaModalVisible] = useState(false);
    const [selectedAreaForEdit, setSelectedAreaForEdit] = useState<any>(null);

    // View State
    const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'TILE & STONE': true,
        'DELIVERY MANAGEMENT': true,
        'VENDOR ORDERS': true
    });

    // --- DATA LOADING ---
    const loadData = useCallback(async () => {
        try {
            const [mats, tkts, pos, aras] = await Promise.all([
                SupabaseService.getProjectMaterials(job.id),
                SupabaseService.getDeliveryTickets(job.id),
                SupabaseService.getPurchaseOrders(job.id),
                SupabaseService.getProjectAreas(job.id)
            ]);
            setMaterials(mats);
            setTickets(tkts);
            setPurchaseOrders(pos);
            setRawAreas(aras);
        } catch (err) {
            console.error("Logistics Load Error:", err);
        } finally {
            setLoading(false);
        }
    }, [job.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // --- COMPUTED DATA ---
    const allAreas = useMemo(() => {
        // 1. Get real areas from DB
        const areaIds = new Set(rawAreas.map(a => a.id));
        const realNames = new Set(rawAreas.map(a => (a.name || '').toLowerCase()));

        // 2. Identify materials with NO area_id OR area_id not in rawAreas
        const virtualAreas: any[] = [];
        const seenLocations = new Set<string>();

        materials.forEach(m => {
            const hasRealArea = (m.area_id && areaIds.has(m.area_id)) ||
                (m.sub_location && realNames.has(m.sub_location.toLowerCase()));

            if (!hasRealArea && m.sub_location && m.sub_location !== 'Unassigned') {
                const locKey = m.sub_location.toLowerCase();
                if (!seenLocations.has(locKey)) {
                    seenLocations.add(locKey);
                    virtualAreas.push({
                        id: `loc-${m.sub_location}`,
                        name: m.sub_location,
                        description: 'Location from Project Total',
                        type: 'logistics',
                        isVirtual: true,
                        created_at: m.created_at || new Date().toISOString()
                    });
                }
            }
        });

        // 3. Filter rawAreas:
        // - Show if it's 'logistics' type
        // - OR Show if it has materials
        // - OR Show if name contains "BOH" or "Back of House"
        const areaIdsWithMats = new Set(materials.map(m => m.area_id).filter(Boolean));
        const filtered = rawAreas.filter(a => {
            if (a.type === 'logistics') return true;
            if (areaIdsWithMats.has(a.id)) return true;

            const name = (a.name || '').toLowerCase();
            if (name.includes('boh') || name.includes('back of house')) return true;

            return false;
        });

        // 4. Combine Real + Virtual
        const combined = [...filtered, ...virtualAreas];

        // 5. Add Global/Unassigned if items exist
        if (materials.some(m => !m.area_id || !areaIds.has(m.area_id))) {
            if (!combined.some(a => a.id === 'unassigned')) {
                combined.unshift({
                    id: 'unassigned',
                    name: 'UNASSIGNED / GLOBAL HUB',
                    description: 'Items without an area assignment',
                    type: 'logistics',
                    isVirtual: true,
                    created_at: new Date(0).toISOString()
                });
            }
        }

        // 6. Sort remaining by created_at ascending (chronological)
        return combined.sort((a, b) => {
            if (a.id === 'unassigned') return -1;
            if (b.id === 'unassigned') return 1;
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
        });
    }, [rawAreas, materials]);

    const sortedMaterials = useMemo(() => {
        return [...materials].sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
        });
    }, [materials]);

    const materialsByArea = useMemo(() => {
        const groups: Record<string, ProjectMaterial[]> = {};
        const areaIds = new Set(rawAreas.map(a => a.id));

        sortedMaterials.forEach(m => {
            let key = m.area_id || 'unassigned';

            // If area_id is set but the area record is missing, or no area_id but has sub_location
            if (!m.area_id || !areaIds.has(m.area_id)) {
                if (m.sub_location && m.sub_location !== 'Unassigned') {
                    key = `loc-${m.sub_location}`;
                } else {
                    key = 'unassigned';
                }
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        return groups;
    }, [sortedMaterials, rawAreas]);

    const aggregatedMaterials = useMemo(() => {
        const groups: Record<string, any> = {};
        sortedMaterials.forEach(m => {
            // Grouping Key: Product Code + Dimensions (L x W x T) + Unit
            // For Grout: Group by Product Code + Specs (Color) + Unit
            const dims = m.category === 'Grout' ? '' : [m.dim_length, m.dim_width, m.dim_thickness].map(d => d || '').join('x');
            const key = m.category === 'Grout'
                ? `${m.product_code || m.product_name}-${m.product_specs || 'nospecs'}-${m.unit || 'unit'}`
                : `${m.product_code || m.product_name}-${dims}-${m.unit || 'unit'}`;

            if (!groups[key]) {
                groups[key] = {
                    ...m,
                    net_qty: 0, waste_qty: 0, budget_qty: 0,
                    ordered_qty: 0, shop_stock: 0, in_transit: 0, received_at_job: 0,
                    total_value: 0,
                    locations: new Set<string>(),
                    zones: new Set<string>(),
                    all_ids: new Set<string>()
                };
            }
            if (m.sub_location) groups[key].locations.add(m.sub_location);
            if (m.zone) groups[key].zones.add(m.zone);
            groups[key].all_ids.add(m.id);

            groups[key].net_qty += m.net_qty || 0;
            groups[key].waste_qty += (m.net_qty || 0) * ((m.waste_percent || 0) / 100);
            groups[key].budget_qty += m.budget_qty || 0;
            groups[key].ordered_qty += m.ordered_qty || 0; // Note: ordered_qty logic might need review if it comes from POs
            groups[key].shop_stock += m.shop_stock || 0;
            groups[key].in_transit += m.in_transit || 0;
            groups[key].received_at_job += m.received_at_job || 0;
            groups[key].total_value += (m.budget_qty || 0) * (m.unit_cost || 0);
        });
        return Object.values(groups);
    }, [sortedMaterials]);

    const categories = [
        { label: 'TILE & STONE', tags: ['Tile', 'Stone'] },
        { label: 'SETTING MATERIALS & SUNDRIES', tags: ['Setting Materials', 'Sundries', 'Misc', 'Grout', 'Consumable', 'Grout/Caulk'] }
    ];


    // --- HANDLERS ---
    const toggleArea = (id: string) => setExpandedAreas(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSaveMaterial = async (materialData: any) => {
        try {
            const db = powersync;
            const { _new_area, ...materialPayload } = materialData;

            // PowerSync is only used on Native (iOS/Android). 
            // On Web, we MUST use Supabase fallback.
            const usePowerSyncPath = Platform.OS !== 'web' && db;

            if (usePowerSyncPath) {
                await db.writeTransaction(async (tx) => {
                    const now = new Date().toISOString();
                    let areaId = materialData.area_id;

                    if (_new_area) {
                        areaId = randomUUID();
                        let finalUnitId = _new_area.unit_id;

                        if (_new_area._new_unit_name) {
                            const firstFloorId = job.floors?.[0]?.id;
                            if (!firstFloorId) throw new Error("Job must have at least one floor");
                            finalUnitId = randomUUID();
                            await tx.execute(`INSERT INTO units (id, floor_id, name, type, created_at) VALUES (?, ?, ?, 'logistics', ?)`, [finalUnitId, firstFloorId, _new_area._new_unit_name, now]);
                        }

                        await tx.execute(`INSERT INTO areas (id, unit_id, name, description, type, status, progress, created_at) VALUES (?, ?, ?, ?, 'logistics', 'NOT_STARTED', 0, ?)`, [areaId, finalUnitId, _new_area.name, _new_area.description || '', now]);
                    }

                    const materialId = materialData.id || randomUUID();
                    const finalPayload = { ...materialPayload, id: materialId, area_id: areaId, job_id: job.id };

                    await tx.execute(
                        `INSERT INTO project_materials (id, job_id, area_id, sub_location, category, supplier, product_code, product_name, product_specs, zone, net_qty, waste_percent, budget_qty, unit_cost, total_value, ordered_qty, shop_stock, in_transit, received_at_job, unit, pcs_per_unit, grout_info, caulk_info, linear_feet, dim_length, dim_width, dim_thickness, expected_date, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            finalPayload.id, finalPayload.job_id, finalPayload.area_id, finalPayload.sub_location, finalPayload.category, finalPayload.supplier || '',
                            finalPayload.product_code, finalPayload.product_name, finalPayload.product_specs, finalPayload.zone,
                            finalPayload.net_qty || 0, finalPayload.waste_percent || 0, finalPayload.budget_qty || 0,
                            finalPayload.unit_cost || 0, finalPayload.total_value || 0, 0, finalPayload.shop_stock || 0,
                            finalPayload.in_transit || 0, finalPayload.received_at_job || 0, finalPayload.unit || 'sqft',
                            finalPayload.pcs_per_unit || 1, finalPayload.grout_info || '', finalPayload.caulk_info || '',
                            finalPayload.linear_feet || 0, finalPayload.dim_length || 0, finalPayload.dim_width || 0, finalPayload.dim_thickness || '',
                            finalPayload.expected_date || null,
                            now, now
                        ]
                    );
                });
            } else {
                // Supabase fallback
                let areaId = materialData.area_id;
                if (_new_area) {
                    if (_new_area._new_unit_name) {
                        const firstFloorId = job.floors?.[0]?.id;
                        const unitId = await SupabaseService.addUnit(firstFloorId, _new_area._new_unit_name);
                        areaId = await SupabaseService.addArea(unitId, _new_area.name, _new_area.description || '', '', 'logistics');
                    } else {
                        areaId = await SupabaseService.addArea(_new_area.unit_id, _new_area.name, _new_area.description || '', '', 'logistics');
                    }
                }

                const finalPayload = { ...materialPayload, area_id: areaId, job_id: job.id };
                await SupabaseService.saveProjectMaterial(finalPayload);
            }

            setAddModalVisible(false);
            setLockedAreaId(undefined);
            setSelectedMaterial(null);
            await loadData();
        } catch (err: any) {
            console.error("Save Material Error:", err);
            Alert.alert("Error", "Failed to save material");
            setAddModalVisible(false);
            setLockedAreaId(undefined);
            setSelectedMaterial(null);
        }
    };

    const handleDeleteMaterial = async (id: string) => {
        console.log("[LogisticsTab] handleDeleteMaterial called for:", id);

        const performDelete = async () => {
            try {
                console.log("[LogisticsTab] Confirmed deletion for material:", id);
                await SupabaseService.deleteProjectMaterial(id);
                await loadData();
                if (onRefreshJob) onRefreshJob();
            } catch (err: any) {
                console.error("Delete Material Error:", err);
                const msg = "Failed to delete material: " + err.message;
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert("Error", msg);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this budget item?")) {
                performDelete();
            }
        } else {
            Alert.alert(
                "Delete Item",
                "Are you sure you want to delete this budget item?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: performDelete }
                ]
            );
        }
    };

    const handleDeleteArea = async (id: string) => {
        console.log("[LogisticsTab] handleDeleteArea called for:", id);

        const performDelete = async () => {
            try {
                console.log("[LogisticsTab] Confirmed deletion for area:", id);
                await SupabaseService.deleteArea(id);
                await loadData();
                if (onRefreshJob) onRefreshJob();
            } catch (err: any) {
                console.error("Delete Area Error:", err);
                const msg = "Failed to delete area: " + err.message;
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert("Error", msg);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Delete this area and all items? This cannot be undone.")) {
                performDelete();
            }
        } else {
            Alert.alert(
                "Delete Area",
                "Delete this area and all items? This cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: performDelete }
                ]
            );
        }
    };

    const handleEditArea = (id: string) => {
        const area = allAreas.find((a: any) => a.id === id);
        if (area) {
            setSelectedAreaForEdit(area);
            setEditAreaModalVisible(true);
        }
    };

    const handleUpdateArea = async (id: string, updates: any) => {
        try {
            console.log("[LogisticsTab] Updating area:", id, updates);

            // Optimistic Update Local State
            setRawAreas(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));

            await SupabaseService.updateArea(id, updates);
            setEditAreaModalVisible(false);
            setSelectedAreaForEdit(null);

            // Optimistic Update Parent
            if (onAreaUpdated) {
                onAreaUpdated(id, updates);
            }

            await loadData();
        } catch (err: any) {
            console.error("Update Area Error:", err);
            const msg = "Failed to update area: " + err.message;
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert("Error", msg);
        }
    };

    const handleSaveOrder = async (poData: any) => {
        try {
            await SupabaseService.savePurchaseOrder(poData, job.id);
            setPoDrawerVisible(false);
            setSelectedMaterial(null);
            await loadData();
        } catch (err: any) {
            console.error("Save PO Error:", err);
            Alert.alert("Error", err.message);
        }
    };


    // --- DELIVERY HANDLERS ---
    const handleUpdateTicketStatus = async (ticket: DeliveryTicket, newStatus: string) => {
        try {
            const db = powersync;
            if (!db) return;

            // OPTION 1: Just update status
            if (newStatus !== 'received') {
                await db.execute(`UPDATE delivery_tickets SET status = ?, updated_at = ? WHERE id = ?`, [newStatus, new Date().toISOString(), ticket.id]);
            }
            // OPTION 2: RECEIVE LOGIC
            else {
                // Transaction: Update Ticket -> Update Inventory
                await db.writeTransaction(async (tx) => {
                    const now = new Date().toISOString();

                    // 1. Update Ticket Status
                    await tx.execute(`UPDATE delivery_tickets SET status = 'received', updated_at = ? WHERE id = ?`, [now, ticket.id]);

                    // 2. Loop Items and Update Inventory
                    // ticket.items is JSON array of { material_id, qty, ... }
                    if (ticket.items && Array.isArray(ticket.items)) {
                        for (const item of ticket.items) {
                            if (item.material_id && item.qty) {
                                // Logic: 
                                // Increment received_at_job
                                // Decrement in_transit (Assuming it came from PO/Transit?)
                                // OR Decrement shop_stock (If it came from Shop?)
                                // For now, let's assume 'In Transit' -> 'Received' flow implies decrement In Transit.
                                // But if ticket was created from Shop Stock, we decremented Stock at creation? 
                                // Let's assume standard flow: +Recv, -InTransit. 

                                await tx.execute(
                                    `UPDATE project_materials SET 
                                        received_at_job = received_at_job + ?,
                                        in_transit = MAX(0, in_transit - ?), 
                                        updated_at = ?
                                      WHERE id = ?`,
                                    [item.qty, item.qty, now, item.material_id]
                                );
                            }
                        }
                    }
                });
            }
            await loadData();
        } catch (err) {
            console.error("Update Status Error:", err);
            Alert.alert("Error", "Failed to update ticket status");
        }
    };

    const handleDeleteTicket = async (id: string) => {
        if (!confirm("Delete ticket?")) return;
        await SupabaseService.deleteDeliveryTicket(id);
        loadData();
    };

    if (loading) return <ActivityIndicator className="py-20" color="#3b82f6" />;

    return (
        <ScrollView className="flex-1 bg-slate-100">
            {/* HEADER SLEEK */}
            <View className="px-8 pt-8 pb-6 bg-white border-b border-slate-200">
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-3xl font-inter font-black text-slate-900 tracking-tight italic">Logistics</Text>
                        <Text className="text-slate-400 font-inter font-bold mt-1 uppercase tracking-widest text-[11px]">{job.name}</Text>

                        {/* GLOBAL STATS OVERVIEW */}
                        <View className="flex-row gap-4 mt-4">
                            <View className="flex-row items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                <Ionicons name="grid-outline" size={14} color="#64748b" />
                                <Text className="text-[10px] font-black text-slate-600 uppercase">Materials: {materials.length}</Text>
                            </View>
                            <View className="flex-row items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                <Ionicons name="cube-outline" size={14} color="#2563eb" />
                                <Text className="text-[10px] font-black text-blue-600 uppercase">Tiles: {materials.filter(m => ['Tile', 'Stone'].includes(m.category)).length}</Text>
                            </View>
                            <View className="flex-row items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                <Ionicons name="layers-outline" size={14} color="#4f46e5" />
                                <Text className="text-[10px] font-black text-indigo-600 uppercase">Sundries: {materials.filter(m => ['setting materials', 'grout', 'sundries', 'consumable'].includes((m.category || '').toLowerCase())).length}</Text>
                            </View>
                            {materials.filter(m => !m.area_id).length > 0 && (
                                <View className="flex-row items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                                    <Ionicons name="alert-circle-outline" size={14} color="#d97706" />
                                    <Text className="text-[10px] font-black text-amber-700 uppercase">Unassigned: {materials.filter(m => !m.area_id).length}</Text>
                                </View>
                            )}

                            {/* DEBUG BUTTON */}
                            <TouchableOpacity
                                onPress={() => {
                                    const catMap = materials.reduce((acc: any, m) => {
                                        acc[m.category] = (acc[m.category] || 0) + 1;
                                        return acc;
                                    }, {});
                                    const debugInfo = `Total: ${materials.length}\nJob ID: ${job.id}\nFirst Mat Job ID: ${materials[0]?.job_id || 'N/A'}\nCategories: ${JSON.stringify(catMap)}`;
                                    window.alert(debugInfo);
                                }}
                                className="bg-slate-800 px-3 py-1.5 rounded-lg"
                            >
                                <Text className="text-[8px] text-white font-bold uppercase">Debug Data</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 3-WAY TOGGLE */}
                    <View className="flex-row bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <TouchableOpacity
                            onPress={() => setViewMode('area')}
                            className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${viewMode === 'area' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Ionicons name="grid-outline" size={14} color={viewMode === 'area' ? '#2563eb' : '#64748b'} />
                            <Text className={`text-[10px] font-inter font-black uppercase tracking-widest ${viewMode === 'area' ? 'text-blue-600' : 'text-slate-500'}`}>Area Budget</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setViewMode('project')}
                            className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${viewMode === 'project' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Ionicons name="globe-outline" size={14} color={viewMode === 'project' ? '#2563eb' : '#64748b'} />
                            <Text className={`text-[10px] font-inter font-black uppercase tracking-widest ${viewMode === 'project' ? 'text-blue-600' : 'text-slate-500'}`}>Project Total</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setViewMode('deliveries')}
                            className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${viewMode === 'deliveries' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Ionicons name="car-outline" size={14} color={viewMode === 'deliveries' ? '#2563eb' : '#64748b'} />
                            <Text className={`text-[10px] font-inter font-black uppercase tracking-widest ${viewMode === 'deliveries' ? 'text-blue-600' : 'text-slate-500'}`}>Deliveries</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* HEADER ACTIONS */}
                <View className="flex-row justify-between items-center">
                    <View className="flex-row gap-3">
                        {viewMode === 'deliveries' ? (
                            <TouchableOpacity
                                onPress={() => setTicketModalVisible(true)}
                                className="bg-blue-600 px-6 py-2.5 rounded-xl flex-row items-center gap-2 shadow-lg shadow-blue-200"
                            >
                                <Ionicons name="add-circle" size={20} color="white" />
                                <Text className="text-white font-inter font-black uppercase tracking-widest text-xs">Create Ticket</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedMaterial(null);
                                    setLockedAreaId('');
                                    setAddModalVisible(true);
                                }}
                                className="bg-slate-900 px-6 py-2.5 rounded-xl flex-row items-center gap-2 shadow-lg shadow-slate-200"
                            >
                                <Ionicons name="add" size={20} color="white" />
                                <Text className="text-white font-inter font-black uppercase tracking-widest text-xs">Add Item</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* CONTENT AREA */}
            <View className="pb-20">
                {viewMode === 'area' && (
                    <View className="px-8 mt-8">
                        <AreaBudgetView
                            materialsByArea={materialsByArea}
                            allAreas={allAreas}
                            expandedAreas={expandedAreas}
                            toggleArea={toggleArea}
                            onAddMaterial={(areaId) => {
                                setLockedAreaId(areaId);
                                setSelectedMaterial(null);
                                setAddModalVisible(true);
                            }}
                            onEditMaterial={(m) => {
                                setSelectedMaterial(m);
                                setLockedAreaId(m.area_id || '');
                                setAddModalVisible(true);
                            }}
                            onDeleteMaterial={handleDeleteMaterial}
                            onDeleteArea={handleDeleteArea}
                            onEditArea={handleEditArea}
                        />
                    </View>
                )}

                {viewMode === 'project' && (
                    <ProjectTotalView
                        aggregatedMaterials={aggregatedMaterials}
                        categories={categories}
                        expandedSections={expandedSections}
                        toggleSection={toggleSection}
                        purchaseOrders={purchaseOrders}
                        onOrder={(m) => {
                            setSelectedMaterial(m);
                            setPoDrawerVisible?.(true); // Defensive check if Drawer setter exists
                        }}
                    />
                )}

                {viewMode === 'deliveries' && (
                    <DeliveriesView
                        tickets={tickets}
                        onCreateTicket={() => setTicketModalVisible(true)}
                        onUpdateStatus={handleUpdateTicketStatus}
                        onDeleteTicket={handleDeleteTicket}
                    />
                )}
            </View>

            {/* MODALS */}
            <AddBudgetItemModal
                visible={addModalVisible}
                onClose={() => setAddModalVisible(false)}
                onSave={handleSaveMaterial}
                initialData={selectedMaterial}
                areas={rawAreas}
                units={job.floors?.flatMap((f: any) => f.units || []) || []}
                lockedAreaId={lockedAreaId}
            />

            <PurchaseOrderDrawer
                visible={poDrawerVisible}
                onClose={() => setPoDrawerVisible(false)}
                material={selectedMaterial}
                existingPOs={purchaseOrders}
                onSave={handleSaveOrder}
            />

            {/* We reuse DeliveryTicketModal, passing materials for selection */}
            <DeliveryTicketModal
                visible={ticketModalVisible}
                onClose={() => setTicketModalVisible(false)}
                jobId={job.id}
                materials={materials}
                onSuccess={loadData}
            />

            <EditAreaModal
                visible={editAreaModalVisible}
                onClose={() => setEditAreaModalVisible(false)}
                onSave={handleUpdateArea}
                area={selectedAreaForEdit}
            />

        </ScrollView >
    );
}
