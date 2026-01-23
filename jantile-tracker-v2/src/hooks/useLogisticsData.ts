import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { usePowerSync } from '@powersync/react-native';
import { supabase } from '../lib/supabase';

export const useLogisticsData = () => {
    const db = usePowerSync();
    const [jobs, setJobs] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                let jobsData: any[] = [];
                let inventoryData: any[] = [];

                if (Platform.OS === 'web') {
                    // --- WEB: Fetch from Supabase ---
                    const { data: jobsResult, error: jobsError } = await supabase
                        .from('jobs')
                        .select('*')
                        .order('name', { ascending: true });

                    if (jobsError) throw jobsError;

                    const { data: inventoryResult, error: inventoryError } = await supabase
                        .from('inventory')
                        .select('*')
                        .order('item_name', { ascending: true });

                    if (inventoryError) throw inventoryError;

                    jobsData = jobsResult || [];
                    inventoryData = inventoryResult || [];
                } else {
                    // --- MOBILE: Fetch from PowerSync (SQLite) ---
                    jobsData = await db.getAll('SELECT * FROM jobs ORDER BY name ASC');
                    inventoryData = await db.getAll('SELECT * FROM inventory ORDER BY item_name ASC');
                }

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
