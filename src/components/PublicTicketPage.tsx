import React from 'react';
import logoSava from '../assets/logo-sava-dark.png?inline';
import { TicketForm } from './TicketForm';

/** Public page (…/RUTECH/#aviso) where customers report a breakdown without an account. */
export const PublicTicketPage: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-b from-[#1f4f94] via-[#0d2650] to-[#040c1f] px-4 py-6">
    <div className="max-w-xl mx-auto space-y-4">
      <div className="text-center space-y-2">
        <img src={logoSava} alt="SAVA servicios deportivos" className="w-56 mx-auto" />
        <h1 className="text-xl font-bold text-white">Aviso de avería</h1>
        <p className="text-sm text-indigo-100">Cuéntanos qué le pasa a la máquina y te llamamos para darte cita.</p>
      </div>
      <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6">
        <TicketForm source="cliente" />
      </div>
    </div>
  </div>
);
