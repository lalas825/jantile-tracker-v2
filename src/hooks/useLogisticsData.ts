import { useState, useEffect, useContext } from 'react';
import { PowerSyncContext } from '@powersync/react';

// Native (iOS/Android) version - uses PowerSync SQLite
// Updates for Expo Go: Handle missing DB gracefully
export const useLogisticsData = () => {
    // Safely attempt to get DB. If Provider is invalid/missing (Expo Go), context might be null or throw inside the library's hook.
    // We use useContext directly to avoid the strict check of usePowerSync() hook if possible.
    const db = useContext(PowerSyncContext);

    const [jobs, setJobs] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            // If DB is missing (Expo Go fallback), return empty data
            if (!db) {
                setLoading(false);
                return;
            }

            try {
                const jobsData = await db.getAll('SELECT * FROM jobs ORDER BY name ASC');
                const inventoryData = await db.getAll('SELECT * FROM inventory ORDER BY item_name ASC');

                setJobs(jobsData);
                setInventory(inventoryData);
            } catch (error) {
                console.error("Failed to fetch logistics data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [db]);

    return { jobs, inventory, loading };
};
