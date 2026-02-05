import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseService } from '../../services/SupabaseService';

interface EditAreaModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (areaId: string, updates: { name: string, description?: string, drawing_page?: string }) => void;
    area: any;
}

export default function EditAreaModal({ visible, onClose, onSave, area }: EditAreaModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (visible && area) {
            setName(area.name || '');
            setDescription(area.description || '');
        }
    }, [visible, area]);

    const handleSave = () => {
        if (!name.trim()) {
            alert('Area Name is required');
            return;
        }

        onSave(area.id, {
            name,
            description
        });
        onClose();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View className="flex-1 bg-black/60 justify-center items-center p-4">
                <View className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                    {/* Header */}
                    <View className="p-6 border-b border-slate-100 flex-row justify-between items-center bg-slate-50">
                        <View className="flex-row items-center gap-3">
                            <View className="bg-blue-100 p-2 rounded-lg">
                                <Ionicons name="create" size={20} color="#2563eb" />
                            </View>
                            <Text className="text-xl font-inter font-black text-slate-900">Edit Area Details</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-200/50 rounded-full hover:bg-slate-200">
                            <Ionicons name="close" size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-6">
                        {/* Area Name */}
                        <View className="mb-6">
                            <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Area Name</Text>
                            <TextInput
                                className="bg-white border border-slate-200 p-3.5 rounded-xl text-base font-bold text-slate-900 shadow-sm"
                                placeholder="e.g. Master Bathroom"
                                placeholderTextColor="#94a3b8"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        {/* Description */}
                        <View className="mb-6">
                            <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Description</Text>
                            <TextInput
                                className="bg-white border border-slate-200 p-3.5 rounded-xl text-sm font-medium text-slate-900 shadow-sm min-h-[80px]"
                                placeholder="Optional description or notes..."
                                placeholderTextColor="#94a3b8"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>



                        {/* Action Buttons */}
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={onClose}
                                className="flex-1 py-4 bg-slate-100 rounded-xl items-center border border-slate-200"
                            >
                                <Text className="text-slate-600 font-bold font-inter">Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSave}
                                className="flex-[2] py-4 bg-blue-600 rounded-xl items-center shadow-lg shadow-blue-200 flex-row justify-center gap-2"
                            >
                                <Ionicons name="save-outline" size={18} color="white" />
                                <Text className="text-white font-black font-inter uppercase tracking-wide">Save Changes</Text>
                            </TouchableOpacity>
                        </View>

                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
