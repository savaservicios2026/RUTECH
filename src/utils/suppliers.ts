import { Ticket } from '../types';

export interface Supplier {
  id: string;
  name: string;
  brands: string[]; // words that identify the brand in the machine, problem or description
  email: string;
}

// Suppliers we work with most (Pablo, 2026-10-22)
export const SUPPLIERS: Supplier[] = [
  { id: 'ffittech', name: 'Ffittech / Azafit', brands: ['ffittech', 'fittech', 'azafit'], email: 'digital@ffittech.com' },
  { id: 'jht', name: 'Johnson / Matrix / Horizon', brands: ['johnson', 'matrix', 'horizon'], email: 'sat@jht.es' },
  { id: 'fitnessdeluxe', name: 'Impulse / Xebex / DHZ / Fitness Deluxe', brands: ['impulse', 'xebex', 'dhz', 'fitness deluxe'], email: 'n.sanchez@fitnessdeluxe.es' },
  { id: 'onequipment', name: 'On Equipment', brands: ['on equipment', 'one equipment'], email: 'administracion@savaservicios.com' },
  { id: 'bodytone', name: 'Bodytone', brands: ['bodytone', 'body tone'], email: 'gymservice@bodytone.eu' },
];

const normalize = (s: string) => ` ${s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;

/** The supplier whose brand is written in the breakdown (machine first, then problem and description). */
export function detectSupplier(ticket: Pick<Ticket, 'machine' | 'problem' | 'description'>): Supplier | null {
  for (const text of [ticket.machine, ticket.problem, ticket.description]) {
    if (!text) continue;
    const t = normalize(text);
    const hit = SUPPLIERS.find((s) => s.brands.some((b) => t.includes(` ${normalize(b).trim()} `)));
    if (hit) return hit;
  }
  return null;
}

export const supplierById = (id?: string | null) => SUPPLIERS.find((s) => s.id === id) || null;

/** The notice the supplier gets. The subject carries the breakdown number so replies can be matched. */
export function supplierEmail(ticket: Ticket, supplier: Supplier, link?: string) {
  const subject = `Aviso de avería ${ticket.number} · ${ticket.facility || ticket.customerName} · SAVA`;
  const lines = [
    `Hola,`,
    `Les enviamos un aviso de avería de un cliente nuestro para que nos indiquen cómo proceder (garantía, repuesto o asistencia).`,
    ``,
    `Nº de aviso: ${ticket.number}`,
    `Cliente: ${ticket.customerName}${ticket.facility ? ` (${ticket.facility})` : ''}`,
    `Dirección: ${ticket.location.address}`,
    ticket.machine ? `Máquina (marca y modelo): ${ticket.machine}` : '',
    `Avería: ${ticket.problem}`,
    ticket.description ? `Detalle: ${ticket.description}` : '',
    link ? `Fotos y vídeos del cliente: ${link}` : '',
    ``,
    `Por favor, mantengan "${ticket.number}" en el asunto al responder.`,
    ``,
    `Un saludo,`,
    `SAVA Servicios Deportivos · Servicio técnico`,
    `administracion@savaservicios.com · 604 015 066`,
  ].filter((l, i, all) => l !== '' || all[i - 1] !== '');
  return { to: supplier.email, subject, body: lines.join('\n') };
}
