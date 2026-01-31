import { usePowerSync, useQuery } from '@powersync/react';
import { useMemo, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { SupabaseService, UIWorkerWithLogs, UIJobLog, getInitials } from '../services/SupabaseService';

export const usePolishersData = (startDate: string, endDate: string) => {
    // WEB STATE
    const [webWorkers, setWebWorkers] = useState<any[]>([]);
    const [webLogs, setWebLogs] = useState<UIWorkerWithLogs[]>([]); // We might need raw logs or pre-processed
    // Actually SupabaseService.getProductionLogs returns UIWorkerWithLogs[] (grouped), 
    // but here we want to mix Workers + Logs. The hook logic below merges them.
    // Let's fetch raw logs-like structure or just reuse the Service logic?
    // The Service returns GROUPED logs.
    // The existing hook fetches RAW workers and RAW logs and merges them.
    // To match, we should probably fetch RAW on web too?
    // Or just let SupabaseService do the heavy lifting if possible?
    // SupabaseService.getProductionLogs returns `UIWorkerWithLogs[]` which IS the merged structure for logs.
    // BUT we also need ALL workers (even those without logs) for the roster?
    // The hook returns `workers` (merged) and `roster` (list of all workers).

    // Simpler plan for Web:
    // 1. Fetch All Workers.
    // 2. Fetch Logs (Grouped or Raw).
    // Let's use the Service methods we fixed.

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const fetchData = async () => {
            // Fetch Workers
            const w = await SupabaseService.getWorkers();
            setWebWorkers(w);

            // Fetch Logs (Service returns grouped by worker)
            // But we need to merge this with the "All Workers" list to create the full view.
            // The Service `getProductionLogs` returns ONLY workers who have logs? 
            // Let's check `getProductionLogs` implementation... 
            // It selects `production_logs` and joins `workers`. So yes, only workers with logs.
            // We need to merge that with `webWorkers`.

            const logsGrouped = await SupabaseService.getProductionLogs(startDate, endDate);
            setWebLogs(logsGrouped);
        };

        fetchData();
    }, [startDate, endDate]);


    // NATIVE QUERIES (Running conditionally? No, hooks must run. But we can skip valid query if web)
    // If Web, we pass empty SQL or ignore result?
    // useQuery throws if context missing?
    // We'll trust the Mock Context on Web to return empty [] without crashing if the query is valid SQL.

    const { data: workersData, isLoading: workersLoading } = useQuery(
        Platform.OS === 'web' ? 'SELECT 1 WHERE 0' :
            `SELECT * FROM workers 
         WHERE LOWER(role) LIKE '%marble polisher%' 
         AND LOWER(status) = 'active' 
         ORDER BY name ASC`
    );

    const { data: logsData, isLoading: logsLoading } = useQuery(
        Platform.OS === 'web' ? 'SELECT 1 WHERE 0' :
            `SELECT * FROM production_logs 
         WHERE date >= ? AND date <= ?
         ORDER BY date DESC`,
        [startDate, endDate]
    );

    // MERGE LOGIC
    const processedData = useMemo(() => {
        if (Platform.OS === 'web') {
            // Merge webWorkers and webLogs
            // content of webLogs is UIWorkerWithLogs[] (which contains logs).
            // content of webWorkers is UICrewMember[]

            const map = new Map<string, UIWorkerWithLogs>();

            // 1. Init with valid workers
            webWorkers.forEach(w => {
                if (w.role?.toLowerCase().includes('marble polisher') && w.status?.toLowerCase() === 'active') {
                    map.set(w.id, {
                        id: w.id,
                        name: w.name,
                        avatar: w.avatar || getInitials(w.name),
                        logs: [],
                        isExpanded: true
                    });
                }
            });

            // 2. Merge logs
            webLogs.forEach(wl => {
                if (map.has(wl.id)) {
                    const existing = map.get(wl.id)!;
                    existing.logs = wl.logs; // Replace with fetched logs
                } else {
                    // Log for worker not in active list? Maybe inactive worker? 
                    // Add them anyway?
                    map.set(wl.id, wl);
                }
            });

            return Array.from(map.values());
        }

        // NATIVE LOGIC
        const workers = workersData || [];
        const logs = logsData || [];

        const workerMap = new Map<string, UIWorkerWithLogs>();

        // 1. Initialize markers
        workers.forEach((w: any) => {
            workerMap.set(w.id, {
                id: w.id,
                name: w.name,
                avatar: w.avatar || w.name.substring(0, 2).toUpperCase(),
                logs: [],
                isExpanded: true
            });
        });

        // 2. Map logs
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

        return Array.from(workerMap.values());
    }, [workersData, logsData, webWorkers, webLogs]);

    // ROSTER
    const roster = useMemo(() => {
        if (Platform.OS === 'web') {
            return webWorkers.filter(w => w.role?.toLowerCase().includes('marble polisher') && w.status?.toLowerCase() === 'active');
        }
        return (workersData || []).map((w: any) => ({
            id: w.id,
            name: w.name,
            role: w.role,
            status: w.status,
            avatar: w.avatar || w.name.substring(0, 2).toUpperCase(),
            assignedJobIds: w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : []
        }));
    }, [workersData, webWorkers]);

    return {
        workers: processedData,
        roster: roster,
        isLoading: workersLoading || logsLoading
    };
};