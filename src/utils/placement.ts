import { ServiceJob, Technician } from '../types';
import { calculateTechnicianRoute, hasRequiredSkills, technicianForDate } from './optimizer';
import { timeStringToMinutes } from './geo';

/**
 * A job with no agreed time goes where it fits best in the technician's day: every gap in the
 * route is tried (never before work already started or done) and the one that ends the day
 * earliest without new warnings wins. Without a technician, the best one for that day is chosen.
 * Works on the per-technician list (team jobs expanded) and returns it with the new order.
 */
export function placeFlexibleJob(
  jobId: string,
  services: ServiceJob[],
  technicians: Technician[]
): { services: ServiceJob[]; technicianId: string | null; arrival?: string } {
  const copies = services.filter((s) => (s.teamParentId ?? s.id) === jobId);
  const job = copies[0];
  if (!job) return { services, technicianId: null };

  const bestSpot = (tech: Technician, slotJob: ServiceJob) => {
    const day = services
      .filter((s) => s.assignedTechnicianId === tech.id && s.date === slotJob.date && s.id !== slotJob.id && s.status !== 'cancelado')
      .sort((a, b) => a.manualOrder - b.manualOrder);
    let firstFree = 0;
    day.forEach((s, i) => {
      if (s.status === 'completado' || s.status === 'en_progreso' || s.inSituReport?.startedAt) firstFree = i + 1;
    });
    const dayTech = technicianForDate(tech, slotJob.date);
    const followDeparture = !!tech.startTimeOverrides?.[slotJob.date];
    let best: { index: number; score: number; order: ServiceJob[]; arrival?: string } | null = null;
    for (let i = firstFree; i <= day.length; i++) {
      const order = [...day.slice(0, i), { ...slotJob, assignedTechnicianId: tech.id }, ...day.slice(i)].map((s, n) => ({
        ...s,
        manualOrder: n,
      }));
      const route = calculateTechnicianRoute(dayTech, order.map((s) => ({ ...s })), followDeparture);
      // Jobs with a time agreed with the customer should not start later because of this one
      const lateness = route.stops.reduce((sum, st) => {
        const sj = st.service;
        if (!sj || sj.id === slotJob.id || sj.timeSlot.type === 'cualquiera') return sum;
        return sum + Math.max(0, timeStringToMinutes(st.arrivalTime) - timeStringToMinutes(sj.timeSlot.startHour));
      }, 0);
      const score =
        route.conflictsCount * 3000 + lateness * 100 + timeStringToMinutes(route.estimatedEndTime) + route.totalTravelMinutes * 0.5;
      if (!best || score < best.score) {
        const stop = route.stops.find((st) => st.service?.id === slotJob.id);
        best = { index: i, score, order, arrival: stop?.arrivalTime };
      }
    }
    return best!;
  };

  let next = services;
  let arrival: string | undefined;
  const apply = (order: ServiceJob[]) => {
    const byId = new Map(order.map((s) => [s.id, s]));
    next = next.map((s) => byId.get(s.id) ?? s);
  };

  if (!job.assignedTechnicianId) {
    // No technician chosen: the qualified one who fits it best that day
    const candidates = technicians.filter((t) => t.availability?.isAvailableToday !== false && hasRequiredSkills(t, job.requiredSkills));
    const pool = candidates.length ? candidates : technicians;
    let pick: { tech: Technician; spot: ReturnType<typeof bestSpot> } | null = null;
    pool.forEach((tech) => {
      const spot = bestSpot(tech, job);
      if (!pick || spot.score < pick.spot.score) pick = { tech, spot };
    });
    if (!pick) return { services, technicianId: null };
    const { tech, spot } = pick as { tech: Technician; spot: ReturnType<typeof bestSpot> };
    apply(spot.order.map((s) => (s.id === job.id ? { ...s, status: 'asignado' as const } : s)));
    return { services: next, technicianId: tech.id, arrival: spot.arrival };
  }

  copies.forEach((copy) => {
    const tech = technicians.find((t) => t.id === copy.assignedTechnicianId);
    if (!tech) return;
    const spot = bestSpot(tech, copy);
    if (!arrival) arrival = spot.arrival;
    apply(spot.order);
  });
  return { services: next, technicianId: job.assignedTechnicianId, arrival };
}
