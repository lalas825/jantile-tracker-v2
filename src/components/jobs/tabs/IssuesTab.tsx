import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, ScrollView, Alert, Platform } from 'react-native';
import { AlertTriangle, Camera, ChevronDown, CheckCircle2, Clock, X, Flag } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { JobIssue } from '../../../services/SupabaseService';

type IssuesTabProps = {
    issues?: JobIssue[];
    onReport: (issue: Partial<JobIssue>) => void;
    onResolve: (id: string) => void;
    onDelete: (id: string) => void;
};

const ISSUE_TYPES = ['Material Shortage', 'Design Discrepancy', 'Damage Report', 'Work Stoppage', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'] as const;

export default function IssuesTab({ issues = [], onReport, onResolve, onDelete }: IssuesTabProps) {

    // Form State
    const [selectedType, setSelectedType] = useState(ISSUE_TYPES[0]);
    const [selectedPriority, setSelectedPriority] = useState<typeof PRIORITIES[number]>('Medium');
    const [description, setDescription] = useState('');
    const [photoUri, setPhotoUri] = useState<string | null>(null);

    const handleAttachPhoto = async () => {
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const handleSubmit = () => {
        if (!description.trim()) {
            Platform.OS === 'web' ? window.alert("Please provide a description") : Alert.alert("Missing Info", "Please provide a description.");
            return;
        }

        onReport({
            type: selectedType,
            description: description,
            priority: selectedPriority,
            photo_url: photoUri || undefined
        });

        // Reset Form
        setDescription('');
        setPhotoUri(null);
        setSelectedType(ISSUE_TYPES[0]);
        setSelectedPriority('Medium');

        if (Platform.OS === 'web') {
            window.alert("Issue Reported Successfully");
        } else {
            Alert.alert("Reported", "Issue has been flagged.");
        }
    };

    return (
        <View>
            {/* NEW ISSUE FORM */}
            <View className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex-row items-start shadow-sm">
                <AlertTriangle size={20} color="#d97706" className="mr-3 mt-0.5" />
                <View className="flex-1">
                    <Text className="text-amber-800 font-bold text-sm mb-1">Report an Issue</Text>
                    <Text className="text-amber-700 text-xs leading-5">
                        Flagging an issue will notify the Project Manager and may pause production for this area.
                    </Text>
                </View>
            </View>

            <Text className="text-slate-700 font-bold mb-2 text-sm uppercase tracking-wider">Issue Type</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
                {ISSUE_TYPES.map(type => (
                    <TouchableOpacity
                        key={type}
                        onPress={() => setSelectedType(type)}
                        className={`px-3 py-2 rounded-lg border ${selectedType === type ? 'bg-slate-900 border-slate-900 shadow-sm' : 'bg-white border-slate-200'}`}
                    >
                        <Text className={`text-xs font-semibold ${selectedType === type ? 'text-white' : 'text-slate-600'}`}>{type}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text className="text-slate-700 font-bold mb-2 text-sm uppercase tracking-wider">Priority Level</Text>
            <View className="flex-row gap-2 mb-6">
                {PRIORITIES.map(p => (
                    <TouchableOpacity
                        key={p}
                        onPress={() => setSelectedPriority(p)}
                        className={`flex-1 flex-row items-center justify-center gap-2 px-3 py-2.5 rounded-lg border ${selectedPriority === p ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
                    >
                        <Flag size={14} color={selectedPriority === p ? 'white' : '#94a3b8'} fill={selectedPriority === p ? 'white' : 'transparent'} />
                        <Text className={`text-xs font-bold ${selectedPriority === p ? 'text-white' : 'text-slate-600'}`}>{p}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text className="text-slate-700 font-bold mb-2 text-sm uppercase tracking-wider">Description</Text>
            <TextInput
                className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-800 h-32 text-top mb-4 shadow-inner"
                multiline
                placeholder="Describe the issue in detail..."
                placeholderTextColor="#94a3b8"
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
            />

            {photoUri ? (
                <View className="mb-6 relative w-32 h-32">
                    <Image source={{ uri: photoUri }} className="w-full h-full rounded-xl border border-slate-200" />
                    <TouchableOpacity
                        onPress={() => setPhotoUri(null)}
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-sm"
                    >
                        <X size={14} color="white" />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity onPress={handleAttachPhoto} className="flex-row items-center justify-center border border-slate-300 border-dashed rounded-xl p-4 mb-6 active:bg-slate-50 transition-colors">
                    <Camera size={20} color="#64748b" className="mr-2" />
                    <Text className="text-slate-500 font-semibold">Attach Photo Evidence</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleSubmit} className="bg-red-600 py-4 rounded-xl items-center shadow-md active:bg-red-700 mb-10 overflow-hidden">
                <Text className="text-white font-black text-base tracking-widest uppercase">Submit Issue Report</Text>
            </TouchableOpacity>

            {/* EXISTING ISSUES LIST (READ-ONLY PREVIEW) */}
            {issues.length > 0 && (
                <View>
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Unit Issues History ({issues.length})</Text>
                    {issues.map((issue) => (
                        <View key={issue.id} className="bg-white border border-slate-200 p-4 rounded-xl mb-3 shadow-sm">
                            <View className="flex-row justify-between items-start mb-2">
                                <View className="bg-red-50 px-2 py-1 rounded border border-red-100 self-start">
                                    <Text className="text-red-700 text-[9px] font-black uppercase tracking-tighter">{issue.type}</Text>
                                </View>
                                <Text className="text-slate-400 text-[10px] font-bold">{new Date(issue.created_at).toLocaleDateString()}</Text>
                            </View>
                            <Text className="text-slate-800 text-sm leading-5 font-medium">{issue.description}</Text>
                            <View className="mt-3 pt-3 border-t border-slate-100 flex-row items-center">
                                <View className={`w-2.5 h-2.5 rounded-full mr-2 ${issue.status === 'open' ? 'bg-red-500 shadow-sm shadow-red-200' : 'bg-green-500'}`} />
                                <Text className="text-[10px] font-black text-slate-500 uppercase flex-1">{issue.status}</Text>
                                <View className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100">
                                    <Text className="text-[9px] font-bold text-slate-400 uppercase">{issue.priority}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

