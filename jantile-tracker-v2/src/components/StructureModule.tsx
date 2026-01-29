import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react-native';
import clsx from 'clsx';
import { Floor, Unit } from '../services/MockJobStore';

interface StructureModuleProps {
    floors: Floor[];
    onEditFloor: (floor: Floor) => void;
    onDeleteFloor: (floorId: string) => void;
    onAddUnit: (floorId: string) => void;
    onEditUnit: (floorId: string, unitId: string) => void;
    onDeleteUnit: (floorId: string, unitId: string) => void;
    onAddArea: (floorId: string, unitId: string) => void;
    onEditArea: (floorId: string, unitId: string, area: any) => void;
    onDeleteArea: (floorId: string, unitId: string, areaId: string) => void;
    onAreaPress: (area: any) => void;
}

const calculateFloorProgress = (floor: Floor) => {
    if (!floor.units || floor.units.length === 0) return 0;
    let totalAreas = 0;
    let totalProgress = 0;
    floor.units.forEach(unit => {
        if (unit.areas) {
            unit.areas.forEach(area => {
                totalAreas++;
                totalProgress += (area.progress || 0);
            });
        }
    });
    return totalAreas === 0 ? 0 : Math.round(totalProgress / totalAreas);
};

export default function StructureModule({
    floors,
    onEditFloor,
    onDeleteFloor,
    onAddUnit,
    onEditUnit,
    onDeleteUnit,
    onAddArea,
    onEditArea,
    onDeleteArea,
    onAreaPress
}: StructureModuleProps) {
    return (
        <View className="flex-1 gap-6">
            {floors?.map((floor) => (
                <FloorSection
                    key={floor.id}
                    floor={floor}
                    onEditFloor={onEditFloor}
                    onDeleteFloor={onDeleteFloor}
                    onAddUnit={onAddUnit}
                    onEditUnit={onEditUnit}
                    onDeleteUnit={onDeleteUnit}
                    onAddArea={onAddArea}
                    onEditArea={onEditArea}
                    onDeleteArea={onDeleteArea}
                    onAreaPress={onAreaPress}
                />
            ))}
        </View>
    );
}

function FloorSection({ floor, ...props }: { floor: Floor } & any) {
    const [expanded, setExpanded] = useState(true);
    const progress = calculateFloorProgress(floor);

    return (
        <View className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            {/* Floor Header - Professional White */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpanded(!expanded)}
                className="flex-row items-center justify-between p-5 bg-white border-b border-gray-100"
            >
                <View className="flex-row items-center gap-4 flex-1">
                    <View className="bg-slate-100 p-2 rounded-xl">
                        {expanded ? <ChevronDown size={20} color="#475569" /> : <ChevronRight size={20} color="#475569" />}
                    </View>
                    <View>
                        <Text className="text-gray-900 font-bold text-xl">{floor.name}</Text>
                        <View className="flex-row items-center gap-1.5">
                            {floor.description && (
                                <Text className="text-slate-500 text-xs font-bold" numberOfLines={1}>{floor.description} •</Text>
                            )}
                            <Text className="text-slate-500 font-medium text-xs">{floor.units?.length || 0} Units • {progress}% Complete</Text>
                        </View>
                    </View>
                </View>

                <View className="flex-row items-center gap-2">
                    <TouchableOpacity onPress={() => props.onEditFloor(floor)} className="p-2 bg-white/50 rounded-full">
                        <Pencil size={18} color="#4A5568" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => props.onDeleteFloor(floor.id)} className="p-2 bg-white/50 rounded-full">
                        <Trash2 size={18} color="#E53E3E" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {expanded && (
                <View className="p-6 gap-6">
                    {floor.units?.map((unit: Unit) => (
                        <UnitCard
                            key={unit.id}
                            unit={unit}
                            floorId={floor.id}
                            {...props}
                        />
                    ))}

                    <TouchableOpacity
                        onPress={() => props.onAddUnit(floor.id)}
                        className="flex-row items-center justify-center py-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50"
                    >
                        <Plus size={20} color="#64748b" />
                        <Text className="text-slate-500 font-bold ml-2 text-base">Add New Unit to {floor.name}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

function UnitCard({ unit, floorId, ...props }: { unit: Unit, floorId: string } & any) {
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web' && width > 768;

    const calculateUnitProgress = (u: Unit) => {
        if (!u.areas || u.areas.length === 0) return 0;
        const total = u.areas.reduce((acc, a) => acc + (a.progress || 0), 0);
        return Math.round(total / u.areas.length);
    };
    const unitProgress = calculateUnitProgress(unit);

    return (
        <View className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-none">
            <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center gap-3">
                    <View className="bg-slate-200 p-2 rounded-lg">
                        <Text className="text-slate-700 font-bold text-lg">U</Text>
                    </View>
                    <View>
                        <Text className="text-slate-900 font-bold text-xl">{unit.name}</Text>
                        <View className="flex-row items-center gap-1.5">
                            {unit.description && (
                                <Text className="text-slate-500 text-xs font-bold" numberOfLines={1}>{unit.description} •</Text>
                            )}
                            <Text className="text-slate-500 text-xs font-semibold">
                                {unit.areas?.length || 0} Areas • {unitProgress}% Complete
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="flex-row items-center gap-2">
                    <TouchableOpacity onPress={() => props.onEditUnit(floorId, unit.id)} className="p-2 bg-white/50 rounded-full">
                        <Pencil size={18} color="#718096" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => props.onDeleteUnit(floorId, unit.id)} className="p-2 bg-white/50 rounded-full">
                        <Trash2 size={18} color="#F56565" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Areas Grid */}
            <View className="flex-row flex-wrap gap-4">
                {unit.areas?.map((area: any) => (
                    <TouchableOpacity
                        key={area.id}
                        onPress={() => props.onAreaPress(area)}
                        style={{ width: isWeb ? '31.5%' : '100%' }}
                        className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm active:border-blue-400 active:opacity-90"
                    >
                        <View className="flex-row justify-between items-start mb-3">
                            <View className="flex-1 mr-2">
                                <Text className="text-slate-900 font-bold text-base leading-tight" numberOfLines={1}>{area.name}</Text>
                                <Text className="text-green-600 text-xs mt-1" numberOfLines={1}>{area.description || 'No notes'}</Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation(); props.onEditArea(floorId, unit.id, area); }}
                                    className="p-1.5 bg-white/60 rounded-full"
                                >
                                    <Pencil size={12} color="#4A5568" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation(); props.onDeleteArea(floorId, unit.id, area.id); }}
                                    className="p-1.5 bg-white/60 rounded-full"
                                >
                                    <Trash2 size={12} color="#E53E3E" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Area Progress */}
                        <View className="bg-white/50 rounded-lg p-2 mt-auto">
                            <View className="flex-row justify-between items-center mb-1.5">
                                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Progress</Text>
                                <Text className="text-xs font-black text-slate-700">{area.progress || 0}%</Text>
                            </View>
                            <View className="h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-100">
                                <View
                                    className={clsx("h-full rounded-full", (area.progress || 0) >= 100 ? "bg-green-500" : "bg-blue-500")}
                                    style={{ width: `${area.progress || 0}%` }}
                                />
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                {/* Add Area Card */}
                <TouchableOpacity
                    onPress={() => props.onAddArea(floorId, unit.id)}
                    style={{ width: isWeb ? '31.5%' : '100%' }}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-5 items-center justify-center bg-slate-100/50"
                >
                    <Plus size={24} color="#64748b" />
                    <Text className="text-slate-500 font-bold mt-1 text-sm">Add Area</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
