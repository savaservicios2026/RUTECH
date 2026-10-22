import React, { useState } from 'react';
import { Send, MessageSquarePlus, Loader2 } from 'lucide-react';
import { Ticket, TicketEvent } from '../types';
import { SUPPLIERS, detectSupplier, supplierById, supplierEmail } from '../utils/suppliers';
import { loadTicketMedia } from '../utils/tickets';
import { buildEml, downloadBlob } from '../utils/eml';

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

  // The email opens in the office's mail program with the photos and videos attached, ready to send.
  // On a phone, the share sheet hands it to the mail app with the files.
  const prepareEmail = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const m = supplierEmail(ticket, chosen);
      const media = ticket.mediaCount > 0 ? await loadTicketMedia(ticket.id) : [];
      const files = media.map((x, i) => ({
        name: x.name || `${ticket.number}-${i + 1}.${x.type === 'video' ? 'mp4' : 'jpg'}`,
        dataUrl: x.dataUrl,
      }));
      const phone = /iPhone|iPad|Android/i.test(navigator.userAgent);
      if (phone && navigator.canShare) {
        const asFiles = await Promise.all(
          files.map(async (f) => new File([await (await fetch(f.dataUrl)).blob()], f.name, { type: f.dataUrl.slice(5, f.dataUrl.indexOf(';')) }))
        );
        const data = { title: m.subject, text: `Para: ${m.to}\n\n${m.body}`, files: asFiles };
        if (navigator.canShare(data)) await navigator.share(data);
        else window.location.href = `mailto:${m.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
      } else {
        downloadBlob(buildEml(m.to, m.subject, m.body, files), `${ticket.number} aviso ${chosen.name.split(' ')[0]}.eml`);
      }
      onUpdate(ticket.id, (t) => ({
        supplierId: chosen.id,
        supplierSend: { status: 'preparado', to: chosen.email, requestedAt: new Date().toISOString(), requestedBy: userEmail || undefined },
        timeline: addEvent(t, {
          kind: 'estado',
          text: `Correo para ${chosen.name} (${chosen.email}) preparado${files.length ? ` con ${files.length} adjunto${files.length > 1 ? 's' : ''}` : ''}. Al enviarlo desde el correo de la oficina, se apunta aquí.`,
        }),
      }));
    } catch (e: any) {
      if (e?.name !== 'AbortError') alert('No se pudo preparar el correo. Prueba otra vez.');
    } finally {
      setBusy(false);
    }
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
            : `✉️ Correo preparado para ${send.to} el ${when(send.requestedAt)}: falta pulsar Enviar en el correo`}
        </div>
      )}

      {canEdit && chosen && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={prepareEmail}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {send?.status === 'enviado' ? 'Reenviar aviso al proveedor' : 'Enviar aviso al proveedor'}
          </button>
          <p className="text-[11px] text-slate-500">
            Se abre el correo ya escrito, con las fotos y vídeos adjuntos y solo con los datos de SAVA. Revisa y pulsa Enviar.
          </p>
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
