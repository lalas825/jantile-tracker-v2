import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type UserRole = 'admin' | 'supervisor' | 'pm' | 'foreman' | 'worker' | 'warehouse' | 'shop'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  status: string
}

export interface ToolContext {
  profile: Profile
  role: UserRole          // convenience alias for profile.role
  jobIds: string[] | null // null = admin (no filter)
  supabase: SupabaseClient
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
