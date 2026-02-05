import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProjectMaterial } from '../../services/SupabaseService';

interface AddBudgetItemModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (material: Partial<ProjectMaterial>) => void;
    initialData?: ProjectMaterial | null;
    areas?: any[]; // List of areas for the job
    units?: any[]; // List of units for the job (needed for new area creation)
    lockedAreaId?: string; // If provided, lock selection to this area
}

const CATEGORIES = [
    'Generic', 'Tile', 'Stone', 'Base', 'Setting Materials', 'Grout', 'Tools', 'Consumable'
];

const COST_BASIS_OPTIONS = [
    { label: 'per SQFT', value: 'sqft' },
    { label: 'per Piece', value: 'pcs' },
    { label: 'per LF', value: 'lf' },
    { label: 'per Unit', value: 'unit' }
];

export default function AddBudgetItemModal({ visible, onClose, onSave, initialData, areas = [], units = [], lockedAreaId }: AddBudgetItemModalProps) {
    // Basic Info
    const [code, setCode] = useState('');
    const [category, setCategory] = useState('Generic');
    const [productName, setProductName] = useState('');
    const [specs, setSpecs] = useState('');
    const [zone, setZone] = useState('');
    const [areaId, setAreaId] = useState('');
    const [subLocation, setSubLocation] = useState('');
    const [supplier, setSupplier] = useState('');

    // Calculator State
    const [dimLength, setDimLength] = useState('');
    const [dimWidth, setDimWidth] = useState('');
    const [dimThickness, setDimThickness] = useState('');
    const [linearFeet, setLinearFeet] = useState(''); // New State
    const [netQty, setNetQty] = useState('0'); // Net Qty before waste
    const [wastePercent, setWastePercent] = useState('10'); // Default 10%
    const [manualQty, setManualQty] = useState('0'); // Total Budget Qty
    const [manualPcs, setManualPcs] = useState('0'); // Total Pieces

    // Base Specific
    const [basePcLength, setBasePcLength] = useState('24'); // Inches

    // Linked Info
    const [groutInfo, setGroutInfo] = useState('');
    const [caulkInfo, setCaulkInfo] = useState('');

    // Financials
    const [unitCost, setUnitCost] = useState('0');
    const [costBasis, setCostBasis] = useState('sqft');
    const [unit, setUnit] = useState('sqft');

    // UI Helpers
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const [showCostBasisMenu, setShowCostBasisMenu] = useState(false);
    const [showAreaMenu, setShowAreaMenu] = useState(false);
    const [isCreatingNewArea, setIsCreatingNewArea] = useState(false);
    const [newAreaName, setNewAreaName] = useState('');
    const [newAreaDescription, setNewAreaDescription] = useState('');
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [unitSearch, setUnitSearch] = useState('');

    useEffect(() => {
        if (initialData) {
            setCode(initialData.product_code || '');
            setCategory(initialData.category || 'Generic');
            setProductName(initialData.product_name || '');
            setSpecs(initialData.product_specs || '');
            setZone(initialData.zone || '');
            setAreaId(initialData.area_id || '');
            setSubLocation(initialData.sub_location || '');
            setSupplier(initialData.supplier || '');
            setNetQty(initialData.net_qty?.toString() || initialData.budget_qty.toString());
            setWastePercent(initialData.waste_percent?.toString() || '10');
            setManualQty(initialData.budget_qty.toString());
            setUnitCost(initialData.unit_cost.toString());
            setUnit(initialData.unit || 'sqft');
            setManualPcs(((initialData.budget_qty || 0) * (initialData.pcs_per_unit || 1)).toString());
            setGroutInfo(initialData.grout_info || '');
            setCaulkInfo(initialData.caulk_info || '');
            setDimLength(initialData.dim_length?.toString() || '');
            setDimWidth(initialData.dim_width?.toString() || '');
            setDimThickness(initialData.dim_thickness || '');
            setLinearFeet(initialData.linear_feet?.toString() || '');
            setCostBasis(initialData.unit || 'sqft');
        } else {
            resetForm(lockedAreaId);
        }
    }, [initialData, visible, lockedAreaId]);

    const resetForm = (initialAreaId?: string) => {
        setCode('');
        setCategory('Generic');
        setProductName('');
        setSpecs('');
        setZone('');
        setAreaId(initialAreaId || '');
        setSubLocation('');
        setSupplier('');
        setNetQty('0');
        setWastePercent('10');
        setManualQty('0');
        setManualPcs('0');
        setUnitCost('0');
        setUnit('sqft');
        setGroutInfo('');
        setCaulkInfo('');
        setDimLength('');
        setDimWidth('');
        setDimThickness('');
        setLinearFeet('');
        setCostBasis('sqft');
        setNewAreaName('');
        setNewAreaDescription('');
        setSelectedUnitId('');
        setUnitSearch('');
    };

    // Auto-Calculator Logic
    const handleTileCalc = (l: string, w: string, count: string) => {
        const len = parseFloat(l) || 0;
        const wid = parseFloat(w) || 0;
        const c = parseFloat(count) || 0;
        if (len && wid) {
            const sqft = (len * wid / 144) * c;
            setManualQty(sqft.toFixed(2));
        }
    };

    const handleBaseCalc = (pcLen: string, pcHeight: string, totalLF: string) => {
        const len = parseFloat(pcLen) || 0; // Inches
        const height = parseFloat(pcHeight) || 0; // Inches (Reusing dimWidth)
        const lf = parseFloat(totalLF) || 0;

        if (len && lf) {
            // Count = Total LF / (Length / 12)
            const count = lf / (len / 12);
            setManualPcs(Math.ceil(count).toString());

            // SQFT = Total LF * (Height / 12)
            if (height) {
                const sqft = lf * (height / 12);
                setNetQty(sqft.toFixed(2));
                const w = parseFloat(wastePercent) || 0;
                setManualQty((sqft * (1 + w / 100)).toFixed(2));

                // Auto Description
                if (code) {
                    const desc = `${height}"x${len}" Base`;
                    if (!productName.includes(desc)) {
                        setProductName(prev => prev ? `${prev} - ${desc}` : desc);
                    }
                }
            } else {
                // Fallback if no height: just update Manual Qty based on LF if basis is LF?
                // But manualQty is usually the budget quantity in units.
                // If Base, we usually order by LF or Pieces?
                // Let's assume Manual Qty holds the "Budget Qty" which depends on 'unit'
                // But requirements say "SQFT Conversion: Automatically calculate the total Square Footage".
                // So we must prioritize NetQty = SQFT.
            }
        }
    };

    const totalEstimatedCost = useMemo(() => {
        return (parseFloat(manualQty) || 0) * (parseFloat(unitCost) || 0);
    }, [manualQty, unitCost]);

    const pcsPerUnitValue = useMemo(() => {
        const qty = parseFloat(manualQty) || 1;
        const pcs = parseFloat(manualPcs) || 1;
        return pcs / (qty || 1);
    }, [manualQty, manualPcs]);

    const handleSave = () => {
        if (!productName) {
            alert("Product Name is required");
            return;
        }

        if (isCreatingNewArea) {
            if (!newAreaName.trim()) {
                alert("Please enter a name for the new area");
                return;
            }
        }

        // Auto-assign Unit ID logic
        let linkedUnitId: string | undefined = undefined;
        let newUnitName: string | undefined = undefined;

        if (isCreatingNewArea) {
            if (units && units.length > 0) {
                // Default to the first unit if available
                linkedUnitId = units[0].id;
            } else {
                // Determine a safe fallback or creating "General"
                newUnitName = "General";
            }
        }

        onSave({
            ...initialData,
            product_code: code,
            category,
            product_name: productName,
            product_specs: specs,
            zone,
            area_id: isCreatingNewArea ? undefined : (areaId || undefined),
            sub_location: subLocation,
            supplier,
            net_qty: parseFloat(netQty) || 0,
            waste_percent: parseFloat(wastePercent) || 0,
            budget_qty: parseFloat(manualQty) || 0,
            unit_cost: parseFloat(unitCost) || 0,
            total_value: totalEstimatedCost,
            unit,
            pcs_per_unit: pcsPerUnitValue,
            grout_info: groutInfo,
            caulk_info: caulkInfo,
            dim_length: parseFloat(dimLength) || undefined,
            dim_width: parseFloat(dimWidth) || undefined,
            dim_thickness: dimThickness,
            linear_feet: parseFloat(linearFeet) || undefined,
            ...(isCreatingNewArea ? {
                _new_area: {
                    name: newAreaName,
                    description: newAreaDescription,
                    unit_id: linkedUnitId,
                    _new_unit_name: newUnitName
                }
            } : {})
        });
        setIsCreatingNewArea(false);
        setNewAreaName('');
        setSelectedUnitId('');
        setUnitSearch('');
        onClose();
    };

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
                                    onChangeText={(val) => {
                                        setDimLength(val);
                                        handleTileCalc(val, dimWidth, manualPcs);
                                    }}
                                />
                                <Text className="text-blue-300 font-bold">×</Text>
                                <TextInput
                                    className="flex-1 bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                    placeholder='W (e.g "12 1/2")'
                                    placeholderTextColor={pColor}
                                    value={dimWidth}
                                    onChangeText={(val) => {
                                        setDimWidth(val);
                                        handleTileCalc(dimLength, val, manualPcs);
                                    }}
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
                                onChangeText={setDimThickness}
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
                                onChangeText={(val) => {
                                    setNetQty(val);
                                    const n = parseFloat(val) || 0;
                                    const w = parseFloat(wastePercent) || 0;
                                    const total = n * (1 + w / 100);
                                    setManualQty(total.toFixed(2));

                                    const len = parseFloat(dimLength) || 0;
                                    const wid = parseFloat(dimWidth) || 0;
                                    if (len && wid) {
                                        const pcs = total / (len * wid / 144);
                                        setManualPcs(Math.ceil(pcs).toString());
                                    }
                                }}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-[9px] font-inter font-bold text-blue-600 uppercase mb-2">Waste %</Text>
                            <TextInput
                                className="bg-white border border-blue-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                keyboardType="numeric"
                                value={wastePercent}
                                onChangeText={(val) => {
                                    setWastePercent(val);
                                    const n = parseFloat(netQty) || 0;
                                    const w = parseFloat(val) || 0;
                                    const total = n * (1 + w / 100);
                                    setManualQty(total.toFixed(2));

                                    const len = parseFloat(dimLength) || 0;
                                    const wid = parseFloat(dimWidth) || 0;
                                    if (len && wid) {
                                        const pcs = total / (len * wid / 144);
                                        setManualPcs(Math.ceil(pcs).toString());
                                    }
                                }}
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
                                onChangeText={(val) => {
                                    setDimLength(val);
                                    handleBaseCalc(val, dimWidth, linearFeet);
                                }}
                            />
                        </View>
                        <View className="flex-[1]">
                            <Text className="text-[9px] font-bold text-indigo-600 uppercase mb-2">Piece Height (Inches)</Text>
                            <TextInput
                                className="bg-white border border-indigo-200 p-2.5 rounded-lg text-sm font-bold text-slate-900"
                                placeholder='Hgt (e.g "4")'
                                placeholderTextColor="#94a3b8"
                                value={dimWidth}
                                onChangeText={(val) => {
                                    setDimWidth(val);
                                    handleBaseCalc(dimLength, val, linearFeet);
                                }}
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
                                onChangeText={(val) => {
                                    setLinearFeet(val);
                                    handleBaseCalc(dimLength, dimWidth, val);
                                }}
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
                                onChangeText={(val) => {
                                    setWastePercent(val);
                                    // Recalc
                                    const net = parseFloat(netQty) || 0;
                                    const w = parseFloat(val) || 0;
                                    setManualQty((net * (1 + w / 100)).toFixed(2));
                                }}
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

        return (
            <View className="flex-row gap-4 mb-6">
                <View className="flex-1">
                    <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Quantity ({unit})</Text>
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
                                                onPress={() => {
                                                    setCategory(cat);
                                                    setCategory(cat);
                                                    setUnit(cat === 'Base' ? 'lf' : (cat === 'Tile' || cat === 'Stone' ? 'sqft' : 'units'));
                                                    // Default basis to 'lf' for Base, 'sqft' for Tile/Stone
                                                    setCostBasis(cat === 'Base' ? 'lf' : (cat === 'Tile' || cat === 'Stone' ? 'sqft' : 'units'));
                                                    setShowCategoryMenu(false);
                                                }}
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

                        <View className="flex-row gap-4 mb-6" style={{ zIndex: 90 }}>
                            <View className="flex-1">
                                <Text className="text-[10px] font-inter font-black text-slate-400 uppercase tracking-widest mb-2">Area / Room</Text>
                                <TouchableOpacity
                                    onPress={() => !lockedAreaId && setShowAreaMenu(!showAreaMenu)}
                                    disabled={!!lockedAreaId}
                                    className={`bg-slate-50 border border-slate-200 p-3 rounded-xl flex-row justify-between items-center ${lockedAreaId ? 'opacity-60' : ''}`}
                                >
                                    <Text className="text-sm font-inter font-bold text-slate-900">
                                        {isCreatingNewArea ? `New Area: ${newAreaName}` : (areas.find(a => a.id === areaId)?.name || 'Select Area...')}
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
                                    <Text className="text-[10px] font-inter font-black text-emerald-600 uppercase mb-1">Cost Per {costBasis.toUpperCase()}</Text>
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
