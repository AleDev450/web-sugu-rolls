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
  id: string;
  nombre: string;
  precio: number;
  imagen: string;
  cantidad: number;
}

interface CartState {
  items: ItemCarrito[];
  abierto: boolean;

  agregar: (p: Pick<Producto, 'id' | 'nombre' | 'precio' | 'imagen'>) => void;
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
      agregar: (p) =>
        set((s) => {
          const existente = s.items.find((i) => i.id === p.id);
          const items = existente
            ? s.items.map((i) => (i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
            : [...s.items, { ...p, cantidad: 1 }];
          return { items };
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
