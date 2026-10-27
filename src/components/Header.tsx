import React from 'react';
import { 
  Route, 
  Calendar, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Zap, 
  Plus, 
  Share2, 
  Users, 
  CheckCircle2, 
  Compass,
  Wrench,
  TrendingUp,
  Bell,
  Smartphone,
  Truck,
  AlertOctagon,
  Package,
  FileSignature,
  ChevronLeft,
  ChevronRight,
  Boxes
} from 'lucide-react';
import logoSava from '../assets/logo-sava-dark.png?inline';
import { OptimizationMetrics } from '../types';

export type AppTab = 'map' | 'timeline' | 'services' | 'technicians' | 'analytics' | 'worker' | 'vans' | 'tickets' | 'deliveries' | 'workorders' | 'stock';

// Sections that show one day; on phones their day is chosen right under the top bar
const DATED_TABS: AppTab[] = ['map', 'timeline', 'technicians', 'worker', 'analytics'];

const isoShift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MobileDayBar: React.FC<{ date: string; onChange: (d: string) => void }> = ({ date, onChange }) => {
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const label = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="flex items-center gap-1.5 px-3 pb-2">
      <button onClick={() => onChange(isoShift(date, -1))} className="p-2 rounded-lg bg-slate-800 border border-slate-700" aria-label="Día anterior">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <label className="relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-semibold capitalize">
        <Calendar className="w-4 h-4 text-blue-400" />
        {label}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full"
          aria-label="Elegir día"
        />
      </label>
      <button onClick={() => onChange(isoShift(date, 1))} className="p-2 rounded-lg bg-slate-800 border border-slate-700" aria-label="Día siguiente">
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange(todayLocal)}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${date === todayLocal ? 'bg-blue-600 border-blue-600' : 'bg-slate-800 border-slate-700'}`}
      >
        Hoy
      </button>
    </div>
  );
};

interface HeaderProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  metrics: OptimizationMetrics;
  onOptimize: () => void;
  onOpenNewService: () => void;
  onOpenNewTechnician: () => void;
  onOpenExport: () => void;
  onOpenConflicts: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  isOptimizing?: boolean;
  canEdit?: boolean;
  vanWarningsCount?: number;
  newTicketsCount?: number;
  pendingDeliveriesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  selectedDate,
  setSelectedDate,
  metrics,
  onOptimize,
  onOpenNewService,
  onOpenNewTechnician,
  onOpenExport,
  onOpenConflicts,
  onOpenNotifications,
  unreadNotificationsCount,
  isOptimizing = false,
  canEdit = true,
  vanWarningsCount = 0,
  newTicketsCount = 0,
  pendingDeliveriesCount = 0,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      {/* Phone top bar: brand, alerts and notices; sections live in the bottom bar */}
      <div className="md:hidden pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-3 py-2">
          <img src={logoSava} alt="SAVA" className="h-8 w-auto shrink-0" />
          <span className="font-bold tracking-tight truncate">Sava Servicios</span>
          <div className="ml-auto flex items-center gap-1.5">
            {metrics.conflictsCount > 0 && (
              <button onClick={onOpenConflicts} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />{metrics.conflictsCount}
              </button>
            )}
            {metrics.unassignedJobs > 0 && (
              <button onClick={onOpenConflicts} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />{metrics.unassignedJobs} sin asignar
              </button>
            )}
            <button onClick={onOpenNotifications} className="relative p-2 rounded-lg bg-slate-800 border border-slate-700" aria-label="Avisos">
              <Bell className="w-5 h-5 text-slate-200" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>
        {DATED_TABS.includes(currentTab) && <MobileDayBar date={selectedDate} onChange={setSelectedDate} />}
      </div>

      {/* Top Bar */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-12 shrink-0 py-0.5">
                <img src={logoSava} alt="SAVA servicios deportivos" className="h-full w-auto" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                    Sava Servicios
                  </h1>
                </div>
                <p className="text-xs text-slate-400">Planificador y optimizador de rutas técnicas</p>
              </div>
            </div>

            {/* Date Picker on Mobile */}
            <div className="md:hidden flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-200 outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Metrics KPI Bar */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Total / Asignados */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Asignados:</span>
              <span className="font-semibold text-emerald-300">{metrics.assignedJobs} / {metrics.totalJobs}</span>
            </div>

            {/* Sin Asignar */}
            {metrics.unassignedJobs > 0 ? (
              <button
                onClick={onOpenConflicts}
                className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-300 transition-colors cursor-pointer"
                title="Ver servicios pendientes sin asignar"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="font-semibold">{metrics.unassignedJobs} sin asignar</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% asignados</span>
              </div>
            )}

            {/* Conflictos */}
            {metrics.conflictsCount > 0 && (
              <button
                onClick={onOpenConflicts}
                className="flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 transition-colors cursor-pointer animate-pulse"
                title="Hay conflictos horarios o de competencias"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-bold">{metrics.conflictsCount} alertas</span>
              </button>
            )}

            {/* Ahorro Km */}
            <div className="hidden lg:flex items-center gap-1.5 bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-700/40 text-indigo-300">
              <Route className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ahorro est.: <strong className="text-indigo-200">~{metrics.totalKmSavedEstimate} km</strong></span>
            </div>

            {/* Date selector desktop */}
            <div className="hidden md:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-200 outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {canEdit && (<>
            <button
              onClick={onOptimize}
              disabled={isOptimizing}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium text-xs transition-all shadow-md cursor-pointer ${
                isOptimizing
                  ? 'bg-blue-700 text-blue-200 cursor-not-allowed opacity-75'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-95'
              }`}
              title="Asignar y ordenar paradas inteligentemente para minimizar desplazamientos"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${isOptimizing ? 'animate-spin' : ''}`} />
              <span>{isOptimizing ? 'Optimizando...' : 'Optimizar Rutas'}</span>
            </button>

            <button
              onClick={onOpenNewService}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
              title="Registrar nuevo servicio"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Servicio</span>
            </button>

            <button
              onClick={onOpenNewTechnician}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
              title="Registrar nuevo técnico"
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Técnico</span>
            </button>
            </>)}

            <button
              onClick={onOpenExport}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
              title="Exportar hoja de ruta / WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-300" />
            </button>

            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Avisos y Notificaciones Web Push"
            >
              <Bell className="w-4 h-4 text-slate-200" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="hidden md:block bg-slate-950/60 border-t border-slate-800 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex gap-1 lg:gap-1.5 overflow-x-auto lg:overflow-visible lg:flex-wrap lg:justify-between py-1 scrollbar-none">
          <button
            onClick={() => setCurrentTab('map')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'map'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Mapa</span>
          </button>

          <button
            onClick={() => setCurrentTab('timeline')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'timeline'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Agenda</span>
          </button>

          <button
            onClick={() => setCurrentTab('services')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'services'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Servicios ({metrics.totalJobs})</span>
            {metrics.unassignedJobs > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('technicians')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'technicians'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Equipo ({metrics.totalActiveTechs})</span>
          </button>

          <button
            onClick={() => setCurrentTab('tickets')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'tickets'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Averías</span>
            {newTicketsCount > 0 && (
              <span className="text-[10px] font-bold bg-rose-500 text-white rounded-full px-1.5 py-0.5" title="Avisos pendientes">
                {newTicketsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('deliveries')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'deliveries'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Entregas</span>
            {pendingDeliveriesCount > 0 && (
              <span className="text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5" title="Entregas pendientes de meter en ruta">
                {pendingDeliveriesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('workorders')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'workorders'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            <span>Partes</span>
          </button>

          <button
            onClick={() => setCurrentTab('vans')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'vans'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Furgonetas</span>
            {vanWarningsCount > 0 && (
              <span className="text-[10px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5" title="ITV en menos de 30 días o mantenimiento a menos de 1.000 km">
                {vanWarningsCount}
              </span>
            )}
          </button>

          {canEdit && (
          <button
            onClick={() => setCurrentTab('stock')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'stock'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Pedidos</span>
          </button>
          )}

          <button
            onClick={() => setCurrentTab('analytics')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'analytics'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Estadísticas</span>
          </button>

          <button
            onClick={() => setCurrentTab('worker')}
            className={`flex items-center gap-2 py-2 px-3 lg:px-2.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'worker'
                ? 'bg-emerald-600/25 text-emerald-400 border border-emerald-500/40 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Vista móvil que ven los trabajadores en su teléfono"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">Modo técnico</span>
          </button>
        </div>
      </div>
    </header>
  );
};
