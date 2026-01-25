import { ChecklistItem, AreaData } from '../components/jobs/AreaDetailsDrawer';

// --- Type Definitions (Mirrored for Store) ---
export interface Unit {
    id: string;
    name: string;
    areas: AreaData[];
}

export interface Floor {
    id: string;
    name: string;
    progress: number; // 0-100
    units: Unit[];
}

export interface Job {
    id: string;
    name: string;
    address: string;
    progress: number;
    floors: Floor[];
}

// --- Initial Mock Data ---
const DEFAULT_CHECKLIST: ChecklistItem[] = [
    { id: 'mud', label: 'Mud Set - Leveling', status: 'NOT_STARTED' },
    { id: 'tile', label: 'Tile Installation', status: 'NOT_STARTED' },
    { id: 'grout', label: 'Grout & Caulk', status: 'NOT_STARTED' },
    { id: 'soundproof', label: 'Soundproof Installation', status: 'NOT_STARTED' },
    { id: 'waterproof', label: 'Waterproofing Membrane', status: 'NOT_STARTED' },
];

// Initial Data Structure
const INITIAL_JOBS: Job[] = [
    {
        id: '101', // Matching usual ID
        name: 'JFK Terminal 1',
        address: 'John F. Kennedy International Airport, Queens, NY',
        progress: 0,
        floors: [
            {
                id: 'f1',
                name: 'Floor Level 01',
                progress: 0,
                units: [
                    {
                        id: 'u101',
                        name: 'Unit 101',
                        areas: [
                            {
                                id: 'a1',
                                name: 'Master Bathroom',
                                description: 'North Wall & Shower',
                                checklist: JSON.parse(JSON.stringify(DEFAULT_CHECKLIST)), // Deep copy
                                progress: 0,
                                mudStatus: 'NOT_STARTED',
                                tileStatus: 'NOT_STARTED',
                                groutStatus: 'NOT_STARTED'
                            },
                            {
                                id: 'a2',
                                name: 'Kitchen',
                                description: 'Backsplash & Island',
                                checklist: JSON.parse(JSON.stringify(DEFAULT_CHECKLIST)),
                                progress: 0,
                                mudStatus: 'NOT_STARTED',
                                tileStatus: 'NOT_STARTED',
                                groutStatus: 'NOT_STARTED'
                            }
                        ]
                    }
                ]
            },
            {
                id: 'f2',
                name: 'Floor Level 02',
                progress: 0,
                units: [
                    {
                        id: 'u201',
                        name: 'Unit 201',
                        areas: [
                            {
                                id: 'a4',
                                name: 'Master Bath',
                                description: 'Full Suite Renovation',
                                checklist: JSON.parse(JSON.stringify(DEFAULT_CHECKLIST)),
                                progress: 0,
                                mudStatus: 'NOT_STARTED',
                                tileStatus: 'NOT_STARTED',
                                groutStatus: 'NOT_STARTED'
                            }
                        ]
                    }
                ]
            }
        ]
    },
    // Add another dummy job for list view
    {
        id: '102',
        name: '72 Park Ave',
        address: '72 Park Avenue, New York, NY',
        progress: 45,
        floors: []
    }
];

// --- The Store Logic ---
class MockJobStoreService {
    private jobs: Job[] = INITIAL_JOBS;

    getAllJobs(): Job[] {
        return this.jobs;
    }

    getJob(id: string): Job | undefined {
        return this.jobs.find(j => j.id === id);
    }

    updateAreaChecklist(jobId: string, floorId: string, unitId: string, areaId: string, newChecklist: ChecklistItem[]): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;

        const job = { ...this.jobs[jobIndex] }; // Shallow copy job

        // 1. Locate Floor
        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        // 2. Locate Unit
        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        // 3. Locate Area
        const areaIndex = unit.areas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return null;

        // 4. Update Area Data & Progress
        const totalItems = newChecklist.filter(i => i.status !== 'NA').length;
        const completedItems = newChecklist.filter(i => i.status === 'COMPLETED').length;
        const newAreaProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        const mud = newChecklist.find(i => i.id === 'mud')?.status || 'NOT_STARTED';
        const tile = newChecklist.find(i => i.id === 'tile')?.status || 'NOT_STARTED';
        const grout = newChecklist.find(i => i.id === 'grout')?.status || 'NOT_STARTED';

        const updatedArea = {
            ...unit.areas[areaIndex],
            checklist: newChecklist,
            progress: newAreaProgress,
            mudStatus: mud,
            tileStatus: tile,
            groutStatus: grout
        };

        // Reconstruct Tree Upwards
        unit.areas = [...unit.areas];
        unit.areas[areaIndex] = updatedArea;

        floor.units = [...floor.units];
        floor.units[unitIndex] = unit;

        // 5. Recalculate Floor Progress (Average of all areas in floor)
        let totalFloorAreaProgress = 0;
        let floorAreaCount = 0;
        floor.units.forEach(u => {
            u.areas.forEach(a => {
                totalFloorAreaProgress += a.progress;
                floorAreaCount++;
            });
        });
        floor.progress = floorAreaCount > 0 ? Math.round(totalFloorAreaProgress / floorAreaCount) : 0;

        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        // 6. Recalculate Job Progress (Average of all floors)
        // Alternatively could be average of all areas globally, but lets do average of floors for now or average of areas.
        // Let's do Average of Floors to keep it simple hierarchy-wise, or strictly Average of all Areas.
        // User request didn't specify strict math, just "Recalculates Job %".
        // Let's do Average of Floors.
        let totalJobProgress = 0;
        job.floors.forEach(f => totalJobProgress += f.progress);
        job.progress = job.floors.length > 0 ? Math.round(totalJobProgress / job.floors.length) : 0;

        // Save Back
        this.jobs[jobIndex] = job;
        return job;
    }
}

export const MockJobStore = new MockJobStoreService();
