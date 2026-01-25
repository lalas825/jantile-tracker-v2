import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Platform } from 'react-native';
import { ChevronDown, ChevronRight, CheckCircle2, Clock, Plus, Pencil, Trash2 } from 'lucide-react-native';
import { Alert } from 'react-native';
import clsx from 'clsx';
import AreaDetailsDrawer, { AreaData, ChecklistItem } from './AreaDetailsDrawer';
import StructureModal from '../modals/StructureModal';
// Define types locally since they were removed from the modal file
type StructureModalMode = 'add-floor' | 'edit-floor' | 'add-unit' | 'edit-area';
type StructureModalData = { name: string; unitName?: string; description?: string; areaName?: string };
import { MockJobStore, Floor, Job } from '../../services/MockJobStore';

// --- Type Definitions ---
// Using Imported types from Store where possible, but locally defined props might need matching

// --- Helper Components ---
const StatusPill = ({ label, status }: { label: string, status: string }) => {
    if (status === 'NOT_STARTED' || status === 'PENDING') return null;

    return (
        <View className={clsx(
            "flex-row items-center px-1.5 py-0.5 rounded-full mr-2 mb-1",
            status === 'COMPLETED' || status === 'Done' ? "bg-green-100 border border-green-200" : "bg-blue-100 border border-blue-200"
        )}>
            <Text className={clsx(
                "text-[10px] font-bold mr-1",
                status === 'COMPLETED' || status === 'Done' ? "text-green-700" : "text-blue-700"
            )}>
                {label}
            </Text>
            {status === 'COMPLETED' || status === 'Done' ? <CheckCircle2 size={10} color="#15803d" /> : <Clock size={10} color="#1d4ed8" />}
        </View>
    );
};

const AreaCard = ({ area, onPress, canEdit, onEdit, onDelete }: {
    area: AreaData,
    onPress: (area: AreaData) => void,
    canEdit: boolean,
    onEdit: () => void,
    onDelete: () => void
}) => {
    // Traffic Light Logic
    let containerStyle = "border-slate-200 bg-white";
    let scoreColor = "text-slate-400";
    let barColor = "bg-slate-400";

    if (area.progress === 100) {
        containerStyle = "border-emerald-500 bg-emerald-50";
        scoreColor = "text-emerald-600";
        barColor = "bg-emerald-500";
    } else if (area.progress > 0) {
        containerStyle = "border-amber-400 bg-amber-50";
        scoreColor = "text-amber-600";
        barColor = "bg-amber-500";
    }

    // Task Summary Logic
    const completedCount = area.checklist.filter(i => i.status === 'COMPLETED').length;
    const totalCount = area.checklist.filter(i => i.status !== 'NA').length;
    const taskSummary = totalCount > 0
        ? `${completedCount}/${totalCount} Tasks Complete`
        : 'No Tasks Assigned';

    return (
        <TouchableOpacity
            onPress={() => onPress(area)}
            className={clsx(
                "p-4 mb-3 rounded-xl border shadow-sm active:opacity-80 transition-all",
                containerStyle
            )}
        >
            <View className="flex-row justify-between items-start">
                {/* Left Side: Info */}
                <View className="flex-1 mr-4">
                    <View className="flex-row items-center justify-between mr-2">
                        <Text className="text-lg font-bold text-slate-900 leading-tight flex-1">{area.name}</Text>
                        {/* Edit/Delete Icons for Area */}
                        {canEdit && (
                            <View className="flex-row items-center gap-3 ml-2">
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation(); onEdit(); }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Pencil size={16} color="#64748b" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation(); onDelete(); }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Trash2 size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <Text className="text-sm text-slate-500 font-medium mt-0.5">{area.description}</Text>

                    {/* Task Summary Text */}
                    <Text className={clsx(
                        "text-sm font-semibold mt-2",
                        area.progress === 100 ? "text-emerald-700" :
                            area.progress > 0 ? "text-amber-700" : "text-slate-600"
                    )}>
                        {taskSummary}
                    </Text>
                </View>

                {/* Right Side: Scoreboard */}
                <View className="items-end">
                    <Text className={clsx("text-2xl font-extrabold tracking-tighter", scoreColor)}>
                        {area.progress}%
                    </Text>
                    <View className="w-32 h-3 bg-white/60 rounded-full overflow-hidden mt-1 border border-black/5">
                        <View
                            className={clsx("h-full rounded-full", barColor)}
                            style={{ width: `${area.progress}%` }}
                        />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

type FloorAccordionProps = {
    floor: Floor;
    onAreaPress: (area: AreaData) => void;
    canEdit: boolean;
    onEditFloor: (floor: Floor) => void;
    onDeleteFloor: (floor: Floor) => void;
    onAddUnit: (floorId: string) => void;
    onEditArea: (floorId: string, unitId: string, area: AreaData) => void;
    onDeleteArea: (floorId: string, unitId: string, area: AreaData) => void;
};

const FloorAccordion = ({
    floor,
    onAreaPress,
    canEdit,
    onEditFloor,
    onDeleteFloor,
    onAddUnit,
    onEditArea,
    onDeleteArea
}: FloorAccordionProps) => {
    const [expanded, setExpanded] = useState(true); // Default open for ease

    return (
        <View className="mb-4">
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                className="bg-slate-100 p-3 rounded-lg border border-slate-200"
            >
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        {expanded ? <ChevronDown size={20} color="#475569" className="mr-2" /> : <ChevronRight size={20} color="#475569" className="mr-2" />}
                        <Text className="text-slate-900 font-bold text-sm mr-2">{floor.name}</Text>

                        {/* Floor Actions */}
                        {canEdit && (
                            <View className="flex-row items-center gap-2">
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation(); onEditFloor(floor); }}
                                    className="p-1"
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Pencil size={14} color="#64748b" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation(); onDeleteFloor(floor); }}
                                    className="p-1"
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Trash2 size={14} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Floor Progress Bar */}
                    <View className="flex-row items-center">
                        <View className="w-24 h-4 bg-slate-300 rounded-full overflow-hidden mr-3 border border-slate-400/20">
                            <View
                                className="h-full bg-green-600 rounded-full"
                                style={{ width: `${floor.progress}%` }}
                            />
                        </View>
                        <Text className="text-slate-700 text-lg font-bold w-12 text-right">{floor.progress}%</Text>
                    </View>
                </View>
            </TouchableOpacity>

            {expanded && (
                <View className="mt-2 pl-2">
                    {floor.units.map((unit) => (
                        <View key={unit.id} className="mb-4">
                            <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2 ml-1">
                                {unit.name}
                            </Text>
                            {unit.areas.map(area => (
                                <AreaCard
                                    key={area.id}
                                    area={area}
                                    onPress={onAreaPress}
                                    canEdit={canEdit}
                                    onEdit={() => onEditArea(floor.id, unit.id, area)}
                                    onDelete={() => onDeleteArea(floor.id, unit.id, area)}
                                />
                            ))}
                        </View>
                    ))}
                    {/* Add Unit Button */}
                    {canEdit && (
                        <TouchableOpacity
                            onPress={() => onAddUnit(floor.id)}
                            className="flex-row items-center justify-center h-12 mt-2 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg active:bg-slate-100"
                        >
                            <Plus size={18} color="#64748b" className="mr-2" />
                            <Text className="text-slate-500 font-semibold text-sm">Add Unit to {floor.name}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

export default function ProductionTab() {
    const [job, setJob] = useState<Job | null>(null);
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);

    // Structure Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState<StructureModalMode>('add-floor');
    const [modalTarget, setModalTarget] = useState<{ floorId?: string, unitId?: string, areaId?: string, initialData?: StructureModalData } | null>(null);

    const canEdit = true;
    const JOB_ID = '101'; // Hardcoded for this view context

    useEffect(() => {
        // Initial Fetch
        const fetchedJob = MockJobStore.getJob(JOB_ID);
        if (fetchedJob) {
            setJob(fetchedJob);
        }
    }, [JOB_ID]);

    // Helper to find selected area object safely
    const getSelectedArea = () => {
        if (!job) return null;
        for (const floor of job.floors) {
            for (const unit of floor.units) {
                const found = unit.areas.find(a => a.id === selectedAreaId);
                if (found) return found;
            }
        }
        return null;
    };

    const handleAreaOpen = (area: AreaData) => {
        setSelectedAreaId(area.id);
        setIsDrawerVisible(true);
    };

    const handleDrawerClose = () => {
        setIsDrawerVisible(false);
        setSelectedAreaId(null);
    };

    // --- CRUD HANDLERS ---

    const confirmDelete = (title: string, message: string, onConfirm: () => void) => {
        if (Platform.OS === 'web') {
            // Use browser native confirm
            if (window.confirm(`${title}\n${message}`)) {
                onConfirm();
            }
        } else {
            // Use Native Alert
            Alert.alert(title, message, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: onConfirm }
            ]);
        }
    };

    const handleAddFloor = () => {
        setModalMode('add-floor');
        setModalTarget(null);
        setModalVisible(true);
    };

    const handleEditFloor = (floor: Floor) => {
        setModalMode('edit-floor');
        setModalTarget({ floorId: floor.id, initialData: { name: floor.name } });
        setModalVisible(true);
    };

    const handleDeleteFloor = (floor: Floor) => {
        confirmDelete(
            "Delete Floor",
            `Are you sure you want to delete "${floor.name}"? This action cannot be undone.`,
            () => {
                const updatedJob = MockJobStore.deleteFloor(JOB_ID, floor.id);
                if (updatedJob) setJob({ ...updatedJob });
            }
        );
    };

    const handleAddUnit = (floorId: string) => {
        setModalMode('add-unit');
        setModalTarget({ floorId });
        setModalVisible(true);
    };

    const handleEditArea = (floorId: string, unitId: string, area: AreaData) => {
        setModalMode('edit-area');
        setModalTarget({
            floorId,
            unitId,
            areaId: area.id,
            initialData: {
                name: 'Current Unit', // Placeholder for unit name since we are editing area
                areaName: area.name,
                description: area.description
            }
        });
        setModalVisible(true);
    };

    const handleDeleteArea = (floorId: string, unitId: string, area: AreaData) => {
        confirmDelete(
            "Delete Area",
            `Are you sure you want to delete "${area.name}"?`,
            () => {
                const updatedJob = MockJobStore.deleteArea(JOB_ID, floorId, unitId, area.id);
                if (updatedJob) setJob({ ...updatedJob });
            }
        );
    };

    const handleStructureSubmit = (data: any) => {
        if (!job) return;
        let updatedJob: Job | null = null;

        if (modalMode === 'add-floor') {
            updatedJob = MockJobStore.addFloor(JOB_ID, data.name);
        } else if (modalMode === 'edit-floor' && modalTarget?.floorId) {
            updatedJob = MockJobStore.updateFloorName(JOB_ID, modalTarget.floorId, data.name);
        } else if (modalMode === 'add-unit' && modalTarget?.floorId) {
            updatedJob = MockJobStore.addUnit(
                JOB_ID,
                modalTarget.floorId,
                data.name || 'New Unit',
                data.areaName || 'Main Area',
                data.description || ''
            );
        } else if (modalMode === 'edit-area' && modalTarget?.floorId && modalTarget?.unitId && modalTarget?.areaId) {
            updatedJob = MockJobStore.updateArea(
                JOB_ID,
                modalTarget.floorId,
                modalTarget.unitId,
                modalTarget.areaId,
                data.areaName,
                data.description || ''
            );
        }

        if (updatedJob) setJob({ ...updatedJob });
        setModalVisible(false);
    };

    const getModalProps = () => {
        switch (modalMode) {
            case 'add-floor': return { mode: 'create', type: 'floor' };
            case 'edit-floor': return { mode: 'edit', type: 'floor' };
            case 'add-unit': return { mode: 'create', type: 'unit' };
            case 'edit-area': return { mode: 'edit', type: 'unit' };
            default: return { mode: 'create', type: 'floor' };
        }
    };

    // --- THE MATH ENGINE & PERSISTENCE ---
    const handleUpdateArea = (newChecklist: ChecklistItem[]) => {
        if (!selectedAreaId || !job) return;

        // Find location of area to pass to store
        // In a real app we might store IDs in the selectedArea object or look it up faster
        let targetFloorId = '';
        let targetUnitId = '';

        // Lookup IDs
        for (const floor of job.floors) {
            for (const unit of floor.units) {
                if (unit.areas.find(a => a.id === selectedAreaId)) {
                    targetFloorId = floor.id;
                    targetUnitId = unit.id;
                    break;
                }
            }
            if (targetFloorId) break;
        }

        if (targetFloorId && targetUnitId) {
            const updatedJob = MockJobStore.updateAreaChecklist(job.id, targetFloorId, targetUnitId, selectedAreaId, newChecklist);
            if (updatedJob) {
                setJob(updatedJob); // Force UI Update with new calculations
            }
        }
    };

    const selectedArea = getSelectedArea();

    if (!job) return <View className="flex-1 items-center justify-center"><Text>Loading...</Text></View>;

    return (
        <View className="flex-1 px-4 pt-4 bg-slate-50">
            <FlatList
                data={job.floors}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <FloorAccordion
                        floor={item}
                        onAreaPress={handleAreaOpen}
                        canEdit={canEdit}
                        onEditFloor={handleEditFloor}
                        onDeleteFloor={handleDeleteFloor}
                        onAddUnit={handleAddUnit}
                        onEditArea={handleEditArea}
                        onDeleteArea={handleDeleteArea}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListFooterComponent={
                    canEdit ? (
                        <TouchableOpacity
                            onPress={handleAddFloor}
                            className="flex-row items-center justify-center h-14 mt-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl active:bg-slate-100"
                        >
                            <Plus size={20} color="#64748b" className="mr-2" />
                            <Text className="text-slate-500 font-semibold text-base">Add New Floor</Text>
                        </TouchableOpacity>
                    ) : null
                }
            />

            <AreaDetailsDrawer
                isVisible={isDrawerVisible}
                onClose={handleDrawerClose}
                area={selectedArea}
                onUpdate={handleUpdateArea}
            />

            <StructureModal
                isVisible={modalVisible}
                onClose={() => setModalVisible(false)}
                {...getModalProps()}
                initialData={modalTarget?.initialData}
                onSubmit={handleStructureSubmit}
            />
        </View>
    );
}
