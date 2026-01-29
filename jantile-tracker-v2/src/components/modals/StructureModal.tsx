import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { QUICK_PICKS } from '../../constants/JobTemplates';

interface StructureModalProps {
    isVisible: boolean;
    mode: 'add-floor' | 'edit-floor' | 'add-unit' | 'edit-unit' | 'add-area' | 'edit-area';
    type: 'floor' | 'unit' | 'area';
    initialData?: { name?: string; description?: string; areaName?: string };
    onSubmit: (data: any) => void;
    onClose: () => void;
}

export default function StructureModal({
    isVisible,
    mode,
    type,
    initialData,
    onSubmit,
    onClose,
}: StructureModalProps) {
    const isEdit = mode.startsWith('edit');

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // RESET LOGIC
    useEffect(() => {
        if (isVisible) {
            if (isEdit && initialData) {
                // EDIT MODE: Load existing data
                setName(initialData.name || '');
                setDescription(initialData.description || '');
            } else {
                // CREATE MODE: Wipe everything clean
                setName('');
                setDescription('');
            }
        }
    }, [isVisible, mode, initialData]);

    const handleSave = () => {
        // Send 'name' as the primary identifier for all types
        onSubmit({ name, description });
    };

    // Dynamic Title Logic
    const getTitle = () => {
        if (isEdit) return `Edit ${type === 'floor' ? 'Floor' : type === 'unit' ? 'Unit' : 'Area'} `;
        if (type === 'floor') return 'Add New Floor';
        if (type === 'unit') return 'Add New Unit';
        if (type === 'area') return 'Add New Area';
        return 'Add Item';
    };

    const getLabel = () => {
        if (type === 'floor') return 'Floor Name';
        if (type === 'unit') return 'Unit Name';
        if (type === 'area') return 'Area Name';
        return 'Name';
    };

    const getPlaceholder = () => {
        if (type === 'floor') return 'e.g. Floor Level 04';
        if (type === 'unit') return 'e.g. Unit 205';
        if (type === 'area') return 'e.g. Master Bathroom';
        return 'Enter name...';
    };

    if (!isVisible) return null;

    return (
        <Modal visible={isVisible} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>{getTitle()}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Field 1: The Main Name (Floor, Unit, or Area Name) */}
                        <Text style={styles.label}>{getLabel()}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={getPlaceholder()}
                            value={name}
                            onChangeText={setName}
                            autoFocus={true}
                        />

                        {/* Quick Picks - Only for Areas */}
                        {type === 'area' && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mt-2 max-h-12">
                                {QUICK_PICKS.map((pick) => (
                                    <TouchableOpacity
                                        key={pick}
                                        onPress={() => setName(pick)}
                                        style={[
                                            styles.chip,
                                            name === pick && styles.chipActive
                                        ]}
                                    >
                                        <Text style={[
                                            styles.chipText,
                                            name === pick && styles.chipTextActive
                                        ]}>{pick}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        {/* Description - Only for Areas */}
                        {(type === 'unit' || type === 'area' || type === 'floor') && (
                            <>
                                <Text style={styles.label}>Description (Optional)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. North Side"
                                    value={description}
                                    onChangeText={setDescription}
                                />
                            </>
                        )}
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveText}>{isEdit ? 'Save Changes' : 'Create'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: { width: 500, maxWidth: '90%', backgroundColor: 'white', borderRadius: 12, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, elevation: 5 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
    closeText: { fontSize: 20, color: '#94a3b8' },
    form: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f8fafc' },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    cancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#f1f5f9' },
    cancelText: { fontWeight: '600', color: '#64748b' },
    saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#2563eb' },
    saveText: { fontWeight: '600', color: 'white' },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#cbd5e1' },
    chipActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
    chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
    chipTextActive: { color: '#2563eb', fontWeight: '700' }
});
