import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Wrench,
  Users,
  AlertOctagon,
  Package,
  FileSignature,
  Truck,
  TrendingUp,
  Smartphone,
  Menu,
  X,
  Zap,
  Plus,
  Share2,
  Building2,
  LogOut,
} from 'lucide-react';
import type { AppTab } from './Header';

interface MobileNavProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  isTechnician: boolean;
  canEdit: boolean;
  newTicketsCount: number;
  pendingDeliveriesCount: number;
  vanWarningsCount: number;
  unassignedCount: number;
  email?: string | null;
  onOptimize: () => void;
  onOpenNewService: () => void;
  onOpenNewTechnician: () => void;
  onOpenExport: () => void;
  onOpenCompany: () => void;
  onSignOut: () => void;
}

const TABS: Record<AppTab, { label: string; icon: React.ElementType }> = {
  worker: { label: 'Mi ruta', icon: Smartphone },
  map: { label: 'Mapa', icon: MapPin },
  timeline: { label: 'Agenda', icon: Clock },
  services: { label: 'Servicios', icon: Wrench },
  technicians: { label: 'Equipo', icon: Users },
  tickets: { label: 'Averías', icon: AlertOctagon },
  deliveries: { label: 'Entregas', icon: Package },
  workorders: { label: 'Partes', icon: FileSignature },
  vans: { label: 'Furgonetas', icon: Truck },
  analytics: { label: 'Estadísticas', icon: TrendingUp },
};

/** Phone navigation: the four most used sections always at hand at the bottom, the rest under "Más". */
export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  setCurrentTab,
  isTechnician,
  canEdit,
  newTicketsCount,
  pendingDeliveriesCount,
  vanWarningsCount,
  unassignedCount,
  email,
  onOptimize,
  onOpenNewService,
  onOpenNewTechnician,
  onOpenExport,
  onOpenCompany,
  onSignOut,
}) => {
  const [open, setOpen] = useState(false);

  const main: AppTab[] = isTechnician
    ? ['worker', 'map', 'workorders', 'tickets']
    : ['map', 'services', 'tickets', 'deliveries'];
  const rest = (Object.keys(TABS) as AppTab[]).filter((t) => !main.includes(t));

  const badge = (tab: AppTab) =>
    tab === 'tickets' ? newTicketsCount : tab === 'deliveries' ? pendingDeliveriesCount : tab === 'vans' ? vanWarningsCount : tab === 'services' ? unassignedCount : 0;

  const go = (tab: AppTab) => {
    setCurrentTab(tab);
    setOpen(false);
    window.scrollTo({ top: 0 });
  };
  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  const restActive = rest.includes(currentTab);

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/50" onClick={() => setOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-2xl p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-slate-900">Más secciones</span>
              <button onClick={() => setOpen(false)} className="p-2 -m-2 text-slate-500" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {rest.map((tab) => {
                const { label, icon: Icon } = TABS[tab];
                const n = badge(tab);
                return (
                  <button
                    key={tab}
                    onClick={() => go(tab)}
                    className={`relative flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold ${
                      currentTab === tab ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab === 'worker' ? 'Modo técnico' : label}
                    {n > 0 && <span className="absolute top-1.5 right-2 text-[10px] font-bold bg-rose-500 text-white rounded-full px-1.5">{n}</span>}
                  </button>
                );
              })}
            </div>

            {canEdit && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-semibold">
                <button onClick={() => run(onOpenNewService)} className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-600 text-white">
                  <Plus className="w-4 h-4" />Nuevo servicio
                </button>
                <button onClick={() => run(onOptimize)} className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-indigo-600 text-white">
                  <Zap className="w-4 h-4 text-amber-300" />Optimizar rutas
                </button>
                <button onClick={() => run(onOpenNewTechnician)} className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-100 text-slate-800">
                  <Users className="w-4 h-4" />Nuevo técnico
                </button>
                <button onClick={() => run(onOpenCompany)} className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-100 text-slate-800">
                  <Building2 className="w-4 h-4" />Datos empresa
                </button>
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-semibold">
              <button onClick={() => run(onOpenExport)} className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-100 text-slate-800">
                <Share2 className="w-4 h-4" />Hoja de ruta
              </button>
              {email && (
                <button onClick={() => run(onSignOut)} className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-100 text-slate-800">
                  <LogOut className="w-4 h-4" />Salir
                </button>
              )}
            </div>
            {email && <div className="mt-3 text-center text-[11px] text-slate-400">{email}</div>}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {main.map((tab) => {
            const { label, icon: Icon } = TABS[tab];
            const active = currentTab === tab && !open;
            const n = badge(tab);
            return (
              <button
                key={tab}
                onClick={() => go(tab)}
                className={`relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold ${active ? 'text-blue-400' : 'text-slate-400'}`}
              >
                <Icon className="w-6 h-6" />
                {label}
                {n > 0 && <span className="absolute top-1 left-1/2 ml-1.5 text-[10px] font-bold bg-rose-500 text-white rounded-full px-1.5 leading-4">{n}</span>}
                {active && <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-blue-400" />}
              </button>
            );
          })}
          <button
            onClick={() => setOpen(!open)}
            className={`relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold ${open || restActive ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <Menu className="w-6 h-6" />
            <span className="truncate max-w-full px-1">{restActive && !open ? (currentTab === 'worker' ? 'Técnico' : TABS[currentTab].label) : 'Más'}</span>
            {(open || restActive) && <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-blue-400" />}
          </button>
        </div>
      </nav>
    </>
  );
};
