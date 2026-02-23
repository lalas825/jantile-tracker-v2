/**
 * DeliveryTicketPDF.ts
 * Generates a print-ready HTML Delivery Ticket document and opens it
 * in a new browser tab with the native print dialog.
 */
import { DeliveryTicket, formatDisplayDate } from '../services/SupabaseService';
import { Asset } from 'expo-asset';

// ---------------------------------------------------------------------------
// Logo helper – resolves the Jantile logo via Expo's Asset pipeline and
// converts it to a base64 data-URI so it works in the detached print window.
// ---------------------------------------------------------------------------
let cachedLogoDataUri: string | null = null;

async function getLogoDataUri(): Promise<string> {
    if (cachedLogoDataUri) return cachedLogoDataUri;

    try {
        // Asset.fromModule resolves the metro module ID to an actual URI
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
// Category grouping (mirrors DeliveryTicketModal logic)
// ---------------------------------------------------------------------------
interface ItemRow {
    product_code: string;
    dimensions: string;
    product_name: string;
    location: string;
    grout: string;
    caulk: string;
    qty: number;
    unit: string;
    sqft_per_piece?: number;
    category?: string;
}

function groupItemsByCategory(items: any[]): Record<string, ItemRow[]> {
    const TILE_TAGS = ['tile', 'stone', 'slab', 'base'];
    const SETTING_TAGS = ['grout', 'caulk', 'thinset', 'schluter', 'underlayment', 'setting materials', 'sundries'];

    const groups: Record<string, ItemRow[]> = {};

    for (const item of items) {
        const cat = (item.category || '').toLowerCase();
        let groupLabel = 'MISC / OTHER';

        if (TILE_TAGS.includes(cat)) groupLabel = 'TILE & STONE';
        else if (SETTING_TAGS.includes(cat)) groupLabel = 'SETTING MATERIALS';

        if (!groups[groupLabel]) groups[groupLabel] = [];

        groups[groupLabel].push({
            product_code: item.product_code || '—',
            dimensions: item.dimensions || '—',
            product_name: item.product_name || '—',
            location: item.location || item.sub_location || '—',
            grout: item.grout || '—',
            caulk: item.caulk || '—',
            qty: item.qty || 0,
            unit: item.unit || 'SQFT',
            sqft_per_piece: item.sqft_per_piece,
            category: item.category,
        });
    }

    return groups;
}

// ---------------------------------------------------------------------------
// Qty display helper (SF + PCS)
// ---------------------------------------------------------------------------
function formatQty(item: ItemRow): string {
    const qty = item.qty;
    const unit = (item.unit || 'SQFT').toUpperCase();
    let str = `${qty.toLocaleString()} ${unit === 'SQFT' ? 'SF' : unit}`;
    if (item.sqft_per_piece && item.sqft_per_piece > 0) {
        const pcs = Math.ceil(qty / item.sqft_per_piece);
        str += `<br/><span style="color:#64748b;font-size:10px">(${pcs.toLocaleString()} Pcs)</span>`;
    }
    return str;
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------
function buildHTML(ticket: DeliveryTicket, logoUri: string): string {
    const now = new Date();
    const timestamp = now.toLocaleDateString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric'
    }) + ', ' + now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    const ticketDate = formatDisplayDate(ticket.due_date || ticket.requested_date) || '—';
    const projectName = ticket.job_name || 'N/A';
    const origin = ticket.destination === 'Vendor Direct'
        ? (ticket.items?.[0]?.vendor_name || 'Vendor')
        : 'Jantile Shop';

    const groups = groupItemsByCategory(ticket.items || []);
    const groupOrder = ['TILE & STONE', 'SETTING MATERIALS', 'MISC / OTHER'];

    // Build item table rows
    let tableRowsHTML = '';
    for (const label of groupOrder) {
        const items = groups[label];
        if (!items || items.length === 0) continue;

        tableRowsHTML += `
            <tr>
                <td colspan="7" style="padding:14px 0 6px 0;font-weight:900;font-size:13px;letter-spacing:1px;border-bottom:2px solid #1e293b;text-transform:uppercase;">
                    ${label}
                </td>
            </tr>
            <tr style="background:#f8fafc;">
                <th style="text-align:left;padding:8px 6px;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#64748b;border-bottom:1px solid #e2e8f0;">PRODUCT</th>
                <th style="text-align:left;padding:8px 6px;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#64748b;border-bottom:1px solid #e2e8f0;">DIMS</th>
                <th style="text-align:left;padding:8px 6px;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#64748b;border-bottom:1px solid #e2e8f0;">DESCRIPTION</th>
                <th style="text-align:left;padding:8px 6px;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#64748b;border-bottom:1px solid #e2e8f0;">LOCATION</th>
                <th style="text-align:left;padding:8px 6px;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#64748b;border-bottom:1px solid #e2e8f0;">GROUT</th>
                <th style="text-align:left;padding:8px 6px;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#64748b;border-bottom:1px solid #e2e8f0;">CAULK</th>
                <th style="text-align:right;padding:8px 6px;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#64748b;border-bottom:1px solid #e2e8f0;">QTY / UNIT</th>
            </tr>
        `;

        for (const item of items) {
            tableRowsHTML += `
            <tr>
                <td style="padding:8px 6px;font-size:12px;font-weight:700;border-bottom:1px solid #f1f5f9;">${item.product_code}</td>
                <td style="padding:8px 6px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">${item.dimensions}</td>
                <td style="padding:8px 6px;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9;">${item.product_name}</td>
                <td style="padding:8px 6px;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9;">${item.location}</td>
                <td style="padding:8px 6px;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9;">${item.grout}</td>
                <td style="padding:8px 6px;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9;">${item.caulk}</td>
                <td style="padding:8px 6px;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;">${formatQty(item)}</td>
            </tr>`;
        }
    }

    const logoHTML = logoUri
        ? `<img src="${logoUri}" style="height:40px;object-fit:contain;" />`
        : `<span style="font-size:22px;font-weight:900;letter-spacing:2px;font-family:'Inter',sans-serif;">JANTILE.</span>`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>Delivery Ticket #${ticket.ticket_number}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
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
            size: letter;
            margin: 0.5in;
        }
        @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
        }
        table { width: 100%; border-collapse: collapse; }
    </style>
</head>
<body>
    <!-- Timestamp & Document ID -->
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-bottom:12px;">
        <span>${timestamp}</span>
        <span>Delivery Ticket #${ticket.ticket_number}</span>
    </div>

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #1e293b;margin-bottom:24px;">
        <div>
            ${logoHTML}
            <div style="font-size:16px;font-weight:900;margin-top:6px;letter-spacing:0.5px;">Delivery Ticket</div>
        </div>
        <div style="text-align:right;font-size:12px;line-height:1.7;">
            <div><span style="font-weight:900;">Ticket #:</span> <span style="color:#2563eb;font-weight:700;">${ticket.ticket_number}</span></div>
            <div><span style="font-weight:900;">Date:</span> ${ticketDate}</div>
            <div><span style="font-weight:900;">Project:</span> ${projectName}</div>
            <div><span style="font-weight:900;">Vendor/Origin:</span> <span style="color:#2563eb;">${origin}</span></div>
        </div>
    </div>

    <!-- Items Table -->
    <table>
        ${tableRowsHTML}
    </table>

    <!-- Signature Block -->
    <div style="display:flex;justify-content:space-between;margin-top:60px;padding-top:20px;">
        <div style="width:45%;">
            <div style="border-bottom:1px solid #1e293b;height:40px;"></div>
            <div style="font-size:11px;font-weight:700;margin-top:4px;">Released By (Warehouse/Vendor)</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Date: _______________</div>
        </div>
        <div style="width:45%;">
            <div style="border-bottom:1px solid #1e293b;height:40px;"></div>
            <div style="font-size:11px;font-weight:700;margin-top:4px;">Received By</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Date: ${ticketDate}</div>
        </div>
    </div>

    <!-- Footer -->
    <div style="text-align:right;margin-top:40px;font-size:9px;color:#94a3b8;">1/1</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function printDeliveryTicket(ticket: DeliveryTicket): Promise<void> {
    const logoUri = await getLogoDataUri();
    const html = buildHTML(ticket, logoUri);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
        return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Give the browser a moment to load fonts / render, then trigger print
    printWindow.onload = () => {
        setTimeout(() => printWindow.print(), 400);
    };
    // Fallback in case onload doesn't fire (some browsers)
    setTimeout(() => {
        try { printWindow.print(); } catch { /* already printed */ }
    }, 1200);
}
