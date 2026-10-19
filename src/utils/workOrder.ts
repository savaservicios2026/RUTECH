import { ServiceJob } from '../types';
import logoUrl from '../assets/logo-sava.png?inline';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const formatLongDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Opens the signed work order as a printable page (print or "Guardar como PDF")
 */
export function printWorkOrder(job: ServiceJob, technicianNames: string) {
  const r = job.inSituReport || {};
  const row = (label: string, value?: string) =>
    value ? `<tr><th>${label}</th><td>${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>` : '';
  const outcome =
    r.outcome === 'resuelto'
      ? '<span class="ok">RESUELTO</span>'
      : r.outcome === 'volver'
      ? `<span class="back">HAY QUE VOLVER</span>${r.returnReason ? ` · ${escapeHtml(r.returnReason)}` : ''}`
      : 'Pendiente';

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Parte ${escapeHtml(job.code)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px;font-size:14px}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1f4f94;padding-bottom:12px;margin-bottom:18px}
header img{height:56px}h1{font-size:20px;margin:0;color:#1f4f94}.code{font-family:monospace;font-size:15px;color:#475569}
table{width:100%;border-collapse:collapse;margin-bottom:16px}th{text-align:left;width:160px;color:#475569;font-weight:600;vertical-align:top}
th,td{padding:7px 8px;border-bottom:1px solid #e2e8f0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#1f4f94;margin:20px 0 6px}
.ok{color:#047857;font-weight:700}.back{color:#b45309;font-weight:700}
.sign{border:1px solid #cbd5e1;border-radius:8px;padding:8px;display:inline-block;min-width:260px}.sign img{max-width:320px;height:90px;object-fit:contain;display:block}
@media print{body{margin:12mm}}
</style></head><body>
<header><img src="${logoUrl}" alt="SAVA"><div style="text-align:right"><h1>Parte de trabajo</h1><div class="code">${escapeHtml(job.code)}</div></div></header>
<h2>Cliente</h2><table>
${row('Cliente', job.customerName)}${row('Teléfono', job.customerPhone)}${row('Dirección', job.location.address)}
</table>
<h2>Trabajo</h2><table>
${row('Fecha', formatLongDate(job.date))}${row('Técnico', technicianNames)}${row('Trabajo', job.title)}${row('Descripción', job.description)}
${row('Hora de llegada', r.startedAt)}${row('Hora de salida', r.completedAt)}
</table>
<h2>Resultado</h2><table>
<tr><th>Estado</th><td>${outcome}</td></tr>
${row('Observaciones', r.technicalNotes)}${row('Material utilizado', (r.materialsUsed || []).join(', '))}
</table>
<h2>Conformidad del cliente</h2>
<div class="sign">${r.customerSignature ? `<img src="${r.customerSignature}" alt="Firma">` : '<div style="height:90px"></div>'}
<div>${escapeHtml(r.customerSignatureName || '')}${r.signedDate ? ` · ${new Date(`${r.signedDate}T12:00:00`).toLocaleDateString('es-ES')}` : ''}</div></div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
