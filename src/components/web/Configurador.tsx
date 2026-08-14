'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Minus, Plus, X } from 'lucide-react';
import { soles, type OpcionesConPrecio, type Producto } from '@/data/productos';

/**
 * Armado de un producto configurable (poke bowl, etc.).
 *
 * Cada grupo tiene su regla: `min: 1, max: 1` es elegir uno —se pinta como
 * radio—, y `max > 1` permite marcar varios hasta ese tope —se pinta como
 * checkbox—. Los grupos con `min: 0` son opcionales.
 *
 * El botón de confirmar solo se habilita cuando TODOS los grupos obligatorios
 * están cubiertos, y cada grupo dice qué le falta. La base valida lo mismo por
 * su cuenta, pero enterarse al pulsar "pedir" sería descubrirlo tardísimo.
 *
 * Algunas opciones suman un extra sobre el precio base (`precio > 0`): el
 * total del pie se actualiza al marcarlas, para que el precio que ve el
 * cliente aquí sea el mismo que termina cobrándose.
 *
 * Se monta con un PORTAL a `document.body` a propósito: si se renderiza
 * dentro de la tarjeta del producto, queda anidado bajo el `motion.div` de
 * `Aparecer` (la animación de aparición al hacer scroll), que deja un
 * `transform` puesto incluso después de terminar. Un ancestro con `transform`
 * crea su propio "viewport" para `position: fixed`, así que el modal quedaba
 * atrapado y recortado dentro del tamaño de la tarjeta en vez de cubrir la
 * pantalla completa. Montado en el body no depende de dónde esté la tarjeta.
 */
export function Configurador({
  producto,
  precio,
  piezas,
  abierto,
  alCerrar,
  alConfirmar,
}: {
  producto: Producto;
  /** precio base, sin extras */
  precio: number;
  piezas?: number;
  abierto: boolean;
  alCerrar: () => void;
  /** `precioUnitario` ya incluye los extras marcados; `cantidad` es la del stepper */
  alConfirmar: (elegidas: OpcionesConPrecio, precioUnitario: number, cantidad: number) => void;
}) {
  const grupos = producto.opciones ?? [];
  // se marca por nombre; el precio de cada opción se busca en `grupos` al confirmar
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const [cantidad, setCantidad] = useState(1);

  // cada vez que se abre se empieza de cero: es un bowl nuevo
  useEffect(() => {
    if (abierto) {
      setElegidas({});
      setCantidad(1);
    }
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', alTecla);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTecla);
      document.body.style.overflow = '';
    };
  }, [abierto, alCerrar]);

  const marcar = (titulo: string, opcion: string, max: number) =>
    setElegidas((prev) => {
      const actuales = prev[titulo] ?? [];
      const yaEsta = actuales.includes(opcion);

      // grupo de una sola opción: elegir reemplaza en vez de acumular
      if (max === 1) return { ...prev, [titulo]: yaEsta ? [] : [opcion] };

      if (yaEsta) return { ...prev, [titulo]: actuales.filter((o) => o !== opcion) };
      if (actuales.length >= max) return prev; // tope alcanzado
      return { ...prev, [titulo]: [...actuales, opcion] };
    });

  const faltan = grupos.filter((g) => (elegidas[g.titulo]?.length ?? 0) < g.min);
  const completo = faltan.length === 0;

  // suma de los extras marcados; el precio de cada uno sale del catálogo del grupo
  const extras = grupos.reduce(
    (total, g) =>
      total +
      (elegidas[g.titulo] ?? []).reduce(
        (t, nombre) => t + (g.opciones.find((o) => o.nombre === nombre)?.precio ?? 0),
        0
      ),
    0
  );
  const precioUnitario = precio + extras;
  const precioFinal = precioUnitario * cantidad;

  const confirmar = () => {
    const conPrecio: OpcionesConPrecio = {};
    for (const g of grupos) {
      const nombres = elegidas[g.titulo] ?? [];
      if (nombres.length === 0) continue;
      conPrecio[g.titulo] = nombres.map((nombre) => ({
        nombre,
        precio: g.opciones.find((o) => o.nombre === nombre)?.precio ?? 0,
      }));
    }
    alConfirmar(conPrecio, precioUnitario, cantidad);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={alCerrar}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Arma tu ${producto.nombre}`}
            /*
             * max-h en dvh, no vh: en móvil, 100vh se mide contra el viewport
             * MÁS GRANDE posible (con la barra de direcciones oculta). Con la
             * barra visible —que es como se abre este modal casi siempre— el
             * alto real es menor, y el pie con el botón de confirmar quedaba
             * fuera de pantalla sin forma de hacer scroll para llegar a él.
             * dvh sí sigue el viewport visible. El padding del pie deja
             * espacio para la barra de gestos del iPhone (safe-area-inset).
             */
            className="fixed inset-x-0 bottom-0 z-[71] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-night-2 sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:max-w-lg sm:rounded-3xl"
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="relative">
                <div className="relative aspect-[16/9] w-full flex-none bg-night-3 sm:aspect-[21/9]">
                  <Image
                    src={producto.imagen}
                    alt={producto.nombre}
                    fill
                    sizes="(max-width: 640px) 100vw, 512px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-night-2 via-night-2/10 to-transparent" />
                </div>
                <button
                  onClick={alCerrar}
                  className="absolute right-4 top-4 flex-none rounded-full border border-white/20 bg-night-2/80 p-2 backdrop-blur-sm transition-colors hover:border-white/40"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6">
                <h2 className="text-xl font-bold tracking-tight">{producto.nombre}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-bone-dim">
                  {piezas ? `${piezas} piezas · ` : ''}
                  {producto.descripcion}
                </p>

                <div className="mt-6 space-y-6">
                  {grupos.map((g) => {
                    const marcadas = elegidas[g.titulo] ?? [];
                    const lleno = marcadas.length >= g.max;
                    const esUnica = g.max === 1;

                    return (
                      <section key={g.titulo}>
                        <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold">{g.titulo}</h3>
                            {g.min > 0 ? (
                              <span className="rounded-full bg-sugu/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sugu">
                                Obligatorio
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bone-dim">
                                Opcional
                              </span>
                            )}
                          </div>
                          <span className="text-[12px] text-bone-dim">
                            {esUnica ? 'Elige 1' : `Hasta ${g.max}`} ·{' '}
                            <span className={marcadas.length > 0 ? 'text-white' : ''}>
                              {marcadas.length}/{g.max}
                            </span>
                          </span>
                        </header>

                        <div className="overflow-hidden rounded-xl border border-white/10">
                          {g.opciones.map((o, idx) => {
                            const activa = marcadas.includes(o.nombre);
                            const bloqueada = !activa && lleno;
                            return (
                              <button
                                key={o.nombre}
                                type="button"
                                onClick={() => marcar(g.titulo, o.nombre, g.max)}
                                disabled={bloqueada}
                                aria-pressed={activa}
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors ${
                                  idx > 0 ? 'border-t border-white/10' : ''
                                } ${
                                  bloqueada
                                    ? 'cursor-not-allowed text-white/25'
                                    : activa
                                      ? 'bg-sugu/10 text-white'
                                      : 'text-bone-dim hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                {/* radio para "elige 1", checkbox para "elige varios" */}
                                <span
                                  className={`flex h-5 w-5 flex-none items-center justify-center border-2 transition-colors ${
                                    esUnica ? 'rounded-full' : 'rounded-md'
                                  } ${
                                    activa
                                      ? 'border-sugu bg-sugu'
                                      : bloqueada
                                        ? 'border-white/10'
                                        : 'border-white/25'
                                  }`}
                                >
                                  {activa && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                </span>
                                <span className="flex-1">{o.nombre}</span>
                                {o.precio > 0 && (
                                  <span className={activa ? 'text-sugu-glow' : 'text-sugu'}>
                                    +{soles(o.precio)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>

            <footer className="flex-none border-t border-white/10 bg-night-2 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {!completo && (
                <p className="mb-3 text-[13px] text-sugu">
                  Te falta elegir en: {faltan.map((g) => g.titulo).join(', ')}
                </p>
              )}
              <div className="flex items-center gap-3">
                <div className="flex flex-none items-center gap-1 rounded-full border border-white/15">
                  <button
                    type="button"
                    onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                    disabled={cantidad <= 1}
                    className="p-2.5 transition-colors hover:text-sugu disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Quitar una unidad"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-bold tabular-nums">
                    {cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCantidad((c) => Math.min(20, c + 1))}
                    disabled={cantidad >= 20}
                    className="p-2.5 transition-colors hover:text-sugu disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Agregar una unidad"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={confirmar}
                  disabled={!completo}
                  className="btn-primary flex-1 disabled:pointer-events-none disabled:opacity-40"
                >
                  Agregar · {soles(precioFinal)}
                </button>
              </div>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
