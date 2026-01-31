import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../config/supabase';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setLoading(true);

        let error = null;

        if (isSignUp) {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });
            if (signUpError) error = signUpError;
            else Alert.alert('Success', 'Account created! Please sign in.');
        } else {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            error = signInError;
        }

        setLoading(false);

        if (error) {
            Alert.alert(isSignUp ? 'Sign Up Failed' : 'Login Failed', error.message);
        }
    };

    return (
        <View className="flex-1 bg-white justify-center px-8">
            <View className="items-center mb-10">
                <View className="h-24 w-full items-center justify-center">
                    <Image
                        source={require('../../assets/images/jantile-logo.png')}
                        style={{ width: 280, height: 80 }}
                        resizeMode="contain"
                    />
                </View>
                <Text className="text-slate-400 mt-4 font-bold uppercase tracking-[4px] text-[10px]">
                    {isSignUp ? 'Create a new account' : 'Sign in to your account'}
                </Text>
            </View>

            <View className="gap-4">
                <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1 ml-1 uppercase">Email</Text>
                    <TextInput
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-base text-slate-900"
                        placeholder="name@jantile.com"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>

                <View>
                    <Text className="text-xs font-bold text-slate-500 mb-1 ml-1 uppercase">Password</Text>
                    <TextInput
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-base text-slate-900"
                        placeholder="••••••••"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>

                <TouchableOpacity
                    onPress={handleAuth}
                    disabled={loading}
                    className="bg-red-600 rounded-xl p-4 items-center mt-4 shadow-sm active:bg-red-700"
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setIsSignUp(!isSignUp)}
                    className="p-4 items-center"
                >
                    <Text className="text-slate-500 font-medium">
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
