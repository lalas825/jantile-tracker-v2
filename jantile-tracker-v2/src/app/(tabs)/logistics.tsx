import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';

export default function LogisticsScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-slate-900 px-5 pt-12">
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-white text-3xl font-bold">Logistics</Text>
                <TouchableOpacity
                    onPress={() => router.push('/logistics/new-request')}
                    className="bg-blue-600 p-2 rounded-full"
                >
                    <Plus size={24} color="white" />
                </TouchableOpacity>
            </View>
            <View className="flex-1 items-center justify-center">
                <Text className="text-slate-500 text-lg">No tickets found</Text>
            </View>
        </View>
    );
}
