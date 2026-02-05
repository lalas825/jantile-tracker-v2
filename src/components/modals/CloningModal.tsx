import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, FlatList } from 'react-native';
import { Check, X, Search, CheckSquare, Square } from 'lucide-react-native';

interface CloningModalProps {
    isVisible: boolean;
    onClose: () => void;
    onConfirm: (targetFloorIds: string[]) => void;
    floors: { id: string; name: string }[];
    title?: string;
    sourceName?: string;
    loading?: boolean;
}

export default function CloningModal({
    isVisible,
    onClose,
    onConfirm,
    floors,
    title = "Clone Structure",
    sourceName,
    loading = false
}: CloningModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isVisible) {
            setSelectedIds(new Set());
            setSearchQuery('');
        }
    }, [isVisible]);

    const filteredFloors = useMemo(() => {
        return floors.filter(f =>
            f.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [floors, searchQuery]);

    const toggleFloor = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredFloors.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredFloors.map(f => f.id)));
        }
    };

    const handleConfirm = () => {
        if (loading) return;
        if (selectedIds.size === 0) {
            alert("Please select at least one target floor");
            return;
        }
        console.log("Modal confirming with IDs:", Array.from(selectedIds));
        onConfirm(Array.from(selectedIds));
    };

    if (!isVisible) return null;

    return (
        <Modal visible={isVisible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>{title}</Text>
                            {sourceName && (
                                <Text style={styles.subtitle}>Copying: <Text style={styles.sourceHighlight}>{sourceName}</Text></Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    {/* Search & Actions */}
                    <View style={styles.searchBar}>
                        <Search size={18} color="#94a3b8" style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search floors..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                    </View>

                    <View style={styles.actionRow}>
                        <TouchableOpacity onPress={toggleAll} style={styles.textAction}>
                            <Text style={styles.textActionLabel}>
                                {selectedIds.size === filteredFloors.length ? "Deselect All" : "Select All"}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.countLabel}>{selectedIds.size} Selected</Text>
                    </View>

                    {/* Floor List */}
                    <View style={styles.listContainer}>
                        <FlatList
                            data={filteredFloors}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.floorItem, selectedIds.has(item.id) && styles.floorItemActive]}
                                    onPress={() => toggleFloor(item.id)}
                                >
                                    <View style={styles.floorInfo}>
                                        <Text style={[styles.floorName, selectedIds.has(item.id) && styles.floorNameActive]}>{item.name}</Text>
                                    </View>
                                    {selectedIds.has(item.id) ? (
                                        <CheckSquare size={20} color="#2563eb" />
                                    ) : (
                                        <Square size={20} color="#cbd5e1" />
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={() => (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>No floors found</Text>
                                </View>
                            )}
                        />
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveBtn, loading && { opacity: 0.7 }]}
                            onPress={handleConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <Text style={styles.saveText}>Cloning...</Text>
                            ) : (
                                <>
                                    <Check size={18} color="white" style={{ marginRight: 6 }} />
                                    <Text style={styles.saveText}>Clone Now</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: { width: 500, maxHeight: '80%', backgroundColor: 'white', borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, elevation: 10 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },
    sourceHighlight: { color: '#2563eb', fontWeight: '700' },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 15, marginBottom: 12, borderWidth: 1 },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1e293b' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
    textAction: { paddingVertical: 4 },
    textActionLabel: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
    countLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' },
    listContainer: { flex: 1, minHeight: 300, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    floorItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    floorItemActive: { backgroundColor: '#eff6ff' },
    floorInfo: { flex: 1 },
    floorName: { fontSize: 16, color: '#334155', fontWeight: '600' },
    floorNameActive: { color: '#1e40af', fontWeight: '700' },
    emptyState: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#94a3b8', fontWeight: '500' },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
    cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#f1f5f9' },
    cancelText: { fontWeight: '700', color: '#64748b' },
    saveBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, backgroundColor: '#2563eb', shadowColor: "#2563eb", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 5 },
    saveText: { fontWeight: '700', color: 'white' }
});
