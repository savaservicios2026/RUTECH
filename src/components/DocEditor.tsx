import React, { useEffect, useRef, useState } from 'react';
import { X, PenLine, Type, Signature, Hand, Undo2, ZoomIn, ZoomOut, Check, Loader2, Eraser } from 'lucide-react';
import { canvasToFittingJpeg } from '../utils/documents';

type Op =
  | { kind: 'pen'; color: string; width: number; points: [number, number][] }
  | { kind: 'text'; color: string; size: number; x: number; y: number; text: string }
  | { kind: 'img'; img: HTMLImageElement; x: number; y: number; w: number; h: number };

type Tool = 'move' | 'pen' | 'text' | 'placeSig';

const COLORS = ['#111827', '#1d4ed8', '#dc2626'];
const ZOOMS = [1, 1.5, 2, 3];

interface DocEditorProps {
  src: string;
  title: string;
  onSave: (dataUrl: string) => Promise<void>;
  onClose: () => void;
}

/** Full-screen editor for a supplier document: write on it, add text and a signature, then save. */
export const DocEditor: React.FC<DocEditorProps> = ({ src, title, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const [ops, setOps] = useState<Op[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[1]);
  const [zoom, setZoom] = useState(0);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigImg, setSigImg] = useState<HTMLImageElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawing = useRef<Op | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBase(img);
    img.src = src;
  }, [src]);

  // Redraw the page and everything written on it
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !base) return;
    c.width = base.width;
    c.height = base.height;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(base, 0, 0);
    const all = drawing.current ? [...ops, drawing.current] : ops;
    for (const op of all) {
      if (op.kind === 'pen') {
        ctx.strokeStyle = op.color;
        ctx.lineWidth = op.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        op.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (op.points.length === 1) ctx.lineTo(op.points[0][0] + 0.1, op.points[0][1]);
        ctx.stroke();
      } else if (op.kind === 'text') {
        ctx.fillStyle = op.color;
        ctx.font = `${op.size}px Helvetica, Arial, sans-serif`;
        ctx.textBaseline = 'middle';
        op.text.split('\n').forEach((line, i) => ctx.fillText(line, op.x, op.y + i * op.size * 1.25));
      } else {
        ctx.drawImage(op.img, op.x, op.y, op.w, op.h);
      }
    }
  });

  const [, force] = useState(0);
  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) * e.currentTarget.width) / r.width, ((e.clientY - r.top) * e.currentTarget.height) / r.height];
  };
  const W = base?.width || 1000;

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'pen') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { kind: 'pen', color, width: Math.max(2, W / 400), points: [toCanvas(e)] };
    force((n) => n + 1);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'pen' || !drawing.current || drawing.current.kind !== 'pen') return;
    drawing.current.points.push(toCanvas(e));
    force((n) => n + 1);
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'pen' && drawing.current) {
      const done = drawing.current;
      drawing.current = null;
      setOps((o) => [...o, done]);
      return;
    }
    const [x, y] = toCanvas(e);
    if (tool === 'text') {
      const text = window.prompt('Texto a escribir en el documento');
      if (text && text.trim()) setOps((o) => [...o, { kind: 'text', color, size: Math.round(W / 45), x, y, text: text.trim() }]);
    } else if (tool === 'placeSig' && sigImg) {
      const w = W * 0.3;
      const h = (sigImg.height / sigImg.width) * w;
      setOps((o) => [...o, { kind: 'img', img: sigImg, x: x - w / 2, y: y - h / 2, w, h }]);
      setTool('move');
    }
  };

  const save = async () => {
    if (!canvasRef.current) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(canvasToFittingJpeg(canvasRef.current));
    } catch {
      setError('No se pudo guardar. Revisa la conexión e inténtalo otra vez.');
      setSaving(false);
    }
  };

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setTool(t)}
      className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${tool === t ? 'bg-blue-600 text-white' : 'bg-white/10 text-white'}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 text-white">
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer" title="Cerrar sin guardar">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0 text-sm font-semibold truncate">{title}</div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !base}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
        {toolBtn('pen', <PenLine className="w-4 h-4" />, 'Escribir')}
        {toolBtn('text', <Type className="w-4 h-4" />, 'Texto')}
        <button
          type="button"
          onClick={() => setSigOpen(true)}
          className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold cursor-pointer ${tool === 'placeSig' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white'}`}
        >
          <Signature className="w-4 h-4" /> Firmar
        </button>
        {toolBtn('move', <Hand className="w-4 h-4" />, 'Mover')}
        <span className="flex items-center gap-1 ml-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 cursor-pointer ${color === c ? 'border-white ring-2 ring-blue-400' : 'border-white/40'}`}
              style={{ background: c }}
              title="Color"
            />
          ))}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} className="p-2 rounded-lg bg-white/10 text-white cursor-pointer" title="Alejar">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} className="p-2 rounded-lg bg-white/10 text-white cursor-pointer" title="Acercar">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setOps((o) => o.slice(0, -1))} disabled={!ops.length} className="p-2 rounded-lg bg-white/10 text-white cursor-pointer disabled:opacity-40" title="Deshacer">
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setOps([])} disabled={!ops.length} className="p-2 rounded-lg bg-white/10 text-white cursor-pointer disabled:opacity-40" title="Borrar todo lo añadido">
            <Eraser className="w-4 h-4" />
          </button>
        </span>
      </div>
      {(tool === 'text' || tool === 'placeSig' || error) && (
        <div className={`mx-3 mb-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${error ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}>
          {error || (tool === 'text' ? 'Toca en el documento donde quieres escribir el texto.' : 'Toca en el documento donde quieres poner la firma.')}
        </div>
      )}
      <div className="flex-1 overflow-auto bg-slate-700 p-2">
        {base ? (
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="bg-white shadow-xl mx-auto block"
            style={{ width: `${ZOOMS[zoom] * 100}%`, maxWidth: zoom === 0 ? 900 : 'none', touchAction: tool === 'move' ? 'auto' : 'none' }}
          />
        ) : (
          <div className="flex justify-center py-20 text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
      </div>
      {sigOpen && (
        <SignaturePad
          onCancel={() => setSigOpen(false)}
          onDone={(img) => {
            setSigImg(img);
            setSigOpen(false);
            setTool('placeSig');
          }}
        />
      )}
    </div>
  );
};

/** Draw a signature with the finger; returns it trimmed, ready to place on the document. */
const SignaturePad: React.FC<{ onDone: (img: HTMLImageElement) => void; onCancel: () => void }> = ({ onDone, onCancel }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<[number, number] | null>(null);
  const [empty, setEmpty] = useState(true);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) * e.currentTarget.width) / r.width, ((e.clientY - r.top) * e.currentTarget.height) / r.height];
  };
  const draw = (to: [number, number]) => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(...(last.current || to));
    ctx.lineTo(to[0] + 0.1, to[1]);
    ctx.stroke();
    last.current = to;
  };
  const finish = () => {
    const c = ref.current!;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let [x0, y0, x1, y1] = [c.width, c.height, 0, 0];
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (data[(y * c.width + x) * 4 + 3] > 0) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    if (x1 <= x0) return;
    const t = document.createElement('canvas');
    t.width = x1 - x0 + 10;
    t.height = y1 - y0 + 10;
    t.getContext('2d')!.drawImage(c, x0 - 5, y0 - 5, t.width, t.height, 0, 0, t.width, t.height);
    const img = new Image();
    img.onload = () => onDone(img);
    img.src = t.toDataURL('image/png');
  };
  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl p-3 w-full max-w-lg space-y-2">
        <div className="font-bold text-slate-800 text-sm">Firma con el dedo</div>
        <canvas
          ref={ref}
          width={800}
          height={300}
          className="w-full border-2 border-dashed border-slate-300 rounded-xl bg-slate-50"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            last.current = null;
            draw(pos(e));
            setEmpty(false);
          }}
          onPointerMove={(e) => e.buttons && draw(pos(e))}
          onPointerUp={() => (last.current = null)}
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              ref.current!.getContext('2d')!.clearRect(0, 0, 800, 300);
              setEmpty(true);
            }}
            className="px-3 py-2 text-sm font-semibold text-slate-600 cursor-pointer"
          >
            Borrar
          </button>
          <button type="button" onClick={onCancel} className="px-3 py-2 text-sm font-semibold text-slate-600 cursor-pointer">
            Cancelar
          </button>
          <button type="button" disabled={empty} onClick={finish} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold cursor-pointer disabled:opacity-40">
            Usar esta firma
          </button>
        </div>
      </div>
    </div>
  );
};
