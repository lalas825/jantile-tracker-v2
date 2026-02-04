import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';

interface CalendarEvent {
    id: string;
    title: string;
    subtitle: string;
    status: string;
    date: string;
    color?: string;
    data: any;
}

interface CalendarMonthViewProps {
    events: CalendarEvent[];
    currentDate: Date;
    onDayPress: (date: Date) => void;
}

export default function CalendarMonthView({ events, currentDate, onDayPress }: CalendarMonthViewProps) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weeks = [];
    let week = [];

    for (const day of days) {
        week.push(day);
        if (week.length === 7) {
            weeks.push(week);
            week = [];
        }
    }

    return (
        <ScrollView className="flex-1 bg-white">
            {/* Weekday Headers */}
            <View className="flex-row border-b border-slate-200 bg-slate-50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <View key={d} className="flex-1 py-2 items-center">
                        <Text className="text-xs font-bold text-slate-400 uppercase">{d}</Text>
                    </View>
                ))}
            </View>

            {/* Grid */}
            {weeks.map((weekDays, wIndex) => (
                <View key={wIndex} className="flex-row border-b border-slate-100 h-32">
                    {weekDays.map((day, dIndex) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayEvents = events.filter(e => e.date === dateStr);
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <TouchableOpacity
                                key={dateStr}
                                className={`flex-1 border-r border-slate-100 p-1 ${!isCurrentMonth ? 'bg-slate-50/50' : ''}`}
                                onPress={() => onDayPress(day)}
                            >
                                <View className={`self-end mb-1 w-6 h-6 items-center justify-center rounded-full ${isToday ? 'bg-blue-600' : ''}`}>
                                    <Text className={`text-xs font-medium ${isToday ? 'text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                                        {format(day, 'd')}
                                    </Text>
                                </View>

                                {/* Mini Cards */}
                                <View className="gap-1">
                                    {dayEvents.slice(0, 3).map(event => (
                                        <View key={event.id} className={`px-1 py-0.5 rounded ${event.color || 'bg-blue-100'}`}>
                                            <Text numberOfLines={1} className="text-[9px] font-bold text-slate-800">
                                                {event.title}
                                            </Text>
                                        </View>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <Text className="text-[9px] text-slate-400 text-center">
                                            +{dayEvents.length - 3} more
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </ScrollView>
    );
}
