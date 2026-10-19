import React, { useState, useEffect } from 'react';
import { 
  Technician, 
  AVAILABLE_SKILLS, 
  SkillType, 
  CITY_ZONES,
  WAREHOUSE,
  resolveStartLocation 
} from '../types';
import { geocodeAddress, zoneFor } from '../utils/tickets';
import { X, User, MapPin, Clock, Award, Truck } from 'lucide-react';

interface TechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  technicianToEdit?: Technician | null;
  onSave: (technician: Technician) => void;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#14B8A6', // Teal
];

const ZONE_DEPOT_PRESETS: Record<string, { address: string; lat: number; lng: number }> = {
  'Santiago y Barbanza': { address: 'Hub Central - Polígono del Tambre, Vía Edison 32, Santiago de Compostela', lat: 42.9094, lng: -8.5285 },
  'A Coruña y Ferrol': { address: 'Base Noroeste - Polígono de A Grela, Rúa Severo Ochoa 18, A Coruña', lat: 43.3548, lng: -8.4285 },
  'Vigo y Rías Baixas': { address: 'Base Sur Galicia - PTL Valladares, Rúa Leonardo da Vinci 12, Vigo', lat: 42.1724, lng: -8.7051 },
  'Lugo y Mariña': { address: 'Base Interior - Polígono de O Ceao, Rúa da Industria 45, Lugo', lat: 43.0421, lng: -7.5684 },
  'Ourense e Interior': { address: 'Base Interior Sur - Polígono San Cibrao das Viñas, Rúa 4, Ourense', lat: 42.2985, lng: -7.8341 },
  'Asturias (Oviedo / Gijón)': { address: 'Base Asturias - Polígono Industrial de Silvota, Llanera / Oviedo', lat: 43.4325, lng: -5.8452 },
  'León y El Bierzo': { address: 'Base Enlace Meseta - Polígono de Ponferrada / León', lat: 42.5612, lng: -6.5912 },
  'Ruta Nacional / Norte': { address: 'Corredor Cantábrico - Eje A-6 / A-8', lat: 43.2500, lng: -6.8000 },
};

export const TechnicianModal: React.FC<TechnicianModalProps> = ({
  isOpen,
  onClose,
  technicianToEdit,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [vehicle, setVehicle] = useState<string>('Renault Master L2H2');
  const [zone, setZone] = useState('Santiago y Barbanza');
  const [address, setAddress] = useState(ZONE_DEPOT_PRESETS['Santiago y Barbanza'].address);
  const [lat, setLat] = useState(ZONE_DEPOT_PRESETS['Santiago y Barbanza'].lat);
  const [lng, setLng] = useState(ZONE_DEPOT_PRESETS['Santiago y Barbanza'].lng);
  const [startHour, setStartHour] = useState('08:00');
  const [endHour, setEndHour] = useState('16:30');
  const [lunchStart, setLunchStart] = useState('13:30');
  const [lunchEnd, setLunchEnd] = useState('14:30');
  const [isAvailableToday, setIsAvailableToday] = useState(true);
  const [skills, setSkills] = useState<SkillType[]>(['Montaje Máquinas de Fuerza', 'Cables, Poleas y Mantenimiento']);

  useEffect(() => {
    if (technicianToEdit) {
      setName(technicianToEdit.name);
      setPhone(technicianToEdit.phone);
      setEmail(technicianToEdit.email);
      setColor(technicianToEdit.color);
      setVehicle(technicianToEdit.vehicle);
      setZone(technicianToEdit.baseLocation.zone);
      setAddress(technicianToEdit.baseLocation.address);
      setLat(technicianToEdit.baseLocation.lat);
      setLng(technicianToEdit.baseLocation.lng);
      setStartHour(technicianToEdit.schedule.start);
      setEndHour(technicianToEdit.schedule.end);
      setLunchStart(technicianToEdit.schedule.lunchStart || '13:30');
      setLunchEnd(technicianToEdit.schedule.lunchEnd || '14:30');
      setIsAvailableToday(technicianToEdit.availability.isAvailableToday);
      setSkills(technicianToEdit.skills);
    } else {
      setName('');
      setPhone('+34 6');
      setEmail('');
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
      setVehicle('Renault Master L2H2');
      setZone('Santiago y Barbanza');
      setAddress(ZONE_DEPOT_PRESETS['Santiago y Barbanza'].address);
      setLat(ZONE_DEPOT_PRESETS['Santiago y Barbanza'].lat);
      setLng(ZONE_DEPOT_PRESETS['Santiago y Barbanza'].lng);
      setStartHour('08:00');
      setEndHour('16:30');
      setLunchStart('13:30');
      setLunchEnd('14:30');
      setIsAvailableToday(true);
      setSkills(['Montaje Máquinas de Fuerza', 'Cables, Poleas y Mantenimiento']);
    }
  }, [technicianToEdit, isOpen]);

  if (!isOpen) return null;

  const handleZoneSelect = (z: string) => {
    setZone(z);
    if (ZONE_DEPOT_PRESETS[z]) {
      setAddress(ZONE_DEPOT_PRESETS[z].address);
      setLat(ZONE_DEPOT_PRESETS[z].lat);
      setLng(ZONE_DEPOT_PRESETS[z].lng);
    }
  };

  const toggleSkill = (skill: SkillType) => {
    if (skills.includes(skill)) {
      if (skills.length > 1) {
        setSkills(skills.filter(s => s !== skill));
      }
    } else {
      setSkills([...skills, skill]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Starting point: known places first, otherwise look the address up on the map
    const typed = address.trim() || WAREHOUSE.address;
    let start = resolveStartLocation({ address: typed, lat, lng, zone });
    if (start.lat === lat && start.lng === lng && typed !== technicianToEdit?.baseLocation.address) {
      const found = await geocodeAddress(typed);
      if (found) start = { address: typed, lat: found.lat, lng: found.lng, zone: zoneFor(found.lat, found.lng) };
    }

    const techToSave: Technician = {
      id: technicianToEdit ? technicianToEdit.id : `tech-${Date.now()}`,
      name: name.trim() || 'Técnico Especialista',
      avatar: technicianToEdit?.avatar || '',
      color,
      phone: phone.trim() || '+34 600 000 000',
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@rutatech.es`,
      vehicle,
      baseLocation: start,
      schedule: {
        start: startHour,
        end: endHour,
        lunchStart,
        lunchEnd,
      },
      availability: {
        isAvailableToday,
        daysOfWeek: [1, 2, 3, 4, 5],
        notes: isAvailableToday ? 'Operativo turno estándar' : 'No disponible en esta fecha',
      },
      skills,
      maxDailyHours: 8,
    };

    onSave(techToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {technicianToEdit ? `Editar Técnico: ${technicianToEdit.name}` : 'Registrar Nuevo Técnico'}
              </h2>
              <p className="text-xs text-slate-500">
                Configura base de salida, horario laboral, vehículo y conocimientos técnicos.
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
          {/* Name & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nombre Completo *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Roberto Gómez"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Color Identificativo</label>
              <div className="flex items-center gap-1.5 pt-1">
                {PRESET_COLORS.map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                      color === c ? 'ring-2 ring-slate-900 ring-offset-1 scale-110' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Teléfono Móvil</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 612 345 678"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tecnico@rutatech.es"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Vehicle & Availability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Furgoneta Asignada (Flota Empresa)</label>
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium text-xs"
              >
                <option value="Renault Master L2H2">🚐 Renault Master L2H2 (Gran Volumen / Taller Móvil)</option>
                <option value="Opel Movano L3H2">🚚 Opel Movano L3H2 (Gran Volumen Largo / Racks & Suelos)</option>
                <option value="Peugeot e-Rifter Eléctrica">⚡ Peugeot e-Rifter Eléctrica (100% CERO Emisiones / Consolas)</option>
                <option value="Vehículo Compartido / En Equipo">👥 Vehículo Compartido / Montajes en Equipo</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Disponibilidad en el día</label>
              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="tech-available"
                  checked={isAvailableToday}
                  onChange={(e) => setIsAvailableToday(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="tech-available" className="text-slate-700 cursor-pointer font-medium">
                  {isAvailableToday ? '✓ Disponible para asignaciones hoy' : '✕ No disponible (Ausente / Baja)'}
                </label>
              </div>
            </div>
          </div>

          {/* Starting point of the working day */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Punto de salida (inicio de jornada) *</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección desde la que sale"
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setAddress(WAREHOUSE.address)}
                className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg font-semibold whitespace-nowrap cursor-pointer"
              >
                Nave Bértoa
              </button>
            </div>
          </div>

          {/* Work Schedule */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Inicio Jornada</label>
              <input
                type="time"
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fin Jornada</label>
              <input
                type="time"
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Inicio Comida</label>
              <input
                type="time"
                value={lunchStart}
                onChange={(e) => setLunchStart(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fin Comida</label>
              <input
                type="time"
                value={lunchEnd}
                onChange={(e) => setLunchEnd(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
            </div>
          </div>

          {/* Skills Checklist */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Conocimientos Técnicos y Especialidades Homologadas *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AVAILABLE_SKILLS.map((skill) => {
                const isSelected = skills.includes(skill);
                return (
                  <button
                    type="button"
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`py-1.5 px-2.5 rounded-lg text-left text-[11px] font-medium border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{skill}</span>
                    <span>{isSelected ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
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
              {technicianToEdit ? 'Guardar Cambios' : 'Crear Técnico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
