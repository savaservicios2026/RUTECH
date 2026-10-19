import React, { useRef, useState } from 'react';
import { Technician, Van, VanMaintenance } from '../types';
import { Truck, Plus, Edit, Trash2, Wrench, CalendarClock, ShieldCheck, X, BatteryCharging, Gauge, User } from 'lucide-react';

interface VansViewProps {
  vans: Van[];
  technicians: Technician[];
  canEdit: boolean;
  onSaveVan: (van: Van) => void;
  onDeleteVan: (vanId: string) => void;
}

// Days from today to a YYYY-MM-DD date (negative when it has passed)
export function daysUntil(date?: string): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// Warn this many km before the next service is due
const KM_WARNING = 1000;

/** Km left until the next service, or null when the current km or the target is missing. */
export function kmUntilMaintenance(van: Van): number | null {
  if (van.nextMaintenanceKm == null || van.km == null) return null;
  return van.nextMaintenanceKm - van.km;
}

/** Vans whose ITV is due within 30 days or whose service is due within 1,000 km (or overdue). */
export function countVanWarnings(vans: Van[]): number {
  return vans.filter((v) => {
    const days = daysUntil(v.nextItv);
    const km = kmUntilMaintenance(v);
    return (days !== null && days <= 30) || (km !== null && km <= KM_WARNING);
  }).length;
}

const formatDate = (date?: string) =>
  date ? new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const DueBadge: React.FC<{ label: string; date?: string }> = ({ label, date }) => {
  const days = daysUntil(date);
  let tone = 'bg-slate-100 text-slate-500 border-slate-200';
  let note = 'Sin fecha';
  if (days !== null) {
    if (days < 0) {
      tone = 'bg-rose-50 text-rose-700 border-rose-200';
      note = `Vencida hace ${-days} días`;
    } else if (days <= 30) {
      tone = 'bg-amber-50 text-amber-700 border-amber-200';
      note = days === 0 ? 'Hoy' : `En ${days} días`;
    } else {
      tone = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      note = `En ${days} días`;
    }
  }
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-sm font-bold">{formatDate(date)}</div>
      <div className="text-[11px]">{note}</div>
    </div>
  );
};

const KmBadge: React.FC<{ van: Van }> = ({ van }) => {
  const left = kmUntilMaintenance(van);
  let tone = 'bg-slate-100 text-slate-500 border-slate-200';
  let note = van.nextMaintenanceKm == null ? 'Sin indicar' : 'Falta km actual';
  if (left !== null) {
    if (left <= 0) {
      tone = 'bg-rose-50 text-rose-700 border-rose-200';
      note = `Pasado ${(-left).toLocaleString('es-ES')} km`;
    } else if (left <= KM_WARNING) {
      tone = 'bg-amber-50 text-amber-700 border-amber-200';
      note = `Faltan ${left.toLocaleString('es-ES')} km`;
    } else {
      tone = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      note = `Faltan ${left.toLocaleString('es-ES')} km`;
    }
  }
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">Próx. mantenimiento</div>
      <div className="text-sm font-bold">{van.nextMaintenanceKm != null ? `${van.nextMaintenanceKm.toLocaleString('es-ES')} km` : '—'}</div>
      <div className="text-[11px]">{note}</div>
    </div>
  );
};

const emptyVan = (): Van => ({
  id: `van-${Date.now().toString(36)}`,
  model: '',
  plate: '',
  driverTechnicianId: null,
  isElectric: false,
  maintenances: [],
});

export const VansView: React.FC<VansViewProps> = ({ vans, technicians, canEdit, onSaveVan, onDeleteVan }) => {
  const [editing, setEditing] = useState<Van | null>(null);
  const [addingMaintenanceTo, setAddingMaintenanceTo] = useState<string | null>(null);
  const [maintenance, setMaintenance] = useState<VanMaintenance>({ id: '', date: '', description: '' });
  const deleteArmedRef = useRef<{ id: string; until: number } | null>(null);
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);

  const sortedVans = [...vans].sort((a, b) => a.plate.localeCompare(b.plate));

  const handleDelete = (vanId: string) => {
    const armed = deleteArmedRef.current;
    if (armed && armed.id === vanId && Date.now() < armed.until) {
      deleteArmedRef.current = null;
      setDeleteArmedId(null);
      onDeleteVan(vanId);
      return;
    }
    deleteArmedRef.current = { id: vanId, until: Date.now() + 5000 };
    setDeleteArmedId(vanId);
    setTimeout(() => setDeleteArmedId((id) => (id === vanId ? null : id)), 5000);
  };

  const saveMaintenance = (van: Van) => {
    if (!maintenance.date || !maintenance.description.trim()) return;
    const entry: VanMaintenance = {
      id: `mnt-${Date.now().toString(36)}`,
      date: maintenance.date,
      description: maintenance.description.trim(),
      ...(maintenance.km ? { km: maintenance.km } : {}),
    };
    onSaveVan({
      ...van,
      maintenances: [...(van.maintenances || []), entry],
      ...(entry.km && (!van.km || entry.km > van.km) ? { km: entry.km } : {}),
    });
    setAddingMaintenanceTo(null);
    setMaintenance({ id: '', date: '', description: '' });
  };

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Furgonetas
          </h2>
          <p className="text-xs text-slate-500">Matrícula, mantenimientos e ITV de cada furgoneta. Avisa en ámbar a 30 días de la ITV o a 1.000 km del mantenimiento, y en rojo si ya ha vencido.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing(emptyVan())}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva furgoneta</span>
          </button>
        )}
      </div>

      {sortedVans.length === 0 && (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
          Todavía no hay furgonetas. {canEdit ? 'Pulsa "Nueva furgoneta" para añadir la primera.' : 'La oficina las dará de alta.'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedVans.map((van) => {
          const driver = technicians.find((t) => t.id === van.driverTechnicianId);
          const history = [...(van.maintenances || [])].sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={van.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="inline-block rounded-md border-2 border-slate-800 px-2 py-0.5 font-mono text-base font-bold tracking-widest text-slate-900">
                    {van.plate || 'SIN MATRÍCULA'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    {van.model || 'Modelo sin indicar'}
                    {van.isElectric && <BatteryCharging className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{driver ? driver.name : 'Sin conductor'}</span>
                    {van.km ? <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" />{van.km.toLocaleString('es-ES')} km</span> : null}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(van)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(van.id)}
                      className={`p-1.5 rounded-lg cursor-pointer ${deleteArmedId === van.id ? 'bg-rose-600 text-white' : 'hover:bg-rose-50 text-rose-500'}`}
                      title={deleteArmedId === van.id ? 'Pulsa otra vez para borrar' : 'Borrar'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <DueBadge label="Próxima ITV" date={van.nextItv} />
                <KmBadge van={van} />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1"><Wrench className="w-3.5 h-3.5" />Mantenimientos</h4>
                  {canEdit && addingMaintenanceTo !== van.id && (
                    <button
                      onClick={() => {
                        setAddingMaintenanceTo(van.id);
                        setMaintenance({ id: '', date: new Date().toISOString().split('T')[0], description: '' });
                      }}
                      className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                    >
                      + Añadir
                    </button>
                  )}
                </div>

                {addingMaintenanceTo === van.id && (
                  <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 border border-slate-200">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={maintenance.date} onChange={(e) => setMaintenance({ ...maintenance, date: e.target.value })} className={inputClass} />
                      <input type="number" inputMode="numeric" placeholder="Km" value={maintenance.km ?? ''} onChange={(e) => setMaintenance({ ...maintenance, km: e.target.value ? Number(e.target.value) : undefined })} className={inputClass} />
                    </div>
                    <input type="text" placeholder="Qué se hizo (ej. cambio de aceite y filtros)" value={maintenance.description} onChange={(e) => setMaintenance({ ...maintenance, description: e.target.value })} className={inputClass} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setAddingMaintenanceTo(null)} className="px-3 py-1.5 text-xs rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer">Cancelar</button>
                      <button onClick={() => saveMaintenance(van)} className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 cursor-pointer">Guardar</button>
                    </div>
                  </div>
                )}

                {history.length === 0 ? (
                  <p className="text-xs text-slate-400 mt-1">Sin mantenimientos registrados.</p>
                ) : (
                  <ul className="mt-1 divide-y divide-slate-100">
                    {history.map((m) => (
                      <li key={m.id} className="py-1.5 text-xs flex justify-between gap-2">
                        <span className="text-slate-700">
                          <span className="font-semibold">{formatDate(m.date)}</span> · {m.description}
                        </span>
                        {m.km ? <span className="text-slate-400 whitespace-nowrap">{m.km.toLocaleString('es-ES')} km</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {van.notes && <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">{van.notes}</p>}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              onSaveVan({ ...editing, plate: editing.plate.trim().toUpperCase(), model: editing.model.trim() });
              setEditing(null);
            }}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Truck className="w-5 h-5 text-blue-600" />{vans.some((v) => v.id === editing.id) ? 'Editar furgoneta' : 'Nueva furgoneta'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <label className="block text-xs font-semibold text-slate-600">Matrícula
              <input required value={editing.plate} onChange={(e) => setEditing({ ...editing, plate: e.target.value })} placeholder="1234 ABC" className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Modelo
              <input value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} placeholder="Renault Master L2H2" className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Conductor habitual
              <select value={editing.driverTechnicianId || ''} onChange={(e) => setEditing({ ...editing, driverTechnicianId: e.target.value || null })} className={inputClass}>
                <option value="">Sin conductor</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />Próxima ITV
                <input type="date" value={editing.nextItv || ''} onChange={(e) => setEditing({ ...editing, nextItv: e.target.value || undefined })} className={inputClass} />
              </label>
              <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Próx. mantenimiento (km)
                <input type="number" inputMode="numeric" placeholder="Ej. 120000" value={editing.nextMaintenanceKm ?? ''} onChange={(e) => setEditing({ ...editing, nextMaintenanceKm: e.target.value ? Number(e.target.value) : undefined })} className={inputClass} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="block text-xs font-semibold text-slate-600">Kilómetros actuales
                <input type="number" inputMode="numeric" value={editing.km ?? ''} onChange={(e) => setEditing({ ...editing, km: e.target.value ? Number(e.target.value) : undefined })} className={inputClass} />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 pb-2">
                <input type="checkbox" checked={Boolean(editing.isElectric)} onChange={(e) => setEditing({ ...editing, isElectric: e.target.checked })} />
                Eléctrica
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-600">Notas (equipamiento, seguro, etc.)
              <textarea rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value || undefined })} className={inputClass} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 cursor-pointer">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
