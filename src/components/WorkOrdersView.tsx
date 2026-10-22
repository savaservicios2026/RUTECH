import React, { useMemo, useState } from 'react';
import { FileSignature, Search, Download, Printer, Send, Loader2 } from 'lucide-react';
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
  showToast: (msg: string) => void;
}

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
  showToast,
}) => {
  const [search, setSearch] = useState('');
  const [techFilter, setTechFilter] = useState(onlyTechnicianId || 'all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'resuelto' | 'volver'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const orders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services
      .filter((s) => s.kind !== 'nave' && s.status === 'completado' && s.inSituReport?.outcome)
      .filter((s) => techFilter === 'all' || teamIds(s).includes(techFilter))
      .filter((s) => outcomeFilter === 'all' || s.inSituReport?.outcome === outcomeFilter)
      .filter(
        (s) =>
          !q ||
          [s.code, s.customerName, s.title, s.location.address, s.inSituReport?.technicalNotes]
            .filter(Boolean)
            .some((t) => t!.toLowerCase().includes(q))
      )
      .sort((a, b) => b.date.localeCompare(a.date) || (b.inSituReport?.completedAt || '').localeCompare(a.inSituReport?.completedAt || ''));
  }, [services, search, techFilter, outcomeFilter]);

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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-slate-800">Partes de trabajo</h2>
          <span className="text-xs text-slate-500">{orders.length} firmados</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
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
          <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
            <option value="all">Todos</option>
            <option value="resuelto">Resueltos</option>
            <option value="volver">Hay que volver</option>
          </select>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
          Todavía no hay partes cerrados. Cuando el técnico cierra un parte con la firma del cliente, aparece aquí.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {orders.map((job) => {
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
                  <span className="text-slate-500">{r.customerSignatureName ? `Firmado por ${r.customerSignatureName}` : 'Firmado'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
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
      )}
    </div>
  );
};
