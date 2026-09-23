'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChefHat, RefreshCw, WifiOff } from 'lucide-react';
import { getSupabase } from '@/lib/supabase/client';
import { describirLinea, hora, type Linea } from '@/lib/caja';

/** Cada cuántos milisegundos se vuelve a preguntar qué hay que cocinar. */
const CADA = 5000;

type PedidoCocina = {
  id: string;
  creado: string;
  cliente: string;
  vendedor: string;
  lineas: Linea[];
};

/**
 * Pantalla de cocina.
 *
 * Quien cocina no tiene cuenta del panel: entra con el enlace que genera la
 * caja, que lleva una clave larga. La función del servidor la valida y
 * devuelve SOLO lo que hace falta para preparar —hora, cliente y líneas—;
 * ni totales ni cobros, así que el enlace no sirve para espiar la caja.
 *
 * Se refresca preguntando cada pocos segundos en vez de por realtime: el
 * realtime de Supabase respeta RLS y aquí quien mira es anónimo, así que
 * haría falta abrirle la tabla. Preguntar cada cinco segundos da lo mismo
 * en una cocina y no obliga a aflojar los permisos.
 *
 * Es solo mirar. Cuando el cajero marca "Entregado", el pedido deja de
 * aparecer aquí en el siguiente refresco.
 */
function Cocina() {
  const clave = useSearchParams().get('k') ?? '';
  const [pedidos, setPedidos] = useState<PedidoCocina[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultima, setUltima] = useState<Date | null>(null);
  const [cargando, setCargando] = useState(false);

  const traer = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setError('No hay conexión con el servidor.');
      setPedidos([]);
      return;
    }
    setCargando(true);
    const { data, error: fallo } = await sb.rpc('cocina_pendientes', { p_clave: clave });
    setCargando(false);

    if (fallo) {
      setError(
        fallo.message.includes('CLAVE_INVALIDA')
          ? 'Este enlace ya no sirve. Pídele uno nuevo a quien está en la caja.'
          : 'No se pudo consultar. Se vuelve a intentar solo.',
      );
      return;
    }
    setError(null);
    setPedidos((data ?? []) as PedidoCocina[]);
    setUltima(new Date());
  }, [clave]);

  useEffect(() => {
    if (!clave) return;
    void traer();
    const t = setInterval(() => void traer(), CADA);
    return () => clearInterval(t);
  }, [clave, traer]);

  if (!clave) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-night p-6 text-center text-bone">
        <p className="text-sm text-bone-dim">
          Este enlace está incompleto. Pídele a quien está en la caja el enlace de cocina.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-night pb-10 text-bone">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-night/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-bone-dim">
              <ChefHat size={13} />
              Cocina
            </p>
            <p className="text-2xl font-bold leading-tight">
              {pedidos === null ? '—' : `${pedidos.length} por preparar`}
            </p>
          </div>
          <div className="text-right text-[11px] text-bone-dim">
            {cargando ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw size={12} className="animate-spin" />
                actualizando
              </span>
            ) : ultima ? (
              <span>al día {hora(ultima.toISOString())}</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4">
        {error && (
          <p className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <WifiOff size={16} />
            {error}
          </p>
        )}

        {pedidos === null ? (
          <p className="p-10 text-center text-sm text-bone-dim">Cargando…</p>
        ) : pedidos.length === 0 ? (
          /*
           * "Todo preparado" SOLO si de verdad se pudo preguntar. Si la
           * consulta falló, la lista vacía no significa que no haya nada que
           * cocinar, y decirlo pararía la cocina sin motivo: en ese caso
           * manda el aviso de arriba y aquí no se afirma nada.
           */
          !error && (
            <p className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-bone-dim">
              Todo preparado. Los pedidos nuevos aparecen aquí solos.
            </p>
          )
        ) : (
          /* del más antiguo al primero: ese es el orden en que hay que cocinar */
          <ol className="grid gap-3">
            {pedidos.map((p, i) => (
              <li
                key={p.id}
                className={`rounded-2xl border p-4 ${
                  i === 0 ? 'border-sugu/60 bg-sugu/10' : 'border-white/10 bg-night-soft'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] font-semibold text-bone-dim">
                    #{i + 1} · {hora(p.creado)}
                  </span>
                  <span className="truncate text-[12px] text-bone-dim">
                    {p.cliente}
                    {p.vendedor && ` · ${p.vendedor}`}
                  </span>
                </div>
                {p.lineas.map((l, j) => (
                  <p key={j} className="mt-1 text-xl font-bold leading-snug">
                    {describirLinea(l)}
                  </p>
                ))}
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

export default function CocinaPagina() {
  // useSearchParams obliga a un límite de Suspense para poder prerenderizar
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[100dvh] place-items-center bg-night">
          <p className="text-sm text-bone-dim">Abriendo cocina…</p>
        </main>
      }
    >
      <Cocina />
    </Suspense>
  );
}
