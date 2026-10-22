export type SkillType = 
  | 'Arreglo Máquinas Cardio'
  | 'Montaje Máquinas de Fuerza'
  | 'Suelos Técnicos y Pavimentos'
  | 'Racks y Estructuras Funcionales'
  | 'Cables, Poleas y Mantenimiento'
  | 'Electrónica Fitness y Consolas'
  | 'Postventa Marcas Propias'
  | 'Postventa Multimarca'
  | 'Entrega y Reparto de Material';

export const AVAILABLE_SKILLS: SkillType[] = [
  'Arreglo Máquinas Cardio',
  'Montaje Máquinas de Fuerza',
  'Suelos Técnicos y Pavimentos',
  'Racks y Estructuras Funcionales',
  'Cables, Poleas y Mantenimiento',
  'Electrónica Fitness y Consolas',
  'Postventa Marcas Propias',
  'Postventa Multimarca',
  'Entrega y Reparto de Material',
];

export const CITY_ZONES = [
  'A Coruña y Ferrol',
  'Santiago y Barbanza',
  'Vigo y Rías Baixas',
  'Lugo y Mariña',
  'Ourense e Interior',
  'Asturias (Oviedo / Gijón)',
  'León y El Bierzo',
  'Ruta Nacional / Norte',
];

export type PriorityType = 'baja' | 'media' | 'alta' | 'urgente';

export type JobStatus = 'pendiente' | 'asignado' | 'en_camino' | 'en_progreso' | 'completado' | 'cancelado';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
  zone: string; // e.g. "Norte", "Sur", "Centro", "Este", "Oeste"
}

export interface WorkSchedule {
  start: string; // e.g. "08:00"
  end: string;   // e.g. "16:30"
  lunchStart?: string; // e.g. "13:30"
  lunchEnd?: string;   // e.g. "14:30"
}

export interface TechnicianAvailability {
  isAvailableToday: boolean;
  daysOfWeek: number[]; // 1 = Lunes, 2 = Martes, etc.
  notes?: string;
}

export type VehicleModel = 
  | 'Renault Master L2H2' 
  | 'Opel Movano L3H2' 
  | 'Peugeot e-Rifter Eléctrica' 
  | 'Vehículo Compartido / En Equipo' 
  | string;

export interface CompanyVehicle {
  id: string;
  name: string;
  plate: string;
  category: 'Gran Volumen' | 'Gran Volumen Largo' | 'Comercial 100% Eléctrico';
  capacityVolumeM3: number;
  payloadKg: number;
  isElectric: boolean;
  batteryAutonomyKm?: number;
  recommendedUse: string;
  features: string[];
  defaultDriverName: string;
}

export const COMPANY_FLEET: CompanyVehicle[] = [
  {
    id: 'veh-master',
    name: 'Renault Master L2H2',
    plate: '8492 LZZ',
    category: 'Gran Volumen',
    capacityVolumeM3: 10.8,
    payloadKg: 1530,
    isElectric: false,
    recommendedUse: 'Mantenimientos de cardio, poleas, cables y taller móvil de reparación in situ',
    features: ['Taller móvil con banco de trabajo', 'Estanterías para repuestos', 'Bobinas de cable y poleas', 'Compresor y prensa'],
    defaultDriverName: 'Sergio',
  },
  {
    id: 'veh-movano',
    name: 'Opel Movano L3H2',
    plate: '3104 MKR',
    category: 'Gran Volumen Largo',
    capacityVolumeM3: 13.0,
    payloadKg: 1620,
    isElectric: false,
    recommendedUse: 'Montaje de Racks, jaulas funcionales, suelos técnicos 20mm y rutas interprovinciales (Asturias/León)',
    features: ['Longitud de carga 3.73m', 'Fijaciones para barras olímpicas', 'Capacidad palets suelo caucho', 'Rampa de carga reforzada'],
    defaultDriverName: 'Juanma',
  },
  {
    id: 'veh-erifter',
    name: 'Peugeot e-Rifter Eléctrica',
    plate: '5520 NBH',
    category: 'Comercial 100% Eléctrico',
    capacityVolumeM3: 3.5,
    payloadKg: 780,
    isElectric: true,
    batteryAutonomyKm: 280,
    recommendedUse: 'Asistencia ágil urbana, diagnóstico electrónico, placas inversoras, consolas y marcas propias',
    features: ['Etiqueta CERO Emisiones (acceso ZBE)', 'Autonomía 280 km', 'Maletín osciloscopio y soldadura', 'Repuestos rápidos y consolas'],
    defaultDriverName: 'Manuel',
  },
];

export interface Technician {
  id: string;
  name: string;
  avatar: string;
  color: string; // Hex color for markers and agenda
  phone: string;
  email: string;
  baseLocation: LocationPoint;
  schedule: WorkSchedule;
  availability: TechnicianAvailability;
  skills: SkillType[];
  vehicle: VehicleModel;
  maxDailyHours?: number;
  // Start time for one particular day when it differs from the usual one (YYYY-MM-DD -> "07:30")
  startTimeOverrides?: Record<string, string>;
  // Lunch break chosen for a day: from what time and for how long (minutes)
  lunchByDate?: Record<string, { start: string; minutes: number }>;
}

export type TimeSlotType = 'manana' | 'mediodia' | 'tarde' | 'personalizada' | 'cualquiera';

export interface TimeSlot {
  type: TimeSlotType;
  label: string; // e.g. "Mañana (09:00 - 13:00)"
  startHour: string; // e.g. "09:00"
  endHour: string;   // e.g. "13:00"
}

export interface ServiceJob {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  title: string;
  description: string;
  location: LocationPoint;
  date: string; // YYYY-MM-DD
  timeSlot: TimeSlot;
  estimatedDuration: number; // in minutes (e.g. 60)
  priority: PriorityType;
  requiredSkills: SkillType[];
  status: JobStatus;
  assignedTechnicianId: string | null; // first (lead) technician
  // Every technician on the job when several go together (lead first); one record for all of them
  assignedTechnicianIds?: string[];
  manualOrder: number; // sequential position in technician's route (0, 1, 2...)
  manualOrderByTech?: Record<string, number>; // position in each team member's own route
  vanId?: string | null; // van chosen for this job (does not depend on the technician)
  kind?: 'servicio' | 'nave'; // 'nave': a stop at the warehouse a technician adds to their day
  // Set on the in-memory copy shown in a team member's route: the record it belongs to
  teamParentId?: string;
  
  // Computed values during route calculation
  scheduledArrival?: string; // "09:30"
  scheduledDeparture?: string; // "10:30"
  travelTimeFromPrev?: number; // minutes
  distanceKmFromPrev?: number; // km
  conflict?: {
    type: 'skills_mismatch' | 'outside_timeslot' | 'exceeds_workday' | 'overlap' | 'unassigned_no_match';
    message: string;
    severity: 'warning' | 'error';
  };

  // Live in situ reporting from the field
  inSituReport?: {
    startedAt?: string;
    completedAt?: string;
    actualMinutes?: number;
    delayReportedMinutes?: number;
    delayReason?: string;
    technicalNotes?: string;
    materialsUsed?: string[];
    incidentType?: 'none' | 'ausente' | 'falta_pieza' | 'acceso_imposible' | 'averia_compleja';
    customerSignature?: string; // data URL of signed canvas
    customerSignatureName?: string;
    outcome?: 'resuelto' | 'volver';
    returnReason?: string;
    technicianName?: string;
    signedDate?: string; // YYYY-MM-DD
    updatedAt?: string;
  };
}

export interface RouteStop {
  stopNumber: number; // 0 = Base de salida, 1 = Primer servicio...
  type: 'base_start' | 'service' | 'base_end';
  service?: ServiceJob;
  technician: Technician;
  arrivalTime: string;
  departureTime: string;
  travelMinutesFromPrev: number;
  distanceKmFromPrev: number;
  lat: number;
  lng: number;
  address: string;
  hasConflict?: boolean;
  conflictMessage?: string;
}

export interface TechnicianRouteSummary {
  technician: Technician;
  stops: RouteStop[];
  totalDistanceKm: number;
  totalTravelMinutes: number;
  totalServiceMinutes: number;
  estimatedEndTime: string;
  servicesCount: number;
  conflictsCount: number;
  lunch?: { start: string; end: string }; // when the lunch break falls in the route
}

export interface OptimizationMetrics {
  totalJobs: number;
  assignedJobs: number;
  unassignedJobs: number;
  conflictsCount: number;
  totalKmSavedEstimate: number;
  totalActiveTechs: number;
}

// Company vans: plate, maintenance history and next ITV, shared through the `vans` collection
export interface VanMaintenance {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  km?: number;
}

export interface Van {
  id: string;
  model: string;
  plate: string;
  driverTechnicianId?: string | null;
  isElectric?: boolean;
  km?: number;
  nextItv?: string; // YYYY-MM-DD
  nextMaintenanceKm?: number; // odometer reading at which the next service is due
  maintenances: VanMaintenance[];
  notes?: string;
}

// Breakdown tickets ("avisos de avería") sent by customers through the public form or by the office
export type TicketStatus = 'nuevo' | 'convertido' | 'cerrado';

export interface Ticket {
  id: string;
  seq: number;
  number: string; // e.g. "AV-0007"
  createdAt: string; // ISO date-time
  source: 'cliente' | 'oficina';
  customerName: string;
  facility?: string; // gym / installation name
  customerPhone: string;
  customerEmail?: string;
  machine?: string; // brand / model
  problem: string;
  description?: string;
  urgency: PriorityType;
  location: { address: string; lat?: number | null; lng?: number | null; zone?: string };
  mediaCount: number;
  status: TicketStatus;
  serviceId?: string | null;
  // Supplier of the machine and the notice sent to them
  supplierId?: string | null; // chosen by the office, or detected from the brand
  supplierSend?: {
    status: 'pendiente' | 'preparado' | 'enviado' | 'error';
    to: string;
    requestedAt: string;
    requestedBy?: string;
    sentAt?: string;
    error?: string;
  };
  // Follow-up of everything done with this breakdown, oldest first
  timeline?: TicketEvent[];
}

export interface TicketEvent {
  at: string; // ISO date-time
  by?: string;
  kind: 'nota' | 'email_enviado' | 'email_recibido' | 'estado';
  text: string;
}

export interface TicketMedia {
  id: string;
  ticketId: string;
  type: 'image' | 'video';
  name: string;
  dataUrl: string;
}

export type DeliveryStatus = 'pendiente' | 'planificada' | 'entregada';

export interface Delivery {
  id: string;
  createdAt: string; // ISO
  facility?: string; // centro / gimnasio
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  location: { address: string; lat: number; lng: number; zone: string; approximate?: boolean };
  items: string; // material a entregar
  notes?: string;
  deadline?: string; // YYYY-MM-DD, entregar antes de
  estimatedMinutes: number;
  status: DeliveryStatus;
  serviceId?: string | null;
  ready?: { at: string; by?: string } | null; // order prepared and ready to go out
}

// Company details printed on work orders (Firestore settings/company)
export interface CompanyInfo {
  id: 'company';
  legalName: string;
  cif: string;
  address: string;
  phone: string;
  email: string;
  web?: string;
  reviewUrl?: string; // Google review link sent to customers after a job
}

// Photos and files attached to a service (description) or to its work order (observaciones)
export interface Attachment {
  id: string;
  serviceId: string;
  section: 'servicio' | 'parte';
  name: string;
  type: string; // MIME type
  dataUrl: string;
  createdAt: string;
  by?: string;
}

// The company warehouse, the usual starting point
export const WAREHOUSE: LocationPoint = {
  address: 'Nave SAVA · Rúa do Seixo, nave H1-H2, Polígono de Bértoa, 15100 Carballo (A Coruña)',
  lat: 43.222,
  lng: -8.678,
  zone: 'A Coruña y Ferrol',
};

// Starting points the team uses, recognised by their address when the stored coordinates are off
const KNOWN_STARTS: { match: RegExp; lat: number; lng: number; zone: string }[] = [
  { match: /b[eé]rtoa|nave sava/i, lat: WAREHOUSE.lat, lng: WAREHOUSE.lng, zone: WAREHOUSE.zone },
  { match: /betanzos/i, lat: 43.2804, lng: -8.2121, zone: 'A Coruña y Ferrol' },
  { match: /milladoiro/i, lat: 42.8467, lng: -8.5803, zone: 'Santiago y Barbanza' },
];

export function resolveStartLocation(loc: LocationPoint): LocationPoint {
  const known = KNOWN_STARTS.find((k) => k.match.test(loc.address || ''));
  return known ? { ...loc, lat: known.lat, lng: known.lng, zone: known.zone } : loc;
}

/** "Model · plate" of a van, for showing which one a job uses. */
export const vanLabel = (vans: Van[], id?: string | null) => {
  const v = vans.find((x) => x.id === id);
  return v ? `${v.model} · ${v.plate}` : 'Furgoneta';
};
