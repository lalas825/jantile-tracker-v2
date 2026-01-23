import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { ProgressChart } from 'react-native-chart-kit';
import { chartConfig } from './chartConfig';

const screenWidth = Dimensions.get('window').width;

const data = {
  labels: ["Health"],
  data: [0.22]
};

export default function GlobalHealthWidget() {
  return (
    <View className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 items-center">
      <Text className="text-slate-500 font-medium mb-2 w-full">Global Health</Text>
      <ProgressChart
        data={data}
        width={screenWidth - 60}
        height={160}
        strokeWidth={16}
        radius={50}
        chartConfig={{
          ...chartConfig,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // blue-500
          labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`, // slate-900
        }}
        hideLegend={false}
      />
      <Text className="text-emerald-500 font-bold text-3xl absolute top-[85px]">22%</Text>
    </View>
  );
}
