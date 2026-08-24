export interface ManifestRow {
  barcode: string | null;
  trackingNumber: string | null;
  provider: string;
  referenceCode: string | null;
  totalDesi: number | null;
  totalWeightKg: number | null;
}

/** The values are ours, but they end up in markup; escaping is not optional. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The sheet the courier signs.
 *
 * Plain, self-contained HTML rather than the screen with print styles: this
 * page sits inside the WMS layout, and printing it would carry the navigation
 * onto a document someone signs.
 */
export function manifestHtml(handedOverAt: string, rows: ManifestRow[]): string {
  const when = new Date(handedOverAt).toLocaleString();
  const body = rows
    .map(
      (row, index) => `<tr>
        <td>${index + 1}</td>
        <td class="mono">${escapeHtml(row.barcode ?? '-')}</td>
        <td>${escapeHtml(row.provider)}</td>
        <td class="mono">${escapeHtml(row.trackingNumber ?? '-')}</td>
        <td class="mono">${escapeHtml(row.referenceCode ?? '-')}</td>
        <td>${escapeHtml(row.totalDesi ?? '-')}</td>
        <td>${escapeHtml(row.totalWeightKg ?? '-')}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Teslim Manifestosu</title>
<style>
  body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; margin: 24px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  th { background: #eee; }
  .mono { font-family: ui-monospace, monospace; }
  .sign { margin-top: 32px; display: flex; gap: 48px; }
  .sign div { flex: 1; border-top: 1px solid #333; padding-top: 6px; }
</style></head>
<body>
  <h1>Teslim Manifestosu</h1>
  <div class="meta">Teslim zamanı: ${escapeHtml(when)} · Toplam ${rows.length} paket</div>
  <table>
    <thead><tr>
      <th>#</th><th>Barkod</th><th>Taşıyıcı</th><th>Takip No</th>
      <th>Referans</th><th>Desi</th><th>Ağırlık (kg)</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="sign">
    <div>Teslim eden (ad, imza)</div>
    <div>Teslim alan kurye (ad, imza)</div>
  </div>
</body></html>`;
}

/**
 * Prints through a hidden iframe rather than `window.open`: a popup blocker
 * silently swallows the second, and the courier is standing at the counter.
 */
export function printManifest(handedOverAt: string, rows: ManifestRow[]): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.srcdoc = manifestHtml(handedOverAt, rows);

  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Removed after the dialog has taken its snapshot; removing it immediately
    // prints a blank page in Chrome.
    setTimeout(() => frame.remove(), 60_000);
  };

  document.body.appendChild(frame);
}
