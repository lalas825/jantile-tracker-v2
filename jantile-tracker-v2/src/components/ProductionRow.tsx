import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProductionRowProps {
    log: any;
    activeJobs: any[];
    onUpdate: (field: string, value: any) => void;
    onDelete: () => void;
    onDuplicate: () => void; // Added back the Duplicate feature
}

// RESTORED COLORS
const COLORS = [
    { id: 'white', code: '#ffffff', border: '#e2e8f0', dot: '#ffffff' },
    { id: 'green', code: '#dcfce7', border: '#86efac', dot: '#dcfce7' },
    { id: 'yellow', code: '#fef9c3', border: '#fde047', dot: '#fef9c3' },
    { id: 'red', code: '#fee2e2', border: '#fca5a5', dot: '#fee2e2' },
    { id: 'purple', code: '#f3e8ff', border: '#d8b4fe', dot: '#f3e8ff' },
    { id: 'blue', code: '#dbeafe', border: '#93c5fd', dot: '#dbeafe' },
    { id: 'orange', code: '#ffedd5', border: '#fdba74', dot: '#ffedd5' },
    { id: 'pink', code: '#fce7f3', border: '#f9a8d4', dot: '#fce7f3' },
    { id: 'teal', code: '#ccfbf1', border: '#5eead4', dot: '#ccfbf1' },
    { id: 'gray', code: '#f1f5f9', border: '#cbd5e1', dot: '#f1f5f9' },
];

export default function ProductionRow({ log, activeJobs, onUpdate, onDelete, onDuplicate }: ProductionRowProps) {
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
                <select
                    value={localData.jobId || ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        handleChange('jobId', val);
                        onUpdate('jobId', val);
                    }}
                    className="h-[40px] w-full rounded border border-gray-300 px-2 bg-transparent text-sm"
                    style={{ appearance: 'none', WebkitAppearance: 'none', outline: 'none' }}
                >
                    <option value="" disabled>Select Job</option>
                    {activeJobs.map((j) => (
                        <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                </select>
            </View>

            {/* 2. PL Number */}
            <View className="mx-1" style={{ width: 80 }}>
                <Text className="text-[10px] text-slate-500 font-bold mb-1">PL #</Text>
                <input
                    type="text"
                    value={localData.plNumber || ''}
                    onChange={(e) => handleChange('plNumber', e.target.value)}
                    onBlur={() => handleSave('plNumber')}
                    className="h-[40px] w-full border border-gray-300 rounded px-2 text-sm bg-transparent"
                    placeholder="PL#"
                    style={{ outline: 'none' }}
                />
            </View>

            {/* 3. Unit */}
            <View className="mx-1" style={{ width: 60 }}>
                <Text className="text-[10px] text-slate-500 font-bold mb-1">UNIT</Text>
                <input
                    type="text"
                    value={localData.unit || ''}
                    onChange={(e) => handleChange('unit', e.target.value)}
                    onBlur={() => handleSave('unit')}
                    className="h-[40px] w-full border border-gray-300 rounded px-2 text-sm bg-transparent"
                    placeholder="Unit"
                    style={{ outline: 'none' }}
                />
            </View>

            {/* 4. Reg Hours */}
            <View className="mx-1" style={{ width: 50 }}>
                <Text className="text-[10px] text-slate-600 font-bold mb-1">REG</Text>
                <input
                    type="number"
                    value={localData.regHours || ''}
                    onChange={(e) => handleChange('regHours', e.target.value)}
                    onBlur={() => handleSave('regHours')}
                    className="h-[40px] w-full border border-gray-300 rounded text-center font-bold text-slate-800 bg-transparent"
                    placeholder="0"
                    style={{ outline: 'none' }}
                />
            </View>

            {/* 5. OT Hours */}
            <View className="mx-1" style={{ width: 50 }}>
                <Text className="text-[10px] text-slate-600 font-bold mb-1">OT</Text>
                <input
                    type="number"
                    value={localData.otHours || ''}
                    onChange={(e) => handleChange('otHours', e.target.value)}
                    onBlur={() => handleSave('otHours')}
                    className="h-[40px] w-full border border-gray-300 rounded text-center font-bold text-slate-800 bg-transparent"
                    placeholder="0"
                    style={{ outline: 'none' }}
                />
            </View>

            {/* 6. Ticket # */}
            <View className="mx-1" style={{ width: 80 }}>
                <Text className="text-[10px] text-blue-500 font-bold mb-1">TKT #</Text>
                <input
                    type="text"
                    value={localData.ticketNumber || ''}
                    onChange={(e) => handleChange('ticketNumber', e.target.value)}
                    onBlur={() => handleSave('ticketNumber')}
                    className="h-[40px] w-full border border-gray-300 rounded px-2 text-sm bg-transparent"
                    placeholder="Tkt #"
                    style={{ outline: 'none' }}
                />
            </View>

            {/* 7. Checkboxes (Cleaned up: No black border boxes) */}
            <View className="flex-row items-center mx-2 mt-4 space-x-2">
                <label className="flex-row items-center px-1 py-1">
                    <input
                        type="checkbox"
                        checked={localData.isJantile || false}
                        onChange={(e) => {
                            handleChange('isJantile', e.target.checked);
                            onUpdate('isJantile', e.target.checked);
                        }}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <Text className="text-[10px] ml-1.5 text-slate-600 font-bold">JAN</Text>
                </label>

                <label className="flex-row items-center px-1 py-1 ml-1">
                    <input
                        type="checkbox"
                        checked={localData.isTicket || false}
                        onChange={(e) => {
                            handleChange('isTicket', e.target.checked);
                            onUpdate('isTicket', e.target.checked);
                        }}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <Text className="text-[10px] ml-1.5 text-slate-600 font-bold">TKT</Text>
                </label>
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
