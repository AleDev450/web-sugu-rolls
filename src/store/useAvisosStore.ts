'use client';

import { create } from 'zustand';

/**
 * Pedidos nuevos sin confirmar recepción.
 *
 * Vive aparte de `AlertaPedidos` (que solo dispara el timbre y el aviso
 * flotante) para que `/admin/pedidos` también pueda mostrar el botón
 * "Recibido" en la tarjeta del pedido, sin duplicar el estado: quien lo
 * presione primero —desde el aviso flotante o desde la lista— apaga el
 * timbre para los dos.
 */

export interface AvisoPedido {
  id: string;
  numero: number;
  total: number;
  nombre: string;
}

interface AvisosState {
  avisos: AvisoPedido[];
  agregar: (a: AvisoPedido) => void;
  /** El admin confirma que ya vio el pedido: deja de sonar y de listarse aquí. */
  recibido: (id: string) => void;
}

export const useAvisosStore = create<AvisosState>((set) => ({
  avisos: [],
  agregar: (a) =>
    set((s) => (s.avisos.some((x) => x.id === a.id) ? s : { avisos: [...s.avisos, a] })),
  recibido: (id) => set((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) })),
}));
