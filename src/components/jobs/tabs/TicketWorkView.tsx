import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Modal, Alert, Image, StyleSheet } from 'react-native';
import { ClipboardList, Plus, X } from 'lucide-react-native';
import { DocumentService } from '../../../features/documents/DocumentService';
import { useAuth } from '../../../context/AuthContext';
import TicketCard from '../../documents/TicketCard';
import CreateTicketModal from '../../documents/CreateTicketModal';
import SendToGCModal from '../../documents/SendToGCModal';
import { DocumentPDF } from '../../../utils/DocumentPDF';
import type { WorkTicket, DocumentSignature, LaborEntry, MaterialEntry } from '../../../features/documents/types';

interface Props {
  job: any;
}

type KanbanStage = 'draft' | 'pending' | 'signed';

export default function TicketWorkView({ job }: Props) {
  const { session } = useAuth();
  const [tickets, setTickets] = useState<(WorkTicket & { signature?: DocumentSignature })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editTicket, setEditTicket] = useState<WorkTicket | null>(null);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [sendTicket, setSendTicket] = useState<WorkTicket | null>(null);
  const [detailTicket, setDetailTicket] = useState<(WorkTicket & { signature?: DocumentSignature }) | null>(null);

  const [activeStage, setActiveStage] = useState<KanbanStage>('draft');

  const fetchTickets = useCallback(async () => {
    if (!job?.id) return;
    try {
      const data = await DocumentService.getWorkTickets(job.id);
      setTickets(data as any);
    } catch (err) {
      console.error('[TicketWorkView] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [job?.id]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }, [fetchTickets]);

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert('Delete Ticket', 'Are you sure you want to delete this draft ticket?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await DocumentService.deleteWorkTicket(id);
            fetchTickets();
          } catch { Alert.alert('Error', 'Failed to delete ticket.'); }
        },
      },
    ]);
  }, [fetchTickets]);

  const handleSendForSignature = useCallback((ticket: WorkTicket) => {
    setSendTicket(ticket);
    setSendModalVisible(true);
  }, []);

  // Group tickets by stage
  const drafts = tickets.filter(t => t.status === 'draft');
  const pending = tickets.filter(t => t.status === 'pending_signature');
  const signed = tickets.filter(t => t.status === 'signed');
  const declined = tickets.filter(t => t.status === 'declined');

  const stageTickets = activeStage === 'draft' ? drafts
    : activeStage === 'pending' ? pending
    : [...signed, ...declined];

  const stageCounts = {
    draft: drafts.length,
    pending: pending.length,
    signed: signed.length + declined.length,
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <ClipboardList size={20} color="#4f46e5" />
          </View>
          <View>
            <Text style={styles.headerLabel}>DOCUMENTS</Text>
            <Text style={styles.headerTitle}>Ticket Work</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => { setEditTicket(null); setCreateModalVisible(true); }}
        >
          <Plus size={16} color="#4f46e5" />
          <Text style={styles.newBtnText}>NEW</Text>
        </TouchableOpacity>
      </View>

      {/* Kanban Stage Tabs */}
      <View style={styles.kanbanTabs}>
        {([
          { key: 'draft' as KanbanStage, label: 'Drafts', color: '#6b7280' },
          { key: 'pending' as KanbanStage, label: 'Pending', color: '#d97706' },
          { key: 'signed' as KanbanStage, label: 'Signed', color: '#16a34a' },
        ]).map(({ key, label, color }) => (
          <TouchableOpacity
            key={key}
            style={[styles.kanbanTab, activeStage === key && styles.kanbanTabActive]}
            onPress={() => setActiveStage(key)}
          >
            <Text style={[
              styles.kanbanTabText,
              activeStage === key && { color: '#111827' }
            ]}>{label}</Text>
            <View style={[styles.countBadge, { backgroundColor: activeStage === key ? color : '#e5e7eb' }]}>
              <Text style={[styles.countBadgeText, { color: activeStage === key ? '#fff' : '#6b7280' }]}>
                {stageCounts[key]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ticket List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading tickets...</Text>
          </View>
        ) : stageTickets.length === 0 ? (
          <View style={styles.emptyState}>
            <ClipboardList size={36} color="#d1d5db" />
            <Text style={styles.emptyTitle}>
              {activeStage === 'draft' ? 'No Drafts' : activeStage === 'pending' ? 'No Pending' : 'No Signed Tickets'}
            </Text>
            <Text style={styles.emptyText}>
              {activeStage === 'draft' ? 'Tap "+ NEW" to create a T&M ticket.' : 'Tickets will appear here once processed.'}
            </Text>
          </View>
        ) : (
          stageTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onPress={() => setDetailTicket(ticket)}
              onSendForSignature={() => handleSendForSignature(ticket)}
              onResend={() => handleSendForSignature(ticket)}
              onDelete={() => handleDelete(ticket.id)}
              onPrint={() => DocumentPDF.printTicket(ticket, ticket.signature, job?.name)}
            />
          ))
        )}
      </ScrollView>

      {/* Detail Modal */}
      {detailTicket && (
        <Modal visible={!!detailTicket} transparent animationType="fade" onRequestClose={() => setDetailTicket(null)}>
          <View style={styles.detailOverlay}>
            <View style={styles.detailModal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>T&M Ticket #{detailTicket.ticket_number || '—'}</Text>
                  <TouchableOpacity onPress={() => setDetailTicket(null)}><X size={22} color="#6b7280" /></TouchableOpacity>
                </View>

                <View style={styles.detailMeta}>
                  <Text style={styles.detailMetaText}>Trade: {detailTicket.trade}</Text>
                  <Text style={styles.detailMetaText}>Date: {detailTicket.service_date ? new Date(detailTicket.service_date).toLocaleDateString() : '—'}</Text>
                  {detailTicket.foreman_name ? <Text style={styles.detailMetaText}>Foreman: {detailTicket.foreman_name}</Text> : null}
                </View>

                <Text style={styles.detailSectionTitle}>Work Description</Text>
                <Text style={styles.detailBody}>{detailTicket.work_description}</Text>

                {detailTicket.labor.length > 0 && (
                  <>
                    <Text style={styles.detailSectionTitle}>Labor ({detailTicket.labor.length})</Text>
                    {detailTicket.labor.map((l: LaborEntry, i: number) => (
                      <View key={i} style={styles.detailRow}>
                        <Text style={styles.detailRowText}>{l.name} — {l.class}</Text>
                        <Text style={styles.detailRowSub}>{l.reg_hours}h reg / {l.ot_hours}h OT</Text>
                      </View>
                    ))}
                  </>
                )}

                {detailTicket.materials.length > 0 && (
                  <>
                    <Text style={styles.detailSectionTitle}>Materials ({detailTicket.materials.length})</Text>
                    {detailTicket.materials.map((m: MaterialEntry, i: number) => (
                      <View key={i} style={styles.detailRow}>
                        <Text style={styles.detailRowText}>{m.description}</Text>
                        <Text style={styles.detailRowSub}>Qty: {m.quantity}</Text>
                      </View>
                    ))}
                  </>
                )}

                {detailTicket.gc_notes ? (
                  <>
                    <Text style={styles.detailSectionTitle}>GC Notes</Text>
                    <Text style={styles.detailBody}>{detailTicket.gc_notes}</Text>
                  </>
                ) : null}

                {/* Signature display */}
                {detailTicket.signature && detailTicket.signature.status === 'signed' && (
                  <View style={styles.signatureBlock}>
                    <Text style={styles.detailSectionTitle}>Signature</Text>
                    {detailTicket.signature.signature_url && (
                      <Image source={{ uri: detailTicket.signature.signature_url }} style={styles.signatureImg} resizeMode="contain" />
                    )}
                    <Text style={styles.signedByText}>Signed by: {detailTicket.signature.signer_name}</Text>
                    <Text style={styles.signedDateText}>
                      {detailTicket.signature.signed_at ? new Date(detailTicket.signature.signed_at).toLocaleString() : ''}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.detailActions}>
                  {detailTicket.status === 'draft' && (
                    <>
                      <TouchableOpacity
                        style={styles.detailEditBtn}
                        onPress={() => { setEditTicket(detailTicket); setDetailTicket(null); setCreateModalVisible(true); }}
                      >
                        <Text style={styles.detailEditBtnText}>Edit Ticket</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.detailSendBtn}
                        onPress={() => { setDetailTicket(null); handleSendForSignature(detailTicket); }}
                      >
                        <Text style={styles.detailSendBtnText}>Send for Signature</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {detailTicket.status === 'pending_signature' && (
                    <TouchableOpacity
                      style={styles.detailSendBtn}
                      onPress={() => { setDetailTicket(null); handleSendForSignature(detailTicket); }}
                    >
                      <Text style={styles.detailSendBtnText}>Resend for Signature</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Create/Edit Modal */}
      <CreateTicketModal
        visible={createModalVisible}
        onClose={() => { setCreateModalVisible(false); setEditTicket(null); }}
        jobId={job?.id}
        userId={session?.user?.id}
        onCreated={fetchTickets}
        editTicket={editTicket}
      />

      {/* Send to GC Modal */}
      {sendTicket && (
        <SendToGCModal
          visible={sendModalVisible}
          onClose={() => { setSendModalVisible(false); setSendTicket(null); }}
          documentType="work_ticket"
          documentId={sendTicket.id}
          documentNumber={sendTicket.ticket_number || 0}
          jobId={job?.id}
          jobName={job?.name || ''}
          onSent={fetchTickets}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, backgroundColor: '#eef2ff', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' as const },
  headerTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  newBtnText: { color: '#4f46e5', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },

  kanbanTabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  kanbanTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f3f4f6' },
  kanbanTabActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  kanbanTabText: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  countBadgeText: { fontSize: 11, fontWeight: '800' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },

  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  detailModal: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  detailMeta: { gap: 2, marginBottom: 16 },
  detailMetaText: { fontSize: 14, color: '#6b7280' },
  detailSectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 6 },
  detailBody: { fontSize: 14, color: '#374151', lineHeight: 21, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailRowText: { fontSize: 14, color: '#374151' },
  detailRowSub: { fontSize: 13, color: '#9ca3af' },
  signatureBlock: { marginTop: 16, backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12 },
  signatureImg: { width: '100%', height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', marginBottom: 8 },
  signedByText: { fontSize: 14, fontWeight: '600', color: '#16a34a' },
  signedDateText: { fontSize: 12, color: '#6b7280' },
  detailActions: { gap: 10, marginTop: 20 },
  detailEditBtn: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db' },
  detailEditBtnText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  detailSendBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  detailSendBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
