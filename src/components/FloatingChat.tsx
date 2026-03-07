import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function FloatingChat() {
  if (Platform.OS !== 'web') return null;

  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('web-chat', {
        body: { message: text, session_id: sessionIdRef.current },
      });

      if (error) throw error;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data?.response || 'No response received.',
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to send message'}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  if (!session) return null;

  // Floating button
  if (!isOpen) {
    return (
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        style={{
          position: 'fixed' as any,
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#3b82f6',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          zIndex: 9999,
        }}
      >
        <Text style={{ fontSize: 24, color: '#fff' }}>💬</Text>
      </TouchableOpacity>
    );
  }

  // Chat panel
  return (
    <View
      style={{
        position: 'fixed' as any,
        bottom: 24,
        right: 24,
        width: 380,
        height: 520,
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 16,
        zIndex: 9999,
        overflow: 'hidden',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#3b82f6',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18 }}>🤖</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            Jantile Agent
          </Text>
        </View>
        <TouchableOpacity onPress={() => setIsOpen(false)}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, padding: 12 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
      >
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🏗️</Text>
            <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>
              Ask me about jobs, issues, progress, materials, or anything else!
            </Text>
          </View>
        )}
        {messages.map(msg => (
          <View
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              backgroundColor: msg.role === 'user' ? '#3b82f6' : '#f1f5f9',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
              borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
            }}
          >
            <Text
              style={{
                color: msg.role === 'user' ? '#fff' : '#1e293b',
                fontSize: 14,
                lineHeight: 20,
              }}
              selectable
            >
              {msg.content}
            </Text>
          </View>
        ))}
        {loading && (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#f1f5f9',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <ActivityIndicator size="small" color="#3b82f6" />
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          gap: 8,
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#94a3b8"
          onSubmitEditing={sendMessage}
          editable={!loading}
          style={{
            flex: 1,
            backgroundColor: '#f8fafc',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            fontSize: 14,
            color: '#1e293b',
            borderWidth: 1,
            borderColor: '#e2e8f0',
            // @ts-ignore - web-only
            outlineStyle: 'none',
          }}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: loading || !input.trim() ? '#cbd5e1' : '#3b82f6',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16 }}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
