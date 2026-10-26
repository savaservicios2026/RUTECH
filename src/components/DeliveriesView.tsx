import React, { useMemo, useState } from 'react';
import { Package, Plus, MapPin, Phone, Mail, MessageSquare, Route, CheckCircle2, Trash2, Edit, X, Loader2, CalendarDays, Navigation } from 'lucide-react';
import { Delivery, DeliveryStatus, ServiceJob, Technician } from '../types';
import { DeliverySuggestion, deliveryStatus, suggestRoutesForDelivery, todayIso } from '../utils/deliveries';
import { geocodeAddress, zoneCenter, zoneFor } from '../utils/tickets';

interface DeliveriesViewProps {
  deliveries: Delivery[];
  services: ServiceJob[];
  technicians: Technician[];
  canEdit: boolean;
  onSave: (delivery: Delivery) => void;
  onDelete: (deliveryId: string) => void;
  onAddToRoute: (delivery: Delivery, suggestion: DeliverySuggestion) => void;
  onCreateSeparate: (delivery: Delivery) => void;
  onRemoveFromRoute: (delivery: Delivery) => void;
  onMarkDelivered: (delivery: Delivery) => void;
  onMarkReady: (delivery: Delivery, ready: boolean) => void;
  canMarkReady: boolean; // office and technicians
  showToast: (msg: string) => void;
}

const formatDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' });

// "Juan Manuel Vegas Barbero" -> "Juan Manuel" (Spanish names end with two surnames)
const firstName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? parts.slice(0, -2).join(' ') : parts[0];
};

const whatsappUrl = (phone: string) => {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 9) digits = `34${digits}`;
  return `https://wa.me/${digits}`;
};

const readyText = (d: Delivery) =>
  `Hola${d.customerName ? ` ${d.customerName}` : ''}, le escribimos de SAVA Servicios Deportivos. Su pedido (${d.items}) ya está preparado para salir. Le avisaremos cuando vayamos de camino. Un saludo.`;

const mapsUrl = (d: Delivery) =>
  d.location.approximate
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.location.address)}`
    : `https://www.google.com/maps/search/?api=1&query=${d.location.lat},${d.location.lng}`;

const EMPTY_FORM = {
  facility: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  address: '',
  items: '',
  notes: '',
  deadline: '',
  estimatedMinutes: 20,
};

const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

const DeliveryForm: React.FC<{
  initial: Delivery | null;
  onCancel: () => void;
  onSave: (d: Delivery) => void;
}> = ({ initial, onCancel, onSave }) => {
  const [form, setForm] = useState(() =>
    initial
      ? {
          facility: initial.facility || '',
          customerName: initial.customerName,
          customerPhone: initial.customerPhone,
          customerEmail: initial.customerEmail || '',
          address: initial.location.address,
          items: initial.items,
          notes: initial.notes || '',
          deadline: initial.deadline || '',
          estimatedMinutes: initial.estimatedMinutes,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: k === 'estimatedMinutes' ? Number(e.target.value) : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim() && !form.facility.trim()) return setError('Pon el centro o el nombre del cliente.');
    if (!form.address.trim()) return setError('Falta la dirección de entrega.');
    if (!form.items.trim()) return setError('Indica qué material hay que entregar.');
    setSaving(true);
    let location = initial?.location;
    if (!location || location.address !== form.address.trim()) {
      const found = await geocodeAddress(form.address.trim());
      const zone = found ? zoneFor(found.lat, found.lng) : 'A Coruña y Ferrol';
      const p = found || zoneCenter(zone);
      location = { address: form.address.trim(), lat: p.lat, lng: p.lng, zone, approximate: !found || found.approximate };
    }
    onSave({
      id: initial?.id || `ent-${Date.now()}`,
      createdAt: initial?.createdAt || new Date().toISOString(),
      facility: form.facility.trim(),
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      customerEmail: form.customerEmail.trim(),
      location,
      items: form.items.trim(),
      notes: form.notes.trim(),
      deadline: form.deadline || '',
      estimatedMinutes: form.estimatedMinutes || 20,
      status: initial?.status || 'pendiente',
      serviceId: initial?.serviceId ?? null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[94vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-[#1f4f94] to-[#0d2650] text-white flex items-center justify-between">
          <span className="font-bold text-base">{initial ? 'Editar entrega' : 'Nueva entrega de material'}</span>
          <button type="button" onClick={onCancel} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className="block text-xs font-bold text-slate-600 mb-1">Centro</span><input className={inputClass} value={form.facility} onChange={set('facility')} placeholder="Gimnasio, club, concello…" /></label>
            <label><span className="block text-xs font-bold text-slate-600 mb-1">Nombre de contacto</span><input className={inputClass} value={form.customerName} onChange={set('customerName')} /></label>
            <label><span className="block text-xs font-bold text-slate-600 mb-1">Teléfono</span><input className={inputClass} type="tel" value={form.customerPhone} onChange={set('customerPhone')} /></label>
            <label><span className="block text-xs font-bold text-slate-600 mb-1">Correo</span><input className={inputClass} type="email" value={form.customerEmail} onChange={set('customerEmail')} /></label>
          </div>
          <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Dirección de entrega</span><input className={inputClass} value={form.address} onChange={set('address')} placeholder="Calle, número, localidad" /></label>
          <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Material a entregar</span><textarea className={inputClass} rows={2} value={form.items} onChange={set('items')} placeholder="Ej. 2 pares de mancuernas 10 kg" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="block text-xs font-bold text-slate-600 mb-1">Entregar antes de (opcional)</span><input className={inputClass} type="date" value={form.deadline} onChange={set('deadline')} /></label>
            <label><span className="block text-xs font-bold text-slate-600 mb-1">Tiempo de entrega (min)</span><input className={inputClass} type="number" min={5} step={5} value={form.estimatedMinutes} onChange={set('estimatedMinutes')} /></label>
          </div>
          <label className="block"><span className="block text-xs font-bold text-slate-600 mb-1">Notas</span><textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} placeholder="Horario de recepción, acceso, etc." /></label>
          {error && <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs">{error}</div>}
        </div>
        <div className="p-3 border-t bg-slate-50 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 rounded-xl font-bold text-sm cursor-pointer">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
          </button>
        </div>
      </form>
    </div>
  );
};

// Orders delivered to our own warehouse in Bértoa are told apart at a glance
const toWarehouse = (address: string) => {
  const a = address.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return a.includes('seixo') && (a.includes('carballo') || a.includes('15100'));
};

export const DeliveriesView: React.FC<DeliveriesViewProps> = ({
  deliveries,
  services,
  technicians,
  canEdit,
  onSave,
  onDelete,
  onAddToRoute,
  onCreateSeparate,
  onRemoveFromRoute,
  onMarkDelivered,
  onMarkReady,
  canMarkReady,
}) => {
  const [filter, setFilter] = useState<DeliveryStatus>('pendiente');
  const [editing, setEditing] = useState<Delivery | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const withStatus = useMemo(
    () => deliveries.map((d) => ({ d, status: deliveryStatus(d, services) })),
    [deliveries, services]
  );
  const counts = useMemo(() => {
    const c: Record<DeliveryStatus, number> = { pendiente: 0, planificada: 0, entregada: 0 };
    withStatus.forEach(({ status }) => c[status]++);
    return c;
  }, [withStatus]);
  const visible = withStatus
    .filter(({ status }) => status === filter)
    .sort((a, b) => (a.d.deadline || '9999').localeCompare(b.d.deadline || '9999') || a.d.createdAt.localeCompare(b.d.createdAt));

  const techName = (id?: string | null) => technicians.find((t) => t.id === id)?.name || 'Sin técnico';

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2"><Package className="w-5 h-5 text-blue-600" />Entregas de material</h2>
          <p className="text-xs text-slate-500">Se proponen las rutas de los técnicos que pasan más cerca, para entregar aprovechando el viaje.</p>
        </div>
        {canEdit && (
          <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer">
            <Plus className="w-4 h-4" />Nueva entrega
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {(['pendiente', 'planificada', 'entregada'] as DeliveryStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
              filter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {s === 'pendiente' ? 'Pendientes' : s === 'planificada' ? 'En ruta' : 'Entregadas'} ({counts[s]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
          {filter === 'pendiente' ? 'No hay entregas pendientes.' : filter === 'planificada' ? 'No hay entregas metidas en ruta.' : 'Todavía no hay entregas hechas.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map(({ d, status }) => {
            const job = d.serviceId ? services.find((s) => s.id === d.serviceId) : undefined;
            const suggestions = status === 'pendiente' ? suggestRoutesForDelivery(d, services, technicians).slice(0, 4) : [];
            const overdue = status !== 'entregada' && d.deadline && d.deadline < todayIso();
            return (
              <div
                key={d.id}
                className={`rounded-xl border p-4 shadow-xs space-y-3 text-sm ${
                  toWarehouse(d.location.address) ? 'bg-blue-100 border-blue-400' : 'bg-white border-slate-200'
                }`}
              >
                {toWarehouse(d.location.address) && (
                  <div className="text-xs font-bold text-blue-800">🏭 Entrega en la nave (Rúa do Seixo, Carballo)</div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">{d.facility || d.customerName}</div>
                    {d.facility && d.customerName && <div className="text-xs text-slate-500">{d.customerName}</div>}
                  </div>
                  {d.deadline && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${overdue ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                      Antes del {new Date(`${d.deadline}T12:00:00`).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900">
                  <span className="font-bold">📦 Material:</span> {d.items}
                  {d.notes && <div className="text-slate-600 mt-1">{d.notes}</div>}
                </div>

                <div className="space-y-1 text-xs text-slate-700">
                  <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />{d.location.address}{d.location.approximate && <span className="text-amber-600">(ubicación aproximada)</span>}</div>
                  {d.customerPhone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{d.customerPhone}</div>}
                  {d.customerEmail && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" />{d.customerEmail}</div>}
                </div>

                {/* Order packed and ready to go out */}
                {status !== 'entregada' &&
                  (d.ready ? (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4" />Pedido listo para salir
                        <span className="font-normal text-emerald-700">
                          · {new Date(d.ready.at).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {d.ready.by ? ` · ${d.ready.by.split('@')[0]}` : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.customerPhone && (
                          <a href={`${whatsappUrl(d.customerPhone)}?text=${encodeURIComponent(readyText(d))}`} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 bg-green-500 text-white rounded-lg font-semibold flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />Avisar al cliente
                          </a>
                        )}
                        {canMarkReady && (
                          <button onClick={() => onMarkReady(d, false)} className="px-2.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-semibold cursor-pointer">Deshacer</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    canMarkReady && (
                      <button onClick={() => onMarkReady(d, true)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                        <CheckCircle2 className="w-4 h-4" />Pedido listo para salir
                      </button>
                    )
                  ))}

                {/* Contact the customer */}
                <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
                  <a href={d.customerPhone ? `tel:${d.customerPhone.replace(/\s/g, '')}` : undefined} className={`py-2 rounded-lg flex flex-col items-center gap-0.5 ${d.customerPhone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-300 pointer-events-none'}`}><Phone className="w-4 h-4" />Llamar</a>
                  <a href={d.customerPhone ? whatsappUrl(d.customerPhone) : undefined} target="_blank" rel="noreferrer" className={`py-2 rounded-lg flex flex-col items-center gap-0.5 ${d.customerPhone ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-300 pointer-events-none'}`}><MessageSquare className="w-4 h-4" />WhatsApp</a>
                  <a href={d.customerEmail ? `mailto:${d.customerEmail}` : undefined} className={`py-2 rounded-lg flex flex-col items-center gap-0.5 ${d.customerEmail ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300 pointer-events-none'}`}><Mail className="w-4 h-4" />Correo</a>
                  <a href={mapsUrl(d)} target="_blank" rel="noreferrer" className="py-2 rounded-lg flex flex-col items-center gap-0.5 bg-slate-800 text-white"><Navigation className="w-4 h-4" />Mapa</a>
                </div>

                {/* Route suggestions */}
                {status === 'pendiente' && (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-[11px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1"><Route className="w-3.5 h-3.5" />Rutas que pasan cerca</div>
                    {suggestions.length === 0 ? (
                      <p className="text-xs text-slate-500">No hay rutas planificadas en los próximos 14 días{d.deadline ? ' antes de la fecha límite' : ''}.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {suggestions.map((s, i) => (
                          <div key={`${s.technician.id}-${s.date}`} className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${i === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="text-xs">
                              <div className="font-semibold text-slate-800 capitalize">
                                {i === 0 && '⭐ '}{formatDay(s.date)} · {firstName(s.technician.name)}
                              </div>
                              <div className="text-slate-600">
                                Desvío <strong>+{s.detourKm} km</strong> ({s.between}) · a {s.nearestKm} km de {s.nearestName}
                              </div>
                            </div>
                            {canEdit && (
                              <button onClick={() => onAddToRoute(d, s)} className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer">Meter en ruta</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <button onClick={() => onCreateSeparate(d)} className="mt-2 text-xs text-blue-700 underline cursor-pointer">Programar como viaje aparte</button>
                    )}
                  </div>
                )}

                {status !== 'pendiente' && job && (
                  <div className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${status === 'entregada' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>
                    {status === 'entregada' ? <CheckCircle2 className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
                    <span className="capitalize">{formatDay(job.date)}</span> · {techName(job.assignedTechnicianId)}
                  </div>
                )}
                {status === 'entregada' && !job && (
                  <div className="p-2 rounded-lg text-xs bg-emerald-50 text-emerald-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Entregada</div>
                )}

                {canEdit && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-xs">
                    {status === 'planificada' && (
                      <>
                        <button onClick={() => onMarkDelivered(d)} className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold cursor-pointer">Marcar entregada</button>
                        <button onClick={() => onRemoveFromRoute(d)} className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold cursor-pointer">Quitar de la ruta</button>
                      </>
                    )}
                    {status === 'pendiente' && (
                      <button onClick={() => onMarkDelivered(d)} className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold cursor-pointer">Ya entregada</button>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => setEditing(d)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer" title="Editar"><Edit className="w-4 h-4" /></button>
                      <button
                        onClick={() => {
                          if (confirmDelete === d.id) {
                            onDelete(d.id);
                            setConfirmDelete(null);
                          } else setConfirmDelete(d.id);
                        }}
                        className={`p-1.5 rounded-lg cursor-pointer ${confirmDelete === d.id ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-rose-600'}`}
                        title="Eliminar (pulsa dos veces)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <DeliveryForm
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(d) => {
            onSave(d);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};
