import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ShieldCheck, Plus } from 'lucide-react-native';

interface Props {
    job: any;
}

export default function SafetyToolboxView({ job }: Props) {
    return (
        <View className="flex-1 p-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-orange-100 rounded-xl items-center justify-center">
                        <ShieldCheck size={20} color="#ea580c" />
                    </View>
                    <View>
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Documents</Text>
                        <Text className="text-slate-900 font-black text-lg tracking-tight">Safety Toolbox</Text>
                    </View>
                </View>
                <TouchableOpacity
                    disabled
                    className="flex-row items-center gap-2 h-10 px-4 rounded-xl bg-orange-50 border border-orange-200 opacity-50"
                >
                    <Plus size={16} color="#ea580c" />
                    <Text className="text-orange-700 font-black uppercase text-xs tracking-widest">New</Text>
                </TouchableOpacity>
            </View>

            {/* Empty State */}
            <View className="flex-1 items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 py-20 px-8">
                <View className="w-20 h-20 bg-orange-50 rounded-full items-center justify-center mb-5">
                    <ShieldCheck size={36} color="#ea580c" />
                </View>
                <Text className="text-slate-800 font-black text-xl tracking-tight mb-2">Safety Toolbox</Text>
                <Text className="text-slate-400 text-sm text-center leading-relaxed max-w-xs">
                    Record toolbox talk sessions, topics, and crew attendance for {job?.name ?? 'this job'}.
                </Text>
                <View className="mt-6 px-4 py-2 bg-orange-50 rounded-full border border-orange-100">
                    <Text className="text-orange-500 text-xs font-bold uppercase tracking-widest">Coming Soon</Text>
                </View>
            </View>
        </View>
    );
}
