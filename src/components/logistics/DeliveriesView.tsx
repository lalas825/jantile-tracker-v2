import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryTicket, formatDisplayDate, SupabaseService, Worker } from '../../services/SupabaseService';
import LiveDeliveryTracker from './LiveDeliveryTracker';
import KanbanCard from './KanbanCard';
import clsx from 'clsx';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor, closestCorners, DragEndEvent, useDroppable, useDraggable } from '@dnd-kit/core';

interface DeliveriesViewProps {
    tickets: DeliveryTicket[];
    onCreateTicket: () => void;
    onUpdateStatus: (ticket: DeliveryTicket, newStatus: string) => void;
    onDeleteTicket: (id: string) => void;
    onEditTicket?: (ticket: DeliveryTicket) => void;
}

const KANBAN_COLUMNS = [
    { id: 'DRAFTS', label: 'Drafts', color: 'bg-slate-100', text: 'text-slate-600' },
    { id: 'PENDING_FIELD_REVIEW', label: 'Awaiting Field Review', color: 'bg-orange-100', text: 'text-orange-600' },
    { id: 'FIELD_APPROVED', label: 'Ready for Warehouse', color: 'bg-emerald-100', text: 'text-emerald-600' },
    { id: 'QUEUED', label: 'Scheduled Queue', color: 'bg-blue-100', text: 'text-blue-600' },
    { id: 'DISPATCHED', label: 'Dispatched / In Transit', color: 'bg-blue-100', text: 'text-blue-700' },
    { id: 'RECEIVED', label: 'Received', color: 'bg-emerald-100', text: 'text-emerald-600' }
];

// Helper: Droppable Column
function DroppableColumn({ id, label, color, textColor, children, count }: any) {
    const { isOver, setNodeRef } = useDroppable({ id });
    return (
        <View
            ref={setNodeRef as any}
            className={clsx(
                "flex-1 min-w-[280px] flex-col h-full rounded-[4px] bg-slate-100 border border-slate-200 shadow-sm overflow-hidden mr-4",
                isOver && "bg-slate-200 border-slate-300"
            )}
        >
            <View className={clsx("p-4 border-b border-slate-200 flex-row justify-between items-center", color)}>
                <Text className={clsx("font-black text-[12px] uppercase tracking-[2px]", textColor)}>{label}</Text>
                <View className="bg-white/70 px-2 py-1 rounded-[4px] border border-slate-200">
                    <Text className="font-black text-[10px] text-slate-800">{count}</Text>
                </View>
            </View>
            <ScrollView className="flex-1 p-3" contentContainerStyle={{ gap: 12 }}>
                {children}
            </ScrollView>
        </View>
    );
}

// Helper: Draggable Card Wrapper
function DraggableCard({ ticket, onDelete, onAssign, onSendToWarehouse, onEdit, onShortagePress }: { ticket: DeliveryTicket; onDelete: (id: string) => void; onAssign: (t: DeliveryTicket) => void; onSendToWarehouse: (t: DeliveryTicket) => void; onEdit?: (t: DeliveryTicket) => void; onShortagePress?: (t: DeliveryTicket) => void; }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: ticket.id,
        data: { ticket }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
        opacity: isDragging ? 0.3 : 1
    } : undefined;

    const dndAttributes = attributes as any;
    const dndListeners = listeners as any;

    return (
        <View
            ref={setNodeRef as any}
            style={style as any}
            {...dndListeners}
            {...dndAttributes}
            className="w-full"
            tabIndex={dndAttributes?.tabIndex as 0 | -1 | undefined}
        >
            <KanbanCard
                ticket={ticket}
                isRejected={(ticket.status === 'DRAFT' || ticket.status === 'DRAFTS') && !!ticket.notes}
                onPress={() => onEdit && onEdit(ticket)}
                onAssign={() => onAssign(ticket)}
                onShortagePress={() => onShortagePress && onShortagePress(ticket)}
            />
            {ticket.status === 'FIELD_APPROVED' && (
                <TouchableOpacity
                    onPress={() => onSendToWarehouse(ticket)}
                    className="bg-emerald-500 p-3 rounded-b-xl -mt-2 mx-1 items-center shadow-lg shadow-emerald-200 z-50"
                >
                    <View className="flex-row items-center gap-2">
                        <Ionicons name="paper-plane" size={14} color="white" />
                        <Text className="text-white font-black uppercase text-[10px] tracking-widest">Send to Warehouse</Text>
                    </View>
                </TouchableOpacity>
            )}
        </View>
    );
}

export default function DeliveriesView({
    tickets,
    onCreateTicket,
    onUpdateStatus,
    onDeleteTicket,
    onEditTicket
}: DeliveriesViewProps) {
    const { width } = useWindowDimensions();
    const [activeId, setActiveId] = React.useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor)
    );

    // Grouping logic for columns
    const groupedTickets = useMemo(() => {
        const groups: any = {
            DRAFTS: [],
            PENDING_FIELD_REVIEW: [],
            FIELD_APPROVED: [],
            QUEUED: [],
            DISPATCHED: [],
            RECEIVED: []
        };
        tickets.forEach(t => {
            const status = t.status?.toUpperCase();
            if (status === 'SCHEDULED' || status === 'QUEUED') groups.QUEUED.push(t);
            else if (status === 'DISPATCHED' || status === 'IN_TRANSIT') groups.DISPATCHED.push(t);
            else if (status === 'PENDING_APPROVAL') groups.PENDING_FIELD_REVIEW.push(t);
            else if (status === 'PENDING_FIELD_REVIEW') groups.PENDING_FIELD_REVIEW.push(t);
            else if (status === 'FIELD_APPROVED') groups.FIELD_APPROVED.push(t);
            else if (status === 'DRAFT' || status === 'DRAFTS' || groups[status]) {
                const key = (status === 'DRAFT' || status === 'DRAFTS') ? 'DRAFTS' : status;
                groups[key].push(t);
            }
            else groups.DRAFTS.push(t); // Default to draft if unknown
        });

        // Sort each column by updated_at
        Object.keys(groups).forEach(key => {
            groups[key].sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });

        return groups;
    }, [tickets]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const ticket = active.data.current?.ticket as DeliveryTicket;
            const newStatus = over.id as string;

            // Map UI columns back to canonical status
            let finalStatus = newStatus;
            if (newStatus === 'DRAFTS') finalStatus = 'DRAFT';
            if (newStatus === 'QUEUED') finalStatus = 'SCHEDULED';
            if (newStatus === 'DISPATCHED') finalStatus = 'IN_TRANSIT';

            // RESTRICTION: Cannot drag to FIELD_APPROVED (Ready for Warehouse) manually 
            // unless it's already approved by both Foreman and Supervisor.
            if (finalStatus === 'FIELD_APPROVED') {
                const isApproved = ticket.foreman_approved && ticket.supervisor_approved;
                if (!isApproved) {
                    Alert.alert(
                        "Approval Required",
                        "This ticket requires both Foreman and Supervisor approvals before it can be moved to 'Ready for Warehouse'."
                    );
                    return;
                }
            }

            onUpdateStatus(ticket, finalStatus);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <LiveDeliveryTracker tickets={tickets} />

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={(e) => setActiveId(e.active.id as string)}
                onDragEnd={handleDragEnd}
            >
                <View className="flex-1 bg-slate-50">
                    <View className="flex-row p-6 w-full h-full">
                        {KANBAN_COLUMNS.map(col => (
                            <DroppableColumn
                                key={col.id}
                                id={col.id}
                                label={col.label}
                                color={col.color}
                                textColor={col.text}
                                count={groupedTickets[col.id]?.length || 0}
                            >
                                {groupedTickets[col.id]?.map((t: DeliveryTicket) => (
                                    <View key={t.id} className={t.status === 'FIELD_APPROVED' ? 'animate-pulse' : ''}>
                                        <DraggableCard
                                            ticket={t}
                                            onDelete={onDeleteTicket}
                                            onSendToWarehouse={(ticket) => onUpdateStatus(ticket, 'SCHEDULED')}
                                            onEdit={onEditTicket}
                                            onShortagePress={(ticket) => {
                                                Alert.alert(
                                                    "Shortage Detected",
                                                    `Foreman Notes:\n${ticket.notes || 'No notes provided.'}`,
                                                    [
                                                        { text: "Cancel", style: "cancel" },
                                                        {
                                                            text: "Generate Replacement Ticket",
                                                            onPress: () => {
                                                                if (onEditTicket) {
                                                                    onEditTicket({
                                                                        ...ticket,
                                                                        id: '',
                                                                        ticket_number: '',
                                                                        status: 'DRAFT',
                                                                        notes: `Replacement for shortage on DT #${ticket.ticket_number}`
                                                                    });
                                                                } else {
                                                                    onCreateTicket();
                                                                }
                                                            }
                                                        }
                                                    ]
                                                );
                                            }}
                                            onAssign={async (ticket) => {
                                                try {
                                                    const workers = await SupabaseService.getWorkers();
                                                    const options = workers.map((w: any) => ({
                                                        text: w.name,
                                                        onPress: async () => {
                                                            await SupabaseService.saveDeliveryTicket({ ...ticket, assigned_to: w.id });
                                                            Alert.alert("Assigned", `Ticket #${ticket.ticket_number} assigned to ${w.name}`);
                                                        }
                                                    }));

                                                    Alert.alert(
                                                        "Assign Supervisor",
                                                        "Select a supervisor for this ticket:",
                                                        [
                                                            ...options.slice(0, 2),
                                                            { text: "Cancel", style: "cancel" }
                                                        ]
                                                    );
                                                } catch (err) {
                                                    console.error("Assign Error:", err);
                                                }
                                            }}
                                        />
                                    </View>
                                ))}

                                {col.id === 'DRAFTS' && (
                                    <TouchableOpacity
                                        onPress={onCreateTicket}
                                        className="mt-2 py-6 border border-dashed border-slate-300 rounded-[4px] items-center justify-center bg-white/50"
                                    >
                                        <Ionicons name="add" size={20} color="#94a3b8" />
                                        <Text className="text-slate-400 font-black text-[11px] uppercase tracking-widest mt-1">New Ticket</Text>
                                    </TouchableOpacity>
                                )}
                            </DroppableColumn>
                        ))}
                    </View>
                </View>
            </DndContext>
        </View>
    );
}
