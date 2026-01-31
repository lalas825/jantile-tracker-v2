import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

// Web-only version of useLogisticsData - uses Supabase directly
export const useLogisticsData = () => {
    const [jobs, setJobs] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
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

                setJobs(jobsResult || []);
                setInventory(inventoryResult || []);
            } catch (error) {
                console.error("Failed to fetch logistics data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { jobs, inventory, loading };
};
