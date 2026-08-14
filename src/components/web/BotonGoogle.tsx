'use client';

import { useState } from 'react';
import { entrarConGoogle } from '@/lib/tienda';

/**
 * Logotipo de Google.
 *
 * Va en línea, como SVG, y no como imagen descargada de un CDN: las normas de
 * marca de Google piden que la "G" salga con sus cuatro colores exactos, y así
 * además el botón no depende de una petición externa para pintarse.
 */
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
 * Entrar o registrarse con Google.
 *
 * Es el mismo botón para las dos cosas a propósito: Google no distingue entre
 * "alta" e "inicio de sesión", y obligar al cliente a elegir antes de tiempo
 * solo genera el error de "ya tienes cuenta" en la mitad de los casos.
 *
 * Tras pulsarlo la página se va a Google, así que el estado de carga no se
 * apaga: si vuelve, es que algo falló.
 */
export function BotonGoogle({
  destino = '/cuenta',
  texto = 'Continuar con Google',
}: {
  destino?: string;
  texto?: string;
}) {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pulsar = async () => {
    setYendo(true);
    setError(null);
    try {
      await entrarConGoogle(destino);
    } catch (e) {
      console.error('[google]', e);
      setError(
        'No se pudo abrir el acceso con Google. Revisa tu conexión o entra con tu correo.'
      );
      setYendo(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void pulsar()}
        disabled={yendo}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white px-4 py-3 text-[14px] font-semibold text-[#1F1F1F] transition-colors hover:bg-white/90 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sugu"
      >
        <LogoGoogle />
        {yendo ? 'Abriendo Google…' : texto}
      </button>
      {error && <p className="mt-2 text-[13px] text-sugu">{error}</p>}
    </div>
  );
}

/** Botón de Google con el separador "o" que lo despega del formulario. */
export function AccesoGoogle({ destino = '/cuenta' }: { destino?: string }) {
  return (
    <>
      <BotonGoogle destino={destino} />
      <div className="my-6 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] uppercase tracking-widest text-white/35">o</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </>
  );
}
