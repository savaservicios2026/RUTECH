import React from 'react';
import { Technician } from '../types';

interface StartTimeEditorProps {
  technician: Technician;
  date: string;
  onChange: (technicianId: string, date: string, time: string | null) => void;
  dark?: boolean;
}

/** Start time of one technician's day: changing it moves the whole route of that day. */
export const StartTimeEditor: React.FC<StartTimeEditorProps> = ({ technician, date, onChange, dark }) => {
  const override = technician.startTimeOverrides?.[date];
  const value = override || technician.schedule.start;
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="time"
        value={value}
        onChange={(e) => e.target.value && onChange(technician.id, date, e.target.value === technician.schedule.start ? null : e.target.value)}
        className={`font-mono font-semibold rounded-md px-1.5 py-0.5 border text-xs ${
          override
            ? 'bg-amber-50 border-amber-400 text-amber-900'
            : dark
            ? 'bg-slate-700 border-slate-600 text-white'
            : 'bg-white border-slate-300 text-slate-700'
        }`}
        title="Hora de salida de este día"
      />
      {override && (
        <button
          type="button"
          onClick={() => onChange(technician.id, date, null)}
          className="text-[10px] font-semibold text-amber-700 underline cursor-pointer"
          title={`Volver a la hora habitual (${technician.schedule.start})`}
        >
          habitual {technician.schedule.start}
        </button>
      )}
    </span>
  );
};
