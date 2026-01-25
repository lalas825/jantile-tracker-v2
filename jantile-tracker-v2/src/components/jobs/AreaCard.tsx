import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { Pencil, Trash2 } from 'lucide-react-native';
import { AreaData } from './AreaDetailsDrawer';

// Note: AreaDetailsDrawer exports AreaData, but does not usually export component props.
// We define props here.

type AreaCardProps = {
    area: AreaData;
    onPress: (area: AreaData) => void;
    canEdit: boolean;
    onEdit: () => void;
    onDelete: () => void;
};

const AreaCard = ({ area, onPress, canEdit, onEdit, onDelete }: AreaCardProps) => {
    // Traffic Light Logic
    let containerStyle = "border-slate-200 bg-white";
    let scoreColor = "text-slate-400";
    let barColor = "bg-slate-400";

    if (area.progress === 100) {
        containerStyle = "border-emerald-500 bg-emerald-50";
        scoreColor = "text-emerald-600";
        barColor = "bg-emerald-500";
    } else if (area.progress > 0) {
        containerStyle = "border-amber-400 bg-amber-50";
        scoreColor = "text-amber-600";
        barColor = "bg-amber-500";
    }

    // Task Summary Logic
    const completedCount = area.checklist.filter(i => i.status === 'COMPLETED').length;
    const totalCount = area.checklist.filter(i => i.status !== 'NA').length;
    const taskSummary = totalCount > 0
        ? `${completedCount}/${totalCount} Tasks Complete`
        : 'No Tasks Assigned';

    return (
        <TouchableOpacity
            onPress={() => onPress(area)}
            className={clsx(
                "p-4 mb-3 rounded-xl border shadow-sm active:opacity-80 transition-all",
                containerStyle
            )}
        >
            <View className="flex-row justify-between items-start">
                {/* Left Side: Info */}
                <View className="flex-1 mr-4">
                    <View className="flex-row items-center justify-between mr-2">
                        <Text className="text-lg font-bold text-slate-900 leading-tight flex-1">{area.name}</Text>
                    </View>

                    <Text className="text-sm text-slate-500 font-medium mt-0.5">{area.description}</Text>

                    {/* Task Summary Text */}
                    <Text className={clsx(
                        "text-sm font-semibold mt-2",
                        area.progress === 100 ? "text-emerald-700" :
                            area.progress > 0 ? "text-amber-700" : "text-slate-600"
                    )}>
                        {taskSummary}
                    </Text>
                </View>

                {/* Right Side: Scoreboard + Actions */}
                <View className="flex-row items-center gap-4">
                    <View className="items-end">
                        <Text className={clsx("text-2xl font-extrabold tracking-tighter", scoreColor)}>
                            {area.progress}%
                        </Text>
                        <View className="w-32 h-3 bg-white/60 rounded-full overflow-hidden mt-1 border border-black/5">
                            <View
                                className={clsx("h-full rounded-full", barColor)}
                                style={{ width: `${area.progress}%` }}
                            />
                        </View>
                    </View>

                    {/* Actions */}
                    {canEdit && (
                        <View className="flex-row items-center gap-2 pl-2 border-l border-slate-200">
                            <TouchableOpacity
                                onPress={(e) => { e.stopPropagation(); onEdit(); }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                className="p-1"
                            >
                                <Pencil size={18} color="#64748b" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={(e) => { e.stopPropagation(); onDelete(); }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                className="p-1"
                            >
                                <Trash2 size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default AreaCard;
