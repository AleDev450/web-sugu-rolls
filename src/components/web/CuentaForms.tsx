'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { ingresar, registrarse } from '@/lib/tienda';

export const campoClase =
  'w-full rounded-xl border border-white/15 bg-night px-4 py-3 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-sugu';

export function Campo({
  etiqueta,
  children,
  ancho = 'normal',
}: {
  etiqueta: string;
  children: ReactNode;
  ancho?: 'normal' | 'completo';
}) {
  return (
    <label className={`block ${ancho === 'completo' ? 'sm:col-span-2' : ''}`}>
      <span className="mb-2 block text-[13px] font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}

/**
 * Mensajes de Supabase Auth traducidos a algo que un cliente entienda.
 *
 * Las reglas van de más específica a más general y NINGUNA es un cajón de
 * sastre. Antes había un `includes('email')` al final que se tragaba
 * cualquier error con esa palabra —el límite de envíos, por ejemplo— y lo
 * mostraba como "correo inválido", mandando a la gente a revisar un dato que
 * estaba perfecto. Si algo no encaja, se dice que no se pudo y el detalle
 * real se deja en la consola.
 */
function traducir(mensaje: string): string {
  const m = mensaje.toLowerCase();

  if (
    m.includes('already registered') ||
    m.includes('already been registered') ||
    m.includes('ya tiene una cuenta')
  ) {
    return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  }

  // Supabase limita los correos que envía por hora en el plan gratuito
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('too many')) {
    return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.';
  }

  /*
   * Sale cuando el proyecto tiene activada la confirmación por correo y el
   * cliente no ha abierto el enlace. Se apaga en Supabase:
   * Authentication -> Providers -> Email -> "Confirm email".
   */
  if (m.includes('not confirmed')) {
    return 'Tu correo aún no está confirmado. Abre el enlace que te enviamos.';
  }

  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (m.includes('invalid email') || m.includes('email address is invalid')) {
    return 'Revisa el correo, no parece válido.';
  }
  if (m.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';

  console.error('[cuenta] error sin traducir:', mensaje);
  return 'No se pudo completar. Inténtalo de nuevo.';
}

export function FormIngreso({ alEntrar }: { alEntrar: () => void }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await ingresar(correo, clave);
      alEntrar();
    } catch (err) {
      setError(traducir((err as Error).message));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Correo">
        <input
          type="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className={campoClase}
          placeholder="tu@correo.com"
          autoComplete="email"
        />
      </Campo>
      <Campo etiqueta="Contraseña">
        <input
          type="password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className={campoClase}
          autoComplete="current-password"
        />
      </Campo>

      {error && <p className="text-[13px] text-sugu">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="btn-primary w-full disabled:pointer-events-none disabled:opacity-50"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

export function FormRegistro({ alEntrar }: { alEntrar: () => void }) {
  const [d, setD] = useState({
    correo: '',
    clave: '',
    nombre: '',
    apellido: '',
    telefono: '',
    direccion: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const set = (k: keyof typeof d) => (e: { target: { value: string } }) =>
    setD({ ...d, [k]: e.target.value });

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const { confirmar: hayQueConfirmar } = await registrarse(d);
      if (hayQueConfirmar) setConfirmar(true);
      else alEntrar();
    } catch (err) {
      setError(traducir((err as Error).message));
    } finally {
      setEnviando(false);
    }
  };

  if (confirmar) {
    return (
      <div className="rounded-2xl border border-emerald-600/40 bg-emerald-600/10 p-6 text-sm leading-relaxed">
        <p className="font-bold text-emerald-400">Revisa tu correo</p>
        <p className="mt-2 text-bone-dim">
          Te enviamos un enlace a <b className="text-white">{d.correo}</b> para confirmar la
          cuenta. Ábrelo y vuelve aquí para iniciar sesión.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre">
        <input
          required
          value={d.nombre}
          onChange={set('nombre')}
          className={campoClase}
          autoComplete="given-name"
        />
      </Campo>
      <Campo etiqueta="Apellido">
        <input
          required
          value={d.apellido}
          onChange={set('apellido')}
          className={campoClase}
          autoComplete="family-name"
        />
      </Campo>
      <Campo etiqueta="Correo" ancho="completo">
        <input
          type="email"
          required
          value={d.correo}
          onChange={set('correo')}
          className={campoClase}
          placeholder="tu@correo.com"
          autoComplete="email"
        />
      </Campo>
      <Campo etiqueta="Teléfono">
        <input
          type="tel"
          required
          value={d.telefono}
          onChange={(e) => setD({ ...d, telefono: e.target.value.replace(/[^\d+\s-]/g, '') })}
          className={campoClase}
          placeholder="999 123 456"
          autoComplete="tel"
        />
      </Campo>
      <Campo etiqueta="Contraseña">
        <input
          type="password"
          required
          minLength={6}
          value={d.clave}
          onChange={set('clave')}
          className={campoClase}
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
        />
      </Campo>
      <Campo etiqueta="Dirección de entrega" ancho="completo">
        <input
          required
          value={d.direccion}
          onChange={set('direccion')}
          className={campoClase}
          placeholder="Calle, número, referencia, distrito"
          autoComplete="street-address"
        />
      </Campo>

      {error && <p className="text-[13px] text-sugu sm:col-span-2">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="btn-primary w-full disabled:pointer-events-none disabled:opacity-50 sm:col-span-2"
      >
        {enviando ? 'Creando cuenta…' : 'Crear mi cuenta'}
      </button>

      <p className="text-[12px] leading-relaxed text-bone-dim sm:col-span-2">
        Con tu cuenta acumulas puntos por cada compra confirmada y los canjeas por descuentos y
        productos.
      </p>
    </form>
  );
}
