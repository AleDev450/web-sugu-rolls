'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { soles, type OpcionesElegidas, type Producto } from '@/data/productos';

/**
 * Armado de un producto configurable (poke bowl, etc.).
 *
 * Cada grupo tiene su regla: `min: 1, max: 1` es elegir uno —se comporta como
 * radio—, y `max > 1` permite marcar varios hasta ese tope. Los grupos con
 * `min: 0` son opcionales.
 *
 * El botón de confirmar solo se habilita cuando TODOS los grupos obligatorios
 * están cubiertos, y cada grupo dice qué le falta. La base valida lo mismo por
 * su cuenta, pero enterarse al pulsar "pedir" sería descubrirlo tardísimo.
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
  precio: number;
  piezas?: number;
  abierto: boolean;
  alCerrar: () => void;
  alConfirmar: (elegidas: OpcionesElegidas) => void;
}) {
  const grupos = producto.opciones ?? [];
  const [elegidas, setElegidas] = useState<OpcionesElegidas>({});

  // cada vez que se abre se empieza de cero: es un bowl nuevo
  useEffect(() => {
    if (abierto) setElegidas({});
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

  return (
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
            className="fixed inset-x-0 bottom-0 z-[71] flex max-h-[92vh] flex-col rounded-t-3xl border border-white/10 bg-night-2 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-2xl sm:rounded-3xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight">{producto.nombre}</h2>
                <p className="mt-1 text-[13px] text-bone-dim">
                  {piezas ? `${piezas} piezas · ` : ''}
                  <span className="font-bold text-sugu">{soles(precio)}</span>
                </p>
              </div>
              <button
                onClick={alCerrar}
                className="flex-none rounded-full border border-white/15 p-2 transition-colors hover:border-white/40"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6">
              {grupos.map((g) => {
                const marcadas = elegidas[g.titulo] ?? [];
                const lleno = marcadas.length >= g.max;

                return (
                  <section key={g.titulo}>
                    <header className="mb-3">
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
                      <p className="mt-1 text-[12.5px] text-bone-dim">
                        {g.max === 1
                          ? 'Selecciona 1 opción.'
                          : `Puedes elegir hasta ${g.max} opciones.`}{' '}
                        <span className={marcadas.length > 0 ? 'text-white' : ''}>
                          {marcadas.length}/{g.max}
                        </span>
                      </p>
                    </header>

                    <div className="flex flex-wrap gap-2">
                      {g.opciones.map((o) => {
                        const activa = marcadas.includes(o);
                        // sin marcar y con el grupo lleno: no se puede añadir más
                        const bloqueada = !activa && lleno;
                        return (
                          <button
                            key={o}
                            onClick={() => marcar(g.titulo, o, g.max)}
                            disabled={bloqueada}
                            aria-pressed={activa}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] transition-colors ${
                              activa
                                ? 'border-sugu bg-sugu text-white'
                                : bloqueada
                                  ? 'cursor-not-allowed border-white/5 text-white/25'
                                  : 'border-white/15 text-bone-dim hover:border-white/40 hover:text-white'
                            }`}
                          >
                            {activa && <Check className="h-3.5 w-3.5" />}
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <footer className="border-t border-white/10 p-6">
              {!completo && (
                <p className="mb-3 text-[13px] text-sugu">
                  Te falta elegir en: {faltan.map((g) => g.titulo).join(', ')}
                </p>
              )}
              <button
                onClick={() => alConfirmar(elegidas)}
                disabled={!completo}
                className="btn-primary w-full disabled:pointer-events-none disabled:opacity-40"
              >
                Agregar al carrito · {soles(precio)}
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
