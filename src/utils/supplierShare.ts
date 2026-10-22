import { doc, setDoc } from 'firebase/firestore';
import { Ticket } from '../types';
import { getFirestoreDb } from './firebase';
import { loadTicketMedia } from './tickets';
import { SYNC_VERSION } from './cloudSync';

export interface SharedTicket {
  number: string;
  customerName: string;
  facility?: string;
  address: string;
  machine?: string;
  problem: string;
  description?: string;
  createdAt: string;
  mediaIds: string[];
}

export const supplierLink = (token: string) => `${location.origin}${location.pathname}#averia/${token}`;

/**
 * Publishes the breakdown and its photos and videos at an unguessable link the supplier can open
 * without signing in (an email can't carry them, so the notice links to them).
 */
export async function shareTicketForSupplier(ticket: Ticket): Promise<string> {
  const db = getFirestoreDb();
  if (!db) throw new Error('no-db');
  const token = `${Date.now().toString(36)}${crypto.getRandomValues(new Uint32Array(3)).join('')}`.slice(0, 28);
  const media = ticket.mediaCount > 0 ? await loadTicketMedia(ticket.id) : [];
  const mediaIds: string[] = [];
  for (const [i, m] of media.entries()) {
    const id = `${token}-${i}`;
    await setDoc(doc(db, 'publicTicketMedia', id), { type: m.type, name: m.name, dataUrl: m.dataUrl, _v: SYNC_VERSION });
    mediaIds.push(id);
  }
  const shared: SharedTicket = {
    number: ticket.number,
    customerName: ticket.customerName,
    facility: ticket.facility,
    address: ticket.location.address,
    machine: ticket.machine,
    problem: ticket.problem,
    description: ticket.description,
    createdAt: ticket.createdAt,
    mediaIds,
  };
  await setDoc(doc(db, 'publicTickets', token), { ...JSON.parse(JSON.stringify(shared)), _v: SYNC_VERSION });
  return token;
}
