'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { soles } from '@/data/productos';
import { useCartStore } from '@/store/useCartStore';
import { Checkout } from './Checkout';

/**
 * Panel lateral del carrito. El cierre normal es `Checkout` (crea el pedido en
 * la base y acumula puntos); WhatsApp queda como salida secundaria para quien
 * no quiera crearse una cuenta.
 */
export function Cart() {
  const { items, abierto, cerrar, quitar, cambiarCantidad, vaciar } = useCartStore();
  const total = items.reduce((t, i) => t + i.precio * i.cantidad, 0);
  const mensajeWhatsapp = useCartStore((s) => s.mensajeWhatsapp);

  return (
    <AnimatePresence>
      {abierto && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cerrar}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
            aria-hidden
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            className="fixed right-0 top-0 z-[80] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-night-soft"
            role="dialog"
            aria-label="Tu pedido"
          >
            <header className="flex items-center justify-between border-b border-white/10 p-5">
              <h2 className="flex items-center gap-2.5 text-lg font-bold">
                <ShoppingBag className="h-5 w-5 text-sugu" />
                Tu pedido
              </h2>
              <button
                onClick={cerrar}
                className="rounded-full border border-white/15 p-2 transition-colors hover:border-white/40"
                aria-label="Cerrar carrito"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <ShoppingBag className="h-12 w-12 text-white/15" />
                <p className="text-bone-dim">Tu carrito está vacío.</p>
                <button onClick={cerrar} className="btn-ghost mt-2">
                  Ver la carta
                </button>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-white/10 overflow-y-auto">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-4 p-5">
                      <div className="relative h-20 w-20 flex-none overflow-hidden rounded-xl bg-night-2">
                        <Image
                          src={item.imagen}
                          alt={item.nombre}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{item.nombre}</h3>
                        <p className="mt-0.5 text-sm font-bold text-sugu">
                          {soles(item.precio)}
                        </p>

                        <div className="mt-2.5 flex items-center gap-3">
                          <div className="flex items-center gap-1 rounded-full border border-white/15">
                            <button
                              onClick={() => cambiarCantidad(item.id, item.cantidad - 1)}
                              className="p-1.5 transition-colors hover:text-sugu"
                              aria-label={`Quitar una unidad de ${item.nombre}`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-6 text-center text-sm font-semibold">
                              {item.cantidad}
                            </span>
                            <button
                              onClick={() => cambiarCantidad(item.id, item.cantidad + 1)}
                              className="p-1.5 transition-colors hover:text-sugu"
                              aria-label={`Agregar una unidad de ${item.nombre}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            onClick={() => quitar(item.id)}
                            className="text-white/40 transition-colors hover:text-sugu"
                            aria-label={`Eliminar ${item.nombre}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <footer className="border-t border-white/10 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-bone-dim">Total</span>
                    <span className="text-2xl font-bold text-sugu">{soles(total)}</span>
                  </div>

                  <Checkout />

                  <a
                    href={mensajeWhatsapp()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost mt-2 w-full"
                  >
                    Pedir por WhatsApp
                  </a>

                  <button
                    onClick={vaciar}
                    className="mt-2 w-full py-2 text-xs text-white/40 transition-colors hover:text-sugu"
                  >
                    Vaciar carrito
                  </button>
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
