// OfflinePhotoService.ts
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { db } from '../powersync/db';
import { supabase } from '../config/supabase';

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
        // Use documentDirectory if available, fallback or cast if needed. 
        // Expo FileSystem types usually include it.
        const localDir = `${FileSystem.documentDirectory}photos/`;
        const localPath = `${localDir}${filename}`;

        // Ensure directory exists
        const dirInfo = await FileSystem.getInfoAsync(localDir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(localDir, { intermediates: true });
        }

        // Copy from temp (camera) to permanent storage
        await FileSystem.copyAsync({
            from: tempUri,
            to: localPath
        });

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
        // Get all queued items
        const result = await db.getAll(`SELECT * FROM offline_photos WHERE status = 'queued' OR status = 'failed'`);
        if (result.length === 0) return;

        for (const row of result) {
            const item = row as OfflinePhotoItem;
            try {
                // Update status to uploading
                await db.execute(`UPDATE offline_photos SET status = 'uploading' WHERE id = ?`, [item.id]);

                // Read file
                const fileInfo = await FileSystem.getInfoAsync(item.local_uri);
                if (!fileInfo.exists) {
                    console.error('File not found:', item.local_uri);
                    // Mark as fatal error or delete?
                    await db.execute(`DELETE FROM offline_photos WHERE id = ?`, [item.id]);
                    continue;
                }

                // Upload to Supabase (We need Blob)
                // Expo fetch supports file:/// uris to get blobs
                const response = await fetch(item.local_uri);
                const blob = await response.blob();

                const storagePath = `photos/${item.area_id}/${item.filename}`;

                const { error } = await supabase.storage
                    .from('area-photos')
                    .upload(storagePath, blob, {
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

                // Cleanup local file? 
                // Maybe keep it for cache? For now, we delete to save space since we have URL.
                await FileSystem.deleteAsync(item.local_uri, { idempotent: true });

            } catch (e) {
                console.error('Photo sync failed for', item.id, e);
                await db.execute(`UPDATE offline_photos SET status = 'failed' WHERE id = ?`, [item.id]);
            }
        }
    }
};
