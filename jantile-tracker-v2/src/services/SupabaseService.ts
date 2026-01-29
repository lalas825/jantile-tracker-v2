import { supabase } from '../config/supabase';
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

export const SupabaseService = {

    // --- WORKERS ---

    async getWorkers(): Promise<UICrewMember[]> {
        const { data, error } = await supabase
            .from('workers')
            .select('*')
            .order('name');

        if (error) {
            console.error("Error fetching workers:", error);
            throw error;
        }

        return (data || []).map((w: any) => ({
            id: w.id,
            name: w.name,
            role: w.role,
            status: w.status,
            phone: w.phone,
            email: w.email,
            address: w.address,
            assignedJobIds: w.assigned_job_ids || [],
            avatar: w.avatar || getInitials(w.name)
        }));
    },

    async saveWorker(worker: Partial<UICrewMember>): Promise<void> {
        const dbWorker = {
            id: worker.id,
            name: worker.name,
            role: worker.role,
            status: worker.status,
            phone: worker.phone,
            email: worker.email,
            address: worker.address,
            assigned_job_ids: worker.assignedJobIds,
            avatar: worker.avatar
        };

        // Remove undefined keys
        Object.keys(dbWorker).forEach(key => (dbWorker as any)[key] === undefined && delete (dbWorker as any)[key]);

        const { error } = await supabase
            .from('workers')
            .upsert(dbWorker);

        if (error) {
            console.error("Error saving worker:", error);
            throw error;
        }
    },

    // --- JOBS ---

    async createJob(job: any): Promise<void> {
        const { error } = await supabase
            .from('jobs')
            .insert(job);

        if (error) {
            console.error("Error creating job:", error);
            throw error;
        }
    },

    async getActiveJobs(): Promise<any[]> {
        const { data, error } = await supabase
            .from('jobs')
            .select(`
                id, name, status, address, general_contractor,
                floors (
                    id,
                    units (
                        id,
                        areas (
                            id, progress
                        )
                    )
                )
            `)
            .eq('status', 'active')
            .order('name');

        if (error) {
            console.error("Error fetching jobs:", error);
            return [];
        }
        return data || [];
    },

    async updateJob(id: string, updates: any) {
        const { error } = await supabase
            .from('jobs')
            .update(updates)
            .eq('id', id);
        if (error) throw error;
    },

    async deleteJob(id: string) {
        // RLS/Cascade handles children usually, but we ensure deletion
        const { error } = await supabase
            .from('jobs')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getJob(id: string): Promise<Job | null> {
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
            console.error("Error Details:", JSON.stringify(error, null, 2)); // Detailed content
            return null;
        }

        // Sort the structure locally since Supabase sorting in deep nested queries can be tricky without separate queries
        // or using complex order modifiers. Simple JS sort is reliable for this scale.
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
    },

    // --- STRUCTURE MUTATIONS ---

    async addFloor(jobId: string, name: string) {
        const { error } = await supabase.from('floors').insert({ job_id: jobId, name });
        if (error) throw error;
    },

    async deleteFloor(floorId: string) {
        const { error } = await supabase.from('floors').delete().eq('id', floorId);
        if (error) throw error;
    },

    async updateFloorName(floorId: string, name: string, description: string = '') {
        const { error } = await supabase.from('floors').update({ name, description }).eq('id', floorId);
        if (error) throw error;
    },

    async addUnit(floorId: string, name: string) {
        const { error } = await supabase.from('units').insert({ floor_id: floorId, name });
        if (error) throw error;
    },

    async deleteUnit(unitId: string) {
        const { error } = await supabase.from('units').delete().eq('id', unitId);
        if (error) throw error;
    },

    async addArea(unitId: string, name: string, description: string = '') {
        // 1. Insert Area and return ID
        const { data, error } = await supabase.from('areas').insert({
            unit_id: unitId,
            name,
            description,
            status: 'NOT_STARTED',
            progress: 0
        }).select().single();

        if (error) throw error;
        const areaId = data.id;

        // 2. Determine Preset
        const areaNameLower = name.toLowerCase();
        let preset = CHECKLIST_PRESETS[areaNameLower];

        if (!preset) {
            if (areaNameLower.includes('bathroom') || areaNameLower.includes('bath')) preset = CHECKLIST_PRESETS['master bathroom'];
            else if (areaNameLower.includes('kitchen')) preset = CHECKLIST_PRESETS['kitchen'];
            else if (areaNameLower.includes('powder')) preset = CHECKLIST_PRESETS['powder room'];
            else if (areaNameLower.includes('laundry')) preset = CHECKLIST_PRESETS['laundry'];
            else preset = CHECKLIST_PRESETS['master bathroom']; // Default fallback for generic areas if we want, or leave empty
        }

        // 3. Insert Items
        if (preset && preset.length > 0) {
            const checklistPayload = preset.map(text => ({
                area_id: areaId,
                text: text,
                completed: 0
            }));

            const { error: checklistError } = await supabase
                .from('checklist_items')
                .insert(checklistPayload);

            if (checklistError) console.error("Failed to auto-populate checklist:", checklistError);
        }
    },

    async updateArea(areaId: string, updates: any) {
        const { error } = await supabase.from('areas').update(updates).eq('id', areaId);
        if (error) throw error;
    },

    async deleteArea(areaId: string) {
        const { error } = await supabase.from('areas').delete().eq('id', areaId);
        if (error) throw error;
    },

    // --- PRODUCTION LOGS ---

    async getProductionLogs(date: string, endDate?: string): Promise<UIWorkerWithLogs[]> {
        // 1. Get logs for the date or range
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

        const { data: logs, error: logsError } = await query;

        if (logsError) {
            console.error("Error fetching logs:", logsError);
            throw logsError;
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
                isJantile: log.is_jantile,
                isTicket: log.is_ticket,
                statusColor: log.status_color || 'white',
                notes: log.notes || '',
                workerId: worker.id,
                jobId: log.job_id // Ensure jobId is mapped
            };

            workerMap.get(worker.id)?.logs.push(uiLog);
        });

        return Array.from(workerMap.values());
    },

    async upsertLog(logId: string, date: Date, workerId: string, field: string, value: any) {
        const dateStr = formatDate(date);
        const payload: any = {
            id: logId,
            date: dateStr,
            worker_id: workerId
        };

        // Mapping (UI -> DB)
        switch (field) {
            case 'job': case 'jobName': case 'job_id': case 'jobId':
                payload.job_id = (value === '' || value === 'null') ? null : value;
                break;
            case 'pl': case 'plNumber': case 'pl_number':
                payload.pl_number = value;
                break;
            case 'unit':
                payload.unit = value;
                break;
            case 'reg': case 'regHours': case 'reg_hours':
                payload.reg_hours = parseFloat(value) || 0;
                break;
            case 'ot': case 'otHours': case 'ot_hours':
                payload.ot_hours = parseFloat(value) || 0;
                break;
            case 'tkt': case 'ticketNumber': case 'ticket_number':
                payload.ticket_number = value;
                break;
            case 'isTkt': case 'isTicket': case 'is_ticket':
                payload.is_ticket = value === true;
                break;
            case 'isJan': case 'isJantile': case 'is_jantile':
                payload.is_jantile = value === true;
                break;
            case 'status': case 'statusColor': case 'status_color':
                payload.status_color = value;
                break;
            case 'notes':
                payload.notes = value;
                break;
            default:
                // If the field is one of the ID/metadata fields, we only update if it was specified
                // but usually we just want to save specific changes.
                // If we don't recognize the field, we skip it.
                if (['id', 'worker_id', 'date'].includes(field)) return;
                console.log(`Ignored invalid field: ${field}`);
                return;
        }

        console.log(`Saving ${field} for log ${logId}...`);

        const { error } = await supabase
            .from('production_logs')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error("Save Error:", error);
            const errMsg = `Save Error: ${error.message}`;
            if (typeof window !== 'undefined' && (window as any).alert) (window as any).alert(errMsg);
        }
    },

    deleteLog: async (logId: string): Promise<void> => {
        const { error } = await supabase
            .from('production_logs')
            .delete()
            .eq('id', logId);

        if (error) {
            console.error("Error deleting log:", error);
            throw error;
        }
    },

    // --- CHECKLIST MANAGEMENT ---
    getChecklistItems: async (areaId: string) => {
        const { data, error } = await supabase
            .from('checklist_items')
            .select('*')
            .eq('area_id', areaId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    addChecklistItem: async (areaId: string, text: string) => {
        // Now saving 'status' as 'NOT_STARTED' by default.
        const { error } = await supabase
            .from('checklist_items')
            .insert({
                area_id: areaId,
                text,
                completed: 0, // Keep legacy
                status: 'NOT_STARTED'
            });
        if (error) throw error;
    },

    updateChecklistItem: async (itemId: string, updates: any) => {
        // Ensure we sync 'completed' if 'status' is present in updates
        if (updates.status) {
            updates.completed = updates.status === 'COMPLETED' ? 1 : 0;
        }

        const { error } = await supabase
            .from('checklist_items')
            .update(updates)
            .eq('id', itemId);
        if (error) throw error;
    },

    deleteChecklistItem: async (itemId: string) => {
        const { error } = await supabase
            .from('checklist_items')
            .delete()
            .eq('id', itemId);
        if (error) throw error;
    },


    async updateUnitName(unitId: string, name: string, description: string = '') {
        const { error } = await supabase
            .from('units')
            .update({ name, description })
            .eq('id', unitId);
        if (error) throw error;
    },

    // --- PHOTO MANAGEMENT ---

    async uploadAreaPhoto(areaId: string, uri: string) {
        // 1. Fetch the file to get a blob (Works for web and mobile expo)
        const response = await fetch(uri);
        const blob = await response.blob();

        const fileName = `${areaId}/${Date.now()}.jpg`;
        const filePath = `photos/${fileName}`;

        // 2. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('area-photos')
            .upload(filePath, blob, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('area-photos')
            .getPublicUrl(filePath);

        // 4. Record in Database
        const { error: dbError } = await supabase
            .from('area_photos')
            .insert({
                area_id: areaId,
                url: publicUrl,
                storage_path: filePath
            });

        if (dbError) throw dbError;

        return { url: publicUrl, storage_path: filePath };
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

function getInitials(name: string) {
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}
