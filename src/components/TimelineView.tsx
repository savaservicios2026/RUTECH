import React, { useMemo } from 'react';
import { 
  Technician, 
  ServiceJob, 
  TechnicianRouteSummary,
  PriorityType 
} from '../types';
import { timeStringToMinutes, minutesToTimeString, formatDuration } from '../utils/geo';
import { LunchStop, lunchSlot } from './LunchEditor';
import { 
  Clock, 
  AlertTriangle, 
  Car, 
  Coffee, 
  CheckCircle, 
  UserX, 
  Calendar, 
  Wrench,
  AlertCircle
} from 'lucide-react';

interface TimelineViewProps {
  technicians: Technician[];
  services: ServiceJob[];
  summaries: Map<string, TechnicianRouteSummary>;
  selectedDate: string;
  onSelectJob: (job: ServiceJob) => void;
  onAssignJobToTech: (jobId: string, techId: string) => void;
  onToggleAvailability: (techId: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  technicians,
  services,
  summaries,
  selectedDate,
  onSelectJob,
  onAssignJobToTech,
  onToggleAvailability,
}) => {
  // Timeline scale constants: 08:00 (480 mins) to 19:00 (1140 mins) -> 660 total minutes
  const TIMELINE_START = 8 * 60; // 08:00
  const TIMELINE_END = 19 * 60;   // 19:00
  const TOTAL_SPAN = TIMELINE_END - TIMELINE_START; // 660 mins

  // Time markers every 60 minutes
  const hourMarkers = useMemo(() => {
    const hours = [];
    for (let m = TIMELINE_START; m <= TIMELINE_END; m += 60) {
      hours.push(minutesToTimeString(m));
    }
    return hours;
  }, [TIMELINE_START, TIMELINE_END]);

  // Unassigned jobs pool
  const unassignedJobs = services.filter(s => !s.assignedTechnicianId);

  // Helper to calculate left % and width % for a given time span
  const getPositionPercent = (startStr?: string, endStr?: string) => {
    if (!startStr || !endStr) return { left: 0, width: 0, visible: false };

    const startMin = timeStringToMinutes(startStr);
    const endMin = timeStringToMinutes(endStr);

    const clampedStart = Math.max(TIMELINE_START, Math.min(TIMELINE_END, startMin));
    const clampedEnd = Math.max(TIMELINE_START, Math.min(TIMELINE_END, endMin));

    const left = ((clampedStart - TIMELINE_START) / TOTAL_SPAN) * 100;
    const width = Math.max(1.5, ((clampedEnd - clampedStart) / TOTAL_SPAN) * 100);

    return {
      left: `${left}%`,
      width: `${width}%`,
      visible: endMin >= TIMELINE_START && startMin <= TIMELINE_END,
    };
  };

  return (
    <div className="space-y-6">
      {/* Phones: each technician's day as a simple list of stops */}
      <div className="md:hidden space-y-3">
        {technicians.map((tech) => {
          const summary = summaries.get(tech.id);
          const isAvailable = tech.availability.isAvailableToday;
          const techJobs = services
            .filter((s) => s.assignedTechnicianId === tech.id)
            .sort((a, b) => (a.scheduledArrival || '99').localeCompare(b.scheduledArrival || '99') || a.manualOrder - b.manualOrder);
          return (
            <div key={tech.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="flex items-center gap-2.5 p-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: tech.color }}>
                  {tech.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-slate-800 truncate">{tech.name}</div>
                  <div className="text-xs text-slate-500">
                    {techJobs.length} servicios · {summary?.totalDistanceKm || 0} km
                    {summary?.lunch && <> · 🍽️ {summary.lunch.start}</>}
                  </div>
                </div>
                <button
                  onClick={() => onToggleAvailability(tech.id)}
                  className={`px-2.5 py-1.5 rounded-full font-semibold text-[11px] border ${
                    isAvailable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {isAvailable ? '✓ Disponible' : '✕ No disponible'}
                </button>
              </div>
              {isAvailable && techJobs.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {summary?.lunch && lunchSlot(techJobs, summary.lunch) === 0 && <LunchStop lunch={summary.lunch} className="m-2" />}
                  {techJobs.map((job, i) => (<React.Fragment key={job.id}>
                    <button onClick={() => onSelectJob(job)} className="w-full text-left flex gap-3 p-3 active:bg-slate-50">
                      <div className="w-14 shrink-0 font-mono text-xs font-bold text-slate-700 leading-5">
                        {job.scheduledArrival || '--:--'}
                        <div className="font-normal text-slate-400">{job.scheduledDeparture}</div>
                      </div>
                      <div className="min-w-0 flex-1 border-l-4 pl-2.5 rounded-sm" style={{ borderColor: job.conflict ? '#EF4444' : tech.color }}>
                        <div className="font-semibold text-sm text-slate-800 truncate">{job.customerName}</div>
                        <div className="text-xs text-slate-500 truncate">{job.title}</div>
                        <div className="text-[11px] text-slate-400 truncate">📍 {job.location.address.split(',').slice(0, 2).join(',')}</div>
                        {job.conflict && (
                          <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />{job.conflict.message}
                          </div>
                        )}
                      </div>
                    </button>
                    {summary?.lunch && lunchSlot(techJobs, summary.lunch) === i + 1 && <LunchStop lunch={summary.lunch} className="m-2" />}
                    </React.Fragment>
                  ))}
                </div>
              )}
              {isAvailable && techJobs.length === 0 && <div className="p-3 text-xs text-slate-400">Sin servicios este día.</div>}
            </div>
          );
        })}
      </div>

      {/* Timeline Card */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Timeline Header Info */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Cronograma Diario de Asistencia Técnica
            </h2>
            <p className="text-xs text-slate-500">
              Visualiza en tiempo real los turnos de trabajo, descansos, desplazamientos y servicios programados.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-500/80 inline-block"></span>
              <span>Servicio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-300 inline-block"></span>
              <span>Viaje</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block"></span>
              <span>Descanso</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span>
              <span>Conflicto</span>
            </div>
          </div>
        </div>

        {/* Scrollable Gantt Chart Container */}
        <div className="overflow-x-auto"><div className="min-w-[850px]">
          {/* Time Ruler Bar */}
          <div className="flex border-b border-slate-200 bg-slate-100/70 text-[11px] font-mono text-slate-600 select-none">
            {/* Technician Info Column Width */}
            <div className="w-64 shrink-0 p-2.5 font-bold border-r border-slate-200 text-slate-700">
              Técnico & Zona
            </div>

            {/* Time Grid Header */}
            <div className="flex-1 relative h-9">
              {hourMarkers.map((time, idx) => {
                const percent = ((timeStringToMinutes(time) - TIMELINE_START) / TOTAL_SPAN) * 100;
                return (
                  <div
                    key={time}
                    className="absolute top-0 bottom-0 flex flex-col justify-between border-l border-slate-300 pl-1 py-1"
                    style={{ left: `${percent}%` }}
                  >
                    <span className="font-semibold text-slate-600">{time}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technician Rows */}
          <div className="divide-y divide-slate-100">
            {technicians.map((tech) => {
              const summary = summaries.get(tech.id);
              const isAvailable = tech.availability.isAvailableToday;
              const techJobs = services
                .filter(s => s.assignedTechnicianId === tech.id)
                .sort((a, b) => a.manualOrder - b.manualOrder);

              const shiftPos = getPositionPercent(tech.schedule.start, tech.schedule.end);
              // The lunch chosen for the day, where it falls in the route; otherwise the usual one
              const lunchTimes = summary?.lunch || (tech.schedule.lunchStart && tech.schedule.lunchEnd ? { start: tech.schedule.lunchStart, end: tech.schedule.lunchEnd } : null);
              const lunchPos = lunchTimes ? getPositionPercent(lunchTimes.start, lunchTimes.end) : null;

              return (
                <div key={tech.id} className="flex hover:bg-slate-50/50 transition-colors">
                  {/* Left Column: Tech Info & Toggle */}
                  <div className="w-64 shrink-0 p-3 border-r border-slate-200 flex flex-col justify-between bg-white">
                    <div className="flex items-start gap-2.5">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                        style={{ backgroundColor: tech.color }}
                      >
                        {tech.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-800 truncate flex items-center gap-1">
                          {tech.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          Salida: <strong className="text-slate-700">{tech.baseLocation.address.split(',')[0]}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tech.schedule.start} - {tech.schedule.end}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <button
                        onClick={() => onToggleAvailability(tech.id)}
                        className={`px-2 py-0.5 rounded-full font-medium text-[10px] cursor-pointer transition-colors ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                        title="Cambiar estado de disponibilidad hoy"
                      >
                        {isAvailable ? '✓ Disponible' : '✕ No disponible'}
                      </button>

                      <span className="text-slate-500 font-mono text-[10px]">
                        {techJobs.length} serv. | {summary?.totalDistanceKm || 0} km
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Visual Timeline Grid */}
                  <div className="flex-1 relative min-h-[76px] bg-slate-50/30 overflow-hidden">
                    {/* Hour Vertical Grid Lines */}
                    {hourMarkers.map((time) => {
                      const percent = ((timeStringToMinutes(time) - TIMELINE_START) / TOTAL_SPAN) * 100;
                      return (
                        <div
                          key={time}
                          className="absolute top-0 bottom-0 border-l border-slate-200/80 pointer-events-none"
                          style={{ left: `${percent}%` }}
                        />
                      );
                    })}

                    {/* Non-working hours background overlay */}
                    {shiftPos.visible && (
                      <div
                        className="absolute top-0 bottom-0 bg-blue-50/20 border-x border-blue-200/40 pointer-events-none"
                        style={{ left: shiftPos.left, width: shiftPos.width }}
                      />
                    )}

                    {/* Lunch Break Block */}
                    {lunchPos && lunchPos.visible && isAvailable && (
                      <div
                        className="absolute top-2 bottom-2 bg-amber-50/90 border border-amber-200 rounded-md z-10 flex items-center justify-center text-amber-800 text-[10px] font-medium shadow-xs"
                        style={{ left: lunchPos.left, width: lunchPos.width }}
                        title={`Comida (${lunchTimes?.start} - ${lunchTimes?.end})`}
                      >
                        <Coffee className="w-3 h-3 mr-1 text-amber-600" />
                        <span className="hidden md:inline">Almuerzo</span>
                      </div>
                    )}

                    {/* If unavailable, show diagonal stripe overlay */}
                    {!isAvailable && (
                      <div className="absolute inset-0 bg-slate-100/90 flex items-center justify-center z-20 text-slate-500 text-xs font-medium">
                        <UserX className="w-4 h-4 mr-1.5 text-slate-400" />
                        <span>Técnico no disponible en esta fecha</span>
                      </div>
                    )}

                    {/* Service Blocks and Travel Blocks */}
                    {isAvailable &&
                      techJobs.map((job, idx) => {
                        const jobPos = getPositionPercent(job.scheduledArrival, job.scheduledDeparture);
                        if (!jobPos.visible) return null;

                        const hasConflict = !!job.conflict;

                        return (
                          <div
                            key={job.id}
                            onClick={() => onSelectJob(job)}
                            style={{
                              left: jobPos.left,
                              width: jobPos.width,
                              backgroundColor: hasConflict ? '#FEE2E2' : tech.color,
                              borderColor: hasConflict ? '#EF4444' : '#ffffff',
                            }}
                            className={`absolute top-2.5 bottom-2.5 rounded-lg border-2 shadow-sm p-1.5 z-20 cursor-pointer transition-transform hover:scale-[1.02] hover:z-30 overflow-hidden flex flex-col justify-between ${
                              hasConflict ? 'text-rose-900 border-rose-500' : 'text-white'
                            }`}
                            title={`${job.customerName} (${job.title})\nLlegada: ${job.scheduledArrival} - Salida: ${job.scheduledDeparture}\nFranja: ${job.timeSlot.label}${
                              hasConflict ? `\nALERTA: ${job.conflict?.message}` : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 leading-none">
                              <span className="font-bold text-[10px] truncate">
                                #{idx + 1} {job.customerName}
                              </span>
                              {hasConflict && (
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0 animate-bounce" />
                              )}
                            </div>

                            <div className="text-[9px] opacity-90 truncate font-mono">
                              {job.scheduledArrival} - {job.scheduledDeparture}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </div></div>
      </div>

      {/* Unassigned Jobs Alert Drawer */}
      {unassignedJobs.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse" />
              <h3 className="text-sm font-bold text-amber-900">
                Servicios Pendientes de Asignar ({unassignedJobs.length})
              </h3>
            </div>
            <span className="text-xs text-amber-700">
              Selecciona un técnico para asignarlo manualmente o pulsa "Optimizar Rutas"
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white p-3 rounded-lg border border-amber-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-slate-500">{job.code}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      {job.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-800">{job.customerName}</div>
                  <div className="text-[11px] text-slate-600 truncate">{job.title}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    📍 {job.location.address.split(',')[0]} ({job.timeSlot.label})
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {job.requiredSkills.map(s => (
                      <span key={s} className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Asignar a:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        onAssignJobToTech(job.id, e.target.value);
                      }
                    }}
                    defaultValue=""
                    className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="" disabled>Elegir técnico...</option>
                    {technicians
                      .filter(t => t.availability.isAvailableToday)
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
