import { doc, runTransaction } from 'firebase/firestore';
import type { Delivery, ServiceJob, Technician, Ticket } from '../types';
import { getFirestoreDb } from './firebase';
import { SYNC_VERSION } from './cloudSync';

// WhatsApp notices sent through CallMeBot (or TextMeBot). The keys live in settings/whatsapp
// (only people with a role can read it), so notices go out from the office's open app.
//  - phone/apikey: the office number, told about every new breakdown (Pablo, 2026-11-05)
//  - recipients: one entry per technician, with what they want to hear about (Pablo, 2026-11-18:
//    new services to Pablo; new services, deliveries and breakdowns to Sergio)
export type NoticeKind = 'services' | 'deliveries' | 'tickets';
export type WhatsappRecipient = { apikey?: string; phone?: string; provider?: 'callmebot' | 'textmebot' } & Partial<Record<NoticeKind, boolean>>;
export type WhatsappSettings = {
  id: 'whatsapp';
  provider?: 'callmebot' | 'textmebot';
  phone?: string;
  apikey?: string;
  enabled?: boolean;
  recipients?: Record<string, WhatsappRecipient>; // by technician id
};

/** What each technician hears about until the office changes it */
export function defaultPrefs(t: Pick<Technician, 'name'>): Partial<Record<NoticeKind, boolean>> {
  const n = t.name.trim().toLowerCase();
  if (n.startsWith('sergio')) return { services: true, deliveries: true, tickets: true };
  if (n.startsWith('pablo')) return { services: true };
  return {};
}

export function recipientFor(s: WhatsappSettings | undefined, t: Technician): WhatsappRecipient {
  return { ...defaultPrefs(t), ...(s?.recipients?.[t.id] || {}) };
}

/** Spanish numbers without prefix get +34 */
export function normalizePhone(p: string) {
  const d = (p || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d;
  if (d.startsWith('00')) return `+${d.slice(2)}`;
  return d.length === 9 ? `+34${d}` : `+${d}`;
}

type Target = { key: string; phone: string; apikey: string; provider?: 'callmebot' | 'textmebot' };

function targets(s: WhatsappSettings | undefined, techs: Technician[], kind: NoticeKind): Target[] {
  if (!s || s.enabled === false) return [];
  const out: Target[] = [];
  if (kind === 'tickets' && s.apikey && s.phone) out.push({ key: 'office', phone: s.phone, apikey: s.apikey, provider: s.provider });
  for (const t of techs) {
    const r = recipientFor(s, t);
    const phone = normalizePhone(r.phone || t.phone);
    if (r[kind] && r.apikey && phone) out.push({ key: t.id, phone, apikey: r.apikey, provider: r.provider || s.provider });
  }
  return out;
}

function url(t: Target, lines: string[]) {
  const text = encodeURIComponent(lines.filter(Boolean).join('\n'));
  const phone = encodeURIComponent(t.phone);
  const key = encodeURIComponent(t.apikey);
  return t.provider === 'textmebot'
    ? `https://api.textmebot.com/send.php?recipient=${phone}&apikey=${key}&text=${text}`
    : `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${key}`;
}

const fmtDate = (d?: string) => (d ? d.split('-').reverse().join('/') : '');

const ticketLines = (t: Ticket) => [
  `🔔 *Nueva avería ${t.number}*`,
  `Cliente: ${t.customerName}${t.facility ? ` (${t.facility})` : ''}`,
  t.machine ? `Máquina: ${t.machine}` : '',
  `Problema: ${t.problem}`,
  `Urgencia: ${t.urgency}`,
  `Tel: ${t.customerPhone}`,
  t.location?.address ? `Dirección: ${t.location.address}` : '',
];

const deliveryLines = (d: Delivery) => [
  `📦 *Nueva entrega*`,
  `Material a entregar: ${d.items}`,
  `Contacto: ${d.customerName}${d.facility ? ` (${d.facility})` : ''}${d.customerPhone ? ` · ${d.customerPhone}` : ''}`,
  `Notas: ${d.notes?.trim() || '—'}`,
  `Entregar antes de: ${fmtDate(d.deadline) || 'sin fecha'}`,
  d.location?.address ? `Dirección: ${d.location.address}` : '',
];

const serviceLines = (j: ServiceJob, techs: Technician[]) => {
  const ids = j.assignedTechnicianIds?.length ? j.assignedTechnicianIds : j.assignedTechnicianId ? [j.assignedTechnicianId] : [];
  const who = ids.map((id) => techs.find((t) => t.id === id)?.name.split(' ')[0]).filter(Boolean).join(', ');
  return [
    `🛠️ *Nuevo servicio ${j.code}*`,
    `${j.title}`,
    `Cliente: ${j.customerName}${j.customerPhone ? ` · ${j.customerPhone}` : ''}`,
    j.date ? `Fecha: ${fmtDate(j.date)}${j.timeSlot?.label ? ` · ${j.timeSlot.label}` : ''}` : 'Fecha: sin fecha',
    j.location?.address ? `Dirección: ${j.location.address}` : '',
    `Técnico: ${who || 'sin asignar'}`,
    j.description ? `Detalle: ${j.description}` : '',
  ];
};

// Records created before each notice was switched on are not announced
const TICKETS_SINCE = '2026-11-05T16:00:00.000Z';
const OTHERS_SINCE = '2026-11-18T12:00:00.000Z';
const MAX_AGE_MS = 24 * 3600 * 1000;
const inFlight = new Set<string>();

/** Several office apps may be open: a waSent/{key} record, created in a transaction, makes sure
 *  only one of them sends each notice. */
function sendOnce(sentId: string, meta: Record<string, string>, link: string) {
  const db = getFirestoreDb();
  if (!db || inFlight.has(sentId)) return;
  inFlight.add(sentId);
  const ref = doc(db, 'waSent', sentId);
  runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) return false;
    tx.set(ref, { id: sentId, ...meta, sentAt: new Date().toISOString(), _v: SYNC_VERSION });
    return true;
  })
    .then((mine) => {
      // The service sends no CORS headers; the request still goes out
      if (mine) fetch(link, { mode: 'no-cors' }).catch(() => {});
    })
    .catch(() => inFlight.delete(sentId));
}

const fresh = (createdAt: string | undefined, since: string) =>
  !!createdAt && createdAt >= since && Date.now() - Date.parse(createdAt) <= MAX_AGE_MS;

export function notifyNewTickets(tickets: Ticket[], s: WhatsappSettings | undefined, techs: Technician[]) {
  const to = targets(s, techs, 'tickets');
  if (!to.length) return;
  for (const t of tickets) {
    if (!fresh(t.createdAt, TICKETS_SINCE)) continue;
    for (const r of to) {
      // The office notice keeps its old record id so nothing already sent is repeated
      const sentId = r.key === 'office' ? t.id : `tk_${t.id}_${r.key}`;
      sendOnce(sentId, { number: t.number }, url(r, ticketLines(t)));
    }
  }
}

export function notifyNewDeliveries(deliveries: Delivery[], s: WhatsappSettings | undefined, techs: Technician[]) {
  const to = targets(s, techs, 'deliveries');
  if (!to.length) return;
  for (const d of deliveries) {
    if (!fresh(d.createdAt, OTHERS_SINCE)) continue;
    for (const r of to) sendOnce(`dl_${d.id}_${r.key}`, { delivery: d.id }, url(r, deliveryLines(d)));
  }
}

export function notifyNewServices(services: ServiceJob[], s: WhatsappSettings | undefined, techs: Technician[]) {
  const to = targets(s, techs, 'services');
  if (!to.length) return;
  for (const j of services) {
    if (j.kind === 'nave' || j.teamParentId || !fresh(j.createdAt, OTHERS_SINCE)) continue;
    for (const r of to) sendOnce(`sv_${j.id}_${r.key}`, { number: j.code }, url(r, serviceLines(j, techs)));
  }
}
