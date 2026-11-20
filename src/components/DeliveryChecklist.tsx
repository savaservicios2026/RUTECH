import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
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
}

const isPdf = (a: Attachment) => a.type === 'application/pdf' || /\.pdf$/i.test(a.name);
const label = (i: DeliveryChecklistItem) => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.text}`;

/** The articles of the quote attached to a delivery, to tick while loading the van (Pablo, 2026-11-20).
 *  The list is read from the first PDF attached; what is left unticked can be sent as missing material. */
export const DeliveryChecklist: React.FC<Props> = ({ delivery, canTick, canEdit, userEmail, onChange, onMissing }) => {
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
    const untouched = !list || (list.from !== '' && list.from !== quote.id && !list.items.some((i) => i.ok));
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
  const done = items.filter((i) => i.ok).length;
  const pending = items.filter((i) => !i.ok);
  const save = (next: DeliveryChecklistItem[]) => onChange(delivery, { from: list?.from ?? '', items: next });
  const toggle = (it: DeliveryChecklistItem) =>
    save(items.map((i) => (i.id === it.id ? (i.ok ? { id: i.id, text: i.text, qty: i.qty, ...(i.code ? { code: i.code } : {}) } : { ...i, ok: true, at: new Date().toISOString(), ...(userEmail ? { by: userEmail } : {}) }) : i)));

  return (
    <div className="rounded-lg border border-slate-200 bg-white text-xs">
      {items.length > 0 && (
        <div className="px-2.5 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-800">📋 Lista de carga</span>
          <span className={`font-bold ${done === items.length ? 'text-emerald-700' : 'text-slate-500'}`}>{done}/{items.length} cargado</span>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 px-2.5">
            <label className={`flex-1 flex items-center gap-2.5 py-2 ${canTick ? 'cursor-pointer' : ''}`}>
              <input type="checkbox" className="w-5 h-5 accent-emerald-600 shrink-0" checked={!!it.ok} disabled={!canTick} onChange={() => toggle(it)} />
              <span className={it.ok ? 'text-slate-400 line-through' : 'text-slate-800 font-semibold'}>
                {label(it)}
                {it.code && <span className="ml-1 font-normal text-slate-400 no-underline">· {it.code}</span>}
              </span>
            </label>
            {canEdit && (
              <button onClick={() => save(items.filter((i) => i.id !== it.id))} className="p-1 text-slate-300 hover:text-rose-600 cursor-pointer" title="Quitar de la lista"><X className="w-3.5 h-3.5" /></button>
            )}
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
      {canTick && done > 0 && pending.length > 0 && (
        <div className="p-2 border-t border-slate-100">
          <button
            onClick={() => onMissing(delivery, pending.map(label).join('; '))}
            className="w-full py-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg font-bold cursor-pointer"
          >⚠️ Avisar de lo que falta ({pending.length} sin marcar)</button>
        </div>
      )}
    </div>
  );
};
