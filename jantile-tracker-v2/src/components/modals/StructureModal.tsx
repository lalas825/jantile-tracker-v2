import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { QUICK_PICKS } from '../../constants/JobTemplates';

export default function StructureModal({ isVisible, mode, type, initialData, onSubmit, onClose }) {
    const [name, setName] = useState('');
    const [areaName, setAreaName] = useState('');
    const [description, setDescription] = useState('');

    // RESET LOGIC: When modal opens, strictly check Mode
    useEffect(() => {
        if (isVisible) {
            if (mode === 'edit' && initialData) {
                // EDIT MODE: Load existing data
                setName(initialData.name || '');
                setAreaName(initialData.areaName || '');
                setDescription(initialData.description || '');
            } else {
                // CREATE MODE: Wipe everything clean
                setName('');
                setAreaName('');
                setDescription('');
            }
        }
    }, [isVisible, mode, initialData]); // Dependencies ensure this runs every time

    const handleSave = () => {
        onSubmit({ name, areaName, description });
    };

    // Dynamic Title Logic
    const getTitle = () => {
        if (mode === 'edit') return `Edit ${type === 'floor' ? 'Floor' : 'Area'}`;
        return `Add New ${type === 'floor' ? 'Floor' : 'Unit'}`;
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
                        {/* Field 1: The Main Name (Floor Name or Unit Name) */}
                        <Text style={styles.label}>{type === 'floor' ? 'Floor Name' : 'Unit Name'}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={type === 'floor' ? "e.g. Floor Level 04" : "e.g. Unit 205"}
                            value={name}
                            onChangeText={setName}
                            autoFocus={true}
                        />

                        {/* Field 2 & 3: Only for Units/Areas */}
                        {type !== 'floor' && (
                            <>
                                <Text style={styles.label}>Area Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Master Bathroom"
                                    value={areaName}
                                    onChangeText={setAreaName}
                                />

                                {/* Quick Picks - Horizontal Scroll */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4 max-h-10 mt-2">
                                    {QUICK_PICKS.map((pick) => (
                                        <TouchableOpacity
                                            key={pick}
                                            onPress={() => setAreaName(pick)}
                                            style={[
                                                styles.chip,
                                                areaName === pick && styles.chipActive
                                            ]}
                                        >
                                            <Text style={[
                                                styles.chipText,
                                                areaName === pick && styles.chipTextActive
                                            ]}>{pick}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

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
                            <Text style={styles.saveText}>{mode === 'create' ? 'Create' : 'Save Changes'}</Text>
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
