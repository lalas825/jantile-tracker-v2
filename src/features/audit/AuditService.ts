import { supabase } from '../../config/supabase';

export const AuditService = {
  async log(
    eventType: string,
    payload: Record<string, unknown> = {},
    userId?: string,
  ): Promise<void> {
    try {
      const uid = userId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
      const { error } = await supabase
        .from('audit_logs')
        .insert({ event_type: eventType, payload, user_id: uid });
      if (error) console.warn('[Audit]', error.message);
    } catch (e: any) {
      console.warn('[Audit]', e?.message || e);
    }
  },
};
