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
    <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 items-center">
      <Text className="text-slate-400 font-medium mb-2 w-full">Global Health</Text>
      <ProgressChart
        data={data}
        width={screenWidth - 60}
        height={160}
        strokeWidth={16}
        radius={50}
        chartConfig={chartConfig}
        hideLegend={false}
      />
      <Text className="text-emerald-400 font-bold text-3xl absolute top-[85px]">22%</Text>
    </View>
  );
}
