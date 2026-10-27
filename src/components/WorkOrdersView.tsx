import React, { useMemo, useState } from 'react';
import { FileSignature, Search, Download, Printer, Send, Loader2, Pencil, Plus, X } from 'lucide-react';
import { CompanyInfo, ServiceJob, Technician } from '../types';
import { teamIds } from '../utils/teams';
import { downloadWorkOrderPdf, printWorkOrder, sendWorkOrderToCustomer } from '../utils/workOrder';

interface WorkOrdersViewProps {
  services: ServiceJob[]; // stored records (one per job, team jobs included once)
  technicians: Technician[];
  company: CompanyInfo;
  onlyTechnicianId?: string; // a technician sees their own
  teamNamesFor: (job: ServiceJob) => string;
  onOpen: (job: ServiceJob) => void;
  onScheduleReturn?: (job: ServiceJob) => void; // office: put the return visit back into Servicios
  onNewService?: () => void; // office: create a service and fill its parte straight away
  showToast: (msg: string) => void;
}

const formatDayLong = (date: string) => {
  const text = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const formatDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Every closed work order, newest first, with its signed PDF. */
export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  services,
  technicians,
  company,
  onlyTechnicianId,
  teamNamesFor,
  onOpen,
  onScheduleReturn,
  onNewService,
  showToast,
}) => {
  const [picking, setPicking] = useState(false);
  const [pickSearch, setPickSearch] = useState('');
  const [search, setSearch] = useState('');
  const [techFilter, setTechFilter] = useState(onlyTechnicianId || 'all');
  const [outcomeFilter, setOutcomeFilter] = useState<'resuelto' | 'volver'>(() =>
    services.some((s) => s.status === 'completado' && s.inSituReport?.outcome === 'volver' && (!onlyTechnicianId || teamIds(s).includes(onlyTechnicianId)))
      ? 'volver'
      : 'resuelto'
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services
      .filter((s) => s.kind !== 'nave' && s.status === 'completado' && s.inSituReport?.outcome)
      .filter((s) => techFilter === 'all' || teamIds(s).includes(techFilter))
      .filter(
        (s) =>
          !q ||
          [s.code, s.customerName, s.title, s.location.address, s.inSituReport?.technicalNotes]
            .filter(Boolean)
            .some((t) => t!.toLowerCase().includes(q))
      )
      .sort((a, b) => b.date.localeCompare(a.date) || (b.inSituReport?.completedAt || '').localeCompare(a.inSituReport?.completedAt || ''));
  }, [services, search, techFilter]);
  const counts = {
    resuelto: matching.filter((s) => s.inSituReport?.outcome === 'resuelto').length,
    volver: matching.filter((s) => s.inSituReport?.outcome === 'volver').length,
  };
  const orders = matching.filter((s) => s.inSituReport?.outcome === outcomeFilter);
  // One block per day, newest day first
  const byDay = useMemo(() => {
    const groups = new Map<string, ServiceJob[]>();
    orders.forEach((job) => groups.set(job.date, [...(groups.get(job.date) || []), job]));
    return Array.from(groups.entries());
  }, [orders]);

  // Services still without a closed parte, nearest to today first
  const openJobs = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const dist = (d: string) => Math.abs(new Date(`${d}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime());
    return services
      .filter((s) => s.kind !== 'nave' && s.status !== 'completado')
      .filter((s) => !onlyTechnicianId || teamIds(s).includes(onlyTechnicianId))
      .filter(
        (s) =>
          !q ||
          [s.code, s.customerName, s.title, s.location.address].filter(Boolean).some((t) => t!.toLowerCase().includes(q))
      )
      .sort((a, b) => dist(a.date) - dist(b.date) || a.date.localeCompare(b.date))
      .slice(0, 40);
  }, [services, pickSearch, onlyTechnicianId]);

  const download = async (job: ServiceJob) => {
    setBusyId(job.id);
    try {
      await downloadWorkOrderPdf(job, teamNamesFor(job), company);
    } catch {
      showToast('No se pudo crear el PDF; prueba con Imprimir');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {picking && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setPicking(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Nuevo parte de trabajo</h3>
              <button onClick={() => setPicking(false)} className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 border-b border-slate-100">
              <p className="text-xs text-slate-500">Elige el servicio al que corresponde el parte.</p>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={pickSearch}
                  onChange={(e) => setPickSearch(e.target.value)}
                  placeholder="Buscar cliente, código, trabajo..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              {onNewService && (
                <button
                  onClick={() => {
                    setPicking(false);
                    onNewService();
                  }}
                  className="w-full py-2 border border-dashed border-blue-400 text-blue-700 rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-50"
                >
                  + No está en la lista: crear servicio nuevo
                </button>
              )}
            </div>
            <div className="overflow-y-auto p-2">
              {openJobs.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">No hay servicios sin parte.</div>
              ) : (
                openJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => {
                      setPicking(false);
                      onOpen(job);
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer text-xs"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-mono font-bold text-slate-500">{job.code}</span>
                      <span className="capitalize text-slate-500">{formatDay(job.date)}</span>
                    </div>
                    <div className="font-bold text-sm text-slate-900">{job.customerName}</div>
                    <div className="text-slate-600">{job.title} · {teamNamesFor(job) || 'sin técnico'}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-slate-800">Partes de trabajo</h2>
          <span className="text-xs text-slate-500">{orders.length} {outcomeFilter === 'volver' ? 'por volver' : 'resueltos'}</span>
          <button
            onClick={() => setPicking(true)}
            className="ml-auto flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nuevo parte
          </button>
        </div>
        {/* Resolved work orders apart from the ones where they have to go back */}
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          {([['volver', '🔁 Hay que volver', 'bg-amber-500 text-white', 'bg-amber-50 text-amber-900 border border-amber-200'], ['resuelto', '✓ Resueltos', 'bg-emerald-600 text-white', 'bg-emerald-50 text-emerald-900 border border-emerald-200']] as const).map(([key, label, on, off]) => (
            <button key={key} onClick={() => setOutcomeFilter(key)} className={`py-2.5 rounded-xl cursor-pointer ${outcomeFilter === key ? on : off}`}>
              {label} ({counts[key]})
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, código, trabajo..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          {!onlyTechnicianId && (
            <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
              <option value="all">Todos los técnicos</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
          {outcomeFilter === 'volver' ? 'No hay partes pendientes de volver.' : 'Todavía no hay partes resueltos. Cuando el técnico cierra un parte, aparece aquí.'}
        </div>
      ) : (
        <div className="space-y-5">
          {byDay.map(([day, jobs]) => (
            <section key={day}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <span>{formatDayLong(day)}</span>
                <span className="text-xs font-semibold text-slate-400">· {jobs.length} {jobs.length === 1 ? 'parte' : 'partes'}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {jobs.map((job) => {
            const r = job.inSituReport!;
            return (
              <div key={job.id} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs text-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onOpen(job)} className="text-left cursor-pointer">
                    <div className="font-mono font-bold text-slate-500">{job.code}</div>
                    <div className="font-bold text-sm text-slate-900">{job.customerName}</div>
                    <div className="text-slate-600">{job.title}</div>
                  </button>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full font-bold ${
                      r.outcome === 'resuelto' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {r.outcome === 'resuelto' ? 'Resuelto' : 'Hay que volver'}
                  </span>
                </div>
                {r.outcome === 'volver' && (() => {
                  const ret = services.find((s) => s.id !== job.id && s.code === (/-V\d*$/.test(job.code) ? job.code : `${job.code}-V`) && s.date >= job.date);
                  return (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 space-y-2 text-amber-950">
                      <div><span className="font-bold">🔁 Hay que volver:</span> {r.returnReason || 'sin motivo indicado'}</div>
                      {ret ? (
                        <div className="font-semibold text-emerald-800">
                          ✓ Vuelta programada el <span className="capitalize">{formatDay(ret.date)}</span>
                          {ret.timeSlot.type !== 'cualquiera' ? ` a las ${ret.timeSlot.startHour}` : ''}
                        </div>
                      ) : (
                        onScheduleReturn && (
                          <button onClick={() => onScheduleReturn(job)} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold cursor-pointer">
                            📅 Reubicar en Servicios
                          </button>
                        )
                      )}
                    </div>
                  );
                })()}
                <div className="text-slate-500">
                  <span className="capitalize">{formatDay(job.date)}</span>
                  {r.startedAt && ` · ${r.startedAt}–${r.completedAt || ''}`} · {teamNamesFor(job)}
                </div>
                <div className="flex items-center gap-2">
                  {r.customerSignature && <img src={r.customerSignature} alt="Firma" className="h-10 border border-slate-200 rounded bg-white" />}
                  {r.customerSignature ? (
                    <span className="text-slate-500">{r.customerSignatureName ? `Firmado por ${r.customerSignatureName}` : 'Firmado'}</span>
                  ) : r.signaturePending ? (
                    <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold">⏳ Pendiente de la firma del cliente</span>
                  ) : (
                    <span className="text-slate-500">Sin firma</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => onOpen(job)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-white rounded-lg font-semibold cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => download(job)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg font-semibold cursor-pointer"
                  >
                    {busyId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                  </button>
                  <button
                    onClick={() => printWorkOrder(job, teamNamesFor(job), company)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </button>
                  {job.customerPhone && (
                    <button
                      onClick={() => sendWorkOrderToCustomer(job, teamNamesFor(job), company)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar al cliente
                    </button>
                  )}
                </div>
              </div>
            );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
