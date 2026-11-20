import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Minus, Plus, X } from 'lucide-react';
import { Attachment, Delivery, DeliveryChecklist as Checklist, DeliveryChecklistItem } from '../types';
import { watchAttachments } from '../utils/attachments';
import { quoteLinesFromDataUrl } from '../utils/quoteChecklist';

interface Props {
  delivery: Delivery;
  canTick: boolean; // office and technicians
  canEdit: boolean; // office: add or remove lines
  userEmail?: string;
  onChange: (delivery: Delivery, checklist: Checklist) => void;
  onMissing: (delivery: Delivery, items: string) => void;
  onReady: (delivery: Delivery) => void;
}

const isPdf = (a: Attachment) => a.type === 'application/pdf' || /\.pdf$/i.test(a.name);
const label = (i: DeliveryChecklistItem) => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.text}`;
const unitsOf = (i: DeliveryChecklistItem) => Math.max(1, i.qty || 1);
const loadedOf = (i: DeliveryChecklistItem) => Math.min(unitsOf(i), i.loaded ?? (i.ok ? unitsOf(i) : 0));
// What is still to load, e.g. "3 × Mancuerna Hexagonal 5 kgs (faltan 3 de 4)"
const missingLabel = (i: DeliveryChecklistItem) => {
  const left = unitsOf(i) - loadedOf(i);
  return `${left > 1 ? `${left} × ` : ''}${i.text}${loadedOf(i) > 0 ? ` (faltan ${left} de ${unitsOf(i)})` : ''}`;
};

/** The articles of the quote attached to a delivery, to tick while loading the van (Pablo, 2026-11-20).
 *  The list is read from the first PDF attached; what is left unticked can be sent as missing material. */
export const DeliveryChecklist: React.FC<Props> = ({ delivery, canTick, canEdit, userEmail, onChange, onMissing, onReady }) => {
  const [pdfs, setPdfs] = useState<Attachment[]>([]);
  const [reading, setReading] = useState(false);
  const [newLine, setNewLine] = useState('');
  const tried = useRef<string | null>(null);
  const list = delivery.checklist;

  useEffect(() => watchAttachments(delivery.id, (items) => setPdfs(items.filter((a) => a.section === 'servicio' && isPdf(a)))), [delivery.id]);

  // Read the quote once: when there is no list yet, or a new quote replaces one nobody has ticked
  useEffect(() => {
    if (!canTick || !pdfs.length) return;
    const quote = pdfs.find((a) => /presupuesto|pedido|albar/i.test(a.name)) || pdfs[0];
    const untouched = !list || (list.from !== '' && list.from !== quote.id && !list.items.some((i) => i.ok || i.loaded));
    if (!untouched || tried.current === quote.id) return;
    tried.current = quote.id;
    setReading(true);
    quoteLinesFromDataUrl(quote.dataUrl)
      .then((lines) => {
        if (!lines.length) return;
        onChange(delivery, {
          from: quote.id,
          items: lines.map((l, n) => ({ id: `q${n}`, text: l.text, qty: l.qty, ...(l.code ? { code: l.code } : {}) })),
        });
      })
      .catch(() => {})
      .finally(() => setReading(false));
  }, [pdfs, list, canTick]);

  if (!list?.items.length) {
    if (reading) return <div className="text-xs text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Leyendo el presupuesto…</div>;
    if (!canEdit) return null;
  }

  const items = list?.items || [];
  const totalUnits = items.reduce((n, i) => n + unitsOf(i), 0);
  const doneUnits = items.reduce((n, i) => n + loadedOf(i), 0);
  const pending = items.filter((i) => loadedOf(i) < unitsOf(i));
  const save = (next: DeliveryChecklistItem[]) => onChange(delivery, { from: list?.from ?? '', items: next });
  // Sets how many units of an article are loaded (0 to all)
  const setLoaded = (it: DeliveryChecklistItem, n: number) =>
    save(items.map((i) => {
      if (i.id !== it.id) return i;
      const units = Math.max(0, Math.min(unitsOf(i), n));
      const base: DeliveryChecklistItem = { id: i.id, text: i.text, qty: i.qty, ...(i.code ? { code: i.code } : {}) };
      return units === 0 ? base : { ...base, loaded: units, ok: units >= unitsOf(i), at: new Date().toISOString(), ...(userEmail ? { by: userEmail } : {}) };
    }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white text-xs">
      {items.length > 0 && (
        <div className="px-2.5 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-800">📋 Lista de carga</span>
          <span className={`font-bold ${doneUnits === totalUnits ? 'text-emerald-700' : 'text-slate-500'}`}>{doneUnits}/{totalUnits} uds. cargadas</span>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 px-2.5">
            {(() => {
              const units = unitsOf(it), got = loadedOf(it), full = got >= units;
              return (
                <>
                  <label className={`flex-1 flex items-center gap-2.5 py-2 ${canTick ? 'cursor-pointer' : ''}`}>
                    <input type="checkbox" className="w-5 h-5 accent-emerald-600 shrink-0" checked={full} disabled={!canTick} onChange={() => setLoaded(it, full ? 0 : units)} />
                    <span className={full ? 'text-slate-400 line-through' : 'text-slate-800 font-semibold'}>
                      {label(it)}
                      {it.code && <span className="ml-1 font-normal text-slate-400 no-underline">· {it.code}</span>}
                    </span>
                  </label>
                  {units > 1 && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canTick && (
                        <button onClick={() => setLoaded(it, got - 1)} disabled={got === 0} className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center cursor-pointer disabled:opacity-30" title="Una menos"><Minus className="w-4 h-4" /></button>
                      )}
                      <span className={`min-w-[2.6rem] text-center font-bold ${full ? 'text-emerald-700' : got ? 'text-amber-700' : 'text-slate-500'}`}>{got}/{units}</span>
                      {canTick && (
                        <button onClick={() => setLoaded(it, got + 1)} disabled={full} className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center cursor-pointer disabled:opacity-30" title="Una más"><Plus className="w-4 h-4" /></button>
                      )}
                    </div>
                  )}
                  {canEdit && (
                    <button onClick={() => save(items.filter((i) => i.id !== it.id))} className="p-1 text-slate-300 hover:text-rose-600 cursor-pointer" title="Quitar de la lista"><X className="w-3.5 h-3.5" /></button>
                  )}
                </>
              );
            })()}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="flex gap-1.5 p-2 border-t border-slate-100"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newLine.trim();
            if (!t) return;
            const m = t.match(/^(\d+)\s*(?:x|×)?\s+(.+)$/i);
            save([...items, { id: `m${Date.now()}`, text: m ? m[2] : t, qty: m ? Number(m[1]) : 1 }]);
            setNewLine('');
          }}
        >
          <input value={newLine} onChange={(e) => setNewLine(e.target.value)} placeholder={items.length ? 'Añadir artículo (ej. 2 discos 10 kg)' : 'Lista de carga: añade artículos o adjunta el presupuesto en PDF'} className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5" />
          <button type="submit" className="px-2 py-1.5 bg-slate-800 text-white rounded-lg cursor-pointer" title="Añadir"><Plus className="w-4 h-4" /></button>
        </form>
      )}
      {/* When done loading: the order goes out, or waits for what is missing (Pablo, 2026-11-20) */}
      {canTick && items.length > 0 && !delivery.ready && (
        <div className="p-2 border-t border-slate-100 space-y-1.5">
          <button
            onClick={() => onReady(delivery)}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
          >✅ PEDIDO LISTO PARA SALIR{pending.length ? ` (faltan ${totalUnits - doneUnits} uds.)` : ''}</button>
          <button
            onClick={() => onMissing(delivery, pending.map(missingLabel).join('; '))}
            disabled={!pending.length}
            className="w-full py-2.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg font-bold cursor-pointer disabled:opacity-40"
          >⚠️ Pedido pendiente de material{pending.length ? ` (${totalUnits - doneUnits} uds.)` : ''}</button>
        </div>
      )}
    </div>
  );
};
