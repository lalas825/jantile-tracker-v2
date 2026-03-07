import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Profile, ToolContext } from '../types.ts'

// ─── Authentication ─────────────────────────────────────────────────────────────

export type AuthResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'unknown' | 'pending' }

export async function authenticateUser(
  supabase: SupabaseClient,
  telegramId: string
): Promise<AuthResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, status')
    .eq('telegram_id', telegramId)
    .single()

  if (error || !profile) {
    return { ok: false, reason: 'unknown' }
  }

  if (profile.status !== 'approved') {
    return { ok: false, reason: 'pending' }
  }

  return { ok: true, profile: profile as Profile }
}

// ─── Job Access ─────────────────────────────────────────────────────────────────

export async function getJobIds(
  supabase: SupabaseClient,
  profile: Profile
): Promise<{ jobIds: string[] | null; error?: string }> {
  if (profile.role === 'admin') {
    return { jobIds: null }
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

// ─── Context Builder ────────────────────────────────────────────────────────────

export async function buildToolContext(
  supabase: SupabaseClient,
  profile: Profile
): Promise<ToolContext> {
  const { jobIds } = await getJobIds(supabase, profile)
  return { profile, role: profile.role, jobIds, supabase }
}
