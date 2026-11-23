import React, { useMemo, useState } from 'react';
import { Package, Plus, MapPin, Phone, Mail, MessageSquare, Route, CheckCircle2, Trash2, Edit, X, Loader2, CalendarDays, Navigation } from 'lucide-react';
import { Delivery, DeliveryChecklist as Checklist, DeliveryStatus, ServiceJob, Technician } from '../types';
import { DeliverySuggestion, deliveryStatus, suggestRoutesForDelivery, todayIso } from '../utils/deliveries';
import { AttachmentsBox } from './AttachmentsBox';
import { DeliveryChecklist } from './DeliveryChecklist';
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
  onMarkMissing: (delivery: Delivery, items: string | null) => void;
  onMissingNote: (delivery: Delivery, patch: { ordered?: boolean; note?: string }) => void;
  onChecklist: (delivery: Delivery, checklist: Checklist) => void;
  onPrepareAtNave: (delivery: Delivery, on: boolean) => void;
  userEmail?: string;
  canMarkReady: boolean; // office and technicians
  showToast: (msg: string) => void;
}

type Tab = 'preparar' | 'falta' | 'listo' | 'asignada' | 'entregada';
const TABS: [Tab, string, string, string][] = [
  ['preparar', '📦 Pendientes de preparar', 'bg-amber-500 text-white', 'bg-amber-50 text-amber-900 border border-amber-200'],
  ['falta', '⚠️ Falta material', 'bg-rose-600 text-white', 'bg-rose-50 text-rose-900 border border-rose-200'],
  ['listo', '✅ Listas para salir', 'bg-emerald-600 text-white', 'bg-emerald-50 text-emerald-900 border border-emerald-200'],
  ['asignada', '🚐 Asignadas', 'bg-blue-600 text-white', 'bg-blue-50 text-blue-900 border border-blue-200'],
  ['entregada', '✓ Entregadas', 'bg-slate-800 text-white', 'bg-slate-50 text-slate-700 border border-slate-200'],
];

const formatDayLong = (date: string) => {
  const text = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

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

// Customers already used in deliveries, newest details first (Pablo, 2026-11-20: pick one and the form fills itself)
type SavedCustomer = Pick<Delivery, 'facility' | 'customerName' | 'customerPhone' | 'customerEmail' | 'location'>;
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function savedCustomers(deliveries: Delivery[]): SavedCustomer[] {
  const seen = new Map<string, SavedCustomer>();
  [...deliveries]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .forEach((d) => {
      const key = `${norm(d.facility || '')}|${norm(d.customerName || '')}`;
      if (key === '|' || seen.has(key)) return;
      seen.set(key, { facility: d.facility, customerName: d.customerName, customerPhone: d.customerPhone, customerEmail: d.customerEmail, location: d.location });
    });
  return Array.from(seen.values()).sort((a, b) => (a.facility || a.customerName).localeCompare(b.facility || b.customerName, 'es'));
}

const DeliveryForm: React.FC<{
  initial: Delivery | null;
  customers: SavedCustomer[];
  onCancel: () => void;
  onSave: (d: Delivery) => void;
}> = ({ initial, customers, onCancel, onSave }) => {
  // Fixed id so documents can be attached before the delivery is saved
  const [deliveryId] = useState(() => initial?.id || `ent-${Date.now()}`);
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
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<SavedCustomer | null>(null);
  const matches = search.trim()
    ? customers.filter((c) => norm(`${c.facility || ''} ${c.customerName} ${c.customerPhone} ${c.location.address}`).includes(norm(search))).slice(0, 6)
    : [];
  const pick = (c: SavedCustomer) => {
    setPicked(c);
    setSearch('');
    setForm({ ...form, facility: c.facility || '', customerName: c.customerName || '', customerPhone: c.customerPhone || '', customerEmail: c.customerEmail || '', address: c.location.address });
  };
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: k === 'estimatedMinutes' ? Number(e.target.value) : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim() && !form.facility.trim()) return setError('Pon el centro o el nombre del cliente.');
    if (!form.address.trim()) return setError('Falta la dirección de entrega.');
    if (!form.items.trim()) return setError('Indica qué material hay que entregar.');
    setSaving(true);
    let location = initial?.location || (picked && picked.location.address === form.address.trim() ? picked.location : undefined);
    if (!location || location.address !== form.address.trim()) {
      const found = await geocodeAddress(form.address.trim());
      const zone = found ? zoneFor(found.lat, found.lng) : 'A Coruña y Ferrol';
      const p = found || zoneCenter(zone);
      location = { address: form.address.trim(), lat: p.lat, lng: p.lng, zone, approximate: !found || found.approximate };
    }
    onSave({
      ...(initial || {}),
      id: deliveryId,
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
          {!initial && customers.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <label className="block">
                <span className="block text-xs font-bold text-blue-900 mb-1">Cliente guardado</span>
                <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Busca por centro, nombre, teléfono o dirección" />
              </label>
              {matches.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {matches.map((c, k) => (
                    <button key={k} type="button" onClick={() => pick(c)} className="w-full text-left px-3 py-2 hover:bg-blue-50 cursor-pointer">
                      <div className="font-semibold text-slate-800">{c.facility || c.customerName}</div>
                      <div className="text-xs text-slate-500">{[c.facility ? c.customerName : '', c.customerPhone, c.location.address].filter(Boolean).join(' · ')}</div>
                    </button>
                  ))}
                </div>
              )}
              {search.trim() && !matches.length && <div className="text-xs text-slate-500">No hay ningún cliente guardado con ese nombre. Rellena los datos abajo y quedará guardado.</div>}
              {picked && !search && <div className="text-xs text-blue-800">✓ Datos de {picked.facility || picked.customerName} puestos abajo; puedes cambiarlos.</div>}
            </div>
          )}
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
          <div className="text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <AttachmentsBox serviceId={deliveryId} section="servicio" title="Documentos (parte, albarán, fotos)" />
          </div>
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
  onMarkMissing,
  onMissingNote,
  onChecklist,
  onPrepareAtNave,
  userEmail,
  canMarkReady,
}) => {
  const [filter, setFilter] = useState<Tab>('preparar');
  const [day, setDay] = useState(''); // '' = every day
  const [editing, setEditing] = useState<Delivery | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [missingFor, setMissingFor] = useState<string | null>(null); // delivery whose missing material is being written
  const [missingText, setMissingText] = useState('');
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({}); // office note being written, per delivery

  const withStatus = useMemo(
    () => deliveries.map((d) => ({ d, status: deliveryStatus(d, services) })),
    [deliveries, services]
  );
  const inTab = (tab: Tab, d: Delivery, status: DeliveryStatus) =>
    tab === 'entregada' ? status === 'entregada'
    : tab === 'asignada' ? status === 'planificada'
    : tab === 'falta' ? status !== 'entregada' && !!d.missing
    : tab === 'listo' ? status !== 'entregada' && !!d.ready
    : status !== 'entregada' && !d.ready && !d.missing;
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { preparar: 0, falta: 0, listo: 0, asignada: 0, entregada: 0 };
    withStatus.forEach(({ d, status }) => TABS.forEach(([t]) => inTab(t, d, status) && c[t]++));
    return c;
  }, [withStatus]);
  // The day a delivery belongs to: its route day, else its deadline, else when it was created
  const dayOf = (d: Delivery) => {
    const job = d.serviceId ? services.find((s) => s.id === d.serviceId) : undefined;
    return job?.date || d.deadline || (d.ready?.at || d.createdAt).slice(0, 10);
  };
  const visible = withStatus
    .filter(({ d, status }) => inTab(filter, d, status))
    .filter(({ d }) => !day || dayOf(d) === day)
    .sort((a, b) => (a.d.deadline || '9999').localeCompare(b.d.deadline || '9999') || a.d.createdAt.localeCompare(b.d.createdAt));
  // One block per day: delivered newest first, the rest soonest first
  const byDay = useMemo(() => {
    const groups = new Map<string, typeof visible>();
    visible.forEach((v) => groups.set(dayOf(v.d), [...(groups.get(dayOf(v.d)) || []), v]));
    return Array.from(groups.entries()).sort(([a], [b]) => (filter === 'entregada' ? b.localeCompare(a) : a.localeCompare(b)));
  }, [visible, filter]);

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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-bold">
        {TABS.map(([t, label, on, off]) => (
          <button key={t} onClick={() => setFilter(t)} className={`py-2.5 px-2 rounded-xl cursor-pointer ${filter === t ? on : off}`}>
            {label} ({counts[t]})
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <CalendarDays className="w-4 h-4 text-slate-500" />
        <span className="font-semibold text-slate-600">Día:</span>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5" />
        {day && (
          <button onClick={() => setDay('')} className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold cursor-pointer">Todos los días</button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
          {day ? 'No hay entregas de este apartado ese día.' : filter === 'preparar' ? 'No hay pedidos pendientes de preparar.' : filter === 'falta' ? 'No falta material en ningún pedido.' : filter === 'listo' ? 'No hay pedidos listos para salir.' : filter === 'asignada' ? 'No hay entregas asignadas a una ruta.' : 'Todavía no hay entregas hechas.'}
        </div>
      ) : (
        <div className="space-y-5">
          {byDay.map(([dayKey, items]) => (
            <section key={dayKey}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <span>{formatDayLong(dayKey)}</span>
                <span className="text-xs font-semibold text-slate-400">· {items.length} {items.length === 1 ? 'entrega' : 'entregas'}</span>
              </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(({ d, status }) => {
            const job = d.serviceId ? services.find((s) => s.id === d.serviceId) : undefined;
            const suggestions = status === 'pendiente' ? suggestRoutesForDelivery(d, services, technicians).slice(0, 4) : [];
            const overdue = status !== 'entregada' && d.deadline && d.deadline < todayIso();
            return (
              <div
                key={d.id}
                className={`rounded-xl border p-4 shadow-xs space-y-3 text-sm ${
                  toWarehouse(d.location.address) || d.prepareAtNave ? 'bg-blue-100 border-blue-400' : 'bg-white border-slate-200'
                }`}
              >
                {toWarehouse(d.location.address) ? (
                  <div className="text-xs font-bold text-blue-800">🏭 Entrega en la nave (Rúa do Seixo, Carballo)</div>
                ) : d.prepareAtNave ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-blue-800">🏭 Preparar pedido en la nave</div>
                    {canEdit && status !== 'entregada' && (
                      <button onClick={() => onPrepareAtNave(d, false)} className="text-[11px] text-blue-700 underline cursor-pointer">Quitar</button>
                    )}
                  </div>
                ) : canEdit && status !== 'entregada' ? (
                  <button onClick={() => onPrepareAtNave(d, true)} className="w-full py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 text-xs font-semibold cursor-pointer">🏭 Preparar pedido en Nave</button>
                ) : null}
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

                <div className="text-xs">
                  <AttachmentsBox serviceId={d.id} section="servicio" title="Documentos" />
                </div>

                {status !== 'entregada' && (
                  <DeliveryChecklist delivery={d} canTick={canMarkReady} canEdit={canEdit} userEmail={userEmail} onChange={onChecklist} onMissing={onMarkMissing} onReady={(x) => onMarkReady(x, true)} />
                )}

                <div className="space-y-1 text-xs text-slate-700">
                  <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />{d.location.address}{d.location.approximate && <span className="text-amber-600">(ubicación aproximada)</span>}</div>
                  {d.customerPhone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{d.customerPhone}</div>}
                  {d.customerEmail && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" />{d.customerEmail}</div>}
                </div>

                {/* Material missing from the order, noted by a technician or the office */}
                {status !== 'entregada' && missingFor === d.id ? (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-xs space-y-2">
                    <div className="font-bold text-rose-900">⚠️ ¿Qué material falta?</div>
                    <textarea
                      className="w-full bg-white border border-rose-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      rows={2}
                      autoFocus
                      value={missingText}
                      onChange={(e) => setMissingText(e.target.value)}
                      placeholder="Ej. faltan 2 discos de 10 kg"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={!missingText.trim()}
                        onClick={() => {
                          onMarkMissing(d, missingText.trim());
                          setMissingFor(null);
                        }}
                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
                      >Guardar</button>
                      <button onClick={() => setMissingFor(null)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : status !== 'entregada' && d.missing ? (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-2">
                    <div>
                      <span className="font-bold">⚠️ Falta material:</span> {d.missing.items}
                      <div className="text-rose-700 mt-0.5">
                        {new Date(d.missing.at).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {d.missing.by ? ` · ${d.missing.by.split('@')[0]}` : ''}
                      </div>
                    </div>
                    {/* Office: is it ordered? and notes (Pablo, 2026-11-20) */}
                    {d.missing.ordered != null && (
                      <div className={`inline-block px-2 py-0.5 rounded-full font-bold ${d.missing.ordered ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                        {d.missing.ordered ? '📦 Ya está pedido' : '⏳ Sin pedir todavía'}
                      </div>
                    )}
                    {!!d.missing.notes?.length && (
                      <ul className="space-y-1">
                        {d.missing.notes.map((n, k) => (
                          <li key={k} className="bg-white border border-rose-200 rounded-lg px-2 py-1.5 text-slate-800">
                            {n.text}
                            <span className="text-slate-400"> · {new Date(n.at).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}{n.by ? ` · ${n.by.split('@')[0]}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {canEdit && (
                      <div className="space-y-1.5">
                        <div className="flex gap-1.5">
                          <button onClick={() => onMissingNote(d, { ordered: true })} className={`flex-1 py-1.5 rounded-lg font-semibold cursor-pointer border ${d.missing.ordered === true ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-800 border-blue-200'}`}>📦 Pedido</button>
                          <button onClick={() => onMissingNote(d, { ordered: false })} className={`flex-1 py-1.5 rounded-lg font-semibold cursor-pointer border ${d.missing.ordered === false ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-800 border-amber-200'}`}>⏳ Sin pedir</button>
                        </div>
                        <form
                          className="flex gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const t = (noteDraft[d.id] || '').trim();
                            if (!t) return;
                            onMissingNote(d, { note: t });
                            setNoteDraft((p) => ({ ...p, [d.id]: '' }));
                          }}
                        >
                          <input
                            value={noteDraft[d.id] || ''}
                            onChange={(e) => setNoteDraft((p) => ({ ...p, [d.id]: e.target.value }))}
                            placeholder="Anotación (ej. pedido a Bodytone, llega el martes)"
                            className="flex-1 bg-white border border-rose-200 rounded-lg px-2 py-1.5 text-slate-800"
                          />
                          <button type="submit" className="px-2.5 py-1.5 bg-slate-800 text-white rounded-lg font-semibold cursor-pointer">Añadir</button>
                        </form>
                      </div>
                    )}
                    {canMarkReady && (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => { setMissingText(d.missing?.items || ''); setMissingFor(d.id); }} className="px-2.5 py-1.5 bg-white border border-rose-300 text-rose-800 rounded-lg font-semibold cursor-pointer">Cambiar</button>
                        <button onClick={() => onMarkMissing(d, null)} className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold cursor-pointer">Ya está completo</button>
                      </div>
                    )}
                  </div>
                ) : (
                  status !== 'entregada' && canMarkReady && !d.checklist?.items?.length && (
                    <button onClick={() => { setMissingText(''); setMissingFor(d.id); }} className="w-full py-2 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg font-bold text-xs cursor-pointer">⚠️ Falta material</button>
                  )
                )}

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
                    canMarkReady && !d.checklist?.items?.length && (
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
                    {status === 'planificada' && <strong>Asignada:</strong>}
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
            </section>
          ))}
        </div>
      )}

      {editing && (
        <DeliveryForm
          initial={editing === 'new' ? null : editing}
          customers={savedCustomers(deliveries)}
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
