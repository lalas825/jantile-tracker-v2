import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Alert, Platform, Linking, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { DocumentService } from '../../features/documents/DocumentService';
import type { DocumentType } from '../../features/documents/types';

interface SendToGCModalProps {
  visible: boolean;
  onClose: () => void;
  documentType: DocumentType;
  documentId: string;
  documentNumber: number;
  jobId: string;
  jobName: string;
  onSent: () => void;
}

const ROLES = ['GC', 'PM', 'Inspector', 'Client'] as const;

export default function SendToGCModal({
  visible, onClose, documentType, documentId, documentNumber, jobId, jobName, onSent,
}: SendToGCModalProps) {
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerRole, setSignerRole] = useState<string>('GC');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load last used GC email for this job
  useEffect(() => {
    if (!visible) return;
    setCopied(false);
    setLoading(false);

    (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(`gc_email_${jobId}`);
        const savedName = await AsyncStorage.getItem(`gc_name_${jobId}`);
        if (savedEmail) setSignerEmail(savedEmail);
        if (savedName) setSignerName(savedName);
      } catch { /* ignore */ }
    })();
  }, [visible, jobId]);

  const saveGCInfo = useCallback(async () => {
    try {
      if (signerEmail) await AsyncStorage.setItem(`gc_email_${jobId}`, signerEmail);
      if (signerName) await AsyncStorage.setItem(`gc_name_${jobId}`, signerName);
    } catch { /* ignore */ }
  }, [signerEmail, signerName, jobId]);

  const handleSendEmail = useCallback(async () => {
    if (!signerName.trim() || !signerEmail.trim()) {
      Alert.alert('Missing Info', 'Please enter signer name and email.');
      return;
    }
    setLoading(true);
    try {
      await saveGCInfo();
      const { signUrl } = await DocumentService.createSignatureRequest({
        documentType,
        documentId,
        jobId,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim(),
        signerRole: signerRole.toLowerCase(),
      });

      const mailtoLink = DocumentService.generateMailtoLink({
        recipientEmail: signerEmail.trim(),
        documentType,
        documentNumber,
        jobName,
        signUrl,
      });

      if (Platform.OS === 'web') {
        window.open(mailtoLink, '_blank');
      } else {
        await Linking.openURL(mailtoLink);
      }

      onSent();
      onClose();
    } catch (err) {
      console.error('[SendToGCModal] send error:', err);
      Alert.alert('Error', 'Failed to create signature request. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [signerName, signerEmail, signerRole, documentType, documentId, documentNumber, jobId, jobName, saveGCInfo, onSent, onClose]);

  const handleCopyLink = useCallback(async () => {
    if (!signerName.trim()) {
      Alert.alert('Missing Info', 'Please enter signer name.');
      return;
    }
    setLoading(true);
    try {
      await saveGCInfo();
      const { signUrl } = await DocumentService.createSignatureRequest({
        documentType,
        documentId,
        jobId,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim() || undefined,
        signerRole: signerRole.toLowerCase(),
      });

      await Clipboard.setStringAsync(signUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('[SendToGCModal] copy error:', err);
      Alert.alert('Error', 'Failed to create signature request.');
    } finally {
      setLoading(false);
    }
  }, [signerName, signerEmail, signerRole, documentType, documentId, jobId, saveGCInfo]);

  const emailPreview = `Hello,\n\nYou have a T&M Ticket (#${documentNumber}) from ${jobName} that requires your signature.\n\nPlease review and sign using the link provided.\n\nThank you,\nJantile Group`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Send for Signature</Text>
            <Text style={styles.subtitle}>T&M Ticket #{documentNumber} — {jobName}</Text>

            {/* Signer Name */}
            <Text style={styles.label}>Signer Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Smith"
              placeholderTextColor="#9ca3af"
              value={signerName}
              onChangeText={setSignerName}
              editable={!loading}
            />

            {/* Signer Email */}
            <Text style={styles.label}>Signer Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. gc@company.com"
              placeholderTextColor="#9ca3af"
              value={signerEmail}
              onChangeText={setSignerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />

            {/* Role */}
            <Text style={styles.label}>Signer Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleChip, signerRole === role && styles.roleChipActive]}
                  onPress={() => setSignerRole(role)}
                  disabled={loading}
                >
                  <Text style={[styles.roleChipText, signerRole === role && styles.roleChipTextActive]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Email Preview */}
            <Text style={styles.label}>Email Preview</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>{emailPreview}</Text>
            </View>

            {/* Actions */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>Creating signature request...</Text>
              </View>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.emailButton} onPress={handleSendEmail}>
                  <Text style={styles.emailButtonText}>Open Email Client</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
                  <Text style={styles.copyButtonText}>
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  roleChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  roleChipTextActive: {
    color: '#fff',
  },
  previewBox: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  previewText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  actions: {
    gap: 10,
    marginTop: 20,
  },
  emailButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  emailButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  copyButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  copyButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
});
