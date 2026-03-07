import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Clock } from 'lucide-react-native';

export default function PendingApprovalScreen() {
    const { signOut, profile } = useAuth();

    return (
        <View className="flex-1 bg-white justify-center items-center px-8">
            <View className="items-center mb-10">
                <Image
                    source={require('../../assets/images/jantile-logo.png')}
                    style={{ width: 280, height: 80 }}
                    resizeMode="contain"
                />
            </View>

            <View className="h-20 w-20 rounded-full bg-amber-50 items-center justify-center mb-6">
                <Clock size={40} color="#f59e0b" />
            </View>

            <Text className="text-slate-900 text-2xl font-bold text-center mb-3">
                Waiting for Approval
            </Text>

            <Text className="text-slate-500 text-base text-center mb-2">
                Your account has been created successfully.
            </Text>
            <Text className="text-slate-500 text-base text-center mb-8">
                An administrator needs to approve your access before you can use the app.
            </Text>

            {profile?.full_name && (
                <View className="bg-slate-50 rounded-xl px-6 py-4 mb-8 w-full max-w-sm">
                    <Text className="text-slate-400 text-xs font-bold uppercase mb-1">
                        Signed in as
                    </Text>
                    <Text className="text-slate-700 text-sm">
                        {profile.full_name}
                    </Text>
                </View>
            )}

            <TouchableOpacity
                onPress={signOut}
                className="border border-slate-200 rounded-xl py-3 px-8"
            >
                <Text className="text-slate-600 font-semibold">
                    Sign Out
                </Text>
            </TouchableOpacity>
        </View>
    );
}
