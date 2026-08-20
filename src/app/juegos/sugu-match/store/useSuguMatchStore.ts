'use client';

import { create } from 'zustand';
import { INVENTARIO_INICIAL } from '../game/config/boosters';
import { LEVELS } from '../game/config/levels';
import type { BoosterId, GameResult, GameStatus, ObjectiveState } from '../game/types';

/**
 * Estado que ve React.
 *
 * Regla de oro, igual que en Sugu Maki Maze: el motor NO escribe aquí en cada
 * frame. Llama a `sync()` con lo que haya cambiado al terminar cada paso de la
 * jugada, y `sync()` descarta lo que ya valía lo mismo. Con eso el HUD se
 * repinta unas pocas veces por jugada en vez de sesenta veces por segundo, y
 * el bucle de PixiJS se queda sin competencia por el hilo principal.
 *
 * Aquí no hay lógica de juego: ni se calcula puntuación, ni se decide si el
 * nivel está superado. Eso vive en `game/core/` y llega ya resuelto.
 */

export interface Aviso {
  id: number;
  texto: string;
  tono: 'oro' | 'verde' | 'rosa';
}

interface SuguMatchState {
  status: GameStatus;
  cargando: boolean;

  levelId: number;
  levelNombre: string;

  score: number;
  best: number;
  moves: number;
  movesTotal: number;
  stars: number;

  objectives: ObjectiveState[];
  /** Cascada en curso; 0 cuando el tablero está quieto. */
  combo: number;

  boosters: Record<BoosterId, number>;
  /** Booster pulsado y a la espera de que el jugador elija casilla. */
  boosterActivo: BoosterId | null;

  aviso: Aviso | null;
  result: GameResult | null;

  sonido: boolean;
  musica: boolean;

  setStatus: (s: GameStatus) => void;
  sync: (parcial: Partial<SuguMatchState>) => void;
  setBooster: (id: BoosterId, n: number) => void;
  activarBooster: (id: BoosterId | null) => void;
  mostrarAviso: (texto: string, tono?: Aviso['tono']) => void;
  quitarAviso: (id: number) => void;
  hydrateBest: () => void;
  guardarBest: (score: number) => void;
  toggleSonido: () => void;
  toggleMusica: () => void;
  reset: () => void;
}

const BEST_KEY = 'sugu-match-best';

const INICIAL = {
  status: 'idle' as GameStatus,
  cargando: true,
  levelId: LEVELS[0].id,
  levelNombre: LEVELS[0].nombre,
  score: 0,
  moves: LEVELS[0].moves,
  movesTotal: LEVELS[0].moves,
  stars: 0,
  objectives: [] as ObjectiveState[],
  combo: 0,
  boosters: { ...INVENTARIO_INICIAL },
  boosterActivo: null as BoosterId | null,
  aviso: null as Aviso | null,
  result: null as GameResult | null,
};

let avisoId = 0;

export const useSuguMatchStore = create<SuguMatchState>((set, get) => ({
  ...INICIAL,
  best: 0,
  sonido: true,
  musica: true,

  setStatus: (status) => set((s) => (s.status === status ? {} : { status })),

  /**
   * Recibe el resumen del motor y se queda solo con lo que cambió. Sin este
   * filtro, cada `set` despertaría a todos los suscriptores aunque los números
   * fueran idénticos.
   */
  sync: (parcial) =>
    set((s) => {
      const cambios: Partial<SuguMatchState> = {};
      let hay = false;
      for (const clave of Object.keys(parcial) as (keyof SuguMatchState)[]) {
        if (s[clave] !== parcial[clave]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (cambios as any)[clave] = parcial[clave];
          hay = true;
        }
      }
      return hay ? cambios : {};
    }),

  setBooster: (id, n) =>
    set((s) => (s.boosters[id] === n ? {} : { boosters: { ...s.boosters, [id]: n } })),

  activarBooster: (id) => set((s) => (s.boosterActivo === id ? {} : { boosterActivo: id })),

  mostrarAviso: (texto, tono = 'oro') => set({ aviso: { id: ++avisoId, texto, tono } }),

  quitarAviso: (id) => set((s) => (s.aviso?.id === id ? { aviso: null } : {})),

  hydrateBest: () => {
    if (typeof window === 'undefined') return;
    const guardado = Number(window.localStorage.getItem(BEST_KEY) ?? 0);
    if (Number.isFinite(guardado) && guardado > 0) set({ best: guardado });
  },

  guardarBest: (score) => {
    if (score <= get().best) return;
    set({ best: score });
    try {
      window.localStorage.setItem(BEST_KEY, String(score));
    } catch {
      // modo incógnito o almacenamiento lleno: el récord se queda en memoria
    }
  },

  toggleSonido: () => set((s) => ({ sonido: !s.sonido })),
  toggleMusica: () => set((s) => ({ musica: !s.musica })),

  reset: () => set({ ...INICIAL, boosters: { ...INVENTARIO_INICIAL } }),
}));
