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
    `\u{1F44B} Hi <b>${profile.full_name || 'User'}</b>!`,
    '',
    'Available commands:',
    '/jobs \u2014 My active jobs',
    '/issues \u2014 Open issues',
    '/manpower \u2014 Field crew',
    '/new_issue \u2014 Report a new issue',
  ].join('\n')
}

async function handleJobs(profile: Profile): Promise<string> {
  try {
    // 1. Get job IDs (admin sees all, others see assigned)
    const { jobIds, error: assignError } = await getJobIds(profile)

    if (assignError) {
      console.error('[/jobs] assignments query:', assignError)
      return '\u26A0\uFE0F Error fetching your jobs. Please try again.'
    }

    if (jobIds !== null && !jobIds.length) {
      return '\u{1F4CB} You have no assigned jobs at this time.'
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
      return '\u26A0\uFE0F Error fetching jobs. Please try again.'
    }

    if (!jobs?.length) {
      return '\u{1F4CB} No active jobs at this time.'
    }

    // 3. Get progress per job
    const lines: string[] = ['\u{1F3D7}\uFE0F <b>Active Jobs</b>\n']

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
    return '\u26A0\uFE0F Internal error. Please try again.'
  }
}

async function handleIssues(profile: Profile): Promise<string> {
  try {
    // 1. Get job IDs (admin sees all, others see assigned)
    const { jobIds, error: assignError } = await getJobIds(profile)

    if (assignError) {
      console.error('[/issues] assignments query:', assignError)
      return '\u26A0\uFE0F Error fetching data. Please try again.'
    }

    if (jobIds !== null && !jobIds.length) {
      return '\u{1F4CB} You have no assigned jobs at this time.'
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
      return '\u26A0\uFE0F Error fetching issues. Please try again.'
    }

    if (!issues?.length) {
      return '\u2705 No open issues. All good!'
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

    const lines = [`\u26A0\uFE0F <b>Open Issues (${issues.length})</b>\n`]

    for (const issue of issues) {
      const icon = priorityIcon[issue.priority] || '\u26AA'
      const jobName = jobMap[issue.job_id] || 'Unknown job'
      const desc = issue.description
        ? issue.description.substring(0, 80) + (issue.description.length > 80 ? '...' : '')
        : 'No description'
      lines.push(`${icon} <b>${jobName}</b>`)
      lines.push(`   ${issue.type}: ${desc}`)
      lines.push('')
    }

    return lines.join('\n')
  } catch (err) {
    console.error('[/issues] exception:', err)
    return '\u26A0\uFE0F Internal error. Please try again.'
  }
}

async function handleManpower(profile: Profile): Promise<string> {
  try {
    // 1. Get job IDs (admin sees all, others see assigned)
    const { jobIds, error: assignError } = await getJobIds(profile)

    if (assignError) {
      console.error('[/manpower] assignments query:', assignError)
      return '\u26A0\uFE0F Error fetching data. Please try again.'
    }

    if (jobIds !== null && !jobIds.length) {
      return '\u{1F4CB} You have no assigned jobs at this time.'
    }

    // 2. Get active checkins (no checkout) — check both null and empty string
    let query = supabase
      .from('crew_checkins')
      .select('job_id, worker_id')

    if (jobIds !== null) {
      query = query.in('job_id', jobIds)
    }

    const { data: allCheckins, error: checkErr } = await query

    if (checkErr) {
      console.error('[/manpower] checkins query:', JSON.stringify(checkErr))
      return '\u26A0\uFE0F Error fetching crew data. Please try again.'
    }

    // Filter active checkins (check_out is null or empty string)
    const checkins = allCheckins?.filter((c: any) => !c.check_out) || []

    if (!checkins.length) {
      return '\u{1F477} No active crew in the field right now.'
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
    const lines = ['\u{1F477} <b>Field Crew</b>\n']

    for (const [, g] of Object.entries(grouped)) {
      lines.push(`\u{1F3D7}\uFE0F ${g.name}: <b>${g.count}</b> workers`)
      total += g.count
    }

    lines.push(`\n\u{1F4CA} Total active: <b>${total}</b>`)

    return lines.join('\n')
  } catch (err) {
    console.error('[/manpower] exception:', err)
    return '\u26A0\uFE0F Internal error. Please try again.'
  }
}

async function handleNewIssue(profile: Profile, text: string): Promise<string> {
  try {
    // Parse: /new_issue <job_number> <description>
    const args = text.replace(/^\/new_issue\s*/i, '').trim()

    if (!args) {
      // Show usage with numbered job list
      const { jobIds } = await getJobIds(profile)

      let query = supabase
        .from('jobs')
        .select('id, name')
        .ilike('status', 'active')
        .order('name')

      if (jobIds !== null) {
        if (!jobIds.length) return '\u{1F4CB} You have no assigned jobs.'
        query = query.in('id', jobIds)
      }

      const { data: jobs } = await query

      if (!jobs?.length) return '\u{1F4CB} No active jobs found.'

      const lines = [
        '\u{1F4DD} <b>Create New Issue</b>\n',
        'Usage: <code>/new_issue [job#] [description]</code>\n',
        '<b>Your jobs:</b>',
      ]
      jobs.forEach((j: any, i: number) => {
        lines.push(`  <b>${i + 1}.</b> ${j.name}`)
      })
      lines.push('\nExample: <code>/new_issue 1 Water leak in unit 302</code>')

      return lines.join('\n')
    }

    // Parse job number and description
    const spaceIdx = args.indexOf(' ')
    if (spaceIdx === -1) {
      return '\u26A0\uFE0F Please provide a description.\nUsage: <code>/new_issue [job#] [description]</code>'
    }

    const jobNum = parseInt(args.substring(0, spaceIdx), 10)
    const description = args.substring(spaceIdx + 1).trim()

    if (isNaN(jobNum) || jobNum < 1) {
      return '\u26A0\uFE0F Invalid job number. Send /new_issue to see the list.'
    }

    if (!description) {
      return '\u26A0\uFE0F Please provide a description.'
    }

    // Get jobs list to resolve number → id
    const { jobIds } = await getJobIds(profile)

    let query = supabase
      .from('jobs')
      .select('id, name')
      .ilike('status', 'active')
      .order('name')

    if (jobIds !== null) {
      if (!jobIds.length) return '\u{1F4CB} You have no assigned jobs.'
      query = query.in('id', jobIds)
    }

    const { data: jobs } = await query

    if (!jobs?.length || jobNum > jobs.length) {
      return `\u26A0\uFE0F Job #${jobNum} not found. Send /new_issue to see the list.`
    }

    const selectedJob = jobs[jobNum - 1]

    // Insert the issue
    const { error: insertErr } = await supabase
      .from('job_issues')
      .insert({
        job_id: selectedJob.id,
        type: 'General',
        priority: 'Medium',
        status: 'open',
        description,
        created_by: profile.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (insertErr) {
      console.error('[/new_issue] insert error:', JSON.stringify(insertErr))
      return '\u26A0\uFE0F Error creating issue. Please try again.'
    }

    return [
      '\u2705 <b>Issue Created</b>\n',
      `\u{1F3D7}\uFE0F Job: <b>${selectedJob.name}</b>`,
      `\u{1F4CB} Type: General`,
      `\u{1F7E1} Priority: Medium`,
      `\u{1F4DD} ${description}`,
    ].join('\n')
  } catch (err) {
    console.error('[/new_issue] exception:', err)
    return '\u26A0\uFE0F Internal error. Please try again.'
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
      await sendMessage(chatId, '\u26D4 Unauthorized access. Contact your Jantile administrator.')
      return new Response('OK')
    }

    if (profile.status !== 'approved') {
      await sendMessage(chatId, '\u23F3 Your account is pending approval.')
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
      case '/manpower':
        response = await handleManpower(profile)
        break
      case '/new_issue':
        response = await handleNewIssue(profile, text)
        break
      default:
        response = 'Unknown command. Use /start to see available options.'
    }

    await sendMessage(chatId, response)
    return new Response('OK')
  } catch (err) {
    console.error('[Webhook] Unhandled error:', err)
    return new Response('Internal Error', { status: 500 })
  }
})
