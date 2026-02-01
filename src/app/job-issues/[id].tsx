import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, CheckCircle2, AlertTriangle, Clock, User, Camera } from 'lucide-react-native';
import clsx from 'clsx';
import { SupabaseService, JobIssue, IssueComment } from '../../services/SupabaseService';
import { useAuth } from '../../context/AuthContext';

export default function IssueDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { profile } = useAuth();
    const [issue, setIssue] = useState<JobIssue | null>(null);
    const [comments, setComments] = useState<IssueComment[]>([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const loadData = async () => {
        if (!id) return;
        try {
            // Fetch issue details (Mocking global issues usually fetch all, so filter here or add getIssue)
            // For now, getJobIssues filters by nothing to get all
            const allIssues = await SupabaseService.getJobIssues();
            const found = allIssues.find(i => i.id === id);
            if (found) setIssue(found);

            const fetchedComments = await SupabaseService.getIssueComments(id);
            setComments(fetchedComments);
        } catch (error) {
            console.error("Failed to load issue detail:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleSendMessage = async () => {
        if (!message.trim() || !issue || !profile || sending) return;
        setSending(true);
        try {
            await SupabaseService.addIssueComment(issue.id, message, profile.id, profile.full_name);
            setMessage('');
            const updatedComments = await SupabaseService.getIssueComments(issue.id);
            setComments(updatedComments);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setSending(false);
        }
    };

    const toggleStatus = async () => {
        if (!issue) return;
        const newStatus = issue.status === 'open' ? 'resolved' : 'open';
        try {
            await SupabaseService.updateIssueStatus(issue.id, newStatus);
            setIssue({ ...issue, status: newStatus });
            // Add a system comment
            await SupabaseService.addIssueComment(issue.id, `Status changed to ${newStatus.toUpperCase()}`, 'system', 'System');
            loadData();
        } catch (error) {
            console.error("Failed to update status:", error);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    if (!issue) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <Text className="text-slate-500">Issue not found</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-blue-600 font-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* HEADER */}
            <View className="px-6 py-4 bg-white border-b border-slate-200 flex-row items-center gap-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-100 rounded-full">
                    <ChevronLeft size={20} color="#334155" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{issue.job_name}</Text>
                    <Text className="text-xl font-bold text-slate-900" numberOfLines={1}>{issue.type}</Text>
                </View>
                <TouchableOpacity
                    onPress={toggleStatus}
                    className={clsx(
                        "px-4 py-2 rounded-xl border flex-row items-center gap-2",
                        issue.status === 'resolved' ? "bg-emerald-500 border-emerald-600" : "bg-white border-slate-200"
                    )}
                >
                    {issue.status === 'resolved' ? (
                        <>
                            <CheckCircle2 size={16} color="white" />
                            <Text className="text-white font-bold text-xs uppercase">Resolved</Text>
                        </>
                    ) : (
                        <>
                            <AlertTriangle size={16} color="#ef4444" />
                            <Text className="text-red-600 font-bold text-xs uppercase text-slate-900">Open</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    ref={scrollViewRef}
                    className="flex-1"
                    contentContainerStyle={{ padding: 20 }}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
                >
                    {/* ORIGINAL REPORT */}
                    <View className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center">
                                    <User size={20} color="#64748b" />
                                </View>
                                <View>
                                    <Text className="font-bold text-slate-900">{issue.created_by}</Text>
                                    <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reported {new Date(issue.created_at).toLocaleDateString()}</Text>
                                </View>
                            </View>
                            <View className={clsx(
                                "px-2 py-1 rounded-lg border",
                                issue.priority === 'High' ? "bg-red-50 border-red-100" :
                                    issue.priority === 'Medium' ? "bg-orange-50 border-orange-100" : "bg-blue-50 border-blue-100"
                            )}>
                                <Text className={clsx(
                                    "text-[10px] font-black uppercase tracking-tighter",
                                    issue.priority === 'High' ? "text-red-700" :
                                        issue.priority === 'Medium' ? "text-orange-700" : "text-blue-700"
                                )}>{issue.priority} Priority</Text>
                            </View>
                        </View>

                        <Text className="text-slate-700 text-base leading-6 mb-6">
                            {issue.description}
                        </Text>

                        {issue.photo_url && (
                            <View className="rounded-2xl overflow-hidden border border-slate-100 mb-2">
                                <Image source={{ uri: issue.photo_url }} className="w-full h-64 bg-slate-50" resizeMode="cover" />
                                <View className="absolute bottom-4 right-4 bg-black/50 px-3 py-1.5 rounded-full flex-row items-center gap-2">
                                    <Camera size={14} color="white" />
                                    <Text className="text-white text-xs font-bold uppercase">Evidence Attached</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* TIMELINE / CHAT */}
                    <View className="mb-6">
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 ml-2">Activity Timeline</Text>

                        {comments.map((comment, index) => {
                            const isSystem = comment.user_id === 'system';
                            const isMe = comment.user_id === profile?.id;

                            if (isSystem) {
                                return (
                                    <View key={comment.id} className="items-center my-6">
                                        <View className="bg-slate-200 px-4 py-1.5 rounded-full border border-slate-300">
                                            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{comment.message}</Text>
                                        </View>
                                    </View>
                                );
                            }

                            return (
                                <View key={comment.id} className={clsx("mb-6 flex-row", isMe ? "justify-end" : "justify-start")}>
                                    {!isMe && (
                                        <View className="w-8 h-8 rounded-full bg-slate-200 items-center justify-center mr-3 self-end mb-1">
                                            <Text className="text-[10px] font-bold text-slate-500">{comment.user_name.substring(0, 2).toUpperCase()}</Text>
                                        </View>
                                    )}
                                    <View className={clsx(
                                        "max-w-[80%] px-4 py-3 rounded-2xl",
                                        isMe ? "bg-slate-900 rounded-tr-none" : "bg-white border border-slate-100 shadow-sm rounded-tl-none"
                                    )}>
                                        {!isMe && <Text className="text-[10px] font-bold text-blue-600 mb-1 uppercase">{comment.user_name}</Text>}
                                        <Text className={clsx("text-sm leading-5", isMe ? "text-white" : "text-slate-700")}>{comment.message}</Text>
                                        <Text className={clsx("text-[9px] mt-2 font-bold uppercase", isMe ? "text-slate-500 text-right" : "text-slate-400")}>
                                            {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* MESSENGER INPUT */}
                <View className="p-4 bg-white border-t border-slate-100 flex-row items-center gap-3">
                    <TextInput
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 h-12"
                        placeholder="Discuss resolution..."
                        placeholderTextColor="#94a3b8"
                        value={message}
                        onChangeText={setMessage}
                        multiline={false}
                    />
                    <TouchableOpacity
                        onPress={handleSendMessage}
                        disabled={!message.trim() || sending}
                        className={clsx(
                            "w-12 h-12 rounded-2xl items-center justify-center",
                            message.trim() ? "bg-blue-600" : "bg-slate-100"
                        )}
                    >
                        {sending ? <ActivityIndicator size="small" color="white" /> : <Send size={20} color={message.trim() ? "white" : "#cbd5e1"} />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
