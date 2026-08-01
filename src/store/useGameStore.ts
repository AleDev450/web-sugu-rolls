'use client';

import { create } from 'zustand';
import { MAX_TIER, rollSpawnTier } from '@/game/config/tiers';
import { RULES } from '@/game/config/layout';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover';

interface GameState {
  status: GameStatus;
  /** Una sola vida: llega a 0 y se acabó, sin revivir. */
  lives: number;

  score: number;
  best: number;

  currentTier: number;
  nextTier: number;

  combo: number;
  /** timestamp de la última fusión, para la ventana de combo */
  lastMergeAt: number;

  /** tiers vistos al menos una vez, para la colección */
  unlocked: number[];

  // --- acciones ---
  start: () => void;
  pause: () => void;
  resume: () => void;
  gameOver: () => void;
  reset: () => void;

  addScore: (points: number) => void;
  registerMerge: (newTier: number) => number;
  advanceQueue: (weights?: readonly number[]) => number;
  /** marca un tier como visto (fusiones lo hacen solas; poderes VIP lo usan) */
  unlockTier: (tier: number) => void;

  hydrateBest: (best: number, unlocked: number[]) => void;
}

const BEST_KEY = 'sugu_best';
const UNLOCKED_KEY = 'sugu_unlocked';

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  lives: RULES.lives,

  score: 0,
  best: 0,

  currentTier: 0,
  nextTier: 0,

  combo: 0,
  lastMergeAt: 0,

  unlocked: [],

  start: () =>
    set({
      status: 'playing',
      lives: RULES.lives,
      score: 0,
      combo: 0,
      lastMergeAt: 0,
      currentTier: rollSpawnTier(),
      nextTier: rollSpawnTier(),
    }),

  pause: () => set((s) => (s.status === 'playing' ? { status: 'paused' } : {})),
  resume: () => set((s) => (s.status === 'paused' ? { status: 'playing' } : {})),

  gameOver: () =>
    set((s) => {
      if (s.status === 'gameover') return {};
      return { status: 'gameover', lives: 0 };
    }),

  reset: () => set({ status: 'idle', combo: 0 }),

  addScore: (points) =>
    set((s) => {
      const score = s.score + Math.round(points);
      const best = Math.max(s.best, score);
      if (best !== s.best && typeof window !== 'undefined') {
        localStorage.setItem(BEST_KEY, String(best));
      }
      return { score, best };
    }),

  /** Devuelve el combo resultante. Llamar SOLO desde el motor al fusionar. */
  registerMerge: (newTier) => {
    const now = performance.now();
    const s = get();
    const inWindow = now - s.lastMergeAt < RULES.comboWindowMs;
    const combo = inWindow ? s.combo + 1 : 1;

    const unlocked = s.unlocked.includes(newTier) ? s.unlocked : [...s.unlocked, newTier];
    if (unlocked !== s.unlocked && typeof window !== 'undefined') {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
    }

    set({ combo, lastMergeAt: now, unlocked });
    return combo;
  },

  /**
   * Saca la pieza actual de la cola y devuelve el tier que se debe soltar.
   * `weights` permite alterar la probabilidad del siguiente spawn
   * (el BTS Festival carga la cola hacia tiers altos).
   */
  advanceQueue: (weights) => {
    const { currentTier, nextTier } = get();
    set({ currentTier: nextTier, nextTier: rollSpawnTier(Math.random, weights) });
    return currentTier;
  },

  unlockTier: (tier) =>
    set((s) => {
      if (s.unlocked.includes(tier)) return {};
      const unlocked = [...s.unlocked, tier];
      if (typeof window !== 'undefined') {
        localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
      }
      return { unlocked };
    }),

  hydrateBest: (best, unlocked) => set({ best, unlocked }),
}));

/** Lee localStorage una vez en el cliente (evita mismatch de hidratación SSR). */
export function hydrateFromStorage(): void {
  if (typeof window === 'undefined') return;
  const best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  let unlocked: number[] = [];
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (raw) unlocked = (JSON.parse(raw) as number[]).filter((n) => n >= 0 && n <= MAX_TIER);
  } catch {
    unlocked = [];
  }
  useGameStore.getState().hydrateBest(best, unlocked);
}
