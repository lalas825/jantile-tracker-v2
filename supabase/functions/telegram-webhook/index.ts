import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Environment ────────────────────────────────────────────────────────────────
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Types ──────────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string
  role: string
  status: string
}

// ─── Telegram Helpers ───────────────────────────────────────────────────────────
async function sendMessage(chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('[Telegram] sendMessage failed:', err)
  }
}

function progressBar(pct: number): string {
  const filled = Math.round(pct / 10)
  return '\u2593'.repeat(filled) + '\u2591'.repeat(10 - filled)
}

// ─── Data Helpers ────────────────────────────────────────────────────────────────

async function getJobIds(profile: Profile): Promise<{ jobIds: string[] | null; error?: string }> {
  // Admins see all jobs, others only their assigned ones
  if (profile.role === 'admin') {
    return { jobIds: null } // null = no filter (all jobs)
  }

  const { data: assignments, error } = await supabase
    .from('job_assignments')
    .select('job_id')
    .eq('user_id', profile.id)

  if (error) {
    return { jobIds: [], error: error.message }
  }

  if (!assignments?.length) {
    return { jobIds: [] }
  }

  return { jobIds: assignments.map((a: any) => a.job_id) }
}

// ─── Command Handlers ───────────────────────────────────────────────────────────

async function handleStart(profile: Profile): Promise<string> {
  return [
    `\u{1F44B} Hola <b>${profile.full_name || 'Usuario'}</b>!`,
    '',
    'Comandos disponibles:',
    '/jobs \u2014 Mis obras activas',
    '/issues \u2014 Problemas abiertos',
    '/equipo \u2014 Personal en campo',
  ].join('\n')
}

async function handleJobs(profile: Profile): Promise<string> {
  try {
    // 1. Get job IDs (admin sees all, others see assigned)
    const { jobIds, error: assignError } = await getJobIds(profile)

    if (assignError) {
      console.error('[/jobs] assignments query:', assignError)
      return '\u26A0\uFE0F Error al consultar tus obras. Intenta de nuevo.'
    }

    if (jobIds !== null && !jobIds.length) {
      return '\u{1F4CB} No tienes obras asignadas en este momento.'
    }

    // 2. Get active jobs
    let query = supabase
      .from('jobs')
      .select('id, name, status')
      .ilike('status', 'active')
      .order('name')

    if (jobIds !== null) {
      query = query.in('id', jobIds)
    }

    const { data: jobs, error: jobsErr } = await query

    if (jobsErr) {
      console.error('[/jobs] jobs query:', jobsErr)
      return '\u26A0\uFE0F Error al consultar obras. Intenta de nuevo.'
    }

    if (!jobs?.length) {
      return '\u{1F4CB} No tienes obras activas en este momento.'
    }

    // 3. Get progress per job
    const lines: string[] = ['\u{1F3D7}\uFE0F <b>Mis Obras Activas</b>\n']

    for (const job of jobs) {
      // Calculate avg progress from areas via floors/units
      const { data: floors } = await supabase
        .from('floors')
        .select('id')
        .eq('job_id', job.id)

      let avgProgress = 0
      if (floors?.length) {
        const floorIds = floors.map((f: any) => f.id)
        const { data: units } = await supabase
          .from('units')
          .select('id')
          .in('floor_id', floorIds)

        if (units?.length) {
          const unitIds = units.map((u: any) => u.id)
          const { data: areas } = await supabase
            .from('areas')
            .select('progress')
            .in('unit_id', unitIds)

          if (areas?.length) {
            const total = areas.reduce((sum: number, a: any) => sum + (a.progress || 0), 0)
            avgProgress = Math.round(total / areas.length)
          }
        }
      }

      const bar = progressBar(avgProgress)
      lines.push(`\u{1F4CC} <b>${job.name}</b>`)
      lines.push(`   ${bar} ${avgProgress}%\n`)
    }

    return lines.join('\n')
  } catch (err) {
    console.error('[/jobs] exception:', err)
    return '\u26A0\uFE0F Error interno. Intenta de nuevo.'
  }
}

async function handleIssues(profile: Profile): Promise<string> {
  try {
    // 1. Get job IDs (admin sees all, others see assigned)
    const { jobIds, error: assignError } = await getJobIds(profile)

    if (assignError) {
      console.error('[/issues] assignments query:', assignError)
      return '\u26A0\uFE0F Error al consultar. Intenta de nuevo.'
    }

    if (jobIds !== null && !jobIds.length) {
      return '\u{1F4CB} No tienes obras asignadas en este momento.'
    }

    // 2. Get open issues for those jobs
    let query = supabase
      .from('job_issues')
      .select('id, job_id, type, priority, description, created_at')
      .eq('status', 'open')
      .order('priority', { ascending: false })
      .limit(15)

    if (jobIds !== null) {
      query = query.in('job_id', jobIds)
    }

    const { data: issues, error: issuesErr } = await query

    if (issuesErr) {
      console.error('[/issues] issues query:', issuesErr)
      return '\u26A0\uFE0F Error al consultar problemas. Intenta de nuevo.'
    }

    if (!issues?.length) {
      return '\u2705 No hay problemas abiertos. \u00A1Todo en orden!'
    }

    // 3. Get job names from the issues found
    const issueJobIds = [...new Set(issues.map((i: any) => i.job_id))]
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, name')
      .in('id', issueJobIds)

    const jobMap: Record<string, string> = {}
    jobs?.forEach((j: any) => { jobMap[j.id] = j.name })

    const priorityIcon: Record<string, string> = {
      High: '\u{1F534}', Medium: '\u{1F7E1}', Low: '\u{1F7E2}',
    }

    const lines = [`\u26A0\uFE0F <b>Problemas Abiertos (${issues.length})</b>\n`]

    for (const issue of issues) {
      const icon = priorityIcon[issue.priority] || '\u26AA'
      const jobName = jobMap[issue.job_id] || 'Obra desconocida'
      const desc = issue.description
        ? issue.description.substring(0, 80) + (issue.description.length > 80 ? '...' : '')
        : 'Sin descripcion'
      lines.push(`${icon} <b>${jobName}</b>`)
      lines.push(`   ${issue.type}: ${desc}`)
      lines.push('')
    }

    return lines.join('\n')
  } catch (err) {
    console.error('[/issues] exception:', err)
    return '\u26A0\uFE0F Error interno. Intenta de nuevo.'
  }
}

async function handleManpower(profile: Profile): Promise<string> {
  try {
    // 1. Get job IDs (admin sees all, others see assigned)
    const { jobIds, error: assignError } = await getJobIds(profile)

    if (assignError) {
      console.error('[/equipo] assignments query:', assignError)
      return '\u26A0\uFE0F Error al consultar. Intenta de nuevo.'
    }

    if (jobIds !== null && !jobIds.length) {
      return '\u{1F4CB} No tienes obras asignadas en este momento.'
    }

    // 2. Get active checkins (no checkout)
    let query = supabase
      .from('crew_checkins')
      .select('job_id, worker_id')
      .is('check_out', null)

    if (jobIds !== null) {
      query = query.in('job_id', jobIds)
    }

    const { data: checkins, error: checkErr } = await query

    if (checkErr) {
      console.error('[/equipo] checkins query:', checkErr)
      return '\u26A0\uFE0F Error al consultar equipo. Intenta de nuevo.'
    }

    if (!checkins?.length) {
      return '\u{1F477} No hay personal activo en campo en este momento.'
    }

    // 3. Get job names from checkins found
    const checkinJobIds = [...new Set(checkins.map((c: any) => c.job_id))]
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, name')
      .in('id', checkinJobIds)

    const jobMap: Record<string, string> = {}
    jobs?.forEach((j: any) => { jobMap[j.id] = j.name })

    // 4. Group by job
    const grouped: Record<string, { name: string; count: number }> = {}
    for (const c of checkins) {
      const jid = c.job_id
      if (!grouped[jid]) grouped[jid] = { name: jobMap[jid] || jid, count: 0 }
      grouped[jid].count++
    }

    let total = 0
    const lines = ['\u{1F477} <b>Equipo en Campo</b>\n']

    for (const [, g] of Object.entries(grouped)) {
      lines.push(`\u{1F3D7}\uFE0F ${g.name}: <b>${g.count}</b> trabajadores`)
      total += g.count
    }

    lines.push(`\n\u{1F4CA} Total activo: <b>${total}</b>`)

    return lines.join('\n')
  } catch (err) {
    console.error('[/equipo] exception:', err)
    return '\u26A0\uFE0F Error interno. Intenta de nuevo.'
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // 1. Validate webhook secret
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== WEBHOOK_SECRET) {
    console.warn('[Security] Invalid webhook secret from:', req.headers.get('x-forwarded-for'))
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const update = await req.json()
    const message = update.message

    // Ignore non-text messages (photos, stickers, etc.)
    if (!message?.text) {
      return new Response('OK')
    }

    const telegramId = String(message.from.id)
    const chatId = message.chat.id
    const text = message.text.trim()

    // 2. Lookup user by telegram_id
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, role, status')
      .eq('telegram_id', telegramId)
      .single()

    if (profileErr || !profile) {
      console.warn('[Security] Unknown telegram_id:', telegramId)
      await sendMessage(chatId, '\u26D4 Acceso no autorizado. Contacta al administrador de Jantile.')
      return new Response('OK')
    }

    if (profile.status !== 'approved') {
      await sendMessage(chatId, '\u23F3 Tu cuenta esta pendiente de aprobacion.')
      return new Response('OK')
    }

    // 3. Route command
    const command = text.split(' ')[0].split('@')[0].toLowerCase()
    let response: string

    switch (command) {
      case '/start':
        response = await handleStart(profile)
        break
      case '/jobs':
        response = await handleJobs(profile)
        break
      case '/issues':
        response = await handleIssues(profile)
        break
      case '/equipo':
        response = await handleManpower(profile)
        break
      default:
        response = 'Comando no reconocido. Usa /start para ver opciones disponibles.'
    }

    await sendMessage(chatId, response)
    return new Response('OK')
  } catch (err) {
    console.error('[Webhook] Unhandled error:', err)
    return new Response('Internal Error', { status: 500 })
  }
})
