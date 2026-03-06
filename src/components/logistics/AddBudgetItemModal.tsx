import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectMaterial } from '../../services/SupabaseService';
import { useMaterialForm, CATEGORIES, COST_BASIS_OPTIONS, TROWEL_PRESETS, JOINT_WIDTHS } from '../../features/logistics/hooks/useMaterialForm';

interface AddBudgetItemModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (material: Partial<ProjectMaterial>) => void;
    initialData?: ProjectMaterial | null;
    areas?: any[]; // List of areas for the job
    units?: any[]; // List of units for the job (needed for new area creation)
    lockedAreaId?: string; // If provided, lock selection to this area
    isGeneralStock?: boolean; // If true, hide area/unit selection for unallocated stock
}

export default function AddBudgetItemModal({ visible, onClose, onSave, initialData, areas = [], units = [], lockedAreaId, isGeneralStock }: AddBudgetItemModalProps) {
    const {
        // Basic fields
        code, setCode,
        category,
        productName, setProductName,
        specs, setSpecs,
        zone, setZone,
        areaId, setAreaId,
        subLocation, setSubLocation,
        defaultSubLocation,
        supplier, setSupplier,

        // Calculator fields
        dimLength, dimWidth, dimThickness,
        linearFeet,
        netQty, wastePercent,
        manualQty, setManualQty,
        manualPcs, setManualPcs,
        yieldPerUnit, trowelPreset, jointWidth,
        bagWeight,

        // Linked info
        groutInfo, setGroutInfo,
        caulkInfo, setCaulkInfo,

        // Financials
        unitCost, setUnitCost,
        costBasis, setCostBasis,
        unit,

        // UI state
        showCategoryMenu, setShowCategoryMenu,
        showCostBasisMenu, setShowCostBasisMenu,
        showPresetMenu, setShowPresetMenu,
        showJointMenu, setShowJointMenu,
        showAreaMenu, setShowAreaMenu,
        isCreatingNewArea, setIsCreatingNewArea,
        newAreaName, setNewAreaName,
        newAreaDescription, setNewAreaDescription,

        // Computed
        totalEstimatedCost,

        // Smart handlers
        onDimLengthChange, onDimWidthChange, onDimThicknessChange,
        onNetQtyChange, onWastePercentChange,
        onLinearFeetChange, onBagWeightChange, onYieldPerUnitChange,
        onCategoryChange, onJointWidthSelect, onTrowelPresetSelect,

        // Actions
        handleSave,
    } = useMaterialForm({ visible, onClose, onSave, initialData, areas, units, lockedAreaId, isGeneralStock });

    const renderCalculator = () => {
        const pColor = "#94a3b8";
        if (category === 'Tile' || category === 'Stone') {
            return (
                <View className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-6">
                    <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="calculator" size={14} color="#3b82f6" />
                        <Text className="text-[10px] font-inter font-black text-blue-800 uppercase tracking-widest">Tile Calculator</Text>
                    </View>
                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-[3]">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Dimensions (Length x Width)</Text>
                            <View className="flex-row items-center gap-2">
                                <TextInput
                                    className="flex-1 bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                    placeholder='L (e.g "24 7/8")'
                                    placeholderTextColor={pColor}
                                    value={dimLength}
                                    onChangeText={onDimLengthChange}
                                />
                                <Text className="text-blue-300 font-bold">×</Text>
                                <TextInput
                                    className="flex-1 bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                    placeholder='W (e.g "12 1/2")'
                                    placeholderTextColor={pColor}
                                    value={dimWidth}
                                    onChangeText={onDimWidthChange}
                                />
                            </View>
                        </View>
                        <View className="flex-[1]">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Thickness</Text>
                            <TextInput
                                className="bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                placeholder='Thk (3/8")'
                                placeholderTextColor={pColor}
                                value={dimThickness}
                                onChangeText={onDimThicknessChange}
                            />
                        </View>
                    </View>
                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Net Qty (SQFT)</Text>
                            <TextInput
                                className="bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                keyboardType="numeric"
                                value={netQty}
                                onChangeText={onNetQtyChange}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Waste %</Text>
                            <TextInput
                                className="bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                keyboardType="numeric"
                                value={wastePercent}
                                onChangeText={onWastePercentChange}
                            />
                        </View>
                    </View>
                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Count (Pieces)</Text>
                            <TextInput
                                className="bg-slate-50 border border-blue-100 p-2.5 rounded-lg text-sm font-bold text-blue-400"
                                keyboardType="numeric"
                                value={manualPcs}
                                editable={false}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Total Budget Qty</Text>
                            <TextInput
                                className="bg-blue-100/50 border border-blue-200 p-2.5 rounded-lg text-sm font-black text-blue-900"
                                keyboardType="numeric"
                                value={manualQty}
                                onChangeText={setManualQty}
                            />
                        </View>
                    </View>
                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Grout</Text>
                            <TextInput
                                className="bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                placeholder="e.g. Laticrete #76"
                                placeholderTextColor={pColor}
                                value={groutInfo}
                                onChangeText={setGroutInfo}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Caulk</Text>
                            <TextInput
                                className="bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                placeholder="e.g. Color Match"
                                placeholderTextColor={pColor}
                                value={caulkInfo}
                                onChangeText={setCaulkInfo}
                            />
                        </View>
                    </View>
                </View>
            );
        }

        if (category === 'Base') {
            return (
                <View className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 mb-6">
                    <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="resize" size={14} color="#6366f1" />
                        <Text className="text-[10px] font-inter font-black text-indigo-800 uppercase tracking-widest">Base Calculator</Text>
                    </View>
                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-[1]">
                            <Text className="text-[9px] font-bold text-indigo-600 uppercase mb-2">Piece Length (Inches)</Text>
                            <TextInput
                                className="bg-white border border-indigo-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                placeholder='Len (e.g "48")'
                                placeholderTextColor="#94a3b8"
                                value={dimLength}
                                onChangeText={onDimLengthChange}
                            />
                        </View>
                        <View className="flex-[1]">
                            <Text className="text-[9px] font-bold text-indigo-600 uppercase mb-2">Piece Height (Inches)</Text>
                            <TextInput
                                className="bg-white border border-indigo-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                placeholder='Hgt (e.g "4")'
                                placeholderTextColor="#94a3b8"
                                value={dimWidth}
                                onChangeText={onDimWidthChange}
                            />
                        </View>
                    </View>
                    <View className="flex-row gap-3">
                        <View className="flex-[2]">
                            <Text className="text-[9px] font-bold text-indigo-600 uppercase mb-2">Total Linear Feet (LF)</Text>
                            <TextInput
                                className="bg-indigo-100 border border-indigo-200 p-2.5 rounded-lg text-lg font-black text-indigo-900"
                                keyboardType="numeric"
                                value={linearFeet}
                                onChangeText={onLinearFeetChange}
                            />
                        </View>
                        <View className="flex-[1]">
                            <Text className="text-[9px] font-bold text-indigo-600 uppercase mb-2">Pcs Required</Text>
                            <TextInput
                                className="bg-white border border-indigo-200 p-2.5 rounded-lg text-sm font-bold text-slate-400"
                                keyboardType="numeric"
                                value={manualPcs}
                                editable={false}
                            />
                        </View>
                    </View>
                    <View className="flex-row gap-3 mt-4 pt-4 border-t border-indigo-100">
                        <View className="flex-1">
                            <Text className="text-[9px] font-bold text-indigo-600 uppercase mb-2">Net SQFT</Text>
                            <TextInput
                                className="bg-white border border-indigo-200 p-2.5 rounded-lg text-xs font-bold text-slate-500"
                                value={netQty}
                                editable={false}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-bold text-indigo-600 uppercase mb-2">Waste %</Text>
                            <TextInput
                                className="bg-white border border-indigo-200 p-2.5 rounded-lg text-xs font-bold text-slate-900"
                                value={wastePercent}
                                onChangeText={onWastePercentChange}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-bold text-indigo-600 uppercase mb-2">Budget Qty</Text>
                            <TextInput
                                className="bg-white border border-indigo-200 p-2.5 rounded-lg text-xs font-bold text-slate-900"
                                value={manualQty}
                                onChangeText={setManualQty}
                            />
                        </View>
                    </View>
                </View>
            );
        }

        if (category === 'Grout') {
            return (
                <View className="bg-slate-100 p-4 rounded-2xl border border-slate-200 mb-6" style={{ zIndex: 100, position: 'relative' }}>
                    <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="color-fill" size={14} color="#475569" />
                        <Text className="text-[10px] font-inter font-black text-slate-800 uppercase tracking-widest">Grout Calculator</Text>
                    </View>

                    {/* ROW 1: SPECS - JOINT, WEIGHT, WASTE */}
                    <View className="flex-row gap-3 mb-3" style={{ zIndex: 101, position: 'relative' }}>
                        <View className="flex-[1.2]" style={{ zIndex: 30 }}>
                            <Text className="text-[9px] font-inter font-bold text-slate-500 uppercase mb-2">Joint Width</Text>
                            <TouchableOpacity
                                onPress={() => setShowJointMenu(!showJointMenu)}
                                className="bg-white border border-slate-200 p-2.5 rounded-lg flex-row justify-between items-center"
                            >
                                <Text className="text-sm font-bold text-slate-900">
                                    {JOINT_WIDTHS.find(jw => jw.value.toString() === jointWidth)?.label || 'Select...'}
                                </Text>
                                <Ionicons name="chevron-down" size={12} color="#94a3b8" />
                            </TouchableOpacity>
                            {showJointMenu && (
                                <View className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 shadow-lg" style={{ zIndex: 1000, elevation: 5 }}>
                                    {JOINT_WIDTHS.map(jw => (
                                        <TouchableOpacity
                                            key={jw.label}
                                            className="p-3 border-b border-slate-50"
                                            onPress={() => onJointWidthSelect(jw)}
                                        >
                                            <Text className="text-xs font-bold text-slate-700">{jw.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-slate-500 uppercase mb-2">Bag (Lbs)</Text>
                            <TextInput
                                className="bg-white border border-slate-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                keyboardType="numeric"
                                value={bagWeight}
                                onChangeText={onBagWeightChange}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-slate-500 uppercase mb-2">Waste %</Text>
                            <TextInput
                                className="bg-white border border-slate-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                keyboardType="numeric"
                                value={wastePercent}
                                onChangeText={onWastePercentChange}
                            />
                        </View>
                    </View>

                    {/* ROW 2: TILE DIMENSIONS (L x W x T) */}
                    <View className="mb-3" style={{ zIndex: 20 }}>
                        <Text className="text-[9px] font-inter font-bold text-slate-500 uppercase mb-2">Tile Dimensions (L x W x T)</Text>
                        <View className="flex-row gap-2">
                            <View className="flex-1">
                                <TextInput
                                    className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-inter font-bold text-slate-900 text-center"
                                    placeholder="Len"
                                    value={dimLength}
                                    onChangeText={onDimLengthChange}
                                />
                            </View>
                            <View className="flex-1">
                                <TextInput
                                    className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-inter font-bold text-slate-900 text-center"
                                    placeholder="Wid"
                                    value={dimWidth}
                                    onChangeText={onDimWidthChange}
                                />
                            </View>
                            <View className="flex-1">
                                <TextInput
                                    className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-inter font-bold text-slate-900 text-center"
                                    placeholder="Thk"
                                    value={dimThickness}
                                    onChangeText={onDimThicknessChange}
                                />
                            </View>
                        </View>
                    </View>

                    {/* ROW 3: RESULTS - AREA & BAGS */}
                    <View className="flex-row gap-2" style={{ zIndex: 10 }}>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-slate-500 uppercase mb-2">Net Area (SQFT)</Text>
                            <TextInput
                                className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-bold text-slate-900"
                                keyboardType="numeric"
                                value={netQty}
                                onChangeText={onNetQtyChange}
                            />
                        </View>
                        <View className="flex-[1.5]">
                            <Text className="text-[9px] font-inter font-bold text-emerald-600 uppercase mb-2">Total Bags Required</Text>
                            <View className="bg-emerald-100 border border-emerald-200 p-2.5 rounded-lg flex-row items-center justify-between">
                                <Text className="text-sm font-inter font-black text-emerald-900">{manualQty}</Text>
                                <Text className="text-[8px] font-inter font-black text-emerald-600 uppercase ml-1">Rounded UP</Text>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        if (category === 'Setting Materials') {
            return (
                <View className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 mb-6">
                    <View className="flex-row items-center gap-2 mb-3">
                        <Ionicons name="construct" size={14} color="#d97706" />
                        <Text className="text-[10px] font-inter font-black text-amber-800 uppercase tracking-widest">Coverage Calculator (Thinset/Mud)</Text>
                    </View>

                    <View className="mb-4 relative" style={{ zIndex: 1000 }}>
                        <Text className="text-[9px] font-inter font-bold text-amber-600 uppercase mb-2">Trowel / Coverage Preset</Text>
                        <TouchableOpacity
                            onPress={() => setShowPresetMenu(!showPresetMenu)}
                            className="bg-white border border-amber-200 p-3 rounded-xl flex-row justify-between items-center"
                        >
                            <Text className="text-xs font-inter font-bold text-slate-900">
                                {TROWEL_PRESETS.find(p => p.presetName === trowelPreset)?.label || 'Select Preset...'}
                            </Text>
                            <Ionicons name="chevron-down" size={14} color="#d97706" />
                        </TouchableOpacity>
                        {showPresetMenu && (
                            <View className="absolute top-full left-0 right-0 bg-white border border-amber-200 rounded-xl mt-1 z-50 shadow-xl overflow-hidden" style={{ zIndex: 1100 }}>
                                {TROWEL_PRESETS.map(preset => (
                                    <TouchableOpacity
                                        key={preset.presetName}
                                        className={`p-3 border-b border-amber-50 ${trowelPreset === preset.presetName ? 'bg-amber-50' : ''}`}
                                        onPress={() => onTrowelPresetSelect(preset)}
                                    >
                                        <Text className={`text-xs font-inter ${trowelPreset === preset.presetName ? 'text-amber-700 font-black' : 'text-slate-600 font-bold'}`}>{preset.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <View className="flex-row gap-3 mb-4">
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-amber-600 uppercase mb-2">Area Coverage (SQFT)</Text>
                            <TextInput
                                className="bg-white border border-amber-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                keyboardType="numeric"
                                placeholder="Total SQFT"
                                value={netQty}
                                onChangeText={onNetQtyChange}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-amber-600 uppercase mb-2">Yield Factor (SQFT/Bag)</Text>
                            <TextInput
                                className={`bg-white border border-amber-200 p-2.5 rounded-lg text-sm font-bold ${trowelPreset !== 'custom' ? 'text-slate-400 bg-slate-50' : 'text-slate-900'}`}
                                keyboardType="numeric"
                                placeholder="e.g. 50"
                                value={yieldPerUnit}
                                editable={trowelPreset === 'custom'}
                                onChangeText={onYieldPerUnitChange}
                            />
                        </View>
                    </View>
                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-amber-600 uppercase mb-2">Waste %</Text>
                            <TextInput
                                className="bg-white border border-amber-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                keyboardType="numeric"
                                value={wastePercent}
                                onChangeText={onWastePercentChange}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-amber-600 uppercase mb-2">Total Bags Required</Text>
                            <View className="bg-amber-100 border border-amber-200 p-2.5 rounded-lg flex-row items-center justify-between">
                                <Text className="text-sm font-black text-amber-900">{manualQty}</Text>
                                <Text className="text-[10px] font-black text-amber-600 uppercase ml-2">Bags</Text>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <View className="flex-row gap-4 mb-6">
                <View className="flex-1">
                    <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Quantity ({category === 'Setting Materials' ? 'Total Bags Required' : unit})</Text>
                    <TextInput
                        className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900"
                        keyboardType="numeric"
                        value={manualQty}
                        onChangeText={setManualQty}
                    />
                </View>
                <View className="flex-1">
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pcs / {unit}</Text>
                    <TextInput
                        className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900"
                        keyboardType="numeric"
                        placeholder="e.g. 144"
                        placeholderTextColor={pColor}
                        value={manualPcs}
                        onChangeText={setManualPcs}
                    />
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View className="flex-1 bg-black/60 justify-center items-center p-4">
                <View className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
                    <View className="p-6 border-b border-slate-100 flex-row justify-between items-center">
                        <Text className="text-xl font-inter font-black text-slate-900">{initialData ? 'Edit Budget Item' : 'Add Budget Item'}</Text>
                        <TouchableOpacity onPress={onClose} className="p-1">
                            <Ionicons name="close" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-6">
                        <View className="flex-row gap-4 mb-6" style={{ zIndex: 100 }}>
                            <View className="flex-[2]">
                                <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Product Code</Text>
                                <TextInput
                                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900"
                                    placeholder="e.g. TL-50"
                                    placeholderTextColor="#94a3b8"
                                    value={code}
                                    onChangeText={setCode}
                                />
                            </View>
                            <View className="flex-[3]" style={{ zIndex: 110 }}>
                                <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Category</Text>
                                <TouchableOpacity
                                    onPress={() => setShowCategoryMenu(!showCategoryMenu)}
                                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex-row justify-between items-center"
                                >
                                    <Text className="text-sm font-inter font-bold text-slate-900">{category}</Text>
                                    <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                                {showCategoryMenu && (
                                    <View className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 z-50 shadow-xl overflow-hidden" style={{ zIndex: 1000, elevation: 10 }}>
                                        {CATEGORIES.map(cat => (
                                            <TouchableOpacity
                                                key={cat}
                                                className={`p-3 border-b border-slate-50 ${category === cat ? 'bg-blue-50' : ''}`}
                                                onPress={() => onCategoryChange(cat)}
                                            >
                                                <Text className={`text-sm font-inter ${category === cat ? 'text-blue-600 font-black' : 'text-slate-600 font-bold'}`}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>

                        <View className="mb-6">
                            <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Description / Material Name</Text>
                            <TextInput
                                className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900"
                                placeholder="Material Description"
                                placeholderTextColor="#94a3b8"
                                value={productName}
                                onChangeText={setProductName}
                            />
                        </View>

                        {renderCalculator()}

                        {!isGeneralStock && (
                            <View className="flex-row gap-4 mb-6" style={{ zIndex: 90 }}>
                                <View className="flex-1">
                                    <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Area / Room</Text>
                                    <TouchableOpacity
                                        onPress={() => !lockedAreaId && setShowAreaMenu(!showAreaMenu)}
                                        disabled={!!lockedAreaId}
                                        className={`bg-slate-50 border border-slate-200 p-3 rounded-xl flex-row justify-between items-center ${lockedAreaId ? 'opacity-60' : ''}`}
                                    >
                                        <Text className="text-sm font-inter font-bold text-slate-900">
                                            {isCreatingNewArea
                                                ? `New Area: ${newAreaName}`
                                                : (lockedAreaId && lockedAreaId.startsWith('loc-')
                                                    ? `Location: ${lockedAreaId.replace('loc-', '')}`
                                                    : (areas.find(a => a.id === areaId)?.name || 'Select Area...'))
                                            }
                                        </Text>
                                        <Ionicons name={lockedAreaId ? "lock-closed" : "location"} size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                    {showAreaMenu && !lockedAreaId && (
                                        <View className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 z-50 shadow-xl overflow-hidden" style={{ zIndex: 1000, elevation: 10 }}>
                                            <ScrollView style={{ maxHeight: 200 }}>
                                                <TouchableOpacity
                                                    className="p-3 border-b border-slate-50 bg-blue-50/50"
                                                    onPress={() => { setIsCreatingNewArea(true); setShowAreaMenu(false); }}
                                                >
                                                    <View className="flex-row items-center gap-2">
                                                        <Ionicons name="add-circle" size={16} color="#2563eb" />
                                                        <Text className="text-sm font-inter text-blue-600 font-black">+ Create New Area</Text>
                                                    </View>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    className="p-3 border-b border-slate-50"
                                                    onPress={() => { setAreaId(''); setIsCreatingNewArea(false); setShowAreaMenu(false); }}
                                                >
                                                    <Text className="text-sm font-inter text-slate-400 font-bold">Project Wide (Global)</Text>
                                                </TouchableOpacity>
                                                {areas.map(area => (
                                                    <TouchableOpacity
                                                        key={area.id}
                                                        className={`p-3 border-b border-slate-50 ${areaId === area.id ? 'bg-blue-50' : ''}`}
                                                        onPress={() => {
                                                            setAreaId(area.id);
                                                            setIsCreatingNewArea(false);
                                                            setShowAreaMenu(false);
                                                        }}
                                                    >
                                                        <Text className={`text-sm font-inter ${areaId === area.id ? 'text-blue-600 font-black' : 'text-slate-600 font-bold'}`}>{area.name}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {isCreatingNewArea && !lockedAreaId && (
                                        <View className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                            <View className="flex-row justify-between items-center mb-2">
                                                <Text className="text-[9px] font-black text-blue-600 uppercase">New Area Details</Text>
                                                <TouchableOpacity onPress={() => setIsCreatingNewArea(false)}>
                                                    <Ionicons name="close-circle" size={14} color="#3b82f6" />
                                                </TouchableOpacity>
                                            </View>
                                            <TextInput
                                                className="bg-white border border-blue-200 px-3 py-2 rounded-lg text-sm font-bold text-slate-900 mb-2"
                                                placeholder="Area Name (e.g. Unit 101 Bath)"
                                                value={newAreaName}
                                                onChangeText={setNewAreaName}
                                            />
                                            <TextInput
                                                className="bg-white border border-blue-200 px-3 py-2 rounded-lg text-sm font-medium text-slate-900"
                                                placeholder="Description (e.g. Floor 1, Unit 101)"
                                                value={newAreaDescription}
                                                onChangeText={setNewAreaDescription}
                                            />
                                        </View>
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Sub-Location</Text>
                                    <TextInput
                                        className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900"
                                        placeholder="e.g. Master Bath"
                                        placeholderTextColor="#94a3b8"
                                        value={subLocation}
                                        onChangeText={setSubLocation}
                                    />
                                </View>
                            </View>
                        )}

                        <View className="mb-8">
                            <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Zone / Application Notes</Text>
                            <TextInput
                                className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900"
                                placeholder="e.g. Accent Wall"
                                placeholderTextColor="#94a3b8"
                                value={zone}
                                onChangeText={setZone}
                            />
                        </View>

                        <View className="mb-8">
                            <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Supplier / Vendor</Text>
                            <TextInput
                                className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-900"
                                placeholder="e.g. Tile Bar, Home Depot, etc."
                                placeholderTextColor="#94a3b8"
                                value={supplier}
                                onChangeText={setSupplier}
                            />
                        </View>

                        <View className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-8" style={{ zIndex: 50 }}>
                            <View className="flex-row items-center justify-between mb-4" style={{ zIndex: 100 }}>
                                <View className="flex-row items-center gap-2">
                                    <Ionicons name="cash-outline" size={16} color="#059669" />
                                    <Text className="text-[10px] font-inter font-black text-emerald-700 uppercase tracking-widest">Financials</Text>
                                </View>
                                <View className="relative" style={{ zIndex: 110 }}>
                                    <TouchableOpacity
                                        onPress={() => setShowCostBasisMenu(!showCostBasisMenu)}
                                        className="bg-white/80 px-3 py-1.5 rounded-full border border-emerald-200 flex-row items-center gap-2"
                                    >
                                        <Text className="text-[10px] font-inter font-black text-emerald-600 uppercase tracking-widest">basis: {costBasis}</Text>
                                        <Ionicons name="caret-down" size={10} color="#059669" />
                                    </TouchableOpacity>
                                    {showCostBasisMenu && (
                                        <View className="absolute top-full right-0 bg-white border border-emerald-100 rounded-lg mt-1 w-32 shadow-xl z-50" style={{ zIndex: 1000, elevation: 10 }}>
                                            {COST_BASIS_OPTIONS.map(opt => (
                                                <TouchableOpacity
                                                    key={opt.value}
                                                    className="p-2 border-b border-emerald-50"
                                                    onPress={() => {
                                                        setCostBasis(opt.value);
                                                        setShowCostBasisMenu(false);
                                                    }}
                                                >
                                                    <Text className="text-[10px] font-bold text-emerald-600">{opt.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View className="flex-row justify-between items-end">
                                <View>
                                    <Text className="text-[10px] font-inter font-black text-emerald-600 uppercase mb-1">
                                        Cost Per {(category === 'Setting Materials' || category === 'Grout') ? 'BAG' : costBasis.toUpperCase()}
                                    </Text>
                                    <TextInput
                                        className="bg-white border border-emerald-200 px-3 py-2 rounded-lg text-lg font-inter font-black text-emerald-900 w-32"
                                        keyboardType="numeric"
                                        value={unitCost}
                                        onChangeText={setUnitCost}
                                    />
                                </View>
                                <View className="items-end">
                                    <Text className="text-[10px] font-inter font-black text-emerald-600 uppercase mb-1">Total Estimated Cost</Text>
                                    <Text className="text-2xl font-inter font-black text-emerald-900">${totalEstimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleSave}
                            className="bg-blue-600 p-4 rounded-xl items-center shadow-lg shadow-blue-200 mb-2"
                        >
                            <Text className="text-white font-inter font-black uppercase tracking-widest">{initialData ? 'Update Item' : 'Add Item'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onClose}
                            className="p-4 rounded-xl items-center"
                        >
                            <Text className="text-slate-400 font-bold">Cancel</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
