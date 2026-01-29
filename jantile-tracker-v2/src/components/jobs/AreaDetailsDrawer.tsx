import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, Platform, Dimensions, Alert, Image } from 'react-native';
import { X, Camera, Image as ImageIcon, CheckCircle2, AlertTriangle, Calendar, Activity, Ban, Circle, Clock, ChevronDown, Plus, Minus, User, Trash2 } from 'lucide-react-native';
import clsx from 'clsx';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SupabaseService } from '../../services/SupabaseService';
import { CHECKLIST_PRESETS } from '../../constants/JobTemplates';

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

export default function AreaDetailsDrawer({ isVisible, onClose, area, onUpdate, onLogTime, onAddPhoto, onDeletePhoto, onReportIssue, onResolveIssue, onDeleteIssue }: AreaDetailsDrawerProps) {
    const [activeTab, setActiveTab] = useState('Checklist');
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [progress, setProgress] = useState(0);

    const { width } = Dimensions.get('window');
    const isDesktop = width > 768;
    const [loading, setLoading] = useState(false);

    // Hydrate Data on Open or when area updates
    useEffect(() => {
        const loadChecklist = async () => {
            console.log("DEBUG: loadChecklist START", { isVisible, areaId: area?.id });
            if (!isVisible || !area) return;

            // 1. INSTANT RENDER (Optimistic)
            // Prioritize removing the spinner immediately if we know the checklist type.
            const areaNameLower = area.name.toLowerCase();
            let preset = CHECKLIST_PRESETS[areaNameLower];

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
                console.log("Fetching items for:", area.id);
                const items = await SupabaseService.getChecklistItems(area.id);

                if (items && items.length > 0) {
                    // DB has data.
                    const realUiItems = items.map((item: any) => ({
                        id: item.id,
                        label: item.text,
                        status: (item.status || (item.completed === 1 ? 'COMPLETED' : 'NOT_STARTED')) as TaskStatus
                    }));

                    // MERGE LOGIC: Apply any pending user changes from 'temp' items to these new real items
                    setChecklist(currentLists => {
                        // If no temp items, just use real.
                        if (!currentLists.some(i => i.id.startsWith('temp_'))) return realUiItems;

                        // Map real items to preserve any user changes made to temp items
                        return realUiItems.map((real, index) => {
                            const tempMatch = currentLists[index];
                            if (tempMatch && tempMatch.id.startsWith('temp_') && tempMatch.status !== 'NOT_STARTED') {
                                // User modified this temp item!
                                console.log("Merging user change to real item:", real.label, tempMatch.status);

                                // TRIGGER DELAYED SAVE
                                SupabaseService.updateChecklistItem(real.id, {
                                    status: tempMatch.status
                                });

                                return { ...real, status: tempMatch.status };
                            }
                            return real;
                        });
                    });

                } else {
                    // DB is empty.
                    if (preset) {
                        console.log("DB Empty. Background saving preset...");
                        // Save preset to DB
                        for (const task of preset) {
                            await SupabaseService.addChecklistItem(area.id, task);
                        }

                        // Re-fetch to get real IDs
                        const realItems = await SupabaseService.getChecklistItems(area.id);
                        const realUiItems = realItems.map((item: any) => ({
                            id: item.id,
                            label: item.text,
                            status: (item.status || (item.completed === 1 ? 'COMPLETED' : 'NOT_STARTED')) as TaskStatus
                        }));

                        // Same merge logic for the newly created items
                        setChecklist(currentLists => {
                            if (!currentLists.some(i => i.id.startsWith('temp_'))) return realUiItems;
                            return realUiItems.map((real, index) => {
                                const tempMatch = currentLists[index];
                                if (tempMatch && tempMatch.id.startsWith('temp_') && tempMatch.status !== 'NOT_STARTED') {
                                    console.log("Merging user change to NEW real item:", real.label, tempMatch.status);
                                    SupabaseService.updateChecklistItem(real.id, {
                                        status: tempMatch.status
                                    });
                                    return { ...real, status: tempMatch.status };
                                }
                                return real;
                            });
                        });
                    } else {
                        setChecklist([]);
                    }
                }
            } catch (e) {
                console.error("Failed to load/sync checklist", e);
            } finally {
                setLoading(false);
            }
        };
        loadChecklist();
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
                                photos={(area as any)?.area_photos?.map((p: any) => p.url) || []}
                                onAddPhoto={(uri: string) => {
                                    if (onAddPhoto) onAddPhoto(uri);
                                    else Alert.alert("Dev Warning", "No handler for adding photos");
                                }}
                                onDeletePhoto={(uri: string) => {
                                    if (onDeletePhoto) onDeletePhoto(uri);
                                    else Alert.alert("Dev Warning", "No handler for deleting photos");
                                }}
                            />
                        )}

                        {/* 3. ISSUES TAB */}
                        {activeTab === 'Issues' && (
                            <IssuesTab
                                issues={area?.issues}
                                onReport={(issue) => {
                                    if (onReportIssue) onReportIssue(issue);
                                    else Alert.alert("Dev Warning", "No handler for reporting issues");
                                }}
                                onResolve={(id) => {
                                    if (onResolveIssue) onResolveIssue(id);
                                }}
                                onDelete={(id) => {
                                    if (onDeleteIssue) onDeleteIssue(id);
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
