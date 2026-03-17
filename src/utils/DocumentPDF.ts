/**
 * DocumentPDF.ts
 * PDF generation for work tickets (T&M) with optional signature overlay.
 * Uses HTML + expo-print (native) / window.open (web).
 * Other document types (PTP, JHA, etc.) will add methods later.
 */
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { AuditService } from '../features/audit/AuditService';
import type { WorkTicket, DocumentSignature, LaborEntry, MaterialEntry } from '../features/documents/types';

// ── Logo helper ─────────────────────────────────────────────
let cachedLogoDataUri: string | null = null;

async function getLogoDataUri(): Promise<string> {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const asset = Asset.fromModule(require('../../assets/images/jantile-logo.png'));
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoDataUri = reader.result as string;
        resolve(cachedLogoDataUri);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// ── Trade checkbox helper ───────────────────────────────────
function tradeCheckboxes(trade: string): string {
  const trades = ['Tile', 'Stone', 'Polisher'];
  return trades.map(t => {
    const checked = t.toLowerCase() === trade.toLowerCase();
    return `<span style="margin-right:16px;">${checked ? '&#9632;' : '&#9633;'} ${t.toUpperCase()}</span>`;
  }).join('');
}

// ── HTML builder ────────────────────────────────────────────
function buildTicketHTML(
  ticket: WorkTicket,
  signature: DocumentSignature | undefined,
  jobName: string,
  logoUri: string,
): string {
  const serviceDate = ticket.service_date
    ? new Date(ticket.service_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : '—';

  const logoHTML = logoUri
    ? `<img src="${logoUri}" style="height:44px;object-fit:contain;" />`
    : `<span style="font-size:24px;font-weight:900;letter-spacing:2px;">JANTILE.</span>`;

  // Labor rows
  let laborHTML = '';
  if (ticket.labor && ticket.labor.length > 0) {
    laborHTML = ticket.labor.map((l: LaborEntry) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-size:12px;">${l.name}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-size:12px;text-align:center;">${l.class}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-size:12px;text-align:center;">${l.reg_hours}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-size:12px;text-align:center;">${l.ot_hours}</td>
      </tr>
    `).join('');
  } else {
    laborHTML = '<tr><td colspan="4" style="padding:20px 8px;border:1px solid #d1d5db;font-size:12px;color:#9ca3af;text-align:center;">No labor entries</td></tr>';
  }

  // Material rows
  let materialHTML = '';
  if (ticket.materials && ticket.materials.length > 0) {
    materialHTML = ticket.materials.map((m: MaterialEntry) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-size:12px;">${m.description}</td>
        <td style="padding:6px 8px;border:1px solid #d1d5db;font-size:12px;text-align:center;width:80px;">${m.quantity}</td>
      </tr>
    `).join('');
  } else {
    materialHTML = '<tr><td colspan="2" style="padding:20px 8px;border:1px solid #d1d5db;font-size:12px;color:#9ca3af;text-align:center;">No materials</td></tr>';
  }

  // Signature overlay
  let signatureHTML = '';
  if (signature && signature.status === 'signed') {
    const signedDate = signature.signed_at
      ? new Date(signature.signed_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
      : '';
    const sigImgHTML = signature.signature_url
      ? `<img src="${signature.signature_url}" style="height:50px;object-fit:contain;position:absolute;bottom:10px;left:10px;" crossorigin="anonymous" />`
      : '';

    signatureHTML = `
      <div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:16px;">
        <div style="width:45%;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:4px;">APPROVED BY (PRINT NAME)</div>
          <div style="border-bottom:1px solid #1e293b;height:36px;position:relative;padding:8px;">
            <span style="font-size:14px;font-weight:600;">${signature.signer_name}</span>
          </div>
          <div style="font-size:10px;color:#9ca3af;margin-top:4px;">Date: ${signedDate}</div>
        </div>
        <div style="width:45%;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:4px;">AUTHORIZED SIGNATURE</div>
          <div style="border-bottom:1px solid #1e293b;height:36px;position:relative;">
            ${sigImgHTML}
          </div>
          <div style="font-size:10px;color:#9ca3af;margin-top:4px;">Date: ${signedDate}</div>
        </div>
      </div>
    `;
  } else {
    signatureHTML = `
      <div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:16px;">
        <div style="width:45%;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:4px;">APPROVED BY (PRINT NAME)</div>
          <div style="border-bottom:1px solid #1e293b;height:36px;"></div>
          <div style="font-size:10px;color:#9ca3af;margin-top:4px;">Date: _______________</div>
        </div>
        <div style="width:45%;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:4px;">AUTHORIZED SIGNATURE</div>
          <div style="border-bottom:1px solid #1e293b;height:36px;"></div>
          <div style="font-size:10px;color:#9ca3af;margin-top:4px;">Date: _______________</div>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>T&M Ticket #${ticket.ticket_number}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #1e293b;
      background: #fff;
      padding: 24px 32px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: letter; margin: 0.5in; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>

  <!-- Header Row -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
    <div>${logoHTML}</div>
    <div style="text-align:right;">
      <div style="font-size:18px;font-weight:900;letter-spacing:0.5px;">ORDER FOR ADDITIONAL WORK</div>
    </div>
  </div>

  <!-- Ticket Number + Date -->
  <div style="display:flex;justify-content:flex-end;gap:24px;margin-bottom:8px;">
    <div style="border:1px solid #1e293b;padding:4px 12px;font-size:12px;">
      <span style="font-weight:900;">NO.</span> ${ticket.ticket_number || '—'}
    </div>
    <div style="border:1px solid #1e293b;padding:4px 12px;font-size:12px;">
      <span style="font-weight:900;">DATE:</span> ${serviceDate}
    </div>
  </div>

  <!-- Red divider -->
  <div style="border-bottom:3px solid #dc2626;margin-bottom:16px;"></div>

  <!-- Job + Trade -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div style="font-size:14px;"><span style="font-weight:900;">JOB:</span> ${jobName}</div>
    <div style="font-size:12px;">${tradeCheckboxes(ticket.trade)}</div>
  </div>

  ${ticket.foreman_name ? `<div style="font-size:13px;margin-bottom:12px;"><span style="font-weight:700;">FOREMAN:</span> ${ticket.foreman_name}</div>` : ''}

  <!-- Work Description -->
  <div style="margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Time and material to complete the following:</div>
    <div style="border:1px solid #d1d5db;border-radius:4px;padding:12px;font-size:13px;line-height:1.6;min-height:60px;background:#fafafa;">
      ${ticket.work_description}
    </div>
  </div>

  <!-- Materials Table -->
  <div style="margin-bottom:20px;">
    <table>
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px 8px;border:1px solid #d1d5db;font-size:10px;font-weight:900;letter-spacing:1px;text-align:left;">MATERIALS DESCRIPTION</th>
          <th style="padding:6px 8px;border:1px solid #d1d5db;font-size:10px;font-weight:900;letter-spacing:1px;text-align:center;width:80px;">QUANTITY</th>
        </tr>
      </thead>
      <tbody>${materialHTML}</tbody>
    </table>
  </div>

  <!-- Labor Table -->
  <div style="margin-bottom:20px;">
    <table>
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:6px 8px;border:1px solid #d1d5db;font-size:10px;font-weight:900;letter-spacing:1px;text-align:left;">NAME</th>
          <th style="padding:6px 8px;border:1px solid #d1d5db;font-size:10px;font-weight:900;letter-spacing:1px;text-align:center;">CLASS</th>
          <th style="padding:6px 8px;border:1px solid #d1d5db;font-size:10px;font-weight:900;letter-spacing:1px;text-align:center;">REG</th>
          <th style="padding:6px 8px;border:1px solid #d1d5db;font-size:10px;font-weight:900;letter-spacing:1px;text-align:center;">OT</th>
        </tr>
      </thead>
      <tbody>${laborHTML}</tbody>
    </table>
  </div>

  <!-- GC Notes -->
  ${ticket.gc_notes ? `
  <div style="margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">GC Notes / Comments</div>
    <div style="border:1px solid #d1d5db;border-radius:4px;padding:12px;font-size:13px;line-height:1.6;background:#fafafa;">
      ${ticket.gc_notes}
    </div>
  </div>
  ` : ''}

  <!-- Signature Block -->
  ${signatureHTML}

  <!-- Footer -->
  <div style="text-align:center;margin-top:40px;font-size:9px;color:#94a3b8;">
    Jantile Group &mdash; T&M Ticket #${ticket.ticket_number || '—'}
  </div>

</body>
</html>`;
}

// ── Public API ──────────────────────────────────────────────

export const DocumentPDF = {

  async generateTicketHTML(
    ticket: WorkTicket,
    signature?: DocumentSignature,
    jobName?: string,
  ): Promise<string> {
    const logoUri = await getLogoDataUri();
    return buildTicketHTML(ticket, signature, jobName || '', logoUri);
  },

  async printTicket(
    ticket: WorkTicket,
    signature?: DocumentSignature,
    jobName?: string,
  ): Promise<void> {
    const html = await DocumentPDF.generateTicketHTML(ticket, signature, jobName);

    AuditService.log('PDF_GENERATED', {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      had_signature: signature?.status === 'signed',
    }).catch(() => {});

    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups and try again.');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => setTimeout(() => printWindow.print(), 400);
      setTimeout(() => { try { printWindow.print(); } catch { /* already printed */ } }, 1200);
    } else {
      // Native: use expo-print
      try {
        const Print = require('expo-print');
        await Print.printAsync({ html });
      } catch (err) {
        console.error('[DocumentPDF] printAsync failed:', err);
      }
    }
  },
};
