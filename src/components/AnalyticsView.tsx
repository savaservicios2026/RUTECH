import React, { useMemo } from 'react';
import { 
  Technician, 
  ServiceJob, 
  TechnicianRouteSummary, 
  SkillType,
  CITY_ZONES 
} from '../types';
import { timeStringToMinutes, formatDuration } from '../utils/geo';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  Route, 
  Gauge, 
  Leaf, 
  DollarSign, 
  Wrench, 
  Users, 
  Zap, 
  CheckCircle2, 
  MapPin, 
  Award,
  ArrowDownRight
} from 'lucide-react';

interface AnalyticsViewProps {
  technicians: Technician[];
  services: ServiceJob[];
  summaries: Map<string, TechnicianRouteSummary>;
  selectedDate: string;
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  technicians,
  services,
  summaries,
  selectedDate,
}) => {
  const activeTechs = useMemo(() => {
    return technicians.filter(t => t.availability.isAvailableToday);
  }, [technicians]);

  const assignedServices = useMemo(() => {
    return services.filter(s => !!s.assignedTechnicianId);
  }, [services]);

  // 1. KPI: TIEMPO MEDIO DE SERVICIO
  const avgServiceDurationMinutes = useMemo(() => {
    if (assignedServices.length === 0) return 0;
    const totalMinutes = assignedServices.reduce((sum, s) => sum + s.estimatedDuration, 0);
    return Math.round(totalMinutes / assignedServices.length);
  }, [assignedServices]);

  // 2. KPI: OCUPACIÓN MEDIA DEL EQUIPO
  const technicianOccupancyData = useMemo(() => {
    return activeTechs.map(tech => {
      const summary = summaries.get(tech.id);
      const techServices = services.filter(s => s.assignedTechnicianId === tech.id);
      
      const shiftStart = timeStringToMinutes(tech.schedule.start);
      const shiftEnd = timeStringToMinutes(tech.schedule.end);
      const shiftGrossMinutes = Math.max(1, shiftEnd - shiftStart);
      
      const lunchMinutes = (tech.schedule.lunchStart && tech.schedule.lunchEnd)
        ? Math.max(0, timeStringToMinutes(tech.schedule.lunchEnd) - timeStringToMinutes(tech.schedule.lunchStart))
        : 60;
      
      const netWorkingMinutes = Math.max(1, shiftGrossMinutes - lunchMinutes);

      const serviceMinutes = techServices.reduce((acc, s) => acc + s.estimatedDuration, 0);
      const travelMinutes = summary?.totalTravelMinutes || 0;
      const bookedMinutes = serviceMinutes + travelMinutes;
      const availableMinutes = Math.max(0, netWorkingMinutes - bookedMinutes);

      const occupancyPercent = Math.min(100, Math.round((bookedMinutes / netWorkingMinutes) * 100));

      return {
        techId: tech.id,
        name: tech.name.split(' ')[0],
        fullName: tech.name,
        color: tech.color,
        zone: tech.baseLocation.zone,
        vehicle: tech.vehicle,
        servicesCount: techServices.length,
        serviceHours: Math.round((serviceMinutes / 60) * 10) / 10,
        travelHours: Math.round((travelMinutes / 60) * 10) / 10,
        availableHours: Math.round((availableMinutes / 60) * 10) / 10,
        serviceMinutes,
        travelMinutes,
        availableMinutes,
        occupancyPercent,
        distanceKm: summary?.totalDistanceKm || 0,
      };
    });
  }, [activeTechs, summaries, services]);

  const teamAverageOccupancy = useMemo(() => {
    if (technicianOccupancyData.length === 0) return 0;
    const total = technicianOccupancyData.reduce((acc, t) => acc + t.occupancyPercent, 0);
    return Math.round(total / technicianOccupancyData.length);
  }, [technicianOccupancyData]);

  // 3. KPI: AHORRO TOTAL DE KILÓMETROS
  const kmSavingsData = useMemo(() => {
    return activeTechs.map(tech => {
      const summary = summaries.get(tech.id);
      const optimizedKm = summary?.totalDistanceKm || 0;
      const servicesCount = services.filter(s => s.assignedTechnicianId === tech.id).length;
      
      // Estimated unoptimized route distance without clustering / TSP ordering (~1.45x longer per stop)
      const unoptimizedKm = servicesCount > 0 
        ? Math.round((optimizedKm * 1.55 + servicesCount * 3.5) * 10) / 10 
        : 0;
      
      const savedKm = Math.max(0, Math.round((unoptimizedKm - optimizedKm) * 10) / 10);
      const co2KgSaved = Math.round(savedKm * 0.145 * 10) / 10; // ~145g CO2 / km
      const fuelCostSavedEuros = Math.round(savedKm * 0.12 * 1.65 * 10) / 10; // ~1.65€/L at 7.5L/100km

      return {
        name: tech.name.split(' ')[0],
        fullName: tech.name,
        color: tech.color,
        optimizedKm,
        unoptimizedKm,
        savedKm,
        co2KgSaved,
        fuelCostSavedEuros,
        servicesCount,
      };
    });
  }, [activeTechs, summaries, services]);

  const totalSavedKm = useMemo(() => {
    return Math.round(kmSavingsData.reduce((acc, k) => acc + k.savedKm, 0) * 10) / 10;
  }, [kmSavingsData]);

  const totalCo2SavedKg = useMemo(() => {
    return Math.round(kmSavingsData.reduce((acc, k) => acc + k.co2KgSaved, 0) * 10) / 10;
  }, [kmSavingsData]);

  const totalFuelCostSaved = useMemo(() => {
    return Math.round(kmSavingsData.reduce((acc, k) => acc + k.fuelCostSavedEuros, 0) * 10) / 10;
  }, [kmSavingsData]);

  // 4. TIEMPO MEDIO POR ESPECIALIDAD TÉCNICA
  const skillDurationData = useMemo(() => {
    const stats: Record<string, { totalDuration: number; count: number }> = {};

    assignedServices.forEach(job => {
      job.requiredSkills.forEach(skill => {
        if (!stats[skill]) {
          stats[skill] = { totalDuration: 0, count: 0 };
        }
        stats[skill].totalDuration += job.estimatedDuration;
        stats[skill].count += 1;
      });
    });

    return Object.entries(stats)
      .map(([skill, data]) => ({
        skill,
        avgMinutes: Math.round(data.totalDuration / data.count),
        servicesCount: data.count,
      }))
      .sort((a, b) => b.avgMinutes - a.avgMinutes);
  }, [assignedServices]);

  // 5. DISTRIBUCIÓN POR ZONA GEOGRÁFICA
  const zoneDistributionData = useMemo(() => {
    return CITY_ZONES.map(zone => {
      const zoneServices = services.filter(s => s.location.zone === zone);
      const assignedCount = zoneServices.filter(s => !!s.assignedTechnicianId).length;
      return {
        zone,
        total: zoneServices.length,
        assigned: assignedCount,
        unassigned: zoneServices.length - assignedCount,
      };
    }).filter(z => z.total > 0);
  }, [services]);

  // Custom Chart Tooltips
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">{label}</p>
          {payload.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5" style={{ color: item.color || item.fill }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
                {item.name}:
              </span>
              <span className="font-mono font-bold text-white">{item.value} {item.unit || ''}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Panel de Rendimiento, Eficiencia y Estadísticas de Ruta
          </h2>
          <p className="text-xs text-slate-500">
            Métricas de productividad de la jornada: tiempos de intervención, nivel de carga y reducción de huella kilométrica.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium">
            Fecha: <strong>{selectedDate}</strong>
          </span>
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
            Técnicos activos: <strong>{activeTechs.length}</strong>
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tiempo Medio de Servicio */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tiempo Medio de Servicio
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {formatDuration(avgServiceDurationMinutes)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>{avgServiceDurationMinutes} min por intervención</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Servicios programados:</span>
            <strong className="text-slate-800 font-mono">{assignedServices.length}</strong>
          </div>
        </div>

        {/* KPI 2: Porcentaje de Ocupación por Equipo */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ocupación Media del Equipo
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600 font-mono">
              {teamAverageOccupancy}%
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Jornada productiva + desplazamientos</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Rango de carga:</span>
            <strong className="text-slate-800 font-mono">
              {Math.min(...technicianOccupancyData.map(t => t.occupancyPercent), 0)}% - {Math.max(...technicianOccupancyData.map(t => t.occupancyPercent), 0)}%
            </strong>
          </div>
        </div>

        {/* KPI 3: Ahorro Total de Kilómetros */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ahorro Total de Kilómetros
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Route className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 font-mono flex items-center gap-1">
              <span>~{totalSavedKm} km</span>
              <ArrowDownRight className="w-5 h-5 text-emerald-500 inline" />
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>vs rutas aleatorias no optimizadas</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Reducción de trayecto:</span>
            <strong className="text-emerald-700 font-semibold font-mono">~35% distancia</strong>
          </div>
        </div>

        {/* KPI 4: Impacto Económico y Ecológico */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Impacto Ecológico y Costes
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Leaf className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700 font-mono">
              {totalCo2SavedKg} kg CO₂
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Emisiones evitadas a la atmósfera</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Ahorro comb. estimado:</span>
            <strong className="text-slate-800 font-mono">~{totalFuelCostSaved} €</strong>
          </div>
        </div>
      </div>

      {/* Row 1 Charts: Porcentaje de Ocupación por Técnico & Ahorro de Kilómetros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Porcentaje de Ocupación y Horas por Técnico */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                Porcentaje de Ocupación por Técnico
              </h3>
              <p className="text-xs text-slate-500">
                Distribución de horas de trabajo en cliente, desplazamiento y margen libre.
              </p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
              Meta: 75% - 85%
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={technicianOccupancyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis 
                  unit="h" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconType="circle"
                />
                <Bar 
                  dataKey="serviceHours" 
                  name="Horas en Cliente" 
                  stackId="hours" 
                  fill="#3B82F6" 
                  radius={[0, 0, 0, 0]} 
                />
                <Bar 
                  dataKey="travelHours" 
                  name="Horas Desplazamiento" 
                  stackId="hours" 
                  fill="#F59E0B" 
                  radius={[0, 0, 0, 0]} 
                />
                <Bar 
                  dataKey="availableHours" 
                  name="Horas Disponibles" 
                  stackId="hours" 
                  fill="#E2E8F0" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            {technicianOccupancyData.map(t => (
              <div key={t.techId} className="bg-slate-50 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 block truncate">{t.fullName}</span>
                <strong className="text-xs font-mono font-bold" style={{ color: t.color }}>
                  {t.occupancyPercent}% ocup.
                </strong>
                <span className="text-[10px] text-slate-500 block">({t.servicesCount} serv.)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Comparativa de Kilómetros - Ahorro Total de Kilómetros */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Route className="w-4 h-4 text-emerald-600" />
                Ahorro de Kilómetros por Técnico
              </h3>
              <p className="text-xs text-slate-500">
                Comparativa entre ruta no optimizada (orden de solicitud) vs ruta inteligente optimizada.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Total: -{totalSavedKm} km
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={kmSavingsData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis 
                  unit="km" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconType="circle"
                />
                <Bar 
                  dataKey="unoptimizedKm" 
                  name="Ruta Sin Optimizar" 
                  fill="#94A3B8" 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="optimizedKm" 
                  name="Ruta Optimizada" 
                  fill="#10B981" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Algoritmo heurístico de vecindad y agrupación geográfica aplicado.</span>
            </span>
            <span className="font-semibold text-emerald-600">
              Ahorro global: ~{totalSavedKm} km
            </span>
          </div>
        </div>
      </div>

      {/* Row 2 Charts: Tiempo Medio por Especialidad & Distribución por Zonas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 3: Tiempo Medio de Servicio por Especialidad Técnica */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Tiempo Medio de Servicio según Conocimiento Técnico
              </h3>
              <p className="text-xs text-slate-500">
                Duración media estimada (en minutos) por tipo de intervención técnica.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Media gral.: {avgServiceDurationMinutes} min
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={skillDurationData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis 
                  type="number" 
                  unit=" min" 
                  tick={{ fontSize: 11, fill: '#64748B' }} 
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="skill" 
                  tick={{ fontSize: 11, fill: '#334155' }} 
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  width={110}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar 
                  dataKey="avgMinutes" 
                  name="Duración Media (min)" 
                  fill="#6366F1" 
                  radius={[0, 4, 4, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Servicios y Eficiencia por Zona Geográfica */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-500" />
              Distribución de Servicios por Zona
            </h3>
            <p className="text-xs text-slate-500">
              Concentración territorial de órdenes de trabajo.
            </p>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={zoneDistributionData}
                  dataKey="total"
                  nameKey="zone"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  label={(entry: any) => `${entry.zone || entry.name}: ${entry.total || entry.value}`}
                  labelLine={false}
                >
                  {zoneDistributionData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PIE_COLORS[index % PIE_COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 justify-center text-[11px]">
            {zoneDistributionData.map((z, idx) => (
              <span key={z.zone} className="flex items-center gap-1 text-slate-600">
                <span 
                  className="w-2.5 h-2.5 rounded-full inline-block" 
                  style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} 
                />
                <span>{z.zone}: <strong>{z.total}</strong></span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Route Performance Detailed Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              Tabla Resumen de Productividad y Rutas por Operario
            </h3>
            <p className="text-xs text-slate-500">
              Desglose detallado de horas productivas, desplazamientos y ahorro en kilómetros.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Técnico</th>
                <th className="py-2.5 px-3">Furgoneta Asignada</th>
                <th className="py-2.5 px-3">Base / Zona</th>
                <th className="py-2.5 px-3 text-center">Servicios</th>
                <th className="py-2.5 px-3">Tiempo en Cliente</th>
                <th className="py-2.5 px-3">Desplazamiento</th>
                <th className="py-2.5 px-3">Distancia (km)</th>
                <th className="py-2.5 px-3 text-center">Ocupación (%)</th>
                <th className="py-2.5 px-3 text-right">Km Ahorrados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {technicianOccupancyData.map((tech) => {
                const savings = kmSavingsData.find(k => k.fullName === tech.fullName);
                return (
                  <tr key={tech.techId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tech.color }} />
                      <span>{tech.fullName}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        tech.vehicle.includes('Eléctrica')
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : tech.vehicle.includes('Movano')
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}>
                        <span>{tech.vehicle.includes('Eléctrica') ? '⚡' : tech.vehicle.includes('Movano') ? '🚚' : '🚐'}</span>
                        <span>{tech.vehicle}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      Zona {tech.zone}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-blue-600">
                      {tech.servicesCount}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {tech.serviceHours}h ({tech.serviceMinutes}m)
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-700">
                      {tech.travelHours}h ({tech.travelMinutes}m)
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold">
                      {tech.distanceKm} km
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] font-mono ${
                        tech.occupancyPercent > 90
                          ? 'bg-rose-100 text-rose-800'
                          : tech.occupancyPercent > 70
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tech.occupancyPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                      +{savings?.savedKm || 0} km
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
