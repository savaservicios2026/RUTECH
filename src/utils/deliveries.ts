import { Delivery, ServiceJob, Technician } from '../types';
import { calculateDistanceKm } from './geo';

export interface DeliverySuggestion {
  technician: Technician;
  date: string;
  insertIndex: number; // position in that day's route (0 = first stop)
  detourKm: number; // extra km compared with the planned route
  nearestKm: number; // distance to the closest point of that route (a job or the base)
  nearestName: string;
  between: string; // "entre X y Y"
}

// Routes that would need a longer detour than this are not proposed
const MAX_DETOUR_KM = 40;

const point = (lat: number, lng: number) => ({ lat, lng });
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => calculateDistanceKm(a.lat, a.lng, b.lat, b.lng);
const shortName = (s: ServiceJob) => s.customerName.split('(')[0].trim();

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * For each planned day of each technician (starting point -> jobs), works out where the delivery
 * fits with the smallest detour, and how close it is to that day's jobs. Best options first.
 */
export function suggestRoutesForDelivery(
  delivery: Delivery,
  services: ServiceJob[],
  technicians: Technician[],
  fromDate = todayIso(),
  daysAhead = 14
): DeliverySuggestion[] {
  const until = new Date(`${fromDate}T12:00:00`);
  until.setDate(until.getDate() + daysAhead);
  const lastDate = until.toISOString().split('T')[0];
  const target = point(delivery.location.lat, delivery.location.lng);

  const routes = new Map<string, ServiceJob[]>();
  services.forEach((s) => {
    if (!s.assignedTechnicianId || s.status === 'cancelado' || s.status === 'completado') return;
    if (s.date < fromDate || s.date > lastDate) return;
    if (delivery.deadline && s.date > delivery.deadline) return;
    if (delivery.serviceId && s.id === delivery.serviceId) return;
    const key = `${s.assignedTechnicianId}|${s.date}`;
    routes.set(key, [...(routes.get(key) || []), s]);
  });

  const suggestions: DeliverySuggestion[] = [];
  routes.forEach((jobs, key) => {
    const [techId, date] = key.split('|');
    const technician = technicians.find((t) => t.id === techId);
    if (!technician) return;
    const ordered = [...jobs].sort((a, b) => a.manualOrder - b.manualOrder);
    const base = point(technician.baseLocation.lat, technician.baseLocation.lng);
    // Routes start at the technician's starting point and end at the last job (everyone goes home from there)
    const stops = [base, ...ordered.map((j) => point(j.location.lat, j.location.lng))];
    const names = ['su salida', ...ordered.map(shortName)];

    let best = { index: 0, detour: Infinity };
    for (let i = 0; i < stops.length; i++) {
      const detour =
        i === stops.length - 1
          ? km(stops[i], target)
          : km(stops[i], target) + km(target, stops[i + 1]) - km(stops[i], stops[i + 1]);
      if (detour < best.detour) best = { index: i, detour };
    }
    let nearestName = names[0];
    let nearestKm = Infinity;
    stops.forEach((p, i) => {
      const d = km(p, target);
      if (d < nearestKm) {
        nearestKm = d;
        nearestName = names[i];
      }
    });
    if (best.detour > MAX_DETOUR_KM) return;

    suggestions.push({
      technician,
      date,
      insertIndex: best.index,
      detourKm: Math.max(0, Math.round(best.detour * 10) / 10),
      nearestKm: Math.round(nearestKm * 10) / 10,
      nearestName,
      between: best.index === stops.length - 1 ? `después de ${names[best.index]}` : `entre ${names[best.index]} y ${names[best.index + 1]}`,
    });
  });

  // Smallest detour first; being close to a stop of the route breaks near-ties
  const score = (s: DeliverySuggestion) => s.detourKm + s.nearestKm * 0.1;
  return suggestions.sort((a, b) => score(a) - score(b) || a.date.localeCompare(b.date));
}

/** Status shown for a delivery: delivered once its route stop is completed. */
export function deliveryStatus(delivery: Delivery, services: ServiceJob[]): Delivery['status'] {
  if (delivery.status === 'entregada') return 'entregada';
  const job = delivery.serviceId ? services.find((s) => s.id === delivery.serviceId) : undefined;
  if (!job) return 'pendiente';
  return job.status === 'completado' ? 'entregada' : 'planificada';
}
