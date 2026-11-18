import React, { useEffect, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import type { Technician } from '../types';
import { NoticeKind, recipientFor, WhatsappRecipient, WhatsappSettings } from '../utils/whatsapp';

interface Props {
  isOpen: boolean;
  settings: WhatsappSettings | undefined;
  technicians: Technician[];
  onClose: () => void;
  onSave: (s: WhatsappSettings) => void;
}

const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';
const KINDS: { key: NoticeKind; label: string }[] = [
  { key: 'services', label: 'Servicios' },
  { key: 'deliveries', label: 'Entregas' },
  { key: 'tickets', label: 'Averías' },
];

// Who gets a WhatsApp when a service, delivery or breakdown is created, and their CallMeBot key
export const WhatsappModal: React.FC<Props> = ({ isOpen, settings, technicians, onClose, onSave }) => {
  const [rec, setRec] = useState<Record<string, WhatsappRecipient>>({});
  useEffect(() => {
    if (!isOpen) return;
    const r: Record<string, WhatsappRecipient> = {};
    for (const t of technicians) r[t.id] = recipientFor(settings, t);
    setRec(r);
  }, [isOpen, settings, technicians]);
  if (!isOpen) return null;

  const set = (id: string, patch: Partial<WhatsappRecipient>) => setRec((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const clean: Record<string, WhatsappRecipient> = {};
          for (const [id, r] of Object.entries(rec)) {
            const c: WhatsappRecipient = { services: !!r.services, deliveries: !!r.deliveries, tickets: !!r.tickets };
            if (r.apikey?.trim()) c.apikey = r.apikey.trim();
            if (r.phone?.trim()) c.phone = r.phone.trim();
            if (r.provider) c.provider = r.provider;
            clean[id] = c;
          }
          onSave({ ...(settings || { id: 'whatsapp' }), id: 'whatsapp', recipients: clean });
        }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="p-4 bg-gradient-to-r from-[#1f4f94] to-[#0d2650] text-white flex items-center justify-between">
          <span className="font-bold text-base flex items-center gap-2"><MessageCircle className="w-5 h-5" />Avisos por WhatsApp</span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <p className="text-xs text-slate-500">
            Cuando se crea un servicio, una entrega o una avería, cada técnico marcado recibe un WhatsApp. Cada uno necesita su clave de CallMeBot, que se consigue desde su propio móvil.
          </p>
          {technicians.map((t) => {
            const r = rec[t.id] || {};
            return (
              <div key={t.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-slate-800">{t.name}</span>
                  <span className="text-xs text-slate-500">{r.phone || t.phone || 'sin teléfono'}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {KINDS.map((k) => (
                    <label key={k.key} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input type="checkbox" checked={!!r[k.key]} onChange={(e) => set(t.id, { [k.key]: e.target.checked })} />
                      {k.label}
                    </label>
                  ))}
                </div>
                <input
                  className={inputClass}
                  placeholder="Clave de CallMeBot (apikey)"
                  value={r.apikey || ''}
                  autoComplete="off"
                  onChange={(e) => set(t.id, { apikey: e.target.value })}
                />
                {(r.services || r.deliveries || r.tickets) && !r.apikey && (
                  <p className="text-xs text-amber-600">Falta la clave: no le llegará nada hasta ponerla.</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#5a5ea8] hover:bg-[#686bac] cursor-pointer">Guardar</button>
        </div>
      </form>
    </div>
  );
};
