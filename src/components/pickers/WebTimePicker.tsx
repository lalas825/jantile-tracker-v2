/**
 * WebTimePicker.tsx
 * A visual time selector dropdown for web – shows hour/minute scroll lists
 * with AM/PM toggle. Replaces the plain <input type="time">.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WebTimePickerProps {
    value: string;               // e.g. "7:00 AM"
    onChange: (time: string) => void;
    compact?: boolean;
}

function parseTime(s: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } {
    try {
        const [time, ampm] = s.split(' ');
        const [h, m] = time.split(':').map(Number);
        return { hour: h || 12, minute: m || 0, ampm: (ampm as 'AM' | 'PM') || 'AM' };
    } catch {
        return { hour: 7, minute: 0, ampm: 'AM' };
    }
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function WebTimePicker({ value, onChange, compact }: WebTimePickerProps) {
    const [open, setOpen] = useState(false);
    const parsed = parseTime(value);
    const [selHour, setSelHour] = useState(parsed.hour);
    const [selMinute, setSelMinute] = useState(parsed.minute);
    const [selAmPm, setSelAmPm] = useState<'AM' | 'PM'>(parsed.ampm);

    const applyTime = (h: number, m: number, ap: 'AM' | 'PM') => {
        const timeStr = `${h}:${m.toString().padStart(2, '0')} ${ap}`;
        onChange(timeStr);
    };

    const handleOpen = () => {
        const p = parseTime(value);
        setSelHour(p.hour);
        setSelMinute(p.minute);
        setSelAmPm(p.ampm);
        setOpen(true);
    };

    if (Platform.OS !== 'web') return null;

    return (
        <View>
            <TouchableOpacity
                onPress={handleOpen}
                activeOpacity={0.7}
                className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2"
            >
                <Text className="text-[10px] font-black text-slate-900">{value}</Text>
                <Ionicons name="time-outline" size={12} color="#2563eb" />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade">
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setOpen(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View
                            className="bg-white rounded-2xl border border-slate-200 shadow-xl"
                            style={{ width: 280, padding: 20 }}
                        >
                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">
                                Select Time
                            </Text>

                            <View className="flex-row gap-2" style={{ height: 200 }}>
                                {/* Hours */}
                                <View className="flex-1 bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                                    <Text className="text-[8px] font-black text-slate-400 uppercase text-center py-1 bg-slate-100">HR</Text>
                                    <ScrollView showsVerticalScrollIndicator={false}>
                                        {HOURS.map(h => (
                                            <TouchableOpacity
                                                key={h}
                                                onPress={() => { setSelHour(h); applyTime(h, selMinute, selAmPm); }}
                                                className={`py-2.5 items-center ${selHour === h ? 'bg-blue-600' : ''}`}
                                            >
                                                <Text className={`font-black text-sm ${selHour === h ? 'text-white' : 'text-slate-700'}`}>
                                                    {h}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Minutes */}
                                <View className="flex-1 bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                                    <Text className="text-[8px] font-black text-slate-400 uppercase text-center py-1 bg-slate-100">MIN</Text>
                                    <ScrollView showsVerticalScrollIndicator={false}>
                                        {MINUTES.map(m => (
                                            <TouchableOpacity
                                                key={m}
                                                onPress={() => { setSelMinute(m); applyTime(selHour, m, selAmPm); }}
                                                className={`py-2.5 items-center ${selMinute === m ? 'bg-blue-600' : ''}`}
                                            >
                                                <Text className={`font-black text-sm ${selMinute === m ? 'text-white' : 'text-slate-700'}`}>
                                                    {m.toString().padStart(2, '0')}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* AM / PM */}
                                <View className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100" style={{ width: 56 }}>
                                    <Text className="text-[8px] font-black text-slate-400 uppercase text-center py-1 bg-slate-100"> </Text>
                                    <TouchableOpacity
                                        onPress={() => { setSelAmPm('AM'); applyTime(selHour, selMinute, 'AM'); }}
                                        className={`flex-1 items-center justify-center ${selAmPm === 'AM' ? 'bg-blue-600' : ''}`}
                                    >
                                        <Text className={`font-black text-sm ${selAmPm === 'AM' ? 'text-white' : 'text-slate-700'}`}>AM</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => { setSelAmPm('PM'); applyTime(selHour, selMinute, 'PM'); }}
                                        className={`flex-1 items-center justify-center ${selAmPm === 'PM' ? 'bg-blue-600' : ''}`}
                                    >
                                        <Text className={`font-black text-sm ${selAmPm === 'PM' ? 'text-white' : 'text-slate-700'}`}>PM</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Done */}
                            <TouchableOpacity
                                onPress={() => setOpen(false)}
                                className="mt-3 bg-blue-600 py-2.5 rounded-xl items-center shadow-lg shadow-blue-200"
                            >
                                <Text className="text-white font-black text-[10px] uppercase tracking-widest">Done</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
