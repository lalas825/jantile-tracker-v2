import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService, ProjectMaterial, DeliveryTicket, PurchaseOrder } from '../../services/SupabaseService';
import { usePowerSync, useQuery } from '@powersync/react';
import { randomUUID } from 'expo-crypto';
import { Truck, Grid, BarChart2 } from 'lucide-react-native';

// Sub-views
import AreaBudgetView from '../logistics/AreaBudgetView';
import ProjectTotalView from '../logistics/ProjectTotalView';
import DeliveriesView from '../logistics/DeliveriesView';

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
    const powersync = usePowerSync();

    // --- REAL-TIME DATA WATCHERS (POWERSYNC) ---
    const { data: materials = [] } = useQuery('SELECT * FROM project_materials WHERE job_id = ?', [job.id]);

    // Watch POs and hydrate items from po_items
    const { data: rawPOs = [] } = useQuery(`
        SELECT po.*, 
               (SELECT json_group_array(json_object(
                   'id', id, 'material_id', material_id, 'quantity_ordered', quantity_ordered, 'received_qty', received_qty
               )) FROM po_items WHERE po_id = po.id) as items_json
        FROM purchase_orders po WHERE job_id = ?
    `, [job.id]);

    const { data: tickets = [] } = useQuery('SELECT * FROM delivery_tickets WHERE job_id = ?', [job.id]);

    const { data: rawAreas = [] } = useQuery(`
        SELECT * FROM areas 
        WHERE type = 'logistics' AND unit_id IN (
            SELECT id FROM units 
            WHERE floor_id IN (
                SELECT id FROM floors 
                WHERE job_id = ?
            )
        )
    `, [job.id]);

    // --- WEB FALLBACK (PLATFORM SPECIFIC) ---
    const [webMaterials, setWebMaterials] = useState<any[]>([]);
    const [webPOs, setWebPOs] = useState<any[]>([]);
    const [webTickets, setWebTickets] = useState<any[]>([]);
    const [webAreas, setWebAreas] = useState<any[]>([]);
    const [webLoading, setWebLoading] = useState(false);

    const isWeb = Platform.OS === 'web';

    useEffect(() => {
        if (isWeb) {
            const fetchWebData = async () => {
                setWebLoading(true);
                try {
                    const [mats, pos, tkt, structure] = await Promise.all([
                        SupabaseService.getProjectMaterials(job.id),
                        SupabaseService.getPurchaseOrders(job.id),
                        SupabaseService.getDeliveryTickets(job.id),
                        SupabaseService.getJob(job.id)
                    ]);
                    setWebMaterials(mats);
                    setWebPOs(pos);
                    setWebTickets(tkt);

                    // Flatten areas from structure (which is a Job object)
                    const flatAreas: any[] = [];
                    (structure?.floors || []).forEach((f: any) => {
                        (f.units || []).forEach((u: any) => {
                            (u.areas || []).forEach((a: any) => {
                                if (a.type === 'logistics') {
                                    flatAreas.push(a);
                                }
                            });
                        });
                    });
                    setWebAreas(flatAreas);
                } catch (err) {
                    console.error("Web Fetch Error:", err);
                } finally {
                    setWebLoading(false);
                }
            };
            fetchWebData();
        }
    }, [job.id, isWeb]);

    // --- MERGED DATA STREAMS ---
    const finalMaterials = useMemo(() => isWeb ? webMaterials : materials, [isWeb, webMaterials, materials]);
    const finalPOs = useMemo(() => isWeb ? webPOs : rawPOs, [isWeb, webPOs, rawPOs]);
    const finalTickets = useMemo(() => isWeb ? webTickets : tickets, [isWeb, webTickets, tickets]);
    const finalAreas = useMemo(() => isWeb ? webAreas : rawAreas, [isWeb, webAreas, rawAreas]);

    const purchaseOrders = useMemo(() => {
        return (finalPOs as any[]).map(po => ({
            ...po,
            items: isWeb ? (po.items || []) : JSON.parse(po.items_json || '[]')
        }));
    }, [finalPOs, isWeb]);

    // Modal State
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [ticketModalVisible, setTicketModalVisible] = useState(false);
    const [poDrawerVisible, setPoDrawerVisible] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<ProjectMaterial | null>(null);
    const [lockedAreaId, setLockedAreaId] = useState<string | undefined>(undefined);
    const [editAreaModalVisible, setEditAreaModalVisible] = useState(false);
    const [selectedAreaForEdit, setSelectedAreaForEdit] = useState<any>(null);
    const [selectedTicket, setSelectedTicket] = useState<DeliveryTicket | null>(null);

    // View State
    const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'TILE & STONE': true,
        'SETTING MATERIALS': true,
        'MISC / OTHER ITEMS': true,
        'DELIVERY MANAGEMENT': true,
        'VENDOR ORDERS': true
    });

    // --- COMPUTED DATA (ISOLATED DOMAIN) ---
    const allAreas = useMemo(() => {
        const areaIds = new Set(finalAreas.map(a => a.id));
        const realNames = new Set(finalAreas.map(a => (a.name || '').toLowerCase()));
        const virtualAreas: any[] = [];
        const seenLocations = new Set<string>();

        finalMaterials.forEach(m => {
            const isLogisticsArea = m.area_id && areaIds.has(m.area_id);
            const matchesLogisticsName = m.sub_location && realNames.has(m.sub_location.toLowerCase());
            const hasLogisticsAssignment = isLogisticsArea || matchesLogisticsName;

            if (!hasLogisticsAssignment && m.sub_location && m.sub_location !== 'Unassigned') {
                const rawLoc = m.sub_location.trim();
                const locKey = rawLoc.toLowerCase();
                if (!seenLocations.has(locKey)) {
                    seenLocations.add(locKey);
                    virtualAreas.push({
                        id: `loc-${locKey}`, // Normalized ID
                        name: rawLoc, // Preserve original casing for display
                        is_virtual: true,
                        description: 'Area Logistics Breakdown'
                    });
                }
            }
        });

        const sortedRealAreas = [...finalAreas].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        return [...sortedRealAreas, ...virtualAreas];
    }, [finalAreas, finalMaterials]);

    const sortedMaterials = useMemo(() => {
        return [...finalMaterials].sort((a, b) => (a.product_code || '').localeCompare(b.product_code || ''));
    }, [finalMaterials]);

    const materialsWithPOData = useMemo(() => {
        const poMetadataMap: Record<string, {
            total_ordered: number;
            all_pos: any[];
            active_pos: any[];
            nearest_expected: string | null;
        }> = {};

        purchaseOrders.forEach(po => {
            if (po.status === 'Draft') return;
            (po.items || []).forEach((item: any) => {
                const matId = item.material_id;
                if (!poMetadataMap[matId]) {
                    poMetadataMap[matId] = { total_ordered: 0, all_pos: [], active_pos: [], nearest_expected: null };
                }
                poMetadataMap[matId].total_ordered += Number(item.quantity_ordered || 0);
                poMetadataMap[matId].all_pos.push({
                    id: po.id,
                    po_number: po.po_number,
                    vendor: po.vendor,
                    created_at: po.created_at,
                    status: po.status,
                    quantity: item.quantity_ordered
                });
                if (po.status === 'Ordered' || po.status === 'Partial') {
                    poMetadataMap[matId].active_pos.push({ id: po.id, po_number: po.po_number, status: po.status });
                    if (po.expected_date) {
                        const date = po.expected_date;
                        if (!poMetadataMap[matId].nearest_expected || date < poMetadataMap[matId].nearest_expected) {
                            poMetadataMap[matId].nearest_expected = date;
                        }
                    }
                }
            });
        });

        return sortedMaterials.map(m => {
            const meta = poMetadataMap[m.id] || { total_ordered: 0, all_pos: [], active_pos: [], nearest_expected: null };
            return {
                ...m,
                ordered_qty: meta.total_ordered,
                active_pos: meta.active_pos,
                all_pos: meta.all_pos,
                nearest_expected_date: meta.nearest_expected
            };
        });
    }, [sortedMaterials, purchaseOrders]);

    const materialsByArea = useMemo(() => {
        const map: Record<string, ProjectMaterial[]> = {};
        const areaIds = new Set(finalAreas.map(a => a.id));
        const realNamesToIds = finalAreas.reduce((acc, a) => {
            acc[(a.name || '').trim().toLowerCase()] = a.id;
            return acc;
        }, {} as Record<string, string>);

        materialsWithPOData.forEach(m => {
            let areaId = m.area_id;
            const isRealLogisticsArea = areaId && areaIds.has(areaId);

            // Logic: If area_id is not a real Logistics area, try to map sub_location to a real Logistics Area.
            // If still nothing, use sub_location as a virtual area (loc-NAME).
            if (!isRealLogisticsArea) {
                const subLoc = m.sub_location ? m.sub_location.trim() : '';
                const mappedId = subLoc ? realNamesToIds[subLoc.toLowerCase()] : null;

                if (mappedId) {
                    areaId = mappedId;
                } else if (subLoc && subLoc !== 'Unassigned') {
                    areaId = `loc-${subLoc.toLowerCase()}`;
                } else {
                    areaId = 'Unassigned';
                }
            }

            if (!map[areaId]) map[areaId] = [];
            map[areaId].push(m as ProjectMaterial);
        });
        return map;
    }, [materialsWithPOData, finalAreas]);

    const aggregatedMaterials = useMemo(() => {
        const groups: Record<string, any> = {};
        materialsWithPOData.forEach(m => {
            const key = `${m.product_code}-${m.product_name}-${m.category}`;
            if (!groups[key]) {
                groups[key] = {
                    ...m,
                    net_qty: 0, waste_qty: 0, budget_qty: 0,
                    ordered_qty: 0, shop_stock: 0, in_transit: 0, received_at_job: 0,
                    qty_damaged: 0, qty_missing: 0,
                    total_value: 0,
                    locations: new Set<string>(),
                    zones: new Set<string>(),
                    all_ids: new Set<string>(),
                    active_pos: [],
                    all_pos: [],
                    nearest_expected_date: null
                };
            }
            if (m.sub_location) groups[key].locations.add(m.sub_location);
            if (m.zone) groups[key].zones.add(m.zone);
            groups[key].all_ids.add(m.id);
            groups[key].net_qty += Number(m.net_qty || 0);
            groups[key].waste_qty += Number(m.net_qty || 0) * (Number(m.waste_percent || 0) / 100);
            groups[key].budget_qty += Number(m.budget_qty || 0);
            groups[key].ordered_qty += Number(m.ordered_qty || 0);
            groups[key].shop_stock += Number(m.shop_stock || 0);
            groups[key].in_transit += Number(m.in_transit || 0);
            groups[key].received_at_job += Number(m.received_at_job || 0);
            groups[key].qty_damaged += Number(m.qty_damaged || 0);
            groups[key].qty_missing += Number(m.qty_missing || 0);
            groups[key].total_value += Number(m.budget_qty || 0) * Number(m.unit_cost || 0);
            if (m.active_pos) {
                m.active_pos.forEach((p: any) => {
                    if (!groups[key].active_pos.find((ap: any) => ap.id === p.id)) groups[key].active_pos.push(p);
                });
            }
            if (m.all_pos) {
                m.all_pos.forEach((p: any) => {
                    const existing = groups[key].all_pos.find((ep: any) => ep.id === p.id);
                    if (existing) {
                        existing.quantity = (Number(existing.quantity) || 0) + (Number(p.quantity) || 0);
                    } else {
                        groups[key].all_pos.push({ ...p });
                    }
                });
            }
            if (m.nearest_expected_date) {
                if (!groups[key].nearest_expected_date || m.nearest_expected_date < groups[key].nearest_expected_date) {
                    groups[key].nearest_expected_date = m.nearest_expected_date;
                }
            }
        });
        return Object.values(groups);
    }, [materialsWithPOData]);

    const categories = useMemo(() => [
        { label: 'TILE & STONE', tags: ['Tile', 'Slab', 'Stone', 'Base'] },
        { label: 'SETTING MATERIALS', tags: ['Grout', 'Caulk', 'Thinset', 'Schluter', 'Underlayment'] },
        { label: 'MISC / OTHER ITEMS', tags: [] }
    ], []);

    // --- HANDLERS ---
    const handleAddMaterial = () => {
        setLockedAreaId(undefined);
        setAddModalVisible(true);
    };

    const handleEditMaterial = (m: ProjectMaterial) => {
        setSelectedMaterial(m);
        setAddModalVisible(true);
    };

    const handleDeleteMaterial = async (id: string) => {
        if (Platform.OS === 'web') {
            if (!window.confirm("Delete this budget item?")) return;
        } else {
            const confirmed = await new Promise(resolve => {
                Alert.alert("Delete Item", "Are you sure?", [{ text: "Cancel", onPress: () => resolve(false) }, { text: "Delete", onPress: () => resolve(true) }]);
            });
            if (!confirmed) return;
        }
        try {
            await SupabaseService.deleteProjectMaterial(id);
            if (isWeb) {
                // Refresh local state on web
                setWebMaterials(prev => prev.filter(m => m.id !== id));
            }
        } catch (err) {
            console.error("Delete Error:", err);
            Alert.alert("Error", "Failed to delete item");
        }
    };

    const handleDeleteArea = async (areaId: string) => {
        const isVirtual = areaId.startsWith('loc-');

        if (Platform.OS === 'web') {
            if (!window.confirm(`Delete this ${isVirtual ? 'room location' : 'area'}?`)) return;
        }

        try {
            if (isVirtual) {
                const locName = areaId.replace('loc-', '');
                const materialsToUpdate = finalMaterials.filter(m => (m.sub_location || 'Unassigned') === locName);
                for (const m of materialsToUpdate) {
                    await SupabaseService.saveProjectMaterial({ ...m, sub_location: 'Unassigned' });
                }
            } else {
                await SupabaseService.deleteArea(areaId);
            }

            if (isWeb) {
                const refreshed = await SupabaseService.getProjectMaterials(job.id);
                setWebMaterials(refreshed);
                // Also refresh areas if it was a real one
                if (!isVirtual) {
                    const structure = await SupabaseService.getJob(job.id);
                    const flatAreas: any[] = [];
                    (structure?.floors || []).forEach((f: any) => {
                        (f.units || []).forEach((u: any) => {
                            (u.areas || []).forEach((a: any) => {
                                if (a.type === 'logistics') flatAreas.push(a);
                            });
                        });
                    });
                    setWebAreas(flatAreas);
                }
            }
        } catch (err) {
            console.error("Delete Area Error:", err);
            Alert.alert("Error", "Failed to clear location");
        }
    };

    const handleEditArea = (area: any) => {
        setSelectedAreaForEdit(area);
        setEditAreaModalVisible(true);
    };

    const handleSaveArea = async (areaId: string, updates: any) => {
        const isVirtual = areaId.startsWith('loc-');
        try {
            if (isVirtual) {
                const oldLocName = areaId.replace('loc-', '');
                const newLocName = updates.name;
                const materialsToUpdate = finalMaterials.filter(m => m.sub_location === oldLocName);
                for (const m of materialsToUpdate) {
                    await SupabaseService.saveProjectMaterial({ ...m, sub_location: newLocName });
                }
            } else {
                await SupabaseService.updateArea(areaId, updates);
            }

            if (isWeb) {
                const refreshed = await SupabaseService.getProjectMaterials(job.id);
                setWebMaterials(refreshed);
                if (!isVirtual) {
                    const structure = await SupabaseService.getJob(job.id);
                    const flatAreas: any[] = [];
                    (structure?.floors || []).forEach((f: any) => {
                        (f.units || []).forEach((u: any) => {
                            (u.areas || []).forEach((a: any) => {
                                if (a.type === 'logistics') flatAreas.push(a);
                            });
                        });
                    });
                    setWebAreas(flatAreas);
                }
            }
        } catch (err) {
            console.error("Save Area Error:", err);
            Alert.alert("Error", "Failed to update location name");
        }
    };

    const handleUpdateTicketStatus = async (ticket: DeliveryTicket, newStatus: string) => {
        try {
            await SupabaseService.updateTicketStatus(ticket.id, newStatus);
            if (isWeb) {
                setWebTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t));
            }
        } catch (err) {
            console.error("Update Ticket Error:", err);
            Alert.alert("Error", "Failed to update delivery status");
        }
    };

    const handleDeleteTicket = async (id: string) => {
        if (Platform.OS === 'web') {
            if (!window.confirm("Delete this delivery ticket?")) return;
        } else {
            const confirmed = await new Promise(resolve => {
                Alert.alert("Delete Ticket", "Are you sure?", [{ text: "Cancel", onPress: () => resolve(false) }, { text: "Delete", onPress: () => resolve(true) }]);
            });
            if (!confirmed) return;
        }
        try {
            await SupabaseService.deleteDeliveryTicket(id);
            if (isWeb) {
                setWebTickets(prev => prev.filter(t => t.id !== id));
            }
        } catch (err) {
            console.error("Delete Ticket Error:", err);
            Alert.alert("Error", "Failed to delete ticket");
        }
    };

    const handleEditTicket = (ticket: DeliveryTicket) => {
        setSelectedTicket(ticket);
        setTicketModalVisible(true);
    };

    const handleSaveMaterial = async (mat: Partial<ProjectMaterial>) => {
        try {
            await SupabaseService.saveProjectMaterial({ ...mat, job_id: job.id });
            if (isWeb) {
                // Refresh materials AND areas/structure because a new area might have been created
                const [updatedMat, structure] = await Promise.all([
                    SupabaseService.getProjectMaterials(job.id),
                    SupabaseService.getJob(job.id)
                ]);

                setWebMaterials(updatedMat);

                // Re-flatten areas from the fresh structure
                const flatAreas: any[] = [];
                (structure?.floors || []).forEach((f: any) => {
                    (f.units || []).forEach((u: any) => {
                        (u.areas || []).forEach((a: any) => {
                            if (a.type === 'logistics') {
                                flatAreas.push(a);
                            }
                        });
                    });
                });
                setWebAreas(flatAreas);
            }
            setAddModalVisible(false);
            setSelectedMaterial(null);
        } catch (err) {
            console.error("Save Material Error:", err);
            Alert.alert("Error", "Failed to save budget item");
        }
    };

    const handleSavePurchaseOrder = async (poData: any) => {
        try {
            await SupabaseService.savePurchaseOrder(poData, job.id);
            if (isWeb) {
                const updatedPOs = await SupabaseService.getPurchaseOrders(job.id);
                setWebPOs(updatedPOs);
            }
            setPoDrawerVisible(false);
            Alert.alert("Success", "Purchase Order updated successfully");
        } catch (err) {
            console.error("Save PO Error:", err);
            Alert.alert("Error", "Failed to save Purchase Order");
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // --- RENDER ---
    return (
        <View className="flex-1 bg-slate-50">
            {/* Header / Tabs */}
            <View className="bg-white px-8 pt-8 pb-4 border-b border-slate-200">
                <View className="flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center gap-2">
                        <View className="bg-blue-600 p-2 rounded-xl">
                            <Ionicons name="cube" size={20} color="white" />
                        </View>
                        <Text className="text-2xl font-inter font-black text-slate-900 tracking-tight">Logistics Engine</Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                            onPress={handleAddMaterial}
                            className="flex-row items-center bg-blue-600 px-6 py-3 rounded-2xl shadow-sm active:bg-blue-700"
                        >
                            <Ionicons name="add" size={20} color="white" />
                            <Text className="text-white font-inter font-black ml-2 uppercase text-xs tracking-wider">Add Item</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setTicketModalVisible(true)}
                            className="flex-row items-center bg-white border border-slate-200 px-6 py-3 rounded-2xl active:bg-slate-50"
                        >
                            <Ionicons name="paper-plane" size={18} color="#64748b" />
                            <Text className="text-slate-600 font-inter font-black ml-2 uppercase text-xs tracking-wider">Create Delivery</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tab Switcher */}
                <View className="flex-row gap-2">
                    {[
                        { id: 'area', label: 'By Area', icon: Grid },
                        { id: 'project', label: 'Project Total', icon: BarChart2 },
                        { id: 'deliveries', label: 'Deliveries', icon: Truck }
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => setViewMode(tab.id as ViewMode)}
                            className={`flex-row items-center px-6 py-3 rounded-xl ${viewMode === tab.id ? 'bg-slate-900' : 'bg-transparent'}`}
                        >
                            <tab.icon size={18} color={viewMode === tab.id ? 'white' : '#94a3b8'} />
                            <Text className={`font-inter font-black ml-2 uppercase text-[11px] tracking-widest ${viewMode === tab.id ? 'text-white' : 'text-slate-400'}`}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Content Area */}
            <View className="flex-1">
                {isWeb && webLoading ? (
                    <View className="flex-1 justify-center items-center py-20">
                        <ActivityIndicator size="large" color="#2563eb" />
                        <Text className="mt-4 text-slate-500 font-inter font-black uppercase tracking-widest text-xs">Hydrating High-Density Grid...</Text>
                        <Text className="mt-1 text-slate-400 font-inter font-medium text-[10px]">Restoring platform consistency for 19-column view</Text>
                    </View>
                ) : (
                    <>
                        {viewMode === 'area' && (
                            <View className="flex-1">
                                <AreaBudgetView
                                    allAreas={allAreas}
                                    materialsByArea={materialsByArea}
                                    expandedAreas={expandedAreas}
                                    toggleArea={(areaId) => setExpandedAreas(prev => ({ ...prev, [areaId]: !prev[areaId] }))}
                                    onAddMaterial={(areaId) => {
                                        setLockedAreaId(areaId);
                                        setAddModalVisible(true);
                                    }}
                                    onEditMaterial={handleEditMaterial}
                                    onDeleteMaterial={handleDeleteMaterial}
                                    onDeleteArea={handleDeleteArea}
                                    onEditArea={handleEditArea}
                                    onOrder={(m) => {
                                        setSelectedMaterial(m);
                                        setPoDrawerVisible(true);
                                    }}
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
                                    setPoDrawerVisible(true);
                                }}
                            />
                        )}

                        {viewMode === 'deliveries' && (
                            <DeliveriesView
                                tickets={finalTickets as DeliveryTicket[]}
                                onCreateTicket={() => {
                                    setSelectedTicket(null);
                                    setTicketModalVisible(true);
                                }}
                                onUpdateStatus={handleUpdateTicketStatus}
                                onDeleteTicket={handleDeleteTicket}
                                onEditTicket={handleEditTicket}
                            />
                        )}
                    </>
                )}
            </View>

            {/* Modals */}
            <AddBudgetItemModal
                visible={addModalVisible}
                onClose={() => {
                    setAddModalVisible(false);
                    setSelectedMaterial(null);
                }}
                onSave={handleSaveMaterial}
                initialData={selectedMaterial}
                areas={allAreas}
                lockedAreaId={lockedAreaId}
            />

            {ticketModalVisible && (
                <DeliveryTicketModal
                    visible={ticketModalVisible}
                    onClose={() => {
                        setTicketModalVisible(false);
                        setSelectedTicket(null);
                    }}
                    materials={finalMaterials as ProjectMaterial[]}
                    jobId={job.id}
                    jobName={job.name}
                    initialData={selectedTicket}
                    onSuccess={() => {
                        if (isWeb) {
                            SupabaseService.getDeliveryTickets(job.id).then(setWebTickets);
                        }
                        setTicketModalVisible(false);
                        setSelectedTicket(null);
                    }}
                />
            )}

            {poDrawerVisible && (
                <PurchaseOrderDrawer
                    visible={poDrawerVisible}
                    onClose={() => setPoDrawerVisible(false)}
                    material={selectedMaterial}
                    existingPOs={purchaseOrders as PurchaseOrder[]}
                    onSave={handleSavePurchaseOrder}
                />
            )}

            {editAreaModalVisible && (
                <EditAreaModal
                    visible={editAreaModalVisible}
                    onClose={() => setEditAreaModalVisible(false)}
                    onSave={handleSaveArea}
                    area={selectedAreaForEdit}
                />
            )}
        </View>
    );
}
