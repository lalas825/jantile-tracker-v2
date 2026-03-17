/**
 * validate-document-pdf.ts
 * ─────────────────────────────────────────────────────────────
 * Standalone validation script for DocumentPDF HTML generation.
 * Tests that the PDF handles all edge cases gracefully:
 *   - Empty labor/materials arrays
 *   - Null labor/materials
 *   - Populated labor & materials
 *   - Signed ticket with signature overlay
 *   - Missing optional fields (foreman_name, gc_notes)
 *
 * Run:  npx tsx scripts/validate-document-pdf.ts
 * ─────────────────────────────────────────────────────────────
 */

// ── Inline types (avoid importing from RN context) ─────────
interface LaborEntry { name: string; class: string; reg_hours: number; ot_hours: number }
interface MaterialEntry { description: string; quantity: number }
interface WorkTicket {
  id: string; job_id: string; ticket_number: number; service_date: string;
  work_description: string; trade: string; labor: LaborEntry[]; materials: MaterialEntry[];
  gc_notes?: string; status: string; signature_token?: string;
  created_by?: string; foreman_name?: string; created_at: string; updated_at: string;
}
interface DocumentSignature {
  id: string; document_type: string; document_id: string; job_id: string;
  signer_name: string; signer_email?: string; signer_role: string;
  signature_url?: string; status: string; token: string;
  ip_address?: string; signed_at?: string; created_at: string;
}

// ── Replicate core logic from DocumentPDF.ts ────────────────
function tradeCheckboxes(trade: string): string {
  const trades = ['Tile', 'Stone', 'Polisher'];
  return trades.map(t => {
    const checked = t.toLowerCase() === trade.toLowerCase();
    return `<span style="margin-right:16px;">${checked ? '■' : '□'} ${t.toUpperCase()}</span>`;
  }).join('');
}

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
<html><head><meta charset="utf-8"/><title>T&M Ticket #${ticket.ticket_number}</title></head>
<body>
  <div>${logoHTML}</div>
  <div>ORDER FOR ADDITIONAL WORK</div>
  <div>NO. ${ticket.ticket_number || '—'} DATE: ${serviceDate}</div>
  <div>JOB: ${jobName} ${tradeCheckboxes(ticket.trade)}</div>
  ${ticket.foreman_name ? `<div>FOREMAN: ${ticket.foreman_name}</div>` : ''}
  <div>${ticket.work_description}</div>
  <table><thead><tr><th>MATERIALS DESCRIPTION</th><th>QUANTITY</th></tr></thead><tbody>${materialHTML}</tbody></table>
  <table><thead><tr><th>NAME</th><th>CLASS</th><th>REG</th><th>OT</th></tr></thead><tbody>${laborHTML}</tbody></table>
  ${ticket.gc_notes ? `<div>GC Notes: ${ticket.gc_notes}</div>` : ''}
  ${signatureHTML}
</body></html>`;
}

// ── Test Fixtures ───────────────────────────────────────────
const baseTicket: WorkTicket = {
  id: 'test-001', job_id: 'job-001', ticket_number: 1,
  service_date: '2026-03-16', work_description: 'Install 12x24 porcelain in lobby area.',
  trade: 'Tile', labor: [], materials: [],
  status: 'draft', created_at: '2026-03-16T00:00:00Z', updated_at: '2026-03-16T00:00:00Z',
};

const sampleLabor: LaborEntry[] = [
  { name: 'John Smith', class: 'Mechanic', reg_hours: 8, ot_hours: 2 },
  { name: 'Maria Garcia', class: 'Helper', reg_hours: 8, ot_hours: 0 },
];

const sampleMaterials: MaterialEntry[] = [
  { description: '12x24 Porcelain Tile - White', quantity: 500 },
  { description: 'Thinset Mortar 50lb bag', quantity: 10 },
];

const sampleSignature: DocumentSignature = {
  id: 'sig-001', document_type: 'work_ticket', document_id: 'test-001',
  job_id: 'job-001', signer_name: 'Bob Builder', signer_email: 'bob@gc.com',
  signer_role: 'gc', signature_url: 'https://example.com/sig.png',
  status: 'signed', token: 'tok-001',
  signed_at: '2026-03-16T14:30:00Z', created_at: '2026-03-16T10:00:00Z',
};

// ── Test Runner ─────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function assertContains(html: string, substring: string, testName: string) {
  assert(html.includes(substring), testName, `expected HTML to contain "${substring}"`);
}

function assertNotContains(html: string, substring: string, testName: string) {
  assert(!html.includes(substring), testName, `expected HTML NOT to contain "${substring}"`);
}

// ── Tests ───────────────────────────────────────────────────

console.log('\n🔧 DocumentPDF Validation Script');
console.log('═'.repeat(50));

// TEST 1: Empty arrays
console.log('\n📋 TEST 1: Empty labor & materials arrays');
{
  const html = buildTicketHTML(baseTicket, undefined, 'Test Project', '');
  assertContains(html, 'No labor entries', 'Shows "No labor entries" fallback');
  assertContains(html, 'No materials', 'Shows "No materials" fallback');
  assertContains(html, 'JANTILE.', 'Shows text logo when no URI');
  assertContains(html, 'ORDER FOR ADDITIONAL WORK', 'Contains document title');
  assertNotContains(html, 'undefined', 'No "undefined" text in output');
  assertNotContains(html, 'null', 'No "null" text in output');
}

// TEST 2: Null labor & materials (edge case)
console.log('\n📋 TEST 2: Null labor & materials (simulating bad data)');
{
  const badTicket = { ...baseTicket, labor: null as any, materials: null as any };
  let html = '';
  let threw = false;
  try {
    html = buildTicketHTML(badTicket, undefined, 'Test Project', '');
  } catch (e) {
    threw = true;
  }
  assert(!threw, 'Does not throw on null labor/materials');
  if (!threw) {
    assertContains(html, 'No labor entries', 'Falls back to "No labor entries" for null');
    assertContains(html, 'No materials', 'Falls back to "No materials" for null');
  }
}

// TEST 3: Populated arrays
console.log('\n📋 TEST 3: Populated labor & materials');
{
  const ticket = { ...baseTicket, labor: sampleLabor, materials: sampleMaterials, foreman_name: 'Carlos' };
  const html = buildTicketHTML(ticket, undefined, 'JFK T1', '');
  assertContains(html, 'John Smith', 'Contains labor name');
  assertContains(html, 'Mechanic', 'Contains labor class');
  assertContains(html, '12x24 Porcelain Tile', 'Contains material description');
  assertContains(html, '500', 'Contains material quantity');
  assertContains(html, 'FOREMAN: Carlos', 'Contains foreman name');
  assertNotContains(html, 'No labor entries', 'Does NOT show empty fallback when labor exists');
  assertNotContains(html, 'No materials', 'Does NOT show empty fallback when materials exist');
}

// TEST 4: Signed ticket with signature overlay
console.log('\n📋 TEST 4: Signed ticket with signature');
{
  const ticket = { ...baseTicket, status: 'signed', labor: sampleLabor, materials: sampleMaterials };
  const html = buildTicketHTML(ticket, sampleSignature, 'JFK T1', '');
  assertContains(html, 'Bob Builder', 'Contains signer name');
  assertContains(html, 'APPROVED BY', 'Contains approval label');
  assertContains(html, 'AUTHORIZED SIGNATURE', 'Contains signature label');
  assertContains(html, 'https://example.com/sig.png', 'Contains signature image URL');
  assertNotContains(html, '_______________', 'Does NOT show blank date lines for signed ticket');
}

// TEST 5: Unsigned ticket (empty signature block)
console.log('\n📋 TEST 5: Unsigned ticket (no signature)');
{
  const html = buildTicketHTML(baseTicket, undefined, 'Test Project', '');
  assertContains(html, '_______________', 'Shows blank date lines for unsigned');
  assertNotContains(html, 'Bob Builder', 'No signer name when unsigned');
}

// TEST 6: GC Notes present vs absent
console.log('\n📋 TEST 6: GC Notes conditional rendering');
{
  const withNotes = { ...baseTicket, gc_notes: 'Please coordinate with fire alarm team.' };
  const htmlWith = buildTicketHTML(withNotes, undefined, 'Test', '');
  const htmlWithout = buildTicketHTML(baseTicket, undefined, 'Test', '');
  assertContains(htmlWith, 'coordinate with fire alarm', 'GC notes rendered when present');
  assertNotContains(htmlWithout, 'GC Notes', 'GC notes section absent when empty');
}

// TEST 7: Trade checkboxes
console.log('\n📋 TEST 7: Trade checkboxes');
{
  const tileTicket = { ...baseTicket, trade: 'Tile' };
  const stoneTicket = { ...baseTicket, trade: 'Stone' };
  const htmlTile = buildTicketHTML(tileTicket, undefined, 'Test', '');
  const htmlStone = buildTicketHTML(stoneTicket, undefined, 'Test', '');
  assertContains(htmlTile, '■ TILE', 'Tile checked for Tile trade');
  assertContains(htmlTile, '□ STONE', 'Stone unchecked for Tile trade');
  assertContains(htmlStone, '■ STONE', 'Stone checked for Stone trade');
  assertContains(htmlStone, '□ TILE', 'Tile unchecked for Stone trade');
}

// TEST 8: Missing service date
console.log('\n📋 TEST 8: Missing service date');
{
  const noDate = { ...baseTicket, service_date: '' };
  const html = buildTicketHTML(noDate, undefined, 'Test', '');
  assertContains(html, 'DATE: —', 'Shows dash when no service date');
}

// ── Summary ─────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.log('\n⚠️  Some tests FAILED. Review the output above.');
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed! PDF generation is solid.\n');
  process.exit(0);
}
