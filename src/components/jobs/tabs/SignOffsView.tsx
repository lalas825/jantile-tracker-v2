import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { PenLine, Plus } from 'lucide-react-native';

interface Props {
    job: any;
}

export default function SignOffsView({ job }: Props) {
    return (
        <View className="flex-1 p-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-emerald-100 rounded-xl items-center justify-center">
                        <PenLine size={20} color="#059669" />
                    </View>
                    <View>
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Documents</Text>
                        <Text className="text-slate-900 font-black text-lg tracking-tight">Sign Offs</Text>
                    </View>
                </View>
                <TouchableOpacity
                    disabled
                    className="flex-row items-center gap-2 h-10 px-4 rounded-xl bg-emerald-50 border border-emerald-200 opacity-50"
                >
                    <Plus size={16} color="#059669" />
                    <Text className="text-emerald-700 font-black uppercase text-xs tracking-widest">New</Text>
                </TouchableOpacity>
            </View>

            {/* Empty State */}
            <View className="flex-1 items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 py-20 px-8">
                <View className="w-20 h-20 bg-emerald-50 rounded-full items-center justify-center mb-5">
                    <PenLine size={36} color="#059669" />
                </View>
                <Text className="text-slate-800 font-black text-xl tracking-tight mb-2">Sign Offs</Text>
                <Text className="text-slate-400 text-sm text-center leading-relaxed max-w-xs">
                    Capture crew and supervisor signatures on completed work for {job?.name ?? 'this job'}.
                </Text>
                <View className="mt-6 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                    <Text className="text-emerald-600 text-xs font-bold uppercase tracking-widest">Coming Soon</Text>
                </View>
            </View>
        </View>
    );
}
