import React, { useState } from 'react';
import { Mail, Send, MessageSquarePlus } from 'lucide-react';
import { Ticket, TicketEvent } from '../types';
import { SUPPLIERS, detectSupplier, supplierById, supplierEmail } from '../utils/suppliers';
import { shareTicketForSupplier, supplierLink } from '../utils/supplierShare';

interface SupplierPanelProps {
  ticket: Ticket;
  canEdit: boolean;
  userEmail: string;
  onUpdate: (ticketId: string, change: (t: Ticket) => Partial<Ticket>) => void;
}

const KIND_ICON: Record<TicketEvent['kind'], string> = { nota: '📝', email_enviado: '📤', email_recibido: '📥', estado: '🔔' };

const when = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Supplier of the machine, the notice sent to them and the follow-up of the breakdown. */
export const SupplierPanel: React.FC<SupplierPanelProps> = ({ ticket, canEdit, userEmail, onUpdate }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const detected = detectSupplier(ticket);
  const chosen = ticket.supplierId === undefined ? detected : supplierById(ticket.supplierId);
  const send = ticket.supplierSend;
  const timeline = ticket.timeline || [];

  const addEvent = (t: Ticket, ev: Omit<TicketEvent, 'at' | 'by'>): TicketEvent[] => [
    ...(t.timeline || []),
    { ...ev, at: new Date().toISOString(), by: userEmail || undefined },
  ];

  // Photos go in a page linked from the email (an email from here can't carry attachments)
  const prepareLink = async () => {
    if (ticket.supplierSend?.link) return ticket.supplierSend.link;
    return supplierLink(await shareTicketForSupplier(ticket));
  };

  const requestSend = async () => {
    if (!chosen) return;
    setBusy(true);
    let link: string | undefined;
    try {
      link = await prepareLink();
    } catch {
      link = undefined;
    }
    setBusy(false);
    onUpdate(ticket.id, (t) => ({
      supplierId: chosen.id,
      supplierSend: { status: 'pendiente', to: chosen.email, requestedAt: new Date().toISOString(), requestedBy: userEmail || undefined, link },
      timeline: addEvent(t, {
        kind: 'estado',
        text: `Aviso a ${chosen.name} (${chosen.email}) en cola: se envía automáticamente con las fotos.`,
      }),
    }));
  };

  const openMail = async () => {
    if (!chosen) return;
    let link: string | undefined;
    try {
      link = await prepareLink();
    } catch {}
    const m = supplierEmail(ticket, chosen, link);
    const url = `mailto:${m.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
    window.location.href = url;
    onUpdate(ticket.id, (t) => ({
      supplierId: chosen.id,
      supplierSend: t.supplierSend ? { ...t.supplierSend, link } : { status: 'enviado', to: chosen.email, requestedAt: new Date().toISOString(), sentAt: new Date().toISOString(), requestedBy: userEmail || undefined, link },
      timeline: addEvent(t, { kind: 'email_enviado', text: `Correo al proveedor ${chosen.name} abierto en el correo de la oficina (${chosen.email}).` }),
    }));
  };

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-2.5 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-sky-900">Proveedor:</span>
        {canEdit ? (
          <select
            value={chosen?.id || ''}
            onChange={(e) => onUpdate(ticket.id, () => ({ supplierId: e.target.value || null }))}
            className="rounded-md border border-sky-300 bg-white px-2 py-1 font-semibold text-slate-800"
          >
            <option value="">Sin proveedor / no lo sé</option>
            {SUPPLIERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {detected?.id === s.id ? ' (detectado)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-semibold">{chosen?.name || 'Sin identificar'}</span>
        )}
        {chosen && <span className="text-slate-500">{chosen.email}</span>}
      </div>

      {send && (
        <div
          className={`font-semibold ${
            send.status === 'enviado' ? 'text-emerald-700' : send.status === 'error' ? 'text-rose-700' : 'text-amber-700'
          }`}
        >
          {send.status === 'enviado'
            ? `✓ Aviso enviado a ${send.to} el ${when(send.sentAt || send.requestedAt)}`
            : send.status === 'error'
            ? `No se pudo enviar a ${send.to}: ${send.error || 'error'}`
            : `⏳ En cola para ${send.to}: se envía solo en menos de una hora`}
        </div>
      )}

      {canEdit && chosen && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={requestSend}
            disabled={send?.status === 'pendiente' || busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {send?.status === 'enviado' ? 'Reenviar aviso al proveedor' : 'Enviar aviso al proveedor'}
          </button>
          <button type="button" onClick={openMail} className="flex items-center gap-1 text-sky-800 underline cursor-pointer">
            <Mail className="w-3.5 h-3.5" />
            O abrirlo ahora en mi correo
          </button>
          {send?.link && (
            <a href={send.link} target="_blank" rel="noreferrer" className="text-sky-800 underline">
              Ver la página que recibe el proveedor
            </a>
          )}
        </div>
      )}

      <div>
        <div className="font-semibold text-sky-900 mb-1">Seguimiento</div>
        {timeline.length === 0 ? (
          <div className="text-slate-500">Todavía no hay acciones.</div>
        ) : (
          <ul className="space-y-1">
            {timeline.map((ev, i) => (
              <li key={i} className="bg-white rounded-md border border-slate-200 px-2 py-1.5">
                <div className="text-[10px] text-slate-500">
                  {KIND_ICON[ev.kind]} {when(ev.at)}
                  {ev.by ? ` · ${ev.by}` : ''}
                </div>
                <div className="text-slate-800 whitespace-pre-line">{ev.text}</div>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex gap-1.5 mt-1.5">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Añadir nota (llamada, pedido de repuesto...)"
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5"
            />
            <button
              type="button"
              disabled={!note.trim()}
              onClick={() => {
                const text = note.trim();
                onUpdate(ticket.id, (t) => ({ timeline: addEvent(t, { kind: 'nota', text }) }));
                setNote('');
              }}
              className="flex items-center gap-1 px-2.5 rounded-md bg-slate-800 text-white font-semibold cursor-pointer disabled:opacity-40"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" /> Añadir
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
