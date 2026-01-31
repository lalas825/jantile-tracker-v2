import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
// import DateTimePicker from '@react-native-community/datetimepicker'; // Removed for stepper
import { CREW_MEMBERS } from '../../../constants/CrewData';

export default function LogTimeTab({ areaId, onSave }) {
    const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
    const [regularHours, setRegularHours] = useState('');
    const [otHours, setOtHours] = useState('');
    const [notes, setNotes] = useState('');
    const [logDate, setLogDate] = useState(new Date());
    // const [showDatePicker, setShowDatePicker] = useState(false); // Removed for stepper

    const changeDate = (days: number) => {
        const newDate = new Date(logDate);
        newDate.setDate(logDate.getDate() + days);
        setLogDate(newDate);
    };

    const toggleWorker = (id: string) => {
        if (selectedWorkers.includes(id)) {
            setSelectedWorkers(selectedWorkers.filter(wId => wId !== id));
        } else {
            setSelectedWorkers([...selectedWorkers, id]);
        }
    };

    const handleSave = () => {
        if (selectedWorkers.length === 0) {
            Platform.OS === 'web' ? window.alert("Select at least one worker") : Alert.alert("Missing Info", "Please select at least one crew member.");
            return;
        }
        if (!regularHours && !otHours) {
            Platform.OS === 'web' ? window.alert("Enter hours") : Alert.alert("Missing Info", "Please enter Regular or OT hours.");
            return;
        }

        onSave({
            date: logDate.toISOString(),
            workerIds: selectedWorkers,
            regularHours: parseFloat(regularHours) || 0,
            otHours: parseFloat(otHours) || 0,
            description: notes
        });
    };

    return (
        <View style={styles.container}>
            {/* Date Selector Row (Stepper) */}
            <View style={styles.dateHeader}>
                <Text style={styles.label}>Date:</Text>

                <View style={styles.stepperContainer}>
                    {/* Previous Day Button */}
                    <TouchableOpacity onPress={() => changeDate(-1)} style={styles.stepperBtn}>
                        <Text style={styles.stepperText}>←</Text>
                    </TouchableOpacity>

                    {/* Date Display */}
                    <View style={styles.dateDisplay}>
                        <Text style={styles.dateDisplayText}>
                            {logDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                    </View>

                    {/* Next Day Button */}
                    <TouchableOpacity onPress={() => changeDate(1)} style={styles.stepperBtn}>
                        <Text style={styles.stepperText}>→</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 1. Crew Selection (Vertical List) */}
            <Text style={styles.label}>Who worked on this? ({selectedWorkers.length})</Text>
            <View style={styles.crewListContainer}>
                <ScrollView nestedScrollEnabled={true}>
                    {CREW_MEMBERS.map((member) => {
                        const isSelected = selectedWorkers.includes(member.id);
                        return (
                            <TouchableOpacity
                                key={member.id}
                                style={[styles.crewRow, isSelected && styles.crewRowSelected]}
                                onPress={() => toggleWorker(member.id)}
                            >
                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                                <View>
                                    <Text style={[styles.workerName, isSelected && styles.workerNameSelected]}>{member.name}</Text>
                                    <Text style={styles.workerRole}>{member.role}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* 2. Hours Input (Split) */}
            <View style={styles.row}>
                <View style={styles.halfInput}>
                    <Text style={styles.label}>Regular Hours</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="0"
                        keyboardType="numeric"
                        value={regularHours}
                        onChangeText={setRegularHours}
                    />
                </View>
                <View style={styles.halfInput}>
                    <Text style={[styles.label, { color: '#ef4444' }]}>Overtime (OT)</Text>
                    <TextInput
                        style={[styles.input, styles.otInput]}
                        placeholder="0"
                        placeholderTextColor="#fca5a5"
                        keyboardType="numeric"
                        value={otHours}
                        onChangeText={setOtHours}
                    />
                </View>
            </View>

            {/* 3. Notes */}
            <Text style={styles.label}>Notes</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What did you work on?"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
            />

            {/* Footer Button */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Submit Time Log</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    // Date Header Styles
    dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    stepperContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    stepperBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#e2e8f0' },
    stepperText: { fontSize: 18, fontWeight: 'bold', color: '#334155' },
    dateDisplay: { paddingHorizontal: 16, minWidth: 120, alignItems: 'center' },
    dateDisplayText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
    hiddenWebInput: { width: 0, height: 0, opacity: 0 },
    label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, marginTop: 8 },
    crewListContainer: { height: 200, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f8fafc' },
    crewRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: 'white' },
    crewRowSelected: { backgroundColor: '#eff6ff' },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    checkboxSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    checkmark: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    workerName: { fontSize: 14, color: '#334155', fontWeight: '500' },
    workerNameSelected: { color: '#1e40af', fontWeight: 'bold' },
    workerRole: { fontSize: 12, color: '#94a3b8' },
    row: { flexDirection: 'row', gap: 16 },
    halfInput: { flex: 1 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: 'white' },
    otInput: { borderColor: '#ef4444', color: '#b91c1c', backgroundColor: '#fef2f2' },
    textArea: { height: 80, textAlignVertical: 'top' },
    saveBtn: { marginTop: 24, backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
