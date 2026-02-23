import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeliveryTicket, formatDisplayDate } from '../../services/SupabaseService';
import clsx from 'clsx';
import { Truck, Clock, User, Package, Printer } from 'lucide-react-native';

interface KanbanCardProps {
    ticket: DeliveryTicket;
    onPress?: () => void;
    onAssign?: () => void;
    onShortagePress?: () => void;
    onPrint?: () => void;
    isRejected?: boolean;
}

export default function KanbanCard({ ticket, onPress, onAssign, onShortagePress, onPrint, isRejected }: KanbanCardProps) {
    const totalQty = ticket.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
    const firstItem = ticket.items?.[0];
    const itemCount = ticket.items?.length || 0;

    // Dual Unit Calculation with bolded piece count
    const renderDualUnit = () => {
        if (!firstItem) return null;
        const qty = firstItem.qty || 0;
        const unit = firstItem.unit || 'SQFT';

        if (firstItem.sqft_per_piece && firstItem.sqft_per_piece > 0) {
            const pcs = Math.ceil(qty / firstItem.sqft_per_piece);
            return (
                <Text className="text-[12px] font-bold text-slate-500 ml-4">
                    {qty.toLocaleString()} {unit} (<Text className="font-black text-slate-900">{pcs.toLocaleString()} PCS</Text>)
                </Text>
            );
        }
        return (
            <Text className="text-[12px] font-bold text-slate-500 ml-4">
                {qty.toLocaleString()} {unit}
            </Text>
        );
    };

    const getStatusColor = () => {
        switch (ticket.status?.toUpperCase()) {
            case 'DRAFTS':
            case 'DRAFT': return isRejected ? 'border-red-500' : 'border-slate-200';
            case 'PENDING_APPROVAL': return 'border-orange-400';
            case 'QUEUED': return 'border-blue-300';
            case 'DISPATCHED':
            case 'IN_TRANSIT': return 'border-blue-600';
            case 'RECEIVED': return 'border-emerald-500';
            case 'RECEIVED_WITH_SHORTAGE': return 'border-red-500';
            default: return 'border-slate-200';
        }
    };

    const getBadgeColor = () => {
        switch (ticket.status?.toUpperCase()) {
            case 'DRAFTS':
            case 'DRAFT': return 'bg-slate-100 text-slate-600';
            case 'PENDING_APPROVAL': return 'bg-orange-100 text-orange-600';
            case 'QUEUED': return 'bg-blue-50 text-blue-500';
            case 'DISPATCHED':
            case 'IN_TRANSIT': return 'bg-blue-100 text-blue-600';
            case 'RECEIVED': return 'bg-emerald-100 text-emerald-600';
            case 'RECEIVED_WITH_SHORTAGE': return 'bg-red-50 text-red-600';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const isReceived = ticket.status?.toUpperCase() === 'RECEIVED';

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className={clsx(
                "bg-white border rounded-[4px] p-4 py-6 mb-3 shadow-sm",
                getStatusColor()
            )}
        >
            {/* Header: Job Name & ID */}
            <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 mr-2">
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest" numberOfLines={1}>
                        {ticket.job_name || 'Project'}
                    </Text>
                    <Text className="text-[16px] font-bold text-blue-600" style={{ fontFamily: 'Inter_700Bold' }}>
                        {ticket.ticket_number}
                    </Text>
                </View>
                <View className="flex-row gap-2 items-center">
                    {onPrint && (
                        <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); onPrint(); }}
                            className="p-1.5 rounded-[4px] bg-slate-50 border border-slate-200"
                            activeOpacity={0.6}
                        >
                            <Printer size={12} color="#64748b" />
                        </TouchableOpacity>
                    )}
                    {ticket.field_modified && ticket.status !== 'RECEIVED_WITH_SHORTAGE' && (
                        <View className="bg-orange-100 px-1.5 py-0.5 rounded-[2px] border border-orange-200">
                            <Text className="text-[8px] font-black text-orange-600 uppercase">MODIFIED</Text>
                        </View>
                    )}
                    {ticket.status?.toUpperCase() === 'RECEIVED_WITH_SHORTAGE' ? (
                        <TouchableOpacity onPress={onShortagePress} className="bg-red-50 px-2 py-1 rounded-[2px] border border-red-200">
                            <Text style={{ color: '#EF4444', fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }}>SHORTAGE DETECTED</Text>
                        </TouchableOpacity>
                    ) : (
                        <View className={clsx("px-1.5 py-0.5 rounded-[2px]", getBadgeColor())}>
                            <Text className="text-[8px] font-black uppercase">{ticket.status}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Body: Material Info */}
            <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-1">
                    <Package size={12} color="#64748b" />
                    <Text className="text-[12px] font-black text-slate-900">
                        {firstItem?.product_code || 'No Items'} {itemCount > 1 ? `(+${itemCount - 1})` : ''}
                    </Text>
                </View>

                {renderDualUnit()}

                {firstItem?.dimensions && (
                    <Text className="text-[12px] font-black text-slate-400 ml-4 uppercase">
                        Dims: {firstItem.dimensions}
                    </Text>
                )}

                {/* Received Logic: Final Verified Qty */}
                {isReceived && (
                    <View className="mt-2 ml-4 flex-row items-center gap-2">
                        <View className="bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                            <Text className="text-[10px] font-black text-emerald-700 uppercase">
                                VERIFIED: {firstItem?.verified_qty?.toLocaleString() || firstItem?.qty?.toLocaleString()} {firstItem?.unit || 'SQFT'}
                            </Text>
                        </View>
                        {(firstItem?.damage_count > 0 || firstItem?.missing_count > 0) && (
                            <View className="bg-red-50 px-2 py-1 rounded border border-red-100">
                                <Text className="text-[10px] font-black text-red-600 uppercase">
                                    DMG/MISS
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Context Info (Super / Truck / Vendor) */}
            <TouchableOpacity
                onPress={onAssign}
                className="flex-row items-center gap-1.5 mb-4 bg-slate-50 p-2 rounded-[2px] border border-slate-100"
            >
                {ticket.status?.toUpperCase() === 'PENDING_APPROVAL' || ticket.status?.toUpperCase() === 'DRAFT' || ticket.status?.toUpperCase() === 'DRAFTS' ? (
                    <>
                        <User size={12} color="#64748b" />
                        <Text className="text-[11px] font-bold text-slate-600">
                            {ticket.assigned_worker_name ? `Assigned: ${ticket.assigned_worker_name}` : 'Click to Assign Supervisor'}
                        </Text>
                    </>
                ) : (
                    <>
                        <Truck size={12} color="#3b82f6" />
                        <Text className="text-[11px] font-black text-blue-600 uppercase">
                            {ticket.destination === 'Vendor Direct' ? 'Vendor Direct' : `Truck: ${ticket.truck_id || 'Pending'}`}
                        </Text>
                    </>
                )}
            </TouchableOpacity>

            {/* Footer: Expected Arrival */}
            <View className="flex-row items-center justify-between pt-3 border-t border-slate-100">
                <View className="flex-row items-center gap-2">
                    <Clock size={12} color="#2563eb" />
                    <View className="flex-row items-center">
                        <Text className="text-[11px] font-black text-blue-600">
                            {ticket.due_time || '07:00 AM'}
                        </Text>
                        <View className="w-1 h-1 rounded-full bg-slate-300 mx-2" />
                        <Text className="text-[11px] font-black text-indigo-600">
                            {formatDisplayDate(ticket.due_date || ticket.requested_date)}
                        </Text>
                    </View>
                </View>
                <View className="bg-slate-50 px-2 py-0.5 rounded-[4px] border border-slate-200">
                    <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Arrival</Text>
                </View>
            </View>

            {/* Rejection Note Overlay - 11pt Status Text */}
            {isRejected && ticket.notes && (
                <View className="mt-3 pt-3 border-t border-red-50">
                    <Text className="text-[9px] font-black text-red-500 uppercase mb-1">Review Notes:</Text>
                    <Text className="text-[11px] text-red-600 font-bold leading-4" numberOfLines={3}>
                        {ticket.notes}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}
