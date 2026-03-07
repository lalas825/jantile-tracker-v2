import { ToolContext, ChatMessage, UserRole, Profile } from './types.ts'
import { toolDeclarations } from './tools.ts'
import { handleToolCall } from './tool-handlers.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_VISION_MODEL = 'gemini-2.5-flash-lite'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const GEMINI_VISION_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`

const SYSTEM_INSTRUCTION = `You are Jantile Bot, an AI construction management assistant for the Jantile team.
You have FULL read and write access to the system. You can:
- Query jobs, floors, units, areas, checklists, issues, crew, and production data
- CREATE jobs (create_job) and entire job structures (bulk_create_structure)
- CREATE issues (create_issue) — do it when the user reports a problem
- UPDATE checklist items (update_checklist_items) — mark tasks complete/incomplete
- Query warehouse data: materials inventory, delivery tickets, purchase orders

RESPONSE STYLE:
- Format with HTML for Telegram: <b>bold</b>, <i>italic</i>, <code>code</code>
- Use emojis to make responses scannable
- Give rich, informative summaries — don't just repeat raw numbers
- NEVER expose internal IDs (UUIDs) to the user
- Respond in the same language the user writes in (English or Spanish)

WHEN REPORTING JOB STATUS:
- Show the job name, overall progress with a visual indicator
- If progress is low, mention it proactively ("needs attention")
- When you have floor/unit detail, summarize: how many units, best/worst areas

WHEN REPORTING ISSUES:
- Group by priority (High first)
- Show count and brief descriptions
- Mention which job each issue belongs to

WHEN REPORTING WAREHOUSE/MATERIALS:
- Show material name, product code, and quantities (ordered, in warehouse, in transit, received at job)
- Flag shortages: if budget_qty > ordered_qty or received_at_job is low
- For deliveries, show ticket number, status, destination, and due date
- For purchase orders, show PO number, vendor, status, and total amount

TOOL USAGE:
- To find a job by name, ALWAYS call get_jobs with job_name_filter first
- For detailed breakdowns, follow up with get_job_details using the job_id from get_jobs
- For checklist ops: find_areas → get_checklist → update_checklist_items
- For warehouse: get_materials, get_deliveries, get_purchase_orders (all need job_id)
- Default issue priority=Medium, type=General unless user specifies otherwise
- When user asks "how many units" or wants detail, use get_job_details
- When user asks about materials, deliveries, or inventory, use warehouse tools

CREATING JOB STRUCTURES:
- Use create_job to create a new job, then bulk_create_structure to add floors/units/areas
- IMPORTANT: When create_job returns a job_id, use that SAME job_id directly for bulk_create_structure. Do NOT call get_jobs to look it up again.
- Areas auto-get checklists based on name: Master Bathroom (12 tasks), Kitchen (6), Powder Room (10), Foyer/Corridor (8)
- Available area types: Master Bathroom, Secondary Bathroom, Powder Room, Kitchen, Foyer, Laundry, Vestibule, Corridor, Restroom, Janitor Room, Locker Room
- When user provides CSV or structured list, parse it into floors/units/areas format
- Max 10 floors per bulk_create_structure call — call multiple times for larger jobs
- ALWAYS show a summary of what will be created and ask for confirmation BEFORE creating
- Example: "I'll create 5 floors x 2 units x 3 areas = 30 areas with ~260 checklist items. Proceed?"

DELETING JOBS:
- Use delete_job to permanently delete a job and ALL its data (floors, units, areas, checklists, issues, materials)
- ALWAYS ask for confirmation before deleting — this is IRREVERSIBLE
- Admin only

CONVERSATION CONTEXT:
- Previous messages are included. Use them to understand follow-up questions
- If user says "that job" or "it", refer to the most recent job discussed
- Don't ask for clarification if context makes it obvious`

const VISION_INSTRUCTION = `You are Jantile Bot, an AI construction management assistant.
You are analyzing an image sent by a team member.

IF THE IMAGE IS A CONSTRUCTION PHOTO:
- Identify the type of work shown (tiling, grouting, framing, painting, drywall, plumbing, etc.)
- Assess quality: alignment, spacing, finish, cleanliness, levelness
- Flag any visible issues: cracks, chips, uneven surfaces, missing grout, water damage, poor cuts
- Note safety concerns if visible (exposed wiring, tripping hazards, missing PPE)
- Rate the overall quality (Good / Needs Attention / Poor)

IF THE IMAGE IS A FLOOR PLAN, SPREADSHEET, OR UNIT LIST:
- Extract all floor names, unit names/numbers, and area types you can identify
- Present the extracted structure clearly in a list format
- Suggest area types from: Master Bathroom, Secondary Bathroom, Powder Room, Kitchen, Foyer, Laundry, Vestibule, Corridor
- Ask the user to confirm before creating anything
- Example: "I can see 3 floors with 6 units each. Want me to create this structure?"

If the user provides a caption or question, address it specifically.
Format with HTML for Telegram: <b>bold</b>, <i>italic</i>
Use emojis to make the response scannable.
Be specific — reference what you actually see in the image.
Respond in the same language the user writes in (English or Spanish).`

// ─── Role-Based Instructions ─────────────────────────────────────────────────────

const ROLE_INSTRUCTIONS: Record<UserRole, string> = {
  admin: `YOUR ROLE: Admin (full access)
You have FULL access to all tools and all jobs.
- You CAN create jobs (create_job), create structures (bulk_create_structure), and delete jobs (delete_job)
- You CAN view all jobs, issues, crew, production, warehouse, and shop data
- You CAN update checklists and create issues for any job`,

  supervisor: `YOUR ROLE: Supervisor
You can view all your assigned jobs and their full data.
- You CAN view jobs, issues, crew/manpower, production, warehouse data
- You CAN update checklists and create issues
- You CANNOT create or delete jobs`,

  pm: `YOUR ROLE: Project Manager
You can view your assigned jobs with full logistics access.
- You CAN view jobs, issues, production, warehouse data (materials, deliveries, purchase orders)
- You CAN update checklists and create issues
- You CANNOT create or delete jobs
- You CANNOT view manpower/crew data`,

  foreman: `YOUR ROLE: Foreman
You can view your assigned jobs with field-level access.
- You CAN view jobs, issues, production, and checklists
- You CAN update checklists and create issues
- You CANNOT create or delete jobs
- You CANNOT view warehouse or purchase order data`,

  worker: `YOUR ROLE: Worker
You have basic access to your assigned jobs.
- You CAN view jobs and checklists assigned to you
- You CAN create issues to report problems
- You CANNOT create or delete jobs
- You CANNOT view warehouse or purchase order data`,

  warehouse: `YOUR ROLE: Warehouse
You specialize in materials and logistics.
- You CAN view all jobs (read-only for general info)
- You CAN view and focus on: materials inventory, delivery tickets, purchase orders
- You CAN create issues related to materials
- You CANNOT create or delete jobs
- You CANNOT update checklists`,

  shop: `YOUR ROLE: Shop
You handle shop-related operations.
- You CAN view all jobs (read-only for general info)
- You CAN create issues related to shop work
- You CANNOT create or delete jobs
- You CANNOT view warehouse data or update checklists`,
}

function getSystemInstruction(profile: Profile): string {
  const roleBlock = ROLE_INSTRUCTIONS[profile.role] || ROLE_INSTRUCTIONS['worker']
  return SYSTEM_INSTRUCTION + '\n\n' + roleBlock +
    `\nCurrent user: ${profile.full_name || 'User'} (role: ${profile.role})`
}

function getVisionInstruction(profile: Profile): string {
  const roleBlock = ROLE_INSTRUCTIONS[profile.role] || ROLE_INSTRUCTIONS['worker']
  return VISION_INSTRUCTION + '\n\n' + roleBlock +
    `\nUser: ${profile.full_name || 'User'} (role: ${profile.role})`
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  functionCall?: { name: string; args: Record<string, any> }
  functionResponse?: { name: string; response: { content: any } }
}

// ─── Text + Tools (no vision) ────────────────────────────────────────────────────

export async function chatWithGemini(
  userMessage: string,
  ctx: ToolContext,
  history: ChatMessage[] = [],
  imageData?: { base64: string; mimeType: string }
): Promise<string> {
  // If there's an image, use vision-only mode (no tools)
  if (imageData) {
    return analyzePhoto(userMessage, imageData, ctx)
  }

  // Text mode with tools and history
  const contents: any[] = []

  for (const msg of history) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }

  contents.push({ role: 'user', parts: [{ text: userMessage }] })

  const tools = [{ functionDeclarations: toolDeclarations }]

  // Function calling loop — max 5 rounds
  for (let round = 0; round < 5; round++) {
    const body: any = {
      contents,
      tools,
      systemInstruction: {
        parts: [{ text: getSystemInstruction(ctx.profile) }],
      },
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[Gemini] API error:', res.status, errText)
      return `\u26A0\uFE0F Gemini API error (${res.status}): ${errText.substring(0, 200)}`
    }

    const data = await res.json()
    const candidate = data.candidates?.[0]

    if (!candidate?.content?.parts) {
      console.error('[Gemini] No parts:', JSON.stringify(data))
      return '\u26A0\uFE0F AI could not generate a response. Try rephrasing.'
    }

    const parts: GeminiPart[] = candidate.content.parts
    const functionCalls = parts.filter((p: GeminiPart) => p.functionCall)

    if (functionCalls.length === 0) {
      const textParts = parts.filter((p: GeminiPart) => p.text)
      return textParts.map((p: GeminiPart) => p.text).join('') || 'Done.'
    }

    contents.push({ role: 'model', parts })

    const responseParts: GeminiPart[] = []

    for (const fc of functionCalls) {
      const { name, args } = fc.functionCall!
      console.log(`[Gemini] Tool call: ${name}(${JSON.stringify(args)})`)

      try {
        const result = await handleToolCall(name, args || {}, ctx)
        responseParts.push({
          functionResponse: { name, response: { content: result } },
        })
      } catch (err: any) {
        console.error(`[Gemini] Tool error ${name}:`, err)
        responseParts.push({
          functionResponse: {
            name,
            response: { content: { error: err.message } },
          },
        })
      }
    }

    contents.push({ role: 'user', parts: responseParts })
  }

  return '\u26A0\uFE0F Request too complex. Try a simpler question or use /jobs, /issues commands.'
}

// ─── Vision-only (no tools) ──────────────────────────────────────────────────────

async function analyzePhoto(
  caption: string,
  imageData: { base64: string; mimeType: string },
  ctx: ToolContext
): Promise<string> {
  const userParts: any[] = [
    { inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } },
    {
      text:
        caption ||
        'Analyze this construction photo. What type of work is shown? Assess quality and flag any issues.',
    },
  ]

  const body = {
    contents: [{ role: 'user', parts: userParts }],
    systemInstruction: {
      parts: [{ text: getVisionInstruction(ctx.profile) }],
    },
    generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
  }

  console.log(`[Gemini Vision] Sending photo (${imageData.mimeType}, ${Math.round(imageData.base64.length / 1024)}KB base64) to ${GEMINI_VISION_MODEL}`)

  const res = await fetch(GEMINI_VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[Gemini Vision] API error:', res.status, errText)
    return `\u26A0\uFE0F Vision error (${res.status}): ${errText.substring(0, 200)}`
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]

  if (!candidate?.content?.parts) {
    console.error('[Gemini Vision] No parts:', JSON.stringify(data))
    return '\u26A0\uFE0F Could not analyze the photo. Try again.'
  }

  const textParts = candidate.content.parts.filter((p: any) => p.text)
  return (
    textParts.map((p: any) => p.text).join('') ||
    '\u26A0\uFE0F No analysis generated.'
  )
}
