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
                            console.warn(`[SupabaseConnector] Row NOT found in local DB for ${table} (${id}) — skipping orphaned op`);
                            continue; // Row deleted locally, skip this operation
                        }
                    } catch (e: any) {
                        if (e?.message?.includes('Result set is empty')) {
                            console.warn(`[SupabaseConnector] Row gone from local DB for ${table} (${id}) — skipping`);
                            continue; // Row no longer exists, skip
                        }
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

                // Remove columns that exist in local PowerSync schema but not in Supabase
                // These cause PGRST204 errors and block the entire upload queue
                const COLUMNS_TO_STRIP: Record<string, string[]> = {
                    'checklist_items': ['position'],
                    'jobs': ['foreman_email'],
                };
                const columnsToRemove = COLUMNS_TO_STRIP[table];
                if (columnsToRemove && cleanedData && typeof cleanedData === 'object') {
                    for (const col of columnsToRemove) {
                        delete cleanedData[col];
                    }
                    console.log(`[SupabaseConnector] Sanitized ${table} (removed ${columnsToRemove.join(', ')})`);
                }

                // SAFETY NET: Never send empty payloads — they always fail with constraint violations
                if (operation !== 'DELETE' && Object.keys(cleanedData).length === 0) {
                    console.warn(`[SupabaseConnector] Empty payload for ${table} (${id}) — skipping to prevent constraint error`);
                    continue;
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
            console.error("[SupabaseConnector] Upload error:", JSON.stringify(ex));

            // Complete transaction on non-recoverable errors to unblock the sync queue.
            // These errors will never succeed on retry, so retrying forever blocks all sync.
            const unrecoverableCodes = [
                'PGRST204', // Schema mismatch (column not found in PostgREST)
                '42703',    // Column does not exist (PostgreSQL)
                '23502',    // NOT NULL constraint violation (missing required data)
                '23503',    // Foreign key constraint violation (parent row missing)
                '23505',    // Unique constraint violation (duplicate key)
            ];

            if (unrecoverableCodes.includes(ex?.code)) {
                console.warn(`[SupabaseConnector] Non-recoverable error (${ex.code}) — completing transaction to unblock queue`);
                await transaction.complete();
            }
            // Otherwise PowerSync will retry automatically
        }
    }
}
