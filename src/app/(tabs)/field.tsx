import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FieldScreen() {
    return (
        <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center" edges={['top']}>
            <Text className="text-slate-900 text-lg">Field Coming Soon</Text>
        </SafeAreaView>
    );
}
