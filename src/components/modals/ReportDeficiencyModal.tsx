import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, Modal, ScrollView,
    TextInput, Dimensions, Image, Alert, ActivityIndicator
} from 'react-native';
import { X, Camera, AlertTriangle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { SupabaseService } from '../../services/SupabaseService';
import { useAuth } from '../../context/AuthContext';
import { DEFICIENT_TYPES } from '../jobs/tabs/DeficientTab';

interface Area {
    id: string;
    name: string;
}

interface Unit {
    id: string;
    name: string;
    areas: Area[];
}

interface Floor {
    id: string;
    name: string;
    units: Unit[];
}

interface ReportDeficiencyModalProps {
    isVisible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    jobId: string;
    floors: Floor[];
}

export default function ReportDeficiencyModal({
    isVisible, onClose, onSuccess, jobId, floors
}: ReportDeficiencyModalProps) {
    const { user } = useAuth();
    const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);
    const [itemType, setItemType] = useState('Missing Prep Work');
    const [description, setDescription] = useState('');
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const { width } = Dimensions.get('window');
    const isDesktop = width > 768;

    useEffect(() => {
        if (!isVisible) {
            setSelectedFloor(null);
            setSelectedUnit(null);
            setSelectedArea(null);
            setItemType('Missing Prep Work');
            setDescription('');
            setPhotoUri(null);
        }
    }, [isVisible]);

    const handleFloorSelect = (floor: Floor) => {
        setSelectedFloor(floor);
        setSelectedUnit(null);
        setSelectedArea(null);
    };

    const handleUnitSelect = (unit: Unit) => {
        setSelectedUnit(unit);
        setSelectedArea(null);
    };

    const handleAttachPhoto = async () => {
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.5,
        });
        if (!result.canceled && result.assets?.length > 0) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Notes Required', 'Please describe the deficiency preventing work from starting.');
            return;
        }
        if (!selectedFloor) {
            Alert.alert('Location Required', 'Please select at least a floor for this item.');
            return;
        }
        setSubmitting(true);
        try {
            await SupabaseService.createIssue({
                job_id: jobId,
                area_id: selectedArea?.id ?? undefined,
                type: itemType,
                priority: 'Medium',
                description: description.trim(),
                photo_url: photoUri ?? undefined,
                created_by: (user as any)?.email ?? (user as any)?.user_metadata?.full_name ?? 'Unknown',
            });
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create deficiency item:', err);
            Alert.alert('Error', 'Failed to submit the deficiency. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const availableUnits = selectedFloor?.units ?? [];
    const availableAreas = selectedUnit?.areas ?? [];

    return (
        <Modal visible={isVisible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
                <View className={[
                    'bg-white shadow-2xl rounded-t-3xl overflow-hidden',
                    isDesktop ? 'self-center w-[620px] mb-10 rounded-3xl h-[85%]' : 'w-full h-[92%]'
                ].join(' ')}>
                    {/* Header */}
                    <View className="px-6 py-4 border-b border-slate-100 flex-row justify-between items-center bg-slate-50/50">
                        <View>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Deficient List</Text>
                            <Text className="text-xl font-black text-slate-900 tracking-tight">Add Deficiency</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-200 rounded-full">
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 px-6 pt-5" contentContainerStyle={{ paddingBottom: 120 }}>
                        {/* Floor */}
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                            Floor <Text className="text-red-400">*</Text>
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                            <View className="flex-row gap-2 pb-1">
                                {floors.length === 0 ? (
                                    <Text className="text-slate-400 text-sm italic py-2">No floors on this job yet</Text>
                                ) : floors.map(floor => (
                                    <TouchableOpacity
                                        key={floor.id}
                                        onPress={() => handleFloorSelect(floor)}
                                        className={`px-4 py-2 rounded-xl border ${selectedFloor?.id === floor.id
                                            ? 'bg-slate-900 border-slate-900'
                                            : 'bg-white border-slate-200'}`}
                                    >
                                        <Text className={`text-sm font-bold ${selectedFloor?.id === floor.id ? 'text-white' : 'text-slate-700'}`}>
                                            {floor.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        {/* Unit */}
                        {selectedFloor && availableUnits.length > 0 && (
                            <>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Unit</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                                    <View className="flex-row gap-2 pb-1">
                                        {availableUnits.map(unit => (
                                            <TouchableOpacity
                                                key={unit.id}
                                                onPress={() => handleUnitSelect(unit)}
                                                className={`px-4 py-2 rounded-xl border ${selectedUnit?.id === unit.id
                                                    ? 'bg-orange-500 border-orange-500'
                                                    : 'bg-white border-slate-200'}`}
                                            >
                                                <Text className={`text-sm font-bold ${selectedUnit?.id === unit.id ? 'text-white' : 'text-slate-700'}`}>
                                                    {unit.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </>
                        )}

                        {/* Area */}
                        {selectedUnit && availableAreas.length > 0 && (
                            <>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Area</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                                    <View className="flex-row gap-2 pb-1">
                                        {availableAreas.map(area => (
                                            <TouchableOpacity
                                                key={area.id}
                                                onPress={() => setSelectedArea(selectedArea?.id === area.id ? null : area)}
                                                className={`px-4 py-2 rounded-xl border ${selectedArea?.id === area.id
                                                    ? 'bg-orange-600 border-orange-600'
                                                    : 'bg-white border-slate-200'}`}
                                            >
                                                <Text className={`text-sm font-bold ${selectedArea?.id === area.id ? 'text-white' : 'text-slate-700'}`}>
                                                    {area.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </>
                        )}

                        {/* Item Type */}
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Deficiency Type</Text>
                        <View className="flex-row flex-wrap gap-2 mb-5">
                            {DEFICIENT_TYPES.map(type => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setItemType(type)}
                                    className={`px-3 py-1.5 rounded-lg border ${itemType === type
                                        ? 'bg-orange-500 border-orange-500'
                                        : 'bg-white border-slate-200'}`}
                                >
                                    <Text className={`text-xs font-bold ${itemType === type ? 'text-white' : 'text-slate-600'}`}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Notes */}
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                            Notes <Text className="text-red-400">*</Text>
                        </Text>
                        <TextInput
                            className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-800 min-h-[110px] text-sm mb-5"
                            multiline
                            textAlignVertical="top"
                            placeholder="Describe the deficiency preventing work from starting..."
                            value={description}
                            onChangeText={setDescription}
                        />

                        {/* Photo */}
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Photo Evidence</Text>
                        {photoUri ? (
                            <View className="flex-row items-center gap-3 mb-5">
                                <Image source={{ uri: photoUri }} className="w-20 h-20 rounded-xl" />
                                <TouchableOpacity
                                    onPress={() => setPhotoUri(null)}
                                    className="p-2 bg-red-50 rounded-full border border-red-100"
                                >
                                    <X size={16} color="#ef4444" />
                                </TouchableOpacity>
                                <Text className="text-slate-500 text-xs flex-1">Photo attached</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={handleAttachPhoto}
                                className="border-2 border-dashed border-slate-200 rounded-2xl p-5 items-center justify-center mb-5 flex-row gap-3"
                            >
                                <Camera size={20} color="#94a3b8" />
                                <Text className="text-slate-400 font-semibold text-sm">Attach Photo</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View className="p-6 border-t border-slate-100 bg-white">
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={onClose}
                                className="flex-1 h-14 rounded-2xl items-center justify-center bg-slate-100 border border-slate-200"
                            >
                                <Text className="text-slate-600 font-black uppercase text-sm tracking-widest">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={submitting}
                                className={`flex-1 h-14 rounded-2xl items-center justify-center shadow-lg ${submitting ? 'bg-slate-400' : 'bg-orange-500'}`}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <View className="flex-row items-center gap-2">
                                        <AlertTriangle size={18} color="white" />
                                        <Text className="text-white font-black uppercase text-sm tracking-widest">Add Item</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
