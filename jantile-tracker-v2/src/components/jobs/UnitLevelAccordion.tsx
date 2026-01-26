import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, Clock } from 'lucide-react-native';
import { Unit } from '../../services/MockJobStore';
import { AreaData } from './AreaDetailsDrawer';
import AreaCard from './AreaCard';

type UnitLevelAccordionProps = {
    unit: Unit;
    floorId: string;
    onAreaPress: (area: AreaData) => void;
    canEdit: boolean;
    onEditUnit: (unit: Unit) => void;
    onDeleteUnit: (unit: Unit) => void;
    onAddArea: (unitId: string) => void;
    onEditArea: (floorId: string, unitId: string, area: AreaData) => void;
    onDeleteArea: (floorId: string, unitId: string, area: AreaData) => void;
};

const UnitLevelAccordion = ({
    unit,
    floorId,
    onAreaPress,
    canEdit,
    onEditUnit,
    onDeleteUnit,
    onAddArea,
    onEditArea,
    onDeleteArea
}: UnitLevelAccordionProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate Unit Progress
    const totalProgress = unit.areas.reduce((acc, area) => acc + area.progress, 0);
    const unitProgress = unit.areas.length > 0 ? Math.round(totalProgress / unit.areas.length) : 0;

    // Calculate Unit Hours
    const unitReg = unit.areas.reduce((acc, area) => acc + (area.timeLogs || []).reduce((s, l) => s + (l.regularHours || 0), 0), 0);
    const unitOT = unit.areas.reduce((acc, area) => acc + (area.timeLogs || []).reduce((s, l) => s + (l.otHours || 0), 0), 0);
    const hasHours = unitReg > 0 || unitOT > 0;

    return (
        <View className="mb-3">
            <TouchableOpacity
                onPress={() => setIsExpanded(!isExpanded)}
                className="bg-white border-b border-slate-200 py-3 px-2 flex-row items-center justify-between"
            >
                <View className="flex-row items-center flex-1">
                    {isExpanded ? <ChevronDown size={18} color="#64748b" className="mr-2" /> : <ChevronRight size={18} color="#64748b" className="mr-2" />}
                    <Text className="text-slate-800 font-bold text-sm mr-2">{unit.name}</Text>

                    {/* Hours Badge */}
                    {hasHours && (
                        <View className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded flex-row items-center">
                            <Clock size={10} color="#3b82f6" className="mr-1" />
                            <Text className="text-[10px] font-bold text-blue-700">
                                {unitReg}h {unitOT > 0 && `(+${unitOT} OT)`}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Right Side: Progress + Actions */}
                <View className="flex-row items-center gap-3">
                    {/* Unit Progress Bar (Mini) */}
                    <View className="flex-row items-center">
                        <View className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden mr-2">
                            <View
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${unitProgress}%` }}
                            />
                        </View>
                        <Text className="text-slate-500 text-xs font-semibold w-8 text-right">{unitProgress}%</Text>
                    </View>

                    {/* Unit Actions */}
                    {canEdit && (
                        <View className="flex-row items-center gap-1 border-l border-slate-200 pl-2">
                            <TouchableOpacity
                                onPress={(e) => { e.stopPropagation(); onEditUnit(unit); }}
                                className="p-1"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Pencil size={14} color="#94a3b8" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={(e) => { e.stopPropagation(); onDeleteUnit(unit); }}
                                className="p-1"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Trash2 size={14} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            {/* Collapsible Content */}
            {isExpanded && (
                <View className="pl-2 pr-1 py-2 bg-slate-50/50">
                    {unit.areas.map(area => (
                        <AreaCard
                            key={area.id}
                            area={area}
                            onPress={onAreaPress}
                            canEdit={canEdit}
                            onEdit={() => onEditArea(floorId, unit.id, area)}
                            onDelete={() => onDeleteArea(floorId, unit.id, area)}
                        />
                    ))}

                    {/* Add Area Button */}
                    {canEdit && (
                        <TouchableOpacity
                            onPress={() => onAddArea(unit.id)}
                            className="flex-row items-center justify-center py-3 mt-1 mb-2 border border-dashed border-slate-300 rounded-lg active:bg-slate-100"
                        >
                            <Plus size={16} color="#64748b" className="mr-2" />
                            <Text className="text-slate-500 font-medium text-xs">Add Area to {unit.name}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

export default UnitLevelAccordion;
