import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import logoSava from '../assets/logo-sava-dark.png?inline';
import { getFirestoreDb } from '../utils/firebase';
import { SharedTicket } from '../utils/supplierShare';

type Media = { type: 'image' | 'video'; name: string; dataUrl: string };

/** Public page (…/RUTECH/#averia/<código>) where a supplier sees a breakdown with its photos and videos. */
export const PublicSupplierPage: React.FC = () => {
  const token = location.hash.split('/')[1] || '';
  const [data, setData] = useState<SharedTicket | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !token) return setState('missing');
    getDoc(doc(db, 'publicTickets', token))
      .then(async (snap) => {
        if (!snap.exists()) return setState('missing');
        const t = snap.data() as SharedTicket;
        setData(t);
        setState('ok');
        const items = await Promise.all(
          (t.mediaIds || []).map((id) => getDoc(doc(db, 'publicTicketMedia', id)).then((d) => (d.exists() ? (d.data() as Media) : null)).catch(() => null))
        );
        setMedia(items.filter(Boolean) as Media[]);
      })
      .catch(() => setState('missing'));
  }, [token]);

  const row = (label: string, value?: string) =>
    value ? (
      <div>
        <span className="font-semibold text-slate-500">{label}: </span>
        <span className="text-slate-900 whitespace-pre-line">{value}</span>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1f4f94] via-[#0d2650] to-[#040c1f] px-3 py-5">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <img src={logoSava} alt="SAVA servicios deportivos" className="w-48 mx-auto" />
          <h1 className="text-lg font-bold text-white">Aviso de avería{data ? ` ${data.number}` : ''}</h1>
        </div>
        {state === 'loading' && (
          <div className="text-center text-white py-10">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}
        {state === 'missing' && (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-slate-700">No encontramos este aviso.</div>
        )}
        {state === 'ok' && data && (
          <div className="bg-white rounded-2xl p-5 space-y-3 text-sm">
            {row('Cliente', `${data.customerName}${data.facility ? ` (${data.facility})` : ''}`)}
            {row('Dirección', data.address)}
            {row('Máquina', data.machine)}
            {row('Avería', data.problem)}
            {row('Detalle', data.description)}
            {row('Fecha del aviso', new Date(data.createdAt).toLocaleString('es-ES'))}
            {data.mediaIds.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="font-semibold text-slate-700">Fotos y vídeos</div>
                {media.length === 0 && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
                {media.map((m, i) =>
                  m.type === 'video' ? (
                    <video key={i} src={m.dataUrl} controls className="w-full rounded-lg border border-slate-200" />
                  ) : (
                    <a key={i} href={m.dataUrl} download={m.name}>
                      <img src={m.dataUrl} alt={m.name} className="w-full rounded-lg border border-slate-200" />
                    </a>
                  )
                )}
              </div>
            )}
            <p className="text-xs text-slate-500 pt-2">SAVA Servicios Deportivos · administracion@savaservicios.com · 604 015 066</p>
          </div>
        )}
      </div>
    </div>
  );
};
