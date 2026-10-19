import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
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

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !token) return setState('missing');
    getDoc(doc(db, 'publicWorkOrders', token))
      .then((snap) => {
        if (!snap.exists()) return setState('missing');
        setData(snap.data() as SharedWorkOrder);
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
