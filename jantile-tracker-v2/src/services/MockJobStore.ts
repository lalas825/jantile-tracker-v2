import { ChecklistItem, AreaData } from '../components/jobs/AreaDetailsDrawer';
import { CHECKLIST_PRESETS } from '../constants/JobTemplates';

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
    location: string;
    generalContractor?: string;
    totalUnits?: string;
    foremanEmail?: string;
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
        location: 'John F. Kennedy International Airport, Queens, NY',
        generalContractor: 'Tishman Construction',
        totalUnits: '45',
        foremanEmail: 'foreman@jfk.com',
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
        location: '72 Park Avenue, New York, NY',
        generalContractor: 'Structure Tone',
        totalUnits: '120',
        foremanEmail: 'site.super@72park.com',
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

    // 1. ADD NEW JOB (Updated)
    addJob(name: string, location: string, gc: string, units: string, email: string): void {
        const newJob: Job = {
            id: Math.floor(Math.random() * 10000).toString(),
            name,
            location,
            generalContractor: gc,
            totalUnits: units,
            foremanEmail: email,
            progress: 0,
            floors: []
        };
        this.jobs.unshift(newJob);
    }

    // 2. UPDATE JOB (Updated)
    updateJob(id: string, name: string, location: string, gc: string, units: string, email: string): void {
        const job = this.getJob(id);
        if (job) {
            job.name = name;
            job.location = location;
            job.generalContractor = gc;
            job.totalUnits = units;
            job.foremanEmail = email;
        }
    }

    // 3. DELETE JOB
    deleteJob(id: string): void {
        this.jobs = this.jobs.filter(j => j.id !== id);
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

    // --- STRUCTURE MANAGEMENT START ---

    // 1. FLOOR OPERATIONS
    addFloor(jobId: string, name: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;

        const job = { ...this.jobs[jobIndex] };
        const newFloor: Floor = {
            id: `f${Date.now()}`, // simple ID gen
            name: name,
            progress: 0,
            units: []
        };

        job.floors = [...job.floors, newFloor];
        this.jobs[jobIndex] = job;
        this.recalculateJobProgress(jobId);
        return this.jobs[jobIndex];
    }

    updateFloorName(jobId: string, floorId: string, newName: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;

        const job = { ...this.jobs[jobIndex] };
        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;

        const floor = { ...job.floors[floorIndex], name: newName };
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        return job;
    }

    deleteFloor(jobId: string, floorId: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;

        const job = { ...this.jobs[jobIndex] };
        job.floors = job.floors.filter(f => f.id !== floorId);

        this.jobs[jobIndex] = job;
        this.recalculateJobProgress(jobId);
        return this.jobs[jobIndex];
    }

    // 2. UNIT/AREA OPERATIONS
    // Note: To keep structure simple for the user request, 
    // "Add Unit" will essentially check if a Unit exists, if not create it, then add Area.
    // Or simpler: We just add "Units" which contain "Areas". 
    // The request said "Add Unit/Area". Let's assume we are adding an Area to a Unit Group.
    // However, the UI has "Add Unit to Floor". 
    // Let's make "Add Unit" create a Unit wrapper AND the first Area inside it.

    addUnit(jobId: string, floorId: string, unitName: string, areaName: string, description: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;

        const job = { ...this.jobs[jobIndex] };
        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;

        const floor = { ...job.floors[floorIndex] };

        // New Area Logic
        // 1. Determine Checklist based on Name
        const normalizedName = areaName.toLowerCase().trim();
        let initialChecklist = JSON.parse(JSON.stringify(DEFAULT_CHECKLIST));

        if (CHECKLIST_PRESETS[normalizedName]) {
            const presetTasks = CHECKLIST_PRESETS[normalizedName];
            initialChecklist = presetTasks.map((label, index) => ({
                id: `task_${Date.now()}_${index}`,
                label: label,
                status: 'NOT_STARTED'
            }));
        }

        const newArea: AreaData = {
            id: `a${Date.now()}`,
            name: areaName,
            description: description,
            checklist: initialChecklist,
            progress: 0,
            mudStatus: 'NOT_STARTED',
            tileStatus: 'NOT_STARTED',
            groutStatus: 'NOT_STARTED'
        };

        // Check if unit with this name exists in this floor
        // (Simplification: Just creating a new unit wrapper for now as per "Add Unit" button logic)
        const newUnit: Unit = {
            id: `u${Date.now()}`,
            name: unitName,
            areas: [newArea]
        };

        floor.units = [...floor.units, newUnit];
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        this.recalculateJobProgress(jobId); // Unit added with 0 progress might drag down avg
        return this.jobs[jobIndex];
    }

    // Helper: Add Area to Existing Unit (if we wanted that granularity, but for now specific requirement was generalized)
    // We will assume "Edit" on Area Card lets you rename the Area.

    updateArea(jobId: string, floorId: string, unitId: string, areaId: string, newName: string, newDescription: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;

        const job = { ...this.jobs[jobIndex] };
        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        const areaIndex = unit.areas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return null;

        const area = { ...unit.areas[areaIndex], name: newName, description: newDescription };

        unit.areas = [...unit.areas];
        unit.areas[areaIndex] = area;
        floor.units = [...floor.units];
        floor.units[unitIndex] = unit;
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        return job;
    }

    deleteArea(jobId: string, floorId: string, unitId: string, areaId: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;

        const job = { ...this.jobs[jobIndex] };
        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        // Remove Area
        unit.areas = unit.areas.filter(a => a.id !== areaId);

        // If unit empty, remove unit? Let's say yes for cleanup
        if (unit.areas.length === 0) {
            floor.units = floor.units.filter(u => u.id !== unitId);
        } else {
            floor.units = [...floor.units];
            floor.units[unitIndex] = unit;
        }

        // Check if floor needs update
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        // Recalculate Progresses
        this.recalculateFloorProgress(floor); // Mutates floor progress
        this.jobs[jobIndex] = job;
        this.recalculateJobProgress(jobId);

        return this.jobs[jobIndex];
    }

    // --- HELPERS ---
    private recalculateFloorProgress(floor: Floor) {
        let total = 0;
        let count = 0;
        floor.units.forEach(u => {
            u.areas.forEach(a => {
                total += a.progress;
                count++;
            });
        });
        floor.progress = count > 0 ? Math.round(total / count) : 0;
    }

    private recalculateJobProgress(jobId: string) {
        const job = this.jobs.find(j => j.id === jobId);
        if (!job) return;

        let total = 0;
        let count = 0;
        // Average of floors
        job.floors.forEach(f => {
            total += f.progress;
            count++;
        });
        job.progress = count > 0 ? Math.round(total / count) : 0;
    }
    // 3. LOGGING
    logTime(jobId: string, floorId: string, unitId: string, areaId: string, logData: any): Job | null {
        console.log(`[MockStore] Time Logged: Job=${jobId}, Floor=${floorId}, Unit=${unitId}, Area=${areaId}`, logData);

        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;
        const job = { ...this.jobs[jobIndex] };

        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        const areaIndex = unit.areas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return null;

        // Update Area
        const area = { ...unit.areas[areaIndex] };
        area.timeLogs = [...(area.timeLogs || []), logData];

        // Re-assemble
        unit.areas = [...unit.areas];
        unit.areas[areaIndex] = area;
        floor.units = [...floor.units];
        floor.units[unitIndex] = unit;
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        return job;
        return job;
    }

    deletePhoto(jobId: string, floorId: string, unitId: string, areaId: string, photoUri: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;
        const job = { ...this.jobs[jobIndex] };

        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        const areaIndex = unit.areas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return null;

        const area = { ...unit.areas[areaIndex] };
        if (area.photos) {
            area.photos = area.photos.filter(p => p !== photoUri);
        }

        unit.areas = [...unit.areas];
        unit.areas[areaIndex] = area;
        floor.units = [...floor.units];
        floor.units[unitIndex] = unit;
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        return job;
    }

    // 4. PHOTOS & ISSUES
    addPhoto(jobId: string, floorId: string, unitId: string, areaId: string, photoUri: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;
        const job = { ...this.jobs[jobIndex] };

        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        const areaIndex = unit.areas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return null;

        const area = { ...unit.areas[areaIndex] };
        area.photos = [...(area.photos || []), photoUri];

        unit.areas = [...unit.areas];
        unit.areas[areaIndex] = area;
        floor.units = [...floor.units];
        floor.units[unitIndex] = unit;
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        return job;
    }

    addIssue(jobId: string, floorId: string, unitId: string, areaId: string, issueData: any): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;
        const job = { ...this.jobs[jobIndex] };

        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        const areaIndex = unit.areas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return null;

        const area = { ...unit.areas[areaIndex] };
        area.issues = [...(area.issues || []), issueData];

        unit.areas = [...unit.areas];
        unit.areas[areaIndex] = area;
        floor.units = [...floor.units];
        floor.units[unitIndex] = unit;
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        return job;
    }

    updateIssueStatus(jobId: string, floorId: string, unitId: string, areaId: string, issueId: string, status: 'OPEN' | 'RESOLVED'): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;
        const job = { ...this.jobs[jobIndex] };

        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        const areaIndex = unit.areas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return null;

        const area = { ...unit.areas[areaIndex] };
        if (area.issues) {
            const issueIndex = area.issues.findIndex(i => i.id === issueId);
            if (issueIndex !== -1) {
                area.issues = [...area.issues];
                area.issues[issueIndex] = { ...area.issues[issueIndex], status: status };
            }
        }

        unit.areas = [...unit.areas];
        unit.areas[areaIndex] = area;
        floor.units = [...floor.units];
        floor.units[unitIndex] = unit;
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        return job;
    }

    deleteIssue(jobId: string, floorId: string, unitId: string, areaId: string, issueId: string): Job | null {
        const jobIndex = this.jobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return null;
        const job = { ...this.jobs[jobIndex] };

        const floorIndex = job.floors.findIndex(f => f.id === floorId);
        if (floorIndex === -1) return null;
        const floor = { ...job.floors[floorIndex] };

        const unitIndex = floor.units.findIndex(u => u.id === unitId);
        if (unitIndex === -1) return null;
        const unit = { ...floor.units[unitIndex] };

        const areaIndex = unit.areas.findIndex(a => a.id === areaId);
        if (areaIndex === -1) return null;

        const area = { ...unit.areas[areaIndex] };
        if (area.issues) {
            area.issues = area.issues.filter(i => i.id !== issueId);
        }

        unit.areas = [...unit.areas];
        unit.areas[areaIndex] = area;
        floor.units = [...floor.units];
        floor.units[unitIndex] = unit;
        job.floors = [...job.floors];
        job.floors[floorIndex] = floor;

        this.jobs[jobIndex] = job;
        return job;
    }
}

export const MockJobStore = new MockJobStoreService();
