import React, { useState, useRef, useEffect } from 'react';
import { ServiceJob, JobStatus } from '../types';
import { 
  X, 
  Check, 
  Clock, 
  AlertTriangle, 
  PenTool, 
  FileText, 
  Package, 
  Trash2, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  UserCheck,
  Send
} from 'lucide-react';

interface InSituModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceJob | null;
  onSaveInSituReport: (
    serviceId: string, 
    report: NonNullable<ServiceJob['inSituReport']>,
    newStatus: JobStatus,
    extraDurationMinutes?: number
  ) => void;
}

const COMMON_MATERIALS = [
  'Cable acero 5mm con funda nylon',
  'Polea nylon 90mm/115mm con rodamiento sellado',
  'Tapiz / Banda de rodadura cinta de correr 2.5mm',
  'Taco químico epoxi M12 + varilla anclaje de Racks',
  'Lubricante sintético de teflón para guías de peso',
  'Zapata de freno cuero/fieltro bici ciclo indoor',
  'Variador inversor de frecuencia motor 3HP',
  'Sensor magnético reed switch / tacómetro rpm',
  'Pasador selector de placas con pomo elástico',
  'Loseta caucho macizo 50x50x20mm peso libre',
  'Placa display / consola electrónica multimarca',
  'Rodamiento lineal de bolas 30mm prensa 45º',
];

export const InSituModal: React.FC<InSituModalProps> = ({
  isOpen,
  onClose,
  service,
  onSaveInSituReport,
}) => {
  const [status, setStatus] = useState<JobStatus>('en_progreso');
  const [technicalNotes, setTechnicalNotes] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [newMaterial, setNewMaterial] = useState('');
  const [incidentType, setIncidentType] = useState<NonNullable<ServiceJob['inSituReport']>['incidentType']>('none');
  const [delayMinutes, setDelayMinutes] = useState<number>(0);
  const [delayReason, setDelayReason] = useState<string>('');
  const [customerSignatureName, setCustomerSignatureName] = useState('');
  const [hasSignature, setHasSignature] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (service) {
      setStatus(service.status === 'pendiente' || service.status === 'asignado' ? 'en_progreso' : service.status);
      setTechnicalNotes(service.inSituReport?.technicalNotes || '');
      setMaterials(service.inSituReport?.materialsUsed || []);
      setIncidentType(service.inSituReport?.incidentType || 'none');
      setDelayMinutes(service.inSituReport?.delayReportedMinutes || 0);
      setDelayReason(service.inSituReport?.delayReason || '');
      setCustomerSignatureName(service.inSituReport?.customerSignatureName || service.customerName);
      setHasSignature(!!service.inSituReport?.customerSignature);
    }
  }, [service, isOpen]);

  // Canvas drawing for in situ digital touch signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1E293B';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
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

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    let signatureDataUrl = service.inSituReport?.customerSignature || '';
    if (canvasRef.current && hasSignature) {
      try {
        signatureDataUrl = canvasRef.current.toDataURL('image/png');
      } catch {}
    }

    const report: NonNullable<ServiceJob['inSituReport']> = {
      startedAt: service.inSituReport?.startedAt || new Date().toLocaleTimeString().slice(0, 5),
      completedAt: status === 'completado' ? new Date().toLocaleTimeString().slice(0, 5) : undefined,
      actualMinutes: service.estimatedDuration + delayMinutes,
      delayReportedMinutes: delayMinutes,
      delayReason: delayMinutes > 0 ? delayReason : undefined,
      technicalNotes: technicalNotes.trim(),
      materialsUsed: materials,
      incidentType,
      customerSignature: signatureDataUrl || undefined,
      customerSignatureName: customerSignatureName.trim(),
      updatedAt: new Date().toLocaleTimeString().slice(0, 5),
    };

    onSaveInSituReport(service.id, report, status, delayMinutes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[11px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                {service.code}
              </span>
              <span className="font-bold text-sm text-white">Actualización In Situ</span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
              {service.customerName} · {service.title}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Selection Buttons */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
              Estado de la intervención in situ
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('en_camino')}
                className={`py-2 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                  status === 'en_camino'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🚗 En camino
              </button>

              <button
                type="button"
                onClick={() => setStatus('en_progreso')}
                className={`py-2 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                  status === 'en_progreso'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🛠️ En faena / En curso
              </button>

              <button
                type="button"
                onClick={() => setStatus('completado')}
                className={`py-2 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                  status === 'completado'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ✓ Completado
              </button>
            </div>
          </div>

          {/* Quick Delay Reporter (Adjusts routes automatically) */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                ¿Se alarga la intervención? (Reportar tiempo extra)
              </span>
              {delayMinutes > 0 && (
                <span className="font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full font-mono">
                  +{delayMinutes} min
                </span>
              )}
            </div>

            <p className="text-[11px] text-amber-800">
              Al sumar tiempo in situ, el sistema ajusta automáticamente la hora de llegada prevista de las siguientes paradas.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {[0, 15, 30, 45, 60].map(mins => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setDelayMinutes(mins)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    delayMinutes === mins
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  {mins === 0 ? 'Sin retraso' : `+${mins} min`}
                </button>
              ))}
            </div>

            {delayMinutes > 0 && (
              <input
                type="text"
                placeholder="Motivo del retraso (ej. pieza oxidada, tornillo partido, purgado lento)..."
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                className="w-full bg-white border border-amber-300 rounded-lg p-2 text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            )}
          </div>

          {/* Incidents selector */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
              Incidencia In Situ (Opcional)
            </label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium cursor-pointer"
            >
              <option value="none">Sin incidencia (Trabajo ordinario)</option>
              <option value="ausente">⚠️ Cliente ausente / No contesta en puerta ni teléfono</option>
              <option value="falta_pieza">⚠️ Falta repuesto específico (Requiere pedir material)</option>
              <option value="acceso_imposible">⚠️ Acceso imposible (Sin llaves del cuarto de máquinas)</option>
              <option value="averia_compleja">⚠️ Avería de mayor envergadura (Requiere presupuesto extra)</option>
            </select>
          </div>

          {/* Technical Diagnosis / Notes */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
              Notas Técnicas y Solución Aplicada
            </label>
            <textarea
              rows={3}
              value={technicalNotes}
              onChange={(e) => setTechnicalNotes(e.target.value)}
              placeholder="Ej. Revisada presión de gas R410A (baja a 4 bar). Detectada fuga en obús de toma de servicio. Sustituido obús y recargado a 8.5 bar. Split enfriando a 9ºC."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
            />
          </div>

          {/* Materials Used in situ */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Materiales y Repuestos Utilizados
              </label>
              <span className="text-[10px] text-slate-400">({materials.length} elementos)</span>
            </div>

            {/* Quick add chips */}
            <div className="flex flex-wrap gap-1 mb-2">
              {COMMON_MATERIALS.slice(0, 4).map(mat => (
                <button
                  type="button"
                  key={mat}
                  onClick={() => handleAddMaterial(mat)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] transition-colors cursor-pointer"
                >
                  + {mat}
                </button>
              ))}
            </div>

            {/* Input to type custom material */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Añadir material o repuesto consumido..."
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMaterial(newMaterial);
                  }
                }}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              />
              <button
                type="button"
                onClick={() => handleAddMaterial(newMaterial)}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
              >
                Añadir
              </button>
            </div>

            {/* Added materials tag list */}
            {materials.length > 0 && (
              <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                {materials.map((mat, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] text-slate-700 bg-white p-1.5 rounded border border-slate-100">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Package className="w-3 h-3 text-blue-600" />
                      {mat}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(idx)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Touch Digital Signature */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-blue-600" />
                Firma Digital del Cliente In Situ
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Borrar firma</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500">
              El cliente puede firmar directamente en la pantalla con el dedo o puntero táctil:
            </p>

            <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden touch-none relative">
              <canvas
                ref={canvasRef}
                width={480}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-28 cursor-crosshair bg-white"
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-medium">
                  ✍️ Firmar aquí con el dedo
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Nombre firmante:</label>
              <input
                type="text"
                value={customerSignatureName}
                onChange={(e) => setCustomerSignatureName(e.target.value)}
                placeholder="Nombre y apellidos del receptor"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Guardar Parte In Situ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
