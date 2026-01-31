import React from 'react';
import { View, Text } from 'react-native';

export default function GlobalHealthWidget() {
  return (
    <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 items-center">
      <Text className="text-slate-400 font-medium mb-2 w-full">Global Health</Text>
      <View className="p-4 bg-slate-800 rounded-xl">
        <Text className="text-slate-400 italic">Charts are optimized for Mobile View.</Text>
      </View>
      <Text className="text-emerald-400 font-bold text-3xl mt-4">22%</Text>
    </View>
  );
}
