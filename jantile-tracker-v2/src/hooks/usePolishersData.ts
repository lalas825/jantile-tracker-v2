import { useQuery } from '@powersync/react-native';
import { UIWorkerWithLogs, UIJobLog } from '../services/SupabaseService';
import { useMemo } from 'react';

export const usePolishersData = (startDate: string, endDate: string) => {
    // 1. Fetch Workers
    const { data: workers = [] } = useQuery(`
        SELECT * FROM workers 
        WHERE role = 'Marble Polisher' 
        AND status = 'Active' 
        ORDER BY name ASC
    `);

    // 2. Fetch Production Logs for the date range
    const { data: logs = [] } = useQuery(`
        SELECT * FROM production_logs 
        WHERE date >= ? AND date <= ?
        ORDER BY date DESC
    `, [startDate, endDate]);

    // 3. Transform to matching UI types
    const processedData = useMemo(() => {
        const workerMap = new Map<string, UIWorkerWithLogs>();

        // Initialize markers for the roster
        workers.forEach((w: any) => {
            workerMap.set(w.id, {
                id: w.id,
                name: w.name,
                avatar: w.avatar || w.name.substring(0, 2).toUpperCase(),
                logs: [],
                isExpanded: true
            });
        });

        // Map logs to workers
        logs.forEach((log: any) => {
            const worker = workerMap.get(log.worker_id);
            if (worker) {
                const uiLog: UIJobLog = {
                    id: log.id,
                    date: log.date,
                    jobName: log.job_name || '',
                    plNumber: log.pl_number || '',
                    unit: log.unit || '',
                    regHours: log.reg_hours?.toString() || '',
                    otHours: log.ot_hours?.toString() || '',
                    ticketNumber: log.ticket_number || '',
                    isJantile: Boolean(log.is_jantile),
                    isTicket: Boolean(log.is_ticket),
                    statusColor: log.status_color || 'white',
                    notes: log.notes || '',
                    workerId: log.worker_id,
                    jobId: log.job_id
                };
                worker.logs.push(uiLog);
            }
        });

        const activeWorkers = Array.from(workerMap.values());

        // Only return workers who are in the roster
        return activeWorkers;
    }, [workers, logs]);

    return {
        workers: processedData,
        roster: workers.map((w: any) => ({
            id: w.id,
            name: w.name,
            role: w.role,
            status: w.status,
            avatar: w.avatar || w.name.substring(0, 2).toUpperCase(),
            assignedJobIds: w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : []
        })),
        isLoading: false // useQuery provides status but we'll keep it simple
    };
};
