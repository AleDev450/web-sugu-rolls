'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SITE, whatsappUrl } from '@/data/site';
import { ajustesEnCache } from '@/lib/useAjustes';
import { soles, type Producto } from '@/data/productos';

/**
 * Carrito de compras. Por ahora el pedido se cierra por WhatsApp; cuando
 * exista la pasarela de pago, `mensajeWhatsapp()` se reemplaza por el checkout
 * sin tocar los componentes.
 */

export interface ItemCarrito {
  /**
   * Clave de la línea. Con presentaciones lleva sufijo (`maki-x#10`), porque
   * "5 piezas" y "10 piezas" del mismo maki son dos líneas distintas y no
   * deben sumarse entre sí.
   */
  id: string;
  /** slug real del producto, que es lo que entiende la base al pedir */
  slug: string;
  nombre: string;
  precio: number;
  imagen: string;
  cantidad: number;
  /** presentación elegida; ausente en los productos de precio único */
  piezas?: number;
}

/** Arma la clave de línea a partir del producto y la presentación. */
export function claveItem(slug: string, piezas?: number): string {
  return piezas ? `${slug}#${piezas}` : slug;
}

interface CartState {
  items: ItemCarrito[];
  abierto: boolean;

  /** `piezas` solo cuando el producto se vende por presentaciones */
  agregar: (
    p: Pick<Producto, 'id' | 'nombre' | 'precio' | 'imagen'>,
    piezas?: number,
    precioPresentacion?: number
  ) => void;
  quitar: (id: string) => void;
  cambiarCantidad: (id: string, cantidad: number) => void;
  vaciar: () => void;
  abrir: () => void;
  cerrar: () => void;

  total: () => number;
  unidades: () => number;
  mensajeWhatsapp: () => string;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      abierto: false,

      /**
       * No abre el panel a propósito: abrirlo en cada clic tapa la carta y
       * corta la compra. El aviso es el contador del header.
       */
      agregar: (p, piezas, precioPresentacion) =>
        set((s) => {
          const id = claveItem(p.id, piezas);
          const existente = s.items.find((i) => i.id === id);
          if (existente) {
            return {
              items: s.items.map((i) =>
                i.id === id ? { ...i, cantidad: i.cantidad + 1 } : i
              ),
            };
          }

          const linea: ItemCarrito = {
            id,
            slug: p.id,
            // el nombre lleva la presentación para que el carrito se lea solo
            nombre: piezas ? `${p.nombre} (${piezas} piezas)` : p.nombre,
            precio: precioPresentacion ?? p.precio,
            imagen: p.imagen,
            cantidad: 1,
            piezas,
          };
          return { items: [...s.items, linea] };
        }),

      quitar: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      cambiarCantidad: (id, cantidad) =>
        set((s) => ({
          items:
            cantidad <= 0
              ? s.items.filter((i) => i.id !== id)
              : s.items.map((i) => (i.id === id ? { ...i, cantidad } : i)),
        })),

      vaciar: () => set({ items: [] }),
      abrir: () => set({ abierto: true }),
      cerrar: () => set({ abierto: false }),

      total: () => get().items.reduce((t, i) => t + i.precio * i.cantidad, 0),
      unidades: () => get().items.reduce((t, i) => t + i.cantidad, 0),

      mensajeWhatsapp: () => {
        const { items, total } = get();
        // el número guardado en el panel; SITE solo si la base no respondió
        const a = ajustesEnCache();
        const numero = a?.whatsapp;

        if (items.length === 0) {
          return whatsappUrl('¡Hola! Quisiera hacer un pedido 🍣', numero);
        }

        const lineas = items
          .map((i) => `• ${i.cantidad}× ${i.nombre} — ${soles(i.precio * i.cantidad)}`)
          .join('\n');

        return whatsappUrl(
          `¡Hola ${SITE.nombre}! Quisiera pedir:\n\n${lineas}\n\n*Total: ${soles(total())}*`
        );
      },
    }),
    { name: 'sugu_carrito', partialize: (s) => ({ items: s.items }) }
  )
);
