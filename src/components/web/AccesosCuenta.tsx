'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, KeyRound, ShieldCheck } from 'lucide-react';
import { establecerClave, misAccesos } from '@/lib/tienda';
import { SeccionPerfil } from './SeccionPerfil';
import { Campo, campoClase } from './CuentaForms';

/**
 * Formas de entrar a la cuenta.
 *
 * Aquí es donde se resuelve lo de "poder entrar por los dos lados":
 *
 *   · Quien se registró con correo y contraseña y luego pulsa Google con ese
 *     mismo correo NO crea una cuenta nueva — Supabase enlaza la identidad a
 *     la que ya tenía. Sus puntos y sus pedidos siguen ahí.
 *   · Quien entró primero con Google no tiene contraseña, así que el
 *     formulario de correo no le serviría. Desde aquí se pone una y a partir
 *     de ese momento le valen las dos puertas.
 *
 * NO hay botón de "conectar Google" estando dentro, y es a posta: eso exige
 * `linkIdentity` con el enlazado manual activado en el proyecto, y si el
 * cliente elige en Google una cuenta con OTRO correo, acabaría cambiado de
 * usuario sin enterarse. Salir y entrar con Google hace lo mismo sin ese
 * riesgo, así que es lo que se le explica.
 */
export function AccesosCuenta({ correo }: { correo: string | null }) {
  const [accesos, setAccesos] = useState<string[] | null>(null);
  /**
   * Contraseña recién puesta en esta visita.
   *
   * Poner contraseña no siempre añade la identidad `email` en Supabase, así
   * que releer las identidades no basta para saber que ya la tiene. Este
   * estado evita seguir diciéndole "no tienes contraseña" justo después de
   * haberla creado.
   */
  const [reciente, setReciente] = useState(false);

  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void misAccesos().then(setAccesos);
  }, []);

  const tieneGoogle = accesos?.includes('google') ?? false;
  const tieneClave = (accesos?.includes('email') ?? false) || reciente;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (clave !== repetir) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      await establecerClave(clave);
      setClave('');
      setRepetir('');
      setReciente(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (accesos === null) return null;

  const esGmail = /@gmail\.com$/i.test(correo ?? '');

  return (
    <SeccionPerfil titulo="Cómo entras a tu cuenta" icono={ShieldCheck}>
      <ul className="grid gap-3 sm:grid-cols-2">
        <Metodo
          activo={tieneClave}
          titulo="Correo y contraseña"
          nota={tieneClave ? 'Activo' : 'Sin contraseña definida'}
        />
        <Metodo
          activo={tieneGoogle}
          titulo="Google"
          nota={tieneGoogle ? 'Conectado' : 'Sin conectar'}
        />
      </ul>

      {!tieneGoogle && esGmail && (
        <p className="mt-5 rounded-2xl border border-white/10 bg-night p-5 text-[13px] leading-relaxed text-bone-dim">
          Tu correo es de Gmail. Si cierras sesión y entras con{' '}
          <b className="text-white">Continuar con Google</b>, llegarás a{' '}
          <b className="text-white">esta misma cuenta</b>: no se crea otra ni pierdes puntos.
        </p>
      )}

      {reciente && (
        <p className="mt-5 rounded-2xl border border-emerald-600/40 bg-emerald-600/10 p-5 text-[13px] leading-relaxed text-emerald-400">
          Contraseña guardada. Ya puedes entrar con Google o con tu correo, como prefieras.
        </p>
      )}

      {!tieneClave && (
        <form onSubmit={guardar} className="mt-5 rounded-2xl border border-white/10 bg-night p-5">
          <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-bone-dim">
            <KeyRound className="mt-0.5 h-4 w-4 flex-none text-sugu" aria-hidden />
            Entraste con Google, así que todavía no tienes contraseña. Ponte una si algún día
            quieres entrar sin él.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nueva contraseña">
              <input
                type="password"
                required
                minLength={6}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className={campoClase}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </Campo>
            <Campo etiqueta="Repetir contraseña">
              <input
                type="password"
                required
                minLength={6}
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                className={campoClase}
                autoComplete="new-password"
              />
            </Campo>
          </div>

          {error && <p className="mt-3 text-[13px] text-sugu">{error}</p>}

          <button
            type="submit"
            disabled={guardando}
            className="btn-primary mt-4 disabled:pointer-events-none disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Crear contraseña'}
          </button>
        </form>
      )}
    </SeccionPerfil>
  );
}

function Metodo({ activo, titulo, nota }: { activo: boolean; titulo: string; nota: string }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border p-4 ${
        activo ? 'border-emerald-600/40 bg-emerald-600/10' : 'border-white/10 bg-night'
      }`}
    >
      <span
        className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${
          activo ? 'bg-emerald-600/25 text-emerald-400' : 'bg-white/5 text-white/30'
        }`}
      >
        <Check className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{titulo}</span>
        <span className={`block text-[12px] ${activo ? 'text-emerald-400' : 'text-bone-dim'}`}>
          {nota}
        </span>
      </span>
    </li>
  );
}
