/**
 * PolishersReportPDF.ts
 * Generates a print-ready HTML Polishers Production Report and opens it
 * in a new browser tab with the native print dialog.
 */
import { Asset } from 'expo-asset';

// ---------------------------------------------------------------------------
// Logo helper – same pattern as DeliveryTicketPDF.ts
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReportLog {
    date: string;
    jobName: string;
    plNumber: string;
    unit: string;
    regHours: string;
    otHours: string;
    ticketNumber: string;
    notes: string;
    isTicket: boolean;
    isJantile: boolean;
}

interface ReportWorker {
    id: string;
    name: string;
    logs: ReportLog[];
}

interface ReportTotals {
    contract: number;
    ticket: number;
    total: number;
    ot: number;
}

interface DateRange {
    start: Date;
    end: Date;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function formatDateDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeNum(val: string | number | undefined): number {
    return parseFloat(String(val)) || 0;
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------
function buildHTML(
    workers: ReportWorker[],
    dateRange: DateRange,
    totals: ReportTotals,
    logoUri: string
): string {
    const now = new Date();
    const timestamp = now.toLocaleDateString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric'
    }) + ', ' + now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    const isSingleDay = dateRange.start.toDateString() === dateRange.end.toDateString();
    const dateLabel = isSingleDay
        ? formatDateDisplay(dateRange.start)
        : `${formatDateDisplay(dateRange.start)} – ${formatDateDisplay(dateRange.end)}`;

    const logoHTML = logoUri
        ? `<img src="${logoUri}" style="height:40px;object-fit:contain;" />`
        : `<span style="font-size:22px;font-weight:900;letter-spacing:2px;font-family:'Inter',sans-serif;">JANTILE.</span>`;

    // Build worker sections
    let workerSectionsHTML = '';

    for (const worker of workers) {
        if (worker.logs.length === 0) continue;

        let workerReg = 0;
        let workerOt = 0;

        const sortedLogs = [...worker.logs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let rowsHTML = '';
        for (const log of sortedLogs) {
            const reg = safeNum(log.regHours);
            const ot = safeNum(log.otHours);
            const rowTotal = reg + ot;
            workerReg += reg;
            workerOt += ot;

            const typeLabel = log.isTicket ? 'TKT' : log.isJantile ? 'JAN' : '—';

            const displayDate = log.date ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

            rowsHTML += `
            <tr>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${displayDate}</td>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;">${log.jobName || '—'}</td>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;text-align:center;">${log.plNumber || '—'}</td>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;text-align:center;">${log.unit || '—'}</td>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;">${reg || '—'}</td>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;${ot > 0 ? 'color:#dc2626;' : ''}">${ot || '—'}</td>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;text-align:center;">${log.ticketNumber || '—'}</td>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;">${log.notes || '—'}</td>
                <td style="padding:7px 8px;font-size:12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:700;">${rowTotal || '—'}</td>
                <td style="padding:7px 8px;font-size:11px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b;">${typeLabel}</td>
            </tr>`;
        }

        const workerTotal = workerReg + workerOt;

        workerSectionsHTML += `
        <div style="margin-bottom:28px;page-break-inside:avoid;">
            <!-- Worker Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0;">
                <div style="font-size:14px;font-weight:900;color:#1e293b;letter-spacing:0.3px;">${worker.name}</div>
                <div style="font-size:13px;font-weight:700;color:#334155;">
                    <span style="color:#64748b;font-weight:600;font-size:11px;">TOTAL:</span> ${workerTotal} hrs
                    ${workerOt > 0 ? `<span style="color:#dc2626;font-size:11px;margin-left:8px;">(OT: ${workerOt})</span>` : ''}
                </div>
            </div>

            <!-- Worker Table -->
            <table style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="text-align:left;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">DATE</th>
                        <th style="text-align:left;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">JOB SITE</th>
                        <th style="text-align:center;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">PL #</th>
                        <th style="text-align:center;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">UNIT</th>
                        <th style="text-align:center;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">REG HRS</th>
                        <th style="text-align:center;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">OT HRS</th>
                        <th style="text-align:center;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">TKT #</th>
                        <th style="text-align:left;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">DESCRIPTION</th>
                        <th style="text-align:center;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">TOTAL</th>
                        <th style="text-align:center;padding:8px;font-size:10px;font-weight:900;letter-spacing:1px;color:#64748b;border-bottom:2px solid #e2e8f0;">TYPE</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                    <!-- Subtotal Row -->
                    <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
                        <td colspan="4" style="padding:8px;font-size:11px;font-weight:900;text-align:right;letter-spacing:1px;color:#64748b;">SUBTOTAL</td>
                        <td style="padding:8px;font-size:12px;font-weight:900;text-align:center;color:#1e293b;">${workerReg}</td>
                        <td style="padding:8px;font-size:12px;font-weight:900;text-align:center;${workerOt > 0 ? 'color:#dc2626;' : 'color:#1e293b;'}">${workerOt}</td>
                        <td colspan="2"></td>
                        <td style="padding:8px;font-size:13px;font-weight:900;text-align:center;color:#1e293b;">${workerTotal}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>Polishers Production Report – ${dateLabel}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js"></script>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1e293b;
            background: #fff;
            padding: 20px 32px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        @page {
            size: letter landscape;
            margin: 0.4in;
        }
        @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
        }
        table { width: 100%; border-collapse: collapse; }
        .action-bar {
            position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
            display: flex; justify-content: center; gap: 12px;
            padding: 12px; background: rgba(30,41,59,0.95); backdrop-filter: blur(8px);
        }
        .action-bar button {
            padding: 10px 24px; border: none; border-radius: 8px;
            font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700;
            cursor: pointer; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .btn-pdf { background: #2563eb; color: #fff; }
        .btn-pdf:hover { background: #1d4ed8; }
        .btn-pdf:disabled { background: #94a3b8; cursor: wait; }
        .btn-print { background: #f1f5f9; color: #334155; }
        .btn-print:hover { background: #e2e8f0; }
    </style>
</head>
<body>
    <!-- Action Bar -->
    <div class="action-bar no-print">
        <button class="btn-pdf" id="downloadPdf" onclick="generatePDF()">Download PDF</button>
        <button class="btn-print" onclick="window.print()">Print</button>
    </div>

    <!-- Spacer for fixed action bar -->
    <div class="no-print" style="height:60px;"></div>

    <!-- Report Content -->
    <div id="report-content">

    <!-- Timestamp -->
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-bottom:12px;">
        <span>Generated: ${timestamp}</span>
        <span>Polishers Production Report</span>
    </div>

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #1e293b;margin-bottom:24px;">
        <div>
            ${logoHTML}
            <div style="font-size:18px;font-weight:900;margin-top:6px;letter-spacing:0.5px;">Polishers Production Report</div>
        </div>
        <div style="text-align:right;font-size:12px;line-height:1.8;">
            <div><span style="font-weight:900;">Date:</span> ${dateLabel}</div>
            <div><span style="font-weight:900;">Workers:</span> ${workers.filter(w => w.logs.length > 0).length}</div>
            <div><span style="font-weight:900;">Total Entries:</span> ${workers.reduce((a, w) => a + w.logs.length, 0)}</div>
        </div>
    </div>

    <!-- Worker Sections -->
    ${workerSectionsHTML}

    <!-- Grand Totals -->
    <div style="margin-top:20px;padding:16px 20px;background:#1e293b;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:14px;font-weight:900;color:#fff;letter-spacing:1px;">GRAND TOTALS</div>
        <div style="display:flex;gap:30px;align-items:center;">
            <div style="text-align:center;">
                <div style="font-size:9px;font-weight:900;color:#94a3b8;letter-spacing:1px;">OT</div>
                <div style="font-size:16px;font-weight:700;color:#fca5a5;">${totals.ot} hrs</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:9px;font-weight:900;color:#94a3b8;letter-spacing:1px;">CONTRACT</div>
                <div style="font-size:16px;font-weight:700;color:#fff;">${totals.contract} hrs</div>
            </div>
            <div style="text-align:center;">
                <div style="font-size:9px;font-weight:900;color:#94a3b8;letter-spacing:1px;">TICKET</div>
                <div style="font-size:16px;font-weight:700;color:#93c5fd;">${totals.ticket} hrs</div>
            </div>
            <div style="width:1px;height:30px;background:#475569;"></div>
            <div style="text-align:center;">
                <div style="font-size:9px;font-weight:900;color:#94a3b8;letter-spacing:1px;">TOTAL</div>
                <div style="font-size:22px;font-weight:900;color:#fff;">${totals.total + totals.ot} hrs</div>
            </div>
        </div>
    </div>

    <!-- Signature Block -->
    <div style="display:flex;justify-content:space-between;margin-top:50px;padding-top:20px;">
        <div style="width:45%;">
            <div style="border-bottom:1px solid #1e293b;height:40px;"></div>
            <div style="font-size:11px;font-weight:700;margin-top:4px;">Supervisor / Foreman</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Date: _______________</div>
        </div>
        <div style="width:45%;">
            <div style="border-bottom:1px solid #1e293b;height:40px;"></div>
            <div style="font-size:11px;font-weight:700;margin-top:4px;">Approved By</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Date: _______________</div>
        </div>
    </div>

    <!-- Footer -->
    <div style="text-align:right;margin-top:30px;font-size:9px;color:#94a3b8;">1/1</div>

    </div><!-- /report-content -->

    <script>
    function generatePDF() {
        var btn = document.getElementById('downloadPdf');
        btn.disabled = true;
        btn.textContent = 'Generating...';
        var element = document.getElementById('report-content');
        var opt = {
            margin: [0.3, 0.3, 0.3, 0.3],
            filename: 'Polishers_Report_${dateLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save().then(function() {
            btn.disabled = false;
            btn.textContent = 'Download PDF';
        });
    }
    </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function printPolishersReport(
    workers: ReportWorker[],
    dateRange: DateRange,
    totals: ReportTotals
): Promise<void> {
    const logoUri = await getLogoDataUri();
    const html = buildHTML(workers, dateRange, totals, logoUri);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
        return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
}
