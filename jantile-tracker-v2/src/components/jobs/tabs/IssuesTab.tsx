import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, ScrollView, Alert, Platform } from 'react-native';
import { AlertTriangle, Camera, ChevronDown, CheckCircle2, Clock, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Issue } from '../AreaDetailsDrawer';

type IssuesTabProps = {
    issues?: Issue[];
    onReport: (issue: Omit<Issue, 'id' | 'status' | 'date'>) => void;
};

const ISSUE_TYPES = ['Material Shortage', 'Design Discrepancy', 'Damage Report', 'Work Stoppage', 'Other'];

export default function IssuesTab({ issues = [], onReport }: IssuesTabProps) {

    // Form State
    const [selectedType, setSelectedType] = useState(ISSUE_TYPES[0]);
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
            photo: photoUri || undefined
        });

        // Reset Form
        setDescription('');
        setPhotoUri(null);
        setSelectedType(ISSUE_TYPES[0]);

        if (Platform.OS === 'web') {
            window.alert("Issue Reported Successfully");
        } else {
            Alert.alert("Reported", "Issue has been flagged.");
        }
    };

    return (
        <View>
            {/* NEW ISSUE FORM */}
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
            <View className="flex-row flex-wrap gap-2 mb-4">
                {ISSUE_TYPES.map(type => (
                    <TouchableOpacity
                        key={type}
                        onPress={() => setSelectedType(type)}
                        className={`px-3 py-2 rounded-lg border ${selectedType === type ? 'bg-slate-800 border-slate-900' : 'bg-white border-slate-200'}`}
                    >
                        <Text className={`text-xs font-semibold ${selectedType === type ? 'text-white' : 'text-slate-600'}`}>{type}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text className="text-slate-700 font-bold mb-2 text-sm">Description</Text>
            <TextInput
                className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-800 h-32 text-top mb-4"
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
                        className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                    >
                        <X size={14} color="white" />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity onPress={handleAttachPhoto} className="flex-row items-center justify-center border border-slate-300 border-dashed rounded-xl p-4 mb-6 active:bg-slate-50">
                    <Camera size={20} color="#64748b" className="mr-2" />
                    <Text className="text-slate-500 font-semibold">Attach Photo Evidence</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleSubmit} className="bg-red-600 py-3.5 rounded-xl items-center shadow-sm active:bg-red-700 mb-8">
                <Text className="text-white font-bold text-base">Submit Issue Report</Text>
            </TouchableOpacity>

            {/* EXISTING ISSUES LIST */}
            {issues.length > 0 && (
                <View>
                    <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Reported Issues ({issues.length})</Text>
                    {issues.map((issue) => (
                        <View key={issue.id} className="bg-white border border-slate-200 p-4 rounded-xl mb-3">
                            <View className="flex-row justify-between items-start mb-2">
                                <View className="bg-red-50 px-2 py-1 rounded border border-red-100 self-start">
                                    <Text className="text-red-700 text-[10px] font-bold uppercase">{issue.type}</Text>
                                </View>
                                <Text className="text-slate-400 text-xs">{new Date(issue.date).toLocaleDateString()}</Text>
                            </View>
                            <Text className="text-slate-800 text-sm">{issue.description}</Text>
                            {issue.photo && (
                                <Image source={{ uri: issue.photo }} className="w-16 h-16 rounded mt-3 bg-slate-100" />
                            )}
                            <View className="mt-3 pt-3 border-t border-slate-100 flex-row items-center">
                                <View className={`w-2 h-2 rounded-full mr-2 ${issue.status === 'OPEN' ? 'bg-red-500' : 'bg-green-500'}`} />
                                <Text className="text-xs font-semibold text-slate-600">{issue.status}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}
