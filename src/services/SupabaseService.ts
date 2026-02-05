import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { db } from '../powersync/db';
import * as Crypto from 'expo-crypto';
import { OfflinePhotoService } from './OfflinePhotoService';
import { CHECKLIST_PRESETS } from '../constants/JobTemplates';

const FS = FileSystem as any;

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

export interface ChecklistItem {
    id: string;
    area_id: string;
    text: string;
    completed: number; // 0 or 1
    status: string;
    position: number;
    created_at: string;
}

export interface Job {
    id: string;
    name: string;
    status?: string;
}

export interface JobIssue {
    id: string;
    job_id: string;
    area_id?: string;
    type: string;
    priority: 'Low' | 'Medium' | 'High';
    status: 'open' | 'resolved';
    description: string;
    photo_url?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    // Derived for UI
    job_name?: string;
    area_name?: string;
    unit_name?: string;
    floor_name?: string;
}

export interface IssueComment {
    id: string;
    issue_id: string;
    user_id: string;
    user_name: string;
    message: string;
    created_at: string;
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
export interface Area {
    id: string;
    unit_id: string;
    name: string;
    description?: string;
    drawing_page?: string;
    type?: 'production' | 'logistics';
    status: string;
    progress: number;
    checklist_items?: ChecklistItem[];
    area_photos?: any[];
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

export interface ProjectMaterial {
    id: string;
    job_id: string;
    area_id?: string; // Link to specific Area
    sub_location?: string; // e.g. "Main Bathroom", "Kitchen Backsplash"
    category: string;
    product_code?: string; // e.g. ST-05
    product_name: string;
    product_specs?: string; // dims, unit details
    zone?: string; // e.g. L1 Lobby
    net_qty: number;
    waste_percent: number;
    budget_qty: number; // Total Budget (Net + Waste)
    unit_cost: number;
    total_value: number;
    supplier?: string;
    ordered_qty: number;
    shop_stock: number;
    in_transit: number;
    received_at_job: number;
    unit: string;
    pcs_per_unit?: number;
    expected_date?: string;
    grout_info?: string;
    caulk_info?: string;
    dim_length?: number;
    dim_width?: number;
    dim_thickness?: string;
    linear_feet?: number;
    created_at?: string;
    updated_at?: string;
}

export interface DeliveryTicket {
    id: string;
    job_id: string;
    ticket_number: string;
    status: string;
    items: any[]; // Decoded JSON
    destination: string;
    requested_date: string;
    due_date?: string;
    due_time?: string;
    notes?: string;
    created_by: string;
    created_at?: string;
    updated_at?: string;
}

export interface PurchaseOrderItem {
    id: string;
    po_id: string;
    material_id: string;
    quantity_ordered: number;
    item_cost: number;
    created_at?: string;
}

export interface PurchaseOrder {
    id: string;
    job_id: string;
    po_number: string;
    vendor: string;
    status: 'Ordered' | 'Partial' | 'Received';
    order_date: string;
    expected_date?: string;
    total_amount: number;
    notes?: string;
    items?: PurchaseOrderItem[];
    created_at?: string;
    updated_at?: string;
}

export interface UIWorkerWithLogs {
    id: string;
    name: string;
    avatar: string;
    logs: UIJobLog[];
    isExpanded: boolean;
}

// Robust manual YYYY-MM-DD formatter to avoid locale-specific issues with string comparisons in the DB
export const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Helper to determine if we should use Supabase directly
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
                assignedJobIds: Array.isArray(w.assigned_job_ids) ? w.assigned_job_ids : (w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : []),
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
            assignedJobIds: w.assigned_job_ids ? JSON.parse(w.assigned_job_ids) : [],
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

            console.log("[SupabaseService] Upserting worker to Supabase:", payload);
            const { error, data } = await supabase.from('workers').upsert(payload).select();
            if (error) {
                console.error("[SupabaseService] Supabase Upsert Error:", error);
                throw error;
            }
            console.log("[SupabaseService] Supabase Upsert Success:", data);
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

    // --- JOBS ---

    async createJob(job: any): Promise<void> {
        if (useSupabase) {
            const { error } = await supabase.from('jobs').insert(job);
            if (error) throw error;
            return;
        }

        const id = job.id || Crypto.randomUUID();
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

        // Efficient single query for stats with ROUNDing
        const query = `
            SELECT 
                j.*,
                (SELECT COUNT(*) FROM floors f WHERE f.job_id = j.id) as floor_count,
                (SELECT COUNT(*) FROM units u JOIN floors f ON u.floor_id = f.id WHERE f.job_id = j.id) as unit_count,
                (SELECT ROUND(AVG(a.progress)) FROM areas a JOIN units u ON a.unit_id = u.id JOIN floors f ON u.floor_id = f.id WHERE f.job_id = j.id) as overall_progress
            FROM jobs j
            WHERE LOWER(j.status) = 'active'
            ORDER BY j.name ASC
        `;

        const jobs = await db.getAll(query);

        return jobs.map((j: any) => ({
            ...j,
            // For backward compatibility with calculateJobProgress in index.tsx
            // if overall_progress is null, we set it to 0
            computed_progress: j.overall_progress || 0
        }));
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

    async getProjectAreas(jobId: string): Promise<Area[]> {
        try {
            if (useSupabase) {
                // Fetch floors first
                const { data: floors } = await supabase.from('floors').select('id').eq('job_id', jobId);
                if (!floors || floors.length === 0) return [];
                const floorIds = floors.map(f => f.id);

                // Fetch units for those floors
                const { data: units } = await supabase.from('units').select('id').in('floor_id', floorIds);
                if (!units || units.length === 0) return [];
                const unitIds = units.map(u => u.id);

                // Fetch areas for those units
                const { data: areas, error } = await supabase
                    .from('areas')
                    .select('*, area_photos(id, url)')
                    .in('unit_id', unitIds);

                if (error) throw error;
                return areas || [];
            }

            // SQLite / PowerSync path
            return await db.getAll(`
                SELECT a.* FROM areas a
                JOIN units u ON a.unit_id = u.id
                JOIN floors f ON u.floor_id = f.id
                WHERE f.job_id = ?
            `, [jobId]);
        } catch (e) {
            console.error("Error in getProjectAreas:", e);
            return []; // Fail gracefully
        }
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
                            id, name, description, drawing_page, type, status, progress,
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
                // ROBUSTNESS: Reconstruction of local path to handle sandbox changes
                let finalUrl = p.url;
                if (!finalUrl && p.filename) {
                    // It's an offline photo, or a synced photo we want to verify locally
                    finalUrl = `${FS.documentDirectory}photos/${p.filename}`;
                }

                const uiPhoto = {
                    id: p.id,
                    url: finalUrl,
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

        const id = Crypto.randomUUID();
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

    async addUnit(floorId: string, name: string, type: 'production' | 'logistics' = 'production'): Promise<string> {
        const id = Crypto.randomUUID();
        if (useSupabase) {
            const { error } = await supabase.from('units').insert({
                id,
                floor_id: floorId,
                name: name,
                type: type
            });
            if (error) throw error;
            return id;
        }

        await db.execute(
            `INSERT INTO units (id, floor_id, name, type, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
            [id, floorId, name, type]
        );
        return id;
    },

    async deleteUnit(unitId: string) {
        if (useSupabase) {
            // 1. Fetch areas to delete them properly with their items
            const { data: areas } = await supabase.from('areas').select('id').eq('unit_id', unitId);
            if (areas && areas.length > 0) {
                for (const area of areas) {
                    await this.deleteArea(area.id);
                }
            }
            const { error } = await supabase.from('units').delete().eq('id', unitId);
            if (error) throw error;
            return;
        }

        // SQLite: Trigger areas deletion first
        const areas = await db.getAll(`SELECT id FROM areas WHERE unit_id = ?`, [unitId]);
        for (const area of areas) {
            await this.deleteArea(area.id);
        }
        await db.execute(`DELETE FROM units WHERE id = ?`, [unitId]);
    },

    async addArea(unitId: string, name: string, description: string = '', drawingPage: string = '', type: 'production' | 'logistics' = 'production'): Promise<string> {
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

        const id = Crypto.randomUUID();
        const now = new Date().toISOString();

        if (useSupabase) {
            // 1. Insert Area
            if (!unitId || unitId === '') {
                throw new Error("Cannot create area: unit_id is required");
            }
            console.log(`[SupabaseService] creating area: ${name} for unit: ${unitId}`);
            const { error: areaError } = await supabase
                .from('areas')
                .insert({
                    id,
                    unit_id: unitId,
                    name,
                    description,
                    drawing_page: drawingPage,
                    type,
                    status: 'NOT_STARTED',
                    progress: 0
                });

            if (areaError) throw areaError;

            // 3. Insert Items
            if (preset && preset.length > 0) {
                const nowData = new Date();
                const items = preset.map((text, index) => ({
                    area_id: id,
                    text: text,
                    completed: 0,
                    status: 'NOT_STARTED',
                    position: index,
                    created_at: new Date(nowData.getTime() + index * 10).toISOString()
                }));
                const { error: itemsError } = await supabase.from('checklist_items').insert(items);
                if (itemsError) throw itemsError;
            }
        } else {
            // SQLite
            await db.execute(
                `INSERT INTO areas (id, unit_id, name, description, drawing_page, type, status, progress, created_at) VALUES (?, ?, ?, ?, ?, ?, 'NOT_STARTED', 0, ?)`,
                [id, unitId, name, description, drawingPage, type, now]
            );

            // 3. Insert Items
            if (preset && preset.length > 0) {
                const baseTime = Date.now();
                let i = 0;
                for (const text of preset) {
                    const itemId = Crypto.randomUUID();
                    const pos = i;
                    const itemNow = new Date(baseTime + (i++) * 10).toISOString();
                    await db.execute(
                        `INSERT INTO checklist_items (id, area_id, text, completed, status, position, created_at) VALUES (?, ?, ?, 0, 'NOT_STARTED', ?, ?)`,
                        [itemId, id, text, pos, itemNow]
                    );
                }
            }
        }
        return id;
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
        if (updates.drawing_page !== undefined) { clauses.push(`drawing_page = ?`); params.push(updates.drawing_page); }

        if (clauses.length === 0) return;
        query += clauses.join(', ') + ` WHERE id = ?`;
        params.push(areaId);

        await db.execute(query, params);
    },

    async deleteArea(areaId: string) {
        if (useSupabase) {
            console.log(`[SupabaseService] Deep deleting area: ${areaId}`);
            // 1. Delete Child Records
            await Promise.all([
                supabase.from('project_materials').delete().eq('area_id', areaId),
                supabase.from('checklist_items').delete().eq('area_id', areaId),
                supabase.from('area_photos').delete().eq('area_id', areaId),
                supabase.from('job_issues').delete().eq('area_id', areaId),
                // offline_photos is localOnly, handled below
            ]);

            // 2. Delete Area
            const { error } = await supabase.from('areas').delete().eq('id', areaId);
            if (error) throw error;

            // Cleanup local offline photos if on web (though unlikely to have them)
            await db.execute(`DELETE FROM offline_photos WHERE area_id = ?`, [areaId]);
            return;
        }

        // PowerSync path
        await db.execute(`DELETE FROM project_materials WHERE area_id = ?`, [areaId]);
        await db.execute(`DELETE FROM checklist_items WHERE area_id = ?`, [areaId]);
        await db.execute(`DELETE FROM area_photos WHERE area_id = ?`, [areaId]);
        await db.execute(`DELETE FROM job_issues WHERE area_id = ?`, [areaId]);
        await db.execute(`DELETE FROM offline_photos WHERE area_id = ?`, [areaId]);
        await db.execute(`DELETE FROM areas WHERE id = ?`, [areaId]);
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

    async upsertLog(logId: string, date: Date, workerId: string, field: string | Record<string, any>, value?: any): Promise<any> {
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
            if (e.message?.includes('no such column: status_color')) {
                await db.execute('ALTER TABLE production_logs ADD COLUMN status_color TEXT');
                return await this.upsertLog(logId, date, workerId, field, value);
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

    // --- CHECKLIST MANAGEMENT ---
    // --- CHECKLIST MANAGEMENT ---
    getChecklistItems: async (areaId: string) => {
        if (useSupabase) {
            // Sort by position ASC, then text for stable fallback
            const { data, error } = await supabase
                .from('checklist_items')
                .select('*')
                .eq('area_id', areaId)
                .order('position', { ascending: true })
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        }

        // Use PowerSync for implicit offline support
        // Sort by position ASC, then created_at for legacy/fallbacks
        const result = await db.getAll(
            `SELECT * FROM checklist_items WHERE area_id = ? ORDER BY position ASC, created_at ASC`,
            [areaId]
        );
        return result || [];
    },

    // --- HELPER FOR ROBUST SORTING ---
    sortChecklist(items: any[], areaName: string) {
        // 1. Determine Preset for this area
        const areaNameLower = areaName.toLowerCase();
        let presetOrder = CHECKLIST_PRESETS[areaNameLower];
        if (!presetOrder) {
            if (areaNameLower.includes('bathroom') || areaNameLower.includes('bath')) presetOrder = CHECKLIST_PRESETS['master bathroom'];
            else if (areaNameLower.includes('kitchen')) presetOrder = CHECKLIST_PRESETS['kitchen'];
            else if (areaNameLower.includes('powder')) presetOrder = CHECKLIST_PRESETS['powder room'];
            else if (areaNameLower.includes('laundry')) presetOrder = CHECKLIST_PRESETS['laundry'];
        }

        return [...items].sort((a, b) => {
            const textA = (a.text || a.label || '').trim().toLowerCase();
            const textB = (b.text || b.label || '').trim().toLowerCase();

            // 1. Template Order is the absolute source of truth if available
            if (presetOrder) {
                const idxA = presetOrder.findIndex(p => p.toLowerCase() === textA);
                const idxB = presetOrder.findIndex(p => p.toLowerCase() === textB);

                if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
                // If only one is in template, that one goes first
                if (idxA !== -1 && idxB === -1) return -1;
                if (idxA === -1 && idxB !== -1) return 1;
            }

            // 2. Fallback to Position (Legacy/Manual items)
            if (a.position !== null && b.position !== null && a.position !== b.position && a.position !== undefined && b.position !== undefined) {
                return (a.position || 0) - (b.position || 0);
            }

            // 3. Final fallback to created_at
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });
    },

    async recalculateAreaProgress(areaId: string) {
        const items = await SupabaseService.getChecklistItems(areaId);
        const validItems = items.filter((i: any) => i.status !== 'NA');
        const completedCount = validItems.filter((i: any) => i.status === 'COMPLETED' || i.completed === 1).length;
        const progress = validItems.length > 0 ? Math.round((completedCount / validItems.length) * 100) : 0;

        await SupabaseService.updateArea(areaId, { progress });
        return progress;
    },

    addChecklistItem: async (areaId: string, text: string) => {
        const nowStr = new Date().toISOString();

        // Find next position
        const items = await SupabaseService.getChecklistItems(areaId);
        const nextPos = items.length > 0 ? Math.max(...items.map((i: any) => i.position || 0)) + 1 : 0;

        if (useSupabase) {
            const { error } = await supabase.from('checklist_items').insert({
                area_id: areaId,
                text: text,
                completed: 0,
                status: 'NOT_STARTED',
                position: nextPos,
                created_at: nowStr
            });
            if (error) throw error;
            return;
        }

        const id = Crypto.randomUUID();
        await db.execute(
            `INSERT INTO checklist_items (id, area_id, text, completed, status, position, created_at) VALUES (?, ?, ?, 0, 'NOT_STARTED', ?, ?)`,
            [id, areaId, text, nextPos, nowStr]
        );

        await SupabaseService.recalculateAreaProgress(areaId);
    },

    updateChecklistItem: async (itemId: string, updates: any) => {
        // Fetch area_id first if not provided
        let areaId = updates.area_id;
        if (!areaId) {
            const item = await db.get(`SELECT area_id FROM checklist_items WHERE id = ?`, [itemId]);
            areaId = item?.area_id;
        }

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

            if (areaId) await SupabaseService.recalculateAreaProgress(areaId);
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
        if (areaId) await SupabaseService.recalculateAreaProgress(areaId);
    },

    deleteChecklistItem: async (itemId: string) => {
        // Fetch area_id for progress recalculation
        const item = await db.get(`SELECT area_id FROM checklist_items WHERE id = ?`, [itemId]);
        const areaId = item?.area_id;

        if (useSupabase) {
            const { error } = await supabase.from('checklist_items').delete().eq('id', itemId);
            if (error) throw error;
            if (areaId) await SupabaseService.recalculateAreaProgress(areaId);
            return;
        }
        await db.execute(`DELETE FROM checklist_items WHERE id = ?`, [itemId]);
        if (areaId) await SupabaseService.recalculateAreaProgress(areaId);
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
                const filename = `${Crypto.randomUUID()}.jpg`;
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

        return [...photos, ...offlinePhotos].map(p => {
            // ROBUSTNESS: Reconstruction of local path
            let finalUrl = p.url;
            if (!finalUrl && p.filename) {
                finalUrl = `${FS.documentDirectory}photos/${p.filename}`;
            }

            return {
                id: p.id,
                url: finalUrl || p.local_uri,
                storage_path: p.storage_path || p.filename
            };
        });
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

    // --- ISSUES ---

    async getJobIssues(jobId?: string, areaId?: string): Promise<JobIssue[]> {
        if (useSupabase) {
            // Join with jobs, areas, units, and floors
            let query = supabase.from('job_issues').select(`
                *, 
                jobs(name),
                areas(
                    name,
                    units(
                        name,
                        floors(name)
                    )
                )
            `);
            if (jobId) query = query.eq('job_id', jobId);
            if (areaId) query = query.eq('area_id', areaId);
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map((i: any) => ({
                ...i,
                job_name: i.jobs?.name,
                area_name: i.areas?.name,
                unit_name: i.areas?.units?.name,
                floor_name: i.areas?.units?.floors?.name
            }));
        }

        let sql = `
            SELECT i.*, 
                   j.name as job_name,
                   a.name as area_name,
                   u.name as unit_name,
                   f.name as floor_name
            FROM job_issues i 
            LEFT JOIN jobs j ON i.job_id = j.id
            LEFT JOIN areas a ON i.area_id = a.id
            LEFT JOIN units u ON a.unit_id = u.id
            LEFT JOIN floors f ON u.floor_id = f.id
        `;
        const params = [];
        const conditions = [];

        if (jobId) {
            conditions.push(`i.job_id = ?`);
            params.push(jobId);
        }
        if (areaId) {
            conditions.push(`i.area_id = ?`);
            params.push(areaId);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ` + conditions.join(' AND ');
        }

        sql += ` ORDER BY i.created_at DESC`;

        const result = await db.getAll(sql, params);
        return result as JobIssue[];
    },

    async getGlobalIssueStats(): Promise<{ open: number, resolved: number }> {
        if (useSupabase) {
            const { count: open, error: oe } = await supabase.from('job_issues').select('*', { count: 'exact', head: true }).eq('status', 'open');
            const { count: resolved, error: re } = await supabase.from('job_issues').select('*', { count: 'exact', head: true }).eq('status', 'resolved');
            if (oe) throw oe;
            if (re) throw re;
            return { open: open || 0, resolved: resolved || 0 };
        }
        const openResult = await db.getAll(`SELECT COUNT(*) as count FROM job_issues WHERE status = 'open'`, []);
        const resolvedResult = await db.getAll(`SELECT COUNT(*) as count FROM job_issues WHERE status = 'resolved'`, []);
        return {
            open: (openResult[0] as any).count || 0,
            resolved: (resolvedResult[0] as any).count || 0
        };
    },

    async getGlobalOpenIssuesCount(): Promise<number> {
        if (useSupabase) {
            const { count, error } = await supabase.from('job_issues').select('*', { count: 'exact', head: true }).eq('status', 'open');
            if (error) throw error;
            return count || 0;
        }
        const result = await db.getAll(`SELECT COUNT(*) as count FROM job_issues WHERE status = 'open'`, []);
        return (result[0] as any).count || 0;
    },

    async createIssue(issue: Partial<JobIssue>): Promise<string> {
        const id = Crypto.randomUUID();
        const now = new Date().toISOString();
        const payload = {
            id,
            job_id: issue.job_id,
            area_id: issue.area_id || null,
            type: issue.type || 'Other',
            priority: issue.priority || 'Medium',
            status: 'open',
            description: issue.description || '',
            photo_url: issue.photo_url || null,
            created_by: issue.created_by || 'Anonymous',
            created_at: now,
            updated_at: now
        };

        console.log(`[SupabaseService] Creating Issue:`, JSON.stringify(payload));

        if (useSupabase) {
            const { error } = await supabase.from('job_issues').insert(payload);
            if (error) throw error;
            return id;
        }

        await db.execute(
            `INSERT INTO job_issues (id, job_id, area_id, type, priority, status, description, photo_url, created_by, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [payload.id, payload.job_id, payload.area_id, payload.type, payload.priority, payload.status, payload.description, payload.photo_url, payload.created_by, payload.created_at, payload.updated_at]
        );
        return id;
    },

    async updateIssueStatus(id: string, status: 'open' | 'resolved'): Promise<void> {
        const now = new Date().toISOString();
        if (useSupabase) {
            const { error } = await supabase.from('job_issues').update({ status, updated_at: now }).eq('id', id);
            if (error) throw error;
            return;
        }

        await db.execute(`UPDATE job_issues SET status = ?, updated_at = ? WHERE id = ?`, [status, now, id]);
    },

    async deleteIssue(id: string): Promise<void> {
        if (useSupabase) {
            const { error } = await supabase.from('job_issues').delete().eq('id', id);
            if (error) throw error;
            return;
        }
        await db.execute(`DELETE FROM job_issues WHERE id = ?`, [id]);
    },

    async getIssueComments(issueId: string): Promise<IssueComment[]> {
        if (useSupabase) {
            const { data, error } = await supabase.from('issue_comments').select('*').eq('issue_id', issueId).order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        }

        return await db.getAll(`SELECT * FROM issue_comments WHERE issue_id = ? ORDER BY created_at ASC`, [issueId]) as IssueComment[];
    },

    async addIssueComment(issueId: string, message: string, userId: string, userName: string): Promise<void> {
        const id = Crypto.randomUUID();
        const now = new Date().toISOString();
        const payload = { id, issue_id: issueId, user_id: userId, user_name: userName, message, created_at: now };

        if (useSupabase) {
            const { error } = await supabase.from('issue_comments').insert(payload);
            if (error) throw error;
            return;
        }

        await db.execute(
            `INSERT INTO issue_comments (id, issue_id, user_id, user_name, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [payload.id, payload.issue_id, payload.user_id, payload.user_name, payload.message, payload.created_at]
        );
    },

    // Check connection/client
    supabase: supabase,

    // --- LOGISTICS (PM MATERIAL HUB) ---

    async getProjectMaterials(jobId: string): Promise<ProjectMaterial[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('project_materials')
                .select('*')
                .eq('job_id', jobId)
                .order('category', { ascending: true })
                .order('sub_location', { ascending: true })
                .order('product_name', { ascending: true });
            if (error) throw error;
            return data || [];
        }

        const result = await db.getAll(
            `SELECT * FROM project_materials WHERE job_id = ? ORDER BY category ASC, sub_location ASC, product_name ASC`,
            [jobId]
        );
        return result || [];
    },

    async saveProjectMaterial(material: Partial<ProjectMaterial>): Promise<void> {
        const id = material.id && material.id !== '' ? material.id : Crypto.randomUUID();
        const now = new Date().toISOString();

        if (useSupabase) {
            const { _new_area, ...cleanMaterial } = material as any;

            // Defensive: ensure empty strings aren't sent to UUID columns
            if (cleanMaterial.area_id === '') cleanMaterial.area_id = null;
            if (cleanMaterial.job_id === '') cleanMaterial.job_id = null;

            const payload = { ...cleanMaterial, id, updated_at: now };
            const { error } = await supabase.from('project_materials').upsert(payload);
            if (error) throw error;
            return;
        }

        await db.writeTransaction(async (tx: any) => {
            await tx.execute(
                `INSERT OR REPLACE INTO project_materials (
                    id, job_id, area_id, sub_location, category, product_code, product_name, product_specs, zone, 
                    net_qty, waste_percent, budget_qty, unit_cost, total_value, supplier, ordered_qty, shop_stock, in_transit, 
                    received_at_job, unit, pcs_per_unit, expected_date,
                    grout_info, caulk_info, dim_length, dim_width, dim_thickness,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, material.job_id, material.area_id || null, material.sub_location || null, material.category,
                    material.product_code || null, material.product_name, material.product_specs || null, material.zone || null,
                    material.net_qty || 0, material.waste_percent || 10, material.budget_qty || 0,
                    material.unit_cost || 0, material.total_value || 0, material.supplier || null,
                    material.ordered_qty || 0, material.shop_stock || 0, material.in_transit || 0,
                    material.received_at_job || 0, material.unit || 'sqft', material.pcs_per_unit || 1,
                    material.expected_date || null,
                    material.grout_info || null, material.caulk_info || null,
                    material.dim_length || null, material.dim_width || null, material.dim_thickness || null,
                    now
                ]
            );
        });
    },

    async deleteProjectMaterial(id: string): Promise<void> {
        if (useSupabase) {
            const { error } = await supabase.from('project_materials').delete().eq('id', id);
            if (error) throw error;
            return;
        }
        await db.execute(`DELETE FROM project_materials WHERE id = ?`, [id]);
    },

    async getDeliveryTickets(jobId: string): Promise<DeliveryTicket[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('delivery_tickets')
                .select('*')
                .eq('job_id', jobId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map((t: any) => ({
                ...t,
                items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
            }));
        }

        const result = await db.getAll(
            `SELECT * FROM delivery_tickets WHERE job_id = ? ORDER BY created_at DESC`,
            [jobId]
        );
        return result.map((t: any) => ({
            ...t,
            items: t.items ? JSON.parse(t.items) : []
        }));
    },

    async saveDeliveryTicket(ticket: Partial<DeliveryTicket>): Promise<void> {
        const id = ticket.id && ticket.id !== '' ? ticket.id : Crypto.randomUUID();
        const now = new Date().toISOString();

        if (useSupabase) {
            const payload = {
                ...ticket,
                id,
                job_id: ticket.job_id && ticket.job_id !== '' ? ticket.job_id : null,
                items: JSON.stringify(ticket.items || []),
                updated_at: now
            };
            const { error } = await supabase.from('delivery_tickets').upsert(payload);
            if (error) throw error;
            return;
        }

        // PowerSync Transaction for ticket save + optional material updates
        await db.writeTransaction(async (tx: any) => {
            await tx.execute(
                `INSERT OR REPLACE INTO delivery_tickets (
                    id, job_id, ticket_number, status, items, destination, 
                    requested_date, due_date, due_time, notes, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, ticket.job_id, ticket.ticket_number, ticket.status || 'draft',
                    JSON.stringify(ticket.items || []), ticket.destination,
                    ticket.requested_date, ticket.due_date || null, ticket.due_time || null,
                    ticket.notes || null, ticket.created_by,
                    ticket.created_at || now, now
                ]
            );
        });
    },

    async deleteDeliveryTicket(id: string): Promise<void> {
        if (useSupabase) {
            const { error } = await supabase.from('delivery_tickets').delete().eq('id', id);
            if (error) throw error;
            return;
        }
        await db.execute(`DELETE FROM delivery_tickets WHERE id = ?`, [id]);
    },

    async updateDeliveryTicketTime(id: string, date: string, time: string): Promise<void> {
        const now = new Date().toISOString();
        if (useSupabase) {
            const { error } = await supabase
                .from('delivery_tickets')
                .update({ requested_date: date, scheduled_time: time, updated_at: now })
                .eq('id', id);
            if (error) throw error;
            return;
        }
        await db.execute(`UPDATE delivery_tickets SET requested_date = ?, scheduled_time = ?, updated_at = ? WHERE id = ?`,
            [date, time, now, id]);
    },

    async updateTicketStatus(ticket: DeliveryTicket, status: string): Promise<void> {
        const now = new Date().toISOString();
        if (useSupabase) {
            const { error } = await supabase.from('delivery_tickets').update({ status, updated_at: now }).eq('id', ticket.id);
            if (error) throw error;
            return;
        }
        await db.execute(`UPDATE delivery_tickets SET status = ?, updated_at = ? WHERE id = ?`, [status, now, ticket.id]);
    },


    async getAllDeliveryTickets(): Promise<DeliveryTicket[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('delivery_tickets')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map((t: any) => ({
                ...t,
                items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
            }));
        }

        const result = await db.getAll(`SELECT * FROM delivery_tickets ORDER BY created_at DESC`);
        return result.map((t: any) => ({
            ...t,
            items: t.items ? JSON.parse(t.items) : []
        }));
    },

    async getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
        if (useSupabase) {
            const { data: pos, error } = await supabase
                .from('purchase_orders')
                .select(`
                    *,
                    po_items (*)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (pos || []).map((p: any) => ({
                ...p,
                items: p.po_items || []
            }));
        }

        const pos = await db.getAll(`SELECT * FROM purchase_orders ORDER BY created_at DESC`);
        if (pos.length === 0) return [];

        const poIds = pos.map((p: any) => p.id);
        const placeholders = poIds.map(() => '?').join(',');
        const items = await db.getAll(`SELECT * FROM po_items WHERE po_id IN (${placeholders})`, poIds);

        const itemsMap = new Map<string, any[]>();
        items.forEach((item: any) => {
            if (!itemsMap.has(item.po_id)) itemsMap.set(item.po_id, []);
            itemsMap.get(item.po_id)?.push(item);
        });

        return pos.map((p: any) => ({
            ...p,
            items: itemsMap.get(p.id) || []
        }));
    },

    async updatePurchaseOrderTime(id: string, date: string, time: string): Promise<void> {
        const now = new Date().toISOString();
        if (useSupabase) {
            const { error } = await supabase
                .from('purchase_orders')
                .update({ expected_date: date, scheduled_time: time, updated_at: now })
                .eq('id', id);
            if (error) throw error;
            return;
        }
        await db.execute(`UPDATE purchase_orders SET expected_date = ?, scheduled_time = ?, updated_at = ? WHERE id = ?`,
            [date, time, now, id]);
    },


    async getPurchaseOrders(jobId: string): Promise<PurchaseOrder[]> {
        if (useSupabase) {
            const { data: pos, error } = await supabase
                .from('purchase_orders')
                .select(`
                    *,
                    po_items (*)
                `)
                .eq('job_id', jobId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (pos || []).map((p: any) => ({
                ...p,
                items: p.po_items || []
            }));
        }

        const pos = await db.getAll(`SELECT * FROM purchase_orders WHERE job_id = ? ORDER BY created_at DESC`, [jobId]);
        if (pos.length === 0) return [];

        const poIds = pos.map((p: any) => p.id);
        const placeholders = poIds.map(() => '?').join(',');
        const items = await db.getAll(`SELECT * FROM po_items WHERE po_id IN (${placeholders})`, poIds);

        const itemsMap = new Map<string, any[]>();
        items.forEach((item: any) => {
            if (!itemsMap.has(item.po_id)) itemsMap.set(item.po_id, []);
            itemsMap.get(item.po_id)?.push(item);
        });

        return pos.map((p: any) => ({
            ...p,
            items: itemsMap.get(p.id) || []
        }));
    },

    async savePurchaseOrder(poData: any, jobId: string): Promise<void> {
        const now = new Date().toISOString();

        if (useSupabase) {
            // WEB: Write directly to Supabase to match the Read source
            let poId = poData.po_id;

            if (poData.mode === 'NEW') {
                poId = Crypto.randomUUID();
                const { error: poError } = await supabase.from('purchase_orders').insert({
                    id: poId,
                    job_id: jobId,
                    po_number: poData.po_number,
                    vendor: poData.vendor,
                    status: 'Ordered',
                    order_date: new Date().toISOString().split('T')[0],
                    expected_date: poData.expected_date,
                    total_amount: 0,
                    created_at: now,
                    updated_at: now
                });
                if (poError) throw poError;
            }

            // Insert Item
            const itemId = Crypto.randomUUID();
            const { error: itemError } = await supabase.from('po_items').insert({
                id: itemId,
                po_id: poId,
                material_id: poData.material_id,
                quantity_ordered: poData.qty,
                item_cost: poData.cost,
                created_at: now
            });
            if (itemError) throw itemError;

            // Update Material directly via RPC or just update fields
            // Since we can't easily do `in_transit = in_transit + X` without a stored procedure or atomic increment,
            // we will fetch first (slightly racy but okay for this app scale) or use a RPC if critical.
            // For now, fetch-update is acceptable on web.
            const { data: mat } = await supabase.from('project_materials').select('in_transit').eq('id', poData.material_id).single();
            const currentTransit = mat?.in_transit || 0;

            await supabase.from('project_materials').update({
                in_transit: currentTransit + poData.qty,
                expected_date: poData.expected_date,
                updated_at: now
            }).eq('id', poData.material_id);

            return;
        }

        // NATIVE: PowerSync Transaction
        await db.writeTransaction(async (tx: any) => {
            let poId = poData.po_id;
            if (poData.mode === 'NEW') {
                poId = Crypto.randomUUID();
                await tx.execute(`INSERT INTO purchase_orders (id, job_id, po_number, vendor, status, order_date, expected_date, total_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [poId, jobId, poData.po_number, poData.vendor, 'Ordered', new Date().toISOString().split('T')[0], poData.expected_date, 0, now, now]);
            }
            const itemId = Crypto.randomUUID();
            await tx.execute(`INSERT INTO po_items (id, po_id, material_id, quantity_ordered, item_cost, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [itemId, poId, poData.material_id, poData.qty, poData.cost, now]);

            // Update Material: In Transit (+qty), Expected Date
            await tx.execute(`UPDATE project_materials SET in_transit = in_transit + ?, expected_date = ?, updated_at = ? WHERE id = ?`,
                [poData.qty, poData.expected_date, now, poData.material_id]);
        });
    },

    async getWarehouseInventory(): Promise<any[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('project_materials')
                .select(`
                    *,
                    jobs (name, job_number)
                `)
                .gt('shop_stock', 0)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        }

        // Native
        const materials = await db.getAll(`SELECT * FROM project_materials WHERE shop_stock > 0`);
        if (materials.length === 0) return [];

        // Enrich with Job Name (manual join for local)
        const jobIds = [...new Set(materials.map((m: any) => m.job_id))];
        const placeholders = jobIds.map(() => '?').join(',');
        const jobs = await db.getAll(`SELECT id, name, job_number FROM jobs WHERE id IN (${placeholders})`, jobIds);

        const jobMap = new Map();
        jobs.forEach((j: any) => jobMap.set(j.id, j));

        return materials.map((m: any) => ({
            ...m,
            jobs: jobMap.get(m.job_id) || { name: 'Unknown Job', job_number: 'N/A' }
        }));
    }
};


