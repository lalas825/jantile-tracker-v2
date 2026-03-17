// ── Document Type System ────────────────────────────────────
// 1:1 match with SQL migration 20260316000000_document_signatures.sql

export type DocumentType = 'work_ticket' | 'ptp' | 'jha' | 'safety_toolbox' | 'sign_off';
export type TicketStatus = 'draft' | 'pending_signature' | 'signed' | 'declined';
export type SignatureStatus = 'pending' | 'signed' | 'declined';

// ── Work Tickets (work_tickets table) ───────────────────────

export interface WorkTicket {
  id: string;
  job_id: string;
  ticket_number: number;
  service_date: string;
  work_description: string;
  trade: string;
  labor: LaborEntry[];
  materials: MaterialEntry[];
  gc_notes?: string;
  status: TicketStatus;
  signature_token?: string;
  created_by?: string;
  foreman_name?: string;
  created_at: string;
  updated_at: string;
}

export interface LaborEntry {
  name: string;
  class: string;
  reg_hours: number;
  ot_hours: number;
}

export interface MaterialEntry {
  description: string;
  quantity: number;
}

// ── Document Signatures (document_signatures table) ─────────

export interface DocumentSignature {
  id: string;
  document_type: DocumentType;
  document_id: string;
  job_id: string;
  signer_name: string;
  signer_email?: string;
  signer_role: string;
  signature_url?: string;
  status: SignatureStatus;
  token: string;
  ip_address?: string;
  signed_at?: string;
  created_at: string;
}
