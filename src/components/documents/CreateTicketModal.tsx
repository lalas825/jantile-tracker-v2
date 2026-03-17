import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { DocumentService } from '../../features/documents/DocumentService';
import type { LaborEntry, MaterialEntry, WorkTicket } from '../../features/documents/types';

interface CreateTicketModalProps {
  visible: boolean;
  onClose: () => void;
  jobId: string;
  userId?: string;
  onCreated: () => void;
  editTicket?: WorkTicket | null;
}

const TRADES = ['Tile', 'Stone', 'Polisher'] as const;

export default function CreateTicketModal({
  visible, onClose, jobId, userId, onCreated, editTicket,
}: CreateTicketModalProps) {
  const isEdit = !!editTicket;

  const [serviceDate, setServiceDate] = useState(editTicket?.service_date || new Date().toISOString().split('T')[0]);
  const [workDescription, setWorkDescription] = useState(editTicket?.work_description || '');
  const [trade, setTrade] = useState(editTicket?.trade || 'Tile');
  const [foremanName, setForemanName] = useState(editTicket?.foreman_name || '');
  const [gcNotes, setGcNotes] = useState(editTicket?.gc_notes || '');
  const [labor, setLabor] = useState<LaborEntry[]>(editTicket?.labor || []);
  const [materials, setMaterials] = useState<MaterialEntry[]>(editTicket?.materials || []);
  const [loading, setLoading] = useState(false);

  const addLabor = () => setLabor([...labor, { name: '', class: 'Mechanic', reg_hours: 0, ot_hours: 0 }]);
  const removeLabor = (i: number) => setLabor(labor.filter((_, idx) => idx !== i));
  const updateLabor = (i: number, field: keyof LaborEntry, val: string) => {
    const updated = [...labor];
    if (field === 'reg_hours' || field === 'ot_hours') {
      (updated[i] as any)[field] = parseFloat(val) || 0;
    } else {
      (updated[i] as any)[field] = val;
    }
    setLabor(updated);
  };

  const addMaterial = () => setMaterials([...materials, { description: '', quantity: 0 }]);
  const removeMaterial = (i: number) => setMaterials(materials.filter((_, idx) => idx !== i));
  const updateMaterial = (i: number, field: keyof MaterialEntry, val: string) => {
    const updated = [...materials];
    if (field === 'quantity') {
      updated[i].quantity = parseFloat(val) || 0;
    } else {
      updated[i].description = val;
    }
    setMaterials(updated);
  };

  const handleSubmit = useCallback(async () => {
    if (!workDescription.trim()) {
      Alert.alert('Required', 'Work description is required.');
      return;
    }
    setLoading(true);
    try {
      if (isEdit && editTicket) {
        await DocumentService.updateWorkTicket(editTicket.id, {
          service_date: serviceDate,
          work_description: workDescription.trim(),
          trade,
          foreman_name: foremanName.trim() || undefined,
          gc_notes: gcNotes.trim() || undefined,
          labor,
          materials,
        });
      } else {
        await DocumentService.createWorkTicket({
          job_id: jobId,
          service_date: serviceDate,
          work_description: workDescription.trim(),
          trade,
          labor,
          materials,
          gc_notes: gcNotes.trim() || undefined,
          status: 'draft',
          foreman_name: foremanName.trim() || undefined,
          created_by: userId,
        });
      }
      onCreated();
      onClose();
    } catch (err) {
      console.error('[CreateTicketModal] submit error:', err);
      Alert.alert('Error', 'Failed to save ticket.');
    } finally {
      setLoading(false);
    }
  }, [workDescription, serviceDate, trade, foremanName, gcNotes, labor, materials, jobId, userId, isEdit, editTicket, onCreated, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit' : 'New'} T&M Ticket</Text>
            <TouchableOpacity onPress={onClose}><X size={22} color="#6b7280" /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* Service Date */}
            <Text style={styles.label}>Service Date</Text>
            <TextInput
              style={styles.input}
              value={serviceDate}
              onChangeText={setServiceDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
            />

            {/* Trade */}
            <Text style={styles.label}>Trade</Text>
            <View style={styles.chipRow}>
              {TRADES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, trade === t && styles.chipActive]}
                  onPress={() => setTrade(t)}
                >
                  <Text style={[styles.chipText, trade === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Foreman */}
            <Text style={styles.label}>Foreman Name</Text>
            <TextInput
              style={styles.input}
              value={foremanName}
              onChangeText={setForemanName}
              placeholder="Optional"
              placeholderTextColor="#9ca3af"
            />

            {/* Work Description */}
            <Text style={styles.label}>Work Description *</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={workDescription}
              onChangeText={setWorkDescription}
              placeholder="Describe the work performed..."
              placeholderTextColor="#9ca3af"
              multiline
            />

            {/* Labor */}
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Labor</Text>
              <TouchableOpacity onPress={addLabor} style={styles.addBtn}>
                <Plus size={14} color="#2563eb" /><Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {labor.map((l, i) => (
              <View key={i} style={styles.entryRow}>
                <TextInput style={[styles.input, { flex: 2, marginBottom: 0 }]} value={l.name} onChangeText={v => updateLabor(i, 'name', v)} placeholder="Name" placeholderTextColor="#9ca3af" />
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={l.class} onChangeText={v => updateLabor(i, 'class', v)} placeholder="Class" placeholderTextColor="#9ca3af" />
                <TextInput style={[styles.input, { width: 50, marginBottom: 0 }]} value={l.reg_hours ? String(l.reg_hours) : ''} onChangeText={v => updateLabor(i, 'reg_hours', v)} placeholder="Reg" placeholderTextColor="#9ca3af" keyboardType="numeric" />
                <TextInput style={[styles.input, { width: 50, marginBottom: 0 }]} value={l.ot_hours ? String(l.ot_hours) : ''} onChangeText={v => updateLabor(i, 'ot_hours', v)} placeholder="OT" placeholderTextColor="#9ca3af" keyboardType="numeric" />
                <TouchableOpacity onPress={() => removeLabor(i)}><Trash2 size={16} color="#ef4444" /></TouchableOpacity>
              </View>
            ))}

            {/* Materials */}
            <View style={[styles.sectionHeader, { marginTop: 16 }]}>
              <Text style={styles.label}>Materials</Text>
              <TouchableOpacity onPress={addMaterial} style={styles.addBtn}>
                <Plus size={14} color="#2563eb" /><Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {materials.map((m, i) => (
              <View key={i} style={styles.entryRow}>
                <TextInput style={[styles.input, { flex: 3, marginBottom: 0 }]} value={m.description} onChangeText={v => updateMaterial(i, 'description', v)} placeholder="Description" placeholderTextColor="#9ca3af" />
                <TextInput style={[styles.input, { width: 60, marginBottom: 0 }]} value={m.quantity ? String(m.quantity) : ''} onChangeText={v => updateMaterial(i, 'quantity', v)} placeholder="Qty" placeholderTextColor="#9ca3af" keyboardType="numeric" />
                <TouchableOpacity onPress={() => removeMaterial(i)}><Trash2 size={16} color="#ef4444" /></TouchableOpacity>
              </View>
            ))}

            {/* GC Notes */}
            <Text style={[styles.label, { marginTop: 16 }]}>GC Notes / Comments</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
              value={gcNotes}
              onChangeText={setGcNotes}
              placeholder="Optional notes for the GC..."
              placeholderTextColor="#9ca3af"
              multiline
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={styles.submitBtnText}>{isEdit ? 'Update Ticket' : 'Create Ticket'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 560, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb', marginBottom: 4 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
