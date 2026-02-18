import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, Alert, Platform } from 'react-native';
import { X, Plus, Trash2, User, Truck, Edit3, Check } from 'lucide-react-native';
import { SupabaseService } from '../../services/SupabaseService';

type FleetResource = { id: string; type: string; name: string; is_active: boolean };

interface Props {
    visible: boolean;
    onClose: () => void;
    onUpdated: () => void;
}

export default function FleetManagementModal({ visible, onClose, onUpdated }: Props) {
    const [drivers, setDrivers] = useState<FleetResource[]>([]);
    const [trucks, setTrucks] = useState<FleetResource[]>([]);
    const [newDriverName, setNewDriverName] = useState('');
    const [newTruckName, setNewTruckName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [activeTab, setActiveTab] = useState<'drivers' | 'trucks'>('drivers');

    useEffect(() => {
        if (visible) loadFleet();
    }, [visible]);

    const loadFleet = async () => {
        const [d, t] = await Promise.all([
            SupabaseService.getFleetResources('driver'),
            SupabaseService.getFleetResources('truck'),
        ]);
        setDrivers(d);
        setTrucks(t);
    };

    const handleAdd = async (type: 'driver' | 'truck') => {
        const name = type === 'driver' ? newDriverName.trim() : newTruckName.trim();
        if (!name) return;
        try {
            await SupabaseService.saveFleetResource({ type, name });
            type === 'driver' ? setNewDriverName('') : setNewTruckName('');
            await loadFleet();
            onUpdated();
        } catch (err) {
            console.error('Add fleet resource error:', err);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const msg = `Remove "${name}"? This cannot be undone.`;
        if (Platform.OS === 'web') {
            if (!window.confirm(msg)) return;
        } else {
            // For native, use Alert (simplified for web-first)
        }
        try {
            await SupabaseService.deleteFleetResource(id);
            await loadFleet();
            onUpdated();
        } catch (err) {
            console.error('Delete fleet resource error:', err);
        }
    };

    const handleSaveEdit = async (resource: FleetResource) => {
        if (!editingName.trim()) return;
        try {
            await SupabaseService.saveFleetResource({
                id: resource.id,
                type: resource.type as 'driver' | 'truck',
                name: editingName.trim(),
            });
            setEditingId(null);
            setEditingName('');
            await loadFleet();
            onUpdated();
        } catch (err) {
            console.error('Edit fleet resource error:', err);
        }
    };

    const items = activeTab === 'drivers' ? drivers : trucks;
    const Icon = activeTab === 'drivers' ? User : Truck;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View className="bg-white rounded-3xl shadow-2xl" style={{ width: 480, maxHeight: 600, overflow: 'hidden' }}>
                    {/* Header */}
                    <View className="p-6 border-b border-slate-100 flex-row items-center justify-between">
                        <View>
                            <Text className="text-slate-900 font-inter font-black text-lg">Fleet Management</Text>
                            <Text className="text-slate-400 text-xs font-bold mt-0.5">Add, edit, or remove drivers and trucks</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-slate-100">
                            <X size={18} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View className="flex-row border-b border-slate-100">
                        <TouchableOpacity
                            onPress={() => setActiveTab('drivers')}
                            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'drivers' ? 'border-blue-600' : 'border-transparent'}`}
                        >
                            <View className="flex-row items-center gap-2">
                                <User size={14} color={activeTab === 'drivers' ? '#2563eb' : '#94a3b8'} />
                                <Text className={`text-xs font-black uppercase tracking-widest ${activeTab === 'drivers' ? 'text-blue-600' : 'text-slate-400'}`}>
                                    Drivers ({drivers.length})
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('trucks')}
                            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'trucks' ? 'border-blue-600' : 'border-transparent'}`}
                        >
                            <View className="flex-row items-center gap-2">
                                <Truck size={14} color={activeTab === 'trucks' ? '#2563eb' : '#94a3b8'} />
                                <Text className={`text-xs font-black uppercase tracking-widest ${activeTab === 'trucks' ? 'text-blue-600' : 'text-slate-400'}`}>
                                    Trucks ({trucks.length})
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Add New */}
                    <View className="px-6 pt-4 pb-2">
                        <View className="flex-row gap-2">
                            <TextInput
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                                placeholder={activeTab === 'drivers' ? 'New driver name...' : 'New truck name...'}
                                placeholderTextColor="#94a3b8"
                                value={activeTab === 'drivers' ? newDriverName : newTruckName}
                                onChangeText={activeTab === 'drivers' ? setNewDriverName : setNewTruckName}
                                onSubmitEditing={() => handleAdd(activeTab === 'drivers' ? 'driver' : 'truck')}
                            />
                            <TouchableOpacity
                                onPress={() => handleAdd(activeTab === 'drivers' ? 'driver' : 'truck')}
                                className="bg-blue-600 px-4 rounded-xl items-center justify-center"
                            >
                                <Plus size={18} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* List */}
                    <ScrollView className="px-6 pb-6" style={{ maxHeight: 340 }}>
                        {items.length === 0 ? (
                            <View className="py-12 items-center">
                                <Icon size={32} color="#cbd5e1" />
                                <Text className="text-slate-400 text-sm font-bold mt-3">
                                    No {activeTab} added yet
                                </Text>
                            </View>
                        ) : (
                            <View className="gap-1.5 mt-2">
                                {items.map(item => (
                                    <View key={item.id} className="flex-row items-center bg-slate-50 rounded-xl px-4 py-3 gap-3 border border-slate-100">
                                        <Icon size={14} color="#64748b" />
                                        {editingId === item.id ? (
                                            <>
                                                <TextInput
                                                    className="flex-1 text-sm font-bold text-slate-800 bg-white border border-blue-200 rounded-lg px-3 py-1.5"
                                                    value={editingName}
                                                    onChangeText={setEditingName}
                                                    autoFocus
                                                    onSubmitEditing={() => handleSaveEdit(item)}
                                                />
                                                <TouchableOpacity onPress={() => handleSaveEdit(item)} className="p-1.5 rounded-lg bg-blue-100">
                                                    <Check size={14} color="#2563eb" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => { setEditingId(null); setEditingName(''); }} className="p-1.5 rounded-lg bg-slate-200">
                                                    <X size={14} color="#64748b" />
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <>
                                                <Text className="flex-1 text-sm font-bold text-slate-800">{item.name}</Text>
                                                <TouchableOpacity onPress={() => { setEditingId(item.id); setEditingName(item.name); }} className="p-1.5 rounded-lg bg-slate-200/70">
                                                    <Edit3 size={13} color="#64748b" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} className="p-1.5 rounded-lg bg-red-50">
                                                    <Trash2 size={13} color="#ef4444" />
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
