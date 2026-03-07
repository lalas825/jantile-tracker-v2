// Checklist presets — mirrors src/constants/JobTemplates.ts for Deno Edge Function

const BATHROOM_TASKS = [
  'Soundproof', 'Mud / Self Level', 'Waterproof', 'Heat Mat',
  'Floor Tile / Stone', 'Wall Tile / Stone', 'Tub Deck', 'Base',
  'Grout', 'Caulk', 'Sealer', 'Vanity Top',
]

const POWDER_TASKS = [
  'Soundproof', 'Mud / Self Level', 'Waterproof',
  'Floor Tile / Stone', 'Wall Tile / Stone', 'Base',
  'Grout', 'Caulk', 'Sealer', 'Vanity Top',
]

const KITCHEN_TASKS = [
  'Counter Top', 'Backsplash', 'Island', 'Akemi', 'Caulk', 'Sealer',
]

const COMMON_AREA_TASKS = [
  'Soundproof', 'Mud / Self Level', 'Waterproof',
  'Floor Tile / Stone', 'Base', 'Grout', 'Caulk', 'Sealer',
]

export const CHECKLIST_PRESETS: Record<string, string[]> = {
  'master bathroom': BATHROOM_TASKS,
  'secondary bathroom': BATHROOM_TASKS,
  'restroom': BATHROOM_TASKS,
  'bathroom': BATHROOM_TASKS,
  'powder room': POWDER_TASKS,
  'locker room': POWDER_TASKS,
  'janitor room': POWDER_TASKS,
  'laundry': POWDER_TASKS,
  'kitchen': KITCHEN_TASKS,
  'foyer': COMMON_AREA_TASKS,
  'vestibule': COMMON_AREA_TASKS,
  'corridor': COMMON_AREA_TASKS,
}

export function getPresetForArea(name: string): string[] {
  const lower = name.toLowerCase()

  // Exact match
  if (CHECKLIST_PRESETS[lower]) return CHECKLIST_PRESETS[lower]

  // Partial match
  if (lower.includes('bathroom') || lower.includes('bath'))
    return CHECKLIST_PRESETS['master bathroom']
  if (lower.includes('kitchen')) return CHECKLIST_PRESETS['kitchen']
  if (lower.includes('powder')) return CHECKLIST_PRESETS['powder room']
  if (lower.includes('laundry')) return CHECKLIST_PRESETS['laundry']

  // Default fallback
  return CHECKLIST_PRESETS['master bathroom']
}
