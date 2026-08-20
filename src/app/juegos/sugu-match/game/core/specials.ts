import type { ActivationFx, ClearCause, Eje, Pos, SpecialKind, TileType } from '../types';
import type { Board } from './Board';
import type { MatchGroup } from './matching';

/**
 * Piezas especiales: cuándo nacen, qué barren y qué pasa al juntar dos.
 *
 * Aquí no se destruye nada. Estas funciones solo devuelven CASILLAS y
 * TRANSFORMACIONES; quien las aplica al tablero es `turn.ts`. La separación
 * importa porque el mismo cálculo lo usan tres caminos distintos —un match
 * normal, una cascada y un booster— y ninguno debería duplicar las reglas.
 */

/** Semilla de destrucción: una casilla y el motivo por el que revienta. */
export interface Semilla {
  pos: Pos;
  cause: ClearCause;
}

/** Todo lo que provoca un intercambio de dos especiales. */
export interface Detonacion {
  /** Piezas que se convierten en especiales ANTES de estallar. */
  transformar: { pos: Pos; special: SpecialKind }[];
  semillas: Semilla[];
  fx: ActivationFx[];
}

// --- creación -------------------------------------------------------------

/**
 * Qué pieza especial deja un grupo.
 *
 *   5 o más en línea      -> Rainbow Maki
 *   cruce de ejes (L / T) -> Bomb Maki
 *   4 en línea            -> Maki rayado, en el eje de la propia línea
 *   3                     -> nada
 *
 * El rayado sigue el eje de la línea que has formado (cuatro en horizontal
 * dan un rayado horizontal, que limpia la fila). Es la lectura que el jugador
 * hace sola, sin tener que aprenderse una tabla. `ejeSwap` solo desempata
 * cuando el grupo es ambiguo.
 */
export function especialDeGrupo(g: MatchGroup, ejeSwap: Eje | null): SpecialKind {
  if (g.maxH >= 5 || g.maxV >= 5) return 'rainbow';
  if (g.maxH >= 3 && g.maxV >= 3) return 'bomb';
  if (g.maxH === 4) return 'stripedH';
  if (g.maxV === 4) return 'stripedV';
  if (g.cells.length >= 4) return ejeSwap === 'v' ? 'stripedV' : 'stripedH';
  return 'none';
}

/**
 * Dónde aparece la pieza nueva. Preferimos la casilla que el jugador acaba de
 * mover: es donde está mirando, y así la recompensa sale bajo su dedo.
 */
export function celdaDeCreacion(g: MatchGroup, swap: { a: Pos; b: Pos } | null): Pos {
  if (swap) {
    const enGrupo = (p: Pos) => g.cells.some((c) => c.row === p.row && c.col === p.col);
    if (enGrupo(swap.b)) return swap.b;
    if (enGrupo(swap.a)) return swap.a;
  }
  return g.cells[Math.floor(g.cells.length / 2)];
}

// --- áreas ----------------------------------------------------------------

export function filaCompleta(board: Board, row: number): Pos[] {
  const out: Pos[] = [];
  for (let c = 0; c < board.cols; c++) if (board.playable(row, c)) out.push({ row, col: c });
  return out;
}

export function columnaCompleta(board: Board, col: number): Pos[] {
  const out: Pos[] = [];
  for (let r = 0; r < board.rows; r++) if (board.playable(r, col)) out.push({ row: r, col });
  return out;
}

/** Cuadro de lado `2 * radio + 1` centrado en `p`. */
export function cuadro(board: Board, p: Pos, radio: number): Pos[] {
  const out: Pos[] = [];
  for (let r = p.row - radio; r <= p.row + radio; r++) {
    for (let c = p.col - radio; c <= p.col + radio; c++) {
      if (board.playable(r, c)) out.push({ row: r, col: c });
    }
  }
  return out;
}

export function todasDelTipo(board: Board, type: TileType): Pos[] {
  const out: Pos[] = [];
  board.forEachTile((t, row, col) => {
    if (t.type === type) out.push({ row, col });
  });
  return out;
}

export function todoElTablero(board: Board): Pos[] {
  const out: Pos[] = [];
  board.forEachTile((_t, row, col) => out.push({ row, col }));
  return out;
}

/**
 * Casillas que barre un especial al dispararse desde `pos`.
 *
 * El arcoíris necesita saber a qué tipo apunta. Si nadie se lo dice —porque lo
 * ha alcanzado una explosión en cadena, no un intercambio— se lleva por
 * delante el tipo más abundante, que es el que más despeja el tablero.
 */
export function areaEspecial(
  board: Board,
  pos: Pos,
  kind: SpecialKind,
  target?: TileType
): { cells: Pos[]; fx: ActivationFx } {
  switch (kind) {
    case 'stripedH':
      return { cells: filaCompleta(board, pos.row), fx: { kind: 'stripedH', ...pos } };
    case 'stripedV':
      return { cells: columnaCompleta(board, pos.col), fx: { kind: 'stripedV', ...pos } };
    case 'bomb':
      return { cells: cuadro(board, pos, 1), fx: { kind: 'bomb', ...pos } };
    case 'rainbow': {
      const t = target ?? board.tipoMasAbundante();
      return {
        cells: [...todasDelTipo(board, t), pos],
        fx: { kind: 'rainbow', ...pos, target: t },
      };
    }
    default:
      return { cells: [], fx: { kind: 'bomb', ...pos } };
  }
}

// --- combinaciones especial + especial ------------------------------------

const RAYADOS: SpecialKind[] = ['stripedH', 'stripedV'];

/**
 * Qué ocurre al intercambiar dos piezas cuando al menos una es especial.
 * Devuelve null si el intercambio no dispara nada (dos piezas normales).
 *
 * `a` es la pieza que el jugador arrastró y `b` la de destino: el efecto se
 * centra en `b`, que es donde acaba el dedo.
 */
export function comboDeEspeciales(board: Board, a: Pos, b: Pos): Detonacion | null {
  const ta = board.tileEn(a);
  const tb = board.tileEn(b);
  if (!ta || !tb) return null;

  const sa = ta.special;
  const sb = tb.special;
  if (sa === 'none' && sb === 'none') return null;

  // --- arcoíris + arcoíris: se lleva el tablero por delante ---------------
  if (sa === 'rainbow' && sb === 'rainbow') {
    return {
      transformar: [],
      semillas: todoElTablero(board).map((pos) => ({ pos, cause: 'rainbow' as ClearCause })),
      fx: [
        { kind: 'rainbow', row: b.row, col: b.col },
        { kind: 'rainbow', row: a.row, col: a.col },
      ],
    };
  }

  // --- arcoíris + cualquier otra -----------------------------------------
  if (sa === 'rainbow' || sb === 'rainbow') {
    const arcoiris = sa === 'rainbow' ? a : b;
    const otra = sa === 'rainbow' ? tb : ta;
    const posOtra = sa === 'rainbow' ? b : a;

    // arcoíris + especial: convierte todo ese tipo en ese especial y lo enciende
    if (otra.special === 'stripedH' || otra.special === 'stripedV' || otra.special === 'bomb') {
      const objetivo = todasDelTipo(board, otra.type);
      return {
        transformar: objetivo.map((pos, i) => ({
          pos,
          special:
            otra.special === 'bomb' ? 'bomb' : (RAYADOS[i % 2] as SpecialKind),
        })),
        semillas: [
          ...objetivo.map((pos) => ({ pos, cause: 'rainbow' as ClearCause })),
          { pos: arcoiris, cause: 'rainbow' as ClearCause },
        ],
        fx: [{ kind: 'rainbow', row: arcoiris.row, col: arcoiris.col, target: otra.type }],
      };
    }

    // arcoíris + pieza normal: fuera todas las de ese tipo
    return {
      transformar: [],
      semillas: [
        ...todasDelTipo(board, otra.type).map((pos) => ({ pos, cause: 'rainbow' as ClearCause })),
        { pos: posOtra, cause: 'rainbow' as ClearCause },
        { pos: arcoiris, cause: 'rainbow' as ClearCause },
      ],
      fx: [{ kind: 'rainbow', row: arcoiris.row, col: arcoiris.col, target: otra.type }],
    };
  }

  const rayadoA = sa === 'stripedH' || sa === 'stripedV';
  const rayadoB = sb === 'stripedH' || sb === 'stripedV';

  // --- rayado + rayado: cruz completa sobre la casilla de destino ---------
  if (rayadoA && rayadoB) {
    return {
      transformar: [
        { pos: a, special: 'stripedV' },
        { pos: b, special: 'stripedH' },
      ],
      semillas: [
        { pos: a, cause: 'stripedV' },
        { pos: b, cause: 'stripedH' },
      ],
      fx: [],
    };
  }

  // --- bomba + bomba: explosión de 5x5 ------------------------------------
  if (sa === 'bomb' && sb === 'bomb') {
    return {
      transformar: [],
      semillas: [
        ...cuadro(board, b, 2).map((pos) => ({ pos, cause: 'bomb' as ClearCause })),
        { pos: a, cause: 'bomb' as ClearCause },
      ],
      fx: [{ kind: 'bomb', row: b.row, col: b.col }],
    };
  }

  // --- bomba + rayado: tres filas y tres columnas -------------------------
  if ((rayadoA && sb === 'bomb') || (sa === 'bomb' && rayadoB)) {
    const centro = b;
    const cells: Pos[] = [];
    for (let d = -1; d <= 1; d++) {
      cells.push(...filaCompleta(board, centro.row + d));
      cells.push(...columnaCompleta(board, centro.col + d));
    }
    return {
      transformar: [],
      semillas: [
        ...cells.map((pos) => ({ pos, cause: 'bomb' as ClearCause })),
        { pos: a, cause: 'bomb' as ClearCause },
      ],
      fx: [
        { kind: 'stripedH', row: centro.row, col: centro.col },
        { kind: 'stripedV', row: centro.row, col: centro.col },
      ],
    };
  }

  // --- especial + pieza normal --------------------------------------------
  // No es un combo: el especial se dispara solo si el intercambio forma match,
  // cosa que decide `turn.ts`. Devolvemos null para no adelantarnos.
  return null;
}
