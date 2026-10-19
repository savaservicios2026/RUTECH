import React from 'react';
import { ServiceJob, Technician } from '../types';
import { 
  AlertTriangle, 
  Clock, 
  Zap, 
  X, 
  CheckCircle, 
  ArrowRight, 
  MapPin, 
  Award,
  AlertCircle
} from 'lucide-react';

interface ConflictsModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: ServiceJob[];
  technicians: Technician[];
  onAutoFixAll: () => void;
  onAssignJob: (serviceId: string, techId: string) => void;
  onSelectJob: (job: ServiceJob) => void;
}

export const ConflictsModal: React.FC<ConflictsModalProps> = ({
  isOpen,
  onClose,
  services,
  technicians,
  onAutoFixAll,
  onAssignJob,
  onSelectJob,
}) => {
  if (!isOpen) return null;

  // Unassigned jobs
  const unassignedJobs = services.filter(s => !s.assignedTechnicianId);

  // Assigned jobs with conflict warning
  const conflictedJobs = services.filter(s => !!s.assignedTechnicianId && !!s.conflict);

  const totalIssues = unassignedJobs.length + conflictedJobs.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Panel de Avisos, Conflictos y Pendientes
              </h2>
              <p className="text-xs text-slate-500">
                {totalIssues === 0
                  ? 'No se han detectado conflictos en las rutas planificadas.'
                  : `Se han detectado ${totalIssues} incidencias que requieren atención.`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Top Banner */}
        {totalIssues > 0 && (
          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <span className="text-blue-900 font-medium">
              El motor de asignación puede reordenar y redistribuir los servicios automáticamente.
            </span>
            <button
              onClick={() => {
                onAutoFixAll();
                onClose();
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Resolver y Optimizar Todo</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {totalIssues === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">¡Rutas óptimas y sin conflictos!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Todos los servicios están asignados a técnicos con los conocimientos requeridos y las horas de llegada encajan dentro de sus turnos y franjas horarias.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Unassigned Services Section */}
              {unassignedJobs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Servicios Pendientes Sin Asignar ({unassignedJobs.length})</span>
                  </div>

                  <div className="space-y-2.5">
                    {unassignedJobs.map((job) => {
                      // Find best candidate
                      const candidate = technicians.find(
                        t => t.availability.isAvailableToday && job.requiredSkills.every(s => t.skills.includes(s))
                      );

                      return (
                        <div
                          key={job.id}
                          className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-800">{job.code}</span>
                              <span className="font-bold text-slate-800 truncate">{job.customerName}</span>
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                                {job.priority.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-slate-600 text-[11px] truncate">
                              📍 {job.location.address} · {job.timeSlot.label}
                            </div>
                            <div className="text-amber-800 font-medium text-[11px] flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{job.conflict?.message || 'Pendiente de asignación.'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            {candidate ? (
                              <button
                                onClick={() => onAssignJob(job.id, candidate.id)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
                              >
                                Asignar a {candidate.name.split(' ')[0]}
                              </button>
                            ) : (
                              <button
                                onClick={() => onSelectJob(job)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
                              >
                                Revisar Requisitos
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Route Conflicts Section */}
              {conflictedJobs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Conflictos en Rutas Asignadas ({conflictedJobs.length})</span>
                  </div>

                  <div className="space-y-2.5">
                    {conflictedJobs.map((job) => {
                      const tech = technicians.find(t => t.id === job.assignedTechnicianId);

                      return (
                        <div
                          key={job.id}
                          className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-rose-800">{job.code}</span>
                              <span className="font-bold text-slate-800 truncate">{job.customerName}</span>
                              {tech && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] text-white font-medium" style={{ backgroundColor: tech.color }}>
                                  {tech.name}
                                </span>
                              )}
                            </div>
                            <div className="text-slate-600 text-[11px]">
                              Horario previsto: <strong className="text-slate-800">{job.scheduledArrival} - {job.scheduledDeparture}</strong> (Franja: {job.timeSlot.label})
                            </div>
                            <div className="text-rose-800 font-medium text-[11px] flex items-start gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <span>{job.conflict?.message}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              onClick={() => onSelectJob(job)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
                            >
                              Modificar Parada
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
