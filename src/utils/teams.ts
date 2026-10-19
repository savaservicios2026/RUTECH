import { ServiceJob } from '../types';

/**
 * A job several technicians do together is one record with every technician in
 * `assignedTechnicianIds`. To plan routes, the app shows it once in each technician's day: the lead
 * keeps the record's id, the others get a copy with id `<id>~<technicianId>`. Edits made on any copy
 * are folded back into the one record, so changing the job changes it for the whole team.
 */

// Worked out per device from the route, never part of the record
const COMPUTED_KEYS = new Set(['scheduledArrival', 'scheduledDeparture', 'travelTimeFromPrev', 'distanceKmFromPrev', 'conflict']);

export const teamIds = (job: ServiceJob): string[] =>
  job.assignedTechnicianIds?.length ? job.assignedTechnicianIds : job.assignedTechnicianId ? [job.assignedTechnicianId] : [];

export const isTeamJob = (job: ServiceJob) => teamIds(job).length > 1;

export const baseIdOf = (id: string) => id.split('~')[0];

export function expandTeams(services: ServiceJob[]): ServiceJob[] {
  const out: ServiceJob[] = [];
  services.forEach((job) => {
    const ids = teamIds(job);
    if (ids.length <= 1) {
      out.push(job);
      return;
    }
    ids.forEach((techId, i) => {
      const manualOrder = job.manualOrderByTech?.[techId] ?? job.manualOrder;
      out.push(
        i === 0
          ? { ...job, assignedTechnicianId: techId, manualOrder }
          : { ...job, id: `${job.id}~${techId}`, assignedTechnicianId: techId, manualOrder, teamParentId: job.id }
      );
    });
  });
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Folds a changed expanded list back into the stored records. */
export function collapseTeams(prevExpanded: ServiceJob[], nextExpanded: ServiceJob[], stored: ServiceJob[]): ServiceJob[] {
  const prevById = new Map(prevExpanded.map((s) => [s.id, s]));
  const drafts = new Map(stored.map((s) => [s.id, s]));
  const added: ServiceJob[] = [];
  const nextIds = new Set(nextExpanded.map((s) => s.id));

  nextExpanded.forEach((item) => {
    const prev = prevById.get(item.id);
    if (!prev) {
      const { teamParentId, ...rest } = item;
      added.push(rest as ServiceJob);
      return;
    }
    if (prev === item) return;
    const baseId = item.teamParentId ?? item.id;
    const base = drafts.get(baseId);
    if (!base) return;
    const draft: ServiceJob = { ...base };
    const team = isTeamJob(base);
    const slotTech = prev.assignedTechnicianId;

    Object.keys({ ...prev, ...item }).forEach((key) => {
      if (key === 'id' || key === 'teamParentId' || COMPUTED_KEYS.has(key)) return;
      const value = (item as any)[key];
      if (same((prev as any)[key], value)) return;
      if (key === 'manualOrder' && team && slotTech) {
        draft.manualOrderByTech = { ...(draft.manualOrderByTech || {}), [slotTech]: value };
        if (slotTech === teamIds(base)[0]) draft.manualOrder = value;
      } else if (key === 'assignedTechnicianId' && team) {
        let ids = teamIds(draft).map((t) => (t === slotTech ? value : t)).filter(Boolean) as string[];
        ids = ids.filter((t, i) => ids.indexOf(t) === i);
        draft.assignedTechnicianIds = ids;
        draft.assignedTechnicianId = ids[0] ?? null;
      } else {
        (draft as any)[key] = value;
      }
    });
    drafts.set(baseId, draft);
  });

  // Removing any copy of a job removes the job
  const removed = new Set(
    prevExpanded.filter((s) => !nextIds.has(s.id)).map((s) => s.teamParentId ?? s.id)
  );
  return [...added, ...stored.filter((s) => !removed.has(s.id)).map((s) => drafts.get(s.id)!)];
}
