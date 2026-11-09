import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, FileUp, Loader2, PenLine, Trash2 } from 'lucide-react';
import { Attachment } from '../types';
import { removeAttachment, saveAttachment, watchAttachments } from '../utils/attachments';
import { getFirebaseAuth } from '../utils/firebase';
import { fileToPages, MAX_DOC_PAGES } from '../utils/documents';
import { DocEditor } from './DocEditor';

const newId = () => `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Supplier documents in the work order: photo or PDF of the supplier's own report, which the
 * technician can write on and sign here. Each page goes inside our work order PDF.
 */
export const DocumentsBox: React.FC<{ serviceId: string }> = ({ serviceId }) => {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Attachment | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => watchAttachments(serviceId, setItems), [serviceId]);
  const docs = items.filter((a) => a.section === 'documento');

  const addFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const pages = await fileToPages(file);
      const base = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Documento';
      const t0 = Date.now();
      const saved: Attachment[] = [];
      for (let i = 0; i < pages.length; i++) {
        const att: Attachment = {
          id: newId(),
          serviceId,
          section: 'documento',
          name: pages.length > 1 ? `${base} · pág. ${i + 1}` : base,
          type: 'image/jpeg',
          dataUrl: pages[i],
          createdAt: new Date(t0 + i).toISOString(),
          by: getFirebaseAuth()?.currentUser?.email || undefined,
        };
        await saveAttachment(att);
        saved.push(att);
      }
      // Straight to the first page to write on it and sign
      if (saved.length) setEditing(saved[0]);
      if (pages.length === MAX_DOC_PAGES) setError(`Solo se han añadido las primeras ${MAX_DOC_PAGES} páginas.`);
    } catch {
      setError('No se pudo añadir el documento. Prueba con una foto o con un PDF más pequeño.');
    } finally {
      setBusy(false);
    }
  };

  // Saved as a new copy in the same place of the list, then the old one is removed
  const saveEdited = async (old: Attachment, dataUrl: string) => {
    const copy: Attachment = { ...old, id: newId(), dataUrl, by: getFirebaseAuth()?.currentUser?.email || old.by };
    await saveAttachment(copy);
    try {
      await removeAttachment(old.id);
    } catch {
      await removeAttachment(copy.id).catch(() => {});
      setError('Solo quien subió el documento (o la oficina) puede cambiarlo.');
    }
    setEditing(null);
  };

  return (
    <div className="space-y-2 bg-indigo-50 border border-indigo-200 rounded-xl p-2.5">
      <div>
        <div className="font-bold text-slate-700 text-[11px]">Documentos del proveedor</div>
        <div className="text-[11px] text-slate-500">Haz una foto o adjunta el PDF, escribe y firma encima. Se incluye dentro de nuestro parte.</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          <Camera className="w-4 h-4" /> Foto del documento
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-800 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          <FileUp className="w-4 h-4" /> Adjuntar PDF o imagen
        </button>
        {busy && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparando…
          </span>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFile(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={fileRef} type="file" accept="application/pdf,.pdf,image/*" className="hidden" onChange={(e) => { addFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error && <div className="text-xs text-rose-600">{error}</div>}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docs.map((a) => (
            <div key={a.id} className="relative w-24">
              <button type="button" onClick={() => setEditing(a)} className="block w-24 h-32 rounded-lg border border-slate-300 overflow-hidden bg-white cursor-pointer" title={a.name}>
                <img src={a.dataUrl} alt={a.name} className="w-full h-full object-contain" />
              </button>
              <button
                type="button"
                onClick={() => setEditing(a)}
                className="mt-1 w-full flex items-center justify-center gap-1 px-1 py-1 bg-white border border-indigo-300 rounded-md text-[10px] font-bold text-indigo-800 cursor-pointer"
              >
                <PenLine className="w-3 h-3" /> Escribir / firmar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (armedDelete !== a.id) {
                    setArmedDelete(a.id);
                    setTimeout(() => setArmedDelete((x) => (x === a.id ? null : x)), 4000);
                    return;
                  }
                  removeAttachment(a.id).catch(() => setError('Solo quien subió el documento (o la oficina) puede borrarlo.'));
                }}
                className={`absolute -top-1.5 -right-1.5 rounded-full p-1 shadow cursor-pointer ${
                  armedDelete === a.id ? 'bg-rose-600 text-white' : 'bg-white text-slate-500 border border-slate-300'
                }`}
                title={armedDelete === a.id ? 'Pulsa otra vez para borrar' : 'Borrar'}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Over the whole screen, outside the work order window */}
      {editing &&
        createPortal(
          <DocEditor src={editing.dataUrl} title={editing.name} onClose={() => setEditing(null)} onSave={(url) => saveEdited(editing, url)} />,
          document.body
        )}
    </div>
  );
};
