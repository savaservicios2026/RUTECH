import { doc, setDoc } from 'firebase/firestore';
import { CompanyInfo, ServiceJob } from '../types';
import logoUrl from '../assets/logo-sava.png?inline';
import { getFirestoreDb } from './firebase';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const formatLongDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** The work order as a complete HTML page (logo, company data, job, result and signature). */
export function workOrderHtml(job: ServiceJob, technicianNames: string, company: CompanyInfo, autoPrint = false) {
  const r = job.inSituReport || {};
  const row = (label: string, value?: string) =>
    value ? `<tr><th>${label}</th><td>${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>` : '';
  const outcome =
    r.outcome === 'resuelto'
      ? '<span class="ok">RESUELTO</span>'
      : r.outcome === 'volver'
      ? `<span class="back">HAY QUE VOLVER</span>${r.returnReason ? ` · ${escapeHtml(r.returnReason)}` : ''}`
      : 'Pendiente';

  const companyBlock = [
    company.legalName && `<strong>${escapeHtml(company.legalName)}</strong>`,
    company.cif && `CIF: ${escapeHtml(company.cif)}`,
    company.address && escapeHtml(company.address),
    [company.phone && `Tel. ${escapeHtml(company.phone)}`, company.email && escapeHtml(company.email)].filter(Boolean).join(' · '),
    company.web && escapeHtml(company.web),
  ]
    .filter(Boolean)
    .join('<br>');
  const footerLine = [company.legalName, company.cif && `CIF ${company.cif}`, company.address].filter(Boolean).join(' · ');

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Parte ${escapeHtml(job.code)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px;font-size:14px}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid #1f4f94;padding-bottom:12px;margin-bottom:14px}
header img{height:60px}.company{text-align:right;font-size:12px;line-height:1.5;color:#334155}.company strong{font-size:14px;color:#0f172a}
.title{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
h1{font-size:20px;margin:0;color:#1f4f94}.code{font-family:monospace;font-size:15px;color:#475569}
footer{margin-top:28px;padding-top:8px;border-top:1px solid #cbd5e1;font-size:11px;color:#64748b;text-align:center}
table{width:100%;border-collapse:collapse;margin-bottom:16px}th{text-align:left;width:160px;color:#475569;font-weight:600;vertical-align:top}
th,td{padding:7px 8px;border-bottom:1px solid #e2e8f0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#1f4f94;margin:20px 0 6px}
.ok{color:#047857;font-weight:700}.back{color:#b45309;font-weight:700}
.sign{border:1px solid #cbd5e1;border-radius:8px;padding:8px;display:inline-block;min-width:260px}.sign img{max-width:320px;height:90px;object-fit:contain;display:block}
@media print{body{margin:12mm}}
</style></head><body>
<header><img src="${logoUrl}" alt="SAVA"><div class="company">${companyBlock}</div></header>
<div class="title"><h1>Parte de trabajo</h1><div class="code">Nº ${escapeHtml(job.code)}</div></div>
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
<footer>${escapeHtml(footerLine)}</footer>
${autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>' : ''}
</body></html>`;
  return html;
}

/**
 * Opens the signed work order as a printable page (print or "Guardar como PDF")
 */
export function printWorkOrder(job: ServiceJob, technicianNames: string, company: CompanyInfo) {
  const html = workOrderHtml(job, technicianNames, company, true);
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

/** Builds the work order as a real PDF file (A4) from the same page. */
export async function workOrderPdf(job: ServiceJob, technicianNames: string, company: CompanyInfo): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;';
  document.body.appendChild(frame);
  try {
    await new Promise<void>((resolve) => {
      frame.onload = () => resolve();
      frame.srcdoc = workOrderHtml(job, technicianNames, company);
    });
    const body = frame.contentDocument!.body;
    await Promise.all(Array.from(body.querySelectorAll('img')).map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))));
    const canvas = await html2canvas(body, { scale: 2, backgroundColor: '#ffffff', windowWidth: 794 });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL('image/jpeg', 0.9);
    for (let y = 0; y < imgH; y += pageH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(img, 'JPEG', 0, -y, pageW, imgH);
    }
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}

export const workOrderFileName = (job: ServiceJob) => `Parte-${job.code}-${job.date}.pdf`.replace(/[^\w.-]+/g, '_');

export async function downloadWorkOrderPdf(job: ServiceJob, technicianNames: string, company: CompanyInfo) {
  const blob = await workOrderPdf(job, technicianNames, company);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = workOrderFileName(job);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// What the customer's link shows: a copy of the signed work order, readable without an account
export interface SharedWorkOrder {
  job: ServiceJob;
  technicianNames: string;
  company: CompanyInfo;
  createdAt: string;
}

const publicLink = (token: string) => `${location.origin}${location.pathname}#parte/${token}`;

/**
 * Sends the customer, by WhatsApp, the link to their signed work order and the review request.
 * WhatsApp opens with the message ready; the technician only taps send.
 */
export function sendWorkOrderToCustomer(job: ServiceJob, technicianNames: string, company: CompanyInfo): boolean {
  const phone = (job.customerPhone || '').replace(/[^0-9]/g, '');
  if (phone.length < 9) return false;
  const token = `${Date.now().toString(36)}${crypto.getRandomValues(new Uint32Array(3)).join('')}`.slice(0, 28);
  const db = getFirestoreDb();
  const { scheduledArrival, scheduledDeparture, travelTimeFromPrev, distanceKmFromPrev, conflict, teamParentId, ...clean } = job;
  const shared: SharedWorkOrder = { job: clean as ServiceJob, technicianNames, company, createdAt: new Date().toISOString() };
  // Saved on the phone at once and uploaded as soon as there is coverage
  if (db) setDoc(doc(db, 'publicWorkOrders', token), JSON.parse(JSON.stringify(shared))).catch(() => {});
  const name = company.legalName?.replace(/\s+S\.?L\.?$/i, '') || 'SAVA';
  const lines = [
    `Hola ${job.customerName}, gracias por confiar en ${name}.`,
    `Aquí tiene el parte de trabajo firmado (puede descargarlo en PDF): ${publicLink(token)}`,
    company.reviewUrl ? `Si ha quedado contento con nuestro servicio, nos ayudaría mucho que nos dejase una reseña: ${company.reviewUrl}` : '',
    'Un saludo.',
  ].filter(Boolean);
  const intl = phone.length === 9 ? `34${phone}` : phone;
  window.open(`https://wa.me/${intl}?text=${encodeURIComponent(lines.join('\n\n'))}`, '_blank');
  return true;
}
