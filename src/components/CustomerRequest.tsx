import React, { useState } from 'react';
import { Mail, MessageSquare } from 'lucide-react';
import { Ticket } from '../types';

interface CustomerRequestProps {
  ticket: Ticket;
  userEmail: string;
  onUpdate: (ticketId: string, change: (t: Ticket) => Partial<Ticket>) => void;
}

const OPTIONS = [
  'Marca y modelo de la máquina',
  'Número de serie (pegatina de la máquina)',
  'Fotos de la avería',
  'Un vídeo de la máquina funcionando',
  'Dirección exacta del centro',
  'Persona de contacto y horario para ir',
  'Descripción más detallada del problema',
];

const firstName = (name: string) => name.trim().split(/\s+/)[0] || '';

/** Asks the customer, by email (or WhatsApp if there is no email), for what is missing in the breakdown notice. */
export const CustomerRequest: React.FC<CustomerRequestProps> = ({ ticket, userEmail, onUpdate }) => {
  const [open, setOpen] = useState(false);
  // Pre-ticks what the notice is clearly missing
  const [picked, setPicked] = useState<string[]>(() => [
    ...(!ticket.machine ? [OPTIONS[0]] : []),
    ...(!ticket.mediaCount ? [OPTIONS[2]] : []),
  ]);
  const [extra, setExtra] = useState('');

  const items = [...picked, ...(extra.trim() ? [extra.trim()] : [])];
  const subject = `Aviso de avería ${ticket.number} · necesitamos algunos datos`;
  const body = [
    `Hola${firstName(ticket.customerName) ? ` ${firstName(ticket.customerName)}` : ''},`,
    '',
    `Hemos recibido su aviso de avería ${ticket.number} (${ticket.problem}${ticket.machine ? `, ${ticket.machine}` : ''}). Para poder gestionarlo necesitamos que nos indique:`,
    '',
    ...items.map((x) => `- ${x}`),
    '',
    'Puede responder a este correo con la información y las fotos o vídeos.',
    '',
    'Muchas gracias.',
    'Un saludo,',
    'SAVA Servicios Deportivos',
    'Tel. 604 015 066 · administracion@savaservicios.com',
  ].join('\n');

  const log = (how: string) =>
    onUpdate(ticket.id, (t) => ({
      timeline: [
        ...(t.timeline || []),
        { at: new Date().toISOString(), by: userEmail || undefined, kind: 'nota', text: `${how} al cliente pidiendo: ${items.join('; ')}` },
      ],
    }));

  const sendEmail = () => {
    window.location.href = `mailto:${ticket.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    log('Correo preparado');
    setOpen(false);
  };
  const sendWhatsapp = () => {
    const phone = ticket.customerPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone.length === 9 ? `34${phone}` : phone}?text=${encodeURIComponent(body)}`, '_blank');
    log('WhatsApp enviado');
    setOpen(false);
  };

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
      >
        <Mail className="w-4 h-4" />Pedir datos al cliente
      </button>
    );

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2 text-xs">
      <div className="font-bold text-blue-900">¿Qué le falta al aviso?</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {OPTIONS.map((o) => (
          <label key={o} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={picked.includes(o)}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, o] : p.filter((x) => x !== o)))}
            />
            {o}
          </label>
        ))}
      </div>
      <input
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="Otra cosa (opcional)"
        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
      />
      <div className="flex flex-wrap gap-2">
        {ticket.customerEmail && (
          <button onClick={sendEmail} disabled={!items.length} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-40 cursor-pointer">
            <Mail className="w-4 h-4" />Escribir correo a {ticket.customerEmail}
          </button>
        )}
        {ticket.customerPhone && (
          <button onClick={sendWhatsapp} disabled={!items.length} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500 text-white font-semibold disabled:opacity-40 cursor-pointer">
            <MessageSquare className="w-4 h-4" />Por WhatsApp
          </button>
        )}
        <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-600 font-semibold cursor-pointer">Cancelar</button>
      </div>
      {!ticket.customerEmail && <div className="text-slate-500">Este aviso no tiene correo del cliente; puedes añadirlo con Editar o pedirlo por WhatsApp.</div>}
    </div>
  );
};
