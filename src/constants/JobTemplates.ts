// DEFINITIONS BASED ON USER STANDARD
const BATHROOM_TASKS = [
    "Soundproof", "Mud / Self Level", "Waterproof", "Heat Mat",
    "Floor Tile / Stone", "Wall Tile / Stone", "Tub Deck", "Base",
    "Grout", "Caulk", "Sealer", "Vanity Top"
];

const POWDER_TASKS = [
    "Soundproof", "Mud / Self Level", "Waterproof",
    "Floor Tile / Stone", "Wall Tile / Stone", "Base",
    "Grout", "Caulk", "Sealer", "Vanity Top"
];

const KITCHEN_TASKS = [
    "Counter Top", "Backsplash", "Island", "Akemi", "Caulk", "Sealer"
];

const COMMON_AREA_TASKS = [
    "Soundproof", "Mud / Self Level", "Waterproof",
    "Floor Tile / Stone", "Base", "Grout", "Caulk", "Sealer"
];

// MAPPING PRESETS TO LISTS
export const CHECKLIST_PRESETS: Record<string, string[]> = {
    'master bathroom': BATHROOM_TASKS,
    'secondary bathroom': BATHROOM_TASKS,
    'restroom': BATHROOM_TASKS,
    'bathroom': BATHROOM_TASKS,

    'powder room': POWDER_TASKS,
    'locker room': POWDER_TASKS,
    'janitor room': POWDER_TASKS,
    'laundry': POWDER_TASKS, // Added per list

    'kitchen': KITCHEN_TASKS,

    'foyer': COMMON_AREA_TASKS,
    'vestibule': COMMON_AREA_TASKS,
    'corridor': COMMON_AREA_TASKS
};

// THE BUTTONS FOR THE UI (Exact User Names)
export const QUICK_PICKS = [
    "Master Bathroom",
    "Secondary Bathroom",
    "Powder Room",
    "Laundry",
    "Kitchen",
    "Foyer",
    "Restroom",
    "Bathroom",
    "Vestibule",
    "Janitor Room",
    "Corridor"
];
