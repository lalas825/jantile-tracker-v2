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
        setExistingData({ name: area.name, areaName: area.name, description: area.description });
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
                await SupabaseService.addArea(modalTarget.unitId, data.name || 'New Area', data.description || '');
            } else if (modalMode === 'edit-area' && modalTarget?.areaId) {
                await SupabaseService.updateArea(modalTarget.areaId, {
                    name: data.name,
                    description: data.description
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
                floors={job?.floors || []}
                onEditFloor={handleEditFloor}
                onDeleteFloor={handleDeleteFloor}
                onAddUnit={handleAddUnit}
                onEditUnit={handleEditUnit}
                onDeleteUnit={handleDeleteUnit}
                onAddArea={handleAddArea}
                onEditArea={handleEditArea}
                onDeleteArea={handleDeleteArea}
                onAreaPress={handleAreaOpen}
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

            <AreaDetailsDrawer
                isVisible={drawerVisible}
                onClose={() => setDrawerVisible(false)}
                area={selectedArea}
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
