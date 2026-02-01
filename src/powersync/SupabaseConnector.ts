import { PowerSyncBackendConnector, UpdateType } from '@powersync/react-native';
import { supabase } from '../config/supabase';

export class SupabaseConnector implements PowerSyncBackendConnector {
    async fetchCredentials() {
        // Use the imported supabase client directly
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session?.access_token) {
            console.error("PowerSync Auth Error:", error);
            throw new Error(`Auth Failed: ${error?.message || 'No Session Token'}`);
        }

        return {
            endpoint: 'https://6972a62c5f8ee4c52500ae6f.powersync.journeyapps.com',
            token: session.access_token,
        };
    }

    async uploadData(database: any) {
        const transaction = await database.getNextCrudTransaction();

        if (!transaction) {
            return;
        }

        try {
            // Process all operations in the transaction
            for (const op of transaction.crud) {
                const { table, op: operation, id, data } = op;

                console.log(`[SupabaseConnector] >>> PROCESSING OP: ${operation} on ${table} (${id})`);
                console.log(`[SupabaseConnector] Mutation Data:`, JSON.stringify(data));

                // SKIP local-only tables that don't exist on Supabase
                if (table === 'offline_photos') {
                    console.log(`[SupabaseConnector] Skipping local-only table: ${table}`);
                    continue;
                }

                // DATA CLEANUP / COERCION
                let cleanedData = data || {};

                // If data is missing (can happen with raw SQL executes), fetch the row from local DB
                if (operation !== 'DELETE' && Object.keys(cleanedData).length === 0) {
                    console.log(`[SupabaseConnector] Data missing for ${table} (${id}), fetching from local DB...`);
                    try {
                        const row = await database.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
                        if (row) {
                            console.log(`[SupabaseConnector] Found row in local DB for ${table}:`, JSON.stringify(row));
                            cleanedData = { ...row };
                        } else {
                            console.warn(`[SupabaseConnector] Row NOT found in local DB for ${table} with id: ${id}`);
                        }
                    } catch (e) {
                        console.error(`[SupabaseConnector] Error fetching row from local DB:`, e);
                    }
                }

                console.log(`[SupabaseConnector] Final cleanedData for ${table} (${id}):`, JSON.stringify(cleanedData));

                // Coerce values for Supabase compatibility
                // checklist_items.completed should be 0 or 1 (integer in DB)
                if (table === 'checklist_items' && 'completed' in cleanedData) {
                    cleanedData.completed = cleanedData.completed ? 1 : 0;
                }
                if (table === 'production_logs') {
                    if ('is_jantile' in cleanedData) cleanedData.is_jantile = cleanedData.is_jantile ? 1 : 0;
                    if ('is_ticket' in cleanedData) cleanedData.is_ticket = cleanedData.is_ticket ? 1 : 0;
                }

                // REMOVE 'position' column (TEMPORARY FIX)
                // We keep 'position' locally in PowerSync for sorting, but Supabase doesn't have it yet.
                // If we send it, Supabase throws a 400 (PGRST204)
                if (table === 'checklist_items' && cleanedData && typeof cleanedData === 'object') {
                    const { position, ...rest } = cleanedData;
                    cleanedData = rest;
                    console.log(`[SupabaseConnector] Sanitized checklist_items (removed position)`);
                }

                if (operation === 'PUT') {
                    const payload = { ...cleanedData, id };
                    console.log(`[SupabaseConnector] Sending PUT payload to Supabase for ${table}:`, JSON.stringify(payload));
                    const { error } = await supabase
                        .from(table)
                        .upsert(payload);

                    if (error) {
                        console.error(`[SupabaseConnector] !!! SUPABASE PUT ERROR on ${table}:`, error);
                        throw error;
                    }
                    console.log(`[SupabaseConnector] Success: PUT on ${table} (${id})`);
                } else if (operation === 'PATCH') {
                    console.log(`[SupabaseConnector] Sending PATCH payload to Supabase for ${table}:`, JSON.stringify(cleanedData));
                    const { error } = await supabase
                        .from(table)
                        .update(cleanedData)
                        .eq('id', id);

                    if (error) {
                        console.error(`[SupabaseConnector] !!! SUPABASE PATCH ERROR on ${table}:`, error);
                        throw error;
                    }
                    console.log(`[SupabaseConnector] Success: PATCH on ${table} (${id})`);
                } else if (operation === 'DELETE') {
                    console.log(`[SupabaseConnector] Executing DELETE on Supabase for ${table} (${id})`);
                    const { error } = await supabase
                        .from(table)
                        .delete()
                        .eq('id', id);

                    if (error) {
                        console.error(`[SupabaseConnector] !!! SUPABASE DELETE ERROR on ${table}:`, error);
                        throw error;
                    }
                    console.log(`[SupabaseConnector] Success: DELETE on ${table} (${id})`);
                }
            }

            await transaction.complete();
            console.log(`[SupabaseConnector] Transaction Completed Successfully`);
        } catch (ex: any) {
            console.error("[SupabaseConnector] TERMINAL UPLOAD FAILURE:", JSON.stringify(ex));
            // PowerSync will retry automatically
        }
    }
}
