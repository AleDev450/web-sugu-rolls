'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Check, ChefHat, HandPlatter, RefreshCw, Undo2, WifiOff } from 'lucide-react';
import { getSupabase } from '@/lib/supabase/client';
import { describirLinea, espera, formatearNumero, hora, type Linea } from '@/lib/caja';

/** Cada cuántos milisegundos se vuelve a preguntar qué hay que cocinar. */
const CADA = 5000;

type Resumen = { rolls: number; onigiris: number; pokebowls: number; pedidos: number };

type PedidoCocina = {
  id: string;
  numero: number;
  creado: string;
  cliente: string;
  vendedor: string;
  nota: string;
  lineas: Linea[];
  /** si ya se cobró; la cocina no ve montos, solo si falta pagar */
  pagado?: boolean;
  /** '' por preparar, 'listo' terminado (desde la 044) */
  cocina_estado?: '' | 'listo' | 'entregado';
  cocina_en?: string | null;
};

/**
 * Pantalla de cocina.
 *
 * Quien cocina no tiene cuenta del panel: entra con el enlace que genera la
 * caja, que lleva una clave larga y el nombre del cajero. La función del
 * servidor valida la clave y devuelve SOLO lo que hace falta para preparar
 * —número, hora, cliente y líneas—; ni totales ni cobros, así que el enlace
 * no sirve para espiar la caja.
 *
 * Cada cajero tiene la SUYA: la pantalla lista únicamente los pedidos de
 * quien viene en el enlace. Una cocina compartida mezclaría las colas de
 * dos puestos y quien cocina no sabría a cuál entregar.
 *
 * Se refresca preguntando cada pocos segundos en vez de por realtime: el
 * realtime de Supabase respeta RLS y aquí quien mira es anónimo, así que
 * haría falta abrirle la tabla. Preguntar cada cinco segundos da lo mismo
 * en una cocina y no obliga a aflojar los permisos.
 *
 * La cocina marca su parte (migración 044), porque el cajero no siempre
 * está: sale a comprar y deja pedidos apuntados, o el cliente tarda en
 * recoger lo que ya está hecho.
 *
 *   · LISTO: terminado. Sale de la cola de preparación y queda abajo, en
 *     "Listos para recoger", hasta que alguien lo entregue. La caja lo ve
 *     como "Listo en cocina".
 *   · ENTREGADO AL CLIENTE: la cocina se lo dio directo. Desaparece de aquí
 *     y la caja lo pasa a entregado sola.
 *
 * Si el pedido NO está pagado se pinta en ámbar y entregarlo pide
 * confirmar: la cocina no cobra, pero no debería soltar un plato sin que
 * alguien lo haya cobrado.
 */
function Cocina() {
  const parametros = useSearchParams();
  const clave = parametros.get('k') ?? '';
  const vendedor = parametros.get('v') ?? '';
  const [pedidos, setPedidos] = useState<PedidoCocina[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [ultima, setUltima] = useState<Date | null>(null);
  const [cargando, setCargando] = useState(false);
  /** pedido sin pagar al que ya se le tocó "entregar" una vez: el segundo toque confirma */
  const [porConfirmar, setPorConfirmar] = useState<string | null>(null);

  const traer = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setError('No hay conexión con el servidor.');
      setPedidos([]);
      return;
    }
    setCargando(true);
    const { data, error: fallo } = await sb.rpc('cocina_pendientes', {
      p_clave: clave,
      p_vendedor: vendedor,
    });
    setCargando(false);

    if (fallo) {
      setError(
        fallo.message.includes('CLAVE_INVALIDA') || fallo.message.includes('VENDEDOR_REQUERIDO')
          ? 'Este enlace ya no sirve. Pídele uno nuevo a quien está en la caja.'
          : 'No se pudo consultar. Se vuelve a intentar solo.',
      );
      return;
    }
    setError(null);
    /*
     * La función devuelve del más antiguo al más nuevo —así su `limit` se
     * queda con los que más esperan, que son los que no pueden perderse— y
     * aquí se da la vuelta para mostrar el último pedido arriba, que es
     * como se quiere mirar desde la cocina.
     */
    const llegaron = (data ?? []) as PedidoCocina[];
    setPedidos([...llegaron].sort((a, b) => b.creado.localeCompare(a.creado)));
    setUltima(new Date());

    /*
     * El acumulado del turno va aparte: la cola solo trae lo pendiente, así
     * que sola no puede decir cuánto lleva preparado. Si esta segunda
     * consulta falla no se toca nada más —la cola manda—, simplemente no se
     * actualiza el contador.
     */
    const { data: totales } = await sb.rpc('cocina_resumen', {
      p_clave: clave,
      p_vendedor: vendedor,
    });
    const fila = (totales as Resumen[] | null)?.[0];
    // desde la 042 los rolls traen decimales: el de 5 piezas es medio roll
    if (fila) setResumen({ ...fila, rolls: Number(fila.rolls) });
  }, [clave, vendedor]);

  /**
   * Marca el estado de un pedido. Se aplica en pantalla antes de que conteste
   * el servidor —la cocina no puede quedarse esperando con las manos
   * ocupadas— y se vuelve a preguntar después para quedar al día.
   */
  const marcar = useCallback(
    async (id: string, estado: '' | 'listo' | 'entregado') => {
      const sb = getSupabase();
      if (!sb) return;
      setPorConfirmar(null);
      setPedidos((previos) =>
        (previos ?? [])
          .map((p) => (p.id === id ? { ...p, cocina_estado: estado, cocina_en: new Date().toISOString() } : p))
          .filter((p) => p.cocina_estado !== 'entregado'),
      );
      const { error: fallo } = await sb.rpc('cocina_marcar', {
        p_clave: clave,
        p_vendedor: vendedor,
        p_id: id,
        p_estado: estado,
      });
      if (fallo) {
        setError(
          fallo.message.includes('cocina_marcar')
            ? 'Todavía no se puede marcar desde la cocina: falta correr la migración 044.'
            : fallo.message.includes('PEDIDO_NO_ENCONTRADO')
              ? 'Ese pedido ya no está en la caja abierta.'
              : 'No se pudo marcar. Revisa la conexión e inténtalo otra vez.',
        );
      }
      void traer();
    },
    [clave, vendedor, traer],
  );

  // el "¿seguro?" de un pedido sin pagar se olvida solo si no se confirma
  useEffect(() => {
    if (!porConfirmar) return;
    const t = setTimeout(() => setPorConfirmar(null), 4000);
    return () => clearTimeout(t);
  }, [porConfirmar]);

  useEffect(() => {
    // las dos, igual que abajo: un enlace incompleto no debe ni preguntar
    if (!clave || !vendedor) return;
    void traer();
    const t = setInterval(() => void traer(), CADA);
    return () => clearInterval(t);
  }, [clave, vendedor, traer]);

  // reloj de un segundo: la espera de cada pedido corre a la vista
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /*
   * Hacen falta las dos cosas. Un enlace con clave pero sin cajero es uno
   * de los antiguos, de cuando la cocina mostraba la cola de todos: si se
   * dejara pasar, se vería una pantalla normal con pedidos de más y nadie
   * lo notaría. Mejor decirlo.
   */
  if (!clave || !vendedor) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-night p-6 text-center text-bone">
        <div className="max-w-xs">
          <p className="font-semibold">Este enlace ya no sirve.</p>
          <p className="mt-1.5 text-sm text-bone-dim">
            Cada caja tiene su propia cocina. Pídele a quien te va a pasar los pedidos que copie
            el enlace desde su caja, con el botón «Cocina».
          </p>
        </div>
      </main>
    );
  }

  const porPreparar = (pedidos ?? []).filter((p) => !p.cocina_estado);
  // los listos, del que más espera al más nuevo: el de arriba es al que hay que llamar
  const listos = (pedidos ?? [])
    .filter((p) => p.cocina_estado === 'listo')
    .sort((a, b) => (a.cocina_en ?? '').localeCompare(b.cocina_en ?? ''));

  /** Entregar al cliente; si no está pagado, el primer toque solo pregunta. */
  const entregar = (p: PedidoCocina) => {
    if (p.pagado === false && porConfirmar !== p.id) {
      setPorConfirmar(p.id);
      return;
    }
    void marcar(p.id, 'entregado');
  };

  return (
    <main className="min-h-[100dvh] bg-night pb-10 text-bone">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-night/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-bone-dim">
              <ChefHat size={13} />
              Cocina{vendedor && ` · ${vendedor}`}
            </p>
            <p className="text-2xl font-bold leading-tight">
              {pedidos === null ? '—' : `${porPreparar.length} por preparar`}
            </p>
            {listos.length > 0 && (
              <p className="text-[13px] font-semibold text-emerald-400">
                {listos.length} {listos.length === 1 ? 'listo' : 'listos'} para recoger
              </p>
            )}
            {resumen && (
              <>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-bone-dim">
                  Llevas preparando
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  <span className="rounded-full bg-white/10 px-2 py-0.5">
                    Rolls: {resumen.rolls}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5">
                    Onigiris: {resumen.onigiris}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5">
                    Poke bowls: {resumen.pokebowls}
                  </span>
                </p>
              </>
            )}
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
        ) : porPreparar.length === 0 && listos.length === 0 ? (
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
          <>
          {porPreparar.length === 0 && (
            <p className="mb-4 rounded-3xl border border-dashed border-white/15 p-8 text-center text-bone-dim">
              Nada por preparar.
            </p>
          )}
          {/* el último pedido arriba; el de más abajo es el que más espera */}
          <ol className="grid gap-3">
            {porPreparar.map((p, i) => (
              <li
                key={p.id}
                className={`rounded-2xl border p-4 ${
                  p.pagado === false
                    ? 'border-amber-500/70 bg-amber-500/10'
                    : i === 0
                      ? 'border-sugu/60 bg-sugu/10'
                      : 'border-white/10 bg-night-soft'
                }`}
              >
                {p.pagado === false && <FaltaPagar />}
                <div className="flex items-start justify-between gap-3">
                  {/* número y quién lo pidió: es lo que se canta al entregar */}
                  <span className="min-w-0 truncate text-base font-bold">
                    <span className="text-sugu-glow">#{formatearNumero(p.numero)}</span>{' '}
                    {p.cliente}
                  </span>
                  {/*
                    La espera es el dato que decide a qué pedido saltar, así
                    que se lee de lejos; la hora exacta queda debajo, en
                    pequeño, para cuando hace falta ubicarlo.
                  */}
                  <span className="shrink-0 text-right leading-tight">
                    <span className="block text-xl font-bold tabular-nums text-bone">
                      {espera(p.creado, ahora)}
                    </span>
                    <span className="block text-[11px] text-bone-dim">{hora(p.creado)}</span>
                  </span>
                </div>
                {p.lineas.map((l, j) => (
                  <p key={j} className="mt-1 text-xl font-bold leading-snug">
                    {describirLinea(l)}
                  </p>
                ))}
                {/* lo que pidió aparte: destacado, es lo que se olvida */}
                {(p.nota ?? '').trim() && (
                  <p className="mt-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-base font-bold text-amber-300">
                    {p.nota}
                  </p>
                )}
                {p.vendedor && (
                  <p className="mt-1.5 text-[11px] text-bone-dim">Lo tomó {p.vendedor}</p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void marcar(p.id, 'listo')}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-bold text-white active:scale-[0.99]"
                  >
                    <Check size={18} />
                    Listo
                  </button>
                  <BotonEntregar
                    confirmando={porConfirmar === p.id}
                    onClick={() => entregar(p)}
                  />
                </div>
              </li>
            ))}
          </ol>

          {/*
            Lo terminado que nadie ha recogido. Ya no estorba la cola, pero
            sigue a la vista para llamar al cliente por su número.
          */}
          {listos.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Listos para recoger
              </h2>
              <ul className="grid gap-2">
                {listos.map((p) => (
                  <li
                    key={p.id}
                    className={`rounded-2xl border p-3 ${
                      p.pagado === false
                        ? 'border-amber-500/70 bg-amber-500/10'
                        : 'border-emerald-500/40 bg-emerald-500/5'
                    }`}
                  >
                    {p.pagado === false && <FaltaPagar />}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">
                          <span className="text-sugu-glow">#{formatearNumero(p.numero)}</span>{' '}
                          {p.cliente}
                        </p>
                        <p className="truncate text-[13px] text-bone-dim">
                          {p.lineas.map((l) => describirLinea(l)).join(' · ')}
                        </p>
                      </div>
                      {p.cocina_en && (
                        <span className="shrink-0 text-right text-[12px] leading-tight text-bone-dim">
                          listo hace
                          <span className="block text-base font-bold tabular-nums text-bone">
                            {espera(p.cocina_en, ahora)}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <BotonEntregar
                        confirmando={porConfirmar === p.id}
                        onClick={() => entregar(p)}
                      />
                      <button
                        type="button"
                        onClick={() => void marcar(p.id, '')}
                        className="flex min-h-[48px] items-center gap-1.5 rounded-xl border border-white/15 px-3 text-[13px] font-semibold text-bone-dim"
                        aria-label={`Volver a poner el pedido ${formatearNumero(p.numero)} por preparar`}
                      >
                        <Undo2 size={15} />
                        Deshacer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </>
        )}
      </div>
    </main>
  );
}

/** La franja que avisa que el pedido no está cobrado. Sin montos: solo el aviso. */
function FaltaPagar() {
  return (
    <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide text-night">
      <AlertTriangle size={14} />
      Falta pagar · cobrar antes de entregar
    </p>
  );
}

function BotonEntregar({ confirmando, onClick }: { confirmando: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-[14px] font-bold active:scale-[0.99] ${
        confirmando
          ? 'border-amber-500 bg-amber-500 text-night'
          : 'border-sky-500/50 bg-sky-500/15 text-sky-300'
      }`}
    >
      <HandPlatter size={17} />
      {confirmando ? '¿Ya pagó? Tocar para entregar' : 'Entregado al cliente'}
    </button>
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
