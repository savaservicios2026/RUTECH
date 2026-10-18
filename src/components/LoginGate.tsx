import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, User } from 'firebase/auth';
import { LogIn, LogOut } from 'lucide-react';
import logoSava from '../assets/logo-sava.png?inline';
import { getFirebaseAuth, getRole, isFirebaseEnabled, signOutUser } from '../utils/firebase';
import { Access, AccessContext } from '../utils/access';

/**
 * In the standalone app every worker signs in with the email and password created for them
 * in Firebase, and gets the role the office gave them (roles/{email}). Inside Claude, or before
 * Firebase is configured, the app opens directly with full access.
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
  const [access, setAccess] = useState<Access | 'none' | null>(null);

  useEffect(() => {
    if (!needsLogin) return;
    const auth = getFirebaseAuth()!;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAccess(null);
      setChecking(false);
    });
  }, [needsLogin]);

  useEffect(() => {
    if (!user?.email) return;
    const email = user.email.toLowerCase();
    let cancelled = false;
    const load = () =>
      getRole(email)
        .then((r) => {
          if (cancelled) return;
          if (r?.role === 'oficina') setAccess({ role: 'oficina', email });
          else if (r?.role === 'tecnico' && r.technicianId) setAccess({ role: 'tecnico', email, technicianId: r.technicianId });
          else setAccess('none');
        })
        // No connection yet and nothing cached: try again shortly
        .catch(() => { if (!cancelled) setTimeout(load, 3000); });
    load();
    return () => { cancelled = true; };
  }, [user]);

  if (!needsLogin) return <>{children}</>;

  if (user && access && access !== 'none') {
    return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1f4f94] via-[#0d2650] to-[#040c1f] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl text-center">
          <div className="rounded-xl bg-white p-3">
            <img src={logoSava} alt="SAVA servicios deportivos" className="w-full" />
          </div>
          {access === 'none' ? (
            <>
              <p className="text-sm text-slate-200">Tu usuario ({user.email}) todavía no tiene permisos en RUTECH.</p>
              <p className="text-xs text-slate-400">Pide a la oficina que ponga este email en tu ficha de técnico.</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Cargando tus permisos…</p>
          )}
          <button onClick={() => signOutUser()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gradient-to-b from-[#1f4f94] via-[#0d2650] to-[#040c1f] flex items-center justify-center p-4">
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
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#5a5ea8] hover:bg-[#686bac] disabled:opacity-60 text-white font-semibold py-2.5">
              <LogIn className="w-4 h-4" /> {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </>
        )}
      </form>
    </div>
  );
};
