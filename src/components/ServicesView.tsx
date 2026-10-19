import { teamIds } from '../utils/teams';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ServiceJob, 
  Technician, 
  AVAILABLE_SKILLS, 
  SkillType, 
  PriorityType 
} from '../types';
import { hasRequiredSkills } from '../utils/optimizer';
import { calculateDistanceKm } from '../utils/geo';
import { 
  Search, 
  Filter, 
  Plus, 
  MapPin, 
  Clock, 
  Wrench, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  UserX,
  Phone,
  Trash2,
  Edit,
  Sparkles,
  Calendar
} from 'lucide-react';

interface ServicesViewProps {
  services: ServiceJob[];
  selectedDate: string;
  technicians: Technician[];
  onOpenNewService: () => void;
  onEditService: (service: ServiceJob) => void;
  onDeleteService: (serviceId: string) => void;
  onAssignJob: (serviceId: string, technicianId: string | null) => void;
  onOpenWorkOrder: (service: ServiceJob) => void;
  onScheduleReturn: (service: ServiceJob) => void;
}

const formatDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' });

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  selectedDate,
  technicians,
  onOpenNewService,
  onEditService,
  onDeleteService,
  onAssignJob,
  onOpenWorkOrder,
  onScheduleReturn,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDay, setSelectedDay] = useState<'day' | 'upcoming' | 'all'>('day');
  // Day shown in the list; starts on the app's selected day and can be picked from the calendar
  const [filterDate, setFilterDate] = useState(selectedDate);
  useEffect(() => setFilterDate(selectedDate), [selectedDate]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'technician'>('none');
  const [suggestingTechForJobId, setSuggestingTechForJobId] = useState<string | null>(null);

  // Filtered Services
  const filteredServices = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return services.filter((job) => {
      if (selectedDay === 'day' && job.date !== filterDate) return false;
      if (selectedDay === 'upcoming' && job.date < today) return false;

      // Search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        job.code.toLowerCase().includes(searchLower) ||
        job.customerName.toLowerCase().includes(searchLower) ||
        job.title.toLowerCase().includes(searchLower) ||
        job.location.address.toLowerCase().includes(searchLower);


      // Status
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'unassigned' && !job.assignedTechnicianId) ||
        (selectedStatus === 'assigned' && !!job.assignedTechnicianId) ||
        job.status === selectedStatus;

      // Priority
      const matchesPriority = selectedPriority === 'all' || job.priority === selectedPriority;

      // Skill
      const matchesSkill = selectedSkill === 'all' || job.requiredSkills.includes(selectedSkill as SkillType);

      return matchesSearch && matchesStatus && matchesPriority && matchesSkill;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.manualOrder - b.manualOrder);
  }, [services, searchTerm, selectedStatus, selectedPriority, selectedSkill, selectedDay, filterDate]);

  // Helper to find qualified technicians for a specific job
  const getQualifiedCandidates = (job: ServiceJob) => {
    return technicians
      .map((tech) => {
        const isAvailable = tech.availability.isAvailableToday;
        const matchesSkills = hasRequiredSkills(tech, job.requiredSkills);
        const distFromBase = calculateDistanceKm(
          tech.baseLocation.lat,
          tech.baseLocation.lng,
          job.location.lat,
          job.location.lng
        );

        let score = 100;
        if (!isAvailable) score -= 80;
        if (!matchesSkills) score -= 70;
        score -= Math.min(30, distFromBase);

        return {
          tech,
          isAvailable,
          matchesSkills,
          distFromBase,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  };

  const renderServiceCard = (job: ServiceJob) => {
    const assignedTech = technicians.find(t => t.id === job.assignedTechnicianId);
    const hasConflict = !!job.conflict;
    const isShowingSuggestions = suggestingTechForJobId === job.id;

    return (
      <div
        key={job.id}
        className={`bg-white rounded-xl border p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
          hasConflict
            ? 'border-rose-300 ring-1 ring-rose-200'
            : !job.assignedTechnicianId
            ? 'border-amber-300 ring-1 ring-amber-100'
            : 'border-slate-200'
        }`}
      >
        <div>
          {/* Card Top Header */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {job.code}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  job.priority === 'urgente'
                    ? 'bg-rose-100 text-rose-700 border border-rose-300'
                    : job.priority === 'alta'
                    ? 'bg-amber-100 text-amber-700 border border-amber-300'
                    : job.priority === 'media'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {job.priority.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Customer & Title */}
          <h3 className="font-bold text-sm text-slate-900 mb-0.5">{job.customerName}</h3>
          <p className="text-xs text-slate-600 font-medium mb-1">{job.title}</p>
          <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">{job.description}</p>

          {/* Details metadata */}
          <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 mb-3">
            <div className="flex items-center gap-2 text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{job.location.address}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="capitalize">{formatDay(job.date)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.timeSlot.label}</span>
              </div>
              <span className="font-medium text-slate-700">{job.estimatedDuration} min</span>
            </div>
            {job.customerPhone && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.customerPhone}</span>
              </div>
            )}
          </div>

          {/* Required Skills Badges */}
          <div className="mb-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Conocimientos necesarios:
            </div>
            <div className="flex flex-wrap gap-1">
              {job.requiredSkills.map(skill => (
                <span
                  key={skill}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Work order result */}
          {job.inSituReport?.outcome && (
            <div
              className={`mb-3 p-2 rounded-lg border text-xs ${
                job.inSituReport.outcome === 'resuelto'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="font-bold">
                {job.inSituReport.outcome === 'resuelto' ? '✅ Parte cerrado: resuelto' : '🔁 Parte cerrado: hay que volver'}
              </div>
              {job.inSituReport.returnReason && <div>{job.inSituReport.returnReason}</div>}
              {job.inSituReport.technicalNotes && <div className="italic text-slate-600 mt-0.5">"{job.inSituReport.technicalNotes}"</div>}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <button
                  onClick={() => onOpenWorkOrder(job)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-md font-semibold text-slate-700 cursor-pointer"
                >
                  Ver parte
                </button>
                {job.inSituReport.outcome === 'volver' && (
                  <button
                    onClick={() => onScheduleReturn(job)}
                    className="px-2 py-1 bg-amber-500 text-white rounded-md font-semibold cursor-pointer"
                  >
                    Programar vuelta
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Conflict or Warning Notice */}
          {hasConflict && (
            <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[11px] font-bold">Conflicto detectado:</strong>
                <span>{job.conflict?.message}</span>
              </div>
            </div>
          )}

          {/* Suggestion drawer if opened */}
          {isShowingSuggestions && (
            <div className="mb-3 p-2.5 bg-slate-900 text-white rounded-lg text-xs space-y-2">
              <div className="font-semibold text-blue-300 flex items-center justify-between">
                <span>Técnicos recomendados:</span>
                <button
                  onClick={() => setSuggestingTechForJobId(null)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {getQualifiedCandidates(job).map(({ tech, isAvailable, matchesSkills, distFromBase }) => (
                  <div
                    key={tech.id}
                    className="p-1.5 rounded bg-slate-800 flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <div className="font-medium text-slate-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tech.color }} />
                        {tech.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {matchesSkills ? '✓ Conocimientos OK' : '✕ Faltan skills'} · ~{distFromBase} km
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onAssignJob(job.id, tech.id);
                        setSuggestingTechForJobId(null);
                      }}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium cursor-pointer"
                    >
                      Asignar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card Footer: Assignment & Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Assignment dropdown */}
          <div className="flex-1">
            {(job.assignedTechnicianIds?.length || 0) > 1 ? (
              <button
                onClick={() => onEditService(job)}
                className="w-full text-left text-xs rounded-lg px-2.5 py-1.5 font-medium border bg-blue-50 text-blue-900 border-blue-200 cursor-pointer"
                title="Cambiar el equipo"
              >
                👥 {job.assignedTechnicianIds!.map((id) => technicians.find((t) => t.id === id)?.name.split(' ')[0] || '?').join(' + ')}
              </button>
            ) : (
            <select
              value={job.assignedTechnicianId || ''}
              onChange={(e) => onAssignJob(job.id, e.target.value === '' ? null : e.target.value)}
              className={`w-full text-xs rounded-lg px-2.5 py-1.5 font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                assignedTech
                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              <option value="">⚠️ Sin Asignar (Pendiente)</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {!t.availability.isAvailableToday ? '— No disponible' : ''}
                </option>
              ))}
            </select>
            )}
          </div>

          {/* Suggest button for unassigned */}
          {!job.assignedTechnicianId && (
            <button
              onClick={() => setSuggestingTechForJobId(isShowingSuggestions ? null : job.id)}
              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors cursor-pointer"
              title="Sugerir técnico compatible"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
            </button>
          )}

          {/* Edit & Delete actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEditService(job)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Editar servicio"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteService(job.id)}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Eliminar servicio"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, código, dirección o trabajo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Add Service Button & Group By */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
              <button
                onClick={() => setGroupBy('none')}
                className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                  groupBy === 'none' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setGroupBy('technician')}
                className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                  groupBy === 'technician' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Por Técnico
              </button>
            </div>

            <button
              onClick={onOpenNewService}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Servicio</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Day filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Día:</label>
            <input
              type="date"
              value={selectedDay === 'day' ? filterDate : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                setFilterDate(e.target.value);
                setSelectedDay('day');
              }}
              className="w-full bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold cursor-pointer mb-1"
            />
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value as 'day' | 'upcoming' | 'all')}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 cursor-pointer"
            >
              <option value="day">Solo ese día ({formatDay(filterDate)})</option>
              <option value="upcoming">Desde hoy en adelante</option>
              <option value="all">Todos los días</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Estado:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="unassigned">⚠️ Solo Sin Asignar</option>
              <option value="assigned">✓ Asignados</option>
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Prioridad:</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 cursor-pointer"
            >
              <option value="all">Todas las prioridades</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {/* Required Skill filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Conocimiento:</label>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 cursor-pointer"
            >
              <option value="all">Cualquier conocimiento</option>
              {AVAILABLE_SKILLS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Services List Display */}
      {filteredServices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-slate-700">No se encontraron servicios</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Prueba a cambiar los filtros o añade un nuevo servicio con el botón superior.
          </p>
        </div>
      ) : groupBy === 'none' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map(renderServiceCard)}
        </div>
      ) : (
        // Group by Technician
        <div className="space-y-6">
          {/* Unassigned Group First */}
          {filteredServices.some(s => !s.assignedTechnicianId) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-amber-300 pb-2 bg-amber-50/50 p-2 rounded-t-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-amber-900 text-sm">
                  Pendientes sin asignar ({filteredServices.filter(s => !s.assignedTechnicianId).length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServices.filter(s => !s.assignedTechnicianId).map(renderServiceCard)}
              </div>
            </div>
          )}

          {/* Each Technician Group */}
          {technicians.map((tech) => {
            const techServices = filteredServices.filter(s => teamIds(s).includes(tech.id));
            if (techServices.length === 0) return null;

            return (
              <div key={tech.id} className="space-y-3">
                <div className="flex items-center gap-2.5 border-b border-slate-200 pb-2">
                  <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: tech.color }} />
                  <h3 className="font-bold text-slate-800 text-sm">
                    {tech.name} ({techServices.length} servicios asignados)
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {techServices.map(renderServiceCard)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
