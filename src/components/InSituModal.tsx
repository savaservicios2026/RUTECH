import React, { useState, useRef, useEffect } from 'react';
import { ServiceJob, JobStatus, CompanyInfo } from '../types';
import {
  X,
  Clock,
  PenTool,
  Package,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Printer,
  User,
  Phone,
  MapPin,
  CalendarDays,
  Wrench,
} from 'lucide-react';
import { formatLongDate, printWorkOrder, downloadWorkOrderPdf, sendWorkOrderToCustomer } from '../utils/workOrder';
import { baseIdOf } from '../utils/teams';
import { AttachmentsBox } from './AttachmentsBox';

interface InSituModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceJob | null;
  // A teammate closed this work order while it was open here
  closedElsewhere?: boolean;
  technicianNames: string;
  company: CompanyInfo;
  onSaveInSituReport: (
    serviceId: string,
    report: NonNullable<ServiceJob['inSituReport']>,
    newStatus: JobStatus,
    extraDurationMinutes?: number
  ) => void;
}

const RETURN_REASONS = [
  'Falta material o repuesto',
  'No se pudo terminar a tiempo',
  'Hace falta presupuesto',
  'Cliente ausente / sin acceso',
  'Otro motivo',
];

const nowTime = () => new Date().toTimeString().slice(0, 5);
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const InSituModal: React.FC<InSituModalProps> = ({
  isOpen,
  onClose,
  service,
  closedElsewhere,
  technicianNames,
  company,
  onSaveInSituReport,
}) => {
  const [outcome, setOutcome] = useState<'resuelto' | 'volver' | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnDetail, setReturnDetail] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [newMaterial, setNewMaterial] = useState('');
  const [delayMinutes, setDelayMinutes] = useState<number>(0);
  const [delayReason, setDelayReason] = useState<string>('');
  const [customerSignatureName, setCustomerSignatureName] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState('');
  const [sendToCustomer, setSendToCustomer] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (service && isOpen) {
      const r = service.inSituReport;
      setOutcome(r?.outcome || null);
      const [reason, ...detail] = (r?.returnReason || '').split(' · ');
      setReturnReason(reason || '');
      setReturnDetail(detail.join(' · '));
      setStartedAt(r?.startedAt || nowTime());
      setCompletedAt(r?.completedAt || '');
      setTechnicalNotes(r?.technicalNotes || '');
      setMaterials(r?.materialsUsed || []);
      setDelayMinutes(r?.delayReportedMinutes || 0);
      setDelayReason(r?.delayReason || '');
      setCustomerSignatureName(r?.customerSignatureName || '');
      setHasSignature(false);
      setError('');
      // Show the saved signature on the canvas
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (r?.customerSignature) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setHasSignature(true);
          };
          img.src = r.customerSignature;
        }
      }, 0);
    }
  }, [service, isOpen]);

  // Canvas coordinates scaled to the canvas' real size (it is stretched with CSS)
  const pointFor = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    const { x, y } = pointFor(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointFor(e);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1E293B';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  if (!isOpen || !service) return null;

  const handleAddMaterial = (item: string) => {
    if (!item.trim()) return;
    if (!materials.includes(item.trim())) {
      setMaterials([...materials, item.trim()]);
    }
    setNewMaterial('');
  };

  const buildReport = (finished: boolean): NonNullable<ServiceJob['inSituReport']> => {
    let signatureDataUrl = '';
    if (canvasRef.current && hasSignature) {
      try {
        signatureDataUrl = canvasRef.current.toDataURL('image/png');
      } catch {}
    }
    const fullReturnReason = [returnReason, returnDetail.trim()].filter(Boolean).join(' · ');
    return {
      startedAt: startedAt || undefined,
      completedAt: finished ? completedAt || nowTime() : completedAt || undefined,
      actualMinutes: service.estimatedDuration + delayMinutes,
      delayReportedMinutes: delayMinutes,
      delayReason: delayMinutes > 0 ? delayReason : undefined,
      technicalNotes: technicalNotes.trim(),
      materialsUsed: materials,
      incidentType: 'none',
      outcome: outcome || undefined,
      returnReason: outcome === 'volver' ? fullReturnReason : undefined,
      technicianName: technicianNames,
      customerSignature: signatureDataUrl || undefined,
      customerSignatureName: customerSignatureName.trim(),
      signedDate: signatureDataUrl ? service.inSituReport?.signedDate || todayIso() : undefined,
      updatedAt: nowTime(),
    };
  };

  // Close the work order: needs result and signature
  const handleFinish = () => {
    if (!outcome) return setError('Marca si queda resuelto o si hay que volver.');
    if (outcome === 'volver' && !returnReason) return setError('Indica por qué hay que volver.');
    if (!hasSignature) return setError('Falta la firma del cliente.');
    const report = buildReport(true);
    onSaveInSituReport(service.id, report, 'completado', delayMinutes - (service.inSituReport?.delayReportedMinutes || 0));
    // The customer gets the signed work order and the review request by WhatsApp
    if (sendToCustomer) sendWorkOrderToCustomer({ ...service, status: 'completado', inSituReport: report }, technicianNames, company);
    onClose();
  };

  // Save progress without closing the job (e.g. report a delay)
  const handleSaveDraft = () => {
    const report = buildReport(false);
    const status: JobStatus = service.status === 'completado' ? 'completado' : 'en_progreso';
    onSaveInSituReport(service.id, report, status, delayMinutes - (service.inSituReport?.delayReportedMinutes || 0));
    onClose();
  };

  const infoRow = (icon: React.ReactNode, label: string, value?: string) =>
    value ? (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-blue-600 shrink-0">{icon}</span>
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400">{label}</div>
          <div className="text-slate-800 font-medium whitespace-pre-line">{value}</div>
        </div>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[94vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-[#1f4f94] to-[#0d2650] text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-base">Parte de trabajo</span>
              <span className="font-mono text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded">{service.code}</span>
            </div>
            <p className="text-xs text-indigo-100 truncate max-w-xs sm:max-w-md">{service.customerName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Pre-filled job and customer data */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {infoRow(<User className="w-3.5 h-3.5" />, 'Cliente', service.customerName)}
            {infoRow(<Phone className="w-3.5 h-3.5" />, 'Teléfono', service.customerPhone)}
            {infoRow(<MapPin className="w-3.5 h-3.5" />, 'Dirección', service.location.address)}
            {infoRow(<CalendarDays className="w-3.5 h-3.5" />, 'Fecha', formatLongDate(service.date))}
            {infoRow(<Wrench className="w-3.5 h-3.5" />, 'Técnico', technicianNames)}
            {infoRow(<Wrench className="w-3.5 h-3.5" />, 'Trabajo', [service.title, service.description].filter(Boolean).join('\n'))}
          </div>

          {/* Arrival and departure times */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block font-bold text-slate-700 text-[11px] mb-1">Hora de llegada</span>
              <input type="time" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="block font-bold text-slate-700 text-[11px] mb-1">Hora de salida</span>
              <input type="time" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} placeholder="Al cerrar" className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm" />
            </label>
          </div>

          {/* Observations */}
          <div>
            <label className="block font-bold text-slate-700 text-[11px] mb-1">Observaciones</label>
            <textarea
              rows={4}
              value={technicalNotes}
              onChange={(e) => setTechnicalNotes(e.target.value)}
              placeholder="Qué se ha hecho, estado de la máquina, recomendaciones..."
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2">
              <AttachmentsBox serviceId={baseIdOf(service.id)} section="parte" />
            </div>
          </div>

          {/* Materials */}
          <div>
            <label className="block font-bold text-slate-700 text-[11px] mb-1">Material utilizado (opcional)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Ej. cable de acero 5 mm"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMaterial(newMaterial);
                  }
                }}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
              <button type="button" onClick={() => handleAddMaterial(newMaterial)} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg font-bold cursor-pointer">
                Añadir
              </button>
            </div>
            {materials.length > 0 && (
              <div className="space-y-1">
                {materials.map((mat, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Package className="w-3 h-3 text-blue-600" />
                      {mat}
                    </span>
                    <button type="button" onClick={() => setMaterials(materials.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delay reporter (adjusts next stops) */}
          <details className="bg-amber-50/80 border border-amber-200 rounded-xl p-3" open={delayMinutes > 0}>
            <summary className="font-bold text-amber-900 cursor-pointer flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              ¿Se alarga el trabajo? Avisar de retraso
              {delayMinutes > 0 && <span className="ml-auto font-mono bg-amber-200 px-2 rounded-full">+{delayMinutes} min</span>}
            </summary>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {[0, 15, 30, 45, 60, 90].map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setDelayMinutes(mins)}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    delayMinutes === mins ? 'bg-amber-600 text-white' : 'bg-white text-slate-700 border border-amber-300'
                  }`}
                >
                  {mins === 0 ? 'Sin retraso' : `+${mins} min`}
                </button>
              ))}
            </div>
            {delayMinutes > 0 && (
              <input
                type="text"
                placeholder="Motivo del retraso"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                className="w-full mt-2 bg-white border border-amber-300 rounded-lg p-2 text-slate-800"
              />
            )}
          </details>

          {/* Result */}
          <div>
            <label className="block font-bold text-slate-700 text-[11px] mb-1.5">Resultado</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setOutcome('resuelto'); setError(''); }}
                className={`py-3 rounded-xl font-bold text-sm border cursor-pointer ${
                  outcome === 'resuelto' ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300' : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                ✅ Resuelto
              </button>
              <button
                type="button"
                onClick={() => { setOutcome('volver'); setError(''); }}
                className={`py-3 rounded-xl font-bold text-sm border cursor-pointer ${
                  outcome === 'volver' ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300' : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                🔁 Hay que volver
              </button>
            </div>
            {outcome === 'volver' && (
              <div className="mt-2 space-y-2">
                <select value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-2 text-slate-800">
                  <option value="">¿Por qué hay que volver?</option>
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={returnDetail}
                  onChange={(e) => setReturnDetail(e.target.value)}
                  placeholder="Detalle (qué pieza falta, qué queda por hacer...)"
                  className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-2 text-slate-800"
                />
              </div>
            )}
          </div>

          {/* Customer signature */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-blue-600" />
                Firma del cliente
              </label>
              <button type="button" onClick={clearCanvas} className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer">
                <RotateCcw className="w-3 h-3" />
                <span>Borrar firma</span>
              </button>
            </div>
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden touch-none relative">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-36 cursor-crosshair bg-white"
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm font-medium">
                  ✍️ Firmar aquí con el dedo
                </div>
              )}
            </div>
            <input
              type="text"
              value={customerSignatureName}
              onChange={(e) => setCustomerSignatureName(e.target.value)}
              placeholder="Nombre de quien firma"
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800"
            />
          </div>

          {service.customerPhone && (
            <label className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={sendToCustomer} onChange={(e) => setSendToCustomer(e.target.checked)} />
              <span>Al cerrar, enviar al cliente por WhatsApp el parte firmado en PDF y la petición de reseña</span>
            </label>
          )}

          {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold">{error}</div>}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2">
          {service.inSituReport?.outcome && (
            <button
              type="button"
              onClick={() => printWorkOrder(service, technicianNames, company)}
              className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          )}
          {service.inSituReport?.outcome && (
            <button
              type="button"
              onClick={() => downloadWorkOrderPdf(service, technicianNames, company)}
              className="px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              PDF
            </button>
          )}
          {closedElsewhere ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-emerald-700 font-bold">✓ Un compañero ya cerró este parte</span>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold cursor-pointer">
                Salir
              </button>
            </div>
          ) : (<>
          <button type="button" onClick={handleSaveDraft} className="ml-auto px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer">
            Guardar sin cerrar
          </button>
          <button
            type="button"
            onClick={handleFinish}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Cerrar parte</span>
          </button>
          </>)}
        </div>
      </div>
    </div>
  );
};
