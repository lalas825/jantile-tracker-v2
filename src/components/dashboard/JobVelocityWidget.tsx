import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { chartConfig } from './chartConfig';

const screenWidth = Dimensions.get('window').width;

const data = {
  labels: ["Job A", "Job B", "Job C"],
  datasets: [
    {
      data: [20, 45, 28]
    }
  ]
};

export default function JobVelocityWidget() {
  return (
    <View className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
      <Text className="text-slate-500 font-medium mb-4">Job Velocity (Hrs vs Budget)</Text>
      <BarChart
        data={data}
        width={screenWidth - 60}
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={{
          ...chartConfig,
          fillShadowGradient: '#3b82f6', // blue-500
          fillShadowGradientOpacity: 1,
          color: () => '#3b82f6',
          labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`, // slate-900
        }}
        verticalLabelRotation={0}
        showValuesOnTopOfBars
      />
    </View>
  );
}
