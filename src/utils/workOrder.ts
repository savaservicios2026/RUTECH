import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { Attachment, CompanyInfo, ServiceJob } from '../types';
import logoUrl from '../assets/logo-sava.png?inline';
import { getFirestoreDb } from './firebase';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const formatLongDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** The work order as a complete HTML page (logo, company data, job, result and signature). */
// Photos of the work order (section "parte"), as image data URLs, oldest first
export async function loadWorkOrderPhotos(job: ServiceJob): Promise<string[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'attachments'), where('serviceId', '==', job.id.split('~')[0])));
    return snap.docs
      .map((d) => d.data() as Attachment)
      .filter((a) => a.section === 'parte' && (a.type || '').startsWith('image/') && a.dataUrl)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((a) => a.dataUrl);
  } catch {
    return [];
  }
}

// Smaller copies of the photos so they fit in the customer's link (one database document, under 1 MB)
async function shrinkPhotos(photos: string[], budget = 750_000, maxSide = 720, quality = 0.55): Promise<string[]> {
  const out: string[] = [];
  let used = 0;
  for (const src of photos) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = src;
      });
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const small = c.toDataURL('image/jpeg', quality);
      if (used + small.length > budget) break;
      used += small.length;
      out.push(small);
    } catch {}
  }
  return out;
}

export function workOrderHtml(job: ServiceJob, technicianNames: string, company: CompanyInfo, autoPrint = false, photos: string[] = []) {
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
.photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}.photos img{width:100%;max-height:330px;object-fit:contain;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;break-inside:avoid}
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
<div class="sign">${r.customerSignature ? `<img src="${r.customerSignature}" alt="Firma">` : r.signaturePending ? '<div style="height:90px;display:flex;align-items:center;justify-content:center;color:#b45309;font-weight:700">Pendiente de la firma del cliente</div>' : '<div style="height:90px"></div>'}
<div>${escapeHtml(r.customerSignatureName || '')}${r.signedDate ? ` · ${new Date(`${r.signedDate}T12:00:00`).toLocaleDateString('es-ES')}` : ''}</div></div>
${photos.length ? `<h2>Fotos</h2><div class="photos">${photos.map((p) => `<img src="${p}" alt="Foto">`).join('')}</div>` : ''}
<footer>${escapeHtml(footerLine)}</footer>
${autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>' : ''}
</body></html>`;
  return html;
}

/**
 * Opens the signed work order as a printable page (print or "Guardar como PDF")
 */
export function printWorkOrder(job: ServiceJob, technicianNames: string, company: CompanyInfo) {
  // The window opens at once (browsers block it after a wait); the page is written when the photos are in
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write('<p style="font-family:system-ui;padding:24px">Preparando el parte…</p>');
  loadWorkOrderPhotos(job).then((photos) => {
    win.document.open();
    win.document.write(workOrderHtml(job, technicianNames, company, true, photos));
    win.document.close();
  });
  return true;
}

/** Builds the work order as a real PDF file (A4) from the same page. */
export async function workOrderPdf(job: ServiceJob, technicianNames: string, company: CompanyInfo, photos?: string[]): Promise<Blob> {
  // Lighter copies keep the PDF small enough to send by WhatsApp or email
  const pics = await shrinkPhotos(photos ?? (await loadWorkOrderPhotos(job)), Infinity, 1200, 0.7);
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
    // Photos on their own pages, two per row and three rows per page, never cut in half
    const margin = 12;
    const gap = 6;
    const cellW = (pageW - margin * 2 - gap) / 2;
    const top = margin + 10;
    const cellH = (pageH - top - margin - gap * 2) / 3;
    for (let i = 0; i < pics.length; i++) {
      const slot = i % 6;
      if (slot === 0) {
        pdf.addPage();
        pdf.setFontSize(13);
        pdf.setTextColor(31, 79, 148);
        pdf.text(`Fotos del parte ${job.code}`, margin, margin + 4);
      }
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const im = new Image();
        im.onload = () => resolve({ w: im.width, h: im.height });
        im.onerror = () => resolve({ w: 4, h: 3 });
        im.src = pics[i];
      });
      const k = Math.min(cellW / dims.w, cellH / dims.h);
      const w = dims.w * k;
      const h = dims.h * k;
      const x = margin + (slot % 2) * (cellW + gap) + (cellW - w) / 2;
      const y = top + Math.floor(slot / 2) * (cellH + gap) + (cellH - h) / 2;
      try {
        pdf.addImage(pics[i], 'JPEG', x, y, w, h);
      } catch {}
    }
    return pdf.output('blob');
  } finally {
    frame.remove();
  }
}

export const workOrderFileName = (job: ServiceJob) => `Parte-${job.code}-${job.date}.pdf`.replace(/[^\w.-]+/g, '_');

export async function downloadWorkOrderPdf(job: ServiceJob, technicianNames: string, company: CompanyInfo, photos?: string[]) {
  const blob = await workOrderPdf(job, technicianNames, company, photos);
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
  // Closed without signature: the customer signs from the link and the app copies it into the work order
  serviceId?: string;
  pendingSignature?: boolean;
  customerSignature?: string;
  customerSignatureName?: string;
  signedAt?: string;
  photos?: string[]; // smaller copies of the work order photos
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
  const pending = !!job.inSituReport?.signaturePending && !job.inSituReport?.customerSignature;
  const shared: SharedWorkOrder = {
    job: clean as ServiceJob,
    technicianNames,
    company,
    createdAt: new Date().toISOString(),
    ...(pending ? { serviceId: (job.teamParentId || job.id).split('~')[0], pendingSignature: true } : {}),
  };
  // Saved with its photos and uploaded as soon as there is coverage; WhatsApp opens right away
  if (db)
    loadWorkOrderPhotos(job)
      .then(shrinkPhotos)
      .then((photos) => setDoc(doc(db, 'publicWorkOrders', token), JSON.parse(JSON.stringify({ ...shared, photos }))))
      .catch(() => setDoc(doc(db, 'publicWorkOrders', token), JSON.parse(JSON.stringify(shared))).catch(() => {}));
  const name = company.legalName?.replace(/\s+S\.?L\.?$/i, '') || 'SAVA';
  const lines = [
    `Hola ${job.customerName}, gracias por confiar en ${name}.`,
    pending
      ? `Le enviamos el parte de trabajo de hoy. Como no pudo firmarlo en el momento, está *pendiente de su firma*: por favor, ábralo en este enlace y fírmelo con el dedo: ${publicLink(token)}`
      : `Aquí tiene el parte de trabajo firmado (puede descargarlo en PDF): ${publicLink(token)}`,
    company.reviewUrl ? `Si ha quedado contento con nuestro servicio, nos ayudaría mucho que nos dejase una reseña: ${company.reviewUrl}` : '',
    'Un saludo.',
  ].filter(Boolean);
  const intl = phone.length === 9 ? `34${phone}` : phone;
  window.open(`https://wa.me/${intl}?text=${encodeURIComponent(lines.join('\n\n'))}`, '_blank');
  return true;
}
