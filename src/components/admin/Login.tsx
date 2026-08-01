'use client';

import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { iniciarSesion } from '@/lib/admin';

export function Login({ alEntrar }: { alEntrar: () => void }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(correo, clave);
      alEntrar();
    } catch {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setEnviando(false);
    }
  };

  const campo =
    'w-full rounded-xl border border-white/15 bg-night px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-sugu';

  return (
    <div className="grid min-h-screen place-items-center bg-night p-6">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-night-2 p-9"
      >
        <p className="text-center text-xl font-extrabold tracking-tight">
          Sugu<span className="text-sugu">Rolls</span>
        </p>
        <h1 className="mt-1 text-center text-[11px] uppercase tracking-widest text-bone-dim">
          Panel de administración
        </h1>

        <div className="mt-8 space-y-4">
          <div>
            <label htmlFor="correo" className="mb-2 block text-[13px] font-medium">
              Correo
            </label>
            <input
              id="correo"
              type="email"
              required
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={campo}
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label htmlFor="clave" className="mb-2 block text-[13px] font-medium">
              Contraseña
            </label>
            <input
              id="clave"
              type="password"
              required
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className={campo}
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-center text-[13px] text-sugu" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={enviando} className="btn-primary mt-7 w-full">
          <LogIn className="h-4 w-4" />
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
