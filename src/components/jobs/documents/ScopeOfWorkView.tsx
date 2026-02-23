import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FileText, Plus } from 'lucide-react-native';

interface Props {
    job: any;
}

export default function ScopeOfWorkView({ job }: Props) {
    return (
        <View className="flex-1 p-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-blue-100 rounded-xl items-center justify-center">
                        <FileText size={20} color="#2563eb" />
                    </View>
                    <View>
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Documents</Text>
                        <Text className="text-slate-900 font-black text-lg tracking-tight">Scope of Work</Text>
                    </View>
                </View>
                <TouchableOpacity
                    disabled
                    className="flex-row items-center gap-2 h-10 px-4 rounded-xl bg-blue-50 border border-blue-200 opacity-50"
                >
                    <Plus size={16} color="#2563eb" />
                    <Text className="text-blue-700 font-black uppercase text-xs tracking-widest">New</Text>
                </TouchableOpacity>
            </View>

            {/* Empty State */}
            <View className="flex-1 items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 py-20 px-8">
                <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-5">
                    <FileText size={36} color="#2563eb" />
                </View>
                <Text className="text-slate-800 font-black text-xl tracking-tight mb-2">Scope of Work</Text>
                <Text className="text-slate-400 text-sm text-center leading-relaxed max-w-xs">
                    Define deliverables, exclusions, and project parameters for {job?.name ?? 'this job'}.
                </Text>
                <View className="mt-6 px-4 py-2 bg-blue-50 rounded-full border border-blue-100">
                    <Text className="text-blue-500 text-xs font-bold uppercase tracking-widest">Coming Soon</Text>
                </View>
            </View>
        </View>
    );
}
