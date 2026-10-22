import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Download, Loader2, Star } from 'lucide-react';
import logoSava from '../assets/logo-sava-dark.png?inline';
import { getFirestoreDb } from '../utils/firebase';
import { SharedWorkOrder, downloadWorkOrderPdf, workOrderHtml } from '../utils/workOrder';

/** Public page (…/RUTECH/#parte/<código>) where a customer sees and downloads their signed work order. */
export const PublicWorkOrderPage: React.FC = () => {
  const token = location.hash.split('/')[1] || '';
  const [data, setData] = useState<SharedWorkOrder | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signState, setSignState] = useState<'idle' | 'saving' | 'error'>('idle');

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    const p = point(e);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasSignature(true);
  };
  const clearSignature = () => {
    const c = canvasRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
  };
  const needsSignature = !!data?.pendingSignature && !data?.signedAt;

  // The customer signs here; the office app copies the signature into the work order
  const sign = async () => {
    const db = getFirestoreDb();
    if (!db || !data || !canvasRef.current || !hasSignature) return;
    setSignState('saving');
    const signature = canvasRef.current.toDataURL('image/png');
    const patch = { customerSignature: signature, customerSignatureName: signerName.trim(), signedAt: new Date().toISOString() };
    try {
      await updateDoc(doc(db, 'publicWorkOrders', token), patch);
      const r = data.job.inSituReport || {};
      setData({
        ...data,
        ...patch,
        job: {
          ...data.job,
          inSituReport: { ...r, customerSignature: signature, customerSignatureName: patch.customerSignatureName, signedDate: patch.signedAt.slice(0, 10), signaturePending: false },
        },
      });
      setSignState('idle');
    } catch {
      setSignState('error');
    }
  };

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !token) return setState('missing');
    getDoc(doc(db, 'publicWorkOrders', token))
      .then((snap) => {
        if (!snap.exists()) return setState('missing');
        const shared = snap.data() as SharedWorkOrder;
        // Already signed from this link: show the work order with the signature
        if (shared.signedAt && shared.customerSignature) {
          const r = shared.job.inSituReport || {};
          shared.job = {
            ...shared.job,
            inSituReport: { ...r, customerSignature: shared.customerSignature, customerSignatureName: shared.customerSignatureName, signedDate: shared.signedAt.slice(0, 10), signaturePending: false },
          };
        }
        setData(shared);
        setState('ok');
      })
      .catch(() => setState('missing'));
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1f4f94] via-[#0d2650] to-[#040c1f] px-3 py-5">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <img src={logoSava} alt="SAVA servicios deportivos" className="w-48 mx-auto" />
          <h1 className="text-lg font-bold text-white">Parte de trabajo</h1>
        </div>
        {state === 'loading' && (
          <div className="text-center text-white py-10">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}
        {state === 'missing' && (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-slate-700">
            No encontramos este parte. Si acaba de recibir el enlace, pruebe de nuevo en unos minutos.
          </div>
        )}
        {state === 'ok' && data && needsSignature && (
          <div className="bg-white rounded-2xl p-4 shadow-2xl space-y-3 text-sm">
            <div className="font-bold text-slate-900 text-base">✍️ Falta su firma</div>
            <p className="text-slate-600">Revise el parte de trabajo más abajo y, si está conforme, fírmelo aquí con el dedo.</p>
            <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden touch-none bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={220}
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={() => (drawing.current = false)}
                onPointerLeave={() => (drawing.current = false)}
                className="w-full h-40 cursor-crosshair"
              />
              {!hasSignature && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300">Firme aquí</div>}
            </div>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Nombre de quien firma"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base"
            />
            {signState === 'error' && <div className="text-rose-600 font-semibold">No se pudo guardar la firma. Pruebe de nuevo.</div>}
            <div className="flex gap-2">
              <button onClick={clearSignature} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer">Borrar</button>
              <button
                onClick={sign}
                disabled={!hasSignature || signState === 'saving'}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50 cursor-pointer"
              >
                {signState === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}Firmar el parte
              </button>
            </div>
          </div>
        )}
        {state === 'ok' && data && data.signedAt && data.pendingSignature && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 text-center text-sm font-semibold text-emerald-900">
            ✓ Parte firmado. Gracias.
          </div>
        )}
        {state === 'ok' && data && (
          <>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await downloadWorkOrderPdf(data.job, data.technicianNames, data.company);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#1f4f94] rounded-xl font-bold text-sm shadow cursor-pointer"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar PDF
              </button>
              {data.company.reviewUrl && (
                <a
                  href={data.company.reviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 text-slate-900 rounded-xl font-bold text-sm shadow"
                >
                  <Star className="w-4 h-4" /> Dejar una reseña
                </a>
              )}
            </div>
            <iframe
              title="Parte de trabajo"
              srcDoc={workOrderHtml(data.job, data.technicianNames, data.company)}
              className="w-full bg-white rounded-2xl shadow-2xl"
              style={{ height: '1150px' }}
            />
          </>
        )}
      </div>
    </div>
  );
};
