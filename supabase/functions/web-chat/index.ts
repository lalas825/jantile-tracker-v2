import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatWithGemini } from '../_shared/ai/gemini.ts'
import { authenticateBySupabaseToken, buildToolContext } from '../_shared/auth/auth.ts'
import type { ChatMessage } from '../_shared/types.ts'

// ─── Environment ────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── CORS ───────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// ─── Chat History ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 10

async function loadHistory(sessionId: string): Promise<ChatMessage[]> {
  try {
    const { data } = await supabase
      .from('web_chat_history')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY)

    if (!data?.length) return []

    return data.reverse().map((row: any) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }))
  } catch (err) {
    console.error('[WebChat] History load error:', err)
    return []
  }
}

async function saveMessage(
  sessionId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string
) {
  try {
    await supabase.from('web_chat_history').insert({
      session_id: sessionId,
      user_id: userId,
      role,
      content: content.substring(0, 2000),
    })

    // Prune old messages — keep last 20 per session
    const { data: old } = await supabase
      .from('web_chat_history')
      .select('id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .range(20, 1000)

    if (old?.length) {
      await supabase
        .from('web_chat_history')
        .delete()
        .in('id', old.map((r: any) => r.id))
    }
  } catch (err) {
    console.error('[WebChat] History save error:', err)
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    // Authenticate via Supabase JWT
    const authResult = await authenticateBySupabaseToken(
      supabase,
      req.headers.get('Authorization')
    )

    if (!authResult.ok) {
      const msg = authResult.reason === 'pending'
        ? 'Account pending approval'
        : 'Unauthorized'
      return jsonResponse({ error: msg }, 401)
    }

    // Parse request body
    let message: string
    let sessionId: string
    let imageData: { base64: string; mimeType: string } | undefined
    try {
      const body = await req.json()
      message = body.message || ''
      sessionId = body.session_id
      if (!sessionId) throw new Error('Missing session_id')
      if (!message && !body.image) throw new Error('Missing message or image')
      if (body.image?.base64 && body.image?.mimeType) {
        imageData = { base64: body.image.base64, mimeType: body.image.mimeType }
      }
    } catch {
      return jsonResponse({ error: 'Invalid request. Required: { message, session_id } or { image: { base64, mimeType }, session_id }' }, 400)
    }

    // Build context and load history
    const ctx = await buildToolContext(supabase, authResult.profile)
    const history = await loadHistory(sessionId)

    // Call Gemini with markdown format for web
    const response = await chatWithGemini(message, ctx, history, imageData, 'markdown')

    // Save conversation
    const userContent = imageData ? (message || '[File sent]') : message
    await saveMessage(sessionId, authResult.profile.id, 'user', userContent)
    await saveMessage(sessionId, authResult.profile.id, 'assistant', response)

    return jsonResponse({ response }, 200)
  } catch (err) {
    console.error('[WebChat] Unhandled error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
