import { Platform } from 'react-native';
import { supabase } from '../../config/supabase';
import { db } from '../../powersync/db';
import * as Crypto from 'expo-crypto';

const useSupabase = Platform.OS === 'web' || (db as any).isMock;

// --- TYPES ---

export interface Worker {
    id: string;
    name: string;
    role: string;
    status: 'Active' | 'Inactive';
    phone?: string;
    email?: string;
    address?: string;
    assigned_job_ids: string[]; // DB usually stores arrays or JSON
    avatar?: string;
}

export interface ProductionLog {
    id: string;
    date: string;
    worker_id: string;
    job_name: string; // Storing name directly for now as per UI, or could be job_id
    pl_number: string;
    unit: string;
    reg_hours: string;
    ot_hours: string;
    ticket_number: string;
    is_jantile: boolean;
    is_ticket: boolean;
    status_color: string;
    notes: string;
}

export interface UICrewMember {
    id: string;
    name: string;
    role: string;
    status: 'Active' | 'Inactive';
    phone?: string;
    email?: string;
    assignedJobIds: string[];
    avatar: string;
}

export interface UIJobLog {
    id: string;
    date: string;
    jobName: string;
    plNumber: string;
    unit: string;
    regHours: string;
    otHours: string;
    ticketNumber: string;
    isJantile: boolean;
    isTicket: boolean;
    statusColor: string;
    notes: string;
    workerId: string;
    jobId?: string; // Explicitly link to Jobs table
}

export interface UIWorkerWithLogs {
    id: string;
    name: string;
    avatar: string;
    logs: UIJobLog[];
    isExpanded: boolean;
}

// --- HELPERS ---

export const getInitials = (name: string) => {
    if (!name) return '??';
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

// Robust manual YYYY-MM-DD formatter to avoid locale-specific issues with string comparisons in the DB
export const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const formatDisplayDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'TBD';
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    return `${m}/${d}/${y}`;
};

// --- CREW SERVICE ---

export const CrewService = {

    // --- WORKERS ---

    async getWorkers(): Promise<UICrewMember[]> {
        if (useSupabase) {
            const { data, error } = await supabase.from('workers').select('*').order('name');
            if (error) throw error;
            return (data || []).map((w: any) => ({
                id: w.id,
                name: w.name,
                role: w.role,
                status: w.status,
                phone: w.phone,
                email: w.email,
                assignedJobIds: Array.isArray(w.assigned_job_ids) ? w.assigned_job_ids : (() => { try { return w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : []; } catch { return []; } })(),
                avatar: w.avatar || getInitials(w.name)
            }));
        }

        const result = await db.getAll(`SELECT * FROM workers ORDER BY name ASC`);

        return result.map((w: any) => ({
            id: w.id,
            name: w.name,
            role: w.role,
            status: w.status,
            phone: w.phone,
            email: w.email,
            assignedJobIds: (() => { try { return w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : []; } catch { return []; } })(),
            avatar: w.avatar || getInitials(w.name)
        }));
    },

    async saveWorker(worker: Partial<UICrewMember>): Promise<void> {
        const id = worker.id || Crypto.randomUUID();
        const now = new Date().toISOString();
        const avatar = worker.avatar || getInitials(worker.name || '');

        if (useSupabase) {
            const payload = {
                id,
                name: worker.name,
                role: worker.role,
                status: worker.status || 'Active',
                phone: worker.phone || null,
                email: worker.email || null,
                avatar: avatar,
                assigned_job_ids: worker.assignedJobIds || [],
                created_at: now
            };

            console.log("[CrewService] Upserting worker to Supabase:", payload);
            const { error, data } = await supabase.from('workers').upsert(payload).select();
            if (error) {
                console.error("[CrewService] Supabase Upsert Error:", error);
                throw error;
            }
            console.log("[CrewService] Supabase Upsert Success:", data);
            return;
        }

        // Native PowerSync
        await db.execute(
            `INSERT OR REPLACE INTO workers (id, name, role, status, phone, email, assigned_job_ids, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                worker.name || null,
                worker.role || null,
                worker.status || 'Active',
                worker.phone || null,
                worker.email || null,
                JSON.stringify(worker.assignedJobIds || []),
                avatar,
                now
            ]
        );
    },

    // --- PRODUCTION LOGS ---

    async getProductionLogs(date: string, endDate?: string): Promise<UIWorkerWithLogs[]> {

        let logs: any[] = [];

        if (useSupabase) {
            // WEB: Direct fetch with manual in-memory join
            const { data: rawLogs, error: logsError } = await supabase
                .from('production_logs')
                .select('*')
                .gte('date', date)
                .lte('date', endDate || date)
                .order('created_at', { ascending: false });

            if (logsError) throw logsError;
            if (!rawLogs || rawLogs.length === 0) return [];

            const workerIds = Array.from(new Set(rawLogs.map((l: any) => l.worker_id).filter(id => !!id)));
            const { data: workersData } = await supabase
                .from('workers')
                .select('id, name, avatar')
                .in('id', workerIds);

            const workerMap = new Map((workersData || []).map((w: any) => [w.id, w]));
            logs = rawLogs.map((l: any) => ({
                ...l,
                workers: workerMap.get(l.worker_id) || { id: l.worker_id, name: 'Unknown Worker', avatar: '' }
            }));
        } else {
            // NATIVE: PowerSync handled via raw SQL join
            let sql = `
                SELECT pl.*, w.name as worker_name, w.avatar as worker_avatar
                FROM production_logs pl
                LEFT JOIN workers w ON pl.worker_id = w.id
                WHERE pl.date >= ? AND pl.date <= ?
                ORDER BY pl.date DESC
             `;

            const end = endDate || date;
            const result = await db.getAll(sql, [date, end]);
            logs = result.map((l: any) => ({
                ...l,
                workers: { id: l.worker_id, name: l.worker_name, avatar: l.worker_avatar }
            }));
        }

        if (!logs || logs.length === 0) return [];

        // 2. Group by Worker
        const workerMap = new Map<string, UIWorkerWithLogs>();

        logs.forEach((log: any) => {
            const worker = log.workers || { id: log.worker_id, name: 'Unknown Worker', avatar: '' };

            if (!workerMap.has(worker.id)) {
                workerMap.set(worker.id, {
                    id: worker.id,
                    name: worker.name || 'Unknown Worker',
                    avatar: worker.avatar || getInitials(worker.name || 'UW'),
                    logs: [],
                    isExpanded: true
                });
            }

            const uiLog: UIJobLog = {
                id: log.id,
                date: log.date,
                jobName: log.job_name,
                plNumber: log.pl_number || '',
                unit: log.unit || '',
                regHours: log.reg_hours?.toString() || '',
                otHours: log.ot_hours?.toString() || '',
                ticketNumber: log.ticket_number || '',
                isJantile: Boolean(log.is_jantile), // SQLite might return 0/1
                isTicket: Boolean(log.is_ticket),
                statusColor: log.status_color || 'white',
                notes: log.notes || '',
                workerId: worker.id,
                jobId: log.job_id
            };

            workerMap.get(worker.id)?.logs.push(uiLog);
        });

        return Array.from(workerMap.values());
    },

    async upsertLog(logId: string, date: Date, workerId: string, field: string | Record<string, any>, value?: any, _retried?: boolean): Promise<any> {
        const dateStr = formatDate(date);
        const useSupabase = Platform.OS === 'web' || (db as any).isMock;

        // Core field-to-column mapper to ensure consistency between Web and Native
        const getMapping = (f: string, v: any) => {
            let colName = '';
            let colVal = v;
            switch (f) {
                case 'job': case 'job_id': case 'jobId':
                    colName = 'job_id';
                    colVal = (v === '' || v === 'null' || v === null) ? null : v;
                    break;
                case 'job_name': case 'jobName':
                    colName = 'job_name';
                    break;
                case 'pl': case 'plNumber': case 'pl_number':
                    colName = 'pl_number';
                    break;
                case 'unit':
                    colName = 'unit';
                    break;
                case 'reg': case 'regHours': case 'reg_hours':
                    colName = 'reg_hours';
                    colVal = v?.toString() || '0';
                    break;
                case 'ot': case 'otHours': case 'ot_hours':
                    colName = 'ot_hours';
                    colVal = v?.toString() || '0';
                    break;
                case 'tkt': case 'ticketNumber': case 'ticket_number':
                    colName = 'ticket_number';
                    break;
                case 'isTkt': case 'isTicket': case 'is_ticket':
                    colName = 'is_ticket';
                    colVal = (v === true || v === 1) ? 1 : 0;
                    break;
                case 'isJan': case 'isJantile': case 'is_jantile':
                    colName = 'is_jantile';
                    colVal = (v === true || v === 1) ? 1 : 0;
                    break;
                case 'status': case 'statusColor': case 'status_color':
                    colName = 'status_color';
                    break;
                case 'notes':
                    colName = 'notes';
                    break;
            }
            return { colName, colVal };
        };

        // Prepare the payload for both platforms
        const finalUpdates: Record<string, any> = {};
        if (typeof field === 'string') {
            const { colName, colVal } = getMapping(field, value);
            if (colName) finalUpdates[colName] = colVal;
            else if (!['id', 'worker_id', 'date'].includes(field)) {
                console.log(`[upsertLog] Ignored invalid field: ${field}`);
                return;
            }
        } else {
            for (const [key, val] of Object.entries(field)) {
                const { colName, colVal } = getMapping(key, val);
                if (colName) finalUpdates[colName] = colVal;
            }
        }

        console.log(`[upsertLog] Atomic Sync:`, finalUpdates);

        if (useSupabase) {
            const payload = { id: logId, date: dateStr, worker_id: workerId, ...finalUpdates };
            const { error } = await supabase.from('production_logs').upsert(payload);
            if (error) {
                console.error('Supabase Upsert Error:', error);
                throw error;
            }
            return;
        }

        try {
            // NATIVE: Atomic Update/Insert via PowerSync
            const updateCols = ['date = ?', 'worker_id = ?'];
            const updateParams = [dateStr, workerId];
            for (const [col, val] of Object.entries(finalUpdates)) {
                updateCols.push(`${col} = ?`);
                updateParams.push(val);
            }
            updateParams.push(logId);

            const result = await db.execute(
                `UPDATE production_logs SET ${updateCols.join(', ')} WHERE id = ?`,
                updateParams
            );

            if (result.rowsAffected === 0) {
                const insertCols = ['id', 'date', 'worker_id', ...Object.keys(finalUpdates)];
                const placeholders = ['?', '?', '?', ...Object.keys(finalUpdates).map(() => '?')];
                const insertParams = [logId, dateStr, workerId, ...Object.values(finalUpdates)];
                await db.execute(
                    `INSERT INTO production_logs (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`,
                    insertParams
                );
            }
        } catch (e: any) {
            // Handle race conditions or schema version mismatches
            if (e.message?.includes('no such column: status_color') && !_retried) {
                await db.execute('ALTER TABLE production_logs ADD COLUMN status_color TEXT');
                return await CrewService.upsertLog(logId, date, workerId, field, value, true);
            }
            if (e.message?.includes('UNIQUE constraint failed')) {
                const retryParams = [];
                const retryCols = Object.entries(finalUpdates).map(([col, val]) => {
                    retryParams.push(val);
                    return `${col} = ?`;
                });
                if (retryCols.length > 0) {
                    retryParams.push(logId);
                    await db.execute(`UPDATE production_logs SET ${retryCols.join(', ')} WHERE id = ?`, retryParams);
                }
                return;
            }
            throw e;
        }
    },

    deleteLog: async (logId: string): Promise<void> => {
        if (useSupabase) {
            const { error } = await supabase.from('production_logs').delete().eq('id', logId);
            if (error) throw error;
            return;
        }

        try {
            await db.execute('DELETE FROM production_logs WHERE id = ?', [logId]);
        } catch (error) {
            console.error("Error deleting log:", error);
            throw error;
        }
    },
};
