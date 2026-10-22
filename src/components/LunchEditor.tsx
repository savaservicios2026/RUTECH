import React from 'react';
import { Technician } from '../types';

interface LunchEditorProps {
  technician: Technician;
  date: string;
  planned?: { start: string; end: string }; // where the break falls in the route
  onChange: (technicianId: string, date: string, lunch: { start: string; minutes: number } | null) => void;
}

const DURATIONS = [30, 45, 60, 90];

/** The lunch break of one day: from what time and how long. The route makes room for it. */
export const LunchEditor: React.FC<LunchEditorProps> = ({ technician, date, planned, onChange }) => {
  const plan = technician.lunchByDate?.[date];
  if (!plan) {
    return (
      <button
        type="button"
        onClick={() => onChange(technician.id, date, { start: technician.schedule.lunchStart || '14:00', minutes: 60 })}
        className="px-2.5 py-1 rounded-md border border-dashed border-slate-400 text-slate-600 text-[11px] font-semibold cursor-pointer hover:bg-slate-50"
      >
        🍽 Añadir hora de comer
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="font-semibold text-slate-700">🍽 Comida desde</span>
      <input
        type="time"
        value={plan.start}
        onChange={(e) => e.target.value && onChange(technician.id, date, { ...plan, start: e.target.value })}
        className="font-mono font-semibold rounded-md px-1.5 py-0.5 border bg-orange-50 border-orange-300 text-orange-900"
      />
      <select
        value={plan.minutes}
        onChange={(e) => onChange(technician.id, date, { ...plan, minutes: Number(e.target.value) })}
        className="rounded-md px-1 py-0.5 border border-orange-300 bg-orange-50 text-orange-900 font-semibold"
      >
        {DURATIONS.map((m) => (
          <option key={m} value={m}>
            {m} min
          </option>
        ))}
      </select>
      {planned && <span className="text-slate-500">(en ruta {planned.start}–{planned.end})</span>}
      <button
        type="button"
        onClick={() => onChange(technician.id, date, null)}
        className="text-[10px] font-semibold text-slate-500 underline cursor-pointer"
      >
        quitar
      </button>
    </span>
  );
};

/** The lunch break shown in the route between the stops it falls between. */
export const LunchStop: React.FC<{ lunch: { start: string; end: string }; className?: string }> = ({ lunch, className = '' }) => (
  <div className={`flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900 ${className}`}>
    <span className="text-base leading-none">🍽</span>
    <span className="font-bold">Comida</span>
    <span className="font-mono font-semibold">{lunch.start} – {lunch.end}</span>
  </div>
);

/** Index of the first stop that comes after the lunch break (stops.length if it is after all of them). */
export const lunchSlot = (stops: { scheduledArrival?: string }[], lunch?: { start: string; end: string }) => {
  if (!lunch) return -1;
  const i = stops.findIndex((s) => (s.scheduledArrival || '') >= lunch.end);
  return i === -1 ? stops.length : i;
};
