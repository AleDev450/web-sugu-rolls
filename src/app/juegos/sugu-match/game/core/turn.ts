import { SCORING, multiplicadorCombo, puntosGrupo } from '../config/scoring';
import type {
  ActivationFx,
  ClearCause,
  ClearedTile,
  CreatedTile,
  Eje,
  LayerHit,
  LayerKind,
  Pos,
  SpecialKind,
  TileType,
  TurnResult,
  TurnStep,
} from '../types';
import { sonVecinas } from '../types';
import type { Board } from './Board';
import { findMatches, type MatchGroup } from './matching';
import {
  areaEspecial,
  celdaDeCreacion,
  comboDeEspeciales,
  especialDeGrupo,
  type Semilla,
} from './specials';

/**
 * La jugada completa: de "el jugador ha soltado el dedo" a "el tablero vuelve
 * a estar quieto".
 *
 * Este módulo es el único que MODIFICA el tablero durante una jugada, y no
 * dibuja nada: devuelve la lista de pasos (`TurnStep[]`) que la vista
 * reproducirá con GSAP. Esa frontera es la que permite probar el motor sin
 * navegador y cambiar la animación sin tocar las reglas.
 *
 * Un paso = una vuelta de destruir -> caer -> rellenar. La cascada son los
 * pasos 2, 3, 4... que salen solos y no cuestan movimientos.
 */

const clave = (p: Pos) => p.row * 1000 + p.col;

interface Barrido {
  cleared: ClearedTile[];
  layerHits: LayerHit[];
  fx: ActivationFx[];
}

/**
 * Propaga la destrucción desde unas semillas.
 *
 * Es una cola, no una recursión: cada especial que revienta mete sus casillas
 * al final, así que una cadena de bombas y rayados se resuelve en anchura y
 * nunca se desborda la pila. `activados` corta los ciclos (dos rayados que se
 * apuntan el uno al otro).
 */
function ejecutarBarrido(board: Board, semillas: Semilla[], protegidas: Set<number>): Barrido {
  const cleared = new Map<number, ClearedTile>();
  const layerHits = new Map<number, LayerHit>();
  const fx: ActivationFx[] = [];
  const activados = new Set<number>();
  const cola: Semilla[] = [...semillas];

  while (cola.length) {
    const { pos, cause } = cola.shift()!;
    if (!board.playable(pos.row, pos.col)) continue;

    const t = board.tileEn(pos);
    if (!t || protegidas.has(t.id)) continue;

    const k = clave(pos);
    if (cleared.has(k)) continue;

    // El hielo y la cuerda se comen el golpe: la pieza sigue en el tablero.
    if (t.layer !== 'none') {
      if (!layerHits.has(k)) {
        layerHits.set(k, {
          id: t.id,
          row: pos.row,
          col: pos.col,
          layer: t.layer,
          hp: t.layerHp - 1,
        });
      }
      continue;
    }

    cleared.set(k, {
      id: t.id,
      row: pos.row,
      col: pos.col,
      type: t.type,
      special: t.special,
      cause,
    });

    if (t.special !== 'none' && !activados.has(t.id)) {
      activados.add(t.id);
      const { cells, fx: efecto } = areaEspecial(board, pos, t.special);
      fx.push(efecto);
      const causa = t.special as ClearCause;
      for (const c of cells) cola.push({ pos: c, cause: causa });
    }
  }

  return { cleared: [...cleared.values()], layerHits: [...layerHits.values()], fx };
}

/** Aplica al tablero lo que el barrido decidió y devuelve los recuentos. */
function aplicarBarrido(board: Board, b: Barrido) {
  const collected: Partial<Record<TileType, number>> = {};
  const broken: Partial<Record<LayerKind, number>> = {};

  for (const c of b.cleared) {
    board.setTile(c.row, c.col, null);
    collected[c.type] = (collected[c.type] ?? 0) + 1;
  }

  for (const h of b.layerHits) {
    const t = board.tileAt(h.row, h.col);
    if (!t) continue;
    t.layerHp = Math.max(0, t.layerHp - 1);
    if (t.layerHp === 0) {
      broken[h.layer] = (broken[h.layer] ?? 0) + 1;
      t.layer = 'none';
    }
  }

  return { collected, broken };
}

/**
 * Decide qué especiales nacen de los grupos y en qué casilla.
 *
 * La casilla elegida se PROTEGE del barrido: su pieza no revienta, se
 * transforma. Se evita colocar el especial sobre una pieza con hielo o cuerda,
 * que no podría moverse y dejaría el regalo inservible.
 */
function planearCreaciones(
  board: Board,
  grupos: MatchGroup[],
  swap: { a: Pos; b: Pos } | null,
  ejeSwap: Eje | null
): { creaciones: { pos: Pos; special: SpecialKind }[]; protegidas: Set<number> } {
  const creaciones: { pos: Pos; special: SpecialKind }[] = [];
  const protegidas = new Set<number>();

  for (const g of grupos) {
    const special = especialDeGrupo(g, ejeSwap);
    if (special === 'none') continue;

    let pos = celdaDeCreacion(g, swap);
    const libre = (p: Pos) => {
      const t = board.tileEn(p);
      return !!t && t.layer === 'none';
    };
    if (!libre(pos)) {
      const alternativa = g.cells.find(libre);
      if (!alternativa) continue;
      pos = alternativa;
    }

    const t = board.tileEn(pos)!;
    protegidas.add(t.id);
    creaciones.push({ pos, special });
  }

  return { creaciones, protegidas };
}

interface OpcionesPaso {
  combo: number;
  grupos?: MatchGroup[];
  semillas: Semilla[];
  swap?: { a: Pos; b: Pos } | null;
  ejeSwap?: Eje | null;
  /** Transformaciones previas (combos de arcoíris). */
  transformar?: { pos: Pos; special: SpecialKind }[];
  fxExtra?: ActivationFx[];
}

/** Una vuelta completa: destruir, crear especiales, caer y rellenar. */
function ejecutarPaso(board: Board, o: OpcionesPaso): TurnStep {
  for (const t of o.transformar ?? []) {
    const tile = board.tileEn(t.pos);
    if (tile && tile.layer === 'none' && tile.type !== 'stone') tile.special = t.special;
  }

  const { creaciones, protegidas } = planearCreaciones(
    board,
    o.grupos ?? [],
    o.swap ?? null,
    o.ejeSwap ?? null
  );

  const barrido = ejecutarBarrido(board, o.semillas, protegidas);
  const { collected, broken } = aplicarBarrido(board, barrido);

  const created: CreatedTile[] = [];
  for (const c of creaciones) {
    const tile = board.tileEn(c.pos);
    if (!tile) continue;
    tile.special = c.special;
    created.push({
      id: tile.id,
      row: c.pos.row,
      col: c.pos.col,
      type: tile.type,
      special: c.special,
    });
  }

  // --- puntuación --------------------------------------------------------
  let score = 0;
  for (const g of o.grupos ?? []) score += puntosGrupo(g.cells.length);
  for (const c of barrido.cleared) score += SCORING.porBarrido[c.cause];
  for (const c of created) score += SCORING.porCrear[c.special];
  for (const [capa, n] of Object.entries(broken)) {
    score += SCORING.porRomper[capa as LayerKind] * (n ?? 0);
  }
  score = Math.round(score * multiplicadorCombo(o.combo));

  const { falls, spawns } = board.colapsar();

  return {
    combo: o.combo,
    cleared: barrido.cleared,
    created,
    layerHits: barrido.layerHits,
    fx: [...(o.fxExtra ?? []), ...barrido.fx],
    falls,
    spawns,
    score,
    collected,
    broken,
  };
}

/** Encadena cascadas hasta que el tablero deja de servir combinaciones. */
function cascada(board: Board, comboInicial: number): TurnStep[] {
  const steps: TurnStep[] = [];
  let combo = comboInicial;

  // Tope de seguridad: un tablero patológico no puede colgar la pestaña.
  for (let i = 0; i < 40; i++) {
    const grupos = findMatches(board);
    if (!grupos.length) break;

    combo++;
    steps.push(
      ejecutarPaso(board, {
        combo,
        grupos,
        semillas: grupos.flatMap((g) =>
          g.cells.map((pos) => ({ pos, cause: 'match' as ClearCause }))
        ),
      })
    );
  }

  return steps;
}

function resultado(steps: TurnStep[], movesUsed: number): TurnResult {
  return {
    steps,
    movesUsed,
    totalScore: steps.reduce((s, p) => s + p.score, 0),
    maxCombo: steps.reduce((m, p) => Math.max(m, p.combo), 0),
  };
}

/**
 * Intenta el intercambio que ha pedido el jugador.
 *
 * Devuelve null si el movimiento no vale (no son vecinas, alguna está clavada,
 * o el cambio no forma nada). En ese caso el tablero queda EXACTAMENTE como
 * estaba: quien llama solo tiene que animar la vuelta atrás.
 */
export function intentarSwap(board: Board, a: Pos, b: Pos): TurnResult | null {
  if (!sonVecinas(a, b)) return null;
  if (!board.movible(a.row, a.col) || !board.movible(b.row, b.col)) return null;

  board.swap(a, b);

  const detonacion = comboDeEspeciales(board, a, b);
  if (detonacion) {
    const primero = ejecutarPaso(board, {
      combo: 1,
      semillas: detonacion.semillas,
      transformar: detonacion.transformar,
      fxExtra: detonacion.fx,
    });
    return resultado([primero, ...cascada(board, 1)], 1);
  }

  const grupos = findMatches(board);
  if (!grupos.length) {
    board.swap(a, b);
    return null;
  }

  const ejeSwap: Eje = a.row === b.row ? 'h' : 'v';
  const primero = ejecutarPaso(board, {
    combo: 1,
    grupos,
    swap: { a, b },
    ejeSwap,
    semillas: grupos.flatMap((g) => g.cells.map((pos) => ({ pos, cause: 'match' as ClearCause }))),
  });

  return resultado([primero, ...cascada(board, 1)], 1);
}

/**
 * Intercambio forzado del booster Ohashi: cambia las piezas aunque no formen
 * nada. Si de casualidad sale match, se resuelve como una jugada normal.
 */
export function swapLibre(board: Board, a: Pos, b: Pos): TurnResult | null {
  if (!sonVecinas(a, b)) return null;
  if (!board.movible(a.row, a.col) || !board.movible(b.row, b.col)) return null;

  board.swap(a, b);

  const detonacion = comboDeEspeciales(board, a, b);
  if (detonacion) {
    const primero = ejecutarPaso(board, {
      combo: 1,
      semillas: detonacion.semillas,
      transformar: detonacion.transformar,
      fxExtra: detonacion.fx,
    });
    return resultado([primero, ...cascada(board, 1)], 0);
  }

  const grupos = findMatches(board);
  if (!grupos.length) return resultado([], 0); // swap hecho, sin destrucción

  const ejeSwap: Eje = a.row === b.row ? 'h' : 'v';
  const primero = ejecutarPaso(board, {
    combo: 1,
    grupos,
    swap: { a, b },
    ejeSwap,
    semillas: grupos.flatMap((g) => g.cells.map((pos) => ({ pos, cause: 'match' as ClearCause }))),
  });

  return resultado([primero, ...cascada(board, 1)], 0);
}

/**
 * Destrucción provocada por un booster (shoyu, gari, wasabi, ají). No gasta
 * movimiento y encadena cascadas igual que una jugada.
 */
export function turnoBooster(board: Board, celdas: Pos[], fx: ActivationFx[] = []): TurnResult {
  const primero = ejecutarPaso(board, {
    combo: 1,
    semillas: celdas.map((pos) => ({ pos, cause: 'booster' as ClearCause })),
    fxExtra: fx,
  });
  return resultado([primero, ...cascada(board, 1)], 0);
}

/**
 * Resuelve lo que haya servido en el tablero sin intervención del jugador.
 * Se usa tras mezclar y como red de seguridad al arrancar un nivel.
 */
export function resolverPendientes(board: Board): TurnResult {
  return resultado(cascada(board, 0), 0);
}
