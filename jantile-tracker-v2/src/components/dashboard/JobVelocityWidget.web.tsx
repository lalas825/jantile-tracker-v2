import React from 'react';
import { View, Text } from 'react-native';

export default function JobVelocityWidget() {
  return (
    <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6">
      <Text className="text-slate-400 font-medium mb-4">Job Velocity (Hrs vs Budget)</Text>
      <View className="p-4 bg-slate-800 rounded-xl">
        <Text className="text-slate-400 italic">Charts are optimized for Mobile View.</Text>
      </View>
    </View>
  );
}
