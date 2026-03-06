import { useState, useEffect, useMemo } from 'react';
import { ProjectMaterial } from '../LogisticsService';

// --- CONSTANTS ---

export const CATEGORIES = [
    'Generic', 'Tile', 'Stone', 'Base', 'Setting Materials', 'Grout', 'Tools', 'Consumable', 'Misc'
];

export const COST_BASIS_OPTIONS = [
    { label: 'per SQFT', value: 'sqft' },
    { label: 'per Piece', value: 'pcs' },
    { label: 'per LF', value: 'lf' },
    { label: 'per Unit', value: 'unit' }
];

export const TROWEL_PRESETS = [
    { label: '1/4 x 1/4 Square Notch (95 SQFT/Bag)', value: 95, presetName: 'notch_1_4_x_1_4' },
    { label: '1/4 x 3/8 Square Notch (65 SQFT/Bag)', value: 65, presetName: 'notch_1_4_x_3_8' },
    { label: '1/2 x 1/2 Square Notch (45 SQFT/Bag)', value: 45, presetName: 'notch_1_2_x_1_2' },
    { label: 'Custom Coverage', value: 0, presetName: 'custom' }
];

export const JOINT_WIDTHS = [
    { label: '1/32"', value: 0.03125 },
    { label: '1/16"', value: 0.0625 },
    { label: '1/8"', value: 0.125 },
    { label: '3/16"', value: 0.1875 },
    { label: '1/4"', value: 0.25 }
];

// --- HOOK ---

interface UseMaterialFormParams {
    visible: boolean;
    onClose: () => void;
    onSave: (material: Partial<ProjectMaterial>) => void;
    initialData?: ProjectMaterial | null;
    areas?: any[];
    units?: any[];
    lockedAreaId?: string;
    isGeneralStock?: boolean;
}

export function useMaterialForm({ visible, onClose, onSave, initialData, areas = [], units = [], lockedAreaId }: UseMaterialFormParams) {
    // Basic Info
    const [code, setCode] = useState('');
    const [category, setCategory] = useState('Generic');
    const [productName, setProductName] = useState('');
    const [specs, setSpecs] = useState('');
    const [zone, setZone] = useState('');
    const [areaId, setAreaId] = useState('');
    const [subLocation, setSubLocation] = useState('');
    const [defaultSubLocation, setDefaultSubLocation] = useState('');
    const [supplier, setSupplier] = useState('');

    // Calculator State
    const [dimLength, setDimLength] = useState('');
    const [dimWidth, setDimWidth] = useState('');
    const [dimThickness, setDimThickness] = useState('');
    const [linearFeet, setLinearFeet] = useState('');
    const [netQty, setNetQty] = useState('0');
    const [wastePercent, setWastePercent] = useState('10');
    const [manualQty, setManualQty] = useState('0');
    const [manualPcs, setManualPcs] = useState('0');
    const [yieldPerUnit, setYieldPerUnit] = useState('50');
    const [trowelPreset, setTrowelPreset] = useState('custom');
    const [jointWidth, setJointWidth] = useState('0.125');
    const [parentMaterialId, setParentMaterialId] = useState('');
    const [bagWeight, setBagWeight] = useState('25');

    // Base Specific (declared for compatibility)
    const [basePcLength, setBasePcLength] = useState('24');

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
    const [showPresetMenu, setShowPresetMenu] = useState(false);
    const [showJointMenu, setShowJointMenu] = useState(false);
    const [showParentMaterialMenu, setShowParentMaterialMenu] = useState(false);
    const [showAreaMenu, setShowAreaMenu] = useState(false);
    const [isCreatingNewArea, setIsCreatingNewArea] = useState(false);
    const [newAreaName, setNewAreaName] = useState('');
    const [newAreaDescription, setNewAreaDescription] = useState('');
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [unitSearch, setUnitSearch] = useState('');

    // --- RESET ---

    const resetForm = (initialAreaId?: string) => {
        setCode('');
        setCategory('Generic');
        setProductName('');
        setSpecs('');
        setZone('');

        if (initialAreaId && initialAreaId.startsWith('loc-')) {
            setAreaId('');
            const virtName = initialAreaId.replace('loc-', '');
            setDefaultSubLocation(virtName);
            setSubLocation('');
        } else {
            setAreaId(initialAreaId || '');
            setDefaultSubLocation('');
            setSubLocation('');
        }

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
        setYieldPerUnit('50');
        setTrowelPreset('custom');
        setJointWidth('0.125');
        setParentMaterialId('');
        setBagWeight('25');
    };

    // --- EFFECT: Hydrate from initialData ---

    useEffect(() => {
        if (initialData) {
            setCode(initialData.product_code || '');
            setCategory(initialData.category || 'Generic');
            setProductName(initialData.product_name || '');
            setSpecs(initialData.product_specs || '');
            setZone(initialData.zone || '');
            setAreaId(initialData.area_id || '');
            setSubLocation(initialData.sub_location || '');
            setDefaultSubLocation('');
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
            setTrowelPreset(initialData.trowel_preset || 'custom');
            setYieldPerUnit(initialData.yield_factor?.toString() || '50');
            setJointWidth(initialData.joint_width || '0.125');
            setParentMaterialId(initialData.parent_material_id || '');
            setBagWeight(initialData.bag_weight?.toString() || '25');
        } else {
            resetForm(lockedAreaId);
        }
    }, [initialData, visible, lockedAreaId]);

    // --- PRIVATE CALCULATORS ---

    const handleTileCalc = (l: string, w: string, count: string) => {
        const len = parseFloat(l) || 0;
        const wid = parseFloat(w) || 0;
        const c = parseFloat(count) || 0;
        if (len && wid) {
            const sqft = (len * wid / 144) * c;
            setManualQty(sqft.toFixed(2));
        }
    };

    const handleSettingMaterialCalc = (area: string, yieldVal: string, waste: string) => {
        const a = parseFloat(area) || 0;
        const y = parseFloat(yieldVal) || 1;
        const w = parseFloat(waste) || 0;

        if (a && y) {
            const totalWithWaste = a * (1 + w / 100);
            const bags = Math.ceil(totalWithWaste / y);
            setManualQty(bags.toString());
        }
    };

    const handleGroutCalc = (l: string, w: string, t: string, j: string, area: string, waste: string, bagW: string) => {
        const len = parseFloat(l) || 0;
        const wid = parseFloat(w) || 0;
        const thk = parseFloat(t) || 0;
        const jnt = parseFloat(j) || 0;
        const a = parseFloat(area) || 0;
        const wst = parseFloat(waste) || 0;
        const bw = parseFloat(bagW) || 25;

        if (len && wid && thk && jnt && a) {
            const totalSF = a * (1 + wst / 100);
            const bags = Math.ceil(((len + wid) * jnt * thk * 1.58 * totalSF) / (len * wid * bw));
            setManualQty(bags.toString());
        }
    };

    const handleBaseCalc = (pcLen: string, pcHeight: string, totalLF: string) => {
        const len = parseFloat(pcLen) || 0;
        const height = parseFloat(pcHeight) || 0;
        const lf = parseFloat(totalLF) || 0;

        if (len && lf) {
            const count = lf / (len / 12);
            setManualPcs(Math.ceil(count).toString());

            if (height) {
                const sqft = lf * (height / 12);
                setNetQty(sqft.toFixed(2));
                const w = parseFloat(wastePercent) || 0;
                setManualQty((sqft * (1 + w / 100)).toFixed(2));

                if (code) {
                    const desc = `${height}"x${len}" Base`;
                    if (!productName.includes(desc)) {
                        setProductName(prev => prev ? `${prev} - ${desc}` : desc);
                    }
                }
            }
        }
    };

    // --- COMPUTED VALUES ---

    const totalEstimatedCost = useMemo(() => {
        return (parseFloat(manualQty) || 0) * (parseFloat(unitCost) || 0);
    }, [manualQty, unitCost]);

    const pcsPerUnitValue = useMemo(() => {
        const cat = category.toLowerCase();
        if (!['tile', 'stone', 'base'].includes(cat)) return 0;

        const qty = parseFloat(manualQty) || 1;
        const pcs = parseFloat(manualPcs) || 0;
        return pcs / (qty || 1);
    }, [manualQty, manualPcs, category]);

    // --- SMART CHANGE HANDLERS ---

    const onDimLengthChange = (val: string) => {
        setDimLength(val);
        if (category === 'Tile' || category === 'Stone') {
            handleTileCalc(val, dimWidth, manualPcs);
        } else if (category === 'Base') {
            handleBaseCalc(val, dimWidth, linearFeet);
        } else if (category === 'Grout') {
            handleGroutCalc(val, dimWidth, dimThickness, jointWidth, netQty, wastePercent, bagWeight);
        }
    };

    const onDimWidthChange = (val: string) => {
        setDimWidth(val);
        if (category === 'Tile' || category === 'Stone') {
            handleTileCalc(dimLength, val, manualPcs);
        } else if (category === 'Base') {
            handleBaseCalc(dimLength, val, linearFeet);
        } else if (category === 'Grout') {
            handleGroutCalc(dimLength, val, dimThickness, jointWidth, netQty, wastePercent, bagWeight);
        }
    };

    const onDimThicknessChange = (val: string) => {
        setDimThickness(val);
        if (category === 'Grout') {
            handleGroutCalc(dimLength, dimWidth, val, jointWidth, netQty, wastePercent, bagWeight);
        }
    };

    const onNetQtyChange = (val: string) => {
        setNetQty(val);
        if (category === 'Tile' || category === 'Stone') {
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
        } else if (category === 'Grout') {
            handleGroutCalc(dimLength, dimWidth, dimThickness, jointWidth, val, wastePercent, bagWeight);
        } else if (category === 'Setting Materials') {
            handleSettingMaterialCalc(val, yieldPerUnit, wastePercent);
        }
    };

    const onWastePercentChange = (val: string) => {
        setWastePercent(val);
        if (category === 'Tile' || category === 'Stone') {
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
        } else if (category === 'Base') {
            const net = parseFloat(netQty) || 0;
            const w = parseFloat(val) || 0;
            setManualQty((net * (1 + w / 100)).toFixed(2));
        } else if (category === 'Grout') {
            handleGroutCalc(dimLength, dimWidth, dimThickness, jointWidth, netQty, val, bagWeight);
        } else if (category === 'Setting Materials') {
            handleSettingMaterialCalc(netQty, yieldPerUnit, val);
        }
    };

    const onLinearFeetChange = (val: string) => {
        setLinearFeet(val);
        handleBaseCalc(dimLength, dimWidth, val);
    };

    const onBagWeightChange = (val: string) => {
        setBagWeight(val);
        handleGroutCalc(dimLength, dimWidth, dimThickness, jointWidth, netQty, wastePercent, val);
    };

    const onYieldPerUnitChange = (val: string) => {
        setYieldPerUnit(val);
        handleSettingMaterialCalc(netQty, val, wastePercent);
    };

    const onCategoryChange = (cat: string) => {
        setCategory(cat);
        const isSetting = cat === 'Setting Materials';
        const isGrout = cat === 'Grout';
        setUnit(cat === 'Base' ? 'lf' : (cat === 'Tile' || cat === 'Stone' ? 'sqft' : (isSetting || isGrout ? 'bags' : 'units')));
        setCostBasis(cat === 'Base' ? 'lf' : (cat === 'Tile' || cat === 'Stone' ? 'sqft' : (isSetting || isGrout ? 'unit' : 'units')));
        if (isSetting) setYieldPerUnit('50');
        if (isGrout) {
            setBagWeight('25');
            const currentArea = areas.find(a => a.id === areaId);
            const tileInArea = currentArea?.materials?.find((m: any) => m.category === 'Tile' || m.category === 'Stone');
            if (tileInArea) {
                setDimLength(tileInArea.dim_length?.toString() || '');
                setDimWidth(tileInArea.dim_width?.toString() || '');
                setDimThickness(tileInArea.dim_thickness || '');
                setNetQty(tileInArea.net_qty?.toString() || tileInArea.budget_qty?.toString() || '0');
                handleGroutCalc(
                    tileInArea.dim_length?.toString() || '',
                    tileInArea.dim_width?.toString() || '',
                    tileInArea.dim_thickness || '',
                    jointWidth,
                    tileInArea.net_qty?.toString() || tileInArea.budget_qty?.toString() || '0',
                    wastePercent,
                    '25'
                );
            }
        }
        setShowCategoryMenu(false);
    };

    const onJointWidthSelect = (jw: { label: string; value: number }) => {
        setJointWidth(jw.value.toString());
        handleGroutCalc(dimLength, dimWidth, dimThickness, jw.value.toString(), netQty, wastePercent, bagWeight);

        const baseName = productName.split(' - ')[0];
        setProductName(`${baseName} - ${jw.label} Joint`);

        setShowJointMenu(false);
    };

    const onTrowelPresetSelect = (preset: { label: string; value: number; presetName: string }) => {
        setTrowelPreset(preset.presetName);
        if (preset.value > 0) {
            setYieldPerUnit(preset.value.toString());
            handleSettingMaterialCalc(netQty, preset.value.toString(), wastePercent);
        }
        setShowPresetMenu(false);
    };

    // --- SAVE ---

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

        let linkedUnitId: string | undefined = undefined;
        let newUnitName: string | undefined = undefined;

        if (isCreatingNewArea) {
            if (units && units.length > 0) {
                linkedUnitId = units[0].id;
            } else {
                newUnitName = "General";
            }
        }

        let finalAreaId = areaId;
        let finalNewAreaPayload = isCreatingNewArea ? {
            name: newAreaName,
            description: newAreaDescription,
            unit_id: linkedUnitId,
            _new_unit_name: newUnitName
        } : undefined;

        if (finalAreaId && finalAreaId.startsWith('loc-')) {
            const targetName = finalAreaId.replace('loc-', '').trim();
            const existingRealArea = areas.find(a => !a.is_virtual && a.name.trim().toLowerCase() === targetName.toLowerCase());

            if (existingRealArea) {
                finalAreaId = existingRealArea.id;
            } else {
                finalAreaId = '';
                const defaultUnitId = units && units.length > 0 ? units[0].id : undefined;
                finalNewAreaPayload = {
                    name: targetName,
                    description: 'Auto-created from Logistics',
                    unit_id: defaultUnitId,
                    _new_unit_name: defaultUnitId ? undefined : 'General'
                };
            }
        }
        else if (!isCreatingNewArea && !areaId && defaultSubLocation) {
            const targetName = defaultSubLocation.trim();
            const existingRealArea = areas.find(a => !a.is_virtual && a.name.trim().toLowerCase() === targetName.toLowerCase());

            if (existingRealArea) {
                finalAreaId = existingRealArea.id;
            } else {
                const defaultUnitId = units && units.length > 0 ? units[0].id : undefined;
                finalNewAreaPayload = {
                    name: targetName,
                    description: 'Auto-created from Logistics',
                    unit_id: defaultUnitId,
                    _new_unit_name: defaultUnitId ? undefined : 'General'
                };
            }
        }

        const payload = {
            ...initialData,
            product_code: code,
            category,
            product_name: productName,
            product_specs: specs,
            zone,
            area_id: isCreatingNewArea ? undefined : (finalAreaId || undefined),
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
            dim_thickness: dimThickness || undefined,
            linear_feet: parseFloat(linearFeet) || undefined,
            trowel_preset: category === 'Setting Materials' ? trowelPreset : undefined,
            yield_factor: category === 'Setting Materials' ? (parseFloat(yieldPerUnit) || undefined) : (category === 'Grout' ? (parseFloat(yieldPerUnit) || undefined) : undefined),
            joint_width: category === 'Grout' ? jointWidth : undefined,
            bag_weight: category === 'Grout' ? (parseFloat(bagWeight) || undefined) : undefined,
            parent_material_id: category === 'Grout' ? parentMaterialId : undefined,
            ...(finalNewAreaPayload ? {
                _new_area: finalNewAreaPayload
            } : {})
        };

        onSave(payload);
        setIsCreatingNewArea(false);
        setNewAreaName('');
        setSelectedUnitId('');
        setUnitSearch('');
        onClose();
    };

    // --- RETURN ---

    return {
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
        dimLength,
        dimWidth,
        dimThickness, setDimThickness,
        linearFeet,
        netQty,
        wastePercent,
        manualQty, setManualQty,
        manualPcs, setManualPcs,
        yieldPerUnit,
        trowelPreset,
        jointWidth,
        parentMaterialId, setParentMaterialId,
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
        pcsPerUnitValue,

        // Smart handlers
        onDimLengthChange,
        onDimWidthChange,
        onDimThicknessChange,
        onNetQtyChange,
        onWastePercentChange,
        onLinearFeetChange,
        onBagWeightChange,
        onYieldPerUnitChange,
        onCategoryChange,
        onJointWidthSelect,
        onTrowelPresetSelect,

        // Actions
        handleSave,
    };
}
