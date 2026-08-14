'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { entrarConGoogle, entrarConTokenGoogle } from '@/lib/tienda';

/* ------------------------------------------------------------------ */
/* Tipos mínimos de Google Identity Services                           */
/* ------------------------------------------------------------------ */

interface RespuestaGoogle {
  credential: string;
}

interface ApiGoogleId {
  initialize(config: {
    client_id: string;
    nonce?: string;
    itp_support?: boolean;
    callback: (r: RespuestaGoogle) => void;
  }): void;
  renderButton(
    padre: HTMLElement,
    opciones: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      logo_alignment?: 'left' | 'center';
      width?: number;
      locale?: string;
    }
  ): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: ApiGoogleId } };
  }
}

/**
 * Nonce de un solo uso.
 *
 * A Google se le da el HASH y a Supabase el original: Google mete el hash
 * dentro del token firmado y Supabase comprueba que corresponde al que le
 * pasamos. Sin esto, un token robado en otra web valdría aquí.
 */
async function generarNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...bytes));

  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { nonce, hashHex };
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** El botón de Google no admite ancho fluido: acepta píxeles, de 200 a 400. */
function anchoBoton(contenedor: HTMLElement | null): number {
  const ancho = contenedor?.getBoundingClientRect().width ?? 320;
  return Math.round(Math.min(400, Math.max(200, ancho)));
}

/**
 * Acceso con Google.
 *
 * Usa Google Identity Services: el cliente NO sale de la web, Google devuelve
 * un token firmado en la misma página y Supabase lo canjea por sesión. Es más
 * rápido que el redirect y, si ya tiene sesión de Google en el navegador,
 * entra de un toque.
 *
 * PERO se guarda el redirect como respaldo, y no por gusto: GIS no funciona
 * dentro de los navegadores incrustados de Instagram y Facebook, y buena
 * parte del tráfico de un restaurante llega justo por ahí. Si el script no
 * carga —bloqueado, sin conexión, sin CLIENT_ID configurado— aparece el botón
 * de siempre, que sí abre el navegador del sistema.
 *
 * Sirve para entrar Y para registrarse: Google no distingue entre las dos
 * cosas, y si el correo ya tiene cuenta, Supabase enlaza en vez de duplicar.
 */
export function BotonGoogle({
  destino = '/cuenta',
  alEntrar,
}: {
  destino?: string;
  /** Si se pasa, se recarga en el sitio en vez de navegar. */
  alEntrar?: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const iniciado = useRef(false);
  const router = useRouter();

  const [listo, setListo] = useState(false);
  /** Sin GIS utilizable se cae al redirect, que funciona en todas partes. */
  const [respaldo, setRespaldo] = useState(!CLIENT_ID);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iniciar = useCallback(async () => {
    if (iniciado.current || !CLIENT_ID) return;
    if (!window.google?.accounts?.id || !caja.current) return;
    iniciado.current = true;

    try {
      const { nonce, hashHex } = await generarNonce();

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        nonce: hashHex,
        // Safari bloquea cookies de terceros; sin esto el botón no responde
        itp_support: true,
        callback: (respuesta) => {
          void (async () => {
            setEntrando(true);
            setError(null);
            try {
              await entrarConTokenGoogle(respuesta.credential, nonce);
              if (alEntrar) alEntrar();
              else router.replace(destino);
              router.refresh();
            } catch (e) {
              console.error('[google]', e);
              setError('Google respondió, pero no se pudo abrir la sesión. Inténtalo de nuevo.');
              setEntrando(false);
            }
          })();
        },
      });

      window.google.accounts.id.renderButton(caja.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        locale: 'es',
        width: anchoBoton(caja.current),
      });

      setListo(true);
    } catch (e) {
      console.error('[google] no se pudo iniciar GIS:', e);
      setRespaldo(true);
    }
  }, [alEntrar, destino, router]);

  /*
   * El botón se dibuja con un ancho en píxeles fijo, así que al girar el
   * teléfono se queda del tamaño anterior. Se vuelve a pintar con el nuevo.
   */
  useEffect(() => {
    if (!listo) return;
    let t: ReturnType<typeof setTimeout>;
    const alRedimensionar = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!caja.current || !window.google) return;
        caja.current.innerHTML = '';
        window.google.accounts.id.renderButton(caja.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          locale: 'es',
          width: anchoBoton(caja.current),
        });
      }, 250);
    };
    window.addEventListener('resize', alRedimensionar);
    return () => {
      window.removeEventListener('resize', alRedimensionar);
      clearTimeout(t);
    };
  }, [listo]);

  /*
   * Si en unos segundos GIS no ha pintado nada, se asume bloqueado. Pasa en
   * los navegadores de Instagram y Facebook, y ahí lo peor sería dejar al
   * cliente mirando un hueco vacío sin manera de entrar.
   */
  useEffect(() => {
    if (respaldo || !CLIENT_ID) return;
    const t = setTimeout(() => {
      if (!iniciado.current) setRespaldo(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [respaldo]);

  if (respaldo) return <BotonGoogleRedirect destino={destino} error={error} />;

  return (
    <div>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        // `onReady` y no `onLoad`: al volver a esta página sin recargar, el
        // script ya está puesto y `onLoad` no se dispara otra vez
        onReady={() => void iniciar()}
        onError={() => setRespaldo(true)}
      />

      {/* Google pinta aquí dentro su propio botón; no se le puede dar estilo */}
      <div ref={caja} className="flex min-h-[44px] justify-center [color-scheme:light]" />

      {!listo && <p className="text-center text-[13px] text-bone-dim">Cargando Google…</p>}
      {entrando && (
        <p className="mt-2 text-center text-[13px] text-bone-dim">Entrando con Google…</p>
      )}
      {error && <p className="mt-2 text-center text-[13px] text-sugu">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Respaldo: el flujo de siempre, con redirección                      */
/* ------------------------------------------------------------------ */

/** Logotipo de Google en línea: sus cuatro colores exactos, sin CDN. */
function LogoGoogle({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/**
 * Camino clásico: se sale a Google y se vuelve por /auth/callback.
 *
 * Es el que funciona en los navegadores incrustados de las redes sociales,
 * donde Google Identity Services no arranca.
 */
function BotonGoogleRedirect({ destino, error }: { destino: string; error: string | null }) {
  const [yendo, setYendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(error);

  const pulsar = async () => {
    setYendo(true);
    setFallo(null);
    try {
      await entrarConGoogle(destino);
    } catch (e) {
      console.error('[google]', e);
      setFallo('No se pudo abrir el acceso con Google. Entra con tu correo.');
      setYendo(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void pulsar()}
        disabled={yendo}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white px-4 py-3 text-[14px] font-semibold text-[#1F1F1F] transition-colors hover:bg-white/90 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sugu"
      >
        <LogoGoogle />
        {yendo ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>
      {fallo && <p className="mt-2 text-[13px] text-sugu">{fallo}</p>}
    </div>
  );
}

/** Botón de Google con el separador "o" que lo despega del formulario. */
export function AccesoGoogle({
  destino = '/cuenta',
  alEntrar,
}: {
  destino?: string;
  alEntrar?: () => void;
}) {
  return (
    <>
      <BotonGoogle destino={destino} alEntrar={alEntrar} />
      <div className="my-6 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] uppercase tracking-widest text-white/35">o</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </>
  );
}
