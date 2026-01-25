import { useState, useEffect } from 'react';

export interface Job {
    id: string;
    name: string;
    address: string;
    floors: number;
    units: number;
    status: 'Active' | 'Hold' | 'Completed';
    progress: number; // 0-100
    startDate: string;
}

const MOCK_JOBS: Job[] = [
    {
        id: '1505',
        name: 'JFK Terminal 1',
        address: 'John F. Kennedy International Airport, Queens, NY',
        floors: 4,
        units: 250,
        status: 'Active',
        progress: 35,
        startDate: '2025-06-15',
    },
    {
        id: '1508',
        name: '72 Park Ave',
        address: '72 Park Avenue, New York, NY',
        floors: 38,
        units: 450,
        status: 'Active',
        progress: 62,
        startDate: '2025-01-10',
    },
    {
        id: '1512',
        name: 'Brooklyn Methodist Hospital',
        address: '506 6th St, Brooklyn, NY',
        floors: 12,
        units: 120,
        status: 'Hold',
        progress: 88,
        startDate: '2024-11-01',
    },
    {
        id: '1515',
        name: 'The spiraling Tower',
        address: '66 Hudson Blvd, New York, NY',
        floors: 65,
        units: 800,
        status: 'Active',
        progress: 15,
        startDate: '2025-08-01',
    },
    {
        id: '1498',
        name: 'Long Island University',
        address: '1 University Plaza, Brooklyn, NY',
        floors: 8,
        units: 60,
        status: 'Completed',
        progress: 100,
        startDate: '2024-05-20',
    }
];

export function useJobsData() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate network delay
        const timer = setTimeout(() => {
            setJobs(MOCK_JOBS);
            setLoading(false);
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    return { jobs, loading };
}
