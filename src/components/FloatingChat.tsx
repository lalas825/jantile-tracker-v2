import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = 'image/*,.pdf,.csv';

interface SelectedFile {
  base64: string;
  mimeType: string;
  name: string;
  dataUri: string; // for image preview
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  filePreview?: { name: string; dataUri?: string; mimeType: string };
}

export function FloatingChat() {
  if (Platform.OS !== 'web') return null;

  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isOpen]);

  const handleFileSelected = useCallback((e: Event) => {
    const inp = e.target as HTMLInputElement;
    const file = inp.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`);
      inp.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      // Extract base64 from data:mimeType;base64,XXXX
      const base64 = dataUri.split(',')[1];
      const mimeType = file.type || 'application/octet-stream';
      setSelectedFile({ base64, mimeType, name: file.name, dataUri });
    };
    reader.readAsDataURL(file);
    inp.value = ''; // reset so same file can be re-selected
  }, []);

  // Create hidden file input on mount (web only)
  useEffect(() => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = ACCEPTED_TYPES;
    inp.style.display = 'none';
    inp.addEventListener('change', handleFileSelected);
    document.body.appendChild(inp);
    fileInputRef.current = inp;
    return () => {
      inp.removeEventListener('change', handleFileSelected);
      inp.remove();
      fileInputRef.current = null;
    };
  }, [handleFileSelected]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && !selectedFile) || loading) return;

    const filePreview = selectedFile
      ? { name: selectedFile.name, dataUri: selectedFile.mimeType.startsWith('image/') ? selectedFile.dataUri : undefined, mimeType: selectedFile.mimeType }
      : undefined;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text || (selectedFile ? selectedFile.name : ''),
      filePreview,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const fileToSend = selectedFile;
    setSelectedFile(null);
    setLoading(true);

    try {
      const body: any = { message: text, session_id: sessionIdRef.current };
      if (fileToSend) {
        body.image = { base64: fileToSend.base64, mimeType: fileToSend.mimeType };
      }

      const { data, error } = await supabase.functions.invoke('web-chat', { body });
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
  }, [input, loading, selectedFile]);

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

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType === 'text/csv') return '📊';
    return '📎';
  };

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
              Ask me about jobs, issues, progress, materials, or send a photo!
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
            {/* File preview in user bubble */}
            {msg.filePreview && (
              <View style={{ marginBottom: msg.content ? 6 : 0 }}>
                {msg.filePreview.dataUri ? (
                  <Image
                    source={{ uri: msg.filePreview.dataUri }}
                    style={{ width: 200, height: 150, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}>
                    <Text style={{ fontSize: 16 }}>{getFileIcon(msg.filePreview.mimeType)}</Text>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                      {msg.filePreview.name}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {msg.content ? (
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
            ) : null}
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

      {/* File preview bar */}
      {selectedFile && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: '#eff6ff',
            borderTopWidth: 1,
            borderTopColor: '#bfdbfe',
            gap: 8,
          }}
        >
          {selectedFile.mimeType.startsWith('image/') ? (
            <Image
              source={{ uri: selectedFile.dataUri }}
              style={{ width: 32, height: 32, borderRadius: 4 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 20 }}>{getFileIcon(selectedFile.mimeType)}</Text>
          )}
          <Text style={{ flex: 1, fontSize: 12, color: '#1e40af', fontWeight: '600' }} numberOfLines={1}>
            {selectedFile.name}
          </Text>
          <TouchableOpacity onPress={() => setSelectedFile(null)}>
            <Text style={{ color: '#64748b', fontSize: 16, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

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
        {/* Attach button */}
        <TouchableOpacity
          onPress={() => fileInputRef.current?.click()}
          disabled={loading}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: loading ? '#e2e8f0' : '#f1f5f9',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 18, color: loading ? '#94a3b8' : '#475569' }}>📎</Text>
        </TouchableOpacity>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={selectedFile ? 'Add a caption...' : 'Type a message...'}
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
          disabled={loading || (!input.trim() && !selectedFile)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: loading || (!input.trim() && !selectedFile) ? '#cbd5e1' : '#3b82f6',
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
