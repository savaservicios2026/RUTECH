import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

interface DictateButtonProps {
  // Receives each finished sentence the person said
  onText: (text: string) => void;
}

// The browser's speech recognition (Chrome, Edge, Safari on iPhone)
const Recognition: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

/** Microphone button: the technician speaks and what they say is written into the field. */
export const DictateButton: React.FC<DictateButtonProps> = ({ onText }) => {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => recRef.current?.abort(), []);

  const start = () => {
    setError(null);
    if (!Recognition) {
      setError('Este navegador no permite dictar aquí. Usa el micrófono del teclado del móvil.');
      return;
    }
    const rec = new Recognition();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) {
          if (said) onTextRef.current(said.charAt(0).toUpperCase() + said.slice(1));
        } else partial += said + ' ';
      }
      setInterim(partial.trim());
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        setError('No hay permiso para el micrófono. Actívalo en los ajustes del navegador.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('No se pudo dictar. Inténtalo de nuevo.');
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => recRef.current?.stop();

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
          listening ? 'bg-rose-600 text-white animate-pulse' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {listening ? 'Parar dictado' : 'Dictar por voz'}
      </button>
      {listening && <div className="text-xs text-slate-500 italic">{interim || 'Te escucho… di qué has hecho y el material usado.'}</div>}
      {error && <div className="text-xs text-rose-600">{error}</div>}
    </div>
  );
};
