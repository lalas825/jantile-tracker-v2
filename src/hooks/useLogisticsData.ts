import { useState, useEffect, useContext, useRef } from 'react';
import { PowerSyncContext } from '@powersync/react';

// Native (iOS/Android) version - uses PowerSync SQLite
// Polls every 2s to pick up data after sync completes
export const useLogisticsData = () => {
    const db = useContext(PowerSyncContext);

    const [jobs, setJobs] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const lastJsonRef = useRef('');

    useEffect(() => {
        if (!db || (db as any).isMock) {
            setLoading(false);
            return;
        }

        let active = true;

        const fetchData = async () => {
            try {
                const jobsData = await db.getAll('SELECT * FROM jobs ORDER BY name ASC');
                const inventoryData = await db.getAll('SELECT * FROM inventory ORDER BY item_name ASC');

                if (!active) return;

                // Only update state if data actually changed
                const json = JSON.stringify({ j: jobsData, i: inventoryData });
                if (json !== lastJsonRef.current) {
                    lastJsonRef.current = json;
                    setJobs(jobsData);
                    setInventory(inventoryData);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Failed to fetch logistics data:", error);
                if (active) setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [db]);

    return { jobs, inventory, loading };
};
