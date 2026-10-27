import React, { useState } from 'react';
import { Camera, MapPin, Send, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PriorityType, Ticket } from '../types';
import { createTicket, geocodeAddress, MAX_MEDIA_FILES, prepareMedia, zoneFor } from '../utils/tickets';

const URGENCY_OPTIONS: { value: PriorityType; label: string; hint: string; tone: string }[] = [
  { value: 'baja', label: 'Baja', hint: 'Puede esperar', tone: 'border-slate-300 text-slate-700' },
  { value: 'media', label: 'Media', hint: 'Esta semana', tone: 'border-blue-300 text-blue-700' },
  { value: 'alta', label: 'Alta', hint: 'En 1-2 días', tone: 'border-amber-300 text-amber-700' },
  { value: 'urgente', label: 'Urgente', hint: 'Máquina parada', tone: 'border-rose-300 text-rose-700' },
];

interface TicketFormProps {
  source: 'cliente' | 'oficina';
  onCreated?: (ticket: Ticket) => void;
  onCancel?: () => void;
  // Editing an existing notice: fields come filled in and saving returns the changes
  ticket?: Ticket;
  onSave?: (changes: Partial<Ticket>) => void;
}

/** Breakdown report form: the public page for customers and the office's "Nuevo aviso" use it. */
export const TicketForm: React.FC<TicketFormProps> = ({ source, onCreated, onCancel, ticket, onSave }) => {
  // A customer's notice needs brand and model, email and phone to be sent
  const strict = !ticket && source === 'cliente';
  const [customerName, setCustomerName] = useState(ticket?.customerName || '');
  const [facility, setFacility] = useState(ticket?.facility || '');
  const [customerPhone, setCustomerPhone] = useState(ticket?.customerPhone || '');
  const [customerEmail, setCustomerEmail] = useState(ticket?.customerEmail || '');
  const [machine, setMachine] = useState(ticket?.machine || '');
  const [problem, setProblem] = useState(ticket?.problem || '');
  const [description, setDescription] = useState(ticket?.description || '');
  const [urgency, setUrgency] = useState<PriorityType>(ticket?.urgency || 'media');
  const [address, setAddress] = useState(ticket?.location.address || '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [media, setMedia] = useState<{ type: 'image' | 'video'; name: string; dataUrl: string }[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Ticket | null>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setNotice('Este móvil no permite compartir la ubicación. Escribe la dirección.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        setNotice(null);
      },
      () => {
        setLocating(false);
        setNotice('No se pudo obtener la ubicación. Escribe la dirección.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setMediaBusy(true);
    setNotice(null);
    const next = [...media];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_MEDIA_FILES) {
        setNotice(`Máximo ${MAX_MEDIA_FILES} fotos o vídeos por aviso.`);
        break;
      }
      try {
        next.push(await prepareMedia(file));
      } catch (e: any) {
        setNotice(
          e?.message === 'video-too-big'
            ? 'Ese vídeo es demasiado largo. Envía un vídeo de pocos segundos o mándalo por WhatsApp indicando el número de aviso.'
            : 'No se pudo adjuntar uno de los archivos.'
        );
      }
    }
    setMedia(next);
    setMediaBusy(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (strict && (!machine.trim() || !customerEmail.trim() || !customerPhone.trim())) {
      setError('Indica la marca y modelo de la máquina, tu correo y tu teléfono para poder enviar el aviso.');
      return;
    }
    setSending(true);
    setError(null);
    if (ticket && onSave) {
      try {
        const moved = !!coords || address.trim() !== ticket.location.address;
        const point = coords || (moved && address.trim() ? await geocodeAddress(address.trim()) : null);
        onSave({
          customerName: customerName.trim(),
          facility: facility.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          machine: machine.trim(),
          problem: problem.trim(),
          description: description.trim(),
          urgency,
          ...(moved && {
            location: {
              address: address.trim() || (coords ? 'Ubicación GPS' : ticket.location.address),
              lat: point?.lat ?? null,
              lng: point?.lng ?? null,
              ...(point && { zone: zoneFor(point.lat, point.lng) }),
            },
          }),
        });
      } catch {
        setError('No se pudieron guardar los cambios.');
      } finally {
        setSending(false);
      }
      return;
    }
    try {
      const point = coords || (address.trim() ? await geocodeAddress(address.trim()) : null);
      const ticket = await createTicket(
        {
          source,
          customerName: customerName.trim(),
          facility: facility.trim() || undefined,
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          machine: machine.trim() || undefined,
          problem: problem.trim(),
          description: description.trim() || undefined,
          urgency,
          location: {
            address: address.trim() || (coords ? 'Ubicación GPS del cliente' : ''),
            lat: point?.lat ?? null,
            lng: point?.lng ?? null,
            zone: point ? zoneFor(point.lat, point.lng) : undefined,
          },
        },
        media
      );
      setCreated(ticket);
      onCreated?.(ticket);
    } catch {
      setError('No se pudo enviar el aviso. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  if (created) {
    return (
      <div className="text-center space-y-3 py-6">
        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Aviso enviado</h2>
        <p className="text-sm text-slate-600">Número de aviso:</p>
        <div className="text-3xl font-black tracking-wider text-slate-900">{created.number}</div>
        <p className="text-sm text-slate-500">
          {source === 'cliente' ? 'Guarda este número. Te llamaremos para darte cita.' : 'Ya aparece en el apartado Averías.'}
        </p>
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : window.location.reload())}
          className="mt-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold"
        >
          {onCancel ? 'Cerrar' : 'Enviar otro aviso'}
        </button>
      </div>
    );
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-slate-600">Nombre y apellidos *
          <input required maxLength={100} value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">Gimnasio / instalación
          <input maxLength={120} value={facility} onChange={(e) => setFacility(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">Teléfono *
          <input required type="tel" maxLength={30} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">Email{strict ? ' *' : ''}
          <input required={strict} type="email" maxLength={120} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="block text-xs font-semibold text-slate-600">Máquina (marca y modelo){strict ? ' *' : ''}
        <input required={strict} maxLength={120} placeholder="Ej. Cinta Technogym Excite 700" value={machine} onChange={(e) => setMachine(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-xs font-semibold text-slate-600">Problema *
        <input required maxLength={150} placeholder="Ej. La cinta se para sola" value={problem} onChange={(e) => setProblem(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-xs font-semibold text-slate-600">Descripción
        <textarea rows={3} maxLength={2000} placeholder="Qué pasa, desde cuándo, si hace algún ruido o sale algún error..." value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>

      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">Urgencia *</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {URGENCY_OPTIONS.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => setUrgency(o.value)}
              className={`rounded-lg border-2 px-2 py-2 text-left ${o.tone} ${urgency === o.value ? 'bg-slate-900 !text-white !border-slate-900' : 'bg-white'}`}
            >
              <div className="text-sm font-bold">{o.label}</div>
              <div className="text-[11px] opacity-80">{o.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600">Dirección *
          <input required={!coords} maxLength={200} placeholder="Calle, número y localidad" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </label>
        <button type="button" onClick={useMyLocation} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          {coords ? 'Ubicación GPS añadida ✓' : 'Usar mi ubicación actual'}
        </button>
      </div>

      {!ticket && (<div>
        <div className="text-xs font-semibold text-slate-600 mb-1">Fotos o vídeos (máx. {MAX_MEDIA_FILES})</div>
        <div className="flex flex-wrap gap-2">
          {media.map((m, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              {m.type === 'image' ? <img src={m.dataUrl} alt="" className="w-full h-full object-cover" /> : <video src={m.dataUrl} className="w-full h-full object-cover" />}
              <button type="button" onClick={() => setMedia(media.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {media.length < MAX_MEDIA_FILES && (
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 text-[11px] cursor-pointer">
              {mediaBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              Añadir
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
      </div>)}

      {notice && <p className="text-xs text-amber-700 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />{notice}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
        )}
        <button type="submit" disabled={sending || mediaBusy} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1f4f94] hover:bg-[#0d2650] disabled:opacity-60 text-white text-sm font-semibold">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? (ticket ? 'Guardando…' : 'Enviando…') : ticket ? 'Guardar cambios' : 'Enviar aviso'}
        </button>
      </div>
    </form>
  );
};
