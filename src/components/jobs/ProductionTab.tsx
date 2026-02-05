import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { SupabaseService } from '../../services/SupabaseService';
// We import types from MockJobStore for now as SupabaseService types might need adjustment or we can just use them if they match.
// Ideally we should move types to a shared types file or SupabaseService.
import { Floor, Unit, Job } from '../../services/MockJobStore';
import StructureModal from '../modals/StructureModal';
import AreaDetailsDrawer from './AreaDetailsDrawer';
import StructureModule from '../StructureModule';
import CloningModal from '../modals/CloningModal';
import { db } from '../../powersync/db';
import { randomUUID } from 'expo-crypto';

type StructureModalMode = 'add-floor' | 'edit-floor' | 'add-unit' | 'edit-unit' | 'edit-area' | 'add-area';
type StructureModalData = { name: string; unitName?: string; description?: string; areaName?: string };

const confirmDelete = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n${message}`)) {
            onConfirm();
        }
    } else {
        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onConfirm }
        ]);
    }
};

export default function ProductionTab({ job, setJob }: { job: Job, setJob: (j: Job) => void }) {
    const [modalVisible, setModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState<StructureModalMode>('add-floor');
    const [modalTarget, setModalTarget] = useState<{ floorId?: string, unitId?: string, areaId?: string } | null>(null);
    const [existingData, setExistingData] = useState<StructureModalData | null>(null);

    // Cloning State
    const [cloningModalVisible, setCloningModalVisible] = useState(false);
    const [cloningSource, setCloningSource] = useState<{ type: 'floor' | 'unit', data: any } | null>(null);
    const [cloningLoading, setCloningLoading] = useState(false);

    // Drawer State
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [selectedArea, setSelectedArea] = useState<any>(null);

    const reloadJob = async () => {
        if (!job?.id) return;
        try {
            const updatedJob = await SupabaseService.getJob(job.id);
            if (updatedJob) {
                setJob(updatedJob as unknown as Job);
            }
        } catch (err) {
            console.error("Failed to reload job:", err);
        }
    };

    const handleAreaOpen = (area: any) => {
        setSelectedArea(area);
        setDrawerVisible(true);
    };

    const handleAddFloor = () => {
        setModalMode('add-floor');
        setModalTarget(null);
        setExistingData(null);
        setModalVisible(true);
    };

    const handleEditFloor = (floor: Floor) => {
        setModalMode('edit-floor');
        setModalTarget({ floorId: floor.id });
        setExistingData({ name: floor.name });
        setModalVisible(true);
    };

    const handleDeleteFloor = (floorId: string) => {
        confirmDelete("Delete Floor?", "This will delete the floor and all its units/areas.", async () => {
            try {
                await SupabaseService.deleteFloor(floorId);
                reloadJob();
            } catch (error) {
                alert('Error deleting floor');
            }
        });
    };

    const handleAddUnit = (floorId: string) => {
        setModalMode('add-unit');
        setModalTarget({ floorId });
        setExistingData(null);
        setModalVisible(true);
    };

    const handleEditUnit = (floorId: string, unitId: string) => {
        const floor = job?.floors?.find(f => f.id === floorId);
        const unit = floor?.units?.find(u => u.id === unitId);
        if (!unit) return;

        setModalMode('edit-unit');
        setModalTarget({ floorId, unitId });
        setExistingData({ name: unit.name });
        setModalVisible(true);
    };

    const handleDeleteUnit = (floorId: string, unitId: string) => {
        confirmDelete("Delete Unit?", "This will delete the unit and all its areas.", async () => {
            try {
                await SupabaseService.deleteUnit(unitId);
                reloadJob();
            } catch (error) {
                alert('Error deleting unit');
            }
        });
    };

    const handleAddArea = (floorId: string, unitId: string) => {
        setModalMode('add-area');
        setModalTarget({ floorId, unitId });
        setExistingData(null);
        setModalVisible(true);
    };

    const handleEditArea = (floorId: string, unitId: string, area: any) => {
        setModalMode('edit-area');
        setModalTarget({ floorId, unitId, areaId: area.id });
        setExistingData({ name: area.name, areaName: area.name, description: area.description, drawingPage: area.drawing_page } as any);
        setModalVisible(true);
    };

    const handleDeleteArea = (floorId: string, unitId: string, areaId: string) => {
        confirmDelete("Delete Area?", "This action cannot be undone.", async () => {
            try {
                await SupabaseService.deleteArea(areaId);
                await reloadJob();
            } catch (error) {
                alert('Error deleting area');
            }
        });
    };

    // --- CLONING ENGINE ---
    const handleCloneFloor = (floor: Floor) => {
        setCloningSource({ type: 'floor', data: floor });
        setCloningModalVisible(true);
    };

    const handleCloneUnit = (floorId: string, unit: Unit) => {
        setCloningSource({ type: 'unit', data: unit });
        setCloningModalVisible(true);
    };

    const getUUID = () => {
        try {
            const uuid = randomUUID();
            if (!uuid) throw new Error("UUID is empty");
            return uuid;
        } catch (e) {
            // Web fallback for non-secure contexts
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    };

    const performClone = async (targetFloorIds: string[]) => {
        console.log("Starting clone for targets:", targetFloorIds, "Source:", cloningSource?.type);
        if (!cloningSource || !job) {
            console.error("Missing cloning source or job data", { cloningSource, job: !!job });
            return;
        }

        setCloningLoading(true);
        try {
            const now = new Date().toISOString();
            const isMock = !!db.isMock;

            if (!isMock) {
                // PowerSync Transaction (Native)
                await db.writeTransaction(async (tx: any) => {
                    for (const targetFloorId of targetFloorIds) {
                        const targetFloor = job.floors?.find((f: any) => f.id === targetFloorId);
                        if (!targetFloor) continue;

                        const unitsToClone = cloningSource.type === 'unit' ? [cloningSource.data] : (cloningSource.data.units || []);
                        console.log(`Units to clone to floor ${targetFloor.name}:`, unitsToClone.length);

                        for (const sourceUnit of unitsToClone) {
                            const newUnitId = getUUID();
                            const newUnitName = `${sourceUnit.name} - ${targetFloor.name}`;
                            console.log(`  Cloning unit: ${sourceUnit.name} -> ${newUnitName}`);

                            await tx.execute(
                                `INSERT INTO units (id, floor_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)`,
                                [newUnitId, targetFloorId, newUnitName, 'production', now]
                            );

                            if (sourceUnit.areas) {
                                for (const area of sourceUnit.areas) {
                                    const newAreaId = getUUID();
                                    await tx.execute(
                                        `INSERT INTO areas (id, unit_id, name, description, type, status, progress, drawing_page, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                        [newAreaId, newUnitId, area.name, area.description || '', 'production', area.status || 'NOT_STARTED', area.progress || 0, area.drawing_page || '', now]
                                    );
                                }
                            }
                        }
                    }
                });
            } else {
                // Supabase Sequential (Web Fallback)
                for (const targetFloorId of targetFloorIds) {
                    const targetFloor = job.floors?.find((f: any) => f.id === targetFloorId);
                    if (!targetFloor) continue;

                    const unitsToClone = cloningSource.type === 'unit' ? [cloningSource.data] : (cloningSource.data.units || []);
                    console.log(`Units to clone (Web) to floor ${targetFloor.name}:`, unitsToClone.length);

                    for (const sourceUnit of unitsToClone) {
                        const newUnitName = `${sourceUnit.name} - ${targetFloor.name}`;
                        console.log(`  Cloning unit: ${sourceUnit.name} -> ${newUnitName}`);
                        const newUnitId = await SupabaseService.addUnit(targetFloorId, newUnitName, 'production');

                        if (sourceUnit.areas) {
                            for (const area of sourceUnit.areas) {
                                await SupabaseService.addArea(newUnitId, area.name, area.description || '', area.drawing_page || '', 'production');
                            }
                        }
                    }
                }
            }

            console.log("Cloning completed successfully");
            setCloningModalVisible(false);
            setCloningSource(null);
            await reloadJob();

            if (Platform.OS === 'web') {
                alert("Structure cloned successfully");
            } else {
                Alert.alert("Success", "Structure cloned successfully");
            }
        } catch (error: any) {
            console.error("Cloning Error Detail:", error);
            const msg = "Failed to clone structure: " + error.message;
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert("Error", msg);
        } finally {
            setCloningLoading(false);
        }
    };

    const handleStructureSubmit = async (data: any) => {
        if (!job) return;
        try {
            if (modalMode === 'add-floor') {
                await SupabaseService.addFloor(job.id, data.name);
            } else if (modalMode === 'edit-floor' && modalTarget?.floorId) {
                await SupabaseService.updateFloorName(modalTarget.floorId, data.name, data.description);
            } else if (modalMode === 'add-unit' && modalTarget?.floorId) {
                await SupabaseService.addUnit(modalTarget.floorId, data.name || 'New Unit');
            } else if (modalMode === 'edit-unit' && modalTarget?.unitId) {
                await SupabaseService.updateUnitName(modalTarget.unitId, data.name, data.description);
            } else if (modalMode === 'add-area' && modalTarget?.unitId) {
                await SupabaseService.addArea(modalTarget.unitId, data.name || 'New Area', data.description || '', data.drawingPage);
            } else if (modalMode === 'edit-area' && modalTarget?.areaId) {
                await SupabaseService.updateArea(modalTarget.areaId, {
                    name: data.name,
                    description: data.description,
                    drawing_page: data.drawingPage
                });
            }
            await reloadJob();
            setModalVisible(false);
        } catch (error: any) {
            console.error(error);
            alert('Error saving structure: ' + error.message);
        }
    };

    const getModalProps = () => {
        switch (modalMode) {
            case 'add-floor': return { mode: 'create', type: 'floor' };
            case 'edit-floor': return { mode: 'edit', type: 'floor', initialData: existingData };
            case 'add-unit': return { mode: 'create', type: 'unit' };
            case 'edit-unit': return { mode: 'edit', type: 'unit', initialData: existingData };
            case 'add-area': return { mode: 'create', type: 'area' };
            case 'edit-area': return { mode: 'edit', type: 'area', initialData: existingData };
            default: return { mode: 'create', type: 'floor' };
        }
    };

    return (
        <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
            <View className="mb-8 flex-row items-center justify-between">
                <View>
                    <Text className="text-2xl font-black text-slate-900 tracking-tight">Production Overview</Text>
                    <Text className="text-slate-500 font-medium mt-1">Manage floors, units, and areas</Text>
                </View>
            </View>

            <StructureModule
                floors={job?.floors?.map(f => ({
                    ...f,
                    units: f.units?.filter((u: any) => u.type !== 'logistics').map((u: any) => {
                        const productionAreas = u.areas?.filter((a: any) => !a.type || a.type === 'production');

                        // Hide unit if:
                        // 1. It only has hidden logistics areas
                        const hasOnlyHiddenAreas = (u.areas?.length || 0) > 0 && (productionAreas?.length || 0) === 0;
                        if (hasOnlyHiddenAreas) return null;

                        // 2. It is an empty auto-created unit (name "General")
                        if ((u.areas?.length || 0) === 0 && u.name === "General") return null;

                        return {
                            ...u,
                            areas: productionAreas
                        };
                    }).filter(Boolean) as any
                })) || []}
                onEditFloor={handleEditFloor}
                onDeleteFloor={handleDeleteFloor}
                onAddUnit={handleAddUnit}
                onEditUnit={handleEditUnit}
                onDeleteUnit={handleDeleteUnit}
                onAddArea={handleAddArea}
                onEditArea={handleEditArea}
                onDeleteArea={handleDeleteArea}
                onAreaPress={handleAreaOpen}
                onCloneFloor={handleCloneFloor}
                onCloneUnit={handleCloneUnit}
            />

            {(!job?.floors || job.floors.length === 0) && (
                <View className="items-center justify-center py-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <Text className="text-slate-400 text-lg font-bold">No floors added yet</Text>
                </View>
            )}

            <TouchableOpacity
                className="flex-row items-center justify-center py-5 border-2 border-dashed border-slate-300 rounded-2xl active:bg-slate-50 mt-8 mb-10"
                onPress={handleAddFloor}
            >
                <Plus size={20} color="#64748b" />
                <Text className="text-slate-600 font-bold ml-2 text-base">Add New Floor</Text>
            </TouchableOpacity>

            <StructureModal
                isVisible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSubmit={handleStructureSubmit}
                {...getModalProps() as any}
            />

            <CloningModal
                isVisible={cloningModalVisible}
                onClose={() => setCloningModalVisible(false)}
                onConfirm={performClone}
                floors={job?.floors?.map(f => ({ id: f.id, name: f.name })) || []}
                title={cloningSource?.type === 'floor' ? "Clone Floor Structure" : "Clone Unit Structure"}
                sourceName={cloningSource?.data?.name}
                loading={cloningLoading}
            />

            <AreaDetailsDrawer
                isVisible={drawerVisible}
                onClose={() => setDrawerVisible(false)}
                area={selectedArea}
                jobId={job.id}
                onUpdate={async (newChecklist: any[]) => {
                    if (selectedArea) {
                        // Calculate new progress
                        const totalItems = newChecklist.filter((i: any) => i.status !== 'NA').length;
                        const completedItems = newChecklist.filter((i: any) => i.status === 'COMPLETED').length;
                        const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                        console.log("Saving Area Progress:", progress);

                        // Optimistic Update of Job State for UI
                        if (job) {
                            const newFloors = job.floors?.map((floor: any) => ({
                                ...floor,
                                units: floor.units?.map((unit: any) => ({
                                    ...unit,
                                    // Non-destructive update: Update progress for target, keep others as is
                                    // Note: This matches local state, which might include logistics areas. 
                                    // StructureModule filters them out for display.
                                    areas: unit.areas?.map((a: any) =>
                                        a.id === selectedArea.id ? { ...a, progress } : a
                                    )
                                }))
                            }));
                            setJob({ ...job, floors: newFloors } as Job);
                        }

                        // Persist to DB
                        try {
                            await SupabaseService.updateArea(selectedArea.id, { progress });
                        } catch (e) {
                            console.error("Failed to save area progress", e);
                        }
                    }
                }}
                onAddPhoto={async (uri: string) => {
                    if (!selectedArea) return;
                    try {
                        await SupabaseService.uploadAreaPhoto(selectedArea.id, uri);
                        await reloadJob();
                        // Update selected area to show new photo immediately
                        const updatedJob = await SupabaseService.getJob(job.id);
                        if (updatedJob) {
                            const newArea = (updatedJob as any).floors
                                ?.flatMap((f: any) => f.units)
                                ?.flatMap((u: any) => u.areas)
                                ?.find((a: any) => a.id === selectedArea.id);
                            if (newArea) setSelectedArea(newArea);
                        }
                    } catch (e: any) {
                        console.error("Upload failed", e);
                        alert("Upload failed: " + e.message);
                    }
                }}
                onDeletePhoto={async (uri: string) => {
                    if (!selectedArea) return;
                    // Find the photo ID and storage path from the URI (or searching in selectedArea.area_photos)
                    const photo = (selectedArea.area_photos || []).find((p: any) => p.url === uri);
                    if (!photo) return;

                    try {
                        await SupabaseService.deleteAreaPhoto(photo.id, photo.storage_path);
                        await reloadJob();
                        // Update selected area
                        const updatedJob = await SupabaseService.getJob(job.id);
                        if (updatedJob) {
                            const newArea = (updatedJob as any).floors
                                ?.flatMap((f: any) => f.units)
                                ?.flatMap((u: any) => u.areas)
                                ?.find((a: any) => a.id === selectedArea.id);
                            if (newArea) setSelectedArea(newArea);
                        }
                    } catch (e: any) {
                        console.error("Delete failed", e);
                        alert("Delete failed: " + e.message);
                    }
                }}
            />
        </ScrollView>
    );
}
