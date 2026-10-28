import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { Ticket, TicketMedia, CITY_ZONES } from '../types';
import { getFirestoreDb } from './firebase';

// Firestore documents are limited to 1 MiB, so each photo is compressed to stay well under it
const MAX_MEDIA_CHARS = 900_000;
export const MAX_MEDIA_FILES = 4;

const ZONE_CENTERS: [string, number, number][] = [
  ['A Coruña y Ferrol', 43.3685, -8.4192],
  ['Santiago y Barbanza', 42.8782, -8.5448],
  ['Vigo y Rías Baixas', 42.2328, -8.7226],
  ['Lugo y Mariña', 43.0125, -7.5558],
  ['Ourense e Interior', 42.3364, -7.8642],
  ['Asturias (Oviedo / Gijón)', 43.4325, -5.8452],
  ['León y El Bierzo', 42.5987, -5.5671],
];

/** Closest work zone to a point, so tickets group with the planner's zones. */
export function zoneFor(lat: number, lng: number): string {
  let best = CITY_ZONES[CITY_ZONES.length - 1];
  let bestD = Infinity;
  ZONE_CENTERS.forEach(([name, zl, zg]) => {
    const d = (zl - lat) ** 2 + (zg - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  });
  return bestD < 1.5 ? best : CITY_ZONES[CITY_ZONES.length - 1];
}

export function zoneCenter(zone?: string): { lat: number; lng: number } {
  const z = ZONE_CENTERS.find(([name]) => name === zone) || ZONE_CENTERS[0];
  return { lat: z[1], lng: z[2] };
}

type GeoHit = { lat: number; lng: number; approximate: boolean };

// Where the company works (Galicia, Asturias, León): results here are preferred
const VIEWBOX = '-9.4,43.9,-4.4,41.8';
// Result kinds that only give the town or area, not the exact place
const AREA_TYPES = ['city', 'town', 'village', 'municipality', 'county', 'state', 'province', 'region', 'postcode', 'district', 'country'];

/** Drops what map searches don't understand: floor, door, premises, "s/n", "C.P."... */
export function cleanAddress(address: string): string {
  return address
    .replace(/[()]/g, ',')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\b(bajo|baixo|entreplanta|local|piso|planta|puerta|porta|portal|nave|bloque|escalera|esc\.?)\s*(?!\d{5}\b)[\w\-/º]*/gi, '')
    .replace(/\b\d+\s*[ºª]\s*[a-z]?\b/gi, '')
    .replace(/\bs\s*\/\s*n\b/gi, '')
    .replace(/\bc\.\s*p\.?|\bc\.?p\.(?=\s*\d)/gi, '')
    .replace(/\bn[úu]mero\b|\bn[º°]/gi, '')
    .replace(/\bn\.?(\d+)\b/gi, '$1')
    .replace(/\s+,/g, ',')
    .replace(/\s*,\s*(,\s*)+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '');
}

/** One search in OpenStreetMap (Nominatim). */
async function nominatim(q: string): Promise<GeoHit | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=es,pt&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon), approximate: AREA_TYPES.includes(data[0].addresstype) };
  } catch {
    return null;
  }
}

/** Second map search (Photon), more forgiving with misspelt or incomplete addresses. */
async function photon(q: string): Promise<GeoHit | null> {
  try {
    const url = `https://photon.komoot.io/api/?limit=1&lat=42.9&lon=-8.0&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const f = (await res.json())?.features?.[0];
    if (!f || !['ES', 'PT'].includes(f.properties?.countrycode)) return null;
    const [lng, lat] = f.geometry.coordinates;
    const type = f.properties.type;
    return { lat, lng, approximate: !['house', 'street', 'other'].includes(type) };
  } catch {
    return null;
  }
}

/**
 * Finds an address on the map. Tries the cleaned full address in two map services; if neither finds it,
 * tries without the first parts (gym name, street) and finally the postal code: those only give the town (approximate).
 */
export async function geocodeAddress(address: string): Promise<GeoHit | null> {
  const clean = cleanAddress(address) || address.trim();
  const exact = (await nominatim(clean)) || (await photon(clean));
  if (exact) return exact;
  const parts = clean.split(',').map((p) => p.trim()).filter(Boolean);
  for (const q of parts.slice(1).map((_, i) => parts.slice(i + 1).join(', ')).slice(0, 3)) {
    const found = await nominatim(q);
    if (found) return { ...found, approximate: true };
  }
  const cp = clean.match(/\b(15|27|32|36|33|24)\d{3}\b/)?.[0];
  if (cp) {
    const found = await nominatim(`${cp}, España`);
    if (found) return { ...found, approximate: true };
  }
  return null;
}

/** Where the GPS takes the technician: the point on the map when it is the exact place, otherwise the written address. */
export function navigationDestination(location: { address: string; lat?: number | null; lng?: number | null; approximate?: boolean }): string {
  const { lat, lng } = location;
  const exact =
    lat != null && lng != null && !location.approximate &&
    !ZONE_CENTERS.some(([, zl, zg]) => Math.abs(zl - lat) < 1e-4 && Math.abs(zg - lng) < 1e-4);
  return exact ? `${lat},${lng}` : location.address.trim();
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    for (const [maxSide, quality] of [[1600, 0.75], [1280, 0.65], [1024, 0.55], [800, 0.5]] as const) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length < MAX_MEDIA_CHARS) return dataUrl;
    }
    throw new Error('too-big');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Turns a picked photo or video into something that fits the database, or explains why not. */
export async function prepareMedia(file: File): Promise<{ type: 'image' | 'video'; name: string; dataUrl: string }> {
  if (file.type.startsWith('image/')) {
    return { type: 'image', name: file.name, dataUrl: await compressImage(file) };
  }
  if (file.type.startsWith('video/')) {
    const dataUrl = await readAsDataUrl(file);
    if (dataUrl.length >= MAX_MEDIA_CHARS) throw new Error('video-too-big');
    return { type: 'video', name: file.name, dataUrl };
  }
  throw new Error('unsupported');
}

export type NewTicket = Omit<Ticket, 'id' | 'seq' | 'number' | 'createdAt' | 'mediaCount' | 'status' | 'serviceId'>;

/** Saves a ticket with the next consecutive number (AV-0001, AV-0002...) and its photos/videos. */
export async function createTicket(
  data: NewTicket,
  media: { type: 'image' | 'video'; name: string; dataUrl: string }[]
): Promise<Ticket> {
  const db = getFirestoreDb();
  if (!db) throw new Error('no-db');
  const counterRef = doc(db, 'counters', 'tickets');
  return runTransaction(db, async (tx) => {
    const counter = await tx.get(counterRef);
    const seq = (counter.exists() ? (counter.data().n as number) : 0) + 1;
    const id = `tk-${Date.now().toString(36)}`;
    const ticket: Ticket = {
      ...data,
      id,
      seq,
      number: `AV-${String(seq).padStart(4, '0')}`,
      createdAt: new Date().toISOString(),
      mediaCount: media.length,
      status: 'nuevo',
      serviceId: null,
    };
    // Firestore rejects undefined values
    const clean = JSON.parse(JSON.stringify(ticket));
    tx.set(counterRef, { n: seq });
    tx.set(doc(db, 'tickets', id), clean);
    media.forEach((m, i) => {
      tx.set(doc(db, 'ticketMedia', `${id}-${i}`), { ticketId: id, type: m.type, name: m.name.slice(0, 120), dataUrl: m.dataUrl });
    });
    return ticket;
  });
}

export async function loadTicketMedia(ticketId: string): Promise<TicketMedia[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'ticketMedia'), where('ticketId', '==', ticketId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TicketMedia, 'id'>) }));
}
