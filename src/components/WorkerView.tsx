import React, { useState } from 'react';
import { Technician, ServiceJob, JobStatus, Van, vanLabel } from '../types';
import { 
  Smartphone, 
  Navigation, 
  Phone, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  Play, 
  Wrench, 
  ChevronRight, 
  Check, 
  Share2, 
  Calendar, 
  FileText,
  User,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { formatDuration, calculateDistanceKm, estimateTravelTimeMinutes, minutesToTimeString, roadTravel } from '../utils/geo';
import { StartTimeEditor } from './StartTimeEditor';

interface WorkerViewProps {
  technicians: Technician[];
  services: ServiceJob[];
  selectedDate: string;
  onUpdateJobStatus: (serviceId: string, status: JobStatus, notes?: string) => void;
  onSelectTechnician?: (techId: string) => void;
  onOpenInSituModal?: (service: ServiceJob) => void;
  initialTechnicianId?: string;
  onChangeStartTime: (technicianId: string, date: string, time: string | null) => void;
  onAddWarehouseStop: (technicianId: string, minutes: number, reason: string) => void;
  onRemoveStop: (serviceId: string) => void;
  onOpenWorkOrders: () => void;
  vans: Van[];
}

const NAVE_REASONS = ['Recoger material', 'Cargar pedido en furgón', 'Descargar material', 'Otro'];

export const WorkerView: React.FC<WorkerViewProps> = ({
  technicians,
  services,
  selectedDate,
  onUpdateJobStatus,
  onOpenInSituModal,
  initialTechnicianId,
  onChangeStartTime,
  onAddWarehouseStop,
  onRemoveStop,
  onOpenWorkOrders,
  vans,
}) => {
  const [naveOpen, setNaveOpen] = useState(false);
  const [naveMinutes, setNaveMinutes] = useState(30);
  const [naveReason, setNaveReason] = useState(NAVE_REASONS[0]);
  const [naveOther, setNaveOther] = useState('');
  const [activeTechId, setActiveTechId] = useState<string>(initialTechnicianId || technicians[0]?.id || '');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<string>('');

  const currentTech = technicians.find(t => t.id === activeTechId) || technicians[0];
  const allTechJobs = services
    .filter(s => s.assignedTechnicianId === currentTech?.id)
    .sort((a, b) => a.manualOrder - b.manualOrder);
  // Finished jobs leave the list; their signed work orders are kept in "Partes de trabajo"
  const isDone = (s: ServiceJob) => s.status === 'completado';
  const techJobs = allTechJobs.filter((s) => !isDone(s));
  const doneJobs = allTechJobs.filter(isDone);

  const completedCount = doneJobs.length;
  const progressPercent = allTechJobs.length > 0 ? Math.round((completedCount / allTechJobs.length) * 100) : 0;

  // Open Google Maps navigation. The written address goes first: Google finds the exact door,
  // while the app's map point can be only the centre of the town
  const openGpsNavigation = (address: string, lat?: number, lng?: number) => {
    const destination = address.trim() ? encodeURIComponent(address.trim()) : lat && lng ? `${lat},${lng}` : '';
    window.open(`https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${destination}`, '_blank');
  };

  // Call customer phone directly
  const callPhone = (phone: string) => {
    window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
  };

  // WhatsApp to the customer: the technician is on the way, arriving at (now + driving time)
  const messageCustomer = (job: ServiceJob) => {
    const phone = (job.customerPhone || '').replace(/[^0-9]/g, '');
    const intl = phone.length === 9 ? `34${phone}` : phone;
    // Open WhatsApp straight away (phones block windows opened later), then fill in the message
    const win = window.open('', '_blank');
    const send = async (fromLat: number, fromLng: number) => {
      const road = await roadTravel(fromLat, fromLng, job.location.lat, job.location.lng);
      const minutes = road?.minutes ?? estimateTravelTimeMinutes(calculateDistanceKm(fromLat, fromLng, job.location.lat, job.location.lng));
      const now = new Date();
      const eta = minutesToTimeString(now.getHours() * 60 + now.getMinutes() + minutes);
      const text = encodeURIComponent(
        `Hola ${job.customerName}, le informamos de que el técnico de SAVA va de camino. Hora estimada de llegada: ${eta} (unos ${minutes} min).`
      );
      const url = `https://wa.me/${intl}?text=${text}`;
      if (win) win.location.href = url;
      else window.location.href = url;
    };
    // From where the technician is now; if the phone can't tell, from the previous stop
    const idx = allTechJobs.findIndex((s) => s.id === job.id);
    const prev = idx > 0 ? allTechJobs[idx - 1].location : currentTech.baseLocation;
    if (!navigator.geolocation) return send(prev.lat, prev.lng);
    navigator.geolocation.getCurrentPosition(
      (pos) => send(pos.coords.latitude, pos.coords.longitude),
      () => send(prev.lat, prev.lng),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'completado':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Completado</span>;
      case 'en_progreso':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">En faena</span>;
      case 'en_camino':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">En camino</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">Pendiente</span>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Top Banner: Mode Explanation & Worker Selector */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Vista Móvil del Operario (Puesto de Trabajo)
              </h2>
              <p className="text-xs text-slate-400">
                Interfaz optimizada para smartphones: navegación GPS, llamada al cliente y cambio de estado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-slate-400">Técnico:</span>
            <select
              value={activeTechId}
              onChange={(e) => setActiveTechId(e.target.value)}
              className="bg-transparent font-bold text-blue-400 outline-none cursor-pointer"
            >
              {technicians.map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress & Quick Stats Bar */}
        {currentTech && (
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentTech.color }} />
                <span className="font-semibold text-slate-200">{currentTech.name}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700/80 border border-slate-600 font-medium text-slate-300 flex items-center gap-1">
                  <span>{currentTech.vehicle.includes('Eléctrica') ? '⚡' : currentTech.vehicle.includes('Movano') ? '🚚' : '🚐'}</span>
                  <span>{currentTech.vehicle}</span>
                </span>
              </div>
              <span className="font-mono text-emerald-400 font-bold">
                {completedCount} de {techJobs.length} completados ({progressPercent}%)
              </span>
            </div>

            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 pt-1">
              <span>Jornada: <strong>{currentTech.schedule.start} - {currentTech.schedule.end}</strong></span>
              <span>Salida: <strong>{currentTech.baseLocation.address.split(',')[0]}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* List of stops for this worker */}
      <div className="space-y-3">
        {/* Stop at the warehouse before the next job */}
        {currentTech && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
            <button
              onClick={() => setNaveOpen(!naveOpen)}
              className="w-full flex items-center justify-between p-3 font-bold text-indigo-900 cursor-pointer"
            >
              <span className="flex items-center gap-2">🏭 NAVE <span className="font-normal text-indigo-700">pasar por la nave antes del próximo servicio</span></span>
              <span>{naveOpen ? '▲' : '▼'}</span>
            </button>
            {naveOpen && (
              <div className="px-3 pb-3 space-y-2.5">
                <div>
                  <div className="font-semibold text-slate-700 mb-1">¿Cuánto tiempo vas a estar en la nave?</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[15, 30, 45, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        onClick={() => setNaveMinutes(m)}
                        className={`px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer ${naveMinutes === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300 text-slate-700'}`}
                      >
                        {m < 60 ? `${m} min` : `${m / 60} h`}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={naveMinutes}
                      onChange={(e) => setNaveMinutes(Number(e.target.value))}
                      className="w-20 px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-700 mb-1">Para qué</div>
                  <div className="flex flex-wrap gap-1.5">
                    {NAVE_REASONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setNaveReason(r)}
                        className={`px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer ${naveReason === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300 text-slate-700'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {naveReason === 'Otro' && (
                    <input
                      value={naveOther}
                      onChange={(e) => setNaveOther(e.target.value)}
                      placeholder="Escribe el motivo"
                      className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  )}
                </div>
                <button
                  onClick={() => {
                    onAddWarehouseStop(currentTech.id, Math.max(5, naveMinutes || 30), naveReason === 'Otro' ? naveOther.trim() || 'Paso por nave' : naveReason);
                    setNaveOpen(false);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Añadir parada en la nave
                </button>
                <p className="text-[11px] text-indigo-800">Se mete antes del próximo servicio y la ruta se recalcula sola.</p>
              </div>
            )}
          </div>
        )}

        {/* Departure Base Card */}
        {currentTech && (
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold">
                🏠
              </div>
              <div>
                <span className="font-bold text-slate-800 block">Punto de salida</span>
                <span className="text-slate-500 text-[11px] truncate block">{currentTech.baseLocation.address}</span>
              </div>
            </div>
            <div className="text-right">
              <StartTimeEditor technician={currentTech} date={selectedDate} onChange={onChangeStartTime} />
              <button
                onClick={() => openGpsNavigation(currentTech.baseLocation.address, currentTech.baseLocation.lat, currentTech.baseLocation.lng)}
                className="text-[11px] text-blue-600 block hover:underline cursor-pointer"
              >
                Ver mapa
              </button>
            </div>
          </div>
        )}

        {doneJobs.length > 0 && (
          <button
            onClick={onOpenWorkOrders}
            className="w-full p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between cursor-pointer"
          >
            <span>✅ {doneJobs.length} {doneJobs.length === 1 ? 'trabajo terminado' : 'trabajos terminados'} hoy</span>
            <span className="underline">Ver en Partes de trabajo</span>
          </button>
        )}

        {/* Empty state */}
        {techJobs.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">{doneJobs.length ? 'No quedan servicios pendientes' : 'Sin servicios programados'}</h3>
            <p className="text-xs text-slate-500">
              No hay órdenes asignadas a {currentTech?.name} para el día {selectedDate}.
            </p>
          </div>
        ) : (
          techJobs.map((job) => {
            const index = allTechJobs.indexOf(job);
            if (job.kind === 'nave') {
              return (
                <div key={job.id} className="bg-indigo-50 rounded-2xl border border-indigo-200 p-3.5 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">🏭</div>
                    <div>
                      <div className="font-bold text-indigo-950">Nave · {job.title}</div>
                      <div className="text-indigo-800">
                        {job.scheduledArrival || '--:--'} – {job.scheduledDeparture || '--:--'} ({job.estimatedDuration} min)
                        {job.travelTimeFromPrev !== undefined && ` · ${job.travelTimeFromPrev} min de viaje`}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <button onClick={() => onUpdateJobStatus(job.id, 'completado')} className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold cursor-pointer">
                      Hecho
                    </button>
                    <button onClick={() => onRemoveStop(job.id)} className="text-[11px] text-indigo-700 underline cursor-pointer">
                      Quitar
                    </button>
                  </div>
                </div>
              );
            }
            const isSelected = selectedJobId === job.id;
            const isCompleted = job.status === 'completado';
            const isInProgress = job.status === 'en_progreso';
            const isOnTheWay = job.status === 'en_camino';

            return (
              <div
                key={job.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                  isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20 opacity-90'
                    : isInProgress
                    ? 'border-blue-400 ring-2 ring-blue-100'
                    : 'border-slate-200'
                }`}
              >
                {/* Header Row */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-8 h-8 rounded-full text-white font-bold text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-xs"
                      style={{ backgroundColor: currentTech.color }}
                    >
                      {index + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold text-slate-500">{job.code}</span>
                        {getStatusBadge(job.status)}
                        {job.priority === 'urgente' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                            URGENTE
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-slate-900">{job.customerName}</h3>
                      <p className="text-xs text-slate-600 font-medium">{job.title}</p>
                      {job.vanId && <p className="text-xs text-slate-500">🚐 {vanLabel(vans, job.vanId)}</p>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-blue-700 text-xs">
                      {job.scheduledArrival || '--:--'}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {job.inSituReport?.completedAt
                        ? `real ${job.scheduledArrival}–${job.scheduledDeparture}`
                        : job.inSituReport?.startedAt
                        ? 'llegada real'
                        : `(${job.estimatedDuration} min)`}
                    </span>
                  </div>
                </div>

                {/* Address & Travel Info */}
                <div className="px-4 pb-3 space-y-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-start gap-1.5 text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span className="font-medium">{job.location.address}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>Franja pactada: <strong>{job.timeSlot.label}</strong></span>
                      {job.travelTimeFromPrev !== undefined && (
                        <span>~{job.travelTimeFromPrev} min viaje ({job.distanceKmFromPrev} km)</span>
                      )}
                    </div>
                  </div>

                  {/* In Situ Report Summary if already recorded */}
                  {job.inSituReport && (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between font-bold text-emerald-900">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {job.inSituReport.outcome === 'resuelto'
                            ? 'Parte cerrado: resuelto'
                            : job.inSituReport.outcome === 'volver'
                            ? `Parte cerrado: hay que volver${job.inSituReport.returnReason ? ` (${job.inSituReport.returnReason})` : ''}`
                            : `Parte guardado sin cerrar (${job.inSituReport.updatedAt || 'hoy'})`}
                        </span>
                        {job.inSituReport.customerSignature && (
                          <span className="text-[10px] bg-emerald-200/70 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                            ✍️ Firmado
                          </span>
                        )}
                      </div>

                      {job.inSituReport.delayReportedMinutes ? (
                        <div className="text-amber-800 font-semibold bg-amber-100/70 p-1 rounded">
                          ⏱️ Retraso in situ: +{job.inSituReport.delayReportedMinutes} min ({job.inSituReport.delayReason || 'Incidencia'})
                        </div>
                      ) : null}

                      {job.inSituReport.technicalNotes && (
                        <p className="text-slate-700 italic">
                          "{job.inSituReport.technicalNotes}"
                        </p>
                      )}

                      {job.inSituReport.materialsUsed && job.inSituReport.materialsUsed.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {job.inSituReport.materialsUsed.map((m, i) => (
                            <span key={i} className="px-1.5 py-0.2 bg-white text-slate-700 border border-emerald-200 rounded text-[10px]">
                              📦 {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Primary In Situ Update Button */}
                  {onOpenInSituModal && (
                    <button
                      onClick={() => onOpenInSituModal(job)}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <FileText className="w-4 h-4 text-amber-300" />
                      <span>{job.inSituReport?.outcome ? '📝 Ver / editar parte de trabajo' : '📝 Parte de trabajo'}</span>
                    </button>
                  )}

                  {job.description && (
                    <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                      Nota de oficina: {job.description}
                    </p>
                  )}
                </div>

                {/* Worker Quick Mobile Actions: GPS, Phone, WhatsApp */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 grid grid-cols-3 gap-2">
                  {/* GPS Button */}
                  <button
                    onClick={() => openGpsNavigation(job.location.address, job.location.lat, job.location.lng)}
                    className="py-2 px-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    title="Abrir indicaciones en Google Maps"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>GPS</span>
                  </button>

                  {/* Phone Call Button */}
                  <button
                    onClick={() => callPhone(job.customerPhone || '+34911223344')}
                    className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    title="Llamar al cliente"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Llamar</span>
                  </button>

                  {/* WhatsApp Notice Button */}
                  <button
                    onClick={() => messageCustomer(job)}
                    className="py-2 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Avisar por WhatsApp de llegada"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Avisar</span>
                  </button>
                </div>

                {/* Status Advancement Buttons for the Technician */}
                <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">Estado del servicio:</span>

                  <div className="flex items-center gap-1.5">
                    {job.status === 'pendiente' || job.status === 'asignado' ? (
                      <button
                        onClick={() => onUpdateJobStatus(job.id, 'en_camino')}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Voy en camino</span>
                      </button>
                    ) : null}

                    {job.status === 'en_camino' ? (
                      <button
                        onClick={() => onUpdateJobStatus(job.id, 'en_progreso')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>Iniciar intervención</span>
                      </button>
                    ) : null}

                    {job.status === 'en_progreso' ? (
                      <button
                        onClick={() => onUpdateJobStatus(job.id, 'completado')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Marcar completado</span>
                      </button>
                    ) : null}

                    {job.status === 'completado' ? (
                      <button
                        onClick={() => onUpdateJobStatus(job.id, 'asignado')}
                        className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                      >
                        Reabrir
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
