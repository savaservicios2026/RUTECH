import React, { useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Plus, Link2, MapPin, Phone, Wrench, Image as ImageIcon, Route, CheckCircle2, XCircle, RotateCcw, Loader2, Pencil } from 'lucide-react';
import { ServiceJob, Technician, Ticket, TicketMedia, TicketStatus, PriorityType } from '../types';
import { calculateDistanceKm } from '../utils/geo';
import { loadTicketMedia } from '../utils/tickets';
import { TicketForm } from './TicketForm';
import { SupplierPanel } from './SupplierPanel';
import { CustomerRequest } from './CustomerRequest';

interface TicketsViewProps {
  tickets: Ticket[];
  services: ServiceJob[];
  technicians: Technician[];
  canEdit: boolean;
  onCreateService: (ticket: Ticket) => void;
  onSetStatus: (ticketId: string, status: TicketStatus) => void;
  onOpenService: (serviceId: string) => void;
  showToast: (msg: string) => void;
  onUpdateTicket: (ticketId: string, change: (t: Ticket) => Partial<Ticket>) => void;
  userEmail: string;
  // Office and technicians can correct a notice's details
  onEditTicket?: (ticketId: string, changes: Partial<Ticket>) => void;
}

const URGENCY_RANK: Record<PriorityType, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };
const URGENCY_STYLE: Record<PriorityType, string> = {
  urgente: 'bg-rose-600 text-white',
  alta: 'bg-amber-500 text-white',
  media: 'bg-blue-100 text-blue-800',
  baja: 'bg-slate-100 text-slate-600',
};

// How close a ticket must be to a planned visit to suggest fitting it into that route
type Stage = 'sin' | 'tramite' | 'resuelta';
const STAGES: [Stage, string, string, string][] = [
  ['sin', '🆕 Sin gestionar', 'bg-rose-600 text-white', 'bg-rose-50 text-rose-900 border border-rose-200'],
  ['tramite', '⏳ En trámite', 'bg-amber-500 text-white', 'bg-amber-50 text-amber-900 border border-amber-200'],
  ['resuelta', '✓ Resueltas', 'bg-emerald-600 text-white', 'bg-emerald-50 text-emerald-900 border border-emerald-200'],
];

const NEARBY_KM = 30;

export const PUBLIC_TICKET_URL = `${location.origin}${location.pathname}#aviso`;

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' });

const MediaStrip: React.FC<{ ticketId: string; count: number }> = ({ ticketId, count }) => {
  const [items, setItems] = useState<TicketMedia[] | null>(null);
  const [open, setOpen] = useState<TicketMedia | null>(null);
  useEffect(() => {
    if (!count) return;
    let cancelled = false;
    loadTicketMedia(ticketId).then((m) => !cancelled && setItems(m)).catch(() => !cancelled && setItems([]));
    return () => { cancelled = true; };
  }, [ticketId, count]);
  if (!count) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {items === null ? (
        <span className="text-xs text-slate-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Cargando {count} archivo(s)…</span>
      ) : (
        items.map((m) => (
          <button key={m.id} onClick={() => setOpen(m)} className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
            {m.type === 'image' ? <img src={m.dataUrl} alt="" className="w-full h-full object-cover" /> : <video src={m.dataUrl} className="w-full h-full object-cover" />}
          </button>
        ))
      )}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          {open.type === 'image' ? (
            <img src={open.dataUrl} alt="" className="max-w-full max-h-full rounded-lg" />
          ) : (
            <video src={open.dataUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
};

export const TicketsView: React.FC<TicketsViewProps> = ({
  tickets,
  services,
  technicians,
  canEdit,
  onCreateService,
  onSetStatus,
  onOpenService,
  showToast,
  onUpdateTicket,
  userEmail,
  onEditTicket,
}) => {
  const [filter, setFilter] = useState<Stage>('sin');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const today = new Date().toISOString().split('T')[0];

  // Not handled yet / being handled (supplier notified or a job planned) / solved
  const stageOf = (t: Ticket): Stage => {
    if (t.status === 'cerrado') return 'resuelta';
    if (t.status === 'convertido') {
      const job = services.find((s) => s.id === t.serviceId);
      return job?.status === 'completado' && job.inSituReport?.outcome !== 'volver' ? 'resuelta' : 'tramite';
    }
    return t.supplierSend && t.supplierSend.status !== 'error' ? 'tramite' : 'sin';
  };

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { sin: 0, tramite: 0, resuelta: 0 };
    tickets.forEach((t) => c[stageOf(t)]++);
    return c;
  }, [tickets, services]);

  const visible = useMemo(
    () =>
      tickets
        .filter((t) => stageOf(t) === filter)
        .sort((a, b) =>
          filter !== 'resuelta'
            ? URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt)
        ),
    [tickets, services, filter]
  );

  // Planned visits near a ticket, so the office sees when a route already passes close by
  const nearbyVisits = (t: Ticket) => {
    if (t.location.lat == null || t.location.lng == null) return [];
    return services
      .filter((s) => s.date >= today && s.status !== 'cancelado' && s.status !== 'completado')
      .map((s) => ({ s, km: calculateDistanceKm(t.location.lat!, t.location.lng!, s.location.lat, s.location.lng) }))
      .filter((x) => x.km <= NEARBY_KM)
      .sort((a, b) => a.s.date.localeCompare(b.s.date) || a.km - b.km)
      .slice(0, 3);
  };

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_TICKET_URL);
      showToast('Enlace para clientes copiado');
    } catch {
      showToast(PUBLIC_TICKET_URL);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-600" />
              Averías
            </h2>
            <p className="text-xs text-slate-500">Avisos de clientes y de la oficina. Ordenados por urgencia; pásalos a parte de trabajo cuando tengan fecha.</p>
          </div>
          {canEdit && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={copyPublicLink} className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Link2 className="w-4 h-4" />Enlace para clientes
              </button>
              <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">
                <Plus className="w-4 h-4" />Nuevo aviso
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm font-bold">
          {STAGES.map(([key, label, on, off]) => (
            <button key={key} onClick={() => setFilter(key)} className={`py-2.5 px-1 rounded-xl cursor-pointer ${filter === key ? on : off}`}>
              {label} ({counts[key]})
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
          No hay avisos en esta lista.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((t) => {
          const near = nearbyVisits(t);
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-slate-900">{t.number}</span>
                    <span className={`text-[11px] font-bold uppercase rounded-full px-2 py-0.5 ${URGENCY_STYLE[t.urgency]}`}>{t.urgency}</span>
                    <span className="text-[11px] text-slate-400">{t.source === 'cliente' ? 'Cliente' : 'Oficina'} · {new Date(t.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="mt-1 text-base font-extrabold text-slate-900">
                    {t.customerName}{t.facility ? <span className="font-bold text-slate-600"> · {t.facility}</span> : null}
                  </div>
                  <div className="mt-0.5 font-semibold text-slate-800">{t.problem}</div>
                  {t.machine && <div className="text-xs text-slate-500 flex items-center gap-1"><Wrench className="w-3.5 h-3.5" />{t.machine}</div>}
                </div>
                {onEditTicket && (
                  <button onClick={() => setEditing(t)} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold">
                    <Pencil className="w-3.5 h-3.5" />Editar
                  </button>
                )}
              </div>

              {t.description && <p className="text-sm text-slate-600 whitespace-pre-line">{t.description}</p>}

              <div className="text-xs text-slate-600 space-y-1">
                <a href={`tel:${t.customerPhone}`} className="flex items-center gap-1 text-blue-700"><Phone className="w-3.5 h-3.5" />{t.customerPhone}</a>
                {t.customerEmail && <div>{t.customerEmail}</div>}
                <a
                  href={t.location.lat != null ? `https://www.google.com/maps?q=${t.location.lat},${t.location.lng}` : `https://www.google.com/maps?q=${encodeURIComponent(t.location.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-blue-700"
                >
                  <MapPin className="w-3.5 h-3.5" />{t.location.address}{t.location.zone ? ` (${t.location.zone})` : ''}
                </a>
                {t.location.lat == null && <div className="text-amber-700">Sin coordenadas exactas: revisa la dirección al crear el parte.</div>}
              </div>

              {t.mediaCount > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 flex items-center gap-1 mb-1"><ImageIcon className="w-3.5 h-3.5" />Fotos / vídeos</div>
                  <MediaStrip ticketId={t.id} count={t.mediaCount} />
                </div>
              )}

              <SupplierPanel ticket={t} canEdit={canEdit} userEmail={userEmail} onUpdate={onUpdateTicket} />

              {stageOf(t) !== 'resuelta' && <CustomerRequest ticket={t} userEmail={userEmail} onUpdate={onUpdateTicket} />}

              {t.status === 'nuevo' && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5">
                  <div className="text-xs font-semibold text-indigo-900 flex items-center gap-1"><Route className="w-3.5 h-3.5" />Rutas cercanas (menos de {NEARBY_KM} km)</div>
                  {near.length === 0 ? (
                    <div className="text-xs text-indigo-700/80 mt-0.5">{t.location.lat == null ? 'Sin ubicación para calcularlo.' : 'Ninguna visita planificada cerca por ahora.'}</div>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {near.map(({ s, km }) => {
                        const tech = technicians.find((x) => x.id === s.assignedTechnicianId);
                        return (
                          <li key={s.id} className="text-xs text-indigo-900">
                            <span className="font-semibold capitalize">{formatDay(s.date)}</span> · {tech ? tech.name : 'Sin técnico'} · {s.customerName} ({s.location.address.split(',').slice(-1)[0].trim()}) · <strong>{km} km</strong>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {canEdit && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {t.status === 'nuevo' && (
                    <>
                      <button onClick={() => onCreateService(t)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4" />Crear parte de trabajo
                      </button>
                      <button onClick={() => onSetStatus(t.id, 'cerrado')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                        <XCircle className="w-4 h-4" />Marcar resuelta sin parte
                      </button>
                    </>
                  )}
                  {t.status === 'convertido' && t.serviceId && (
                    <button onClick={() => onOpenService(t.serviceId!)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 text-xs font-semibold">
                      <Wrench className="w-4 h-4" />Ver parte de trabajo
                    </button>
                  )}
                  {t.status === 'convertido' && stageOf(t) === 'tramite' && (
                    <button onClick={() => onSetStatus(t.id, 'cerrado')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                      <CheckCircle2 className="w-4 h-4" />Marcar resuelta
                    </button>
                  )}
                  {t.status !== 'nuevo' && (
                    <button onClick={() => onSetStatus(t.id, 'nuevo')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold">
                      <RotateCcw className="w-4 h-4" />Volver a pendientes
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-3">Nuevo aviso de avería</h3>
            <TicketForm source="oficina" onCancel={() => setCreating(false)} />
          </div>
        </div>
      )}

      {editing && onEditTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-3">Editar aviso {editing.number}</h3>
            <TicketForm
              key={editing.id}
              source={editing.source}
              ticket={editing}
              onCancel={() => setEditing(null)}
              onSave={(changes) => {
                onEditTicket(editing.id, changes);
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
