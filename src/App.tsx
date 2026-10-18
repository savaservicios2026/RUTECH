import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Technician, 
  ServiceJob, 
  TechnicianRouteSummary, 
  OptimizationMetrics 
} from './types';
import { INITIAL_TECHNICIANS, INITIAL_SERVICES } from './data/mockData';
import { 
  autoAssignAndOptimizeAll, 
  recalculateAllSchedules, 
  optimizeTechnicianStopsOrder 
} from './utils/optimizer';
import { Header } from './components/Header';
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
import { useAccess, READ_ONLY_MESSAGE, TECHNICIAN_EDITABLE_FIELDS } from './utils/access';
import { ensureTechnicianRole, isFirebaseEnabled, signOutUser } from './utils/firebase';
import { WorkerView } from './components/WorkerView';
import { InSituModal } from './components/InSituModal';
import { 
  AppNotification, 
  sendWebPushNotification, 
  getNotificationPermissionState 
} from './utils/notifications';
import { JobStatus } from './types';
import { CheckCircle2, RotateCcw, LogOut, AlertTriangle, Zap, Sparkles, Bell } from 'lucide-react';

export default function App() {
  const access = useAccess();
  const canEdit = access.role === 'oficina';
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [currentTab, setCurrentTab] = useState<'map' | 'timeline' | 'services' | 'technicians' | 'analytics' | 'worker'>('map');

  // Load from localStorage or initial mock data
  const [technicians, setTechniciansState] = useState<Technician[]>(() => {
    try {
      const saved = localStorage.getItem('rutatech_technicians_v3');
      return saved ? JSON.parse(saved) : INITIAL_TECHNICIANS;
    } catch {
      return INITIAL_TECHNICIANS;
    }
  });

  const [services, setServicesState] = useState<ServiceJob[]>(() => {
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
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('rutatech_notifications_v3');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'notif-1',
        title: '🛠️ Nuevo Montaje Asignado (Renault Master L2H2)',
        message: 'Asignado servicio GAL-104 (Gimnasio Santa Isabel Santiago): entrega de discos y montaje de prensa 45º.',
        technicianId: 'tech-sergio',
        technicianName: 'Sergio',
        type: 'new_assignment',
        priority: 'normal',
        timestamp: 'Hace 15 min',
        read: false,
        serviceCode: 'GAL-104',
      },
      {
        id: 'notif-2',
        title: '🚨 Avería Urgente en Cinta (Peugeot e-Rifter)',
        message: 'Avería prioritaria en Termaria Casa del Agua (A Coruña): rotura de banda Technogym. Salida con repuesto.',
        technicianId: 'tech-manuel',
        technicianName: 'Manuel',
        type: 'urgent_change',
        priority: 'urgente',
        timestamp: 'Hace 30 min',
        read: false,
        serviceCode: 'GAL-101',
      },
      {
        id: 'notif-3',
        title: '⚡ Ruta Asturias / León Optimizada (Opel Movano L3H2)',
        message: 'Itinerario de montaje de estructuras en GoFit Gijón y reparación en Ponferrada enlazado por A-6/A-8.',
        technicianId: 'tech-juanma',
        technicianName: 'Juanma',
        type: 'route_optimized',
        priority: 'normal',
        timestamp: 'Hace 1 hora',
        read: true,
        serviceCode: 'AST-107',
      },
    ];
  });

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
    try { localStorage.setItem('rutatech_technicians_v3', JSON.stringify(technicians)); } catch {}
  }, [technicians]);

  useEffect(() => {
    try { localStorage.setItem('rutatech_services_v3', JSON.stringify(services)); } catch {}
  }, [services]);

  // Shared data: office, technicians and Claude work on the same technicians and services
  useCloudCollection('technicians', technicians, setTechniciansState, canEdit);
  useCloudCollection('services', services, setServicesState);

  // Edits made in the app go through these: office staff change anything, technicians report
  // progress on their own jobs and keep their own record up to date (the database rules match).
  const techniciansRef = useRef(technicians);
  techniciansRef.current = technicians;
  const servicesRef = useRef(services);
  servicesRef.current = services;

  const setTechnicians = (next: React.SetStateAction<Technician[]>) => {
    if (canEdit) {
      setTechniciansState(next);
      return;
    }
    // A technician may update their own record (availability, schedule), but not their login email
    const prev = techniciansRef.current;
    const proposed = typeof next === 'function' ? next(prev) : next;
    const before = new Map(prev.map((t) => [t.id, t]));
    const allowed =
      proposed.length === prev.length &&
      proposed.every((t) => {
        const old = before.get(t.id);
        if (!old) return false;
        if (JSON.stringify(old) === JSON.stringify(t)) return true;
        return access.role === 'tecnico' && t.id === access.technicianId && t.email === old.email;
      });
    if (!allowed) {
      showToast(READ_ONLY_MESSAGE);
      return;
    }
    setTechniciansState(proposed);
  };

  const setServices = (next: React.SetStateAction<ServiceJob[]>) => {
    if (canEdit) {
      setServicesState(next);
      return;
    }
    const prev = servicesRef.current;
    const proposed = typeof next === 'function' ? next(prev) : next;
    const before = new Map(prev.map((s) => [s.id, s]));
    const allowed =
      proposed.length === prev.length &&
      proposed.every((s) => {
        const old = before.get(s.id);
        if (!old) return false;
        if (old === s) return true;
        const changed = Object.keys({ ...old, ...s }).filter(
          (k) => JSON.stringify((old as any)[k]) !== JSON.stringify((s as any)[k])
        );
        if (changed.length === 0) return true;
        return (
          access.role === 'tecnico' &&
          old.assignedTechnicianId === access.technicianId &&
          changed.every((k) => TECHNICIAN_EDITABLE_FIELDS.includes(k))
        );
      });
    if (!allowed) {
      showToast(READ_ONLY_MESSAGE);
      return;
    }
    setServicesState(proposed);
  };

  // Office: each technician's email in their record becomes their login to see the app
  useEffect(() => {
    if (!canEdit || !isFirebaseEnabled() || (window as any).claude?.use) return;
    technicians.forEach((t) => {
      if (t.email && t.email.includes('@')) ensureTechnicianRole(t.email.trim(), t.id).catch(() => {});
    });
  }, [technicians, canEdit]);

  useEffect(() => {
    try { localStorage.setItem('rutatech_notifications_v3', JSON.stringify(notifications)); } catch {}
  }, [notifications]);

  // Recalculate routes, stops and conflicts on every state update
  const { updatedServices, summaries, conflictsCount } = useMemo(() => {
    return recalculateAllSchedules(technicians, services);
  }, [technicians, services]);

  // Active technicians count
  const activeTechs = useMemo(() => {
    return technicians.filter(t => t.availability.isAvailableToday);
  }, [technicians]);

  // Metrics
  const metrics: OptimizationMetrics = useMemo(() => {
    let assigned = 0;
    let unassigned = 0;

    services.forEach(job => {
      if (job.assignedTechnicianId) {
        assigned++;
      } else {
        unassigned++;
      }
    });

    return {
      totalJobs: services.length,
      assignedJobs: assigned,
      unassignedJobs: unassigned,
      conflictsCount,
      totalKmSavedEstimate: Math.round(assigned * 4.4),
      totalActiveTechs: activeTechs.length,
    };
  }, [services, conflictsCount, activeTechs]);

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
      technicianName: tech ? tech.name : 'Equipo Técnico',
      type: options?.type || (isUrgent ? 'urgent_change' : 'new_assignment'),
      priority: options?.priority || (isUrgent ? 'urgente' : 'normal'),
      timestamp: 'Ahora mismo',
      read: false,
      serviceCode: options?.serviceCode,
      serviceId: options?.serviceId,
    };

    setNotifications(prev => [newNotif, ...prev]);

    // Dispatch Web Push notification to browser
    sendWebPushNotification(title, {
      body: `${tech ? `[Para ${tech.name}] ` : ''}${message}`,
      isUrgent,
      tag: `rutatech-${techId}-${Date.now()}`,
      onClick: () => {
        setSelectedTechnicianId(techId);
        setCurrentTab('map');
      },
    });

    showToast(`${isUrgent ? '🚨 AVISO URGENTE: ' : '🔔 '}${title}`);
  };

  // 1. Run Global Smart Optimization
  const handleOptimizeAll = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const result = autoAssignAndOptimizeAll(technicians, services, selectedDate);
      setServices(result.updatedServices);
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

    const techJobs = services.filter(s => s.assignedTechnicianId === techId);
    if (techJobs.length <= 1) {
      showToast(`El técnico ya tiene una ruta optimizada o con pocas paradas.`);
      return;
    }

    const reordered = optimizeTechnicianStopsOrder(tech, techJobs);
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
      .filter(s => s.assignedTechnicianId === targetService.assignedTechnicianId)
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
          ? services.filter(s => s.assignedTechnicianId === targetTechId).length
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
      const isUrgent = targetJob.priority === 'urgente';
      showToast(`Servicio reasignado a ${tech?.name || 'técnico'}`);

      // Web push alert to the assigned technician
      notifyTechnician(
        targetTechId,
        isUrgent ? '🚨 ¡Avería Urgente Asignada a tu Ruta!' : '🛠️ Nuevo Servicio Asignado',
        `${targetJob.title} (${targetJob.customerName}) en ${targetJob.location.address}. Franja: ${targetJob.timeSlot.label}`,
        {
          type: isUrgent ? 'urgent_change' : 'new_assignment',
          priority: targetJob.priority,
          serviceCode: targetJob.code,
          serviceId: targetJob.id,
        }
      );
    } else {
      showToast(`Servicio pasado a pendientes sin asignar`);
    }
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

  // 6. Save Service (create or edit)
  const handleSaveService = (jobToSave: ServiceJob) => {
    const exists = services.some(s => s.id === jobToSave.id);
    if (exists) {
      setServices(services.map(s => (s.id === jobToSave.id ? jobToSave : s)));
      showToast(`Servicio ${jobToSave.code} actualizado`);
    } else {
      setServices([jobToSave, ...services]);
      showToast(`Nuevo servicio ${jobToSave.code} creado`);
    }
  };

  // 7. Delete Service
  const handleDeleteService = (serviceId: string) => {
    setServices(services.filter(s => s.id !== serviceId));
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
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('Todas las notificaciones marcadas como leídas');
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
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
    setServices(prev => prev.map(job => (job.id === serviceId ? { ...job, status } : job)));
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
      targetJob?.assignedTechnicianId || 'all',
      `📝 Parte In Situ Registrado: ${targetJob?.code || ''}`,
      `Estado: ${newStatus.toUpperCase()}${extraDurationMinutes ? ` (Se alarga +${extraDurationMinutes}m)` : ''}. Firmado por: ${report.customerSignatureName || targetJob?.customerName}.`,
      {
        type: extraDurationMinutes ? 'urgent_change' : 'new_assignment',
        priority: extraDurationMinutes ? 'alta' : 'normal',
        serviceCode: targetJob?.code,
      }
    );

    showToast(`✓ Parte in situ de ${targetJob?.customerName} guardado con éxito`);
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
        <div className="fixed top-18 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
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
        unreadNotificationsCount={notifications.filter(n => !n.read).length}
        isOptimizing={isOptimizing}
        canEdit={canEdit}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col">
        {/* TAB 1: MAP & ROUTE PLANNER */}
        {currentTab === 'map' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[580px]">
            {/* Map Container */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
              <MapView
                technicians={technicians}
                services={updatedServices}
                summaries={summaries}
                selectedTechnicianId={selectedTechnicianId}
                setSelectedTechnicianId={setSelectedTechnicianId}
                onSelectService={(job) => {
                  setServiceToEdit(job);
                  setIsServiceModalOpen(true);
                }}
              />
            </div>

            {/* Route Stops Step-by-Step Sidebar */}
            <div className="lg:col-span-4 flex flex-col">
              <RouteSidebar
                technicians={technicians}
                services={updatedServices}
                summaries={summaries}
                selectedTechnicianId={effectiveTechId}
                onSelectTechnician={(id) => setSelectedTechnicianId(id)}
                onMoveStop={handleMoveStop}
                onReassignJob={handleReassignJob}
                onOptimizeSingleTech={handleOptimizeSingleTech}
                onSelectJob={(job) => {
                  setServiceToEdit(job);
                  setIsServiceModalOpen(true);
                }}
              />
            </div>
          </div>
        )}

        {/* TAB 2: TIMELINE / GANTT AGENDA */}
        {currentTab === 'timeline' && (
          <TimelineView
            technicians={technicians}
            services={updatedServices}
            summaries={summaries}
            selectedDate={selectedDate}
            onSelectJob={(job) => {
              setServiceToEdit(job);
              setIsServiceModalOpen(true);
            }}
            onAssignJobToTech={(jobId, techId) => handleReassignJob(jobId, techId)}
            onToggleAvailability={handleToggleAvailability}
          />
        )}

        {/* TAB 3: SERVICES MANAGEMENT */}
        {currentTab === 'services' && (
          <ServicesView
            services={updatedServices}
            technicians={technicians}
            onOpenNewService={() => {
              setServiceToEdit(null);
              setIsServiceModalOpen(true);
            }}
            onEditService={(job) => {
              setServiceToEdit(job);
              setIsServiceModalOpen(true);
            }}
            onDeleteService={handleDeleteService}
            onAssignJob={handleReassignJob}
          />
        )}

        {/* TAB 4: TECHNICIANS ROSTER */}
        {currentTab === 'technicians' && (
          <TechniciansView
            technicians={technicians}
            services={updatedServices}
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

        {/* TAB 5: ANALYTICS & PERFORMANCE METRICS */}
        {currentTab === 'analytics' && (
          <AnalyticsView
            technicians={technicians}
            services={updatedServices}
            summaries={summaries}
            selectedDate={selectedDate}
          />
        )}

        {/* TAB 6: WORKER / FIELD MOBILE PORTAL */}
        {currentTab === 'worker' && (
          <WorkerView
            technicians={technicians}
            services={updatedServices}
            selectedDate={selectedDate}
            onUpdateJobStatus={handleUpdateJobStatus}
            initialTechnicianId={access.role === 'tecnico' ? access.technicianId : undefined}
            onSelectTechnician={(id) => setSelectedTechnicianId(id)}
            onOpenInSituModal={(service) => {
              setServiceForInSitu(service);
              setIsInSituModalOpen(true);
            }}
          />
        )}
      </main>

      {/* App Sub-footer with Reset Helper */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">RUTECH</span>
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

      {/* Modals */}
      <ServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => {
          setIsServiceModalOpen(false);
          setServiceToEdit(null);
        }}
        serviceToEdit={serviceToEdit}
        technicians={technicians}
        onSave={handleSaveService}
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
        services={updatedServices}
        technicians={technicians}
        onAutoFixAll={handleOptimizeAll}
        onAssignJob={handleReassignJob}
        onSelectJob={(job) => {
          setServiceToEdit(job);
          setIsConflictsModalOpen(false);
          setIsServiceModalOpen(true);
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        technicians={technicians}
        services={updatedServices}
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
        notifications={notifications}
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
        onSaveInSituReport={handleSaveInSituReport}
      />
    </div>
  );
}
