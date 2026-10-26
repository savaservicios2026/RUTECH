import React, { useState } from 'react';
import { Technician, ServiceJob, TechnicianRouteSummary } from '../types';
import { navigationDestination } from '../utils/tickets';
import { 
  X, 
  Printer, 
  Share2, 
  Copy, 
  Check, 
  MessageSquare, 
  Download, 
  FileText,
  QrCode,
  Smartphone,
  Mail,
  ExternalLink,
  Navigation,
  Phone
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  technicians: Technician[];
  services: ServiceJob[];
  summaries: Map<string, TechnicianRouteSummary>;
  selectedDate: string;
  onOpenWorkerView?: (techId: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  technicians,
  services,
  summaries,
  selectedDate,
  onOpenWorkerView,
}) => {
  const [selectedTechId, setSelectedTechId] = useState<string>(technicians[0]?.id || '');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'sheet' | 'qr' | 'whatsapp'>('sheet');

  if (!isOpen) return null;

  const currentTech = technicians.find(t => t.id === selectedTechId) || technicians[0];
  const summary = currentTech ? summaries.get(currentTech.id) : null;
  const techJobs = services
    .filter(s => s.assignedTechnicianId === currentTech?.id)
    .sort((a, b) => a.manualOrder - b.manualOrder);

  // Generate plain-text formatted message for WhatsApp / SMS
  const generateWhatsAppMessage = () => {
    if (!currentTech) return '';
    let msg = `📅 *HOJA DE RUTA - ${selectedDate}*\n`;
    msg += `👨‍🔧 *Técnico:* ${currentTech.name}\n`;
    msg += `🚐 *Furgoneta asignada:* ${currentTech.vehicle}\n`;
    msg += `🕒 *Jornada:* ${currentTech.schedule.start} a ${currentTech.schedule.end}\n`;
    msg += `🏠 *Salida:* ${currentTech.baseLocation.address} (${currentTech.schedule.start})\n\n`;
    msg += `📋 *ORDEN DE VISITAS (${techJobs.length} paradas):*\n`;

    techJobs.forEach((job, index) => {
      msg += `\n*${index + 1}️⃣ [${job.scheduledArrival || '--:--'} - ${job.scheduledDeparture || '--:--'}] ${job.customerName}*\n`;
      msg += `📍 ${job.location.address}\n`;
      msg += `🛠️ ${job.title} (${job.estimatedDuration} min)\n`;
      if (job.customerPhone) msg += `📞 Contacto: ${job.customerPhone}\n`;
      if (job.description) msg += `ℹ️ ${job.description}\n`;
      msg += `🗺️ GPS: https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(navigationDestination(job.location))}\n`;
    });

    if (summary) {
      msg += `\n🏁 *Fin de ruta est.:* ${summary.estimatedEndTime} (~${summary.totalDistanceKm} km totales)\n`;
    }
    return msg;
  };

  const handleCopyText = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const text = generateWhatsAppMessage();
    const encoded = encodeURIComponent(text);
    const phone = currentTech?.phone ? currentTech.phone.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    if (!currentTech) return;
    const subject = encodeURIComponent(`Hoja de Ruta Sava Servicios - ${selectedDate} - ${currentTech.name}`);
    const body = encodeURIComponent(generateWhatsAppMessage().replace(/\*/g, ''));
    window.location.href = `mailto:${currentTech.email}?subject=${subject}&body=${body}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const exportData = {
      date: selectedDate,
      technician: currentTech,
      summary,
      stops: techJobs,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruta-${currentTech?.name.toLowerCase().replace(/\s+/g, '-')}-${selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // QR Code URL that workers can scan with phone camera
  const currentAppUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
  const workerPortalUrl = `${currentAppUrl}?worker=${currentTech?.id}&date=${selectedDate}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(workerPortalUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Pasar y Enviar Ruta a los Trabajadores
              </h2>
              <p className="text-xs text-slate-500">
                Elige cómo pasar la planificación diaria a {currentTech?.name || 'los técnicos'}: QR móvil, WhatsApp, Email o Hoja Impresa.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Technician Selector & Delivery Tabs */}
        <div className="p-3 bg-slate-100/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Técnico receptor:</span>
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800 cursor-pointer shadow-xs"
            >
              {technicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} - {t.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Delivery Channel Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleOpenWhatsApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Abrir chat de WhatsApp con la ruta formateada y enlaces GPS"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Enviar WhatsApp</span>
            </button>

            <button
              onClick={handleSendEmail}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              title="Enviar por correo electrónico"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Email</span>
            </button>

            {onOpenWorkerView && (
              <button
                onClick={() => {
                  onOpenWorkerView(selectedTechId);
                  onClose();
                }}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                title="Abrir la interfaz móvil que verá el operario"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Ver Modo Operario</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Imprimir hoja de ruta"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Tabs between QR Code, Route Sheet & Copy Text */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Method Explainer Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Method 1: QR Mobile */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-indigo-900 text-xs mb-1">
                  <QrCode className="w-4 h-4 text-indigo-600" />
                  <span>1. Escaneo QR en Móvil</span>
                </div>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  El trabajador escanea el código QR con su móvil y accede a su hoja interactiva con GPS y botones de llamada.
                </p>
              </div>
              <div className="mt-2 text-center pt-2 border-t border-indigo-200/60">
                <button
                  onClick={() => setActiveTab('qr')}
                  className={`text-[11px] font-bold ${activeTab === 'qr' ? 'text-indigo-900 underline' : 'text-indigo-600 hover:underline'} cursor-pointer`}
                >
                  Ver Código QR &gt;
                </button>
              </div>
            </div>

            {/* Method 2: WhatsApp / SMS */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs mb-1">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>2. WhatsApp Instantáneo</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Envía al chat del técnico la lista ordenada de visitas con hora de llegada y enlaces directos a Google Maps.
                </p>
              </div>
              <div className="mt-2 text-center pt-2 border-t border-emerald-200/60">
                <button
                  onClick={handleOpenWhatsApp}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Abrir WhatsApp &gt;
                </button>
              </div>
            </div>

            {/* Method 3: Print / Physical PDF */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs mb-1">
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>3. Parte Impreso / PDF</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Para vehículos con parte físico o cuando el cliente requiere firma presencial en papel.
                </p>
              </div>
              <div className="mt-2 text-center pt-2 border-t border-slate-200">
                <button
                  onClick={handlePrint}
                  className="text-[11px] font-bold text-slate-700 hover:underline cursor-pointer"
                >
                  Imprimir / PDF &gt;
                </button>
              </div>
            </div>
          </div>

          {/* QR Code Presentation Box */}
          {activeTab === 'qr' && (
            <div className="bg-white p-6 rounded-2xl border-2 border-indigo-200 shadow-md text-center space-y-3 max-w-sm mx-auto">
              <h3 className="font-bold text-slate-800 text-sm">
                Código QR para {currentTech?.name}
              </h3>
              <p className="text-[11px] text-slate-500">
                Apunta con la cámara de tu smartphone para abrir la ruta en el dispositivo del operario:
              </p>
              <div className="inline-block p-3 bg-white border border-slate-200 rounded-2xl shadow-inner">
                <img 
                  src={qrCodeImageUrl} 
                  alt="QR Hoja de Ruta" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  className="w-44 h-44 mx-auto"
                />
              </div>
              <div className="text-[11px] text-slate-400">
                Sin necesidad de instalar aplicaciones. Compatible con iOS y Android.
              </div>
              <button
                onClick={() => setActiveTab('sheet')}
                className="text-xs text-blue-600 font-semibold hover:underline block mx-auto cursor-pointer"
              >
                ← Volver a la vista previa de la hoja
              </button>
            </div>
          )}

          {/* Printable Sheet Layout */}
          {activeTab === 'sheet' && currentTech && (
            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs space-y-4">
              {/* Sheet Title */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-lg font-bold text-slate-900">HOJA DE RUTA DIARIA</div>
                  <div className="text-slate-500 text-xs">Sava Servicios — Sistema de Asistencia Técnica</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800">{selectedDate}</div>
                  <div className="text-slate-500 text-[11px] font-mono">
                    Turno: {currentTech.schedule.start} - {currentTech.schedule.end}
                  </div>
                </div>
              </div>

              {/* Technician Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Técnico</div>
                  <div className="font-bold">{currentTech.name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Vehículo</div>
                  <div>{currentTech.vehicle}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Teléfono</div>
                  <div>{currentTech.phone}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Paradas / Distancia</div>
                  <div className="font-semibold text-blue-700">{techJobs.length} serv. (~{summary?.totalDistanceKm || 0} km)</div>
                </div>
              </div>

              {/* Base departure */}
              <div className="p-2.5 bg-slate-100/70 rounded-lg flex items-center justify-between text-slate-700">
                <div>
                  <span className="font-bold">🏠 Base de Salida:</span> {currentTech.baseLocation.address}
                </div>
                <span className="font-mono font-bold text-slate-800">{currentTech.schedule.start}</span>
              </div>

              {/* Table of stops */}
              {techJobs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  Este técnico no tiene servicios asignados para esta fecha.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {techJobs.map((job, idx) => (
                    <div key={job.id} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-6 h-6 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: currentTech.color }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{job.customerName}</span>
                            <span className="font-mono text-xs font-normal text-slate-400">({job.code})</span>
                          </div>
                          <div className="text-slate-600 font-medium">{job.title}</div>
                          <div className="text-slate-500 text-[11px] mt-0.5">📍 {job.location.address}</div>
                          {job.customerPhone && (
                            <div className="text-blue-600 text-[11px]">📞 {job.customerPhone}</div>
                          )}
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded">
                        <div className="font-mono font-bold text-blue-700 text-xs">
                          {job.scheduledArrival || '--:--'} - {job.scheduledDeparture || '--:--'}
                        </div>
                        <div className="text-slate-500 text-[11px]">Duración: {job.estimatedDuration} min</div>
                        <div className="text-slate-400 text-[10px] mt-1">[ ] Firma / Conforme</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Return to Base */}
              {summary && techJobs.length > 0 && (
                <div className="p-2.5 bg-slate-100/70 rounded-lg flex items-center justify-between text-slate-700 border-t border-slate-200">
                  <div>
                    <span className="font-bold">🏁 Fin de Jornada Estimado:</span> fin de turno
                  </div>
                  <span className="font-mono font-bold text-slate-800">{summary.estimatedEndTime}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 font-medium cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Texto Copiado!' : 'Copiar Texto para SMS/Chat'}</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="hidden sm:flex items-center gap-1.5 text-slate-500 hover:text-slate-800 px-2 py-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
