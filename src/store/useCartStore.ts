'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SITE, whatsappUrl } from '@/data/site';
import { ajustesEnCache } from '@/lib/useAjustes';
import { formatoOpciones, soles, type OpcionesConPrecio, type Producto } from '@/data/productos';

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
  /** lo elegido en cada grupo si el producto es configurable, con su precio */
  opciones?: OpcionesConPrecio;
}

/** Arma la clave de línea a partir del producto, presentación y opciones. */
export function claveItem(
  slug: string,
  piezas?: number,
  opciones?: OpcionesConPrecio
): string {
  const base = piezas ? `${slug}#${piezas}` : slug;
  if (!opciones || Object.keys(opciones).length === 0) return base;

  /*
   * Dos bowls con distinto relleno son dos líneas distintas y no deben
   * sumarse. Se ordenan grupos y opciones para que elegir "palta, choclo" y
   * "choclo, palta" dé la misma clave: es el mismo bowl. El precio no entra
   * en la firma: la misma combinación de nombres es la misma línea aunque el
   * catálogo haya cambiado de precio entre un clic y otro.
   */
  const firma = Object.keys(opciones)
    .sort()
    .map((g) => `${g}=${[...opciones[g]].map((o) => o.nombre).sort().join('+')}`)
    .join('|');
  return `${base}@${firma}`;
}

interface CartState {
  items: ItemCarrito[];
  abierto: boolean;

  /**
   * `piezas` solo en productos con presentaciones; `opciones` solo en los
   * configurables (bowls). Sin ninguno de los dos, se comporta como siempre.
   */
  agregar: (
    p: Pick<Producto, 'id' | 'nombre' | 'precio' | 'imagen'>,
    piezas?: number,
    precioPresentacion?: number,
    opciones?: OpcionesConPrecio
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
      agregar: (p, piezas, precioPresentacion, opciones) =>
        set((s) => {
          const id = claveItem(p.id, piezas, opciones);
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
            opciones,
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
          .map((i) => {
            const detalle = formatoOpciones(i.opciones);
            return `• ${i.cantidad}× ${i.nombre}${detalle ? `\n   ${detalle}` : ''} — ${soles(i.precio * i.cantidad)}`;
          })
          .join('\n');

        return whatsappUrl(
          `¡Hola ${a?.nombre ?? SITE.nombre}! Quisiera pedir:\n\n${lineas}\n\n` +
            `*Total: ${soles(total())}*\n` +
            // el reparto se cobra aparte y depende de dónde viva el cliente:
            // decirlo aquí evita la sorpresa al momento de cobrar
            `_Delivery: costo a evaluar por distrito._`,
          numero
        );
      },
    }),
    { name: 'sugu_carrito', partialize: (s) => ({ items: s.items }) }
  )
);
