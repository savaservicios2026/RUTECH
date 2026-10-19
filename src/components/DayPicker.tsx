import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DayPickerProps {
  date: string;
  onChange: (date: string) => void;
}

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
};

/** Day bar: previous / next day, today, and a calendar to jump to any day. */
export const DayPicker: React.FC<DayPickerProps> = ({ date, onChange }) => {
  const today = toIso(new Date());
  const label = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const btn = 'p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer';
  return (
    <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-slate-200 shadow-xs px-3 py-2 text-sm">
      <span className="font-bold text-slate-800 capitalize mr-auto">{label}</span>
      <button onClick={() => onChange(shift(date, -1))} className={btn} title="Día anterior">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange(today)}
        className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer border ${
          date === today ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        Hoy
      </button>
      <button onClick={() => onChange(shift(date, 1))} className={btn} title="Día siguiente">
        <ChevronRight className="w-4 h-4" />
      </button>
      <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer">
        <Calendar className="w-4 h-4 text-blue-600" />
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="bg-transparent outline-none cursor-pointer text-slate-800"
          aria-label="Elegir día"
        />
      </label>
    </div>
  );
};
