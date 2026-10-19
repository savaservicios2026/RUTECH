import React, { useEffect, useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { CompanyInfo } from '../types';

export const DEFAULT_COMPANY: CompanyInfo = {
  id: 'company',
  legalName: 'SAVA Servicios Deportivos',
  cif: '',
  address: '',
  phone: '',
  email: 'administracion@savaservicios.com',
  web: '',
};

interface CompanyModalProps {
  isOpen: boolean;
  company: CompanyInfo;
  onClose: () => void;
  onSave: (company: CompanyInfo) => void;
}

const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

export const CompanyModal: React.FC<CompanyModalProps> = ({ isOpen, company, onClose, onSave }) => {
  const [form, setForm] = useState(company);
  useEffect(() => {
    if (isOpen) setForm(company);
  }, [isOpen, company]);
  if (!isOpen) return null;

  const field = (key: keyof Omit<CompanyInfo, 'id'>, label: string, placeholder = '') => (
    <label className="block">
      <span className="block text-xs font-bold text-slate-600 mb-1">{label}</span>
      <input className={inputClass} value={form[key] || ''} placeholder={placeholder} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...form, id: 'company' });
        }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 bg-gradient-to-r from-[#1f4f94] to-[#0d2650] text-white flex items-center justify-between">
          <span className="font-bold text-base flex items-center gap-2"><Building2 className="w-5 h-5" />Datos de la empresa</span>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500">Salen en la cabecera de los partes de trabajo impresos o en PDF.</p>
          {field('legalName', 'Razón social')}
          {field('cif', 'CIF', 'B12345678')}
          {field('address', 'Dirección fiscal', 'Calle, número, CP, localidad')}
          <div className="grid grid-cols-2 gap-3">
            {field('phone', 'Teléfono')}
            {field('email', 'Correo')}
          </div>
          {field('web', 'Web (opcional)')}
          {field('reviewUrl', 'Enlace para reseñas de Google', 'https://g.page/r/…/review')}
          <p className="text-[11px] text-slate-500 -mt-2">Se envía al cliente por WhatsApp junto al parte firmado.</p>
        </div>
        <div className="p-3 border-t bg-slate-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-xl font-bold text-sm cursor-pointer">Cancelar</button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm cursor-pointer">Guardar</button>
        </div>
      </form>
    </div>
  );
};
