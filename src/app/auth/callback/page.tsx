'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Vuelta de Google.
 *
 * Google manda aquí con un `code` de un solo uso. El cliente de Supabase lo
 * canjea por la sesión él solo (`detectSessionInUrl`), así que esta página no
 * hace la petición: espera a que la sesión exista y sigue camino.
 *
 * Se lee `window.location` en vez de `useSearchParams` a posta: ese hook
 * obliga a envolver la página en un `<Suspense>` para poder generarla
 * estáticamente, y aquí no aporta nada.
 */
export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cliente = getSupabase();
    if (!cliente) {
      setError('El acceso no está configurado en este momento.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const destino = seguro(params.get('destino'));

    // Google puede volver con un rechazo en vez de con un código
    const fallo = params.get('error_description') ?? params.get('error');
    if (fallo) {
      setError(traducir(fallo));
      return;
    }

    let listo = false;
    const seguir = () => {
      if (listo) return;
      listo = true;
      router.replace(destino);
    };

    const { data: sub } = cliente.auth.onAuthStateChange((_evento, sesion) => {
      if (sesion) seguir();
    });

    // por si la sesión ya estaba lista antes de que nos suscribiéramos
    void cliente.auth.getSession().then(({ data }) => {
      if (data.session) seguir();
    });

    const limite = setTimeout(() => {
      if (!listo) {
        setError('Tardó demasiado en responder. Vuelve a intentarlo.');
      }
    }, 15_000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(limite);
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-night p-6 text-center">
      {error ? (
        <div className="max-w-md">
          <h1 className="text-xl font-bold">No se pudo entrar</h1>
          <p className="mt-3 text-sm leading-relaxed text-bone-dim">{error}</p>
          <Link href="/cuenta" className="btn-primary mt-8">
            Volver a intentarlo
          </Link>
        </div>
      ) : (
        <p className="text-sm text-bone-dim">Conectando con Google…</p>
      )}
    </main>
  );
}

/**
 * Solo se admite volver a una ruta de esta misma web.
 *
 * `destino` viaja en la URL y cualquiera puede cambiarlo. Sin este filtro se
 * podría mandar a alguien a `/auth/callback?destino=https://otra-web` y usar
 * el dominio de Sugu Rolls como trampolín para un engaño.
 */
function seguro(destino: string | null): string {
  if (!destino || !destino.startsWith('/') || destino.startsWith('//')) return '/cuenta';
  return destino;
}

function traducir(fallo: string): string {
  const f = fallo.toLowerCase();
  if (f.includes('access_denied') || f.includes('denied')) {
    return 'Cancelaste el acceso con Google. Puedes intentarlo otra vez o entrar con tu correo.';
  }
  if (f.includes('provider is not enabled') || f.includes('unsupported provider')) {
    return 'El acceso con Google todavía no está activado en el servidor.';
  }
  console.error('[auth/callback]', fallo);
  return 'Google rechazó el acceso. Inténtalo de nuevo o entra con tu correo y contraseña.';
}
