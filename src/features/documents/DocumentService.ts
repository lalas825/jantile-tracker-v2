import { Platform } from 'react-native';
import { supabase } from '../../config/supabase';
import { db } from '../../powersync/db';
import * as Crypto from 'expo-crypto';
import { AuditService } from '../audit/AuditService';
import type {
  DocumentType,
  WorkTicket,
  LaborEntry,
  MaterialEntry,
  DocumentSignature,
  TicketStatus,
} from './types';

const useSupabase = Platform.OS === 'web' || (db as any).isMock;

// ── Helpers ─────────────────────────────────────────────────

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value as T;
  try { return JSON.parse(value as string); } catch { return fallback; }
}

function mapRowToTicket(row: any): WorkTicket {
  return {
    id: row.id,
    job_id: row.job_id,
    ticket_number: row.ticket_number ?? 0,
    service_date: row.service_date ?? '',
    work_description: row.work_description ?? '',
    trade: row.trade ?? 'Tile',
    labor: parseJson<LaborEntry[]>(row.labor, []),
    materials: parseJson<MaterialEntry[]>(row.materials, []),
    gc_notes: row.gc_notes ?? undefined,
    status: (row.status ?? 'draft') as TicketStatus,
    signature_token: row.signature_token ?? undefined,
    created_by: row.created_by ?? undefined,
    foreman_name: row.foreman_name ?? undefined,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

function mapRowToSignature(row: any): DocumentSignature {
  return {
    id: row.id,
    document_type: row.document_type,
    document_id: row.document_id,
    job_id: row.job_id,
    signer_name: row.signer_name,
    signer_email: row.signer_email ?? undefined,
    signer_role: row.signer_role ?? 'gc',
    signature_url: row.signature_url ?? undefined,
    status: row.status ?? 'pending',
    token: row.token,
    ip_address: row.ip_address ?? undefined,
    signed_at: row.signed_at ?? undefined,
    created_at: row.created_at ?? '',
  };
}

// ── Document Service ────────────────────────────────────────

export const DocumentService = {

  // ── Work Tickets ────────────────────────────────────────

  async createWorkTicket(
    data: Omit<WorkTicket, 'id' | 'ticket_number' | 'created_at' | 'updated_at'>
  ): Promise<string> {
    const id = Crypto.randomUUID();
    const signatureToken = Crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      if (useSupabase) {
        const { error } = await supabase.from('work_tickets').insert({
          id,
          job_id: data.job_id,
          service_date: data.service_date,
          work_description: data.work_description,
          trade: data.trade || 'Tile',
          labor: data.labor || [],
          materials: data.materials || [],
          gc_notes: data.gc_notes || null,
          status: data.status || 'draft',
          signature_token: signatureToken,
          created_by: data.created_by || null,
          foreman_name: data.foreman_name || null,
          created_at: now,
          updated_at: now,
        });
        if (error) { console.error('[DocumentService] createWorkTicket web error:', error); throw error; }
      } else {
        await db.execute(
          `INSERT INTO work_tickets (id, job_id, service_date, work_description, trade, labor, materials, gc_notes, status, signature_token, created_by, foreman_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, data.job_id, data.service_date, data.work_description,
            data.trade || 'Tile',
            JSON.stringify(data.labor || []),
            JSON.stringify(data.materials || []),
            data.gc_notes || null,
            data.status || 'draft',
            signatureToken,
            data.created_by || null,
            data.foreman_name || null,
            now, now,
          ]
        );
      }
    } catch (err) {
      console.error('[DocumentService] createWorkTicket failed:', err);
      throw err;
    }

    return id;
  },

  async getWorkTickets(jobId: string): Promise<WorkTicket[]> {
    try {
      let tickets: WorkTicket[] = [];

      if (useSupabase) {
        const { data, error } = await supabase
          .from('work_tickets')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false });
        if (error) { console.error('[DocumentService] getWorkTickets web error:', error); throw error; }
        tickets = (data || []).map(mapRowToTicket);
      } else {
        const rows = await db.getAll(
          `SELECT * FROM work_tickets WHERE job_id = ? ORDER BY created_at DESC`,
          [jobId]
        );
        tickets = rows.map(mapRowToTicket);
      }

      // Attach signatures for each ticket
      for (const ticket of tickets) {
        const sig = await DocumentService.getSignatureForDocument('work_ticket', ticket.id);
        if (sig) (ticket as any).signature = sig;
      }

      return tickets;
    } catch (err) {
      console.error('[DocumentService] getWorkTickets failed:', err);
      return [];
    }
  },

  async updateWorkTicket(id: string, data: Partial<WorkTicket>): Promise<void> {
    const now = new Date().toISOString();

    try {
      if (useSupabase) {
        const updates: Record<string, unknown> = { updated_at: now };
        if (data.service_date !== undefined) updates.service_date = data.service_date;
        if (data.work_description !== undefined) updates.work_description = data.work_description;
        if (data.trade !== undefined) updates.trade = data.trade;
        if (data.labor !== undefined) updates.labor = data.labor;
        if (data.materials !== undefined) updates.materials = data.materials;
        if (data.gc_notes !== undefined) updates.gc_notes = data.gc_notes;
        if (data.status !== undefined) updates.status = data.status;
        if (data.foreman_name !== undefined) updates.foreman_name = data.foreman_name;
        if (data.signature_token !== undefined) updates.signature_token = data.signature_token;

        const { error } = await supabase.from('work_tickets').update(updates).eq('id', id);
        if (error) { console.error('[DocumentService] updateWorkTicket web error:', error); throw error; }
      } else {
        const clauses: string[] = ['updated_at = ?'];
        const params: unknown[] = [now];

        if (data.service_date !== undefined) { clauses.push('service_date = ?'); params.push(data.service_date); }
        if (data.work_description !== undefined) { clauses.push('work_description = ?'); params.push(data.work_description); }
        if (data.trade !== undefined) { clauses.push('trade = ?'); params.push(data.trade); }
        if (data.labor !== undefined) { clauses.push('labor = ?'); params.push(JSON.stringify(data.labor)); }
        if (data.materials !== undefined) { clauses.push('materials = ?'); params.push(JSON.stringify(data.materials)); }
        if (data.gc_notes !== undefined) { clauses.push('gc_notes = ?'); params.push(data.gc_notes); }
        if (data.status !== undefined) { clauses.push('status = ?'); params.push(data.status); }
        if (data.foreman_name !== undefined) { clauses.push('foreman_name = ?'); params.push(data.foreman_name); }
        if (data.signature_token !== undefined) { clauses.push('signature_token = ?'); params.push(data.signature_token); }

        params.push(id);
        await db.execute(`UPDATE work_tickets SET ${clauses.join(', ')} WHERE id = ?`, params);
      }
    } catch (err) {
      console.error('[DocumentService] updateWorkTicket failed:', err);
      throw err;
    }
  },

  async deleteWorkTicket(id: string): Promise<void> {
    try {
      // Only allow delete if status = 'draft'
      if (useSupabase) {
        const { data: ticket } = await supabase.from('work_tickets').select('status').eq('id', id).single();
        if (ticket?.status && ticket.status !== 'draft') {
          console.warn('[DocumentService] Cannot delete non-draft ticket');
          return;
        }
        const { error } = await supabase.from('work_tickets').delete().eq('id', id);
        if (error) { console.error('[DocumentService] deleteWorkTicket web error:', error); throw error; }
      } else {
        const rows = await db.getAll(`SELECT status FROM work_tickets WHERE id = ?`, [id]);
        if (rows.length > 0 && (rows[0] as any).status !== 'draft') {
          console.warn('[DocumentService] Cannot delete non-draft ticket');
          return;
        }
        await db.execute(`DELETE FROM work_tickets WHERE id = ?`, [id]);
      }
    } catch (err) {
      console.error('[DocumentService] deleteWorkTicket failed:', err);
      throw err;
    }
  },

  // ── Signatures (shared — works for any document type) ──

  async createSignatureRequest(params: {
    documentType: DocumentType;
    documentId: string;
    jobId: string;
    signerName: string;
    signerEmail?: string;
    signerRole?: string;
  }): Promise<{ token: string; signUrl: string }> {
    const token = Crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      if (useSupabase) {
        const { error } = await supabase.from('document_signatures').insert({
          document_type: params.documentType,
          document_id: params.documentId,
          job_id: params.jobId,
          signer_name: params.signerName,
          signer_email: params.signerEmail || null,
          signer_role: params.signerRole || 'gc',
          status: 'pending',
          token,
          created_at: now,
        });
        if (error) { console.error('[DocumentService] createSignatureRequest web error:', error); throw error; }
      } else {
        const id = Crypto.randomUUID();
        await db.execute(
          `INSERT INTO document_signatures (id, document_type, document_id, job_id, signer_name, signer_email, signer_role, status, token, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, params.documentType, params.documentId, params.jobId, params.signerName, params.signerEmail || null, params.signerRole || 'gc', 'pending', token, now]
        );
      }

      // Update parent document status to pending_signature
      if (params.documentType === 'work_ticket') {
        await DocumentService.updateWorkTicket(params.documentId, { status: 'pending_signature' });
      }

      const signUrl = DocumentService.generateSignUrl(token);
      return { token, signUrl };
    } catch (err) {
      console.error('[DocumentService] createSignatureRequest failed:', err);
      throw err;
    }
  },

  async getDocumentByToken(
    token: string
  ): Promise<{ type: DocumentType; document: WorkTicket; signature: DocumentSignature } | null> {
    // PUBLIC — always use supabase directly (no auth required for token-based access)
    try {
      const { data: sigRow, error: sigErr } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('token', token)
        .single();

      if (sigErr || !sigRow) return null;

      const signature = mapRowToSignature(sigRow);

      // Fetch parent document based on type
      if (signature.document_type === 'work_ticket') {
        const { data: ticketRow, error: ticketErr } = await supabase
          .from('work_tickets')
          .select('*')
          .eq('id', signature.document_id)
          .single();

        if (ticketErr || !ticketRow) return null;

        return {
          type: 'work_ticket',
          document: mapRowToTicket(ticketRow),
          signature,
        };
      }

      // Other document types will be added here later (ptp, jha, etc.)
      return null;
    } catch (err) {
      console.error('[DocumentService] getDocumentByToken failed:', err);
      return null;
    }
  },

  async submitSignature(params: {
    token: string;
    signatureDataUrl: string; // base64 PNG data URL
    signerName: string;
  }): Promise<void> {
    // PUBLIC — always use supabase directly
    try {
      // 1. Decode base64 data URL → Blob
      const base64 = params.signatureDataUrl.replace(/^data:image\/png;base64,/, '');
      const byteString = atob(base64);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });

      // 2. Upload PNG to Supabase Storage
      const storagePath = `${params.token}.png`;
      const { error: uploadErr } = await supabase.storage
        .from('signatures')
        .upload(storagePath, blob, { contentType: 'image/png', upsert: true });
      if (uploadErr) { console.error('[DocumentService] signature upload error:', uploadErr); throw uploadErr; }

      // 3. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(storagePath);

      // 4. Update document_signatures
      const { error: sigErr } = await supabase
        .from('document_signatures')
        .update({
          status: 'signed',
          signature_url: publicUrl,
          signer_name: params.signerName,
          signed_at: new Date().toISOString(),
        })
        .eq('token', params.token);
      if (sigErr) { console.error('[DocumentService] signature update error:', sigErr); throw sigErr; }

      // 5. Update parent document status
      const { data: sigRow } = await supabase
        .from('document_signatures')
        .select('document_type, document_id')
        .eq('token', params.token)
        .single();

      if (sigRow?.document_type === 'work_ticket') {
        await supabase
          .from('work_tickets')
          .update({ status: 'signed', updated_at: new Date().toISOString() })
          .eq('id', sigRow.document_id);
      }

      AuditService.log('SIGNATURE_SUBMITTED', {
        document_type: sigRow?.document_type,
        document_id: sigRow?.document_id,
        signer_name: params.signerName,
        token: params.token,
      }).catch(() => {});
    } catch (err) {
      console.error('[DocumentService] submitSignature failed:', err);
      throw err;
    }
  },

  async getSignatureForDocument(
    documentType: DocumentType,
    documentId: string
  ): Promise<DocumentSignature | null> {
    try {
      if (useSupabase) {
        const { data, error } = await supabase
          .from('document_signatures')
          .select('*')
          .eq('document_type', documentType)
          .eq('document_id', documentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (error || !data) return null;
        return mapRowToSignature(data);
      } else {
        const rows = await db.getAll(
          `SELECT * FROM document_signatures WHERE document_type = ? AND document_id = ? ORDER BY created_at DESC LIMIT 1`,
          [documentType, documentId]
        );
        if (rows.length === 0) return null;
        return mapRowToSignature(rows[0]);
      }
    } catch {
      return null;
    }
  },

  // ── Email Helpers ─────────────────────────────────────────

  generateMailtoLink(params: {
    recipientEmail: string;
    documentType: DocumentType;
    documentNumber: number;
    jobName: string;
    signUrl: string;
  }): string {
    const subject = encodeURIComponent(
      `Jantile T&M Ticket #${params.documentNumber} — ${params.jobName} — Signature Required`
    );
    const body = encodeURIComponent(
      `Hello,\n\nYou have a T&M Ticket (#${params.documentNumber}) from ${params.jobName} that requires your signature.\n\nPlease review and sign the document using the link below:\n\n${params.signUrl}\n\nThank you,\nJantile Group`
    );
    return `mailto:${params.recipientEmail}?subject=${subject}&body=${body}`;
  },

  generateSignUrl(token: string): string {
    if (__DEV__) {
      return `http://localhost:8081/sign/${token}`;
    }
    return `https://jantile-tracker-v2.vercel.app/sign/${token}`;
  },
};
