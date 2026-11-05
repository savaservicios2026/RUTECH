import { doc, runTransaction } from 'firebase/firestore';
import type { Ticket } from '../types';
import { getFirestoreDb } from './firebase';
import { SYNC_VERSION } from './cloudSync';

// WhatsApp notice to the office when a new breakdown is registered (Pablo, 2026-11-05).
// The CallMeBot key lives in settings/whatsapp (only people with a role can read it), so
// the notice goes out from the office's open app, not from the customer's public form.
export type WhatsappSettings = { id: 'whatsapp'; provider?: 'callmebot' | 'textmebot'; phone?: string; apikey?: string; enabled?: boolean };

// Breakdowns registered before the notices were switched on are not announced
const SINCE = '2026-11-05T16:00:00.000Z';
const MAX_AGE_MS = 24 * 3600 * 1000;
const inFlight = new Set<string>();

function buildUrl(s: WhatsappSettings, t: Ticket) {
  const lines = [
    `🔔 *Nueva avería ${t.number}*`,
    `Cliente: ${t.customerName}${t.facility ? ` (${t.facility})` : ''}`,
    t.machine ? `Máquina: ${t.machine}` : '',
    `Problema: ${t.problem}`,
    `Urgencia: ${t.urgency}`,
    `Tel: ${t.customerPhone}`,
    t.location?.address ? `Dirección: ${t.location.address}` : '',
  ].filter(Boolean);
  const text = encodeURIComponent(lines.join('\n'));
  const phone = encodeURIComponent(s.phone || '');
  const key = encodeURIComponent(s.apikey || '');
  return s.provider === 'textmebot'
    ? `https://api.textmebot.com/send.php?recipient=${phone}&apikey=${key}&text=${text}`
    : `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${key}`;
}

/** Sends one WhatsApp per new breakdown. Several office apps may be open: a waSent/{ticketId}
 *  record, created in a transaction, makes sure only one of them sends it. */
export function notifyNewTickets(tickets: Ticket[], s: WhatsappSettings | undefined) {
  if (!s || s.enabled === false || !s.apikey || !s.phone) return;
  const db = getFirestoreDb();
  if (!db) return;
  const now = Date.now();
  for (const t of tickets) {
    if (t.createdAt < SINCE || now - Date.parse(t.createdAt) > MAX_AGE_MS || inFlight.has(t.id)) continue;
    inFlight.add(t.id);
    const ref = doc(db, 'waSent', t.id);
    runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, { id: t.id, number: t.number, sentAt: new Date().toISOString(), _v: SYNC_VERSION });
      return true;
    })
      .then((mine) => {
        // The service sends no CORS headers; the request still goes out
        if (mine) fetch(buildUrl(s, t), { mode: 'no-cors' }).catch(() => {});
      })
      .catch(() => inFlight.delete(t.id));
  }
}
