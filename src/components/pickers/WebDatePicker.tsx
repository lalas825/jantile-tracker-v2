/**
 * WebDatePicker.tsx
 * A visual calendar dropdown for web – replaces the plain <input type="date">.
 * Shows a mini month calendar when clicked, with prev/next month navigation.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WebDatePickerProps {
    value: string;               // YYYY-MM-DD
    onChange: (date: string) => void;
    label?: string;
    compact?: boolean;           // Smaller pill style (for review step)
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function pad(n: number) { return n.toString().padStart(2, '0'); }

function toDateStr(y: number, m: number, d: number) {
    return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseDateStr(s: string) {
    const [y, m, d] = s.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
}

export default function WebDatePicker({ value, onChange, label, compact }: WebDatePickerProps) {
    const [open, setOpen] = useState(false);
    const parsed = parseDateStr(value || new Date().toISOString().split('T')[0]);
    const [viewYear, setViewYear] = useState(parsed.year);
    const [viewMonth, setViewMonth] = useState(parsed.month);
    const dropdownRef = useRef<View>(null);

    useEffect(() => {
        if (open) {
            const p = parseDateStr(value || new Date().toISOString().split('T')[0]);
            setViewYear(p.year);
            setViewMonth(p.month);
        }
    }, [open]);

    // Calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; inMonth: boolean; dateStr: string }[] = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        const d = prevMonthDays - i;
        const m = viewMonth === 0 ? 11 : viewMonth - 1;
        const y = viewMonth === 0 ? viewYear - 1 : viewYear;
        cells.push({ day: d, inMonth: false, dateStr: toDateStr(y, m, d) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, inMonth: true, dateStr: toDateStr(viewYear, viewMonth, d) });
    }
    // Next month leading days
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        const m = viewMonth === 11 ? 0 : viewMonth + 1;
        const y = viewMonth === 11 ? viewYear + 1 : viewYear;
        cells.push({ day: d, inMonth: false, dateStr: toDateStr(y, m, d) });
    }

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };

    // Format display
    const displayDate = (() => {
        try {
            const d = new Date(value + 'T12:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return value; }
    })();

    const today = new Date().toISOString().split('T')[0];

    if (Platform.OS !== 'web') return null;

    return (
        <View>
            <TouchableOpacity
                onPress={() => setOpen(!open)}
                activeOpacity={0.7}
                className={compact
                    ? "bg-white px-4 py-2.5 rounded-xl border border-slate-200 flex-row items-center gap-2"
                    : "bg-slate-50 border border-slate-100 p-4 rounded-2xl flex-row justify-between items-center"
                }
            >
                {label && <Text className="text-[10px] font-bold text-slate-400">{label}</Text>}
                <Text className={compact
                    ? "text-[10px] font-black text-slate-900"
                    : "font-inter font-black text-slate-900"
                }>{displayDate}</Text>
                <Ionicons name="calendar-outline" size={compact ? 12 : 20} color="#2563eb" />
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
                            style={{ width: 320, padding: 20 }}
                        >
                            {/* Header */}
                            <View className="flex-row justify-between items-center mb-4">
                                <TouchableOpacity onPress={prevMonth} className="p-2 rounded-lg bg-slate-50">
                                    <Ionicons name="chevron-back" size={16} color="#334155" />
                                </TouchableOpacity>
                                <Text className="font-black text-slate-900 text-sm">
                                    {MONTHS[viewMonth]} {viewYear}
                                </Text>
                                <TouchableOpacity onPress={nextMonth} className="p-2 rounded-lg bg-slate-50">
                                    <Ionicons name="chevron-forward" size={16} color="#334155" />
                                </TouchableOpacity>
                            </View>

                            {/* Day headers */}
                            <View className="flex-row mb-2">
                                {DAYS.map(d => (
                                    <View key={d} style={{ width: '14.28%', alignItems: 'center' }}>
                                        <Text className="text-[10px] font-black text-slate-400 uppercase">{d}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Days grid */}
                            <View className="flex-row flex-wrap">
                                {cells.map((cell, i) => {
                                    const isSelected = cell.dateStr === value;
                                    const isToday = cell.dateStr === today;
                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            onPress={() => { onChange(cell.dateStr); setOpen(false); }}
                                            style={{ width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <View className={
                                                isSelected ? "bg-blue-600 rounded-full w-8 h-8 items-center justify-center"
                                                    : isToday ? "border border-blue-600 rounded-full w-8 h-8 items-center justify-center"
                                                        : "w-8 h-8 items-center justify-center"
                                            }>
                                                <Text className={
                                                    isSelected ? "text-white font-black text-xs"
                                                        : cell.inMonth ? "text-slate-700 font-bold text-xs"
                                                            : "text-slate-300 font-bold text-xs"
                                                }>
                                                    {cell.day}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Today shortcut */}
                            <TouchableOpacity
                                onPress={() => { onChange(today); setOpen(false); }}
                                className="mt-3 pt-3 border-t border-slate-100 items-center"
                            >
                                <Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Today</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

