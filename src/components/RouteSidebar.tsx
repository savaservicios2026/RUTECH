import React from 'react';
import { 
  Technician, 
  ServiceJob, 
  TechnicianRouteSummary,
  PriorityType 
} from '../types';
import { 
  ArrowUp, 
  ArrowDown, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  UserCheck, 
  MoveRight, 
  Wrench, 
  Zap, 
  ChevronRight,
  Phone,
  RotateCcw
} from 'lucide-react';
import { formatDuration } from '../utils/geo';

interface RouteSidebarProps {
  technicians: Technician[];
  services: ServiceJob[];
  summaries: Map<string, TechnicianRouteSummary>;
  selectedTechnicianId: string;
  onSelectTechnician: (id: string) => void;
  onMoveStop: (serviceId: string, direction: 'up' | 'down') => void;
  onReassignJob: (serviceId: string, targetTechId: string | null) => void;
  onOptimizeSingleTech: (techId: string) => void;
  onSelectJob: (job: ServiceJob) => void;
}

export const RouteSidebar: React.FC<RouteSidebarProps> = ({
  technicians,
  services,
  summaries,
  selectedTechnicianId,
  onSelectTechnician,
  onMoveStop,
  onReassignJob,
  onOptimizeSingleTech,
  onSelectJob,
}) => {
  const currentTech = technicians.find(t => t.id === selectedTechnicianId) || technicians[0];
  const summary = currentTech ? summaries.get(currentTech.id) : null;
  const techJobs = services
    .filter(s => s.assignedTechnicianId === currentTech?.id)
    .sort((a, b) => a.manualOrder - b.manualOrder);

  const getPriorityBadge = (priority: PriorityType) => {
    switch (priority) {
      case 'urgente':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-700 border border-rose-300">Urgente</span>;
      case 'alta':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-700 border border-amber-300">Alta</span>;
      case 'media':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-700 border border-blue-200">Media</span>;
      case 'baja':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">Baja</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Technician Selector Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Técnico en ruta
        </label>
        <div className="flex items-center gap-2">
          <select
            value={currentTech?.id}
            onChange={(e) => onSelectTechnician(e.target.value)}
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {technicians.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.baseLocation.zone}) {!t.availability.isAvailableToday ? '— [No disponible hoy]' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => onOptimizeSingleTech(currentTech.id)}
            className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
            title="Optimizar el orden de paradas de este técnico"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Reordenar</span>
          </button>
        </div>

        {/* Technician summary badges */}
        {currentTech && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
              <div>
                <div className="text-[11px] text-slate-400">Jornada</div>
                <div className="font-semibold text-slate-800">{currentTech.schedule.start} - {currentTech.schedule.end}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Base / Zona</div>
                <div className="font-semibold text-slate-800">{currentTech.baseLocation.zone}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Paradas</div>
                <div className="font-semibold text-blue-600">{techJobs.length} servicios</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Distancia Est.</div>
                <div className="font-semibold text-slate-800">{summary?.totalDistanceKm || 0} km</div>
              </div>
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100/90 rounded-lg text-[11px] border border-slate-200">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <span>{currentTech.vehicle.includes('Eléctrica') ? '⚡' : currentTech.vehicle.includes('Movano') ? '🚚' : '🚐'}</span>
                <span>Furgoneta asignada:</span>
              </span>
              <span className="font-bold text-slate-800">{currentTech.vehicle}</span>
            </div>
          </div>
        )}
      </div>

      {/* Route Stops List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Depot / Base Start */}
        {currentTech && (
          <div className="relative pl-7 pb-2">
            <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs shadow-sm">
              🏠
            </div>
            <div className="absolute left-2.5 top-6 bottom-0 w-0.5 bg-slate-300"></div>

            <div className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Salida de Base</span>
                <span className="font-mono text-slate-500 font-semibold">{currentTech.schedule.start}</span>
              </div>
              <div className="text-[11px] text-slate-500 truncate">{currentTech.baseLocation.address}</div>
            </div>
          </div>
        )}

        {/* Service Stops */}
        {techJobs.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Sin servicios asignados</p>
            <p className="text-xs text-slate-400 mt-1">
              Haz clic en "Optimizar Rutas" o asigna servicios manualmente desde la pestaña de Servicios.
            </p>
          </div>
        ) : (
          techJobs.map((job, index) => {
            const hasConflict = !!job.conflict;
            const isFirst = index === 0;
            const isLast = index === techJobs.length - 1;

            return (
              <div key={job.id} className="relative pl-7 group">
                {/* Connector line */}
                {!isLast && (
                  <div className="absolute left-2.5 top-6 bottom-[-14px] w-0.5 bg-slate-200 group-hover:bg-blue-300 transition-colors"></div>
                )}

                {/* Stop Number Pin */}
                <div 
                  style={{ backgroundColor: currentTech.color }}
                  className="absolute left-0 top-1 w-5 h-5 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm"
                >
                  {index + 1}
                </div>

                {/* Travel time pill from previous stop */}
                {job.travelTimeFromPrev !== undefined && job.travelTimeFromPrev > 0 && (
                  <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1 font-mono">
                    <MoveRight className="w-3 h-3 text-slate-400" />
                    <span>{job.travelTimeFromPrev} min viaje ({job.distanceKmFromPrev} km)</span>
                  </div>
                )}

                {/* Stop Card */}
                <div className={`p-3 rounded-xl border transition-all ${
                  hasConflict 
                    ? 'border-rose-300 bg-rose-50/50 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                }`}>
                  {/* Top line: Time & Priority */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-blue-700">
                        {job.scheduledArrival || '--:--'} - {job.scheduledDeparture || '--:--'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">({job.estimatedDuration}m)</span>
                    </div>
                    <div>{getPriorityBadge(job.priority)}</div>
                  </div>

                  {/* Customer & Title */}
                  <div 
                    onClick={() => onSelectJob(job)}
                    className="cursor-pointer group/title"
                  >
                    <div className="font-semibold text-xs text-slate-800 group-hover/title:text-blue-600 transition-colors">
                      {job.customerName}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">{job.title}</div>
                  </div>

                  {/* Address */}
                  <div className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">{job.location.address}</span>
                  </div>

                  {/* Skills badges */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {job.requiredSkills.map(s => (
                      <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Conflict alert box */}
                  {hasConflict && (
                    <div className="mt-2 p-1.5 rounded-lg bg-rose-100/70 border border-rose-300 text-rose-800 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{job.conflict?.message}</span>
                    </div>
                  )}

                  {/* Manual Action Controls Bar */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onMoveStop(job.id, 'up')}
                        disabled={isFirst}
                        className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                          isFirst ? 'opacity-30 cursor-not-allowed' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Adelantar orden de parada"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveStop(job.id, 'down')}
                        disabled={isLast}
                        className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                          isLast ? 'opacity-30 cursor-not-allowed' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Retrasar orden de parada"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Reassign dropdown */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={job.assignedTechnicianId || ''}
                        onChange={(e) => onReassignJob(job.id, e.target.value === '' ? null : e.target.value)}
                        className="text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 cursor-pointer hover:border-slate-300"
                        title="Reasignar a otro técnico"
                      >
                        <option value="">Desasignar</option>
                        {technicians.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name.split(' ')[0]} ({t.baseLocation.zone})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Return to Base */}
      {currentTech && summary && techJobs.length > 0 && (
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Fin estimado: <strong>{summary.estimatedEndTime}</strong></span>
          </div>
          <div className="text-[11px] text-slate-500">
            Límite turno: <strong>{currentTech.schedule.end}</strong>
          </div>
        </div>
      )}
    </div>
  );
};
