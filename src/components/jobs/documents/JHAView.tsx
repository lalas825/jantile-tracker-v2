import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AlertOctagon, Plus } from 'lucide-react-native';

interface Props {
    job: any;
}

export default function JHAView({ job }: Props) {
    return (
        <View className="flex-1 p-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-red-100 rounded-xl items-center justify-center">
                        <AlertOctagon size={20} color="#dc2626" />
                    </View>
                    <View>
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Documents</Text>
                        <Text className="text-slate-900 font-black text-lg tracking-tight">JHA</Text>
                    </View>
                </View>
                <TouchableOpacity
                    disabled
                    className="flex-row items-center gap-2 h-10 px-4 rounded-xl bg-red-50 border border-red-200 opacity-50"
                >
                    <Plus size={16} color="#dc2626" />
                    <Text className="text-red-700 font-black uppercase text-xs tracking-widest">New</Text>
                </TouchableOpacity>
            </View>

            {/* Empty State */}
            <View className="flex-1 items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 py-20 px-8">
                <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-5">
                    <AlertOctagon size={36} color="#dc2626" />
                </View>
                <Text className="text-slate-800 font-black text-xl tracking-tight mb-2">Job Hazard Analysis</Text>
                <Text className="text-slate-400 text-sm text-center leading-relaxed max-w-xs">
                    Identify and control task-level risks before work begins on {job?.name ?? 'this job'}.
                </Text>
                <View className="mt-6 px-4 py-2 bg-red-50 rounded-full border border-red-100">
                    <Text className="text-red-500 text-xs font-bold uppercase tracking-widest">Coming Soon</Text>
                </View>
            </View>
        </View>
    );
}
