import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Clock, CheckCircle, Send, XCircle, Trash2, Printer } from 'lucide-react-native';
import type { WorkTicket, DocumentSignature } from '../../features/documents/types';

interface TicketCardProps {
  ticket: WorkTicket & { signature?: DocumentSignature };
  onPress: () => void;
  onSendForSignature: () => void;
  onResend: () => void;
  onDelete: () => void;
  onPrint: () => void;
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', bg: '#f3f4f6', text: '#6b7280', icon: null },
  pending_signature: { label: 'Pending Signature', bg: '#fef3c7', text: '#d97706', icon: Clock },
  signed: { label: 'Signed', bg: '#dcfce7', text: '#16a34a', icon: CheckCircle },
  declined: { label: 'Declined', bg: '#fee2e2', text: '#dc2626', icon: XCircle },
};

export default function TicketCard({
  ticket, onPress, onSendForSignature, onResend, onDelete, onPrint,
}: TicketCardProps) {
  const config = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.draft;
  const StatusIcon = config.icon;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.ticketNumber}>T&M #{ticket.ticket_number || '—'}</Text>
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
          {StatusIcon && <StatusIcon size={12} color={config.text} />}
          <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
        </View>
      </View>

      {/* Trade + Date */}
      <View style={styles.metaRow}>
        <Text style={styles.trade}>{ticket.trade}</Text>
        <Text style={styles.date}>
          {ticket.service_date ? new Date(ticket.service_date).toLocaleDateString() : '—'}
        </Text>
      </View>

      {/* Description */}
      <Text style={styles.description} numberOfLines={2}>
        {ticket.work_description}
      </Text>

      {/* Labor/Material counts */}
      <View style={styles.countsRow}>
        <Text style={styles.countText}>{ticket.labor?.length || 0} workers</Text>
        <Text style={styles.countDot}>·</Text>
        <Text style={styles.countText}>{ticket.materials?.length || 0} materials</Text>
      </View>

      {/* Signed info */}
      {ticket.status === 'signed' && ticket.signature && (
        <View style={styles.signedInfo}>
          {ticket.signature.signature_url && (
            <Image
              source={{ uri: ticket.signature.signature_url }}
              style={styles.signatureThumb}
              resizeMode="contain"
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.signedBy}>Signed by: {ticket.signature.signer_name}</Text>
            <Text style={styles.signedDate}>
              {ticket.signature.signed_at
                ? new Date(ticket.signature.signed_at).toLocaleDateString()
                : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        {ticket.status === 'draft' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={onSendForSignature}>
              <Send size={14} color="#2563eb" />
              <Text style={styles.actionBtnText}>Send for Signature</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
              <Trash2 size={14} color="#ef4444" />
            </TouchableOpacity>
          </>
        )}
        {ticket.status === 'pending_signature' && (
          <TouchableOpacity style={styles.actionBtn} onPress={onResend}>
            <Send size={14} color="#d97706" />
            <Text style={[styles.actionBtnText, { color: '#d97706' }]}>Resend</Text>
          </TouchableOpacity>
        )}
        {ticket.status === 'signed' && (
          <TouchableOpacity style={styles.actionBtn} onPress={onPrint}>
            <Printer size={14} color="#16a34a" />
            <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>Download PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  trade: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  date: {
    fontSize: 13,
    color: '#9ca3af',
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  countText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  countDot: {
    color: '#d1d5db',
  },
  signedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  signatureThumb: {
    width: 60,
    height: 30,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  signedBy: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  signedDate: {
    fontSize: 11,
    color: '#6b7280',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    flex: 1,
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
});
