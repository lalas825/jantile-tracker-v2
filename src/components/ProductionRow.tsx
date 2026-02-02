import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProductionRowProps {
    log: any;
    activeJobs: any[];
    onUpdate: (field: string | Record<string, any>, value?: any) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onSelectJob?: () => void; // New prop for triggers job picker modal
}

// REFINED COLORS (LAYERED PASTELS)
const COLORS = [
    { id: 'white', code: '#ffffff', border: '#e2e8f0', inputBg: '#f8fafc', dot: '#ffffff' },
    { id: 'green', code: '#dcfce7', border: '#bbf7d0', inputBg: '#f0fdf4', dot: '#86efac' },
    { id: 'yellow', code: '#fef9c3', border: '#fef08a', inputBg: '#fefce8', dot: '#fde047' },
    { id: 'red', code: '#fee2e2', border: '#fecaca', inputBg: '#fef2f2', dot: '#fca5a5' },
    { id: 'purple', code: '#f3e8ff', border: '#e9d5ff', inputBg: '#faf5ff', dot: '#d8b4fe' },
    { id: 'blue', code: '#dbeafe', border: '#bfdbfe', inputBg: '#eff6ff', dot: '#93c5fd' },
    { id: 'orange', code: '#ffedd5', border: '#fed7aa', inputBg: '#fff7ed', dot: '#fdba74' },
    { id: 'pink', code: '#fce7f3', border: '#fbcfe8', inputBg: '#fdf2f8', dot: '#f9a8d4' },
    { id: 'teal', code: '#ccfbf1', border: '#99f6e4', inputBg: '#f0fdfa', dot: '#5eead4' },
    { id: 'gray', code: '#f1f5f9', border: '#e2e8f0', inputBg: '#f8fafc', dot: '#cbd5e1' },
];

export default function ProductionRow({ log, activeJobs, onUpdate, onDelete, onDuplicate, onSelectJob }: ProductionRowProps) {
    const [localData, setLocalData] = useState(log);

    useEffect(() => {
        setLocalData(log);
    }, [log]);

    const handleChange = (field: string, value: any) => {
        setLocalData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = (field: string) => {
        if (localData[field] !== log[field]) {
            onUpdate(field, localData[field]);
        }
    };

    // Get active color object
    const activeColor = COLORS.find(c => c.id === (localData.statusColor || 'white')) || COLORS[0];

    return (
        <View
            className="flex-row items-center p-3 mb-2 rounded-2xl shadow-sm border"
            style={{
                backgroundColor: activeColor.code,
                borderColor: activeColor.id === 'white' ? '#e2e8f0' : activeColor.border,
            }}
        >

            {/* 1. JOB SELECTOR */}
            <View className="mx-1" style={{ width: 180 }}>
                <Text className="text-[10px] text-slate-500 font-bold mb-1">JOB</Text>
                {Platform.OS === 'web' ? (
                    <select
                        value={localData.jobId || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            const job = activeJobs.find(j => j.id === val);
                            handleChange('jobId', val);
                            onUpdate({ jobId: val, jobName: job?.name || '' });
                        }}
                        className="h-[40px] w-full rounded border px-2 text-sm"
                        style={{
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            outline: 'none',
                            backgroundColor: activeColor.inputBg,
                            borderColor: activeColor.border
                        }}
                    >
                        <option value="" disabled>Select Job</option>
                        {activeJobs.map((j) => (
                            <option key={j.id} value={j.id}>{j.name}</option>
                        ))}
                    </select>
                ) : (
                    <TouchableOpacity
                        className="h-[40px] w-full rounded border px-2 justify-center"
                        style={{ borderColor: activeColor.border, backgroundColor: activeColor.inputBg }}
                        onPress={onSelectJob}
                    >
                        <Text className="text-sm text-slate-700" numberOfLines={1}>
                            {activeJobs.find(j => j.id === localData.jobId)?.name || localData.jobName || 'Select Job'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* 2. PL Number */}
            <View className="mx-1" style={{ width: 80 }}>
                <Text className="text-[10px] text-slate-500 font-bold mb-1">PL #</Text>
                <TextInput
                    value={localData.plNumber || ''}
                    onChangeText={(val) => handleChange('plNumber', val)}
                    onBlur={() => handleSave('plNumber')}
                    className="h-[40px] w-full border rounded px-2 text-sm"
                    style={{ borderColor: activeColor.border, backgroundColor: activeColor.inputBg }}
                    placeholder="PL#"
                    placeholderTextColor="#94a3b8"
                />
            </View>

            {/* 3. Unit */}
            <View className="mx-1" style={{ width: 60 }}>
                <Text className="text-[10px] text-slate-500 font-bold mb-1">UNIT</Text>
                <TextInput
                    value={localData.unit || ''}
                    onChangeText={(val) => handleChange('unit', val)}
                    onBlur={() => handleSave('unit')}
                    className="h-[40px] w-full border rounded px-2 text-sm"
                    style={{ borderColor: activeColor.border, backgroundColor: activeColor.inputBg }}
                    placeholder="Unit"
                    placeholderTextColor="#94a3b8"
                />
            </View>

            {/* 4. Reg Hours */}
            <View className="mx-1" style={{ width: 50 }}>
                <Text className="text-[10px] text-slate-600 font-bold mb-1">REG</Text>
                <TextInput
                    keyboardType="numeric"
                    value={localData.regHours?.toString() || ''}
                    onChangeText={(val) => handleChange('regHours', val)}
                    onBlur={() => handleSave('regHours')}
                    className="h-[40px] w-full border rounded text-center font-bold text-slate-800"
                    style={{ borderColor: activeColor.border, backgroundColor: activeColor.inputBg }}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                />
            </View>

            {/* 5. OT Hours */}
            <View className="mx-1" style={{ width: 50 }}>
                <Text className="text-[10px] text-slate-600 font-bold mb-1">OT</Text>
                <TextInput
                    keyboardType="numeric"
                    value={localData.otHours?.toString() || ''}
                    onChangeText={(val) => handleChange('otHours', val)}
                    onBlur={() => handleSave('otHours')}
                    className="h-[40px] w-full border rounded text-center font-bold text-slate-800"
                    style={{ borderColor: activeColor.border, backgroundColor: activeColor.inputBg }}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                />
            </View>

            {/* 6. Ticket # */}
            <View className="mx-1" style={{ width: 80 }}>
                <Text className="text-[10px] text-blue-500 font-bold mb-1">TKT #</Text>
                <TextInput
                    value={localData.ticketNumber || ''}
                    onChangeText={(val) => handleChange('ticketNumber', val)}
                    onBlur={() => handleSave('ticketNumber')}
                    className="h-[40px] w-full border rounded px-2 text-sm"
                    style={{ borderColor: activeColor.border, backgroundColor: activeColor.inputBg }}
                    placeholder="Tkt #"
                    placeholderTextColor="#94a3b8"
                />
            </View>

            {/* 7. Checkboxes (Mutually Exclusive) */}
            <View className="flex-row items-center mx-2 mt-4 gap-4">
                <TouchableOpacity
                    onPress={() => {
                        const val = !localData.isJantile;
                        const nextTicket = val ? false : localData.isTicket;
                        handleChange('isJantile', val);
                        handleChange('isTicket', nextTicket);
                        onUpdate({ isJantile: val, isTicket: nextTicket });
                    }}
                    className="flex-row items-center"
                >
                    <View className={`w-5 h-5 rounded border items-center justify-center ${localData.isJantile ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                        {localData.isJantile && <Ionicons name="checkmark" size={14} color="white" />}
                    </View>
                    <Text className="text-[10px] ml-1.5 text-slate-600 font-bold">JAN</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        const val = !localData.isTicket;
                        const nextJantile = val ? false : localData.isJantile;
                        handleChange('isTicket', val);
                        handleChange('isJantile', nextJantile);
                        onUpdate({ isTicket: val, isJantile: nextJantile });
                    }}
                    className="flex-row items-center"
                >
                    <View className={`w-5 h-5 rounded border items-center justify-center ${localData.isTicket ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                        {localData.isTicket && <Ionicons name="checkmark" size={14} color="white" />}
                    </View>
                    <Text className="text-[10px] ml-1.5 text-slate-600 font-bold">TKT</Text>
                </TouchableOpacity>
            </View>

            {/* 8. Color Picker Dots */}
            <View className="flex-row items-center mt-4 ml-2">
                {COLORS.map((c) => (
                    <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                            handleChange('statusColor', c.id);
                            onUpdate('statusColor', c.id);
                        }}
                        style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: c.dot,
                            marginHorizontal: 2,
                            borderWidth: 1,
                            borderColor: localData.statusColor === c.id ? '#0f172a' : 'rgba(0,0,0,0.1)'
                        }}
                    />
                ))}
                {/* Reset Color */}
                <TouchableOpacity
                    onPress={() => {
                        handleChange('statusColor', 'white');
                        onUpdate('statusColor', 'white');
                    }}
                    style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', marginLeft: 2, alignItems: 'center', justifyContent: 'center' }}
                >
                    <Ionicons name="close" size={12} color="black" />
                </TouchableOpacity>
            </View>

            {/* 9. Action Buttons */}
            <View className="flex-1 flex-row justify-end mt-4">
                <TouchableOpacity onPress={onDuplicate} className="p-2 mr-1 bg-blue-50 rounded-full">
                    <Ionicons name="copy-outline" size={16} color="#2563eb" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} className="p-2 bg-red-50 rounded-full">
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                </TouchableOpacity>
            </View>

        </View>
    );
}
