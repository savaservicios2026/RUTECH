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
  { id: 'fitnessdeluxe', name: 'Impulse / Xebex / DHZ / Reebok / Fitness Deluxe', brands: ['impulse', 'xebex', 'dhz', 'reebok', 'fitness deluxe'], email: 'n.sanchez@fitnessdeluxe.es' },
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

/**
 * The notice the supplier gets. Only SAVA's details go in it (never the customer's): the supplier
 * deals with us. The subject carries the breakdown number so replies can be matched.
 */
export function supplierEmail(ticket: Ticket, supplier: Supplier) {
  const subject = `Aviso de avería ${ticket.number} · SAVA Servicios Deportivos`;
  const lines = [
    `Hola,`,
    ``,
    `Les enviamos un aviso de avería para que nos indiquen cómo proceder (garantía, repuesto o asistencia).`,
    ``,
    `Nº de aviso: ${ticket.number}`,
    ticket.machine ? `Máquina (marca y modelo): ${ticket.machine}` : '',
    `Avería: ${ticket.problem}`,
    ticket.description ? `Detalle: ${ticket.description}` : '',
    ticket.mediaCount > 0 ? `Adjuntamos fotos y vídeos de la avería.` : '',
    ``,
    `Datos para el envío y la facturación:`,
    `SAVA SERVICIOS DEPORTIVOS SL · CIF B70370846`,
    `Rúa do Seixo, nave H1H2, Polígono Industrial de Bértoa`,
    `15100 Carballo (A Coruña)`,
    `administracion@savaservicios.com · 604 015 066`,
    ``,
    `Por favor, mantengan "${ticket.number}" en el asunto al responder.`,
    ``,
    `Un saludo,`,
    `SAVA Servicios Deportivos · Servicio técnico`,
  ].filter((l) => l !== null && l !== undefined);
  // Drop empty optional lines without leaving double gaps
  const body = lines.filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n');
  return { to: supplier.email, subject, body };
}
