import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Alert, Dimensions, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ChevronLeft, X, CheckCircle2, Activity, Ban, Circle } from 'lucide-react-native';
import clsx from 'clsx';
import { SupabaseService } from '../../../../../services/SupabaseService';

// Import Tabs
import PhotosTab from '../../../../../components/jobs/tabs/PhotosTab';
import IssuesTab from '../../../../../components/jobs/tabs/IssuesTab';
import LogTimeTab from '../../../../../components/jobs/tabs/LogTimeTab';

const TABS = ['Checklist', 'Photos', 'Issues', 'Log Time'];

type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NA';

interface ChecklistItem {
    id: string;
    text: string;
    completed: number; // 0 or 1
    // We might need to map DB 'completed' to UI 'status'
    // For now, let's assume we store status as text in DB too? 
    // Wait, DB schema has 'completed' as integer. 
    // And 'areas' table has 'status'.
    // Let's stick to the UI expectation of Status for now, but map to DB.
    // Actually, let's use a local mapping for now since DB is simple.
}

// UI Item extended
interface UIChecklistItem extends ChecklistItem {
    status: TaskStatus;
}

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

export default function AreaChecklistPage() {
    const router = useRouter();
    const { id: jobId, unitId, areaId } = useLocalSearchParams<{ id: string, unitId: string, areaId: string }>();
    const [activeTab, setActiveTab] = useState('Checklist');
    const [checklist, setChecklist] = useState<UIChecklistItem[]>([]);
    const [areaName, setAreaName] = useState('Area Details');
    const [progress, setProgress] = useState(0);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [areaId]);

    const loadData = async () => {
        if (!areaId) return;
        try {
            // Fetch checklist items
            const items = await SupabaseService.getChecklistItems(areaId);
            // Map DB items to UI items
            const uiItems: UIChecklistItem[] = items.map((item: any) => ({
                id: item.id,
                text: item.text,
                completed: item.completed,
                status: (item.completed === 1 ? 'COMPLETED' : 'NOT_STARTED') as TaskStatus
            }));
            setChecklist(uiItems);

            // Calculate progress
            updateProgress(uiItems);

            // Ideally fetch Area Name too (we could fetch from areas table if we add getArea to service)
            // For now, it might default or we fetch it.
        } catch (error) {
            console.error("Error loading checklist:", error);
        }
    };

    const updateProgress = async (items: UIChecklistItem[]) => {
        const total = items.length;
        const completedCount = items.filter(i => i.status === 'COMPLETED').length;
        const newProgress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

        setProgress(newProgress);

        // PERSIST progress to Areas table
        if (areaId) {
            try {
                await SupabaseService.updateArea(areaId, { progress: newProgress });
            } catch (e) {
                console.error("Failed to save aggregate progress:", e);
            }
        }
    };

    const cycleStatus = async (item: UIChecklistItem) => {
        const newCompleted = item.completed === 1 ? 0 : 1;
        const newStatus: TaskStatus = newCompleted === 1 ? 'COMPLETED' : 'NOT_STARTED';

        // Optimistic Update
        const updatedChecklist = checklist.map(i => i.id === item.id ? { ...i, completed: newCompleted, status: newStatus } : i);
        setChecklist(updatedChecklist);
        await updateProgress(updatedChecklist);

        try {
            await SupabaseService.updateChecklistItem(item.id, { completed: newCompleted });
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Failed to save status");
        }
    };

    // Placeholder handlers
    const handleAddPhoto = (uri: string) => console.log("Add photo", uri);
    const handleReportIssue = (issue: any) => console.log("Report issue", issue);
    const handleLogTime = (data: any) => console.log("Log time", data);

    return (
        <SafeAreaView className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="px-6 py-4 border-b border-slate-100 bg-white">
                <View className="flex-row items-center justify-between mb-4">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
                        <ChevronLeft size={24} color="#64748b" />
                    </TouchableOpacity>
                    <View className="flex-1 ml-2">
                        <Text className="text-xl font-bold text-slate-900 leading-tight">Area Checklist</Text>
                        <Text className="text-slate-500 text-xs mt-0.5">ID: {areaId?.substring(0, 8)}...</Text>
                    </View>
                    <View className="flex-row items-center bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                        <Text className="font-bold text-slate-700 mr-1">{progress}%</Text>
                        <View className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <View
                                className={clsx("h-full bg-green-500", progress === 100 && "bg-green-600")}
                                style={{ width: `${progress}%` }}
                            />
                        </View>
                    </View>
                </View>
            </View>

            {/* Tabs */}
            <View className="flex-row border-b border-slate-200 bg-slate-50">
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        className={clsx(
                            "flex-1 items-center py-3 border-b-2 hover:bg-white transition-colors",
                            activeTab === tab ? "border-blue-600 bg-white" : "border-transparent"
                        )}
                    >
                        <Text className={clsx(
                            "text-xs font-bold uppercase tracking-wide",
                            activeTab === tab ? "text-blue-600" : "text-slate-500"
                        )}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

                {/* CHECKLIST TAB */}
                {activeTab === 'Checklist' && (
                    <View>
                        {checklist.length === 0 && (
                            <View className="py-10 items-center justify-center">
                                <Text className="text-slate-400">No items in checklist.</Text>
                                <TouchableOpacity
                                    className="mt-4 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100"
                                    onPress={async () => {
                                        // Quick Debug Add
                                        if (areaId) {
                                            await SupabaseService.addChecklistItem(areaId, "Verify Substrate");
                                            await SupabaseService.addChecklistItem(areaId, "Install Tiles");
                                            await SupabaseService.addChecklistItem(areaId, "Grout & Clean");
                                            loadData();
                                        }
                                    }}
                                >
                                    <Text className="text-blue-600 font-bold">Populate Default Items</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {checklist.map(item => (
                            <View
                                key={item.id}
                                className={clsx(
                                    "flex-row items-center justify-between p-4 mb-3 border rounded-xl shadow-sm",
                                    item.status === 'COMPLETED' ? "border-green-100 bg-green-50/30" : "border-slate-200 bg-white"
                                )}
                            >
                                <Text className={clsx(
                                    "text-base font-medium flex-1 mr-4",
                                    item.status === 'COMPLETED' ? "text-slate-900 line-through opacity-70" : "text-slate-700"
                                )}>
                                    {item.text}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => cycleStatus(item)}
                                    className={clsx(
                                        "w-8 h-8 rounded-full items-center justify-center border",
                                        item.status === 'COMPLETED' ? "bg-green-500 border-green-600" : "bg-white border-slate-300"
                                    )}
                                >
                                    {item.status === 'COMPLETED' && <CheckCircle2 size={18} color="white" />}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* PHOTOS TAB */}
                {activeTab === 'Photos' && (
                    <PhotosTab
                        photos={[]} // TODO: Fetch real photos
                        onAddPhoto={handleAddPhoto}
                        onDeletePhoto={() => { }}
                    />
                )}

                {/* ISSUES TAB */}
                {activeTab === 'Issues' && (
                    <IssuesTab
                        issues={[]} // TODO: Fetch real issues
                        onReport={handleReportIssue}
                        onResolve={() => { }}
                        onDelete={() => { }}
                    />
                )}

                {/* LOG TIME TAB */}
                {activeTab === 'Log Time' && (
                    <LogTimeTab
                        areaId={areaId}
                        onSave={handleLogTime}
                    />
                )}

            </ScrollView>
        </SafeAreaView>
    );
}
