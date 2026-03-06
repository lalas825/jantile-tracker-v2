import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { format, addDays, startOfWeek, isSameDay, parseISO, setHours, setMinutes } from 'date-fns';

// Conditionally import @dnd-kit (web-only)
let DndContext: any;
let useDraggable: any;
let useDroppable: any;

if (Platform.OS === 'web') {
    try {
        const dndKit = require('@dnd-kit/core');
        DndContext = dndKit.DndContext;
        useDraggable = dndKit.useDraggable;
        useDroppable = dndKit.useDroppable;
    } catch {
        // fallback if not installed
    }
}

// Types
interface CalendarEvent {
    id: string;
    title: string;
    subtitle: string;
    status: string;
    date: string; // YYYY-MM-DD
    time?: string; // HH:mm
    color?: string;
    data: any;
}

interface CalendarWeekViewProps {
    events: CalendarEvent[];
    currentDate: Date;
    onEventUpdate: (event: CalendarEvent, newDate: string, newTime: string) => void;
    renderCard: (event: CalendarEvent) => React.ReactNode;
}

// Draggable Item Wrapper (Web: DnD, Native: passthrough)
const DraggableEvent = ({ event, children }: { event: CalendarEvent; children: React.ReactNode }) => {
    if (Platform.OS !== 'web' || !useDraggable) {
        return <View className="w-full px-1 mb-0.5">{children}</View>;
    }

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: event.id,
        data: event,
    });

    const style = transform ? {
        transform: [{ translateX: transform.x }, { translateY: transform.y }],
        zIndex: 999,
        opacity: 0.8
    } : undefined;

    const { tabIndex, role, ...validAttributes } = attributes;

    return (
        <View ref={setNodeRef as any} {...listeners} {...validAttributes} style={style as any} className="w-full px-1 mb-0.5">
            {children}
        </View>
    );
};

// Droppable Time Slot (Web: DnD, Native: plain View)
const DroppableSlot = ({ date, hour, children }: { date: string, hour: number, children?: React.ReactNode }) => {
    const eventCount = React.Children.count(children);
    const hasConflict = eventCount > 3;

    if (Platform.OS !== 'web' || !useDroppable) {
        return (
            <View className={`min-h-[140px] border-b border-r border-slate-100 ${hasConflict ? 'bg-orange-50' : ''}`}>
                {hasConflict && (
                    <View className="bg-orange-100 rounded-full p-1 border border-orange-200 self-end mr-1 mt-1">
                        <Text className="text-[8px] font-black text-orange-600 px-1 italic">HI-VOLUME</Text>
                    </View>
                )}
                {children}
            </View>
        );
    }

    const { setNodeRef, isOver } = useDroppable({
        id: `${date}|${hour}`,
        data: { date, hour }
    });

    return (
        <View
            ref={setNodeRef as any}
            className={`min-h-[140px] border-b border-r border-slate-100 ${isOver ? 'bg-blue-50' : hasConflict ? 'bg-orange-50' : ''}`}
        >
            {hasConflict && (
                <View className="bg-orange-100 rounded-full p-1 border border-orange-200 self-end mr-1 mt-1">
                    <Text className="text-[8px] font-black text-orange-600 px-1 italic">HI-VOLUME</Text>
                </View>
            )}
            {children}
        </View>
    );
};

export default function CalendarWeekView({ events, currentDate, onEventUpdate, renderCard }: CalendarWeekViewProps) {
    const { width } = useWindowDimensions();
    const isTablet = width < 1024;

    // Responsive Logic: 3 days on tablet, 7 on desktop
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const allWeekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

    let visibleDays = allWeekDays;
    if (isTablet) {
        const dayIndex = allWeekDays.findIndex(d => isSameDay(d, currentDate));
        let start = dayIndex >= 0 ? dayIndex : 0;
        if (start + 3 > 7) start = 4;
        visibleDays = allWeekDays.slice(start, start + 3);
    }

    const hours = Array.from({ length: 14 }).map((_, i) => i + 5); // 5:00 to 18:00

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (over && active.data.current) {
            const [newDate, newHour] = (over.id as string).split('|');
            const originalEvent = active.data.current as CalendarEvent;
            const timeStr = `${newHour.padStart(2, '0')}:00`;
            onEventUpdate(originalEvent, newDate, timeStr);
        }
    };

    const gridContent = (
        <View className="flex-1 bg-white flex-row">
            {/* Time Column */}
            <View className="w-16 border-r border-slate-200 bg-slate-50 pt-10">
                {hours.map(hour => (
                    <View key={hour} className="h-[140px] items-center justify-start pt-1">
                        <Text className="text-xs font-medium text-slate-400">
                            {format(setHours(new Date(), hour), 'h a')}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Days Columns */}
            <View className="flex-1">
                {/* Header Row */}
                <View className="flex-row border-b border-slate-200 bg-slate-50 h-10">
                    {visibleDays.map(day => (
                        <View key={day.toString()} className="flex-1 items-center justify-center border-r border-slate-200">
                            <Text className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-700'}`}>
                                {format(day, 'EEE d')}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Scrollable Hours Grid */}
                <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
                    <View className="flex-row min-h-full">
                        {visibleDays.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayEvents = events.filter(e => e.date === dateStr);

                            return (
                                <View key={dateStr} className="flex-1 border-r border-slate-200 min-w-0">
                                    <View>
                                        {hours.map(hour => (
                                            <DroppableSlot key={`${dateStr}-${hour}`} date={dateStr} hour={hour}>
                                                {dayEvents
                                                    .filter(e => {
                                                        const evtHour = e.time ? parseInt(e.time.split(':')[0]) : 8;
                                                        return evtHour === hour;
                                                    })
                                                    .map(event => (
                                                        <DraggableEvent key={event.id} event={event}>
                                                            {renderCard(event)}
                                                        </DraggableEvent>
                                                    ))
                                                }
                                            </DroppableSlot>
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </View>
    );

    // Wrap with DndContext only on web
    if (Platform.OS === 'web' && DndContext) {
        return <DndContext onDragEnd={handleDragEnd}>{gridContent}</DndContext>;
    }

    return gridContent;
}
