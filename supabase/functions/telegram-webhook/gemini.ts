import { ToolContext, ChatMessage } from './types.ts'
import { toolDeclarations } from './tools.ts'
import { handleToolCall } from './tool-handlers.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_VISION_MODEL = 'gemini-2.5-flash-lite'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
const GEMINI_VISION_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`

const SYSTEM_INSTRUCTION = `You are Jantile Bot, an AI construction management assistant for the Jantile team.
You help users check job progress, review issues, manage checklists, view crew, and analyze construction photos.

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

TOOL USAGE:
- To find a job by name, ALWAYS call get_jobs with job_name_filter first
- For detailed breakdowns, follow up with get_job_details using the job_id from get_jobs
- For checklist ops: find_areas → get_checklist → update_checklist_items
- Default issue priority=Medium, type=General unless user specifies otherwise
- When user asks "how many units" or wants detail, use get_job_details

CONVERSATION CONTEXT:
- Previous messages are included. Use them to understand follow-up questions
- If user says "that job" or "it", refer to the most recent job discussed
- Don't ask for clarification if context makes it obvious`

const VISION_INSTRUCTION = `You are Jantile Bot, an AI construction management assistant.
You are analyzing a construction site photo sent by a team member.

Analyze the image thoroughly:
- Identify the type of work shown (tiling, grouting, framing, painting, drywall, plumbing, etc.)
- Assess quality: alignment, spacing, finish, cleanliness, levelness
- Flag any visible issues: cracks, chips, uneven surfaces, missing grout, water damage, poor cuts
- Note safety concerns if visible (exposed wiring, tripping hazards, missing PPE)
- Rate the overall quality (Good / Needs Attention / Poor)
- If the user provides a caption or question, address it specifically

Format with HTML for Telegram: <b>bold</b>, <i>italic</i>
Use emojis to make the response scannable.
Be specific — reference what you actually see in the image.
Respond in the same language the user writes in (English or Spanish).`

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
        parts: [
          {
            text:
              SYSTEM_INSTRUCTION +
              `\nCurrent user: ${ctx.profile.full_name || 'User'} (role: ${ctx.profile.role})`,
          },
        ],
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
      parts: [
        {
          text:
            VISION_INSTRUCTION +
            `\nUser: ${ctx.profile.full_name || 'User'} (role: ${ctx.profile.role})`,
        },
      ],
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
