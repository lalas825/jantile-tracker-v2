import { useContext } from 'react';
import { PowerSyncContext } from '@powersync/react';

export const useSafeStatus = () => {
    try {
        const db = useContext(PowerSyncContext);
        if (!db) {
            return {
                connected: false,
                uploading: false,
                downloading: false,
                lastSyncedAt: null,
                error: 'Context Missing'
            };
        }
        // If db exists but doesn't have currentStatus (weird mock), handle it
        if (!db.currentStatus) {
            return {
                connected: false,
                uploading: false,
                downloading: false,
                lastSyncedAt: null,
                error: 'Status Missing'
            };
        }
        return db.currentStatus;
    } catch (e) {
        return {
            connected: false,
            uploading: false,
            downloading: false,
            lastSyncedAt: null,
            error: String(e)
        };
    }
};
