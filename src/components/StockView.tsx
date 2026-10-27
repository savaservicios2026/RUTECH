import React from 'react';
import { ExternalLink } from 'lucide-react';

/** Shop4Fit Stocks lives in its own repository; it shares this app's Firebase project and sign-in (same github.io origin). */
export const STOCK_URL = 'https://savaservicios2026.github.io/shop4fit-stocks/';

/** Pedidos section (office only): the warehouse stock app, embedded. */
export const StockView: React.FC<{ hidden?: boolean }> = ({ hidden }) => (
  <div className={hidden ? 'hidden' : 'flex-1 flex flex-col gap-2'}>
    <div className="flex justify-end">
      <a href={STOCK_URL} target="_blank" rel="noopener"
        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600">
        <ExternalLink className="w-3.5 h-3.5" />Abrir en otra pestaña
      </a>
    </div>
    <iframe
      src={STOCK_URL}
      title="Shop4Fit Stocks"
      allow="camera; clipboard-write"
      className="w-full flex-1 min-h-[calc(100dvh-11rem)] md:min-h-[calc(100dvh-10rem)] rounded-xl border border-slate-200 bg-white"
    />
  </div>
);
