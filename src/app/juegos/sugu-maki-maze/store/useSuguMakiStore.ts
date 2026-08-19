'use client';

import { create } from 'zustand';
import { HIGHSCORE_KEY, LEVEL_SECONDS, START_LIVES } from '../game/config';
import type { GameResult, GameStatus } from '../game/types';

/**
 * Estado que ve React.
 *
 * Regla de oro de este juego: el motor NO escribe aquí en cada frame. Solo
 * llama a `sync()` con lo que haya cambiado, y `sync()` a su vez descarta lo
 * que ya valía lo mismo. Con eso el HUD se repinta unas pocas veces por
 * segundo (marcador, reloj, combo) en vez de sesenta, y el bucle de PixiJS se
 * queda sin competencia por el hilo principal.
 */

/** Aviso efímero que se pinta sobre el tablero ("SUGU BONUS!"). */
export interface Aviso {
  id: number;
  texto: string;
  tono: 'oro' | 'verde' | 'rojo';
}

interface SuguMakiState {
  status: GameStatus;

  score: number;
  best: number;
  lives: number;
  level: number;

  /** Milisegundos que quedan del nivel; se refresca 4 veces por segundo. */
  timeMs: number;
  timeTotalMs: number;

  combo: number;
  /** Arroz y objetos recogidos del nivel, de 0 a 1. */
  progress: number;
  /** Milisegundos que queda de SUGU POWER. 0 = apagado. */
  powerMs: number;

  aviso: Aviso | null;
  result: GameResult | null;

  /** Ajustes rápidos del jugador. */
  sonido: boolean;
  musica: boolean;

  setStatus: (s: GameStatus) => void;
  sync: (parcial: Partial<SuguMakiState>) => void;
  mostrarAviso: (texto: string, tono?: Aviso['tono']) => void;
  quitarAviso: (id: number) => void;
  setResult: (r: GameResult | null) => void;
  hydrateBest: () => void;
  guardarBest: (score: number) => void;
  toggleSonido: () => void;
  toggleMusica: () => void;
  reset: () => void;
}

const INICIAL = {
  status: 'menu' as GameStatus,
  score: 0,
  lives: START_LIVES,
  level: 1,
  // el menú enseña el reloj del nivel 1 lleno, no un 00:00 de partida perdida
  timeMs: LEVEL_SECONDS[0] * 1000,
  timeTotalMs: LEVEL_SECONDS[0] * 1000,
  combo: 0,
  progress: 0,
  powerMs: 0,
  aviso: null,
  result: null,
};

let avisoId = 0;

export const useSuguMakiStore = create<SuguMakiState>((set, get) => ({
  ...INICIAL,
  best: 0,
  sonido: true,
  musica: true,

  setStatus: (status) => set((s) => (s.status === status ? {} : { status })),

  /**
   * Recibe el resumen del motor y se queda solo con lo que cambió. Sin este
   * filtro, cada `set` dispararía a todos los suscriptores aunque los números
   * fueran idénticos.
   */
  sync: (parcial) =>
    set((s) => {
      const cambios: Partial<SuguMakiState> = {};
      let hay = false;
      for (const clave of Object.keys(parcial) as (keyof SuguMakiState)[]) {
        if (s[clave] !== parcial[clave]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (cambios as any)[clave] = parcial[clave];
          hay = true;
        }
      }
      return hay ? cambios : {};
    }),

  mostrarAviso: (texto, tono = 'oro') => set({ aviso: { id: ++avisoId, texto, tono } }),

  quitarAviso: (id) => set((s) => (s.aviso?.id === id ? { aviso: null } : {})),

  setResult: (result) => set({ result }),

  hydrateBest: () => {
    if (typeof window === 'undefined') return;
    const guardado = Number(window.localStorage.getItem(HIGHSCORE_KEY) ?? 0);
    if (Number.isFinite(guardado) && guardado > 0) set({ best: guardado });
  },

  guardarBest: (score) => {
    if (score <= get().best) return;
    set({ best: score });
    try {
      window.localStorage.setItem(HIGHSCORE_KEY, String(score));
    } catch {
      // modo incógnito o almacenamiento lleno: el récord se queda en memoria
    }
  },

  toggleSonido: () => set((s) => ({ sonido: !s.sonido })),
  toggleMusica: () => set((s) => ({ musica: !s.musica })),

  reset: () => set({ ...INICIAL }),
}));
