import React, { useState, useEffect } from 'react';
import { 
  ServiceJob, 
  Technician, 
  AVAILABLE_SKILLS, 
  SkillType, 
  PriorityType, 
  CITY_ZONES,
  TimeSlotType 
} from '../types';
import { X, Wrench, MapPin, Calendar, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceToEdit?: ServiceJob | null;
  technicians: Technician[];
  onSave: (service: ServiceJob) => void;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  serviceToEdit,
  technicians,
  onSave,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState('Santiago y Barbanza');
  const [lat, setLat] = useState<number>(42.8782);
  const [lng, setLng] = useState<number>(-8.5448);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlotType, setTimeSlotType] = useState<TimeSlotType>('manana');
  const [customStart, setCustomStart] = useState('09:00');
  const [customEnd, setCustomEnd] = useState('13:00');
  const [duration, setDuration] = useState<number>(90);
  const [priority, setPriority] = useState<PriorityType>('alta');
  const [requiredSkills, setRequiredSkills] = useState<SkillType[]>(['Montaje Máquinas de Fuerza']);
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string>('');

  // Zone coordinate presets around Galicia, Asturias and León
  const ZONE_COORDS: Record<string, { lat: number; lng: number }> = {
    'A Coruña y Ferrol': { lat: 43.3685, lng: -8.4192 },
    'Santiago y Barbanza': { lat: 42.8782, lng: -8.5448 },
    'Vigo y Rías Baixas': { lat: 42.2328, lng: -8.7226 },
    'Lugo y Mariña': { lat: 43.0125, lng: -7.5558 },
    'Ourense e Interior': { lat: 42.3364, lng: -7.8642 },
    'Asturias (Oviedo / Gijón)': { lat: 43.4325, lng: -5.8452 },
    'León y El Bierzo': { lat: 42.5987, lng: -5.5671 },
    'Ruta Nacional / Norte': { lat: 43.2500, lng: -6.8000 },
  };

  useEffect(() => {
    if (serviceToEdit) {
      setCustomerName(serviceToEdit.customerName);
      setCustomerPhone(serviceToEdit.customerPhone || '');
      setTitle(serviceToEdit.title);
      setDescription(serviceToEdit.description || '');
      setAddress(serviceToEdit.location.address);
      setZone(serviceToEdit.location.zone);
      setLat(serviceToEdit.location.lat);
      setLng(serviceToEdit.location.lng);
      setDate(serviceToEdit.date);
      setTimeSlotType(serviceToEdit.timeSlot.type);
      setCustomStart(serviceToEdit.timeSlot.startHour);
      setCustomEnd(serviceToEdit.timeSlot.endHour);
      setDuration(serviceToEdit.estimatedDuration);
      setPriority(serviceToEdit.priority);
      setRequiredSkills(serviceToEdit.requiredSkills);
      setAssignedTechnicianId(serviceToEdit.assignedTechnicianId || '');
    } else {
      // Defaults for new service
      setCustomerName('');
      setCustomerPhone('+34 912 ');
      setTitle('');
      setDescription('');
      setAddress('');
      setZone('Santiago y Barbanza');
      setLat(42.8782);
      setLng(-8.5448);
      setDate(new Date().toISOString().split('T')[0]);
      setTimeSlotType('manana');
      setCustomStart('09:00');
      setCustomEnd('12:00');
      setDuration(90);
      setPriority('alta');
      setRequiredSkills(['Montaje Máquinas de Fuerza']);
      setAssignedTechnicianId('');
    }
  }, [serviceToEdit, isOpen]);

  if (!isOpen) return null;

  const handleZoneChange = (newZone: string) => {
    setZone(newZone);
    if (ZONE_COORDS[newZone]) {
      // Add slight jitter for realism
      setLat(ZONE_COORDS[newZone].lat + (Math.random() - 0.5) * 0.02);
      setLng(ZONE_COORDS[newZone].lng + (Math.random() - 0.5) * 0.02);
    }
  };

  const toggleSkill = (skill: SkillType) => {
    if (requiredSkills.includes(skill)) {
      if (requiredSkills.length > 1) {
        setRequiredSkills(requiredSkills.filter(s => s !== skill));
      }
    } else {
      setRequiredSkills([...requiredSkills, skill]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let slotLabel = 'Mañana (09:00 - 13:00)';
    let startH = '09:00';
    let endH = '13:00';

    if (timeSlotType === 'manana') {
      slotLabel = 'Mañana (09:00 - 13:00)';
      startH = '09:00';
      endH = '13:00';
    } else if (timeSlotType === 'mediodia') {
      slotLabel = 'Mediodía (12:00 - 15:00)';
      startH = '12:00';
      endH = '15:00';
    } else if (timeSlotType === 'tarde') {
      slotLabel = 'Tarde (15:00 - 18:30)';
      startH = '15:00';
      endH = '18:30';
    } else if (timeSlotType === 'personalizada') {
      slotLabel = `Horario (${customStart} - ${customEnd})`;
      startH = customStart;
      endH = customEnd;
    } else {
      slotLabel = 'Cualquier hora del día';
      startH = '08:00';
      endH = '19:00';
    }

    const jobToSave: ServiceJob = {
      id: serviceToEdit ? serviceToEdit.id : `srv-${Date.now()}`,
      code: serviceToEdit ? serviceToEdit.code : `SRV-${Math.floor(100 + Math.random() * 900)}`,
      customerName: customerName.trim() || 'Cliente Sin Nombre',
      customerPhone: customerPhone.trim(),
      title: title.trim() || 'Revisión técnica',
      description: description.trim(),
      location: {
        address: address.trim() || `Zona ${zone}, Calle Principal`,
        zone,
        lat,
        lng,
      },
      date,
      timeSlot: {
        type: timeSlotType,
        label: slotLabel,
        startHour: startH,
        endHour: endH,
      },
      estimatedDuration: Number(duration) || 60,
      priority,
      requiredSkills,
      status: assignedTechnicianId ? 'asignado' : 'pendiente',
      assignedTechnicianId: assignedTechnicianId || null,
      manualOrder: serviceToEdit ? serviceToEdit.manualOrder : 99,
    };

    onSave(jobToSave);
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

          {/* Location & Zone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Dirección Completa *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Calle de Alcalá 120, Madrid"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Zona Geográfica *</label>
              <select
                value={zone}
                onChange={(e) => handleZoneChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
              >
                {CITY_ZONES.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date, Time Slot & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fecha Prevista *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Franja Horaria *</label>
              <select
                value={timeSlotType}
                onChange={(e) => setTimeSlotType(e.target.value as TimeSlotType)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="manana">Mañana (09:00 - 13:00)</option>
                <option value="mediodia">Mediodía (12:00 - 15:00)</option>
                <option value="tarde">Tarde (15:00 - 18:30)</option>
                <option value="personalizada">Franja Personalizada...</option>
                <option value="cualquiera">Cualquiera (Flexible)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Duración Estimada</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500 font-medium">min</span>
              </div>
            </div>
          </div>

          {timeSlotType === 'personalizada' && (
            <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-2.5 rounded-lg border border-blue-200">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hora Inicio Pactada</label>
                <input
                  type="time"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hora Fin Pactada</label>
                <input
                  type="time"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                />
              </div>
            </div>
          )}

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

          {/* Initial Assignment */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Asignación Directa de Técnico (Opcional - dejar vacío para auto-asignar)
            </label>
            <select
              value={assignedTechnicianId}
              onChange={(e) => setAssignedTechnicianId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Dejar pendiente (Asignación automática inteligente)</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {!t.availability.isAvailableToday ? '— No disponible' : ''}
                </option>
              ))}
            </select>
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
              {serviceToEdit ? 'Guardar Cambios' : 'Crear Servicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
