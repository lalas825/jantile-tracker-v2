import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '../../config/supabase';
import { db } from '../../powersync/db';
import * as Crypto from 'expo-crypto';
import { OfflinePhotoService } from '../../services/OfflinePhotoService';
import { CHECKLIST_PRESETS } from '../../constants/JobTemplates';

const FS = FileSystem as any;

// --- TYPES ---

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
    floors?: any[]; // For complex fetching
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

export interface Unit {
    id: string;
    floor_id: string;
    name: string;
    description?: string;
    type?: 'production' | 'logistics';
    areas?: Area[];
}

// Helper to determine if we should use Supabase directly
const useSupabase = Platform.OS === 'web' || (db as any).isMock;

export const JobService = {

    // --- JOBS CRUD ---

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

    async getActiveJobs(filter?: { userId?: string; role?: string }): Promise<any[]> {
        if (useSupabase) {
            const isGlobal = !filter?.role || ['admin', 'pm'].includes(filter.role);

            if (isGlobal) {
                // Admin/PM see all active jobs
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

            // Non-admin: fetch assigned job IDs first, then filter
            const { data: assignments, error: aErr } = await supabase
                .from('job_assignments')
                .select('job_id')
                .eq('user_id', filter!.userId!);
            if (aErr) throw aErr;

            const assignedJobIds = (assignments || []).map(a => a.job_id);
            if (assignedJobIds.length === 0) return [];

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
                .in('id', assignedJobIds)
                .order('name');
            if (error) throw error;
            return data || [];
        }

        // On native (PowerSync), filter locally by job_assignments for non-admin/pm users.
        const isGlobal = !filter?.role || ['admin', 'pm'].includes(filter.role);
        const queryParams: any[] = [];
        const assignmentFilter = isGlobal
            ? ''
            : (() => { queryParams.push(filter!.userId); return `AND j.id IN (SELECT job_id FROM job_assignments WHERE user_id = ?)`; })();

        const query = `
            SELECT
                j.*,
                (SELECT COUNT(*) FROM floors f WHERE f.job_id = j.id) as floor_count,
                (SELECT COUNT(*) FROM units u JOIN floors f ON u.floor_id = f.id WHERE f.job_id = j.id) as unit_count,
                (SELECT ROUND(AVG(a.progress)) FROM areas a JOIN units u ON a.unit_id = u.id JOIN floors f ON u.floor_id = f.id WHERE f.job_id = j.id) as overall_progress
            FROM jobs j
            WHERE LOWER(j.status) = 'active'
            ${assignmentFilter}
            ORDER BY j.name ASC
        `;

        const jobs = await db.getAll(query, queryParams);

        return jobs.map((j: any) => ({
            ...j,
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
                        id, name, description, type,
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
            const safeCompare = (a: any, b: any) => (a?.name || '').localeCompare(b?.name || '', undefined, { numeric: true });
            if (data && data.floors) {
                data.floors.sort(safeCompare);
                data.floors.forEach((floor: any) => {
                    if (floor.units) {
                        floor.units.sort(safeCompare);
                        floor.units.forEach((unit: any) => {
                            if (unit.areas) {
                                unit.areas.sort(safeCompare);
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

    async addFloor(jobId: string, name: string, description: string = '') {
        if (useSupabase) {
            const { error } = await supabase.from('floors').insert({
                job_id: jobId,
                name,
                description,
            });
            if (error) throw error;
            return;
        }

        const id = Crypto.randomUUID();
        await db.execute(
            `INSERT INTO floors (id, job_id, name, description, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
            [id, jobId, name, description]
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

    async addUnit(floorId: string, name: string, type: 'production' | 'logistics' = 'production', description: string = ''): Promise<string> {
        const id = Crypto.randomUUID();
        if (useSupabase) {
            try {
                const { error } = await supabase.from('units').insert({
                    id,
                    floor_id: floorId,
                    name,
                    type,
                    description,
                });
                if (error) throw error;
            } catch (err: any) {
                // FALLBACK: If 'type' column doesn't exist yet (Migration hasn't run)
                if (err.message?.includes("column \"type\" of relation \"units\" does not exist") || (err.code === 'PGRST204')) {
                    console.warn("[JobService] 'type' column missing in units table, retrying without it...");
                    const { error: retryError } = await supabase.from('units').insert({
                        id,
                        floor_id: floorId,
                        name,
                        description,
                    });
                    if (retryError) throw retryError;
                } else {
                    throw err;
                }
            }
            return id;
        }

        await db.execute(
            `INSERT INTO units (id, floor_id, name, type, description, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [id, floorId, name, type, description]
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
            console.log(`[JobService] creating area: ${name} for unit: ${unitId}`);
            try {
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
            } catch (err: any) {
                // FALLBACK: If 'type' column doesn't exist yet
                if (err.message?.includes("column \"type\" of relation \"areas\" does not exist") || (err.code === 'PGRST204')) {
                    console.warn("[JobService] 'type' column missing in areas table, retrying without it...");
                    const { error: retryError } = await supabase
                        .from('areas')
                        .insert({
                            id,
                            unit_id: unitId,
                            name,
                            description,
                            drawing_page: drawingPage,
                            status: 'NOT_STARTED',
                            progress: 0
                        });
                    if (retryError) throw retryError;
                } else {
                    throw err;
                }
            }

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
            return id;
        } else {
            // SQLite / PowerSync path
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
            return id;
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
        if (updates.drawing_page !== undefined) { clauses.push(`drawing_page = ?`); params.push(updates.drawing_page); }

        if (clauses.length === 0) return;
        query += clauses.join(', ') + ` WHERE id = ?`;
        params.push(areaId);

        await db.execute(query, params);
    },

    async deleteArea(areaId: string) {
        if (useSupabase) {
            console.log(`[JobService] Deep deleting area: ${areaId}`);
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
        const items = await JobService.getChecklistItems(areaId);
        const validItems = items.filter((i: any) => i.status !== 'NA');
        const completedCount = validItems.filter((i: any) => i.status === 'COMPLETED' || i.completed === 1).length;
        const progress = validItems.length > 0 ? Math.round((completedCount / validItems.length) * 100) : 0;

        await JobService.updateArea(areaId, { progress });
        return progress;
    },

    addChecklistItem: async (areaId: string, text: string) => {
        const nowStr = new Date().toISOString();

        // Find next position
        const items = await JobService.getChecklistItems(areaId);
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

        await JobService.recalculateAreaProgress(areaId);
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

            if (areaId) await JobService.recalculateAreaProgress(areaId);
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
        if (areaId) await JobService.recalculateAreaProgress(areaId);
    },

    deleteChecklistItem: async (itemId: string) => {
        // Fetch area_id for progress recalculation
        const item = await db.get(`SELECT area_id FROM checklist_items WHERE id = ?`, [itemId]);
        const areaId = item?.area_id;

        if (useSupabase) {
            const { error } = await supabase.from('checklist_items').delete().eq('id', itemId);
            if (error) throw error;
            if (areaId) await JobService.recalculateAreaProgress(areaId);
            return;
        }
        await db.execute(`DELETE FROM checklist_items WHERE id = ?`, [itemId]);
        if (areaId) await JobService.recalculateAreaProgress(areaId);
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
            if (error) {
                console.error("DEBUG: getJobIssues error:", error);
                // Fallback to simpler query if complex join fails
                const { data: simpleData, error: simpleError } = await supabase
                    .from('job_issues')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (simpleError) throw simpleError;
                return (simpleData || []).map((i: any) => ({ ...i, job_name: i.job_name || 'Unknown Job' }));
            }
            return (data || []).map((i: any) => ({
                ...i,
                job_name: i.job_name || i.jobs?.name,
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

        console.log(`[JobService] Creating Issue:`, JSON.stringify(payload));

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
};
