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
        await db.execute(
            `INSERT INTO offline_photos (id, area_id, local_uri, filename, status, created_at) VALUES (?, ?, ?, ?, 'queued', datetime('now'))`,
            [photoId, areaId, localPath, filename]
        );

        return localPath; // Return local path for UI to display immediately
    },

    // 2. Process Queue (Sync)
    // Call this periodically or on connection restore
    async processQueue() {
        if (Platform.OS === 'web') return;
        console.log('📸 OfflinePhotoService: Checking queue...');

        // Get all queued items
        const result = await db.getAll(`SELECT * FROM offline_photos WHERE status = 'queued' OR status = 'failed'`);
        console.log(`📸 OfflinePhotoService: Found ${result.length} items to sync.`);
        if (result.length === 0) return;

        for (const row of result) {
            const item = row as OfflinePhotoItem;
            try {
                // Update status to uploading
                await db.execute(`UPDATE offline_photos SET status = 'uploading' WHERE id = ?`, [item.id]);

                // Read file
                const fileInfo = await FS.getInfoAsync(item.local_uri);
                if (!fileInfo.exists) {
                    console.error('❌ File not found:', item.local_uri);
                    // Mark as fatal error or delete?
                    await db.execute(`DELETE FROM offline_photos WHERE id = ?`, [item.id]);
                    continue;
                }

                // robust binary read
                const base64 = await FS.readAsStringAsync(item.local_uri, { encoding: FS.EncodingType?.Base64 || 'base64' });
                const { Buffer } = require('buffer');
                const binaryBody = Buffer.from(base64, 'base64');

                const storagePath = `photos/${item.area_id}/${item.filename}`;

                const { error } = await supabase.storage
                    .from('area-photos')
                    .upload(storagePath, binaryBody, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (error) throw error;

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('area-photos')
                    .getPublicUrl(storagePath);

                // Insert into REAL photos table (synced)
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
    }
};
