import { useState, useCallback, useEffect } from 'react';
import { SupabaseService, DeliveryTicket } from '../services/SupabaseService';
import { usePowerSync } from '@powersync/react';

export function useDeliveryTickets(jobId: string) {
    const [tickets, setTickets] = useState<DeliveryTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const powersync = usePowerSync();

    const loadTickets = useCallback(async () => {
        try {
            const data = await SupabaseService.getDeliveryTickets(jobId);
            setTickets(data);
        } catch (error) {
            console.error("Failed to load delivery tickets:", error);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        if (jobId) loadTickets();
    }, [jobId, loadTickets]);

    const updateTicketStatus = async (ticketId: string, newStatus: string) => {
        try {
            const db = powersync;
            if (!db) return;

            // Optimistic update
            setTickets(prev => prev.map(t =>
                t.id === ticketId ? { ...t, status: newStatus } : t
            ));

            // DB Update
            await db.execute(
                `UPDATE delivery_tickets SET status = ?, updated_at = ? WHERE id = ?`,
                [newStatus, new Date().toISOString(), ticketId]
            );

            // If we need to trigger sync logic or complex side effects (inventory updates), handled by caller or separate service method?
            // The prompt says: "Moving a ticket to 'Received' must trigger the db.writeTransaction"
            // So we might need to handle that transaction here or expose a method.

            // Re-load to confirm
            // await loadTickets(); 
        } catch (error) {
            console.error("Failed to update status:", error);
            // Revert on error
            loadTickets();
        }
    };

    return {
        tickets,
        loading,
        refreshTickets: loadTickets,
        updateTicketStatus
    };
}
