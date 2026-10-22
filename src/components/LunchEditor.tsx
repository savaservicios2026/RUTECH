import React, { useState } from 'react';
import { Technician } from '../types';

interface LunchEditorProps {
  technician: Technician;
  date: string;
  planned?: { start: string; end: string }; // where the break falls in the route
  onChange: (technicianId: string, date: string, lunch: { start: string; minutes: number } | null) => void;
}

const DURATIONS = [15, 30, 45, 60, 90, 120];

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** The lunch break of one day: from what time and how long, or from one time to another. The route makes room for it. */
export const LunchEditor: React.FC<LunchEditorProps> = ({ technician, date, planned, onChange }) => {
  const plan = technician.lunchByDate?.[date];
  const [mode, setMode] = useState<'tiempo' | 'horas'>('tiempo');
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
  const end = toTime(toMin(plan.start) + plan.minutes);
  const field = 'font-mono font-semibold rounded-md px-1.5 py-0.5 border bg-orange-50 border-orange-300 text-orange-900';
  return (
    <span className="inline-flex flex-col gap-1.5 text-[11px]">
      <span className="inline-flex rounded-md border border-orange-300 overflow-hidden w-fit">
        {([['tiempo', 'Tiempo'], ['horas', 'De hora a hora']] as const).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-2 py-0.5 font-semibold cursor-pointer ${mode === m ? 'bg-orange-500 text-white' : 'bg-white text-orange-800'}`}
          >
            {label}
          </button>
        ))}
      </span>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-slate-700">🍽 Comida {mode === 'horas' ? 'de' : 'desde'}</span>
        <input
          type="time"
          value={plan.start}
          onChange={(e) => e.target.value && onChange(technician.id, date, { ...plan, start: e.target.value })}
          className={field}
        />
        {mode === 'horas' ? (
          <>
            <span className="text-slate-600">a</span>
            <input
              type="time"
              value={end}
              onChange={(e) => {
                const minutes = e.target.value ? toMin(e.target.value) - toMin(plan.start) : 0;
                if (minutes > 0) onChange(technician.id, date, { ...plan, minutes });
              }}
              className={field}
            />
          </>
        ) : (
          <select
            value={plan.minutes}
            onChange={(e) => onChange(technician.id, date, { ...plan, minutes: Number(e.target.value) })}
            className="rounded-md px-1 py-0.5 border border-orange-300 bg-orange-50 text-orange-900 font-semibold"
          >
            {[...new Set([...DURATIONS, plan.minutes])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => onChange(technician.id, date, null)}
          className="text-[10px] font-semibold text-slate-500 underline cursor-pointer"
        >
          quitar
        </button>
      </span>
      {planned && <span className="text-slate-500">En la ruta: {planned.start}–{planned.end}</span>}
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
