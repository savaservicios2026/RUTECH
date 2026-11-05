import type { Ticket } from '../types';

// WhatsApp notice to the office when a new breakdown is registered (Pablo, 2026-11-05).
// Free CallMeBot (or paid TextMeBot) key, activated from the receiving phone itself.
// The key only lets anyone message that one phone, so it can live in the app.
const WHATSAPP = {
  provider: '' as '' | 'callmebot' | 'textmebot',
  phone: '+34605431363',
  apikey: '',
};

export function notifyNewTicket(t: Ticket) {
  if (!WHATSAPP.provider || !WHATSAPP.apikey) return;
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
  const phone = encodeURIComponent(WHATSAPP.phone);
  const key = encodeURIComponent(WHATSAPP.apikey);
  const url = WHATSAPP.provider === 'callmebot'
    ? `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${key}`
    : `https://api.textmebot.com/send.php?recipient=${phone}&apikey=${key}&text=${text}`;
  // Fire and forget: the service sends no CORS headers, and a failed notice must never block the ticket
  fetch(url, { mode: 'no-cors' }).catch(() => {});
}
