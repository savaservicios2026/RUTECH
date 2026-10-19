import React, { useEffect, useRef, useState } from 'react';
import { Camera, Paperclip, FileText, Trash2, Loader2 } from 'lucide-react';
import { Attachment } from '../types';
import { prepareAttachment, removeAttachment, saveAttachment, watchAttachments, openAttachment } from '../utils/attachments';

interface AttachmentsBoxProps {
  serviceId: string;
  section: Attachment['section'];
  canDelete?: (att: Attachment) => boolean;
  title?: string;
}

/** Photos and files for a job: take a photo, attach files, open or remove them. Saved at once. */
export const AttachmentsBox: React.FC<AttachmentsBoxProps> = ({ serviceId, section, canDelete, title }) => {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => watchAttachments(serviceId, setItems), [serviceId]);

  const mine = items.filter((a) => a.section === section);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      try {
        await saveAttachment(await prepareAttachment(file, serviceId, section));
      } catch {
        failed.push(file.name);
      }
    }
    setBusy(false);
    if (failed.length) setError(`No se pudo subir: ${failed.join(', ')} (máximo unos 700 KB por archivo; las fotos se reducen solas)`);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {title && <span className="font-semibold text-slate-700">{title}</span>}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
        >
          <Camera className="w-4 h-4" /> Foto
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
        >
          <Paperclip className="w-4 h-4" /> Adjuntar archivo
        </button>
        {busy && (
          <span className="flex items-center gap-1 text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo…
          </span>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <div className="text-rose-600">{error}</div>}
      {mine.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mine.map((a) => (
            <div key={a.id} className="relative group">
              <button
                type="button"
                onClick={() => openAttachment(a)}
                className="block w-20 h-20 rounded-lg border border-slate-300 overflow-hidden bg-slate-50 cursor-pointer"
                title={a.name}
              >
                {a.type.startsWith('image/') ? (
                  <img src={a.dataUrl} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center justify-center h-full p-1 text-[10px] text-slate-600">
                    <FileText className="w-6 h-6 text-slate-400" />
                    <span className="truncate w-full text-center">{a.name}</span>
                  </span>
                )}
              </button>
              {(!canDelete || canDelete(a)) && (
                <button
                  type="button"
                  onClick={() => {
                    if (armedDelete !== a.id) {
                      setArmedDelete(a.id);
                      setTimeout(() => setArmedDelete((x) => (x === a.id ? null : x)), 4000);
                      return;
                    }
                    removeAttachment(a.id);
                  }}
                  className={`absolute -top-1.5 -right-1.5 rounded-full p-1 shadow cursor-pointer ${
                    armedDelete === a.id ? 'bg-rose-600 text-white' : 'bg-white text-slate-500 border border-slate-300'
                  }`}
                  title={armedDelete === a.id ? 'Pulsa otra vez para borrar' : 'Borrar'}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
