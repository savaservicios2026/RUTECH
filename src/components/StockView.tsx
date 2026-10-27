import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

/** Shop4Fit Stocks lives in its own repository; it shares this app's Firebase project and sign-in (same github.io origin). */
export const STOCK_URL = 'https://savaservicios2026.github.io/shop4fit-stocks/';

/** Pedidos section (office only): the warehouse stock app, embedded. */
export const StockView: React.FC<{ hidden?: boolean }> = ({ hidden }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();

  // The embedded app has its own bottom tab bar, so the frame must end exactly above the
  // mobile nav (fixed at the bottom) instead of running underneath it.
  useEffect(() => {
    if (hidden) return;
    const fit = () => {
      const el = frame.current; if (!el) return;
      const nav = document.querySelector<HTMLElement>('[data-mobile-nav]');
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(420, window.innerHeight - top - navH - (navH ? 8 : 24)));
    };
    fit();
    const t = setTimeout(fit, 300);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => { clearTimeout(t); window.removeEventListener('resize', fit); window.visualViewport?.removeEventListener('resize', fit); };
  }, [hidden]);

  return (
    <div className={hidden ? 'hidden' : 'flex flex-col gap-2'}>
      <div className="flex justify-end">
        <a href={STOCK_URL} target="_blank" rel="noopener"
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600">
          <ExternalLink className="w-3.5 h-3.5" />Abrir en otra pestaña
        </a>
      </div>
      <iframe
        ref={frame}
        src={STOCK_URL}
        title="Shop4Fit Stocks"
        allow="camera; clipboard-write"
        style={height ? { height } : undefined}
        className="w-full h-[calc(100dvh-14rem)] rounded-xl border border-slate-200 bg-white"
      />
    </div>
  );
};
