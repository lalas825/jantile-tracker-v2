import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, Platform, Dimensions, Alert, Image } from 'react-native';
import { X, Camera, Image as ImageIcon, CheckCircle2, AlertTriangle, Calendar, Activity, Ban, Circle, Clock, ChevronDown, Plus, Minus, User, Trash2 } from 'lucide-react-native';
import clsx from 'clsx';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SupabaseService, JobIssue } from '../../services/SupabaseService';
import { CHECKLIST_PRESETS, BATHROOM_TASKS, POWDER_TASKS, KITCHEN_TASKS, COMMON_AREA_TASKS } from '../../constants/JobTemplates';
import { useAuth } from '../../context/AuthContext';

import { CREW_MEMBERS } from '../../constants/CrewData';
import LogTimeTab from './tabs/LogTimeTab';
import PhotosTab from './tabs/PhotosTab';
import IssuesTab from './tabs/IssuesTab';

type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NA';

export interface ChecklistItem {
    id: string;
    label: string;
    status: TaskStatus;
}

export interface Issue {
    id: string;
    type: string;
    description: string;
    photo?: string;
    date: string;
    status: 'OPEN' | 'RESOLVED';
}

export interface AreaData {
    id: string;
    name: string;
    description: string;
    drawing_page?: string;
    checklist: ChecklistItem[];
    area_photos?: { id: string; url: string; storage_path: string }[];
    photos?: string[]; // Legacy UI support
    issues?: Issue[];
    timeLogs?: { regularHours: number; otHours: number; date: string; workerIds: string[]; description: string }[];
    // derived fields for UI display
    progress: number;
    mudStatus: TaskStatus;
    tileStatus: TaskStatus;
    groutStatus: TaskStatus;
}

interface AreaDetailsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    area: AreaData | null;
    jobId?: string;
    onUpdate: (newChecklist: ChecklistItem[]) => void;
    onLogTime?: (logData: any) => void;
    onAddPhoto?: (uri: string) => void;
    onDeletePhoto?: (uri: string) => void;
    onReportIssue?: (issue: any) => void;
    onResolveIssue?: (issueId: string) => void;
    onDeleteIssue?: (issueId: string) => void;
}

const TABS = ['Checklist', 'Photos', 'Issues', 'Log Time'];

const StatusButton = ({ status, onPress }: { status: TaskStatus, onPress: () => void }) => {
    switch (status) {
        case 'COMPLETED':
            return (
                <TouchableOpacity onPress={onPress} className="flex-row items-center justify-center bg-green-100 border border-green-200 px-4 py-2 rounded-lg w-32">
                    <CheckCircle2 size={16} color="#15803d" className="mr-2" />
                    <Text className="text-xs font-bold text-green-700">Done</Text>
                </TouchableOpacity>
            );
        case 'IN_PROGRESS':
            return (
                <TouchableOpacity onPress={onPress} className="flex-row items-center justify-center bg-blue-100 border border-blue-200 px-4 py-2 rounded-lg w-32">
                    <Activity size={16} color="#1d4ed8" className="mr-2" />
                    <Text className="text-xs font-bold text-blue-700">In Progress</Text>
                </TouchableOpacity>
            );
        case 'NA':
            return (
                <TouchableOpacity onPress={onPress} className="flex-row items-center justify-center bg-slate-100 border border-slate-300 px-4 py-2 rounded-lg w-32 opacity-60">
                    <Ban size={16} color="#64748b" className="mr-2" />
                    <Text className="text-xs font-bold text-slate-500 line-through">N/A</Text>
                </TouchableOpacity>
            );
        default: // NOT_STARTED
            return (
                <TouchableOpacity onPress={onPress} className="flex-row items-center justify-center bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg w-32">
                    <Circle size={16} color="#94a3b8" className="mr-2" />
                    <Text className="text-xs font-bold text-slate-500">Start</Text>
                </TouchableOpacity>
            );
    }
};

const PRESET_GROUPS: Record<string, string[]> = {
    'Bathroom': BATHROOM_TASKS,
    'Powder Room': POWDER_TASKS,
    'Kitchen': KITCHEN_TASKS,
    'Common Area': COMMON_AREA_TASKS,
};

export default function AreaDetailsDrawer({ isVisible, onClose, area, jobId, onUpdate, onLogTime, onAddPhoto, onDeletePhoto, onReportIssue, onResolveIssue, onDeleteIssue }: AreaDetailsDrawerProps) {
    const { profile, user } = useAuth();
    const [activeTab, setActiveTab] = useState('Checklist');
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [progress, setProgress] = useState(0);

    const { width } = Dimensions.get('window');
    const isDesktop = width > 768;
    const [loading, setLoading] = useState(false);
    const [areaPhotos, setAreaPhotos] = useState<{ id: string; url: string; storage_path: string }[]>([]);
    const [areaIssues, setAreaIssues] = useState<JobIssue[]>([]);

    // Add-task panel state
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [customTaskText, setCustomTaskText] = useState('');
    const [addingTask, setAddingTask] = useState(false);

    // Hydrate Data on Open or when area updates
    useEffect(() => {
        const loadAreaData = async () => {
            console.log("DEBUG: loadAreaData START", { isVisible, areaId: area?.id });
            if (!isVisible || !area) return;

            // 1. INSTANT RENDER (Optimistic)
            // Prioritize removing the spinner immediately if we know the checklist type.
            const areaNameLower = area.name.toLowerCase();
            let preset = CHECKLIST_PRESETS[areaNameLower];

            // Set initial photos from prop (might be stale but better than empty)
            if (area.area_photos) setAreaPhotos(area.area_photos);

            // Fallbacks
            if (!preset) {
                if (areaNameLower.includes('bathroom') || areaNameLower.includes('bath')) preset = CHECKLIST_PRESETS['master bathroom'];
                else if (areaNameLower.includes('kitchen')) preset = CHECKLIST_PRESETS['kitchen'];
                else if (areaNameLower.includes('powder')) preset = CHECKLIST_PRESETS['powder room'];
                else if (areaNameLower.includes('laundry')) preset = CHECKLIST_PRESETS['laundry'];
            }

            if (preset) {
                // Render preset immediately with temp IDs
                const optimisticItems = preset.map((text, idx) => ({
                    id: `temp_${idx}`,
                    label: text,
                    status: 'NOT_STARTED' as TaskStatus
                }));
                setChecklist(optimisticItems);
                // DO NOT start spinner if we are showing content!
            } else {
                setLoading(true); // Only show spinner if absolutely nothing to show
            }

            // 2. FETCH REAL DATA & SYNC (Background)
            try {
                console.log("Fetching items and photos for:", area.id);

                // Fetch checklist items first & independently
                try {
                    const items = await SupabaseService.getChecklistItems(area.id);
                    if (items && items.length > 0) {
                        setChecklist(currentLists => {
                            const baseItems = items.map((item: any) => ({
                                id: item.id,
                                label: item.text,
                                status: (item.status || (item.completed === 1 ? 'COMPLETED' : 'NOT_STARTED')) as TaskStatus,
                                position: item.position,
                                created_at: item.created_at
                            }));

                            if (!currentLists.some(i => i.id.startsWith('temp_'))) {
                                return SupabaseService.sortChecklist(baseItems, area.name);
                            }

                            const merged = baseItems.map((real: any, index: number) => {
                                const tempMatch = currentLists[index];
                                if (tempMatch && tempMatch.id.startsWith('temp_') && tempMatch.status !== 'NOT_STARTED') {
                                    SupabaseService.updateChecklistItem(real.id, { status: tempMatch.status });
                                    return { ...real, status: tempMatch.status };
                                }
                                return real;
                            });

                            return SupabaseService.sortChecklist(merged, area.name);
                        });
                    } else if (preset) {
                        // Populate defaults if truly empty
                        console.log("DB Empty. Background saving preset...");
                        for (const task of preset) {
                            await SupabaseService.addChecklistItem(area.id, task);
                        }
                        const realItems = await SupabaseService.getChecklistItems(area.id);
                        const realUiItems = realItems.map((item: any) => ({
                            id: item.id,
                            label: item.text,
                            status: (item.status || (item.completed === 1 ? 'COMPLETED' : 'NOT_STARTED')) as TaskStatus,
                            position: item.position,
                            created_at: item.created_at
                        }));
                        setChecklist(SupabaseService.sortChecklist(realUiItems, area.name));
                    }
                } catch (err) {
                    console.error("Critical Checklist Load Error:", err);
                }

                // Fetch photos independently
                try {
                    const photos = await SupabaseService.getAreaPhotos(area.id);
                    setAreaPhotos(photos);
                } catch (err) {
                    console.error("Non-critical Photo Load Error:", err);
                }

                // Fetch issues independently
                try {
                    const issues = await SupabaseService.getJobIssues(undefined, area.id);
                    setAreaIssues(issues);
                } catch (err) {
                    console.error("Non-critical Issue Load Error (Expected if tables not in Supabase yet):", err);
                }
            } catch (e) {
                console.error("General background sync error", e);
            } finally {
                setLoading(false);
            }
        };
        loadAreaData();
    }, [isVisible, area]);

    // Calculate Progress dynamically
    useEffect(() => {
        const totalItems = checklist.filter(i => i.status !== 'NA').length;
        const completedItems = checklist.filter(i => i.status === 'COMPLETED').length;
        const calculatedProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        setProgress(calculatedProgress);
    }, [checklist]);

    const cycleStatus = async (id: string) => {
        const item = checklist.find(i => i.id === id);
        if (!item) return;

        let nextStatus: TaskStatus = 'NOT_STARTED';
        if (item.status === 'NOT_STARTED') nextStatus = 'IN_PROGRESS';
        else if (item.status === 'IN_PROGRESS') nextStatus = 'COMPLETED';
        else if (item.status === 'COMPLETED') nextStatus = 'NA';
        else if (item.status === 'NA') nextStatus = 'NOT_STARTED';

        // Optimistic Update (Always allowed, even for temp IDs)
        const updatedChecklist = checklist.map(i => i.id === id ? { ...i, status: nextStatus } : i);
        setChecklist(updatedChecklist);
        onUpdate(updatedChecklist);

        // Save to DB
        // SKIP if it's a temp ID. The useEffect merge logic will catch this later.
        if (id.startsWith('temp_')) {
            console.log("Local update only for temp item. Sync will handle persistence.");
            return;
        }

        try {
            await SupabaseService.updateChecklistItem(id, {
                status: nextStatus
            });
        } catch (e) {
            console.error("Failed to save status", e);
        }
    };

    const handleAddTask = async (text: string) => {
        if (!area || !text.trim() || addingTask) return;
        setAddingTask(true);
        try {
            await SupabaseService.addChecklistItem(area.id, text.trim());
            const items = await SupabaseService.getChecklistItems(area.id);
            const uiItems = items.map((item: any) => ({
                id: item.id,
                label: item.text,
                status: (item.status || (item.completed === 1 ? 'COMPLETED' : 'NOT_STARTED')) as TaskStatus,
                position: item.position,
                created_at: item.created_at
            }));
            setChecklist(SupabaseService.sortChecklist(uiItems, area.name));
            onUpdate(uiItems);
            setCustomTaskText('');
        } catch (e) {
            console.error("Failed to add task", e);
        } finally {
            setAddingTask(false);
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (id.startsWith('temp_')) {
            setChecklist(prev => prev.filter(i => i.id !== id));
            return;
        }
        try {
            setChecklist(prev => prev.filter(i => i.id !== id));
            await SupabaseService.deleteChecklistItem(id);
            if (area) {
                const items = await SupabaseService.getChecklistItems(area.id);
                const uiItems = items.map((item: any) => ({
                    id: item.id,
                    label: item.text,
                    status: (item.status || (item.completed === 1 ? 'COMPLETED' : 'NOT_STARTED')) as TaskStatus,
                    position: item.position,
                    created_at: item.created_at
                }));
                setChecklist(SupabaseService.sortChecklist(uiItems, area.name));
                onUpdate(uiItems);
            }
        } catch (e) {
            console.error("Failed to delete task", e);
        }
    };

    const existingLabels = new Set(checklist.map(i => i.label.toLowerCase()));

    return (
        <Modal
            visible={isVisible}
            animationType={isDesktop ? 'fade' : 'slide'}
            transparent={true}
            onRequestClose={onClose}
        >
            <View className={clsx("flex-1 bg-black/50 justify-end", isDesktop ? "items-end" : "")}>
                {/* Drawer Container */}
                <View className={clsx(
                    "bg-white shadow-2xl overflow-hidden h-full",
                    isDesktop
                        ? "w-[600px] xl:w-[800px] rounded-l-2xl"
                        : "w-full rounded-t-3xl"
                )}>

                    {/* Header */}
                    <SafeAreaView edges={['top', 'right']} className="bg-white">
                        <View className="px-6 py-4 border-b border-slate-100">
                            <View className="flex-row items-center justify-between mb-4">
                                <View className="flex-1 mr-4">
                                    <Text className="text-2xl font-bold text-slate-900 leading-tight">{area?.name || 'Area Details'}</Text>
                                    <Text className="text-slate-500 text-xs mt-1">{area?.description || 'JFK Terminal 1'}</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                                    <X size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            {/* Dynamic Progress Bar */}
                            <View className="flex-row items-center">
                                <View className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden mr-3 border border-slate-200">
                                    <View
                                        className={clsx("h-full rounded-full transition-all duration-300",
                                            progress === 100 ? "bg-emerald-500" : "bg-blue-600"
                                        )}
                                        style={{ width: `${progress}%` }}
                                    />
                                </View>
                                <Text className="text-slate-900 font-extrabold text-lg w-12 text-right">{progress}%</Text>
                            </View>
                        </View>
                    </SafeAreaView>

                    {/* Tabs */}
                    <View className="flex-row border-b border-slate-200 bg-slate-50">
                        {TABS.map(tab => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                className={clsx(
                                    "flex-1 items-center py-4 border-b-2 hover:bg-white transition-colors",
                                    activeTab === tab ? "border-red-700 bg-white" : "border-transparent"
                                )}
                            >
                                <Text className={clsx(
                                    "text-sm font-bold uppercase tracking-wide",
                                    activeTab === tab ? "text-red-700" : "text-slate-500"
                                )}>
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Content Scroll */}
                    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>

                        {/* 1. CHECKLIST TAB */}
                        {activeTab === 'Checklist' && (
                            <View>
                                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Tasks & Milestones</Text>
                                {checklist.length === 0 && (
                                    <View className="py-8 items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                        {loading ? (
                                            <Text className="text-slate-400">Loading checklist...</Text>
                                        ) : (
                                            <View className="items-center">
                                                <Text className="text-slate-400 mb-2">No items found</Text>
                                                <TouchableOpacity
                                                    onPress={async () => {
                                                        if (area) {
                                                            setLoading(true);
                                                            // Manual trigger for default backup
                                                            let preset = CHECKLIST_PRESETS['master bathroom'];
                                                            for (const task of preset) {
                                                                await SupabaseService.addChecklistItem(area.id, task);
                                                            }
                                                            // Reload
                                                            const items = await SupabaseService.getChecklistItems(area.id);
                                                            const uiItems = items.map((item: any) => ({
                                                                id: item.id,
                                                                label: item.text,
                                                                status: (item.completed === 1 ? 'COMPLETED' : 'NOT_STARTED') as TaskStatus
                                                            }));
                                                            setChecklist(uiItems);
                                                            setLoading(false);
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-white border border-slate-200 rounded text-slate-600 font-bold text-xs"
                                                >
                                                    <Text>Populate Standard Tasks</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}
                                {checklist.map(item => (
                                    <View
                                        key={item.id}
                                        className={clsx(
                                            "flex-row items-center justify-between p-4 mb-3 border rounded-xl shadow-sm transition-colors",
                                            item.status === 'NA' ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-white"
                                        )}
                                    >
                                        <TouchableOpacity
                                            onPress={() => handleDeleteTask(item.id)}
                                            className="mr-3 p-1.5 rounded-lg hover:bg-red-50"
                                        >
                                            <Trash2 size={14} color="#cbd5e1" />
                                        </TouchableOpacity>
                                        <Text className={clsx(
                                            "text-base font-medium flex-1 mr-4",
                                            item.status === 'COMPLETED' ? "text-slate-900" :
                                                item.status === 'NA' ? "text-slate-400 line-through" : "text-slate-700"
                                        )}>
                                            {item.label}
                                        </Text>
                                        <StatusButton
                                            status={item.status}
                                            onPress={() => cycleStatus(item.id)}
                                        />
                                    </View>
                                ))}

                                {/* Add Task Panel */}
                                <TouchableOpacity
                                    onPress={() => setShowAddPanel(!showAddPanel)}
                                    className={clsx(
                                        "flex-row items-center justify-center p-4 mb-3 border-2 border-dashed rounded-xl transition-colors",
                                        showAddPanel ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                    )}
                                >
                                    <Plus size={18} color={showAddPanel ? "#2563eb" : "#94a3b8"} />
                                    <Text className={clsx("ml-2 font-bold text-sm", showAddPanel ? "text-blue-600" : "text-slate-500")}>
                                        {showAddPanel ? 'Close' : 'Add Task'}
                                    </Text>
                                </TouchableOpacity>

                                {showAddPanel && (
                                    <View className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        {/* Preset Picker */}
                                        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">From Preset</Text>
                                        <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                                            {Object.keys(PRESET_GROUPS).map(groupName => (
                                                <TouchableOpacity
                                                    key={groupName}
                                                    onPress={() => setSelectedPreset(selectedPreset === groupName ? null : groupName)}
                                                    className={clsx(
                                                        "px-4 py-2 rounded-full border transition-colors",
                                                        selectedPreset === groupName
                                                            ? "bg-blue-600 border-blue-600"
                                                            : "bg-white border-slate-200 hover:border-blue-300"
                                                    )}
                                                >
                                                    <Text className={clsx(
                                                        "text-xs font-bold",
                                                        selectedPreset === groupName ? "text-white" : "text-slate-600"
                                                    )}>
                                                        {groupName}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Filtered Tasks from Selected Preset */}
                                        {selectedPreset && PRESET_GROUPS[selectedPreset] && (
                                            <View className="mb-4">
                                                {PRESET_GROUPS[selectedPreset]
                                                    .filter(task => !existingLabels.has(task.toLowerCase()))
                                                    .map(task => (
                                                        <TouchableOpacity
                                                            key={task}
                                                            onPress={() => handleAddTask(task)}
                                                            disabled={addingTask}
                                                            className="flex-row items-center justify-between p-3 mb-2 bg-white border border-slate-100 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors"
                                                        >
                                                            <Text className="text-sm text-slate-700 font-medium">{task}</Text>
                                                            <View className="flex-row items-center bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                                                                <Plus size={12} color="#2563eb" />
                                                                <Text className="text-xs font-bold text-blue-600 ml-1">Add</Text>
                                                            </View>
                                                        </TouchableOpacity>
                                                    ))}
                                                {PRESET_GROUPS[selectedPreset].filter(task => !existingLabels.has(task.toLowerCase())).length === 0 && (
                                                    <Text className="text-slate-400 text-xs text-center py-3">All tasks from this preset are already added</Text>
                                                )}
                                            </View>
                                        )}

                                        {/* Custom Task Input */}
                                        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 mt-1">Custom Task</Text>
                                        <View className="flex-row items-center" style={{ gap: 8 }}>
                                            <TextInput
                                                value={customTaskText}
                                                onChangeText={setCustomTaskText}
                                                placeholder="Enter task name..."
                                                placeholderTextColor="#94a3b8"
                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800"
                                                onSubmitEditing={() => handleAddTask(customTaskText)}
                                            />
                                            <TouchableOpacity
                                                onPress={() => handleAddTask(customTaskText)}
                                                disabled={!customTaskText.trim() || addingTask}
                                                className={clsx(
                                                    "px-5 py-3 rounded-lg transition-colors",
                                                    customTaskText.trim() && !addingTask
                                                        ? "bg-blue-600 hover:bg-blue-700"
                                                        : "bg-slate-200"
                                                )}
                                            >
                                                <Text className={clsx(
                                                    "text-sm font-bold",
                                                    customTaskText.trim() && !addingTask ? "text-white" : "text-slate-400"
                                                )}>
                                                    {addingTask ? '...' : 'Add'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                <View className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <Text className="text-center text-slate-500 text-xs">
                                        Tap the status button to cycle: <Text className="font-bold">Start → In Progress → Done → N/A</Text>
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* 2. PHOTOS TAB */}
                        {activeTab === 'Photos' && (
                            <PhotosTab
                                photos={areaPhotos.map((p: any) => p.url) || []}
                                onAddPhoto={async (uri: string) => {
                                    if (onAddPhoto) {
                                        await onAddPhoto(uri);
                                        // Refresh local photos after upload
                                        if (area) {
                                            const fresh = await SupabaseService.getAreaPhotos(area.id);
                                            setAreaPhotos(fresh);
                                        }
                                    }
                                    else Alert.alert("Dev Warning", "No handler for adding photos");
                                }}
                                onDeletePhoto={async (uri: string) => {
                                    if (onDeletePhoto) {
                                        await onDeletePhoto(uri);
                                        // Refresh local photos after delete
                                        if (area) {
                                            const fresh = await SupabaseService.getAreaPhotos(area.id);
                                            setAreaPhotos(fresh);
                                        }
                                    }
                                    else Alert.alert("Dev Warning", "No handler for deleting photos");
                                }}
                            />
                        )}

                        {/* 3. ISSUES TAB */}
                        {activeTab === 'Issues' && (
                            <IssuesTab
                                issues={areaIssues}
                                onReport={async (issueData) => {
                                    if (!area) return;
                                    try {
                                        // We need jobId here. I'll search for it or pass it.
                                        // For now, I'll assume we can pass it to the drawer or find it.
                                        // Searching for jobId in the file... it's not here.
                                        // I'll add jobId to the props.
                                        // Identify reporter: Use Full Name, then Email, then Fallback
                                        const reporterName = profile?.full_name || user?.email || 'Unknown User';

                                        await SupabaseService.createIssue({
                                            ...issueData,
                                            area_id: area.id,
                                            job_id: jobId || (area as any).job_id,
                                            created_by: reporterName
                                        });
                                        const freshIssues = await SupabaseService.getJobIssues(undefined, area.id);
                                        setAreaIssues(freshIssues);
                                    } catch (e) {
                                        console.error("Failed to report issue", e);
                                    }
                                }}
                                onResolve={async (id) => {
                                    await SupabaseService.updateIssueStatus(id, 'resolved');
                                    if (area) {
                                        const freshIssues = await SupabaseService.getJobIssues(undefined, area.id);
                                        setAreaIssues(freshIssues);
                                    }
                                }}
                                onDelete={async (id) => {
                                    await SupabaseService.deleteIssue(id);
                                    if (area) {
                                        const freshIssues = await SupabaseService.getJobIssues(undefined, area.id);
                                        setAreaIssues(freshIssues);
                                    }
                                }}
                            />
                        )}

                        {/* 4. LOG TIME TAB */}
                        {activeTab === 'Log Time' && (
                            <View>
                                <LogTimeTab
                                    areaId={area?.id}
                                    onSave={(data: any) => {
                                        if (onLogTime) {
                                            onLogTime(data);
                                        } else {
                                            console.warn("No onLogTime handler provided");
                                            Alert.alert("Dev Warning", "No handler connected for logging time.");
                                        }
                                    }}
                                />
                            </View>
                        )}

                    </ScrollView>
                </View >
            </View >
        </Modal >
    );
}
