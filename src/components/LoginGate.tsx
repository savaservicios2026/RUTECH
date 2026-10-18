import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, User } from 'firebase/auth';
import { LogIn } from 'lucide-react';
import logoSava from '../assets/logo-sava.png?inline';
import { getFirebaseAuth, isFirebaseEnabled } from '../utils/firebase';

/**
 * In the standalone app every worker signs in with the email and password created for them
 * in Firebase. Inside Claude, or before Firebase is configured, the app opens directly.
 */
export const LoginGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insideClaude = Boolean((window as any).claude?.use);
  const needsLogin = isFirebaseEnabled() && !insideClaude;
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(needsLogin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!needsLogin) return;
    const auth = getFirebaseAuth()!;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
  }, [needsLogin]);

  if (!needsLogin || user) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth()!, email.trim(), password);
    } catch {
      setError('Email o contraseña incorrectos. Revísalos o pide a la oficina que te dé acceso.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="rounded-xl bg-white p-3">
          <img src={logoSava} alt="SAVA servicios deportivos" className="w-full" />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">RUTECH</h1>
            <p className="text-xs text-slate-400">Entra con tu usuario de trabajo</p>
          </div>
        </div>
        {checking ? (
          <p className="text-sm text-slate-400">Comprobando sesión…</p>
        ) : (
          <>
            <label className="block text-sm text-slate-300">
              Email
              <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <label className="block text-sm text-slate-300">
              Contraseña
              <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5">
              <LogIn className="w-4 h-4" /> {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </>
        )}
      </form>
    </div>
  );
};
