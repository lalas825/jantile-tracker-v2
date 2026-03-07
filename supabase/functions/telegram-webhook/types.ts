import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface Profile {
  id: string
  full_name: string
  role: string
  status: string
}

export interface ToolContext {
  profile: Profile
  jobIds: string[] | null // null = admin (no filter)
  supabase: SupabaseClient
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
