import React from 'react';
import { 
  Technician, 
  ServiceJob, 
  TechnicianRouteSummary,
  COMPANY_FLEET
} from '../types';
import { 
  Plus, 
  MapPin, 
  Clock, 
  Phone, 
  Mail, 
  Truck, 
  Award, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Users,
  Zap,
  BatteryCharging,
  ShieldCheck,
  CalendarCheck
} from 'lucide-react';
import { timeStringToMinutes } from '../utils/geo';

interface TechniciansViewProps {
  technicians: Technician[];
  services: ServiceJob[];
  summaries: Map<string, TechnicianRouteSummary>;
  onOpenNewTechnician: () => void;
  onEditTechnician: (tech: Technician) => void;
  onDeleteTechnician: (techId: string) => void;
  onToggleAvailability: (techId: string) => void;
}

export const TechniciansView: React.FC<TechniciansViewProps> = ({
  technicians,
  services,
  summaries,
  onOpenNewTechnician,
  onEditTechnician,
  onDeleteTechnician,
  onToggleAvailability,
}) => {
  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Equipo de Técnicos Especialistas y Montadores
          </h2>
          <p className="text-xs text-slate-500">
            Sergio, Manuel, Pablo y Juanma: disponibilidad diaria, especialidad y vehículo asignado. Cada uno sale de su punto de salida.
          </p>
        </div>

        <button
          onClick={onOpenNewTechnician}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Técnico</span>
        </button>
      </div>

      {/* Company Fleet Section (3 Vans); on phones the real vans are in Furgonetas */}
      <div className="hidden md:block bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-700/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                Flota de Furgonetas de la Empresa
                <span className="text-[11px] font-semibold bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                  3 Vehículos Propios
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Renault Master L2H2, Opel Movano L3H2 y Peugeot e-Rifter 100% Eléctrica asignadas a las rutas.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {COMPANY_FLEET.map(veh => {
            const activeDriver = technicians.find(t => 
              t.vehicle.toLowerCase().includes(veh.name.toLowerCase().split(' ')[0]) || 
              t.vehicle.toLowerCase().includes(veh.name.toLowerCase().split(' ')[1])
            );
            return (
              <div 
                key={veh.id}
                className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded-xl p-3.5 space-y-2.5 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block">
                        Matrícula {veh.plate}
                      </span>
                      <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                        {veh.isElectric ? (
                          <span className="text-emerald-400">⚡</span>
                        ) : veh.name.includes('Movano') ? (
                          <span className="text-purple-400">🚚</span>
                        ) : (
                          <span className="text-blue-400">🚐</span>
                        )}
                        {veh.name}
                      </h4>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      veh.isElectric 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' 
                        : 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                    }`}>
                      {veh.isElectric ? '100% Eléctrica (CERO)' : veh.category}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-snug mt-1.5">
                    {veh.recommendedUse}
                  </p>

                  <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-400 border-t border-slate-700/80 pt-2">
                    <span>📦 <strong>{veh.capacityVolumeM3} m³</strong></span>
                    <span>⚖️ Carga: <strong>{veh.payloadKg} kg</strong></span>
                    {veh.batteryAutonomyKm && (
                      <span className="text-emerald-400 font-semibold">🔋 <strong>{veh.batteryAutonomyKm} km</strong></span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Asignado hoy:</span>
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    {activeDriver ? (
                      <>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeDriver.color }} />
                        <span>{activeDriver.name}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">{veh.defaultDriverName} (Rotativo / Equipo)</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid of Technicians */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {technicians.map((tech) => {
          const summary = summaries.get(tech.id);
          const techJobs = services.filter(s => s.assignedTechnicianId === tech.id);
          const isAvailable = tech.availability.isAvailableToday;

          // Compute workload percentage
          const shiftTotalMinutes = timeStringToMinutes(tech.schedule.end) - timeStringToMinutes(tech.schedule.start);
          const bookedServiceMinutes = techJobs.reduce((sum, j) => sum + j.estimatedDuration, 0);
          const totalBookedMinutes = (summary?.totalTravelMinutes || 0) + bookedServiceMinutes;
          const loadPercent = Math.min(100, Math.round((totalBookedMinutes / Math.max(1, shiftTotalMinutes)) * 100));

          return (
            <div
              key={tech.id}
              className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                !isAvailable ? 'border-slate-200 bg-slate-50/70 opacity-80' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Header: Color, Name, Vehicle */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm"
                      style={{ backgroundColor: tech.color }}
                    >
                      {tech.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{tech.name}</h3>
                      <div className="text-xs mt-0.5">
                        {tech.vehicle.includes('e-Rifter') || tech.vehicle.includes('Eléctrica') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ⚡ {tech.vehicle}
                          </span>
                        ) : tech.vehicle.includes('Movano') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            🚚 {tech.vehicle}
                          </span>
                        ) : tech.vehicle.includes('Master') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            🚐 {tech.vehicle}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            👥 {tech.vehicle}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Availability toggle badge */}
                  <button
                    onClick={() => onToggleAvailability(tech.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                      isAvailable
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                    title="Alternar disponibilidad hoy"
                  >
                    {isAvailable ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>Activo hoy</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-rose-600" />
                        <span>Ausente</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Base Location & Schedule */}
                <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 space-y-1.5 text-xs text-slate-600 mb-3">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800">Salida:</span>{' '}
                      <span className="text-slate-500 text-[11px]">{tech.baseLocation.address}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Turno: <strong>{tech.schedule.start} - {tech.schedule.end}</strong></span>
                    </div>
                    {tech.schedule.lunchStart && (
                      <span className="text-slate-400">Comida: {tech.schedule.lunchStart}</span>
                    )}
                  </div>
                </div>

                {/* Workload Progress Bar */}
                {isAvailable && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span className="text-[11px] font-medium">Carga horaria asignada:</span>
                      <span className="font-bold text-slate-800 text-[11px]">
                        {techJobs.length} servicios ({loadPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          loadPercent > 95
                            ? 'bg-rose-500'
                            : loadPercent > 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Skills / Conocimientos */}
                <div className="mb-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-500" />
                    <span>Conocimientos y Especialidades:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tech.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium border border-slate-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contact info */}
                <div className="text-[11px] text-slate-500 space-y-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{tech.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{tech.email}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  {summary ? `Ruta: ~${summary.totalDistanceKm} km` : 'Sin ruta'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditTechnician(tech)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Editar técnico"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteTechnician(tech.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar técnico"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
