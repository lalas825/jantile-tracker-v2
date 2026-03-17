import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DocumentService } from '../../features/documents/DocumentService';
import SignatureCanvas from '../../components/documents/SignatureCanvas';
import type { WorkTicket, DocumentSignature, LaborEntry, MaterialEntry } from '../../features/documents/types';

type PageState = 'loading' | 'error' | 'already_signed' | 'pending' | 'submitting' | 'success';

export default function PublicSigningPage() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const [state, setState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [ticket, setTicket] = useState<WorkTicket | null>(null);
  const [signature, setSignature] = useState<DocumentSignature | null>(null);
  const [jobName, setJobName] = useState('');

  // Form state
  const [signerName, setSignerName] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Fetch document by token
  useEffect(() => {
    if (!token) { setState('error'); setErrorMessage('No token provided.'); return; }

    (async () => {
      try {
        const result = await DocumentService.getDocumentByToken(token);

        if (!result) {
          setState('error');
          setErrorMessage('Document not found. The link may be invalid or expired.');
          return;
        }

        // Check expiry (30 days)
        const createdAt = new Date(result.signature.created_at).getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - createdAt > thirtyDays) {
          setState('error');
          setErrorMessage('This signature link has expired.');
          return;
        }

        setTicket(result.document);
        setSignature(result.signature);
        setSignerName(result.signature.signer_name || '');

        // Fetch job name
        try {
          const { supabase } = require('../../config/supabase');
          const { data: job } = await supabase.from('jobs').select('name').eq('id', result.document.job_id).single();
          if (job) setJobName(job.name);
        } catch { /* ignore */ }

        if (result.signature.status === 'signed') {
          setState('already_signed');
        } else {
          setState('pending');
        }
      } catch (err) {
        console.error('[SignPage] fetch error:', err);
        setState('error');
        setErrorMessage('Something went wrong. Please try again.');
      }
    })();
  }, [token]);

  const handleSubmit = useCallback(async () => {
    if (!token || !signatureDataUrl || !signerName.trim()) return;
    setState('submitting');
    try {
      await DocumentService.submitSignature({
        token,
        signatureDataUrl,
        signerName: signerName.trim(),
      });
      setState('success');
    } catch (err) {
      console.error('[SignPage] submit error:', err);
      setState('pending');
      setErrorMessage('Failed to submit signature. Please try again.');
    }
  }, [token, signatureDataUrl, signerName]);

  const canSubmit = signerName.trim().length > 0 && signatureDataUrl.length > 0 && confirmed;

  // ── LOADING ──
  if (state === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <Image source={require('../../../assets/images/jantile-logo.png')} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
        <Text style={styles.loadingText}>Loading document...</Text>
      </View>
    );
  }

  // ── ERROR ──
  if (state === 'error') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Unable to Load Document</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  // ── ALREADY SIGNED ──
  if (state === 'already_signed' && signature) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Document Already Signed</Text>
        <Text style={styles.successText}>
          Signed by {signature.signer_name} on{' '}
          {signature.signed_at ? new Date(signature.signed_at).toLocaleDateString() : 'N/A'}
        </Text>
        {signature.signature_url && (
          <Image source={{ uri: signature.signature_url }} style={styles.signaturePreview} resizeMode="contain" />
        )}
      </View>
    );
  }

  // ── SUCCESS ──
  if (state === 'success') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Document Signed Successfully</Text>
        <Text style={styles.successText}>
          Thank you, {signerName}. The signed document has been recorded.
        </Text>
      </View>
    );
  }

  // ── SUBMITTING ──
  if (state === 'submitting') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Submitting signature...</Text>
      </View>
    );
  }

  // ── PENDING (main view) ──
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={require('../../../assets/images/jantile-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <Text style={styles.headerTitle}>Document Signature</Text>
      </View>

      {/* Document Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>T&M Ticket</Text>
        </View>
        <Text style={styles.infoTitle}>Ticket #{ticket?.ticket_number ?? '—'}</Text>
        {jobName ? <Text style={styles.infoSub}>{jobName}</Text> : null}
        <Text style={styles.infoDate}>
          Date: {ticket?.service_date ? new Date(ticket.service_date).toLocaleDateString() : 'N/A'}
        </Text>
      </View>

      {/* Document Preview */}
      {ticket && (
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Work Description</Text>
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{ticket.work_description}</Text>
          </View>

          {/* Labor */}
          {ticket.labor.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Labor</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>Name</Text>
                  <Text style={styles.tableCell}>Class</Text>
                  <Text style={styles.tableCell}>Reg</Text>
                  <Text style={styles.tableCell}>OT</Text>
                </View>
                {ticket.labor.map((l: LaborEntry, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableCellText, { flex: 2 }]}>{l.name}</Text>
                    <Text style={styles.tableCellText}>{l.class}</Text>
                    <Text style={styles.tableCellText}>{l.reg_hours}h</Text>
                    <Text style={styles.tableCellText}>{l.ot_hours}h</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Materials */}
          {ticket.materials.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Materials</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, { flex: 3 }]}>Description</Text>
                  <Text style={styles.tableCell}>Qty</Text>
                </View>
                {ticket.materials.map((m: MaterialEntry, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableCellText, { flex: 3 }]}>{m.description}</Text>
                    <Text style={styles.tableCellText}>{m.quantity}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* GC Notes */}
          {ticket.gc_notes ? (
            <>
              <Text style={styles.sectionTitle}>GC Notes</Text>
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>{ticket.gc_notes}</Text>
              </View>
            </>
          ) : null}
        </View>
      )}

      {/* Signature Section */}
      <View style={styles.signatureSection}>
        <Text style={styles.sectionTitle}>Your Signature</Text>

        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={signerName}
          onChangeText={setSignerName}
          placeholder="Enter your full name"
          placeholderTextColor="#9ca3af"
        />

        <SignatureCanvas
          onSignature={(dataUrl) => setSignatureDataUrl(dataUrl)}
          onClear={() => setSignatureDataUrl('')}
          height={180}
        />

        {/* Confirmation */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setConfirmed(!confirmed)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
            {confirmed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I confirm that I have reviewed the document and authorize this signature.
          </Text>
        </TouchableOpacity>

        {errorMessage && state === 'pending' ? (
          <Text style={styles.inlineError}>{errorMessage}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitButtonText}>Sign & Submit</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Powered by Jantile Group</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 40,
  },
  page: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  pageContent: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  headerLogo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  logo: {
    width: 80,
    height: 80,
  },

  // ── Loading / Error / Success ──
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef2f2',
    color: '#ef4444',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: 16,
    overflow: 'hidden',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdf4',
    color: '#22c55e',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: 16,
    overflow: 'hidden',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  signaturePreview: {
    width: 200,
    height: 80,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },

  // ── Info Card ──
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  badge: {
    backgroundColor: '#eff6ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  badgeText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  infoSub: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 2,
  },
  infoDate: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },

  // ── Preview ──
  previewSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  previewBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 14,
  },
  previewText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },

  // ── Table ──
  table: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableCellText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },

  // ── Signature ──
  signatureSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
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
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  inlineError: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 10,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // ── Footer ──
  footer: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 8,
  },
});
