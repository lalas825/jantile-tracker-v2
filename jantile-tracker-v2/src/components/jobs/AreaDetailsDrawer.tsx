import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, Platform, Dimensions, Alert, Image } from 'react-native';
import { X, Camera, Image as ImageIcon, CheckCircle2, AlertTriangle, Calendar, Activity, Ban, Circle, Clock, ChevronDown, Plus, Minus, User, Trash2 } from 'lucide-react-native';
import clsx from 'clsx';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CREW_MEMBERS } from '../../constants/CrewData';
import LogTimeTab from './tabs/LogTimeTab';

type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NA';

export interface ChecklistItem {
    id: string;
    label: string;
    status: TaskStatus;
}

export interface AreaData {
    id: string;
    name: string;
    description: string;
    checklist: ChecklistItem[];
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

export default function AreaDetailsDrawer({ isVisible, onClose, area, onUpdate, onLogTime }: AreaDetailsDrawerProps) {
    const [activeTab, setActiveTab] = useState('Checklist');
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [progress, setProgress] = useState(0);

    // Log Time State - Moved to LogTimeTab component
    // const [selectedCrew, setSelectedCrew] = useState<string[]>([]);
    // const [regularHours, setRegularHours] = useState('');
    // const [otHours, setOtHours] = useState('');
    // const [timeNotes, setTimeNotes] = useState('');

    const { width } = Dimensions.get('window');
    const isDesktop = width > 768;

    // Hydrate Data on Open or when area updates
    useEffect(() => {
        if (isVisible && area) {
            setChecklist(area.checklist);
        }
    }, [isVisible, area]);

    // Calculate Progress dynamically
    useEffect(() => {
        const totalItems = checklist.filter(i => i.status !== 'NA').length;
        const completedItems = checklist.filter(i => i.status === 'COMPLETED').length;
        const calculatedProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        setProgress(calculatedProgress);
    }, [checklist]);

    const cycleStatus = (id: string) => {
        const updatedChecklist = checklist.map(item => {
            if (item.id !== id) return item;

            let nextStatus: TaskStatus = 'NOT_STARTED';
            if (item.status === 'NOT_STARTED') nextStatus = 'IN_PROGRESS';
            else if (item.status === 'IN_PROGRESS') nextStatus = 'COMPLETED';
            else if (item.status === 'COMPLETED') nextStatus = 'NA';
            else if (item.status === 'NA') nextStatus = 'NOT_STARTED';

            return { ...item, status: nextStatus };
        });

        setChecklist(updatedChecklist);
        onUpdate(updatedChecklist); // Live Sync: Trigger parent update immediately
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
                    "bg-white shadow-2xl overflow-hidden flex-1",
                    isDesktop
                        ? "w-[500px] h-full rounded-l-2xl"
                        : "w-full h-[90%] rounded-t-3xl"
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
                            <View>
                                <View className="flex-row space-x-4 mb-6">
                                    <TouchableOpacity
                                        className="flex-1 flex-row items-center justify-center bg-blue-600 py-3 rounded-xl shadow-sm active:bg-blue-700"
                                        onPress={() => console.log('Take Photo')}
                                    >
                                        <Camera size={18} color="white" className="mr-2" />
                                        <Text className="text-white font-bold text-sm">Take Photo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="flex-1 flex-row items-center justify-center bg-white border border-blue-200 py-3 rounded-xl shadow-sm active:bg-blue-50"
                                        onPress={() => console.log('Upload')}
                                    >
                                        <ImageIcon size={18} color="#1d4ed8" className="mr-2" />
                                        <Text className="text-blue-700 font-bold text-sm">Upload</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Today</Text>
                                <View className="flex-row flex-wrap -mx-2">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <TouchableOpacity key={i} className="w-1/3 px-2 mb-4" onPress={() => console.log(`Photo ${i} Action`)}>
                                            <View className="aspect-square bg-slate-100 rounded-lg border border-slate-200 items-center justify-center overflow-hidden">
                                                <ImageIcon size={24} color="#cbd5e1" />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* 3. ISSUES TAB */}
                        {activeTab === 'Issues' && (
                            <View>
                                <View className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex-row items-start">
                                    <AlertTriangle size={20} color="#d97706" className="mr-3 mt-0.5" />
                                    <View className="flex-1">
                                        <Text className="text-amber-800 font-bold text-sm mb-1">Report an Issue</Text>
                                        <Text className="text-amber-700 text-xs leading-5">
                                            Flagging an issue will notify the Project Manager and may pause production for this area.
                                        </Text>
                                    </View>
                                </View>

                                <Text className="text-slate-700 font-bold mb-2 text-sm">Issue Type</Text>
                                <View className="bg-white border border-slate-200 rounded-xl mb-4 overflow-hidden">
                                    <View className="p-3 flex-row justify-between items-center">
                                        <Text className="text-slate-700">Material Shortage</Text>
                                        <ChevronDown size={16} color="#64748b" />
                                    </View>
                                </View>

                                <Text className="text-slate-700 font-bold mb-2 text-sm">Description</Text>
                                <TextInput
                                    className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-800 h-32 text-top mb-4"
                                    multiline
                                    placeholder="Describe the issue in detail..."
                                    placeholderTextColor="#94a3b8"
                                    textAlignVertical="top"
                                />

                                <TouchableOpacity className="flex-row items-center justify-center border border-slate-300 border-dashed rounded-xl p-4 mb-6">
                                    <Camera size={20} color="#64748b" className="mr-2" />
                                    <Text className="text-slate-500 font-semibold">Attach Photo Evidence</Text>
                                </TouchableOpacity>

                                <TouchableOpacity className="bg-red-600 py-3.5 rounded-xl items-center shadow-sm active:bg-red-700">
                                    <Text className="text-white font-bold text-base">Submit Issue Report</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* 4. LOG TIME TAB */}
                        {activeTab === 'Log Time' && (
                            <View>
                                <LogTimeTab
                                    areaId={area?.id}
                                    onSave={(data) => {
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
                </View>
            </View>
        </Modal>
    );
}
