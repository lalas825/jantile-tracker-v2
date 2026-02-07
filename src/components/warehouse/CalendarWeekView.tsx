import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { format, addDays, startOfWeek, isSameDay, parseISO, setHours, setMinutes } from 'date-fns';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';

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

// Draggable Item Wrapper
const DraggableEvent = ({ event, children }: { event: CalendarEvent; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: event.id,
        data: event,
    });

    const style = transform ? {
        transform: [{ translateX: transform.x }, { translateY: transform.y }],
        zIndex: 999,
        opacity: 0.8
    } : undefined;

    // Destructure tabIndex and role out to avoid View prop error
    const { tabIndex, role, ...validAttributes } = attributes;

    return (
        <View ref={setNodeRef as any} {...listeners} {...validAttributes} style={style as any} className="absolute w-full px-1">
            {children}
        </View>
    );
};

// Droppable Time Slot with Conflict Detection
const DroppableSlot = ({ date, hour, children }: { date: string, hour: number, children?: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `${date}|${hour}`,
        data: { date, hour }
    });

    // Count children to detect conflict (React.Children.count might count nulls, so array filter is safer if children is array)
    const eventCount = React.Children.count(children);
    const hasConflict = eventCount > 3;

    return (
        <View
            ref={setNodeRef as any}
            className={`h-24 border-b border-r border-slate-100 relative ${isOver ? 'bg-blue-50' : hasConflict ? 'bg-red-50' : ''}`}
        >
            {/* Visual Conflict Indicator */}
            {hasConflict && (
                <View className="absolute top-1 right-1 bg-red-100 rounded-full p-1 z-10">
                    <Text className="text-[8px] font-black text-red-600 px-1">BUSY</Text>
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
        // Logic: Try to keep current day in view. If current day is Mon(0), show 0,1,2. If Sun(6), show 4,5,6.
        // Default to start of week if we can't find it (unlikely)
        let start = dayIndex >= 0 ? dayIndex : 0;
        if (start + 3 > 7) start = 4; // Shift back so we always show 3 days
        visibleDays = allWeekDays.slice(start, start + 3);
    }

    const hours = Array.from({ length: 14 }).map((_, i) => i + 5); // 5:00 to 18:00

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.data.current) {
            const [newDate, newHour] = (over.id as string).split('|');
            const originalEvent = active.data.current as CalendarEvent;

            // Format time as HH:mm
            const timeStr = `${newHour.padStart(2, '0')}:00`;

            onEventUpdate(originalEvent, newDate, timeStr);
        }
    };

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <View className="flex-1 bg-white flex-row">
                {/* Time Column - Fixed Width */}
                <View className="w-16 border-r border-slate-200 bg-slate-50 pt-10">
                    {hours.map(hour => (
                        <View key={hour} className="h-24 items-center justify-start pt-1">
                            <Text className="text-xs font-medium text-slate-400">
                                {format(setHours(new Date(), hour), 'h a')}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Days Columns - Fluid Grid */}
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

                    {/* Scrollable Hours Grid (Vertical Scroll Only) */}
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
        </DndContext>
    );
}
