import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Technician, 
  ServiceJob, 
  Van,
  Ticket,
  TicketStatus,
  Delivery,
  CompanyInfo,
  WAREHOUSE,
  resolveStartLocation,
  TechnicianRouteSummary, 
  OptimizationMetrics 
} from './types';
import { INITIAL_TECHNICIANS, INITIAL_SERVICES } from './data/mockData';
import { 
  autoAssignAndOptimizeAll, 
  recalculateAllSchedules, 
  optimizeTechnicianStopsOrder,
  technicianForDate
} from './utils/optimizer';
import { Header, AppTab } from './components/Header';
import { DayPicker } from './components/DayPicker';
import { WorkOrdersView } from './components/WorkOrdersView';
import { MapView } from './components/MapView';
import { RouteSidebar } from './components/RouteSidebar';
import { TimelineView } from './components/TimelineView';
import { ServicesView } from './components/ServicesView';
import { TechniciansView } from './components/TechniciansView';
import { ConflictsModal } from './components/ConflictsModal';
import { ServiceModal } from './components/ServiceModal';
import { TechnicianModal } from './components/TechnicianModal';
import { ExportModal } from './components/ExportModal';
import { AnalyticsView } from './components/AnalyticsView';
import { NotificationsModal } from './components/NotificationsModal';
import { useCloudCollection } from './utils/cloudSync';
import { expandTeams, collapseTeams, teamIds, baseIdOf } from './utils/teams';
import { placeFlexibleJob } from './utils/placement';
import { useAccess, READ_ONLY_MESSAGE, TECHNICIAN_EDITABLE_FIELDS } from './utils/access';
import { ensureTechnicianRole, getFirestoreDb, isFirebaseEnabled, signOutUser } from './utils/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { SharedWorkOrder } from './utils/workOrder';
import { WorkerView } from './components/WorkerView';
import { InSituModal } from './components/InSituModal';
import { VansView, countVanWarnings } from './components/VansView';
import { TicketsView } from './components/TicketsView';
import { DeliveriesView } from './components/DeliveriesView';
import { MobileNav } from './components/MobileNav';
import { CompanyModal, DEFAULT_COMPANY } from './components/CompanyModal';
import { DeliverySuggestion, deliveryStatus } from './utils/deliveries';
import { zoneCenter } from './utils/tickets';
import { 
  AppNotification, 
  sendWebPushNotification, 
  getNotificationPermissionState 
} from './utils/notifications';
import { JobStatus } from './types';
import { CheckCircle2, RotateCcw, LogOut, AlertTriangle, Zap, Sparkles, Bell, Building2 } from 'lucide-react';

// Worked out on each device from the route, never stored
const ROUTE_COMPUTED_KEYS = ['scheduledArrival', 'scheduledDeparture', 'travelTimeFromPrev', 'distanceKmFromPrev', 'conflict'];

export default function App() {
  const access = useAccess();
  const canEdit = access.role === 'oficina';
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [currentTab, setCurrentTab] = useState<AppTab>(
    access.role === 'tecnico' ? 'worker' : 'map'
  );

  // Load from localStorage or initial mock data
  const [storedTechnicians, setTechniciansState] = useState<Technician[]>(() => {
    try {
      const saved = localStorage.getItem('rutatech_technicians_v3');
      return saved ? JSON.parse(saved) : INITIAL_TECHNICIANS;
    } catch {
      return INITIAL_TECHNICIANS;
    }
  });

  // Each route starts at the technician's own starting point (no return leg)
  const technicians = useMemo(
    () => storedTechnicians.map((t) => ({ ...t, baseLocation: resolveStartLocation(t.baseLocation) })),
    [storedTechnicians]
  );

  const [storedServices, setServicesState] = useState<ServiceJob[]>(() => {
    try {
      const saved = localStorage.getItem('rutatech_services_v3');
      return saved ? JSON.parse(saved) : INITIAL_SERVICES;
    } catch {
      return INITIAL_SERVICES;
    }
  });

  // Selected tech for route views
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('all');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Notifications State
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return getNotificationPermissionState();
  });
  // In-app notices, shared: each technician gets the ones addressed to them, the office the rest
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  useCloudCollection('notifications', notifications, setNotifications);
  const myNotifications = useMemo(
    () =>
      notifications
        .filter((n) => (access.role === 'tecnico' ? n.technicianId === access.technicianId : true))
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')),
    [notifications, access]
  );

  // Modals state
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<ServiceJob | null>(null);
  const [isTechnicianModalOpen, setIsTechnicianModalOpen] = useState(false);
  const [technicianToEdit, setTechnicianToEdit] = useState<Technician | null>(null);
  const [isConflictsModalOpen, setIsConflictsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isInSituModalOpen, setIsInSituModalOpen] = useState(false);
  const [serviceForInSitu, setServiceForInSitu] = useState<ServiceJob | null>(null);

  // Save to localStorage
  useEffect(() => {
    try { localStorage.setItem('rutatech_technicians_v3', JSON.stringify(storedTechnicians)); } catch {}
  }, [technicians]);

  useEffect(() => {
    try { localStorage.setItem('rutatech_services_v3', JSON.stringify(storedServices)); } catch {}
  }, [storedServices]);

  // Shared data: office, technicians and Claude work on the same technicians and services
  useCloudCollection('technicians', storedTechnicians, setTechniciansState, canEdit);
  useCloudCollection('services', storedServices, setServicesState, false, ROUTE_COMPUTED_KEYS);

  // A team job is one record; each technician on it sees it in their own route
  const services = useMemo(() => expandTeams(storedServices), [storedServices]);

  // Company vans (plate, maintenance, ITV); only office staff change them
  const [vans, setVansState] = useState<Van[]>(() => {
    try {
      const saved = localStorage.getItem('rutech_vans_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { localStorage.setItem('rutech_vans_v1', JSON.stringify(vans)); } catch {}
  }, [vans]);
  useCloudCollection('vans', vans, setVansState);

  // Breakdown tickets from customers and the office (created straight in the database by the form)
  const [tickets, setTicketsState] = useState<Ticket[]>([]);
  useCloudCollection('tickets', tickets, setTicketsState);
  const [convertingTicketId, setConvertingTicketId] = useState<string | null>(null);

  const setTicketStatus = (ticketId: string, status: TicketStatus, serviceId?: string) => {
    if (!canEdit) return showToast(READ_ONLY_MESSAGE);
    setTicketsState((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status, serviceId: serviceId ?? (status === 'nuevo' ? null : t.serviceId ?? null) } : t))
    );
  };

  // Changes to a breakdown notice (supplier, follow-up notes)
  const updateTicket = (ticketId: string, change: (t: Ticket) => Partial<Ticket>) => {
    if (!canEdit) return showToast(READ_ONLY_MESSAGE);
    setTicketsState((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...change(t) } : t)));
  };

  // Corrections to a notice's details: the office and the technicians can make them
  const editTicket = (ticketId: string, changes: Partial<Ticket>) => {
    if (access.role !== 'oficina' && access.role !== 'tecnico') return showToast(READ_ONLY_MESSAGE);
    const who = (access.role === 'tecnico' && technicians.find((x) => x.id === access.technicianId)?.name) || access.email || '';
    setTicketsState((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, ...changes, timeline: [...(t.timeline || []), { at: new Date().toISOString(), by: who, kind: 'nota' as const, text: 'Datos del aviso editados' }] }
          : t
      )
    );
    showToast('Aviso guardado');
  };

  // Company details for printed work orders
  const [settings, setSettingsState] = useState<CompanyInfo[]>([]);
  useCloudCollection('settings', settings, setSettingsState);
  const company = settings.find((x) => x.id === 'company') || DEFAULT_COMPANY;
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  // Material deliveries, fitted into the technicians' planned routes
  const [deliveries, setDeliveriesState] = useState<Delivery[]>([]);
  useCloudCollection('deliveries', deliveries, setDeliveriesState);
  const [convertingDeliveryId, setConvertingDeliveryId] = useState<string | null>(null);

  const updateDelivery = (id: string, patch: Partial<Delivery>) =>
    setDeliveriesState((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const serviceFromDelivery = (d: Delivery, techId: string | null, date: string): ServiceJob => ({
    id: `srv-${Date.now()}`,
    code: `ENT-${d.id.slice(-4)}`,
    customerName: d.facility ? `${d.facility}${d.customerName ? ` (${d.customerName})` : ''}` : d.customerName,
    customerPhone: d.customerPhone,
    title: 'Entrega de material',
    description: [`Entregar: ${d.items}`, d.notes].filter(Boolean).join('\n'),
    location: { address: d.location.address, lat: d.location.lat, lng: d.location.lng, zone: d.location.zone },
    date,
    timeSlot: { type: 'cualquiera', label: 'Cualquier hora del día', startHour: '08:00', endHour: '19:00' },
    estimatedDuration: d.estimatedMinutes || 20,
    priority: 'media',
    requiredSkills: ['Entrega y Reparto de Material'],
    status: techId ? 'asignado' : 'pendiente',
    assignedTechnicianId: techId,
    manualOrder: 99,
  });

  // Inserts the delivery as a stop in that technician's day, where the detour is smallest
  const addDeliveryToRoute = (d: Delivery, s: DeliverySuggestion) => {
    if (!canEdit) return showToast(READ_ONLY_MESSAGE);
    const job = serviceFromDelivery(d, s.technician.id, s.date);
    const dayJobs = services
      .filter((x) => x.assignedTechnicianId === s.technician.id && x.date === s.date)
      .sort((a, b) => a.manualOrder - b.manualOrder);
    dayJobs.splice(s.insertIndex, 0, job);
    const order = new Map(dayJobs.map((x, i) => [x.id, i]));
    setServices([...services.map((x) => (order.has(x.id) ? { ...x, manualOrder: order.get(x.id)! } : x)), { ...job, manualOrder: order.get(job.id)! }]);
    updateDelivery(d.id, { status: 'planificada', serviceId: job.id });
    showToast(`📦 Entrega metida en la ruta de ${s.technician.name.split(' ')[0]}`);
  };

  const openSeparateDelivery = (d: Delivery) => {
    setConvertingDeliveryId(d.id);
    setServiceToEdit(serviceFromDelivery(d, null, selectedDate));
    setIsServiceModalOpen(true);
  };

  const removeDeliveryFromRoute = (d: Delivery) => {
    if (d.serviceId) setServices(services.filter((x) => x.id !== d.serviceId));
    updateDelivery(d.id, { status: 'pendiente', serviceId: null });
  };

  const markDeliveryDone = (d: Delivery) => {
    if (d.serviceId) setServices(services.map((x) => (x.id === d.serviceId ? { ...x, status: 'completado' } : x)));
    updateDelivery(d.id, { status: 'entregada' });
  };

  // The order is packed and ready to go out: tell whoever takes it, and the office
  const markDeliveryReady = (d: Delivery, ready: boolean) => {
    if (!canEdit) return showToast(READ_ONLY_MESSAGE);
    if (!ready) return updateDelivery(d.id, { ready: null });
    updateDelivery(d.id, { ready: { at: new Date().toISOString(), by: access.email || undefined } });
    const job = d.serviceId ? services.find((x) => x.id === d.serviceId) : undefined;
    const name = d.facility || d.customerName;
    const when = job ? ` · sale el ${new Date(`${job.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'numeric' })}` : '';
    const text = `${name}: ${d.items}${when} · ${d.location.address}`;
    const crew = job ? Array.from(new Set([job.assignedTechnicianId, ...(job.assignedTechnicianIds || [])].filter(Boolean) as string[])) : [];
    crew.forEach((techId) =>
      notifyTechnician(techId, '📦 Pedido listo para salir', text, { serviceCode: job?.code, serviceId: job?.id })
    );
    notifyTechnician('all', '📦 Pedido listo para salir', text, { serviceCode: job?.code, serviceId: job?.id });
    showToast(crew.length ? 'Pedido listo · avisado al técnico y a la oficina' : 'Pedido listo · avisado a la oficina');
  };

  // Pre-fills a work order from a ticket; it is saved as a new service from the service form
  const openServiceFromTicket = (ticket: Ticket) => {
    const point =
      ticket.location.lat != null && ticket.location.lng != null
        ? { lat: ticket.location.lat, lng: ticket.location.lng }
        : zoneCenter(ticket.location.zone);
    const draft: ServiceJob = {
      id: `srv-${Date.now()}`,
      code: ticket.number,
      customerName: ticket.facility ? `${ticket.facility} (${ticket.customerName})` : ticket.customerName,
      customerPhone: ticket.customerPhone,
      title: ticket.problem,
      description: [`Aviso ${ticket.number}`, ticket.machine && `Máquina: ${ticket.machine}`, ticket.description].filter(Boolean).join('\n'),
      location: { address: ticket.location.address, lat: point.lat, lng: point.lng, zone: ticket.location.zone || 'Ruta Nacional / Norte' },
      date: new Date().toISOString().split('T')[0],
      timeSlot: { type: 'manana', label: 'Mañana (09:00 - 13:00)', startHour: '09:00', endHour: '13:00' },
      estimatedDuration: 60,
      priority: ticket.urgency,
      requiredSkills: ['Postventa Multimarca'],
      status: 'pendiente',
      assignedTechnicianId: null,
      manualOrder: 99,
    };
    setConvertingTicketId(ticket.id);
    setServiceToEdit(draft);
    setIsServiceModalOpen(true);
  };

  // The stored record behind a job shown in someone's route
  const baseJob = (job: ServiceJob) => storedServices.find((s) => s.id === baseIdOf(job.id)) || job;

  // Names of everyone working a job
  const teamNamesFor = (job: ServiceJob) => {
    const ids = teamIds(baseJob(job));
    return ids.map((id) => technicians.find((t) => t.id === id)?.name).filter(Boolean).join(', ');
  };

  const openServiceEditor = (job: ServiceJob) => {
    setServiceToEdit(baseJob(job));
    setIsServiceModalOpen(true);
  };

  // Pre-fills a new visit for a job whose work order says "hay que volver"
  const openReturnVisit = (shown: ServiceJob) => {
    const job = baseJob(shown);
    const draft: ServiceJob = {
      ...job,
      id: `srv-${Date.now()}`,
      code: /-V\d*$/.test(job.code) ? job.code : `${job.code}-V`,
      description: [`Vuelta: ${job.inSituReport?.returnReason || ''}`, job.description].filter(Boolean).join('\n'),
      // Next working day at the earliest, with no fixed time: it goes into the best gap of the route
      date: (() => {
        const d = new Date();
        do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
        const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return selectedDate > next ? selectedDate : next;
      })(),
      timeSlot: { type: 'cualquiera', label: 'Sin hora fija', startHour: '08:00', endHour: '19:00' },
      status: job.assignedTechnicianId ? 'asignado' : 'pendiente',
      manualOrder: 99,
      inSituReport: undefined,
      conflict: undefined,
    };
    setServiceToEdit(draft);
    setIsServiceModalOpen(true);
  };

  // Edits made in the app go through these: office staff change anything, technicians report
  // progress on their own jobs and keep their own record up to date (the database rules match).
  const techniciansRef = useRef(storedTechnicians);
  techniciansRef.current = storedTechnicians;
  const servicesRef = useRef(storedServices);
  servicesRef.current = storedServices;
  const expandedRef = useRef(services);
  expandedRef.current = services;

  const setTechnicians = (next: React.SetStateAction<Technician[]>) => {
    if (canEdit) {
      setTechniciansState(next);
      return;
    }
    // A technician may update their own record (availability, schedule), but not their login email
    const prev = techniciansRef.current;
    let proposed = typeof next === 'function' ? next(prev) : next;
    const before = new Map(prev.map((t) => [t.id, t]));
    // Lists built from the on-screen technicians carry corrected start coordinates; keep the stored ones
    proposed = proposed.map((t) => {
      const old = before.get(t.id);
      return old && old.baseLocation.address === t.baseLocation.address ? { ...t, baseLocation: old.baseLocation } : t;
    });
    const allowed =
      proposed.length === prev.length &&
      proposed.every((t) => {
        const old = before.get(t.id);
        if (!old) return false;
        if (JSON.stringify(old) === JSON.stringify(t)) return true;
        if (access.role !== 'tecnico') return false;
        if (t.id === access.technicianId) return t.email === old.email;
        // A teammate's departure or lunch for a day they work together
        const { startTimeOverrides: _a, lunchByDate: _c, ...restNew } = t;
        const { startTimeOverrides: _b, lunchByDate: _d, ...restOld } = old;
        return JSON.stringify(restNew) === JSON.stringify(restOld);
      });
    if (!allowed) {
      showToast(READ_ONLY_MESSAGE);
      return;
    }
    setTechniciansState(proposed);
  };

  // Saves the stored records: office staff change anything; a technician reports on their own jobs
  // and may add or remove their own stops at the warehouse (the database rules match)
  const setStoredServices = (proposed: ServiceJob[]) => {
    if (canEdit) {
      notifyNewAssignments(servicesRef.current, proposed);
      setServicesState(proposed);
      return;
    }
    const prev = servicesRef.current;
    const before = new Map(prev.map((s) => [s.id, s]));
    const after = new Set(proposed.map((s) => s.id));
    const ownNave = (s: ServiceJob) => access.role === 'tecnico' && s.kind === 'nave' && s.assignedTechnicianId === access.technicianId;
    const allowed =
      prev.every((s) => after.has(s.id) || ownNave(s)) &&
      proposed.every((s) => {
        const old = before.get(s.id);
        if (!old) return ownNave(s);
        if (old === s) return true;
        const changed = Object.keys({ ...old, ...s }).filter(
          (k) => JSON.stringify((old as any)[k]) !== JSON.stringify((s as any)[k])
        );
        if (changed.length === 0) return true;
        // Only the office reopens a closed work order
        if (old.status === 'completado' && s.status !== 'completado') return false;
        return (
          access.role === 'tecnico' &&
          teamIds(old).includes(access.technicianId) &&
          changed.every((k) => TECHNICIAN_EDITABLE_FIELDS.includes(k))
        );
      });
    if (!allowed) {
      showToast(READ_ONLY_MESSAGE);
      return;
    }
    setServicesState(proposed);
  };

  // Changes made on the route lists (where a team job appears once per technician)
  const setServices = (next: React.SetStateAction<ServiceJob[]>) => {
    const prevExpanded = expandedRef.current;
    const proposed = typeof next === 'function' ? next(prevExpanded) : next;
    setStoredServices(collapseTeams(prevExpanded, proposed, servicesRef.current));
  };

  // Office: a customer who signs from their link (work order closed without signature) gets the
  // signature copied into the work order, and the office is told
  useEffect(() => {
    const db = getFirestoreDb();
    if (!canEdit || !db || (window as any).claude?.use) return;
    return onSnapshot(
      query(collection(db, 'publicWorkOrders'), where('pendingSignature', '==', true)),
      (snap) => {
        snap.docs.forEach((d) => {
          const w = d.data() as SharedWorkOrder;
          if (!w.signedAt || !w.customerSignature || !w.serviceId) return;
          const job = servicesRef.current.find((x) => x.id === w.serviceId);
          if (!job || !job.inSituReport || job.inSituReport.customerSignature) return;
          setServicesState(
            servicesRef.current.map((x) =>
              x.id === job.id
                ? {
                    ...x,
                    inSituReport: {
                      ...x.inSituReport!,
                      customerSignature: w.customerSignature,
                      customerSignatureName: w.customerSignatureName || '',
                      signedDate: w.signedAt!.slice(0, 10),
                      signaturePending: false,
                    },
                  }
                : x
            )
          );
          notifyTechnician('all', `✍️ El cliente ha firmado el parte ${job.code}`, `${job.customerName}${w.customerSignatureName ? ` · firmado por ${w.customerSignatureName}` : ''}`, {
            serviceCode: job.code,
          });
        });
      },
      () => {}
    );
  }, [canEdit]);

  // Office: each technician's email in their record becomes their login to see the app
  useEffect(() => {
    if (!canEdit || !isFirebaseEnabled() || (window as any).claude?.use) return;
    technicians.forEach((t) => {
      if (t.email && t.email.includes('@')) ensureTechnicianRole(t.email.trim(), t.id).catch(() => {});
    });
  }, [technicians, canEdit]);

  // A notice that arrives while the app is open pops up on the phone or computer it is meant for
  const appStartRef = useRef(new Date().toISOString());
  const shownRef = useRef(new Set<string>());
  useEffect(() => {
    myNotifications.forEach((n) => {
      if (n.read || shownRef.current.has(n.id) || (n.timestamp || '') < appStartRef.current) return;
      shownRef.current.add(n.id);
      // Office staff who also work as technicians (same email in their Equipo card) get their own notices too
      const ownTechId =
        access.role === 'tecnico'
          ? access.technicianId
          : technicians.find((t) => access.email && t.email?.trim().toLowerCase() === access.email.toLowerCase())?.id;
      const forMe = n.technicianId === ownTechId || (access.role !== 'tecnico' && n.technicianId === 'all');
      if (!forMe) return;
      sendWebPushNotification(n.title, { body: n.message, isUrgent: n.priority === 'urgente', tag: n.id });
      showToast(`🔔 ${n.title}`);
    });
  }, [myNotifications]);

  // The office keeps the list short: notices older than 30 days are removed
  useEffect(() => {
    if (!canEdit) return;
    const limit = new Date(Date.now() - 30 * 864e5).toISOString();
    if (notifications.some((n) => (n.timestamp || '') < limit)) {
      setNotifications((prev) => prev.filter((n) => (n.timestamp || '') >= limit));
    }
  }, [notifications, canEdit]);

  // Today's pending stops can't be earlier than now: recalculate every few minutes
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick((n) => n + 1), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Recalculate routes, stops and conflicts on every state update
  const { updatedServices, summaries, conflictsCount } = useMemo(() => {
    return recalculateAllSchedules(technicians, services, selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicians, services, selectedDate, clockTick]);

  // Map, agenda, routes and worker view show only the selected day
  const dayServices = useMemo(
    () => updatedServices.filter(s => s.date === selectedDate),
    [updatedServices, selectedDate]
  );

  // Technicians see only their own route in Mapa and Modo técnico (Pablo, who also runs the office, sees everyone)
  const ownOnlyTechId = access.role === 'tecnico' && access.technicianId !== 'tech-pablo' ? access.technicianId : undefined;
  const routeTechs = useMemo(
    () => (ownOnlyTechId ? technicians.filter((t) => t.id === ownOnlyTechId) : technicians),
    [technicians, ownOnlyTechId]
  );
  const routeServices = useMemo(
    () => (ownOnlyTechId ? dayServices.filter((s) => s.assignedTechnicianId === ownOnlyTechId) : dayServices),
    [dayServices, ownOnlyTechId]
  );

  // Active technicians count
  const activeTechs = useMemo(() => {
    return technicians.filter(t => t.availability.isAvailableToday);
  }, [technicians]);

  // Metrics
  const metrics: OptimizationMetrics = useMemo(() => {
    let assigned = 0;
    let unassigned = 0;

    dayServices.forEach(job => {
      if (job.assignedTechnicianId) {
        assigned++;
      } else {
        unassigned++;
      }
    });

    return {
      totalJobs: dayServices.length,
      assignedJobs: assigned,
      unassignedJobs: unassigned,
      conflictsCount,
      totalKmSavedEstimate: Math.round(assigned * 4.4),
      totalActiveTechs: activeTechs.length,
    };
  }, [dayServices, conflictsCount, activeTechs]);

  // Show temporary toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper to dispatch Web Push + in-app notification to a technician
  const notifyTechnician = (
    techId: string,
    title: string,
    message: string,
    options?: {
      type?: AppNotification['type'];
      priority?: AppNotification['priority'];
      serviceCode?: string;
      serviceId?: string;
    }
  ) => {
    const tech = technicians.find(t => t.id === techId);
    const isUrgent = options?.priority === 'urgente' || options?.type === 'urgent_change';
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      message,
      technicianId: techId,
      technicianName: tech ? tech.name : 'Oficina',
      type: options?.type || (isUrgent ? 'urgent_change' : 'new_assignment'),
      priority: options?.priority || (isUrgent ? 'urgente' : 'normal'),
      timestamp: new Date().toISOString(),
      read: false,
      serviceCode: options?.serviceCode,
      serviceId: options?.serviceId,
    };
    setNotifications(prev => [JSON.parse(JSON.stringify(newNotif)), ...prev]);
  };

  // Every technician newly put on a job (breakdown, service or delivery) gets a notice
  const notifyNewAssignments = (before: ServiceJob[], after: ServiceJob[]) => {
    const old = new Map(before.map((s) => [s.id, s]));
    after.forEach((job) => {
      if (job.kind === 'nave' || job.status === 'completado') return;
      const prevIds = old.has(job.id) ? teamIds(old.get(job.id)!) : [];
      const isDelivery = job.code.startsWith('ENT-');
      const isBreakdown = job.code.startsWith('AV-');
      const what = isDelivery ? '📦 Nueva entrega' : isBreakdown ? '🚨 Nueva avería' : '🛠️ Nuevo servicio';
      const when = `${new Date(`${job.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}${
        job.timeSlot.type === 'cualquiera' ? '' : ` · ${job.timeSlot.startHour}-${job.timeSlot.endHour}`
      }`;
      teamIds(job)
        .filter((id) => !prevIds.includes(id))
        .forEach((techId) =>
          notifyTechnician(techId, `${what} para ti`, `${job.customerName} · ${job.title} · ${when} · ${job.location.address}`, {
            type: job.priority === 'urgente' ? 'urgent_change' : 'new_assignment',
            priority: job.priority === 'urgente' ? 'urgente' : 'normal',
            serviceCode: job.code,
            serviceId: job.id,
          })
        );
    });
  };

  // 1. Run Global Smart Optimization
  const handleOptimizeAll = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const result = autoAssignAndOptimizeAll(technicians, services, selectedDate);
      setServices(services.map(s => result.updatedServices.find(u => u.id === s.id) || s));
      setIsOptimizing(false);
      showToast(
        `⚡ ¡Rutas optimizadas! ${result.metrics.assignedJobs} servicios asignados con orden de visita óptimo (~${result.metrics.totalKmSavedEstimate} km ahorrados).`
      );

      // Notify each active technician about their newly optimized route
      activeTechs.forEach(tech => {
        const techJobsCount = result.updatedServices.filter(s => s.assignedTechnicianId === tech.id).length;
        if (techJobsCount > 0) {
          notifyTechnician(
            tech.id,
            '⚡ Ruta Diaria Optimizada',
            `Tu itinerario de hoy ha sido optimizado con ${techJobsCount} paradas para minimizar desplazamientos.`,
            { type: 'route_optimized', priority: 'normal' }
          );
        }
      });
    }, 450);
  };

  // 2. Optimize Single Technician stops order
  const handleOptimizeSingleTech = (techId: string) => {
    const tech = technicians.find(t => t.id === techId);
    if (!tech) return;

    const techJobs = services.filter(s => s.assignedTechnicianId === techId && s.date === selectedDate);
    if (techJobs.length <= 1) {
      showToast(`El técnico ya tiene una ruta optimizada o con pocas paradas.`);
      return;
    }

    const reordered = optimizeTechnicianStopsOrder(technicianForDate(tech, selectedDate), techJobs);
    const updated = services.map(job => {
      const match = reordered.find(r => r.id === job.id);
      return match || job;
    });

    setServices(updated);
    showToast(`Paradas de ${tech.name} reordenadas para menor tiempo de viaje.`);

    notifyTechnician(
      techId,
      '📍 Secuencia de Paradas Reordenada',
      `Se ha actualizado el orden de visitas de tu jornada para optimizar tu tiempo de conducción.`,
      { type: 'route_optimized', priority: 'normal' }
    );
  };

  // 3. Move Stop manual up/down
  const handleMoveStop = (serviceId: string, direction: 'up' | 'down') => {
    const targetService = services.find(s => s.id === serviceId);
    if (!targetService || !targetService.assignedTechnicianId) return;

    const techJobs = services
      .filter(s => s.assignedTechnicianId === targetService.assignedTechnicianId && s.date === targetService.date)
      .sort((a, b) => a.manualOrder - b.manualOrder);

    const currentIndex = techJobs.findIndex(s => s.id === serviceId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= techJobs.length) return;

    // Swap manualOrder
    const currentOrder = techJobs[currentIndex].manualOrder;
    const neighborOrder = techJobs[targetIndex].manualOrder;

    const updated = services.map(job => {
      if (job.id === techJobs[currentIndex].id) {
        return { ...job, manualOrder: neighborOrder };
      }
      if (job.id === techJobs[targetIndex].id) {
        return { ...job, manualOrder: currentOrder };
      }
      return job;
    });

    setServices(updated);

    notifyTechnician(
      targetService.assignedTechnicianId,
      '🔄 Ajuste en Orden de Visitas',
      `Se ha modificado el orden de la parada "${targetService.customerName}". Revisa tu horario estimado.`,
      { type: 'urgent_change', priority: 'normal', serviceCode: targetService.code }
    );
  };

  // 4. Reassign Job
  const handleReassignJob = (serviceId: string, targetTechId: string | null) => {
    const targetJob = services.find(s => s.id === serviceId);

    const updated = services.map(job => {
      if (job.id === serviceId) {
        const nextOrder = targetTechId
          ? services.filter(s => s.assignedTechnicianId === targetTechId && s.date === targetJob?.date).length
          : 0;
        return {
          ...job,
          assignedTechnicianId: targetTechId,
          status: (targetTechId ? 'asignado' : 'pendiente') as any,
          manualOrder: nextOrder,
        };
      }
      return job;
    });

    setServices(updated);
    if (targetTechId && targetJob) {
      const tech = technicians.find(t => t.id === targetTechId);
      showToast(`Servicio reasignado a ${tech?.name || 'técnico'}`);

    } else {
      showToast(`Servicio pasado a pendientes sin asignar`);
    }
  };

  // Start time of one technician's day (e.g. they start earlier that day); null goes back to the usual one
  // Whoever goes with a technician that day (shared jobs): they share the van, departure and lunch
  const crewOf = (techId: string, date: string) => {
    const crew = new Set([techId]);
    storedServices
      .filter((s) => s.date === date && s.kind !== 'nave' && teamIds(s).includes(techId))
      .forEach((s) => teamIds(s).forEach((id) => crew.add(id)));
    return crew;
  };

  const handleChangeLunch = (techId: string, date: string, lunch: { start: string; minutes: number } | null) => {
    const crew = crewOf(techId, date);
    setTechnicians(
      storedTechnicians.map((t) => {
        if (!crew.has(t.id)) return t;
        const byDate = { ...(t.lunchByDate || {}) };
        if (lunch) byDate[date] = lunch;
        else delete byDate[date];
        Object.keys(byDate).forEach((d) => d < new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10) && delete byDate[d]);
        return { ...t, lunchByDate: byDate };
      })
    );
    const names = technicians.filter((t) => crew.has(t.id)).map((t) => t.name.split(' ')[0]).join(' y ');
    showToast(lunch ? `${names}: comida desde las ${lunch.start} (${lunch.minutes} min), ruta recalculada` : `${names}: sin hora de comer`);
  };

  const handleChangeStartTime = (techId: string, date: string, time: string | null) => {
    // Whoever goes with them that day shares the van and leaves from the same place: same departure
    const crew = crewOf(techId, date);
    setTechnicians(
      storedTechnicians.map((t) => {
        if (!crew.has(t.id)) return t;
        const overrides = { ...(t.startTimeOverrides || {}) };
        if (time) overrides[date] = time;
        else delete overrides[date];
        // Old days are not needed any more
        Object.keys(overrides).forEach((d) => d < new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10) && delete overrides[d]);
        return { ...t, startTimeOverrides: overrides };
      })
    );
    const names = technicians.filter((t) => crew.has(t.id)).map((t) => t.name.split(' ')[0]).join(' y ');
    showToast(time ? `${names} sale${crew.size > 1 ? 'n' : ''} a las ${time} ese día: ruta recalculada` : `${names}: hora de salida habitual`);
  };

  // A stop at the warehouse (pick up material, load an order) before the technician's next job
  // range: the stop from one time to another (if it is already over, it is recorded as done with those real times)
  const handleAddWarehouseStop = (techId: string, minutes: number, reason: string, range?: { from: string; to: string }) => {
    const dayJobs = services
      .filter((s) => s.assignedTechnicianId === techId && s.date === selectedDate)
      .sort((a, b) => a.manualOrder - b.manualOrder);
    let insertAt = 0;
    if (range) {
      // Among the planned stops, it goes where its time falls
      const arrival = (id: string) => updatedServices.find((u) => u.id === id)?.scheduledArrival || '';
      dayJobs.forEach((j, i) => {
        if (arrival(j.id) && arrival(j.id) < range.from) insertAt = i + 1;
      });
    } else {
      dayJobs.forEach((j, i) => {
        if (j.status === 'completado' || j.status === 'en_progreso') insertAt = i + 1;
      });
    }
    const now = new Date();
    const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const alreadyOver = !!range && (selectedDate < todayIso || (selectedDate === todayIso && range.to <= nowHm));
    const stop: ServiceJob = {
      id: `srv-nave-${Date.now()}`,
      kind: 'nave',
      code: 'NAVE',
      customerName: 'Nave SAVA',
      customerPhone: '',
      title: reason,
      description: '',
      location: { ...WAREHOUSE },
      date: selectedDate,
      timeSlot: range
        ? { type: 'personalizada', label: `${range.from} - ${range.to}`, startHour: range.from, endHour: range.to }
        : { type: 'cualquiera', label: 'Sin hora fija', startHour: '07:00', endHour: '21:00' },
      estimatedDuration: minutes,
      priority: 'media',
      requiredSkills: [],
      status: alreadyOver ? 'completado' : 'asignado',
      assignedTechnicianId: techId,
      manualOrder: insertAt,
      ...(alreadyOver ? { inSituReport: { startedAt: range!.from, completedAt: range!.to, actualMinutes: minutes } } : {}),
    };
    dayJobs.splice(insertAt, 0, stop);
    const order = new Map(dayJobs.map((j, i) => [j.id, i]));
    setServices([...services.map((s) => (order.has(s.id) && s.manualOrder !== order.get(s.id) ? { ...s, manualOrder: order.get(s.id)! } : s)), stop]);
    showToast(`🏭 Parada en la nave añadida (${range ? `${range.from}–${range.to}` : `${minutes} min`}): ruta recalculada`);
  };

  const handleRemoveStop = (serviceId: string) => {
    setServices(services.filter((s) => s.id !== serviceId));
    showToast('Parada quitada de la ruta');
  };

  // 5. Toggle Technician Availability
  const handleToggleAvailability = (techId: string) => {
    const updated = technicians.map(t => {
      if (t.id === techId) {
        const nextVal = !t.availability.isAvailableToday;
        return {
          ...t,
          availability: {
            ...t.availability,
            isAvailableToday: nextVal,
          },
        };
      }
      return t;
    });
    setTechnicians(updated);
    const tech = technicians.find(t => t.id === techId);
    showToast(`Disponibilidad de ${tech?.name} actualizada.`);
  };

  // 6. Save Service (create or edit); the form always edits the stored record
  const handleSaveService = (jobToSave: ServiceJob) => {
    const before = storedServices.find(s => s.id === jobToSave.id);
    let next = before
      ? storedServices.map(s => (s.id === jobToSave.id ? jobToSave : s))
      : [jobToSave, ...storedServices];
    let message = before ? `Servicio ${jobToSave.code} actualizado` : `Nuevo servicio ${jobToSave.code} creado`;

    // No agreed time: the app puts it in the best gap of the route (and picks the technician if none)
    const flexible = jobToSave.timeSlot.type === 'cualquiera' && jobToSave.kind !== 'nave' && jobToSave.status !== 'completado';
    const moved =
      !before ||
      before.timeSlot.type !== 'cualquiera' ||
      before.date !== jobToSave.date ||
      before.estimatedDuration !== jobToSave.estimatedDuration ||
      JSON.stringify(teamIds(before)) !== JSON.stringify(teamIds(jobToSave));
    if (flexible && moved) {
      const expanded = expandTeams(next);
      const placed = placeFlexibleJob(jobToSave.id, expanded, technicians);
      if (placed.technicianId) {
        next = collapseTeams(expanded, placed.services, next);
        const tech = technicians.find(t => t.id === placed.technicianId);
        message = `${jobToSave.code}: colocado en la ruta de ${tech?.name.split(' ')[0]}${placed.arrival ? `, llegada sobre las ${placed.arrival}` : ''}`;
      }
    }
    setStoredServices(next);
    showToast(message);
  };

  // 7. Delete Service
  const handleDeleteService = (serviceId: string) => {
    setStoredServices(storedServices.filter(s => s.id !== baseIdOf(serviceId)));
    showToast('Servicio eliminado');
  };

  // 8. Save Technician (create or edit)
  const handleSaveTechnician = (techToSave: Technician) => {
    const exists = technicians.some(t => t.id === techToSave.id);
    if (exists) {
      setTechnicians(technicians.map(t => (t.id === techToSave.id ? techToSave : t)));
      showToast(`Técnico ${techToSave.name} actualizado`);
    } else {
      setTechnicians([...technicians, techToSave]);
      showToast(`Técnico ${techToSave.name} añadido al equipo`);
    }
  };

  // 9. Delete Technician
  const handleDeleteTechnician = (techId: string) => {
    setTechnicians(technicians.filter(t => t.id !== techId));
    // Unassign their jobs
    setServices(
      services.map(s => (s.assignedTechnicianId === techId ? { ...s, assignedTechnicianId: null, status: 'pendiente' } : s))
    );
    showToast('Técnico eliminado y sus servicios reasignados a pendientes');
  };

  // Notification actions
  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllAsRead = () => {
    const mine = new Set(myNotifications.map((n) => n.id));
    setNotifications(prev => prev.map(n => (mine.has(n.id) ? { ...n, read: true } : n)));
    showToast('Todas las notificaciones marcadas como leídas');
  };

  const handleClearAllNotifications = () => {
    // Technicians can only mark theirs as read; the office deletes what it sees
    const mine = new Set(myNotifications.map((n) => n.id));
    setNotifications(prev => (canEdit ? prev.filter(n => !mine.has(n.id)) : prev.map(n => (mine.has(n.id) ? { ...n, read: true } : n))));
    showToast('Historial de notificaciones borrado');
  };

  // Simulate an urgent service arrival to demonstrate real-time Web Push alert to the user
  const handleSimulateUrgentPush = () => {
    const targetTech = activeTechs[0] || technicians[0];
    const urgentCode = `URG-${Math.floor(100 + Math.random() * 900)}`;

    const urgentJob: ServiceJob = {
      id: `srv-urgent-${Date.now()}`,
      code: urgentCode,
      customerName: 'Hospital Universitario La Paz - UCI Pediátrica',
      customerPhone: '+34 913 908 000',
      title: '🚨 Parada total de sistema de climatización y ventilación',
      description: 'Fallo crítico en el compresor primario de climatización en sala limpia.',
      location: {
        address: 'Paseo de la Castellana 261, Chamartín',
        zone: targetTech.baseLocation.zone,
        lat: 40.4812,
        lng: -3.6872,
      },
      date: selectedDate,
      timeSlot: {
        type: 'personalizada',
        label: 'INMEDIATO (Próximos 45 min)',
        startHour: '09:30',
        endHour: '11:00',
      },
      estimatedDuration: 60,
      priority: 'urgente',
      requiredSkills: targetTech.skills.slice(0, 1),
      status: 'asignado',
      assignedTechnicianId: targetTech.id,
      manualOrder: 0, // insert at front
    };

    // Prepend job to services
    setServices(prev => [urgentJob, ...prev]);

    // Dispatch urgent notification
    notifyTechnician(
      targetTech.id,
      '🚨 ¡AVISO URGENTE! Nueva avería en tu ruta',
      `${urgentJob.title} - ${urgentJob.customerName} (${urgentJob.location.address}). Atención inmediata requerida.`,
      {
        type: 'urgent_change',
        priority: 'urgente',
        serviceCode: urgentCode,
        serviceId: urgentJob.id,
      }
    );
  };

  // 10. Update job status from Worker Mobile Mode (e.g. en camino, en faena, completado)
  const handleUpdateJobStatus = (serviceId: string, status: JobStatus) => {
    // "Voy en camino" keeps the time they set off, so the arrival on the map follows the real departure
    const now = new Date();
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setServices(prev => prev.map(job => {
      if (job.id !== serviceId) return job;
      if (status === 'en_camino') return { ...job, status, inSituReport: { ...(job.inSituReport || {}), onTheWayAt: hm } };
      return { ...job, status };
    }));
    const targetJob = services.find(s => s.id === serviceId);
    const statusLabels: Record<JobStatus, string> = {
      completado: 'marcado como completado con éxito',
      en_progreso: 'marcado en faena / ejecución',
      en_camino: 'marcado en camino hacia el cliente',
      pendiente: 'en estado pendiente',
      asignado: 'en estado asignado',
      cancelado: 'marcado como cancelado',
    };
    showToast(`Servicio ${targetJob?.code || ''} ${statusLabels[status] || ''}`);
  };

  // 11. Save in situ report (notes, materials, signature, delay)
  const handleSaveInSituReport = (
    serviceId: string,
    report: NonNullable<ServiceJob['inSituReport']>,
    newStatus: JobStatus,
    extraDurationMinutes?: number
  ) => {
    // A work order a teammate already closed is not reopened by a save made from an older screen
    const live = servicesRef.current.find(s => s.id === baseIdOf(serviceId));
    if (live?.status === 'completado' && newStatus !== 'completado') {
      showToast('Este parte ya está cerrado: no se ha cambiado');
      return;
    }
    setServices(prev => prev.map(job => {
      if (job.id === serviceId) {
        const updatedDuration = extraDurationMinutes ? job.estimatedDuration + extraDurationMinutes : job.estimatedDuration;
        return {
          ...job,
          status: newStatus,
          estimatedDuration: updatedDuration,
          inSituReport: report,
        };
      }
      return job;
    }));

    const targetJob = services.find(s => s.id === serviceId);

    // Notify coordinator and dispatcher about in situ update
    notifyTechnician(
      'all',
      `📝 Parte de trabajo ${targetJob?.code || ''}: ${newStatus === 'completado' && live?.status !== 'completado' ? 'cerrado' : 'actualizado'}`,
      `${targetJob?.customerName || ''}${extraDurationMinutes ? ` · se alarga +${extraDurationMinutes} min` : ''}${report.customerSignatureName ? ` · firmado por ${report.customerSignatureName}` : ''}`,
      {
        type: extraDurationMinutes ? 'urgent_change' : 'new_assignment',
        priority: extraDurationMinutes ? 'alta' : 'normal',
        serviceCode: targetJob?.code,
      }
    );

    if (report.outcome === 'volver' && newStatus === 'completado' && !(live?.status === 'completado' && live.inSituReport?.outcome === 'volver')) {
      notifyTechnician('all', `🔁 Hay que volver: ${targetJob?.code || ''}`, `${targetJob?.customerName || ''}: ${report.returnReason || ''} · Reubícalo desde Partes`, {
        type: 'urgent_change',
        priority: 'urgente',
        serviceCode: targetJob?.code,
      });
    }
    showToast(`✓ Parte de trabajo de ${targetJob?.customerName} guardado`);
  };

  // 12. Reset data to factory demo
  const resetArmedUntilRef = useRef(0);
  const handleResetData = () => {
    if (Date.now() > resetArmedUntilRef.current) {
      resetArmedUntilRef.current = Date.now() + 5000;
      showToast('Pulsa otra vez en 5 segundos para restaurar los datos de demostración');
      return;
    }
    resetArmedUntilRef.current = 0;
    {
      setTechnicians(INITIAL_TECHNICIANS);
      setServices(INITIAL_SERVICES);
      showToast('Datos restaurados a la configuración inicial');
    }
  };

  const effectiveTechId = selectedTechnicianId === 'all'
    ? activeTechs[0]?.id || technicians[0]?.id
    : selectedTechnicianId;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-3 right-3 md:left-auto md:top-18 md:right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* App Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        metrics={metrics}
        onOptimize={handleOptimizeAll}
        onOpenNewService={() => {
          setServiceToEdit(null);
          setIsServiceModalOpen(true);
        }}
        onOpenNewTechnician={() => {
          setTechnicianToEdit(null);
          setIsTechnicianModalOpen(true);
        }}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenConflicts={() => setIsConflictsModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsModalOpen(true)}
        unreadNotificationsCount={myNotifications.filter(n => !n.read).length}
        isOptimizing={isOptimizing}
        canEdit={canEdit}
        vanWarningsCount={countVanWarnings(vans)}
        newTicketsCount={tickets.filter((t) => t.status === 'nuevo').length}
        pendingDeliveriesCount={deliveries.filter((d) => deliveryStatus(d, services) === 'pendiente').length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-5 md:pb-6 lg:p-6 flex flex-col">
        {/* TAB 1: MAP & ROUTE PLANNER */}
        {currentTab === 'map' && (
          <div className="flex-1 flex flex-col gap-3">
          <div className="hidden md:block"><DayPicker date={selectedDate} onChange={setSelectedDate} /></div>
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-5 items-stretch md:min-h-[580px]">
            {/* Map Container */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
              <MapView
                technicians={routeTechs}
                services={routeServices}
                summaries={summaries}
                selectedTechnicianId={selectedTechnicianId}
                setSelectedTechnicianId={setSelectedTechnicianId}
                onSelectService={openServiceEditor}
              />
            </div>

            {/* Route Stops Step-by-Step Sidebar */}
            <div className="lg:col-span-4 flex flex-col">
              <RouteSidebar
                technicians={routeTechs}
                services={routeServices}
                summaries={summaries}
                selectedTechnicianId={effectiveTechId}
                onSelectTechnician={(id) => setSelectedTechnicianId(id)}
                onMoveStop={handleMoveStop}
                onReassignJob={handleReassignJob}
                onOptimizeSingleTech={handleOptimizeSingleTech}
                onSelectJob={openServiceEditor}
                selectedDate={selectedDate}
                onChangeStartTime={handleChangeStartTime}
                onChangeLunch={handleChangeLunch}
              />
            </div>
          </div>
          </div>
        )}

        {/* TAB 2: TIMELINE / GANTT AGENDA */}
        {currentTab === 'timeline' && (
          <TimelineView
            technicians={technicians}
            services={dayServices}
            summaries={summaries}
            selectedDate={selectedDate}
            onSelectJob={openServiceEditor}
            onAssignJobToTech={(jobId, techId) => handleReassignJob(jobId, techId)}
            onToggleAvailability={handleToggleAvailability}
          />
        )}

        {/* TAB 3: SERVICES MANAGEMENT */}
        {currentTab === 'services' && (
          <ServicesView
            services={updatedServices.filter((s) => !s.teamParentId && s.kind !== 'nave')}
            selectedDate={selectedDate}
            technicians={technicians}
            vans={vans}
            onOpenNewService={() => {
              setServiceToEdit(null);
              setIsServiceModalOpen(true);
            }}
            onEditService={openServiceEditor}
            onDeleteService={handleDeleteService}
            onAssignJob={handleReassignJob}
            onOpenWorkOrder={(service) => {
              setServiceForInSitu(service);
              setIsInSituModalOpen(true);
            }}
            onScheduleReturn={openReturnVisit}
          />
        )}

        {/* TAB 4: TECHNICIANS ROSTER */}
        {currentTab === 'technicians' && (
          <TechniciansView
            technicians={technicians}
            services={dayServices}
            summaries={summaries}
            onOpenNewTechnician={() => {
              setTechnicianToEdit(null);
              setIsTechnicianModalOpen(true);
            }}
            onEditTechnician={(tech) => {
              setTechnicianToEdit(tech);
              setIsTechnicianModalOpen(true);
            }}
            onDeleteTechnician={handleDeleteTechnician}
            onToggleAvailability={handleToggleAvailability}
          />
        )}

        {currentTab === 'deliveries' && (
          <DeliveriesView
            deliveries={deliveries}
            services={services}
            technicians={technicians}
            canEdit={canEdit}
            onSave={(d) => {
              if (!canEdit) return showToast(READ_ONLY_MESSAGE);
              setDeliveriesState((prev) => (prev.some((x) => x.id === d.id) ? prev.map((x) => (x.id === d.id ? d : x)) : [...prev, d]));
              showToast('Entrega guardada');
            }}
            onDelete={(id) => {
              if (!canEdit) return showToast(READ_ONLY_MESSAGE);
              setDeliveriesState((prev) => prev.filter((x) => x.id !== id));
            }}
            onAddToRoute={addDeliveryToRoute}
            onCreateSeparate={openSeparateDelivery}
            onRemoveFromRoute={removeDeliveryFromRoute}
            onMarkDelivered={markDeliveryDone}
            onMarkReady={markDeliveryReady}
            showToast={showToast}
          />
        )}

        {currentTab === 'tickets' && (
          <TicketsView
            tickets={tickets}
            services={services}
            technicians={technicians}
            canEdit={canEdit}
            onCreateService={openServiceFromTicket}
            onSetStatus={(id, status) => setTicketStatus(id, status)}
            onUpdateTicket={updateTicket}
            onEditTicket={editTicket}
            userEmail={access.email || ''}
            onOpenService={(serviceId) => {
              const job = services.find((s) => s.id === serviceId);
              if (!job) return showToast('Ese parte de trabajo ya no existe');
              setServiceToEdit(job);
              setIsServiceModalOpen(true);
            }}
            showToast={showToast}
          />
        )}

        {currentTab === 'vans' && (
          <VansView
            vans={vans}
            technicians={technicians}
            canEdit={canEdit}
            onSaveVan={(van) => {
              if (!canEdit) return showToast(READ_ONLY_MESSAGE);
              setVansState((prev) => (prev.some((v) => v.id === van.id) ? prev.map((v) => (v.id === van.id ? van : v)) : [...prev, van]));
              showToast(`Furgoneta ${van.plate} guardada`);
            }}
            onDeleteVan={(vanId) => {
              if (!canEdit) return showToast(READ_ONLY_MESSAGE);
              setVansState((prev) => prev.filter((v) => v.id !== vanId));
              showToast('Furgoneta borrada');
            }}
          />
        )}

        {/* TAB 5: ANALYTICS & PERFORMANCE METRICS */}
        {currentTab === 'analytics' && (
          <AnalyticsView
            technicians={technicians}
            services={dayServices}
            summaries={summaries}
            selectedDate={selectedDate}
          />
        )}

        {/* TAB 6: WORKER / FIELD MOBILE PORTAL */}
        {currentTab === 'worker' && (
          <WorkerView
            technicians={routeTechs}
            services={routeServices}
            selectedDate={selectedDate}
            onUpdateJobStatus={handleUpdateJobStatus}
            initialTechnicianId={access.role === 'tecnico' ? access.technicianId : undefined}
            summaries={summaries}
            onChangeLunch={handleChangeLunch}
            vans={vans}
            onSelectTechnician={(id) => setSelectedTechnicianId(id)}
            onOpenInSituModal={(service) => {
              setServiceForInSitu(service);
              setIsInSituModalOpen(true);
            }}
            onChangeStartTime={handleChangeStartTime}
            onAddWarehouseStop={handleAddWarehouseStop}
            onRemoveStop={handleRemoveStop}
            onOpenWorkOrders={() => setCurrentTab('workorders')}
          />
        )}

        {currentTab === 'workorders' && (
          <WorkOrdersView
            services={storedServices}
            technicians={technicians}
            company={company}
            onlyTechnicianId={access.role === 'tecnico' ? access.technicianId : undefined}
            teamNamesFor={teamNamesFor}
            onScheduleReturn={canEdit ? openReturnVisit : undefined}
            onOpen={(job) => {
              setServiceForInSitu(job);
              setIsInSituModalOpen(true);
            }}
            showToast={showToast}
          />
        )}
      </main>

      {/* App Sub-footer with Reset Helper */}
      <footer className="hidden md:block bg-white border-t border-slate-200 py-3 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Sava Servicios</span>
            <span>· Sistema inteligente de asignación por competencias y optimización de rutas</span>
          </div>

          <div className="flex items-center gap-3">
            {access.email && (
              <button
                onClick={() => signOutUser()}
                className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                title={`Cerrar sesión de ${access.email}`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Salir ({access.email})</span>
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setIsCompanyModalOpen(true)}
                className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Datos de empresa</span>
              </button>
            )}
            {canEdit && (
            <button
              onClick={handleResetData}
              className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
              title="Restaurar datos de muestra de técnicos y servicios"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer datos de muestra</span>
            </button>
            )}
          </div>
        </div>
      </footer>

      <MobileNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isTechnician={access.role === 'tecnico'}
        canEdit={canEdit}
        newTicketsCount={tickets.filter((t) => t.status === 'nuevo').length}
        pendingDeliveriesCount={deliveries.filter((d) => deliveryStatus(d, services) === 'pendiente').length}
        vanWarningsCount={countVanWarnings(vans)}
        unassignedCount={metrics.unassignedJobs}
        email={access.email}
        onOptimize={handleOptimizeAll}
        onOpenNewService={() => {
          setServiceToEdit(null);
          setIsServiceModalOpen(true);
        }}
        onOpenNewTechnician={() => {
          setTechnicianToEdit(null);
          setIsTechnicianModalOpen(true);
        }}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenCompany={() => setIsCompanyModalOpen(true)}
        onSignOut={() => signOutUser()}
      />

      {/* Modals */}
      <CompanyModal
        isOpen={isCompanyModalOpen}
        company={company}
        onClose={() => setIsCompanyModalOpen(false)}
        onSave={(c) => {
          setSettingsState((prev) => [...prev.filter((x) => x.id !== 'company'), c]);
          setIsCompanyModalOpen(false);
          showToast('Datos de la empresa guardados');
        }}
      />
      <ServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => {
          setIsServiceModalOpen(false);
          setServiceToEdit(null);
          setConvertingTicketId(null);
          setConvertingDeliveryId(null);
        }}
        serviceToEdit={serviceToEdit}
        technicians={technicians}
        vans={vans}
        services={storedServices}
        onSave={(job) => {
          handleSaveService(job);
          if (convertingTicketId) setTicketStatus(convertingTicketId, 'convertido', job.id);
          if (convertingDeliveryId) updateDelivery(convertingDeliveryId, { status: 'planificada', serviceId: job.id });
        }}
      />

      <TechnicianModal
        isOpen={isTechnicianModalOpen}
        onClose={() => {
          setIsTechnicianModalOpen(false);
          setTechnicianToEdit(null);
        }}
        technicianToEdit={technicianToEdit}
        onSave={handleSaveTechnician}
      />

      <ConflictsModal
        isOpen={isConflictsModalOpen}
        onClose={() => setIsConflictsModalOpen(false)}
        services={dayServices}
        technicians={technicians}
        onAutoFixAll={handleOptimizeAll}
        onAssignJob={handleReassignJob}
        onSelectJob={(job) => {
          setIsConflictsModalOpen(false);
          openServiceEditor(job);
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        technicians={technicians}
        services={dayServices}
        summaries={summaries}
        selectedDate={selectedDate}
        onOpenWorkerView={(techId) => {
          setSelectedTechnicianId(techId);
          setCurrentTab('worker');
        }}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={myNotifications}
        permissionState={notificationPermission}
        onPermissionChange={setNotificationPermission}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAllNotifications}
        onSimulateUrgentPush={handleSimulateUrgentPush}
        technicians={technicians}
      />

      <InSituModal
        isOpen={isInSituModalOpen}
        onClose={() => {
          setIsInSituModalOpen(false);
          setServiceForInSitu(null);
        }}
        service={serviceForInSitu}
        closedElsewhere={
          !!serviceForInSitu &&
          serviceForInSitu.status !== 'completado' &&
          storedServices.find(s => s.id === baseIdOf(serviceForInSitu.id))?.status === 'completado'
        }
        technicianNames={serviceForInSitu ? teamNamesFor(serviceForInSitu) : ''}
        company={company}
        onSaveInSituReport={handleSaveInSituReport}
      />
    </div>
  );
}
