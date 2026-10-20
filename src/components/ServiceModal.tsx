import React, { useState, useEffect } from 'react';
import { 
  ServiceJob, 
  Technician, 
  Van,
  AVAILABLE_SKILLS, 
  SkillType, 
  PriorityType, 
  TimeSlotType 
} from '../types';
import { X, Wrench, Loader2 } from 'lucide-react';
import { geocodeAddress } from '../utils/tickets';
import { teamIds } from '../utils/teams';
import { AttachmentsBox } from './AttachmentsBox';
import { PinPicker } from './PinPicker';

const toMinutes = (t: string) => {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const addMinutes = (t: string, mins: number) => {
  const total = Math.min(23 * 60 + 59, toMinutes(t) + (mins || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceToEdit?: ServiceJob | null;
  technicians: Technician[];
  vans: Van[];
  services: ServiceJob[]; // stored jobs, to tell if the van is already out that day
  onSave: (service: ServiceJob) => void;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  serviceToEdit,
  technicians,
  vans,
  services,
  onSave,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number>(42.8782);
  const [lng, setLng] = useState<number>(-8.5448);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [flexible, setFlexible] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [duration, setDuration] = useState<number>(90);
  const [priority, setPriority] = useState<PriorityType>('alta');
  const [requiredSkills, setRequiredSkills] = useState<SkillType[]>(['Montaje Máquinas de Fuerza']);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [vanId, setVanId] = useState('');
  const [saving, setSaving] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [pinMoved, setPinMoved] = useState(false);
  const [searching, setSearching] = useState(false);
  // Id of the job being edited, or of the new one (photos can be attached before saving)
  const [jobId, setJobId] = useState('');

  useEffect(() => {
    if (serviceToEdit) {
      setCustomerName(serviceToEdit.customerName);
      setCustomerPhone(serviceToEdit.customerPhone || '');
      setTitle(serviceToEdit.title);
      setDescription(serviceToEdit.description || '');
      setAddress(serviceToEdit.location.address);
      setLat(serviceToEdit.location.lat);
      setLng(serviceToEdit.location.lng);
      setDate(serviceToEdit.date);
      setFlexible(serviceToEdit.timeSlot.type === 'cualquiera');
      setStartTime(serviceToEdit.timeSlot.startHour);
      setDuration(serviceToEdit.estimatedDuration);
      setEndTime(
        serviceToEdit.timeSlot.type === 'personalizada'
          ? serviceToEdit.timeSlot.endHour
          : addMinutes(serviceToEdit.timeSlot.startHour, serviceToEdit.estimatedDuration)
      );
      setPriority(serviceToEdit.priority);
      setRequiredSkills(serviceToEdit.requiredSkills);
      setAssignedIds(teamIds(serviceToEdit));
      setVanId(serviceToEdit.vanId || '');
      setJobId(serviceToEdit.id);
    } else {
      // Defaults for new service
      setCustomerName('');
      setCustomerPhone('');
      setTitle('');
      setDescription('');
      setAddress('');
      setLat(42.8782);
      setLng(-8.5448);
      setDate(new Date().toISOString().split('T')[0]);
      setFlexible(false);
      setStartTime('09:00');
      setEndTime('10:30');
      setDuration(90);
      setPriority('alta');
      setRequiredSkills(['Montaje Máquinas de Fuerza']);
      setAssignedIds([]);
      setVanId('');
      setJobId(`srv-${Date.now()}`);
    }
    setSaving(false);
    setLocationNote(null);
    setShowPin(false);
    setPinMoved(false);
  }, [serviceToEdit, isOpen]);

  // Puts the pin where the written address is, so it can then be fine-tuned by hand
  const searchAddressOnMap = async () => {
    if (!address.trim()) return;
    setSearching(true);
    const found = await geocodeAddress(address.trim());
    setSearching(false);
    setShowPin(true);
    if (found) {
      setLat(found.lat);
      setLng(found.lng);
      setPinMoved(true);
      setLocationNote(null);
    } else {
      setLocationNote('No encuentro esa dirección. Mueve el pin hasta el sitio exacto.');
    }
  };

  if (!isOpen) return null;

  // Start/end times and duration stay consistent: changing the times sets the duration
  const changeStart = (value: string) => {
    setStartTime(value);
    setEndTime(addMinutes(value, duration));
  };
  const changeEnd = (value: string) => {
    setEndTime(value);
    const mins = toMinutes(value) - toMinutes(startTime);
    if (mins > 0) setDuration(mins);
  };
  const changeDuration = (value: number) => {
    setDuration(value);
    if (value > 0) setEndTime(addMinutes(startTime, value));
  };
  const toggleTech = (id: string) =>
    setAssignedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSkill = (skill: SkillType) => {
    if (requiredSkills.includes(skill)) {
      if (requiredSkills.length > 1) {
        setRequiredSkills(requiredSkills.filter(s => s !== skill));
      }
    } else {
      setRequiredSkills([...requiredSkills, skill]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    // The exact address decides where the customer is on the map
    let point = { lat, lng };
    const cleanAddress = address.trim();
    if (!pinMoved && (!serviceToEdit || cleanAddress !== serviceToEdit.location.address || !serviceToEdit.location.lat)) {
      setSaving(true);
      const found = await geocodeAddress(cleanAddress);
      setSaving(false);
      if (found) point = found;
      else if (!serviceToEdit) {
        setLocationNote('No encuentro esa dirección en el mapa. Escríbela con calle, número y localidad (o solo la localidad) y vuelve a guardar.');
        return;
      }
    }

    const ids = assignedIds.filter((id) => technicians.some((t) => t.id === id));
    const prevIds = serviceToEdit ? teamIds(serviceToEdit) : [];
    const base: Partial<ServiceJob> = serviceToEdit ? { ...serviceToEdit } : {};
    delete base.teamParentId;
    const jobToSave: ServiceJob = {
      ...(base as ServiceJob),
      id: jobId,
      code: serviceToEdit ? serviceToEdit.code : `SRV-${Math.floor(100 + Math.random() * 900)}`,
      customerName: customerName.trim() || 'Cliente Sin Nombre',
      customerPhone: customerPhone.trim(),
      title: title.trim() || 'Revisión técnica',
      description: description.trim(),
      location: {
        address: cleanAddress,
        zone: serviceToEdit?.location.zone || '',
        lat: point.lat,
        lng: point.lng,
      },
      date,
      timeSlot: flexible
        ? { type: 'cualquiera', label: 'Sin hora fija', startHour: '08:00', endHour: '19:00' }
        : { type: 'personalizada', label: `${startTime} - ${endTime}`, startHour: startTime, endHour: endTime },
      estimatedDuration: Number(duration) || 60,
      priority,
      requiredSkills,
      // A finished job keeps its state; otherwise it follows the assignment
      status:
        serviceToEdit && !['pendiente', 'asignado'].includes(serviceToEdit.status)
          ? serviceToEdit.status
          : ids.length ? 'asignado' : 'pendiente',
      assignedTechnicianId: ids[0] || null,
      assignedTechnicianIds: ids.length > 1 ? ids : undefined,
      manualOrder: serviceToEdit && prevIds[0] === ids[0] ? serviceToEdit.manualOrder : 99,
      vanId: vanId || null,
    };
    if (!jobToSave.assignedTechnicianIds) delete jobToSave.assignedTechnicianIds;

    onSave(JSON.parse(JSON.stringify(jobToSave)));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {serviceToEdit ? `Editar Servicio: ${serviceToEdit.code}` : 'Registrar Nuevo Servicio Técnico'}
              </h2>
              <p className="text-xs text-slate-500">
                Indica la ubicación, franja horaria pactada y los conocimientos técnicos necesarios.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Customer & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nombre del Cliente / Empresa *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej. Clínica Dental Gran Vía"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Teléfono de Contacto</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tipo de Servicio / Avería *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Avería en cuadro eléctrico trifásico"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descripción y Detalles del Trabajo</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instrucciones de acceso, tipo de maquinaria o herramientas específicas..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Photos and files of the job */}
          {jobId && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <AttachmentsBox serviceId={jobId} section="servicio" title="Fotos y archivos" />
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Dirección Completa *</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => { setAddress(e.target.value); setLocationNote(null); setPinMoved(false); }}
              placeholder="Ej. Rúa do Seixo 5, Carballo"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-[11px] text-slate-500">La posición en el mapa se saca de esta dirección.</p>
              <button
                type="button"
                onClick={() => (showPin ? setShowPin(false) : serviceToEdit || pinMoved ? setShowPin(true) : searchAddressOnMap())}
                className="text-[11px] font-semibold text-blue-700 underline cursor-pointer"
              >
                {searching ? 'Buscando…' : showPin ? 'Ocultar mapa' : '📍 Ver y ajustar el punto en el mapa'}
              </button>
            </div>
            {locationNote && <p className="text-[11px] text-rose-600 mt-1 font-medium">{locationNote}</p>}
            {showPin && (
              <div className="mt-2 space-y-1">
                <PinPicker
                  lat={lat}
                  lng={lng}
                  onChange={(la, ln) => {
                    setLat(la);
                    setLng(ln);
                    setPinMoved(true);
                  }}
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Arrastra el pin o toca el sitio exacto del cliente.{pinMoved ? ' Punto ajustado ✓' : ''}</span>
                  <button type="button" onClick={searchAddressOnMap} className="font-semibold text-blue-700 underline cursor-pointer">
                    Buscar la dirección otra vez
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Date and time */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block font-semibold text-slate-700 mb-1">Fecha *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hora de inicio</label>
              <input
                type="time"
                value={startTime}
                disabled={flexible}
                onChange={(e) => changeStart(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Hora de fin</label>
              <input
                type="time"
                value={endTime}
                disabled={flexible}
                onChange={(e) => changeEnd(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 disabled:opacity-40"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block font-semibold text-slate-700 mb-1">Duración</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="5"
                  max="720"
                  step="5"
                  value={duration}
                  onChange={(e) => changeDuration(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-medium">min</span>
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-slate-600 cursor-pointer -mt-1">
            <input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} />
            Sin hora fija (se hace cuando encaje en la ruta)
          </label>
          <p className="text-[11px] text-slate-500 -mt-2">
            Cuando el técnico pone en el parte su hora real de llegada y salida, la ruta usa esas horas.
          </p>

          {/* Priority */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Nivel de Prioridad *</label>
            <div className="grid grid-cols-4 gap-2">
              {(['baja', 'media', 'alta', 'urgente'] as PriorityType[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2 px-3 rounded-lg font-semibold text-xs capitalize border transition-all cursor-pointer ${
                    priority === p
                      ? p === 'urgente'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : p === 'alta'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : p === 'media'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-700 text-white border-slate-700 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Required Skills Multi-select */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Conocimientos / Habilidades requeridas para realizar el servicio *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AVAILABLE_SKILLS.map((skill) => {
                const isChecked = requiredSkills.includes(skill);
                return (
                  <button
                    type="button"
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`py-1.5 px-2.5 rounded-lg text-left text-[11px] font-medium border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{skill}</span>
                    <span>{isChecked ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technicians */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Técnicos (puedes marcar varios; sin marcar queda pendiente)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {technicians.map((t) => {
                const on = assignedIds.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleTech(t.id)}
                    className={`py-2 px-2.5 rounded-lg text-left border flex items-center gap-2 cursor-pointer ${
                      on ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="truncate">{t.name.split(' ').slice(0, 2).join(' ')}</span>
                    <span className="ml-auto">{on ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
            {assignedIds.length > 1 && (
              <p className="text-[11px] text-slate-500 mt-1">Un solo servicio para todo el equipo: lo que cambies aquí se cambia para todos.</p>
            )}
          </div>

          {/* Van */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Furgoneta para este servicio</label>
            <select
              value={vanId}
              onChange={(e) => setVanId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
            >
              <option value="">Sin furgoneta asignada</option>
              {vans.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.model} · {v.plate}
                </option>
              ))}
            </select>
            {vans.length === 0 && <p className="text-[11px] text-slate-500 mt-1">Todavía no hay furgonetas en la pestaña Furgonetas.</p>}
            {(() => {
              const others = vanId
                ? services.filter((s) => s.vanId === vanId && s.date === date && s.id !== jobId && s.kind !== 'nave')
                : [];
              return others.length > 0 ? (
                <p className="text-[11px] text-amber-700 mt-1">
                  Ese día esta furgoneta también va a:{' '}
                  {others
                    .map((s) => `${s.customerName}${s.timeSlot.type === 'cualquiera' ? '' : ` (${s.timeSlot.startHour}-${s.timeSlot.endHour})`}`)
                    .join(', ')}
                </p>
              ) : null;
            })()}
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : serviceToEdit ? 'Guardar Cambios' : 'Crear Servicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
