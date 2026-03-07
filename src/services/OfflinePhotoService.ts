import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { db } from '../powersync/db';
import { supabase } from '../config/supabase';

// Use legacy export as recommended by Expo 54 error message
const FS = FileSystem as any;

// Helper to avoid implicit any
interface OfflinePhotoItem {
    id: string;
    area_id: string;
    local_uri: string;
    filename: string;
    status: string;
}

export const OfflinePhotoService = {

    // 1. Initial Save (Offline)
    // Saves photo to permanent local storage and adds to queue
    async queuePhoto(areaId: string, tempUri: string): Promise<string> {
        if (Platform.OS === 'web') return tempUri;
        const photoId = Crypto.randomUUID();
        const filename = `${photoId}.jpg`;
        // Use documentDirectory if available
        const localDir = `${FS.documentDirectory}photos/`;
        const localPath = `${localDir}${filename}`;

        // Ensure directory exists
        const dirInfo = await FS.getInfoAsync(localDir);
        if (!dirInfo.exists) {
            await FS.makeDirectoryAsync(localDir, { intermediates: true });
        }

        // Copy from temp (camera) to permanent storage
        await FS.copyAsync({
            from: tempUri,
            to: localPath
        });
        console.log('📸 OfflinePhotoService: Photo stored permanent at:', localPath);

        // Add to Sync Queue (PowerSync Local Table)
        console.log('📸 OfflinePhotoService: Inserting into offline_photos table...', { photoId, areaId, localPath });
        try {
            await db.execute(
                `INSERT INTO offline_photos (id, area_id, local_uri, filename, status, created_at) VALUES (?, ?, ?, ?, 'queued', datetime('now'))`,
                [photoId, areaId, localPath, filename]
            );
            console.log('✅ OfflinePhotoService: Successfully queued photo in DB.');

            // Trigger sync immediately instead of waiting for interval
            console.log('📸 OfflinePhotoService: Triggering immediate sync...');
            OfflinePhotoService.processQueue().catch(e => console.log('ℹ️ Sync background task:', e.message));
        } catch (dbErr: any) {
            console.error('❌ OfflinePhotoService: Failed to insert into offline_photos:', dbErr);
            throw dbErr;
        }

        return localPath; // Return local path for UI to display immediately
    },

    // 2. Process Queue (Sync)
    // Call this periodically or on connection restore
    async processQueue() {
        if (Platform.OS === 'web') return;
        console.log('📸 [DEBUG] OfflinePhotoService: processQueue START');

        try {
            // Get all queued items
            const allItems = await db.getAll(`SELECT * FROM offline_photos`);
            console.log(`📸 [DEBUG] Total rows in offline_photos table: ${allItems.length}`);

            const result = await db.getAll(`SELECT * FROM offline_photos WHERE status = 'queued' OR status = 'failed' OR status = 'uploading'`);
            console.log(`📸 [DEBUG] Found ${result.length} items to sync (queued, failed, or stuck uploading).`);

            if (result.length === 0) {
                console.log('📸 [DEBUG] OfflinePhotoService: Nothing to sync. END.');
                return;
            }

            for (const row of result) {
                const item = row as OfflinePhotoItem;
                console.log(`📸 [DEBUG] Processing item: ${item.id} for area: ${item.area_id} (current status: ${item.status})`);

                try {
                    // Update status to uploading
                    await db.execute(`UPDATE offline_photos SET status = 'uploading' WHERE id = ?`, [item.id]);

                    // Read file
                    let localUri = item.local_uri;
                    let fileInfo = await FS.getInfoAsync(localUri);

                    // ROBUSTNESS: Recover from sandbox path changes (e.g. update)
                    if (!fileInfo.exists) {
                        const recoverPath = `${FS.documentDirectory}photos/${item.filename}`;
                        const recoverInfo = await FS.getInfoAsync(recoverPath);
                        if (recoverInfo.exists) {
                            console.log(`⚠️ [Sync] Fixed stale path for ${item.id}. Old: ${localUri} -> New: ${recoverPath}`);
                            localUri = recoverPath;
                            // Update DB
                            await db.execute(`UPDATE offline_photos SET local_uri = ? WHERE id = ?`, [localUri, item.id]);
                            fileInfo = recoverInfo;
                        }
                    }

                    if (!fileInfo.exists) {
                        console.error('❌ [Sync] File not found locally (even after recovery attempt):', localUri);
                        console.error('❌ [Sync] DELETING photo from queue due to missing file:', item.id);
                        // If it's been in 'uploading' for a while and file is gone, just cleanup
                        await db.execute(`DELETE FROM offline_photos WHERE id = ?`, [item.id]);
                        continue;
                    }

                    // robust binary read
                    const base64 = await FS.readAsStringAsync(localUri, { encoding: FS.EncodingType?.Base64 || 'base64' });
                    const { Buffer } = require('buffer');
                    const binaryBody = Buffer.from(base64, 'base64');

                    const storagePath = `photos/${item.area_id}/${item.filename}`;

                    console.log(`📸 [Sync] Uploading to Supabase: ${storagePath}`);
                    const { error } = await supabase.storage
                        .from('area-photos')
                        .upload(storagePath, binaryBody, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (error) {
                        // Throw to catch block where we handle it quietly
                        throw error;
                    }

                    // Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('area-photos')
                        .getPublicUrl(storagePath);

                    console.log(`📸 [Sync] Upload successful. Metadata sync...`);

                    // 1. Upsert into Supabase REAL photos table (FOR WEB/OTHERS)
                    // Uses upsert to handle re-syncs without duplicate key errors
                    const { error: dbUpstreamError } = await supabase
                        .from('area_photos')
                        .upsert({
                            id: item.id,
                            area_id: item.area_id,
                            url: publicUrl,
                            storage_path: storagePath
                        }, { onConflict: 'id' });

                    if (dbUpstreamError) {
                        // If it's a duplicate key error (23505), treat as success and continue
                        const isDuplicate = dbUpstreamError.code === '23505'
                            || dbUpstreamError.message?.includes('duplicate key')
                            || dbUpstreamError.message?.includes('unique_violation');

                        if (!isDuplicate) {
                            console.error('❌ [Sync] Failed to push photo metadata to Supabase:', dbUpstreamError);
                            throw dbUpstreamError;
                        }
                        console.log('ℹ️ [Sync] Record already exists in Supabase, continuing...');
                    } else {
                        console.log('✅ [Sync] Supabase upsert success.');
                    }

                    // 2. Insert into REAL photos table (local PowerSync/SQLite)
                    // This is CRITICAL. If this fails or is ignored, we must ensure the record exists.
                    console.log('📸 [Sync] Inserting into local area_photos...');

                    // We use INSERT OR REPLACE to ensure the local record is up to date with the uploaded URL
                    await db.execute(
                        `INSERT OR REPLACE INTO area_photos (id, area_id, url, storage_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
                        [item.id, item.area_id, publicUrl, storagePath]
                    );

                    // VERIFY insertion
                    const verify = await db.getAll(`SELECT id FROM area_photos WHERE id = ?`, [item.id]);
                    if (verify.length === 0) {
                        console.error('❌ [Sync] CRITICAL: Inserted into area_photos but record not found! Aborting delete.');
                        throw new Error("Local insert verification failed");
                    }
                    console.log('✅ [Sync] Local area_photos insert verified.');

                    // 3. Remove from queue ONLY if verification passed
                    await db.execute(`DELETE FROM offline_photos WHERE id = ?`, [item.id]);

                    // 4. Cleanup local file
                    await FS.deleteAsync(item.local_uri, { idempotent: true });
                    console.log('✅ [Sync] Photo sync flow COMPLETE for:', item.id);

                } catch (e: any) {
                    // SILENT LOG for network drops
                    console.log('ℹ️ [Sync] Background upload pending (offline):', e.message || e);
                    // Reset status to failed so it shows up in UI (and can be retried)
                    await db.execute(`UPDATE offline_photos SET status = 'failed' WHERE id = ?`, [item.id]);
                }
            }
        } catch (globalErr: any) {
            console.error('📸 [DEBUG] Global Process Queue Error:', globalErr);
        }
    }
};

// PERIODIC RETRY (Every 30 seconds)
if (Platform.OS !== 'web') {
    setInterval(() => {
        OfflinePhotoService.processQueue().catch(() => { });
    }, 30000);
}
