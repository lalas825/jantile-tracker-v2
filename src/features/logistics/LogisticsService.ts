import { Platform } from 'react-native';
import { supabase } from '../../config/supabase';
import { db } from '../../powersync/db';
import * as Crypto from 'expo-crypto';
import { JobService } from '../jobs';

const useSupabase = Platform.OS === 'web' || (db as any).isMock;

// --- TYPES ---

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
    in_warehouse_qty: number;
    in_warehouse_pieces: number;
    unit: string;
    pcs_per_unit?: number;
    pieces_per_crate?: number;
    qty_damaged?: number;
    qty_missing?: number;
    expected_date?: string;
    grout_info?: string;
    caulk_info?: string;
    dim_length?: number;
    dim_width?: number;
    dim_thickness?: string;
    linear_feet?: number;
    trowel_preset?: string;
    yield_factor?: number;
    joint_width?: string;
    bag_weight?: number;
    parent_material_id?: string;
    sqft_per_piece?: number;
    created_at?: string;
    updated_at?: string;
}

export interface DeliveryTicket {
    id: string;
    job_id: string;
    job_name?: string;
    ticket_number: string;
    status: string;
    items: any[]; // Decoded JSON
    destination: string;
    requested_date: string;
    scheduled_time?: string;
    due_date?: string;
    due_time?: string;
    notes?: string;
    assigned_to?: string;
    assigned_worker_name?: string;
    truck_id?: string;
    supervisor_approved?: boolean;
    foreman_approved?: boolean;
    field_modified?: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface PurchaseOrderItem {
    id: string;
    po_id: string;
    material_id: string;
    quantity_ordered: number;
    received_qty?: number;
    item_cost: number;
    created_at?: string;
    // Enriched fields from project_materials
    product_name?: string;
    product_code?: string;
    material_category?: string;
    unit?: string;
    pcs_per_unit?: number;
    pieces_per_crate?: number;
    dims?: {
        length?: number;
        width?: number;
        thickness?: string;
    } | null;
}

export interface PurchaseOrder {
    id: string;
    job_id: string;
    job_name?: string;
    po_number: string;
    vendor: string;
    status: 'Draft' | 'Ordered' | 'Partial' | 'Received';
    order_date: string;
    expected_date?: string;
    scheduled_time?: string;
    total_amount: number;
    notes?: string;
    received_at?: string;
    received_by?: string;
    items?: PurchaseOrderItem[];
    created_at?: string;
    updated_at?: string;
}

// --- LOGISTICS SERVICE ---

export const LogisticsService = {

    // --- MATERIALS ---

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

    async getAllProjectMaterials(): Promise<ProjectMaterial[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('project_materials')
                .select('*')
                .order('category', { ascending: true })
                .order('product_name', { ascending: true });
            if (error) throw error;
            return data || [];
        }

        const result = await db.getAll(
            `SELECT * FROM project_materials ORDER BY category ASC, product_name ASC`
        );
        return result || [];
    },

    async saveProjectMaterial(material: Partial<ProjectMaterial>): Promise<void> {
        // Robust UUID fallback for web
        const generateId = () => {
            if (material.id && material.id !== '') return material.id;
            if (Platform.OS === 'web') {
                try {
                    // Try native Web Crypto if available (requires secure context)
                    return (self as any).crypto.randomUUID();
                } catch (e) {
                    // Fallback random string
                    return 'id-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
                }
            }
            return Crypto.randomUUID();
        };

        const id = generateId();
        const now = new Date().toISOString();

        if (useSupabase) {
            let { _new_area, ...cleanMaterial } = material as any;

            // Sanitize: Remove virtual fields that aren't real DB columns
            delete cleanMaterial.active_pos;
            delete cleanMaterial.nearest_expected_date;
            delete cleanMaterial.all_pos;
            delete cleanMaterial.jobs;

            // HANDLE AUTO-CREATION OF NEW AREA/UNIT
            if (_new_area) {
                try {
                    let targetUnitId = _new_area.unit_id;

                    // 1. Create Unit if needed
                    if (!targetUnitId && _new_area._new_unit_name) {
                        // Find a floor to attach to (default to first floor found for job)
                        const { data: floors } = await supabase.from('floors').select('id').eq('job_id', material.job_id).limit(1);
                        if (floors && floors.length > 0) {
                            targetUnitId = await JobService.addUnit(floors[0].id, _new_area._new_unit_name, 'logistics');
                        }
                    }

                    // 2. Create Area
                    if (targetUnitId) {
                        const newAreaId = await JobService.addArea(
                            targetUnitId,
                            _new_area.name,
                            _new_area.description || '',
                            '', // drawing page
                            'logistics'
                        );
                        cleanMaterial.area_id = newAreaId;

                        // MIGRATION: If we just created a real area from a virtual one,
                        // find all other items currently using this sub_location and move them to the real area.
                        try {
                            const targetSubLoc = _new_area.name;
                            const { data: others } = await supabase.from('project_materials')
                                .select('id')
                                .eq('job_id', cleanMaterial.job_id)
                                .ilike('sub_location', targetSubLoc)
                                .is('area_id', null);

                            if (others && others.length > 0) {
                                console.log(`[LogisticsService] Migrating ${others.length} items from virtual '${targetSubLoc}' to real area ${newAreaId}`);
                                await supabase.from('project_materials')
                                    .update({ area_id: newAreaId })
                                    .in('id', others.map(o => o.id));
                            }
                        } catch (migErr) {
                            console.error("Failed to migrate virtual items to real area:", migErr);
                        }
                    }
                } catch (areaErr) {
                    console.error("Failed to auto-create area in saveProjectMaterial:", areaErr);
                    // Continue anyway, it will just be unassigned or virtual
                }
            }

            // Defensive: ensure empty strings aren't sent to UUID columns
            if (cleanMaterial.area_id === '') cleanMaterial.area_id = null;
            if (cleanMaterial.job_id === '') cleanMaterial.job_id = null;
            if (cleanMaterial.parent_material_id === '') cleanMaterial.parent_material_id = null;

            // Ensure created_at is set for new items
            const payload = {
                ...cleanMaterial,
                id,
                updated_at: now,
                created_at: cleanMaterial.created_at || now
            };

            try {
                const { error } = await supabase.from('project_materials').upsert(payload);
                if (error) throw error;
            } catch (err: any) {
                if (Platform.OS === 'web') {
                    window.alert(`SUPABASE SAVE ERROR:\n${err.message || JSON.stringify(err)}`);
                }
                throw err;
            }
            return;
        }

        await db.writeTransaction(async (tx: any) => {
            await tx.execute(
                `INSERT OR REPLACE INTO project_materials (
                    id, job_id, area_id, sub_location, category, product_code, product_name, product_specs, zone,
                    net_qty, waste_percent, budget_qty, unit_cost, total_value, supplier, ordered_qty, shop_stock, in_transit,
                    received_at_job, unit, pcs_per_unit, pieces_per_crate, expected_date,
                    grout_info, caulk_info, dim_length, dim_width, dim_thickness,
                    trowel_preset, yield_factor,
                    joint_width, bag_weight, parent_material_id,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, material.job_id, material.area_id || null, material.sub_location || null, material.category,
                    material.product_code || null, material.product_name, material.product_specs || null, material.zone || null,
                    material.net_qty || 0, material.waste_percent || 10, material.budget_qty || 0,
                    material.unit_cost || 0, material.total_value || 0, material.supplier || null,
                    material.ordered_qty || 0, material.shop_stock || 0, material.in_transit || 0,
                    material.received_at_job || 0, material.unit || 'sqft', material.pcs_per_unit || 1, material.pieces_per_crate || 0,
                    material.expected_date || null,
                    material.grout_info || null, material.caulk_info || null,
                    material.dim_length || null, material.dim_width || null, material.dim_thickness || null,
                    material.trowel_preset || null, material.yield_factor || null,
                    material.joint_width || null, material.bag_weight || null, material.parent_material_id || null,
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

    // --- DELIVERY TICKETS ---

    async getDeliveryTickets(jobId: string): Promise<DeliveryTicket[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('delivery_tickets')
                .select('*')
                .eq('job_id', jobId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map((t: any) => {
                const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
                // EXTRACTION WORKAROUND: If truck_id is missing, try to find it in notes
                let truckId = t.truck_id;
                if (!truckId && t.notes?.includes('[Carrier: ')) {
                    const match = t.notes.match(/\[Carrier: (.*?)\]/);
                    if (match) truckId = match[1];
                }
                return { ...t, items, truck_id: truckId };
            });
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

    async generateNextTicketNumber(): Promise<string> {
        let maxNumber = 999;

        if (useSupabase) {
            const { data } = await supabase
                .from('delivery_tickets')
                .select('ticket_number');

            if (data) {
                data.forEach(t => {
                    const match = t.ticket_number?.match(/\d+/);
                    if (match) {
                        const num = parseInt(match[0], 10);
                        if (num > maxNumber) maxNumber = num;
                    }
                });
            }
        } else {
            const result = await db.getAll('SELECT ticket_number FROM delivery_tickets');
            result.forEach((t: any) => {
                const match = t.ticket_number?.match(/\d+/);
                if (match) {
                    const num = parseInt(match[0], 10);
                    if (num > maxNumber) maxNumber = num;
                }
            });
        }
        return `DT-${maxNumber + 1}`;
    },

    async saveDeliveryTicket(ticket: Partial<DeliveryTicket>): Promise<void> {
        const id = ticket.id && ticket.id !== '' ? ticket.id : Crypto.randomUUID();
        const now = new Date().toISOString();

        // Standardize Ticket Number to DT-XXXX sequence
        let ticket_number = ticket.ticket_number;
        if (!ticket_number || ticket_number.startsWith('TKT-')) {
            ticket_number = await LogisticsService.generateNextTicketNumber();
        }

        if (useSupabase) {
            // ROBUST SANITIZATION: Only keep real DB columns
            const allowedCols = [
                'id', 'job_id', 'ticket_number', 'status', 'items', 'destination',
                'requested_date', 'due_date', 'due_time', 'scheduled_time', 'notes',
                'assigned_to', 'truck_id', 'supervisor_approved', 'foreman_approved',
                'field_modified', 'job_name', 'created_by', 'created_at', 'updated_at'
            ];

            const sanitizedTicket: any = {};
            allowedCols.forEach(col => {
                if ((ticket as any)[col] !== undefined) sanitizedTicket[col] = (ticket as any)[col];
            });

            // UUID Fallback for truck_id
            let finalNotes = sanitizedTicket.notes || '';
            const rawTruckId = sanitizedTicket.truck_id;
            const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(rawTruckId || '');

            if (rawTruckId && !isUUID) {
                finalNotes = finalNotes.replace(/\[Carrier: .*?\]/g, '').trim();
                finalNotes = (finalNotes ? finalNotes + '\n' : '') + `[Carrier: ${rawTruckId}]`;
                sanitizedTicket.truck_id = null;
                sanitizedTicket.notes = finalNotes;
            }

            const payload = {
                ...sanitizedTicket,
                id,
                ticket_number,
                job_id: ticket.job_id && ticket.job_id !== '' ? ticket.job_id : null,
                items: ticket.items || [],
                updated_at: now
            };

            const { error } = await supabase.from('delivery_tickets').upsert(payload);
            if (error) {
                if (Platform.OS === 'web') {
                    window.alert(`SUPABASE SAVE ERROR:\n${error.message}\n${JSON.stringify(error)}`);
                }
                throw error;
            }
            return;
        }

        // PowerSync Transaction for ticket save + optional material updates
        await db.writeTransaction(async (tx: any) => {
            await tx.execute(
                `INSERT OR REPLACE INTO delivery_tickets (
                    id, job_id, job_name, ticket_number, status, items, destination,
                    requested_date, due_date, due_time, notes, assigned_to, truck_id,
                    supervisor_approved, foreman_approved, field_modified,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, ticket.job_id, ticket.job_name || null, ticket_number, ticket.status || 'draft',
                    JSON.stringify(ticket.items || []), ticket.destination,
                    ticket.requested_date, ticket.due_date || null, ticket.due_time || null,
                    ticket.notes || null, ticket.assigned_to || null, ticket.truck_id || null,
                    ticket.supervisor_approved ? 1 : 0,
                    ticket.foreman_approved ? 1 : 0,
                    ticket.field_modified ? 1 : 0,
                    ticket.created_by,
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

    async approveDeliveryTicket(ticketId: string, role: string): Promise<void> {
        const now = new Date().toISOString();
        const isForeman = role?.toLowerCase() === 'foreman';

        // 1. Fetch CURRENT state from DB to ensure we don't overwrite the other person's approval
        const { data: ticket, error: fetchErr } = await supabase
            .from('delivery_tickets')
            .select('foreman_approved, supervisor_approved')
            .eq('id', ticketId)
            .single();

        if (fetchErr) throw fetchErr;

        const updates: any = { updated_at: now };
        if (isForeman) {
            updates.foreman_approved = true;
        } else {
            updates.supervisor_approved = true;
        }

        // 2. Determine if BOTH are approved (using current DB state + this update)
        const isFA = isForeman || !!ticket.foreman_approved;
        const isSA = (!isForeman) || !!ticket.supervisor_approved;

        if (isFA && isSA) {
            updates.status = 'FIELD_APPROVED';
        }

        if (useSupabase) {
            const { error } = await supabase.from('delivery_tickets').update(updates).eq('id', ticketId);
            if (error) throw error;
        } else {
            const clauses = [];
            const params = [];
            if (updates.foreman_approved) { clauses.push('foreman_approved = 1'); }
            if (updates.supervisor_approved) { clauses.push('supervisor_approved = 1'); }
            if (updates.status) { clauses.push('status = ?'); params.push(updates.status); }
            params.push(now, ticketId);
            await db.execute(`UPDATE delivery_tickets SET ${clauses.join(', ')}, updated_at = ? WHERE id = ?`, params);
        }
    },

    async updateTicketStatus(ticketId: string, status: string, notes?: string, truckId?: string): Promise<void> {
        const now = new Date().toISOString();
        // PM Rejection Loop: If a Supervisor rejects, it goes back to DRAFT for the PM
        const finalStatus = status === 'REJECTED' ? 'DRAFT' : status;

        if (useSupabase) {
            const updates: any = { status: finalStatus, updated_at: now };
            if (notes) updates.notes = notes;
            if (truckId) {
                updates.notes = (updates.notes ? updates.notes + '\n' : '') + ` [Carrier: ${truckId}]`;
            }
            // When dragging back to PENDING_FIELD_REVIEW, reset approval flags for a clean review cycle
            if (finalStatus === 'PENDING_FIELD_REVIEW') {
                updates.foreman_approved = false;
                updates.supervisor_approved = false;
            }
            const { error } = await supabase.from('delivery_tickets').update(updates).eq('id', ticketId);
            if (error) throw error;
            return;
        }
        let query = `UPDATE delivery_tickets SET status = ?, notes = COALESCE(?, notes), updated_at = ?`;
        let params = [finalStatus, notes || null, now];

        if (truckId) {
            query += `, truck_id = ?`;
            params.push(truckId);
        }
        query += ` WHERE id = ?`;
        params.push(ticketId);

        await db.execute(query, params);
    },


    async getAllDeliveryTickets(): Promise<DeliveryTicket[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('delivery_tickets')
                .select(`
                    *,
                    jobs(name),
                    assigned_worker:workers!assigned_to(name)
                `)
                .order('created_at', { ascending: false });
            if (error) {
                console.error("DEBUG: getAllDeliveryTickets error:", error);
                // Fallback to simple select if join fails
                const { data: simpleData, error: simpleError } = await supabase
                    .from('delivery_tickets')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (simpleError) throw simpleError;
                return (simpleData || []).map((t: any) => ({
                    ...t,
                    items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
                }));
            }
            return (data || []).map((t: any) => ({
                ...t,
                job_name: t.job_name || t.jobs?.name,
                assigned_worker_name: t.assigned_worker?.name,
                items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
            }));
        }

        const result = await db.getAll(`
            SELECT dt.*, COALESCE(dt.job_name, j.name) as job_name, w.name as assigned_worker_name
            FROM delivery_tickets dt
            LEFT JOIN jobs j ON dt.job_id = j.id
            LEFT JOIN workers w ON dt.assigned_to = w.id
            ORDER BY dt.created_at DESC
        `);
        return result.map((t: any) => ({
            ...t,
            items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
        }));
    },

    async getOutboundTickets(): Promise<DeliveryTicket[]> {
        const all = await LogisticsService.getAllDeliveryTickets();
        const tickets = all.filter(t => {
            const s = (t.status || '').toUpperCase();
            return ['SCHEDULED', 'IN_TRANSIT', 'DISPATCHED'].includes(s);
        });

        // HYDRATION FIX: Legacy tickets might be missing product_code in the items JSON.
        // We fetch project materials on demand to fill gaps.
        const jobIdsToFetch = new Set<string>();
        tickets.forEach(t => {
            if (t.items && t.items.some((i: any) => !i.product_code && i.material_id && i.material_id !== 'VENDOR_DIRECT_ID')) {
                jobIdsToFetch.add(t.job_id);
            }
        });

        if (jobIdsToFetch.size > 0) {
            const materialsByJob: Record<string, ProjectMaterial[]> = {};
            await Promise.all(Array.from(jobIdsToFetch).map(async (jobId) => {
                try {
                    materialsByJob[jobId] = await LogisticsService.getProjectMaterials(jobId);
                } catch (e) {
                    console.warn(`Failed to hydrate materials for job ${jobId}`, e);
                }
            }));

            return tickets.map(t => {
                if (!t.items) return t;
                const jobMats = materialsByJob[t.job_id];
                if (!jobMats) return t;

                const hydratedItems = t.items.map((i: any) => {
                    if (i.product_code || i.material_id === 'VENDOR_DIRECT_ID') return i;
                    const mat = jobMats.find(m => m.id === i.material_id);
                    if (mat) {
                        return {
                            ...i,
                            product_code: mat.product_code,
                            category: i.category || mat.category,
                            dimensions: i.dimensions || mat.product_specs
                        };
                    }
                    return i;
                });
                return { ...t, items: hydratedItems };
            });
        }

        return tickets;
    },

    // --- PURCHASE ORDERS ---

    async getReceivingPOs(): Promise<PurchaseOrder[]> {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('*, jobs(name), po_items(*, project_materials(product_name, product_code, category, unit, pcs_per_unit, pieces_per_crate, dim_length, dim_width, dim_thickness, sqft_per_piece))')
                .not('status', 'in', '("Received","Received with Discrepancy")')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map((po: any) => ({
                ...po,
                job_name: po.jobs?.name,
                items: po.po_items.map((pi: any) => ({
                    ...pi,
                    product_name: pi.project_materials?.product_name,
                    product_code: pi.project_materials?.product_code,
                    material_category: pi.project_materials?.category,
                    unit: pi.project_materials?.unit,
                    pcs_per_unit: pi.project_materials?.pcs_per_unit,
                    pieces_per_crate: pi.project_materials?.pieces_per_crate,
                    sqft_per_piece: pi.project_materials?.sqft_per_piece,
                    dim_length: pi.project_materials?.dim_length,
                    dim_width: pi.project_materials?.dim_width,
                    dims: pi.project_materials ? {
                        length: pi.project_materials.dim_length,
                        width: pi.project_materials.dim_width,
                        thickness: pi.project_materials.dim_thickness
                    } : null
                }))
            }));
        }

        const result = await db.getAll(`
            SELECT po.*, j.name as job_name
            FROM purchase_orders po
            LEFT JOIN jobs j ON po.job_id = j.id
            WHERE po.status NOT IN ('Received', 'Received with Discrepancy')
            ORDER BY po.created_at DESC
        `);

        // Join items separately for PowerSync
        const pos = [];
        for (const po of result) {
            const items = (await db.getAll(`
                SELECT pi.*, pm.product_name, pm.product_code, pm.category as material_category, pm.unit, pm.pcs_per_unit, pm.pieces_per_crate, pm.dim_length, pm.dim_width, pm.dim_thickness, pm.sqft_per_piece
                FROM po_items pi
                JOIN project_materials pm ON pi.material_id = pm.id
                WHERE pi.po_id = ?
            `, [po.id])).map((item: any) => ({
                ...item,
                dims: {
                    length: item.dim_length,
                    width: item.dim_width,
                    thickness: item.dim_thickness
                }
            }));
            pos.push({ ...po, items });
        }
        return pos;
    },

    async getProcessedPOs() {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select(`
                    *,
                    jobs ( name ),
                    po_items (
                        *,
                        *,
                        project_materials ( product_name, product_code, category, unit, pcs_per_unit, pieces_per_crate, dim_length, dim_width, dim_thickness, sqft_per_piece )
                    ),
                    material_claims ( * )
                `)
                .in('status', ['Received', 'Received with Discrepancy'])
                .order('received_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            return (data || []).map((po: any) => ({
                ...po,
                job_name: po.jobs?.name,
                items: po.po_items.map((pi: any) => ({
                    ...pi,
                    product_name: pi.project_materials?.product_name,
                    product_code: pi.project_materials?.product_code,
                    material_category: pi.project_materials?.category,
                    unit: pi.project_materials?.unit,
                    pcs_per_unit: pi.project_materials?.pcs_per_unit,
                    pieces_per_crate: pi.project_materials?.pieces_per_crate,
                    sqft_per_piece: pi.project_materials?.sqft_per_piece,
                    dim_length: pi.project_materials?.dim_length,
                    dim_width: pi.project_materials?.dim_width,
                    dims: pi.project_materials ? {
                        length: pi.project_materials.dim_length,
                        width: pi.project_materials.dim_width,
                        thickness: pi.project_materials.dim_thickness
                    } : null
                })),
                discrepancies: po.material_claims
            }));
        }

        const result = await db.getAll(`
            SELECT po.*, j.name as job_name
            FROM purchase_orders po
            LEFT JOIN jobs j ON po.job_id = j.id
            WHERE po.status IN ('Received', 'Received with Discrepancy')
            ORDER BY po.received_at DESC
            LIMIT 20
        `);

        const pos = [];
        for (const po of result) {
            const items = (await db.getAll(`
                SELECT pi.*, pm.product_name, pm.product_code, pm.category as material_category, pm.unit, pm.pcs_per_unit, pm.pieces_per_crate, pm.dim_length, pm.dim_width, pm.dim_thickness, pm.sqft_per_piece
                FROM po_items pi
                JOIN project_materials pm ON pi.material_id = pm.id
                WHERE pi.po_id = ?
            `, [po.id])).map((item: any) => ({
                ...item,
                dims: {
                    length: item.dim_length,
                    width: item.dim_width,
                    thickness: item.dim_thickness
                }
            }));

            const discrepancies = await db.getAll(`
                SELECT * FROM material_claims WHERE po_id = ?
            `, [po.id]);

            pos.push({ ...po, items, discrepancies });
        }
        return pos;
    },

    async receivePurchaseOrder(
        poId: string,
        itemReceipts: {
            material_id: string,
            qty_received: number, // SQFT for tiles, Qty for others
            qty_ordered: number,
            condition: 'Verified' | 'Damaged' | 'Missing',
            notes?: string,
            photo_url?: string,
            pieces_received?: number,
            pieces_ordered?: number,
            crates_received?: number, // NEW: Bulk input
            pieces_per_crate?: number, // NEW: For calculation
            receipt_mode?: 'Bulk' | 'Granular'
        }[],
        userId?: string
    ) {
        if (useSupabase) {
            console.log(`[Supabase SERVICE] receivePurchaseOrder START for PO: ${poId}`, itemReceipts);
            for (const receipt of itemReceipts) {
                // 1. Update Project Materials Stock
                console.log(`[Supabase SERVICE] Processing material: ${receipt.material_id}`);
                const { data: mat, error: fetchError } = await supabase.from('project_materials')
                    .select('*, jobs(name)')
                    .eq('id', receipt.material_id)
                    .single();

                if (fetchError) {
                    console.error(`[Supabase SERVICE] Error fetching material ${receipt.material_id}:`, fetchError);
                    continue;
                }

                if (mat) {
                    let finalReceivedQty: number; // SQFT
                    let finalReceivedPieces: number;

                    // 1. DATA HYDRATION: Ensure sqft_per_piece is derived if missing
                    const derivedSqftPerPiece = mat.sqft_per_piece ||
                        ((mat.dim_length && mat.dim_width) ? (mat.dim_length * mat.dim_width) / 144 : (1 / (mat.pcs_per_unit || 1)));

                    // 2. MISSION FORMULAS: Bulk vs Granular
                    if (receipt.crates_received !== undefined && receipt.crates_received > 0 && receipt.pieces_per_crate) {
                        // REACTIVE BULK ENGINE
                        finalReceivedPieces = Math.round(receipt.crates_received * receipt.pieces_per_crate);
                        finalReceivedQty = finalReceivedPieces * derivedSqftPerPiece;
                        console.log(`[Supabase SERVICE] BULK Mode - Crates: ${receipt.crates_received}, PPC: ${receipt.pieces_per_crate} => ${finalReceivedPieces} Pcs, ${finalReceivedQty} Qty`);
                    } else {
                        // GRANULAR MODE
                        finalReceivedQty = Number(receipt.qty_received);
                        finalReceivedPieces = receipt.pieces_received || Math.round(finalReceivedQty / (derivedSqftPerPiece || 1));
                        console.log(`[Supabase SERVICE] GRANULAR Mode - Qty: ${finalReceivedQty} => ${finalReceivedPieces} Pcs`);
                    }

                    const missingQty = Math.max(0, receipt.qty_ordered - finalReceivedQty);

                    const updatePayload = {
                        shop_stock: (mat.shop_stock || 0) + (receipt.condition === 'Verified' ? finalReceivedQty : 0),
                        in_warehouse_qty: (mat.in_warehouse_qty || 0) + (receipt.condition === 'Verified' ? finalReceivedQty : 0),
                        in_warehouse_pieces: (mat.in_warehouse_pieces || 0) + (receipt.condition === 'Verified' ? finalReceivedPieces : 0),
                        qty_damaged: (mat.qty_damaged || 0) + (receipt.condition === 'Damaged' ? finalReceivedQty : 0),
                        qty_missing: (mat.qty_missing || 0) + missingQty,
                        in_transit: Math.max(0, (mat.in_transit || 0) - receipt.qty_ordered),
                        ordered_qty: Math.max(0, (mat.ordered_qty || 0) - receipt.qty_ordered),
                        updated_at: new Date().toISOString()
                    };

                    console.log(`[Supabase SERVICE] Updating project_materials:`, updatePayload);
                    const { error: updateError } = await supabase.from('project_materials')
                        .update(updatePayload)
                        .eq('id', receipt.material_id);

                    if (updateError) {
                        console.error(`[Supabase SERVICE] Update Error for ${receipt.material_id}:`, updateError);
                        // Fallback attempt: Try without in_warehouse_pieces if the column migration failed
                        if (updateError.message?.includes('column "in_warehouse_pieces" does not exist')) {
                            console.warn("[Supabase SERVICE] Fallback: Retrying update without in_warehouse_pieces...");
                            const { in_warehouse_pieces, ...fallbackPayload } = updatePayload;
                            const { error: fallbackError } = await supabase.from('project_materials').update(fallbackPayload).eq('id', receipt.material_id);
                            if (fallbackError) console.error("[Supabase SERVICE] Fallback update also failed:", fallbackError);
                        }
                    } else {
                        console.log(`[Supabase SERVICE] Material ${receipt.material_id} updated successfully.`);
                    }

                    // 2. Log Discrepancies or Documentation if any
                    const hasDiscrepancy = receipt.condition !== 'Verified' || finalReceivedQty < (receipt.qty_ordered - 0.01);
                    const hasDocumentation = receipt.notes || receipt.photo_url;

                    if (hasDiscrepancy || hasDocumentation) {
                        const { error: claimError } = await supabase.from('material_claims').insert({
                            po_id: poId,
                            material_id: receipt.material_id,
                            expected_qty: receipt.qty_ordered,
                            received_qty: finalReceivedQty,
                            difference: receipt.qty_ordered - finalReceivedQty,
                            pieces_expected: receipt.pieces_ordered,
                            pieces_received: receipt.pieces_received,
                            pieces_difference: (receipt.pieces_ordered || 0) - (receipt.pieces_received || 0),
                            condition_flag: receipt.condition === 'Verified' ? 'V' : (receipt.condition === 'Damaged' ? 'D' : 'M'),
                            receipt_mode: receipt.receipt_mode || 'Granular',
                            notes: receipt.notes,
                            photo_url: receipt.photo_url,
                            created_by: userId
                        });
                        if (claimError) console.error("[Supabase SERVICE] Claim/Doc Error (non-fatal, receipt still processed):", claimError);
                    }

                    // 3. Update PO Item received qty
                    await supabase.from('po_items')
                        .update({ received_qty: finalReceivedQty })
                        .match({ po_id: poId, material_id: receipt.material_id });
                } else {
                    console.warn(`[Supabase SERVICE] Material not found in project_materials: ${receipt.material_id}`);
                }
            }

            const overallHasDiscrepancy = itemReceipts.some(r => r.condition !== 'Verified' || (r.pieces_received !== undefined ? r.pieces_received < (r.pieces_ordered || 0) : r.qty_received < r.qty_ordered));

            console.log(`[Supabase SERVICE] Updating PO status. Discrepancy: ${overallHasDiscrepancy}`);
            const { error: poError } = await supabase.from('purchase_orders').update({
                status: overallHasDiscrepancy ? 'Received with Discrepancy' : 'Received',
                received_at: new Date().toISOString(),
                received_by: userId,
                updated_at: new Date().toISOString()
            }).eq('id', poId);

            if (poError) console.error("[Supabase SERVICE] PO status update failed (materials were received but PO status not updated):", poError);

            // Automated PM Alerts
            if (overallHasDiscrepancy) {
                const { data: poData } = await supabase.from('purchase_orders')
                    .select('po_number, vendor, job_id, jobs(name, assigned_pm)')
                    .eq('id', poId)
                    .single();

                const typedPO = poData as any;
                if (typedPO?.jobs?.assigned_pm) {
                    const damagedItems = itemReceipts.filter(r => r.condition === 'Damaged' || r.condition === 'Missing');
                    if (damagedItems.length > 0) {
                        const conditionStr = damagedItems.map(d => `${d.qty_ordered - d.qty_received} ${d.condition}`).join(', ');
                        await LogisticsService.sendNotification({
                            user_id: typedPO.jobs.assigned_pm,
                            title: 'Discrepancy Alert',
                            message: `Discrepancy Alert: PO #${typedPO.po_number} from ${typedPO.vendor} arrived with issues: ${conditionStr}.`,
                            link: `/warehouse/receiving?po=${poId}`,
                            type: 'alert'
                        });
                    }
                }
            }
            console.log(`[Supabase SERVICE] receivePurchaseOrder COMPLETE for PO: ${poId}`);
            return;
        }

        return db.writeTransaction(async (tx: any) => {
            for (const receipt of itemReceipts) {
                const mat = await tx.get('SELECT shop_stock, in_warehouse_qty, in_warehouse_pieces, ordered_qty, unit, pcs_per_unit, dim_length, dim_width, sqft_per_piece FROM project_materials WHERE id = ?', [receipt.material_id]);
                if (mat) {
                    let finalReceivedQty: number;
                    let finalReceivedPieces: number;

                    // 1. DATA HYDRATION: Ensure sqft_per_piece is derived if missing
                    const derivedSqftPerPiece = mat.sqft_per_piece ||
                        ((mat.dim_length && mat.dim_width) ? (mat.dim_length * mat.dim_width) / 144 : (1 / (mat.pcs_per_unit || 1)));

                    // 2. MISSION FORMULAS: Bulk vs Granular
                    if (receipt.crates_received !== undefined && receipt.crates_received > 0 && receipt.pieces_per_crate) {
                        // REACTIVE BULK ENGINE
                        finalReceivedPieces = Math.round(receipt.crates_received * receipt.pieces_per_crate);
                        finalReceivedQty = finalReceivedPieces * derivedSqftPerPiece;
                    } else {
                        // GRANULAR MODE
                        finalReceivedQty = Number(receipt.qty_received);
                        finalReceivedPieces = receipt.pieces_received || Math.round(finalReceivedQty / (derivedSqftPerPiece || 1));
                    }

                    // Update Project Materials
                    const missingQty = Math.max(0, receipt.qty_ordered - finalReceivedQty);

                    await tx.execute(`
                        UPDATE project_materials
                        SET shop_stock = COALESCE(shop_stock, 0) + ?,
                            in_warehouse_qty = COALESCE(in_warehouse_qty, 0) + ?,
                            in_warehouse_pieces = COALESCE(in_warehouse_pieces, 0) + ?,
                            qty_damaged = COALESCE(qty_damaged, 0) + ?,
                            qty_missing = COALESCE(qty_missing, 0) + ?,
                            in_transit = MAX(0, COALESCE(in_transit, 0) - ?),
                            ordered_qty = MAX(0, COALESCE(ordered_qty, 0) - ?),
                            updated_at = datetime('now')
                        WHERE id = ?
                    `, [
                        receipt.condition === 'Verified' ? finalReceivedQty : 0,
                        receipt.condition === 'Verified' ? finalReceivedQty : 0,
                        receipt.condition === 'Verified' ? finalReceivedPieces : 0,
                        receipt.condition === 'Damaged' ? finalReceivedQty : 0,
                        missingQty,
                        receipt.qty_ordered,
                        receipt.qty_ordered,
                        receipt.material_id
                    ]);

                    // Log Discrepancy or Documentation
                    const hasDiscrepancy = receipt.condition !== 'Verified' || finalReceivedQty < (receipt.qty_ordered - 0.01);
                    const hasDocumentation = receipt.notes || receipt.photo_url;

                    if (hasDiscrepancy || hasDocumentation) {
                        await tx.execute(`
                            INSERT INTO material_claims (po_id, material_id, expected_qty, received_qty, difference, pieces_expected, pieces_received, pieces_difference, condition_flag, receipt_mode, notes, photo_url, created_by, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                        `, [
                            poId,
                            receipt.material_id,
                            receipt.qty_ordered,
                            finalReceivedQty,
                            receipt.qty_ordered - finalReceivedQty,
                            receipt.pieces_ordered,
                            receipt.pieces_received,
                            (receipt.pieces_ordered || 0) - (receipt.pieces_received || 0),
                            receipt.condition === 'Verified' ? 'V' : (receipt.condition === 'Damaged' ? 'D' : 'M'),
                            receipt.receipt_mode || 'Granular',
                            receipt.notes,
                            receipt.photo_url,
                            userId
                        ]);
                    }

                    // Update PO Item
                    await tx.execute(`
                        UPDATE po_items SET received_qty = ? WHERE po_id = ? AND material_id = ?
                    `, [finalReceivedQty, poId, receipt.material_id]);
                }
            }

            const overallHasDiscrepancy = itemReceipts.some(r => r.condition !== 'Verified' || (r.pieces_received !== undefined ? r.pieces_received < (r.pieces_ordered || 0) : r.qty_received < r.qty_ordered));

            await tx.execute(`
                UPDATE purchase_orders
                SET status = ?, received_at = datetime('now'), received_by = ?, updated_at = datetime('now')
                WHERE id = ?
            `, [overallHasDiscrepancy ? 'Received with Discrepancy' : 'Received', userId, poId]);
        });
    },

    async revertPurchaseOrderIntake(poId: string, userId: string) {
        if (useSupabase) {
            console.log(`[Supabase SERVICE] revertPurchaseOrderIntake START for PO: ${poId}`);

            // 1. Fetch current PO items and claims
            const { data: poItems, error: itemsError } = await supabase.from('po_items').select('*').eq('po_id', poId);
            const { data: claims, error: claimsError } = await supabase.from('material_claims').select('*').eq('po_id', poId);

            if (itemsError) throw itemsError;
            if (claimsError) throw claimsError;

            // Rollback each item that was received
            for (const item of (poItems || [])) {
                // IMPORTANT: Process all items, even those with 0 received_qty (they could be 'Missing')
                const claim = claims?.find(c => c.material_id === item.material_id);
                const { data: mat } = await supabase.from('project_materials').select('*').eq('id', item.material_id).single();

                if (mat) {
                    const condition = claim?.condition_flag || 'V';
                    const isVerified = condition === 'V';
                    const isDamaged = condition === 'D';
                    const receivedQty = item.received_qty || 0;
                    const expectedQty = item.quantity_ordered || 0;
                    const missingQty = Math.max(0, expectedQty - receivedQty);

                    // Calculate pieces if not in claim (for Verified items)
                    const derivedSqftPerPiece = mat.sqft_per_piece ||
                        ((mat.dim_length && mat.dim_width) ? (mat.dim_length * mat.dim_width) / 144 : (1 / (mat.pcs_per_unit || 1)));
                    const receivedPieces = claim?.pieces_received || Math.round(receivedQty / (derivedSqftPerPiece || 1));

                    const updatePayload = {
                        shop_stock: Math.max(0, (mat.shop_stock || 0) - (isVerified ? receivedQty : 0)),
                        in_warehouse_qty: Math.max(0, (mat.in_warehouse_qty || 0) - (isVerified ? receivedQty : 0)),
                        in_warehouse_pieces: Math.max(0, (mat.in_warehouse_pieces || 0) - (isVerified ? receivedPieces : 0)),
                        qty_damaged: Math.max(0, (mat.qty_damaged || 0) - (isDamaged ? receivedQty : 0)),
                        qty_missing: Math.max(0, (mat.qty_missing || 0) - missingQty),
                        ordered_qty: (mat.ordered_qty || 0) + expectedQty,
                        in_transit: (mat.in_transit || 0) + expectedQty,
                        updated_at: new Date().toISOString()
                    };

                    console.log(`[Supabase SERVICE] Reverting material ${item.material_id}:`, updatePayload);
                    await supabase.from('project_materials').update(updatePayload).eq('id', item.material_id);
                }
            }

            // 2. Clear PO Items received_qty
            await supabase.from('po_items').update({ received_qty: 0 }).eq('po_id', poId);

            // 3. Delete Claims
            await supabase.from('material_claims').delete().eq('po_id', poId);

            // 4. Reset PO Status
            await supabase.from('purchase_orders').update({
                status: 'Ordered',
                received_at: null,
                received_by: null,
                updated_at: new Date().toISOString()
            }).eq('id', poId);

            console.log(`[Supabase SERVICE] revertPurchaseOrderIntake COMPLETE for PO: ${poId}`);
            return;
        }

        return db.writeTransaction(async (tx: any) => {
            // 1. Fetch items and claims
            const poItems = await tx.getAll('SELECT * FROM po_items WHERE po_id = ?', [poId]);
            const claims = await tx.getAll('SELECT * FROM material_claims WHERE po_id = ?', [poId]);

            for (const item of poItems) {
                const claim = claims.find((c: any) => c.material_id === item.material_id);
                const mat = await tx.get('SELECT shop_stock, in_warehouse_qty, in_warehouse_pieces, qty_damaged, qty_missing, ordered_qty, in_transit, sqft_per_piece, dim_length, dim_width, pcs_per_unit FROM project_materials WHERE id = ?', [item.material_id]);

                if (mat) {
                    const condition = claim?.condition_flag || 'V';
                    const isVerified = condition === 'V';
                    const isDamaged = condition === 'D';
                    const receivedQty = item.received_qty || 0;
                    const expectedQty = item.quantity_ordered || 0;
                    const missingQty = Math.max(0, expectedQty - receivedQty);

                    // Calculate pieces if not in claim (for Verified items)
                    const derivedSqftPerPiece = mat.sqft_per_piece ||
                        ((mat.dim_length && mat.dim_width) ? (mat.dim_length * mat.dim_width) / 144 : (1 / (mat.pcs_per_unit || 1)));
                    const receivedPieces = claim?.pieces_received || Math.round(receivedQty / (derivedSqftPerPiece || 1));

                    await tx.execute(`
                        UPDATE project_materials
                        SET shop_stock = MAX(0, shop_stock - ?),
                            in_warehouse_qty = MAX(0, in_warehouse_qty - ?),
                            in_warehouse_pieces = MAX(0, in_warehouse_pieces - ?),
                            qty_damaged = MAX(0, qty_damaged - ?),
                            qty_missing = MAX(0, qty_missing - ?),
                            ordered_qty = ordered_qty + ?,
                            in_transit = in_transit + ?,
                            updated_at = datetime('now')
                        WHERE id = ?
                    `, [
                        isVerified ? receivedQty : 0,
                        isVerified ? receivedQty : 0,
                        isVerified ? receivedPieces : 0,
                        isDamaged ? receivedQty : 0,
                        missingQty,
                        expectedQty,
                        expectedQty,
                        item.material_id
                    ]);
                }
            }

            // 2. Clear PO Items
            await tx.execute('UPDATE po_items SET received_qty = 0 WHERE po_id = ?', [poId]);

            // 3. Delete Claims
            await tx.execute('DELETE FROM material_claims WHERE po_id = ?', [poId]);

            // 4. Reset PO
            await tx.execute(`
                UPDATE purchase_orders
                SET status = 'Ordered',
                    received_at = NULL,
                    received_by = NULL,
                    updated_at = datetime('now')
                WHERE id = ?
            `, [poId]);
        });
    },

    // --- NOTIFICATIONS ---

    async sendNotification(notification: { user_id: string, title: string, message: string, link?: string, type?: string }) {
        if (useSupabase) {
            await supabase.from('system_notifications').insert(notification);
            return;
        }
        await db.execute(`
            INSERT INTO system_notifications (user_id, title, message, link, type, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [notification.user_id, notification.title, notification.message, notification.link, notification.type || 'alert']);
    },

    async createReorderPO(originalPoId: string, shortfallItems: { material_id: string, qty: number }[], userId: string) {
        if (useSupabase) {
            const { data: original } = await supabase.from('purchase_orders').select('*').eq('id', originalPoId).single();
            if (!original) throw new Error("Original PO not found");

            const { data: newPO, error: poErr } = await supabase.from('purchase_orders').insert({
                job_id: original.job_id,
                po_number: `${original.po_number}-R1`,
                vendor: original.vendor,
                status: 'Draft',
                order_date: new Date().toISOString().split('T')[0],
                parent_po_id: originalPoId,
                notes: `Re-order for shortfall from PO #${original.po_number}`
            }).select().single();

            if (poErr) throw poErr;

            for (const item of shortfallItems) {
                await supabase.from('po_items').insert({
                    po_id: newPO.id,
                    material_id: item.material_id,
                    quantity_ordered: item.qty,
                    item_cost: 0 // PM to verify cost
                });
            }
            return newPO;
        }

        return db.writeTransaction(async (tx: any) => {
            const original = await tx.get('SELECT * FROM purchase_orders WHERE id = ?', [originalPoId]);
            if (!original) throw new Error("Original PO not found");

            const newId = original.id + "-R1"; // Simplified for PowerSync demo
            await tx.execute(`
                INSERT INTO purchase_orders (id, job_id, po_number, vendor, status, order_date, parent_po_id, notes, created_at)
                VALUES (?, ?, ?, ?, 'Draft', date('now'), ?, ?, datetime('now'))
            `, [newId, original.job_id, original.po_number + "-R1", original.vendor, originalPoId, `Re-order for shortfall from PO #${original.po_number}`]);

            for (const item of shortfallItems) {
                await tx.execute(`
                    INSERT INTO po_items (po_id, material_id, quantity_ordered, item_cost, created_at)
                    VALUES (?, ?, ?, 0, datetime('now'))
                `, [newId, item.material_id, item.qty]);
            }
        });
    },

    // --- DISCREPANCY ANALYTICS ---

    async getDiscrepancyAnalytics() {
        if (useSupabase) {
            const { data, error } = await supabase.rpc('get_vendor_damage_leaderboard');
            if (!error) return data;

            // Fallback to manual aggregation if RPC missing
            const { data: claims } = await supabase.from('material_claims').select('po_id, condition_flag, purchase_orders(vendor)');
            const stats: any = {};
            claims?.forEach((c: any) => {
                const vendor = c.purchase_orders?.vendor || 'Unknown';
                if (!stats[vendor]) stats[vendor] = { vendor, total: 0, damaged: 0 };
                stats[vendor].total++;
                if (c.condition_flag === 'D' || c.condition_flag === 'M') stats[vendor].damaged++;
            });
            return Object.values(stats).sort((a: any, b: any) => (b.damaged / b.total) - (a.damaged / a.total));
        }
        return [];
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

    // --- WAREHOUSE ---

    async getWarehouseInventory(): Promise<any[]> {
        if (useSupabase) {
            // Priority: Try the full query with new tracking column
            try {
                const { data, error } = await supabase
                    .from('project_materials')
                    .select(`
                        *,
                        jobs (name)
                    `)
                    .or('in_warehouse_qty.gt.0,shop_stock.gt.0,received_at_job.gt.0,ordered_qty.gt.0,job_id.is.null')
                    .order('created_at', { ascending: false });

                if (!error) {
                    console.log("DEBUG: getWarehouseInventory (Primary) length:", data?.length);
                    return data || [];
                }

                console.warn("DEBUG: Primary inventory query failed, trying fallback...", error.message);
            } catch (e) {
                console.warn("DEBUG: Primary inventory query crashed, trying fallback...");
            }

            // Fallback: Use only shop_stock if the new column isn't ready
            const { data, error: fallbackError } = await supabase
                .from('project_materials')
                .select(`
                    *,
                    jobs (name)
                `)
                .or('shop_stock.gt.0,job_id.is.null')
                .order('created_at', { ascending: false });

            if (fallbackError) {
                console.error("DEBUG: getWarehouseInventory (Fallback) error:", fallbackError);
                throw fallbackError;
            }
            console.log("DEBUG: getWarehouseInventory (Fallback) length:", data?.length);
            return data || [];
        }

        // Native
        const materials = await db.getAll(`
            SELECT * FROM project_materials
            WHERE in_warehouse_qty > 0 OR shop_stock > 0 OR received_at_job > 0 OR ordered_qty > 0
        `);
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
    },
    async manualStockUpdate(materialId: string, adjustment: number) {
        if (useSupabase) {
            const { data: mat } = await supabase.from('project_materials')
                .select('in_warehouse_qty, shop_stock')
                .eq('id', materialId)
                .single();

            if (mat) {
                await supabase.from('project_materials').update({
                    in_warehouse_qty: (mat.in_warehouse_qty || 0) + adjustment,
                    shop_stock: (mat.shop_stock || 0) + adjustment,
                    updated_at: new Date().toISOString()
                }).eq('id', materialId);
            }
            return;
        }

        await db.execute(`
            UPDATE project_materials
            SET in_warehouse_qty = COALESCE(in_warehouse_qty, 0) + ?,
                shop_stock = COALESCE(shop_stock, 0) + ?,
                updated_at = datetime('now')
            WHERE id = ?
        `, [adjustment, adjustment, materialId]);
    },

    async allocateGeneralStock(params: {
        sourceMaterialId: string,
        jobId: string,
        jobName: string,
        areaId?: string,
        qty: number,
        category: string,
        productName: string,
        productCode?: string,
        unit: string,
        userId: string,
        targetTicketId?: string
    }): Promise<void> {
        const { sourceMaterialId, jobId, jobName, areaId, qty, category, productName, productCode, unit, userId, targetTicketId } = params;
        const now = new Date().toISOString();

        if (useSupabase) {
            // 1. Get Source Material
            const { data: sourceMat, error: fetchErr } = await supabase
                .from('project_materials')
                .select('*')
                .eq('id', sourceMaterialId)
                .single();

            if (fetchErr || !sourceMat) throw fetchErr || new Error("Source material not found");

            // 2. Decrement Source Stock
            const { error: updateSourceErr } = await supabase
                .from('project_materials')
                .update({
                    shop_stock: (sourceMat.shop_stock || 0) - qty,
                    in_warehouse_qty: (sourceMat.in_warehouse_qty || 0) - qty,
                    updated_at: now
                })
                .eq('id', sourceMaterialId);

            if (updateSourceErr) throw updateSourceErr;

            // 3. Find or Create Target Material for Job
            const { data: existingTarget } = await supabase
                .from('project_materials')
                .select('*')
                .eq('job_id', jobId)
                .eq('product_name', productName)
                .maybeSingle();

            let targetMatId: string;
            if (existingTarget) {
                targetMatId = existingTarget.id;
                const { error: updateTargetErr } = await supabase
                    .from('project_materials')
                    .update({
                        shop_stock: (existingTarget.shop_stock || 0) + qty,
                        updated_at: now
                    })
                    .eq('id', targetMatId);
                if (updateTargetErr) throw updateTargetErr;
            } else {
                targetMatId = Crypto.randomUUID();
                const { error: createTargetErr } = await supabase
                    .from('project_materials')
                    .insert({
                        id: targetMatId,
                        job_id: jobId,
                        area_id: areaId || null,
                        sub_location: areaId ? null : 'Warehouse Allocation',
                        category,
                        product_name: productName,
                        product_code: productCode,
                        unit,
                        shop_stock: qty,
                        net_qty: 0,
                        waste_percent: 0,
                        budget_qty: 0,
                        unit_cost: sourceMat.unit_cost || 0,
                        total_value: 0,
                        ordered_qty: 0,
                        in_transit: 0,
                        received_at_job: 0,
                        in_warehouse_qty: 0,
                        in_warehouse_pieces: 0,
                        created_at: now,
                        updated_at: now
                    });
                if (createTargetErr) throw createTargetErr;
            }

            // 4. Handle Delivery Ticket
            if (targetTicketId) {
                const { data: ticket } = await supabase
                    .from('delivery_tickets')
                    .select('*')
                    .eq('id', targetTicketId)
                    .single();

                if (ticket) {
                    const items = ticket.items || [];
                    const existingItemIndex = items.findIndex((i: any) => i.material_id === targetMatId);
                    if (existingItemIndex > -1) {
                        items[existingItemIndex].qty += qty;
                    } else {
                        items.push({
                            material_id: targetMatId,
                            product_name: productName,
                            product_code: productCode,
                            category,
                            qty,
                            unit
                        });
                    }

                    await supabase
                        .from('delivery_tickets')
                        .update({ items, updated_at: now })
                        .eq('id', targetTicketId);
                }
            } else {
                const ticketNumber = await LogisticsService.generateNextTicketNumber();
                const ticketId = Crypto.randomUUID();
                await supabase
                    .from('delivery_tickets')
                    .insert({
                        id: ticketId,
                        job_id: jobId,
                        job_name: jobName,
                        ticket_number: ticketNumber,
                        status: 'DRAFT',
                        destination: 'Inventory',
                        requested_date: now.split('T')[0],
                        items: [{
                            material_id: targetMatId,
                            product_name: productName,
                            product_code: productCode,
                            category,
                            qty,
                            unit
                        }],
                        created_by: userId,
                        created_at: now,
                        updated_at: now
                    });
            }
            return;
        }

        // Native PowerSync
        await db.writeTransaction(async (tx: any) => {
            const sourceMat = await tx.get(`SELECT * FROM project_materials WHERE id = ?`, [sourceMaterialId]);
            if (!sourceMat) throw new Error("Source material not found");

            await tx.execute(
                `UPDATE project_materials SET shop_stock = ?, in_warehouse_qty = ?, updated_at = ? WHERE id = ?`,
                [sourceMat.shop_stock - qty, sourceMat.in_warehouse_qty - qty, now, sourceMaterialId]
            );

            const existingTarget = await tx.get(`SELECT * FROM project_materials WHERE job_id = ? AND product_name = ?`, [jobId, productName]);

            let targetMatId: string;
            if (existingTarget) {
                targetMatId = existingTarget.id;
                await tx.execute(
                    `UPDATE project_materials SET shop_stock = ?, updated_at = ? WHERE id = ?`,
                    [existingTarget.shop_stock + qty, now, targetMatId]
                );
            } else {
                targetMatId = Crypto.randomUUID();
                await tx.execute(
                    `INSERT INTO project_materials (id, job_id, area_id, sub_location, category, product_name, product_code, unit, shop_stock, net_qty, waste_percent, budget_qty, unit_cost, total_value, ordered_qty, in_transit, received_at_job, in_warehouse_qty, in_warehouse_pieces, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0, ?, ?)`,
                    [targetMatId, jobId, areaId || null, areaId ? null : 'Warehouse Allocation', category, productName, productCode || null, unit, qty, sourceMat.unit_cost || 0, now, now]
                );
            }

            if (targetTicketId) {
                const ticket = await tx.get(`SELECT * FROM delivery_tickets WHERE id = ?`, [targetTicketId]);
                if (ticket) {
                    const items = JSON.parse(ticket.items || '[]');
                    const existingItemIndex = items.findIndex((i: any) => i.material_id === targetMatId);
                    if (existingItemIndex > -1) {
                        items[existingItemIndex].qty += qty;
                    } else {
                        items.push({ material_id: targetMatId, product_name: productName, product_code: productCode, category, qty, unit });
                    }
                    await tx.execute(`UPDATE delivery_tickets SET items = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(items), now, targetTicketId]);
                }
            } else {
                const ticketNumber = await LogisticsService.generateNextTicketNumber();
                const ticketId = Crypto.randomUUID();
                await tx.execute(
                    `INSERT INTO delivery_tickets (id, job_id, job_name, ticket_number, status, destination, requested_date, items, created_by, created_at, updated_at)
                     VALUES (?, ?, ?, ?, 'draft', 'Inventory', ?, ?, ?, ?, ?)`,
                    [ticketId, jobId, jobName, ticketNumber, now.split('T')[0], JSON.stringify([{ material_id: targetMatId, product_name: productName, product_code: productCode, category, qty, unit }]), userId, now, now]
                );
            }
        });
    },

    async receiveDeliveryTicket(
        ticketId: string,
        itemReceipts: {
            material_id: string,
            product_name?: string,
            qty_received: number,
            qty_expected?: number,
            condition: 'Verified' | 'Damaged' | 'Missing',
            notes?: string,
            photo_url?: string
        }[],
        userId: string
    ) {
        const now = new Date().toISOString();
        const overallHasDiscrepancy = itemReceipts.some(r => r.condition !== 'Verified' || (r.qty_expected !== undefined && r.qty_received < r.qty_expected));
        const finalStatus = overallHasDiscrepancy ? 'RECEIVED_WITH_SHORTAGE' : 'RECEIVED';

        if (useSupabase) {
            let ticketNumber = ticketId;
            const { data: td } = await supabase.from('delivery_tickets').select('ticket_number').eq('id', ticketId).single();
            if (td?.ticket_number) ticketNumber = td.ticket_number;

            // 1. Update Ticket Status
            const { error: ticketError } = await supabase
                .from('delivery_tickets')
                .update({ status: finalStatus, updated_at: now })
                .eq('id', ticketId);
            if (ticketError) throw ticketError;

            // 2. Process Items
            for (const receipt of itemReceipts) {
                // Fetch current material to update received_at_job
                const { data: mat } = await supabase
                    .from('project_materials')
                    .select('received_at_job, qty_damaged, qty_missing, in_warehouse_qty')
                    .eq('id', receipt.material_id)
                    .single();

                if (mat) {
                    const receivedQty = receipt.condition === 'Verified' ? receipt.qty_received : 0;
                    const damagedQty = receipt.condition === 'Damaged' ? receipt.qty_received : 0;
                    const newWarehouseQty = (mat.in_warehouse_qty || 0) - receivedQty;

                    // Warehouse Mismatch Check
                    if (newWarehouseQty < 0) {
                        await supabase.from('job_issues').insert({
                            id: Crypto.randomUUID(),
                            job_id: (await supabase.from('delivery_tickets').select('job_id').eq('id', ticketId).single()).data?.job_id,
                            type: 'Inventory Mismatch',
                            priority: 'High',
                            status: 'open',
                            description: `CRITICAL: Warehouse inventory negative after receipt (DT #${ticketNumber}). Item: ${receipt.material_id}. System: ${newWarehouseQty}`,
                            created_by: userId,
                            created_at: now,
                            updated_at: now
                        });
                    }

                    const updatePayload: any = {
                        received_at_job: (mat.received_at_job || 0) + receivedQty,
                        in_warehouse_qty: newWarehouseQty,
                        qty_damaged: (mat.qty_damaged || 0) + damagedQty,
                        qty_missing: (mat.qty_missing || 0) + (receipt.condition === 'Missing' ? receipt.qty_received : 0),
                        updated_at: now
                    };
                    await supabase.from('project_materials').update(updatePayload).eq('id', receipt.material_id);
                }

                // Log as issue if damaged/missing/shortage
                if (receipt.condition !== 'Verified' || (receipt.qty_expected !== undefined && receipt.qty_received < receipt.qty_expected)) {
                    let desc = `Issue during delivery receipt (DT #${ticketNumber}): ${receipt.qty_received} ${receipt.condition}. Notes: ${receipt.notes || 'None'}`;

                    if (receipt.qty_expected !== undefined && receipt.qty_received < receipt.qty_expected) {
                        const missingQty = receipt.qty_expected - receipt.qty_received;
                        desc = `Shortage detected on receipt (DT #${ticketNumber}) for ${receipt.product_name || receipt.material_id}. Expected: ${receipt.qty_expected}, Received: ${receipt.qty_received}. Missing: ${missingQty}. Notes: ${receipt.notes || 'None'}`;
                    } else if (receipt.product_name) {
                        desc = `Issue during delivery receipt (DT #${ticketNumber}) for ${receipt.product_name}: ${receipt.qty_received} ${receipt.condition}. Notes: ${receipt.notes || 'None'}`;
                    }

                    await supabase.from('job_issues').insert({
                        id: Crypto.randomUUID(),
                        job_id: (await supabase.from('delivery_tickets').select('job_id').eq('id', ticketId).single()).data?.job_id,
                        type: receipt.condition === 'Damaged' ? 'Material Damage' : 'Shortage',
                        priority: 'High',
                        status: 'open',
                        description: desc,
                        photo_url: receipt.photo_url,
                        created_by: userId,
                        created_at: now,
                        updated_at: now
                    });
                }
            }
            return;
        }

        // Native PowerSync logic
        await db.writeTransaction(async (tx: any) => {
            const ticket = await tx.get(`SELECT job_id, ticket_number FROM delivery_tickets WHERE id = ?`, [ticketId]);
            const ticketNumber = ticket?.ticket_number || ticketId;
            await tx.execute(`UPDATE delivery_tickets SET status = ?, updated_at = ? WHERE id = ?`, [finalStatus, now, ticketId]);

            for (const receipt of itemReceipts) {
                const mat = await tx.get(`SELECT in_warehouse_qty, received_at_job, qty_damaged, qty_missing FROM project_materials WHERE id = ?`, [receipt.material_id]);
                if (mat) {
                    const receivedQty = receipt.condition === 'Verified' ? receipt.qty_received : 0;
                    const newWarehouseQty = (mat.in_warehouse_qty || 0) - receivedQty;

                    if (newWarehouseQty < 0) {
                        await tx.execute(`
                            INSERT INTO job_issues (id, job_id, type, priority, status, description, created_by, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            Crypto.randomUUID(),
                            ticket.job_id,
                            'Inventory Mismatch',
                            'High',
                            'open',
                            `CRITICAL: Warehouse inventory negative after receipt (DT #${ticketNumber}). Item: ${receipt.material_id}. System: ${newWarehouseQty}`,
                            userId,
                            now,
                            now
                        ]);
                    }

                    await tx.execute(`
                        UPDATE project_materials
                        SET received_at_job = received_at_job + ?,
                            in_warehouse_qty = in_warehouse_qty - ?,
                            qty_damaged = qty_damaged + ?,
                            qty_missing = qty_missing + ?,
                            updated_at = ?
                        WHERE id = ?
                    `, [
                        receivedQty,
                        receivedQty,
                        receipt.condition === 'Damaged' ? receipt.qty_received : 0,
                        receipt.condition === 'Missing' ? receipt.qty_received : 0,
                        now,
                        receipt.material_id
                    ]);
                }

                if (receipt.condition !== 'Verified' || (receipt.qty_expected !== undefined && receipt.qty_received < receipt.qty_expected)) {
                    let desc = `Issue during delivery receipt (DT #${ticketNumber}): ${receipt.qty_received} ${receipt.condition}. Notes: ${receipt.notes || 'None'}`;

                    if (receipt.qty_expected !== undefined && receipt.qty_received < receipt.qty_expected) {
                        const missingQty = receipt.qty_expected - receipt.qty_received;
                        desc = `Shortage detected on receipt (DT #${ticketNumber}) for ${receipt.product_name || receipt.material_id}. Expected: ${receipt.qty_expected}, Received: ${receipt.qty_received}. Missing: ${missingQty}. Notes: ${receipt.notes || 'None'}`;
                    } else if (receipt.product_name) {
                        desc = `Issue during delivery receipt (DT #${ticketNumber}) for ${receipt.product_name}: ${receipt.qty_received} ${receipt.condition}. Notes: ${receipt.notes || 'None'}`;
                    }

                    await tx.execute(`
                        INSERT INTO job_issues (id, job_id, type, priority, status, description, photo_url, created_by, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        Crypto.randomUUID(),
                        ticket.job_id,
                        receipt.condition === 'Damaged' ? 'Material Damage' : 'Shortage',
                        'High',
                        'open',
                        desc,
                        receipt.photo_url,
                        userId,
                        now,
                        now
                    ]);
                }
            }
        });
    },

    // ── Fleet Resources (Drivers & Trucks) ──────────────────────────────
    async getFleetResources(type?: 'driver' | 'truck'): Promise<{ id: string; type: string; name: string; is_active: boolean }[]> {
        if (useSupabase) {
            let query = supabase.from('fleet_resources').select('*').eq('is_active', true).order('name');
            if (type) query = query.eq('type', type);
            const { data, error } = await query;
            if (error) { console.error('[Fleet] Fetch error:', error); return []; }
            return data || [];
        }
        return [];
    },

    async saveFleetResource(resource: { id?: string; type: 'driver' | 'truck'; name: string }): Promise<void> {
        const id = resource.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`);
        if (useSupabase) {
            const { error } = await supabase.from('fleet_resources').upsert({
                id,
                type: resource.type,
                name: resource.name,
                is_active: true,
                updated_at: new Date().toISOString(),
            });
            if (error) { console.error('[Fleet] Save error:', error); throw error; }
        }
    },

    async deleteFleetResource(id: string): Promise<void> {
        if (useSupabase) {
            const { error } = await supabase.from('fleet_resources').delete().eq('id', id);
            if (error) { console.error('[Fleet] Delete error:', error); throw error; }
        }
    },
};
