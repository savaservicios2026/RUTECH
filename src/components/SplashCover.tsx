import React, { useEffect, useState } from 'react';
import logoSava from '../assets/logo-sava-dark.png?inline';

/** Opening cover with the SAVA logo; fades out on its own or with a tap. */
export const SplashCover: React.FC = () => {
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show');

  useEffect(() => {
    const fade = setTimeout(() => setPhase('fade'), 1600);
    return () => clearTimeout(fade);
  }, []);

  useEffect(() => {
    if (phase !== 'fade') return;
    const gone = setTimeout(() => setPhase('gone'), 400);
    return () => clearTimeout(gone);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      onClick={() => setPhase('fade')}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#1f4f94] via-[#0d2650] to-[#040c1f] px-6 transition-opacity duration-400 motion-reduce:transition-none ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="w-full max-w-sm px-2">
        <img src={logoSava} alt="SAVA servicios deportivos" className="w-full" />
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold tracking-wide text-white">RUTECH</div>
        <div className="text-sm text-indigo-100">Planificador de rutas técnicas</div>
      </div>
    </div>
  );
};
