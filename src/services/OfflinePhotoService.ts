import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
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
        const photoId = randomUUID();
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
            OfflinePhotoService.processQueue().catch(e => console.error('❌ Sync failed:', e));
        } catch (dbErr) {
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
                    const fileInfo = await FS.getInfoAsync(item.local_uri);
                    if (!fileInfo.exists) {
                        console.error('❌ File not found locally:', item.local_uri);
                        // If it's been in 'uploading' for a while and file is gone, just cleanup
                        await db.execute(`DELETE FROM offline_photos WHERE id = ?`, [item.id]);
                        continue;
                    }

                    // robust binary read
                    const base64 = await FS.readAsStringAsync(item.local_uri, { encoding: FS.EncodingType?.Base64 || 'base64' });
                    const { Buffer } = require('buffer');
                    const binaryBody = Buffer.from(base64, 'base64');

                    const storagePath = `photos/${item.area_id}/${item.filename}`;

                    console.log(`📸 [DEBUG] Uploading to Supabase: ${storagePath}`);
                    const { error } = await supabase.storage
                        .from('area-photos')
                        .upload(storagePath, binaryBody, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (error) {
                        console.error('❌ Supabase Storage Error:', error);
                        throw error;
                    }

                    // Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('area-photos')
                        .getPublicUrl(storagePath);

                    console.log(`📸 [DEBUG] Upload successful. Metadata sync...`);

                    // Insert into Supabase REAL photos table (FOR WEB/OTHERS)
                    const { error: dbUpstreamError } = await supabase
                        .from('area_photos')
                        .insert({
                            id: item.id,
                            area_id: item.area_id,
                            url: publicUrl,
                            storage_path: storagePath
                        });

                    if (dbUpstreamError) {
                        // If it's a duplicate error, we can ignore and proceed
                        if (!dbUpstreamError.message?.includes('unique_violation')) {
                            console.error('❌ Failed to push photo metadata to Supabase:', dbUpstreamError);
                            throw dbUpstreamError;
                        }
                    }

                    // Insert into REAL photos table (local PowerSync/SQLite)
                    await db.execute(
                        `INSERT INTO area_photos (id, area_id, url, storage_path) VALUES (?, ?, ?, ?)`,
                        [item.id, item.area_id, publicUrl, storagePath]
                    );

                    // Remove from queue
                    await db.execute(`DELETE FROM offline_photos WHERE id = ?`, [item.id]);

                    // Cleanup local file
                    await FS.deleteAsync(item.local_uri, { idempotent: true });
                    console.log('✅ Photo synced successfully:', item.id);

                } catch (e: any) {
                    console.error('❌ Photo sync failed for', item.id, e.message || e);
                    await db.execute(`UPDATE offline_photos SET status = 'failed' WHERE id = ?`, [item.id]);
                }
            }
        } catch (globalErr: any) {
            console.error('📸 [DEBUG] Global Process Queue Error:', globalErr);
        }
    }
};
