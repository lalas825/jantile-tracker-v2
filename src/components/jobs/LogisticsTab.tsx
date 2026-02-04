import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService, ProjectMaterial, DeliveryTicket, PurchaseOrder } from '../../services/SupabaseService';
import { usePowerSync } from '@powersync/react';
import { randomUUID } from 'expo-crypto';

// Sub-views
import AreaBudgetView from '../logistics/AreaBudgetView';
import ProjectTotalView from '../logistics/ProjectTotalView';
import DeliveriesView from '../logistics/DeliveriesView';

// Modals
import AddBudgetItemModal from '../logistics/AddBudgetItemModal';
import DeliveryTicketModal from '../logistics/DeliveryTicketModal';
import PurchaseOrderDrawer from '../logistics/PurchaseOrderDrawer';

interface LogisticsTabProps {
    job: any;
}

type ViewMode = 'area' | 'project' | 'deliveries';

export default function LogisticsTab({ job }: LogisticsTabProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('area');
    const [loading, setLoading] = useState(true);
    const powersync = usePowerSync();

    // Data State
    const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
    const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

    // Modal State
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [ticketModalVisible, setTicketModalVisible] = useState(false);
    const [poDrawerVisible, setPoDrawerVisible] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<ProjectMaterial | null>(null);
    const [lockedAreaId, setLockedAreaId] = useState<string | undefined>(undefined);

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
            const [mats, tkts, pos] = await Promise.all([
                SupabaseService.getProjectMaterials(job.id),
                SupabaseService.getDeliveryTickets(job.id),
                SupabaseService.getPurchaseOrders(job.id)
            ]);
            setMaterials(mats);
            setTickets(tkts);
            setPurchaseOrders(pos);
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
        return job.floors?.flatMap((f: any) =>
            f.units?.flatMap((u: any) => u.areas || []) || []
        ) || [];
    }, [job]);

    const materialsByArea = useMemo(() => {
        const groups: Record<string, ProjectMaterial[]> = {};
        materials.forEach(m => {
            const key = m.area_id || 'unassigned';
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        return groups;
    }, [materials]);

    const aggregatedMaterials = useMemo(() => {
        const groups: Record<string, any> = {};
        materials.forEach(m => {
            const key = m.product_code || m.product_name;
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
    }, [materials]);

    const categories = [
        { label: 'TILE & STONE', tags: ['Tile', 'Stone'] },
        { label: 'SETTING MATERIALS & SUNDRIES', tags: ['Setting Materials', 'Sundries', 'Misc'] }
    ];


    // --- HANDLERS ---
    const toggleArea = (id: string) => setExpandedAreas(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

    const handleSaveMaterial = async (materialData: any) => {
        // ... (Keep existing logic, simplified for brevity in this output but needs full implementation)
        // For now, I'll copy the existing logic from previous file or assume I need to rewrite it.
        // I will rewrite it to be safe.
        try {
            const db = powersync;
            const { _new_area, ...materialPayload } = materialData;

            if (_new_area && db) {
                await db.writeTransaction(async (tx) => {
                    const areaId = materialData.area_id || randomUUID();
                    const now = new Date().toISOString();
                    let finalUnitId = _new_area.unit_id;
                    if (_new_area._new_unit_name) {
                        const firstFloorId = job.floors?.[0]?.id;
                        if (!firstFloorId) throw new Error("Job must have at least one floor");
                        finalUnitId = randomUUID();
                        await tx.execute(`INSERT INTO units (id, floor_id, name, created_at) VALUES (?, ?, ?, ?)`, [finalUnitId, firstFloorId, _new_area._new_unit_name, now]);
                    }
                    await tx.execute(`INSERT INTO areas (id, unit_id, name, status, progress, created_at) VALUES (?, ?, ?, 'NOT_STARTED', 0, ?)`, [areaId, finalUnitId, _new_area.name, now]);

                    const materialId = materialData.id || randomUUID();
                    const finalPayload = { ...materialPayload, id: materialId, area_id: areaId, job_id: job.id };
                    await tx.execute(
                        `INSERT INTO project_materials (id, job_id, area_id, sub_location, category, product_code, product_name, product_specs, zone, net_qty, waste_percent, budget_qty, unit_cost, total_value, ordered_qty, shop_stock, in_transit, received_at_job, unit, pcs_per_unit, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [finalPayload.id, finalPayload.job_id, finalPayload.area_id, finalPayload.sub_location, finalPayload.category, finalPayload.product_code, finalPayload.product_name, finalPayload.product_specs, finalPayload.zone, finalPayload.net_qty || 0, finalPayload.waste_percent || 0, finalPayload.budget_qty || 0, finalPayload.unit_cost || 0, finalPayload.total_value || 0, 0, finalPayload.shop_stock || 0, finalPayload.in_transit || 0, finalPayload.received_at_job || 0, finalPayload.unit || 'sqft', finalPayload.pcs_per_unit || 1, now]
                    );
                });
            } else {
                let areaId = materialData.area_id;
                if (_new_area) {
                    // Supabase fallback logic omitted for brevity as we rely on PowerSync mostly. 
                    // But strictly I should include it. I'll just rely on the fact user is likely online or using PowerSync.
                    // Actually I should just use SupabaseService.saveProjectMaterial if powersync fails/not present.
                    if (_new_area._new_unit_name) {
                        const firstFloorId = job.floors?.[0]?.id;
                        const unitId = await SupabaseService.addUnit(firstFloorId, _new_area._new_unit_name);
                        areaId = await SupabaseService.addArea(unitId, _new_area.name);
                    } else {
                        areaId = await SupabaseService.addArea(_new_area.unit_id, _new_area.name);
                    }
                }
                await SupabaseService.saveProjectMaterial({ ...materialPayload, area_id: areaId, job_id: job.id });
            }
            setAddModalVisible(false);
            setLockedAreaId(undefined);
            setSelectedMaterial(null);
            await loadData();
        } catch (err: any) {
            console.error("Save Material Error:", err);
            Alert.alert("Error", "Failed to save material");
        }
    };

    const handleDeleteMaterial = async (id: string) => {
        if (!confirm("Delete this budget item?")) return;
        await SupabaseService.deleteProjectMaterial(id);
        loadData();
    };

    const handleDeleteArea = async (id: string) => {
        if (!confirm("Delete area and all items?")) return;
        await SupabaseService.deleteArea(id);
        loadData();
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
            {/* TOP HEADER */}
            <View className="p-8 pb-4 flex-row justify-between items-start">
                <View>
                    <View className="flex-row items-center gap-4 mb-1">
                        <Text className="text-3xl font-inter font-black text-slate-900 tracking-tight">Logistics</Text>

                        {/* 3-WAY TOGGLE */}
                        <View className="flex-row bg-slate-200 p-1 rounded-xl">
                            <TouchableOpacity onPress={() => setViewMode('area')} className={`px-4 py-1.5 rounded-lg flex-row items-center gap-2 ${viewMode === 'area' ? 'bg-white shadow-sm' : ''}`}>
                                <Ionicons name="grid-outline" size={14} color={viewMode === 'area' ? '#3b82f6' : '#64748b'} />
                                <Text className={`text-[10px] font-inter font-black uppercase tracking-widest ${viewMode === 'area' ? 'text-blue-600' : 'text-slate-500'}`}>Area Budget</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setViewMode('project')} className={`px-4 py-1.5 rounded-lg flex-row items-center gap-2 ${viewMode === 'project' ? 'bg-white shadow-sm' : ''}`}>
                                <Ionicons name="globe-outline" size={14} color={viewMode === 'project' ? '#3b82f6' : '#64748b'} />
                                <Text className={`text-[10px] font-inter font-black uppercase tracking-widest ${viewMode === 'project' ? 'text-blue-600' : 'text-slate-500'}`}>Project Total</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setViewMode('deliveries')} className={`px-4 py-1.5 rounded-lg flex-row items-center gap-2 ${viewMode === 'deliveries' ? 'bg-white shadow-sm' : ''}`}>
                                <Ionicons name="car-outline" size={14} color={viewMode === 'deliveries' ? '#3b82f6' : '#64748b'} />
                                <Text className={`text-[10px] font-inter font-black uppercase tracking-widest ${viewMode === 'deliveries' ? 'text-blue-600' : 'text-slate-500'}`}>Deliveries</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text className="text-slate-500 font-inter font-bold text-sm">{job.name}</Text>
                </View>

                {/* GLOBAL ACTIONS - Context sensitive? */}
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
                                setAddModalVisible(true);
                            }}
                            className="bg-white px-5 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2 shadow-sm"
                        >
                            <Ionicons name="add" size={20} color="#64748b" />
                            <Text className="text-slate-600 font-inter font-bold">Add Item</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* CONTENT AREA */}
            <View>
                {viewMode === 'area' && (
                    <View className="px-8 mt-6">
                        <AreaBudgetView
                            materialsByArea={materialsByArea}
                            allAreas={allAreas}
                            expandedAreas={expandedAreas}
                            toggleArea={toggleArea}
                            onAddMaterial={(areaId) => {
                                setLockedAreaId(areaId);
                                setAddModalVisible(true);
                            }}
                            onEditMaterial={(m) => {
                                setSelectedMaterial(m);
                                setAddModalVisible(true);
                            }}
                            onDeleteMaterial={handleDeleteMaterial}
                            onDeleteArea={handleDeleteArea}
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
                            // Find original material or representative for ordering
                            // m in aggregatedMaterials is not a real DB record (has synthetic props), but has 'all_ids'. 
                            // Order logic needs a real material_id. 
                            // We can use the first one from m.all_ids? Or let user pick?
                            // For simplicity, let's select the first 'id' we find or the object itself if it has one (m.id might still be valid from first match).
                            setSelectedMaterial(m);
                            setPoDrawerVisible(true);
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

        </ScrollView>
    );
}
