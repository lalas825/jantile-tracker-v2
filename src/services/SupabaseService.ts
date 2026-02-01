import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { db } from '../powersync/db';
import { randomUUID } from 'expo-crypto';
import { OfflinePhotoService } from './OfflinePhotoService';
import { CHECKLIST_PRESETS } from '../constants/JobTemplates';

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

export interface Job {
    id: string;
    name: string;
    status?: string;
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

// UI Types (Mapped)
export interface UICrewMember {
    id: string;
    name: string;
    role: string;
    status: 'Active' | 'Inactive';
    phone?: string;
    email?: string;
    address?: string;
    assignedJobIds: string[];
    avatar: string;
}

export const getInitials = (name: string) => {
    if (!name) return '??';
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

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

// Fix: Use "en-CA" (Canadian format) which forces YYYY-MM-DD in LOCAL time.
// This solves the 5-hour UTC offset bug.
export const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-CA');
};

// Helper to determine if we should use Supabase directly
// (Web platform or mock DB in Expo Go)
const useSupabase = Platform.OS === 'web' || (db as any).isMock;

export const SupabaseService = {

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
                address: w.address,
                assignedJobIds: w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : [],
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
            address: w.address,
            assignedJobIds: w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : [],
            avatar: w.avatar || getInitials(w.name)
        }));
    },

    async saveWorker(worker: Partial<UICrewMember>): Promise<void> {
        if (useSupabase) {
            const { error } = await supabase.from('workers').upsert({
                id: worker.id,
                name: worker.name,
                role: worker.role,
                status: worker.status || 'Active',
                phone: worker.phone,
                email: worker.email,
                address: worker.address,
                avatar: worker.avatar,
                assigned_job_ids: JSON.stringify(worker.assignedJobIds || [])
            });
            if (error) throw error;
            return;
        }

        // Construct simplified worker object for DB
        // We use INSERT OR REPLACE for upsert behavior
        const id = worker.id || randomUUID(); // Should always have ID but safety first

        await db.execute(
            `INSERT OR REPLACE INTO workers (id, name, role, status, phone, email, address, assigned_job_ids, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                worker.name || null,
                worker.role || null,
                worker.status || 'Active',
                worker.phone || null,
                worker.email || null,
                worker.address || null,
                JSON.stringify(worker.assignedJobIds || []), // Store array as JSON
                worker.avatar || null
            ]
        );
    },

    // --- JOBS ---

    async createJob(job: any): Promise<void> {
        if (useSupabase) {
            const { error } = await supabase.from('jobs').insert(job);
            if (error) throw error;
            return;
        }

        const id = job.id || randomUUID();
        await db.execute(
            `INSERT INTO jobs (id, name, status, address, general_contractor) VALUES (?, ?, ?, ?, ?)`,
            [id, job.name, job.status || 'active', job.address, job.general_contractor]
        );
    },

    async getActiveJobs(): Promise<any[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('jobs')
                .select(`
                    id, name, status, address, general_contractor,
                    floors (
                        id, name,
                        units (
                            id, name,
                            areas (
                                id, name, progress
                            )
                        )
                    )
                `)
                .ilike('status', 'active')
                .order('name');
            if (error) throw error;
            return data || [];
        }

        // READ from Local DB (Native PowerSync)
        // Since PowerSync is SQL, we need to fetch the hierarchy manually or join
        // For the Projects list, we'll fetch jobs and then join floors/units/areas for each
        const jobs = await db.getAll(
            `SELECT * FROM jobs WHERE LOWER(status) = 'active' ORDER BY name ASC`
        );

        const fullJobs = await Promise.all(jobs.map(async (job: any) => {
            const floors = await db.getAll(`SELECT * FROM floors WHERE job_id = ?`, [job.id]);
            const floorsWithUnits = await Promise.all(floors.map(async (floor: any) => {
                const units = await db.getAll(`SELECT * FROM units WHERE floor_id = ?`, [floor.id]);
                const unitsWithAreas = await Promise.all(units.map(async (unit: any) => {
                    const areas = await db.getAll(`SELECT * FROM areas WHERE unit_id = ?`, [unit.id]);
                    return { ...unit, areas };
                }));
                return { ...floor, units: unitsWithAreas };
            }));
            return { ...job, floors: floorsWithUnits };
        }));

        return fullJobs;
    },

    async updateJob(id: string, updates: any) {
        if (useSupabase) {
            const { error } = await supabase.from('jobs').update(updates).eq('id', id);
            if (error) throw error;
            return;
        }

        let query = `UPDATE jobs SET `;
        const params = [];
        const clauses = [];

        if (updates.name !== undefined) { clauses.push(`name = ?`); params.push(updates.name); }
        if (updates.status !== undefined) { clauses.push(`status = ?`); params.push(updates.status); }
        if (updates.address !== undefined) { clauses.push(`address = ?`); params.push(updates.address); }
        if (updates.general_contractor !== undefined) { clauses.push(`general_contractor = ?`); params.push(updates.general_contractor); } // Ensure schema has this!

        if (clauses.length === 0) return;
        query += clauses.join(', ') + ` WHERE id = ?`;
        params.push(id);

        await db.execute(query, params);
    },

    async deleteJob(id: string) {
        if (useSupabase) {
            const { error } = await supabase.from('jobs').delete().eq('id', id);
            if (error) throw error;
            return;
        }
        await db.execute(`DELETE FROM jobs WHERE id = ?`, [id]);
    },

    async getJob(id: string): Promise<Job | null> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('jobs')
                .select(`
                id, name, status, address, general_contractor,
                floors (
                    id, name, description,
                    units (
                        id, name, description,
                        areas (
                            id, name, description, status, progress,
                            area_photos (
                                id, url, storage_path
                            )
                        )
                    )
                )
            `)
                .eq('id', id)
                .single();

            if (error) {
                console.error("Error fetching job:", error);
                return null;
            }

            // Sort logic if needed
            if (data && data.floors) {
                data.floors.sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                data.floors.forEach((floor: any) => {
                    if (floor.units) {
                        floor.units.sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                        floor.units.forEach((unit: any) => {
                            if (unit.areas) {
                                unit.areas.sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                            }
                        });
                    }
                });
            }
            return data;
        }

        try {
            // OFFLINE-FIRST READ
            const jobsRequest = db.getAll(`SELECT * FROM jobs WHERE id = ?`, [id]);
            const floorsRequest = db.getAll(`SELECT * FROM floors WHERE job_id = ? ORDER BY name ASC`, [id]);

            const [jobs, floors] = await Promise.all([jobsRequest, floorsRequest]);

            if (jobs.length === 0) return null;
            const job = jobs[0] as any;

            // Fetch Units
            const floorIds = floors.map((f: any) => f.id);
            let units: any[] = [];
            if (floorIds.length > 0) {
                const placeholders = floorIds.map(() => '?').join(',');
                units = await db.getAll(`SELECT * FROM units WHERE floor_id IN (${placeholders}) ORDER BY name ASC`, floorIds);
            }

            // Fetch Areas
            const unitIds = units.map((u: any) => u.id);
            let areas: any[] = [];
            if (unitIds.length > 0) {
                const placeholders = unitIds.map(() => '?').join(',');
                areas = await db.getAll(`SELECT * FROM areas WHERE unit_id IN (${placeholders}) ORDER BY name ASC`, unitIds);
            }

            // Fetch Photos (Synced)
            const areaIds = areas.map((a: any) => a.id);
            let photos: any[] = [];
            let offlinePhotos: any[] = [];

            if (areaIds.length > 0) {
                const placeholders = areaIds.map(() => '?').join(',');
                // Synced photos
                photos = await db.getAll(`SELECT * FROM area_photos WHERE area_id IN (${placeholders})`, areaIds);
                // Offline queued photos
                offlinePhotos = await db.getAll(`SELECT * FROM offline_photos WHERE area_id IN (${placeholders})`, areaIds);
            }

            // --- REASSEMBLE TREE ---

            // Map Photos to Areas
            const photosByArea = new Map<string, any[]>();
            [...photos, ...offlinePhotos].forEach((p: any) => {
                // For offline photos, map local_uri to url for UI
                const uiPhoto = {
                    id: p.id,
                    url: p.url || p.local_uri, // Fallback to local_uri
                    storage_path: p.storage_path || p.filename
                };

                if (!photosByArea.has(p.area_id)) photosByArea.set(p.area_id, []);
                photosByArea.get(p.area_id)?.push(uiPhoto);
            });

            // Map Areas to Units
            const areasByUnit = new Map<string, any[]>();
            areas.forEach((area: any) => {
                const areaWithPhotos = {
                    ...area,
                    area_photos: photosByArea.get(area.id) || []
                };
                if (!areasByUnit.has(area.unit_id)) areasByUnit.set(area.unit_id, []);
                areasByUnit.get(area.unit_id)?.push(areaWithPhotos);
            });

            // Map Units to Floors
            const unitsByFloor = new Map<string, any[]>();
            units.forEach((unit: any) => {
                const unitWithAreas = {
                    ...unit,
                    areas: areasByUnit.get(unit.id) || []
                };
                if (!unitsByFloor.has(unit.floor_id)) unitsByFloor.set(unit.floor_id, []);
                unitsByFloor.get(unit.floor_id)?.push(unitWithAreas);
            });

            // Attach to Floors
            const floorsWithUnits = floors.map((floor: any) => ({
                ...floor,
                units: unitsByFloor.get(floor.id) || []
            }));

            return {
                ...job,
                floors: floorsWithUnits
            };

        } catch (error) {
            console.error("Error fetching job offline:", error);
            return null;
        }
    },

    // --- STRUCTURE MUTATIONS ---

    // --- STRUCTURE MUTATIONS ---

    async addFloor(jobId: string, name: string) {
        if (useSupabase) {
            const { error } = await supabase.from('floors').insert({
                job_id: jobId,
                name: name
            });
            if (error) throw error;
            return;
        }

        const id = randomUUID();
        await db.execute(
            `INSERT INTO floors (id, job_id, name, created_at) VALUES (?, ?, ?, datetime('now'))`,
            [id, jobId, name]
        );
    },

    async deleteFloor(floorId: string) {
        if (useSupabase) {
            const { error } = await supabase.from('floors').delete().eq('id', floorId);
            if (error) throw error;
            return;
        }
        await db.execute(`DELETE FROM floors WHERE id = ?`, [floorId]);
    },

    async updateFloorName(floorId: string, name: string, description: string = '') {
        if (useSupabase) {
            const { error } = await supabase.from('floors').update({ name, description }).eq('id', floorId);
            if (error) throw error;
            return;
        }
        await db.execute(
            `UPDATE floors SET name = ?, description = ? WHERE id = ?`,
            [name, description, floorId]
        );
    },

    async addUnit(floorId: string, name: string) {
        if (useSupabase) {
            const { error } = await supabase.from('units').insert({
                floor_id: floorId,
                name: name
            });
            if (error) throw error;
            return;
        }

        const id = randomUUID();
        await db.execute(
            `INSERT INTO units (id, floor_id, name, created_at) VALUES (?, ?, ?, datetime('now'))`,
            [id, floorId, name]
        );
    },

    async deleteUnit(unitId: string) {
        if (useSupabase) {
            const { error } = await supabase.from('units').delete().eq('id', unitId);
            if (error) throw error;
            return;
        }
        await db.execute(`DELETE FROM units WHERE id = ?`, [unitId]);
    },

    async addArea(unitId: string, name: string, description: string = '') {
        // 2. Determine Preset
        const areaNameLower = name.toLowerCase();
        let preset = CHECKLIST_PRESETS[areaNameLower];

        if (!preset) {
            if (areaNameLower.includes('bathroom') || areaNameLower.includes('bath')) preset = CHECKLIST_PRESETS['master bathroom'];
            else if (areaNameLower.includes('kitchen')) preset = CHECKLIST_PRESETS['kitchen'];
            else if (areaNameLower.includes('powder')) preset = CHECKLIST_PRESETS['powder room'];
            else if (areaNameLower.includes('laundry')) preset = CHECKLIST_PRESETS['laundry'];
            else preset = CHECKLIST_PRESETS['master bathroom'];
        }

        if (useSupabase) {
            // 1. Insert Area
            const { data: newArea, error: areaError } = await supabase
                .from('areas')
                .insert({
                    unit_id: unitId,
                    name: name,
                    description: description,
                    status: 'NOT_STARTED',
                    progress: 0
                })
                .select()
                .single();

            if (areaError) throw areaError;

            // 3. Insert Items
            if (preset && preset.length > 0) {
                const items = preset.map(text => ({
                    area_id: newArea.id,
                    text: text,
                    completed: 0,
                    status: 'NOT_STARTED'
                }));
                const { error: itemsError } = await supabase.from('checklist_items').insert(items);
                if (itemsError) throw itemsError;
            }
            return;
        }

        // 1. Insert Area
        const areaId = randomUUID();
        await db.execute(
            `INSERT INTO areas (id, unit_id, name, description, status, progress, created_at) VALUES (?, ?, ?, ?, 'NOT_STARTED', 0, datetime('now'))`,
            [areaId, unitId, name, description]
        );

        // 3. Insert Items
        if (preset && preset.length > 0) {
            // Build bulk insert query
            // We use datetime('now', '+X.X seconds') to ensure unique timestamps for sorting
            const placeholders = preset.map((_, i) => `(?, ?, ?, ?, 'NOT_STARTED', datetime('now', '+${i * 0.01} seconds'))`).join(', ');
            const values: any[] = [];
            preset.forEach(text => {
                values.push(randomUUID(), areaId, text, 0);
            });

            await db.execute(
                `INSERT INTO checklist_items (id, area_id, text, completed, status, created_at) VALUES ${placeholders}`,
                values
            );
        }
    },

    async updateArea(areaId: string, updates: any) {
        if (useSupabase) {
            const { error } = await supabase.from('areas').update(updates).eq('id', areaId);
            if (error) throw error;
            return;
        }

        // Assuming simple updates
        // To strictly handle updates object dynamically in a reusable way helper function is best, 
        // but for now inline simple implementation
        let query = `UPDATE areas SET `;
        const params = [];
        const clauses = [];

        if (updates.name !== undefined) { clauses.push(`name = ?`); params.push(updates.name); }
        if (updates.status !== undefined) { clauses.push(`status = ?`); params.push(updates.status); }
        if (updates.progress !== undefined) { clauses.push(`progress = ?`); params.push(updates.progress); }
        if (updates.description !== undefined) { clauses.push(`description = ?`); params.push(updates.description); }

        if (clauses.length === 0) return;
        query += clauses.join(', ') + ` WHERE id = ?`;
        params.push(areaId);

        await db.execute(query, params);
    },

    async deleteArea(areaId: string) {
        if (useSupabase) {
            const { error } = await supabase.from('areas').delete().eq('id', areaId);
            if (error) throw error;
            return;
        }
        await db.execute(`DELETE FROM areas WHERE id = ?`, [areaId]);
    },

    // --- PRODUCTION LOGS ---

    async getProductionLogs(date: string, endDate?: string): Promise<UIWorkerWithLogs[]> {

        let logs: any[] = [];

        if (useSupabase) {
            // 1. Get logs for the date or range via Supabase SDK
            let query = supabase
                .from('production_logs')
                .select(`
                *,
                workers(
                    id,
                    name,
                    avatar
                )
                    `);

            if (endDate && endDate !== date) {
                query = query.gte('date', date).lte('date', endDate);
            } else {
                query = query.eq('date', date);
            }

            const { data, error } = await query;
            if (error) {
                console.error("Error fetching logs:", error);
                throw error;
            }
            logs = data || [];
        } else {
            // Native / PowerSync
            // We need to JOIN manually or use a VIEW. PowerSync supports basic joins.
            // "workers" table is available.

            let sql = `
                SELECT pl.*, w.name as worker_name, w.avatar as worker_avatar 
                FROM production_logs pl 
                LEFT JOIN workers w ON pl.worker_id = w.id 
                WHERE pl.date >= ? AND pl.date <= ? 
                ORDER BY pl.date DESC
             `;

            const end = endDate || date;
            logs = await db.getAll(sql, [date, end]);

            // Transform native result to match Supabase structure for grouping logic below
            logs = logs.map(l => ({
                ...l,
                workers: {
                    id: l.worker_id,
                    name: l.worker_name,
                    avatar: l.worker_avatar
                }
            }));
        }

        if (!logs || logs.length === 0) return [];

        // 2. Group by Worker
        const workerMap = new Map<string, UIWorkerWithLogs>();

        logs.forEach((log: any) => {
            const worker = log.workers;
            if (!worker) return; // Should not happen if integrity is maintained

            if (!workerMap.has(worker.id)) {
                workerMap.set(worker.id, {
                    id: worker.id,
                    name: worker.name,
                    avatar: worker.avatar || getInitials(worker.name),
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

    async upsertLog(logId: string, date: Date, workerId: string, field: string, value: any) {
        const dateStr = formatDate(date);

        let colName = '';
        let colVal = value;

        switch (field) {
            case 'job': case 'job_id': case 'jobId':
                colName = 'job_id';
                colVal = (value === '' || value === 'null') ? null : value;
                break;
            case 'pl': case 'plNumber': case 'pl_number':
                colName = 'pl_number';
                break;
            case 'job_name': case 'jobName':
                colName = 'job_name';
                break;
            case 'unit':
                colName = 'unit';
                break;
            case 'reg': case 'regHours': case 'reg_hours':
                colName = 'reg_hours';
                colVal = parseFloat(value) || 0;
                break;
            case 'ot': case 'otHours': case 'ot_hours':
                colName = 'ot_hours';
                colVal = parseFloat(value) || 0;
                break;
            case 'tkt': case 'ticketNumber': case 'ticket_number':
                colName = 'ticket_number';
                break;
            case 'isTkt': case 'isTicket': case 'is_ticket':
                colName = 'is_ticket';
                colVal = value === true ? 1 : 0;
                break;
            case 'isJan': case 'isJantile': case 'is_jantile':
                colName = 'is_jantile';
                colVal = value === true ? 1 : 0;
                break;
            case 'status': case 'statusColor': case 'status_color':
                colName = 'status_color';
                break;
            case 'notes':
                colName = 'notes';
                break;
            default:
                if (['id', 'worker_id', 'date'].includes(field)) {
                    // Just identity fields, ensure row exists below
                } else {
                    console.log(`Ignored invalid field: ${field}`);
                    return;
                }
        }

        if (useSupabase) {
            const updates: any = {
                id: logId,
                date: dateStr,
                worker_id: workerId
            };

            // job_name is now available in schema
            if (colName) updates[colName] = colVal;

            const { error } = await supabase.from('production_logs').upsert(updates);
            if (error) {
                console.error('Supabase Upsert Error:', error);
            }
            return;
        }

        try {
            // 1. Try Update first (Safer for PowerSync views than REPLACE)
            const updateCols = ['date = ?', 'worker_id = ?'];
            const updateParams = [dateStr, workerId];
            if (colName) {
                updateCols.push(`${colName} = ?`);
                updateParams.push(colVal);
            }
            updateParams.push(logId);

            const result = await db.execute(
                `UPDATE production_logs SET ${updateCols.join(', ')} WHERE id = ?`,
                updateParams
            );

            // 2. If nothing updated, try Insert
            if (result.rowsAffected === 0) {
                const insertCols = ['id', 'date', 'worker_id'];
                const insertVals = ['?', '?', '?'];
                const insertParams = [logId, dateStr, workerId];
                if (colName) {
                    insertCols.push(colName);
                    insertVals.push('?');
                    insertParams.push(colVal);
                }
                const sql = `INSERT INTO production_logs (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`;
                await db.execute(sql, insertParams);
            }

            console.log(`Successfully saved ${field} for log ${logId}`);
        } catch (e: any) {
            // 3. Final catch for race conditions (row created between Update and Insert)
            if (e.message?.includes('UNIQUE constraint failed')) {
                if (colName) {
                    await db.execute(
                        `UPDATE production_logs SET ${colName} = ? WHERE id = ?`,
                        [colVal, logId]
                    );
                }
                return;
            }
            console.error(`Local Save Error (${field}):`, e);
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

    // --- CHECKLIST MANAGEMENT ---
    // --- CHECKLIST MANAGEMENT ---
    getChecklistItems: async (areaId: string) => {
        if (useSupabase) {
            const { data, error } = await supabase.from('checklist_items').select('*').eq('area_id', areaId).order('created_at', { ascending: true }); // Assuming created_at exists or sorting by something else
            if (error) throw error;
            return data || [];
        }

        // Use PowerSync for implicit offline support
        // Sort by created_at to match web order
        const result = await db.getAll(
            `SELECT * FROM checklist_items WHERE area_id = ? ORDER BY created_at ASC`,
            [areaId]
        );
        return result || [];
    },

    addChecklistItem: async (areaId: string, text: string) => {
        if (useSupabase) {
            const { error } = await supabase.from('checklist_items').insert({
                area_id: areaId,
                text: text,
                completed: 0,
                status: 'NOT_STARTED'
            });
            if (error) throw error;
            return;
        }

        const id = randomUUID();
        await db.execute(
            `INSERT INTO checklist_items (id, area_id, text, completed, status, created_at) VALUES (?, ?, ?, 0, 'NOT_STARTED', datetime('now'))`,
            [id, areaId, text]
        );
    },

    updateChecklistItem: async (itemId: string, updates: any) => {
        if (useSupabase) {
            const up: any = {};
            if (updates.text !== undefined) up.text = updates.text;
            if (updates.status !== undefined) {
                up.status = updates.status;
                up.completed = updates.status === 'COMPLETED' ? 1 : 0;
            }
            if (Object.keys(up).length === 0) return;

            const { error } = await supabase.from('checklist_items').update(up).eq('id', itemId);
            if (error) throw error;
            return;
        }

        let completed = updates.completed;
        if (updates.status !== undefined && completed === undefined) {
            completed = updates.status === 'COMPLETED' ? 1 : 0;
        }

        let query = `UPDATE checklist_items SET `;
        let params = [];
        const clauses = [];

        if (updates.text !== undefined) { clauses.push(`text = ?`); params.push(updates.text); }
        if (updates.status !== undefined) { clauses.push(`status = ?`); params.push(updates.status); }
        if (completed !== undefined) { clauses.push(`completed = ?`); params.push(completed); }

        if (clauses.length === 0) return;

        query += clauses.join(', ') + ` WHERE id = ?`;
        params.push(itemId);

        await db.execute(query, params);
    },

    deleteChecklistItem: async (itemId: string) => {
        if (useSupabase) {
            const { error } = await supabase.from('checklist_items').delete().eq('id', itemId);
            if (error) throw error;
            return;
        }
        await db.execute(`DELETE FROM checklist_items WHERE id = ?`, [itemId]);
    },


    async updateUnitName(unitId: string, name: string, description: string = '') {
        if (useSupabase) {
            const { error } = await supabase.from('units').update({ name, description }).eq('id', unitId);
            if (error) throw error;
            return;
        }
        await db.execute(
            `UPDATE units SET name = ?, description = ? WHERE id = ?`,
            [name, description, unitId]
        );
    },

    // --- PHOTO MANAGEMENT ---

    async uploadAreaPhoto(areaId: string, uri: string) {
        if (useSupabase) {
            // WEB / DIRECT UPLOAD
            try {
                // Read as buffer for consistency
                const response = await fetch(uri);
                const blob = await response.blob();
                const filename = `${randomUUID()}.jpg`;
                const storagePath = `photos/${areaId}/${filename}`;

                // 2. Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('area-photos')
                    .upload(storagePath, blob, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // 3. Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('area-photos')
                    .getPublicUrl(storagePath);

                // 4. Save Record to DB
                // Even on Web, we should record it so it's visible to others
                const { error: dbError } = await supabase
                    .from('area_photos')
                    .insert({
                        area_id: areaId,
                        url: publicUrl,
                        storage_path: storagePath
                    });

                if (dbError) throw dbError;

                return { url: publicUrl, storage_path: storagePath };
            } catch (e: any) {
                throw new Error("Upload failed: " + e.message);
            }
        }

        // Mobile Offline-First: Queue the photo locally
        const localPath = await OfflinePhotoService.queuePhoto(areaId, uri);

        // Return matching structure so UI can display it
        // UI expects { url, storage_path }
        return { url: localPath, storage_path: 'pending_upload' };
    },

    async getAreaPhotos(areaId: string) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('area_photos')
                .select('*')
                .eq('area_id', areaId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }

        // Native PowerSync
        const photos = await db.getAll(`SELECT * FROM area_photos WHERE area_id = ? ORDER BY created_at DESC`, [areaId]);
        const offlinePhotos = await db.getAll(`SELECT * FROM offline_photos WHERE area_id = ?`, [areaId]);

        return [...photos, ...offlinePhotos].map(p => ({
            id: p.id,
            url: p.url || p.local_uri,
            storage_path: p.storage_path || p.filename
        }));
    },

    async deleteAreaPhoto(photoId: string, storagePath: string) {
        // 1. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('area-photos')
            .remove([storagePath]);

        if (storageError) console.error("Storage delete error (non-fatal):", storageError);

        // 2. Delete from Database
        const { error: dbError } = await supabase
            .from('area_photos')
            .delete()
            .eq('id', photoId);

        if (dbError) throw dbError;
    },

    // Check connection/client
    supabase: supabase
};


