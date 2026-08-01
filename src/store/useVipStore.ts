'use client';

import { create } from 'zustand';
import type { Bt21Id } from '@/game/config/bt21';

/**
 * Estado VISIBLE de la mecánica VIP. La lógica (tiempos, poderes, festival)
 * vive en el motor (VipDirector); este store es el espejo que lee React para
 * dibujar la barra inferior. El director escribe con updates quantizados
 * (~100ms) para no re-renderizar a 60fps.
 */

export type VipPhase = 'enter' | 'waiting' | 'happy' | 'sad';

export interface VipVisit {
  /** correlativo de la visita — React lo usa como key para reiniciar animaciones */
  seq: number;
  charId: Bt21Id;
  /** tier pedido */
  tier: number;
  waitMs: number;
  remainingMs: number;
  phase: VipPhase;
}

/** Segundos restantes de cada poder temporal (0 = inactivo), para los chips. */
export interface VipEffects {
  koya: number;
  rj: number;
  fever: number;
  van: number;
}

interface VipState {
  visit: VipVisit | null;
  /** ids atendidos en el ciclo actual de colección */
  served: Bt21Id[];
  festivalActive: boolean;
  festivalRemainingMs: number;
  effects: VipEffects;
  /** toast del poder recién activado, se limpia solo */
  powerToast: { charId: Bt21Id; text: string; at: number } | null;

  // --- escritura (solo VipDirector) ---
  setVisit: (v: VipVisit | null) => void;
  patchVisit: (p: Partial<VipVisit>) => void;
  markServed: (id: Bt21Id) => void;
  clearServed: () => void;
  setFestival: (active: boolean, remainingMs: number) => void;
  setEffects: (e: VipEffects) => void;
  showPowerToast: (charId: Bt21Id, text: string) => void;
  resetRun: () => void;
}

const NO_EFFECTS: VipEffects = { koya: 0, rj: 0, fever: 0, van: 0 };

export const useVipStore = create<VipState>((set) => ({
  visit: null,
  served: [],
  festivalActive: false,
  festivalRemainingMs: 0,
  effects: NO_EFFECTS,
  powerToast: null,

  setVisit: (visit) => set({ visit }),
  patchVisit: (p) => set((s) => (s.visit ? { visit: { ...s.visit, ...p } } : {})),
  markServed: (id) =>
    set((s) => (s.served.includes(id) ? {} : { served: [...s.served, id] })),
  clearServed: () => set({ served: [] }),
  setFestival: (festivalActive, festivalRemainingMs) =>
    set({ festivalActive, festivalRemainingMs }),
  setEffects: (effects) => set({ effects }),
  showPowerToast: (charId, text) =>
    set({ powerToast: { charId, text, at: Date.now() } }),
  resetRun: () =>
    set({
      visit: null,
      served: [],
      festivalActive: false,
      festivalRemainingMs: 0,
      effects: NO_EFFECTS,
      powerToast: null,
    }),
}));
