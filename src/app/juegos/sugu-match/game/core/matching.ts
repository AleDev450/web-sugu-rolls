import type { MatchType, Pos } from '../types';
import type { Board } from './Board';

/**
 * Detección de combinaciones.
 *
 * Se hace en dos tiempos, y merece la pena entender por qué:
 *
 *   1. Se buscan las RACHAS: tramos rectos de 3 o más piezas iguales, en
 *      horizontal y en vertical, por separado.
 *   2. Las rachas que comparten alguna casilla se funden en un GRUPO. Ese
 *      segundo paso es el que hace que una L o una T se traten como una sola
 *      combinación de 5 piezas —y generen una bomba— en vez de como dos tríos
 *      sueltos que se solapan.
 *
 * `maxH` y `maxV` del grupo (la racha más larga de cada eje) son lo único que
 * hace falta después para decidir qué pieza especial nace: 5 en línea, cruce
 * de ejes o línea de 4.
 */

export interface Racha {
  type: MatchType;
  cells: Pos[];
  eje: 'h' | 'v';
}

export interface MatchGroup {
  type: MatchType;
  cells: Pos[];
  /** Longitud de la racha horizontal más larga del grupo (0 si no hay). */
  maxH: number;
  /** Longitud de la racha vertical más larga del grupo (0 si no hay). */
  maxV: number;
}

const clave = (r: number, c: number) => r * 1000 + c;

export function findHorizontalMatches(board: Board): Racha[] {
  const out: Racha[] = [];

  for (let r = 0; r < board.rows; r++) {
    let inicio = 0;
    while (inicio < board.cols) {
      if (!board.emparejable(r, inicio)) {
        inicio++;
        continue;
      }
      const tipo = board.tileAt(r, inicio)!.type as MatchType;
      let fin = inicio + 1;
      while (fin < board.cols && board.emparejable(r, fin) && board.tileAt(r, fin)!.type === tipo) {
        fin++;
      }
      if (fin - inicio >= 3) {
        const cells: Pos[] = [];
        for (let c = inicio; c < fin; c++) cells.push({ row: r, col: c });
        out.push({ type: tipo, cells, eje: 'h' });
      }
      inicio = fin;
    }
  }

  return out;
}

export function findVerticalMatches(board: Board): Racha[] {
  const out: Racha[] = [];

  for (let c = 0; c < board.cols; c++) {
    let inicio = 0;
    while (inicio < board.rows) {
      if (!board.emparejable(inicio, c)) {
        inicio++;
        continue;
      }
      const tipo = board.tileAt(inicio, c)!.type as MatchType;
      let fin = inicio + 1;
      while (fin < board.rows && board.emparejable(fin, c) && board.tileAt(fin, c)!.type === tipo) {
        fin++;
      }
      if (fin - inicio >= 3) {
        const cells: Pos[] = [];
        for (let r = inicio; r < fin; r++) cells.push({ row: r, col: c });
        out.push({ type: tipo, cells, eje: 'v' });
      }
      inicio = fin;
    }
  }

  return out;
}

/**
 * Todas las combinaciones del tablero, ya fundidas en grupos (L, T y cruces
 * incluidos).
 */
export function findMatches(board: Board): MatchGroup[] {
  const rachas = [...findHorizontalMatches(board), ...findVerticalMatches(board)];
  if (!rachas.length) return [];

  // Unión por casilla compartida. `grupoDe` mapea casilla -> índice de grupo.
  const grupoDe = new Map<number, number>();
  const grupos: Racha[][] = [];

  for (const racha of rachas) {
    const vecinos = new Set<number>();
    for (const p of racha.cells) {
      const g = grupoDe.get(clave(p.row, p.col));
      if (g !== undefined) vecinos.add(g);
    }

    if (vecinos.size === 0) {
      const idx = grupos.length;
      grupos.push([racha]);
      for (const p of racha.cells) grupoDe.set(clave(p.row, p.col), idx);
      continue;
    }

    // Se funden todos los grupos tocados en el más bajo de los índices.
    const destino = Math.min(...vecinos);
    grupos[destino].push(racha);
    for (const g of vecinos) {
      if (g === destino) continue;
      grupos[destino].push(...grupos[g]);
      grupos[g] = [];
    }
    for (const [k, g] of grupoDe) {
      if (vecinos.has(g)) grupoDe.set(k, destino);
    }
    for (const p of racha.cells) grupoDe.set(clave(p.row, p.col), destino);
  }

  return grupos
    .filter((rs) => rs.length > 0)
    .map((rs) => {
      const vistas = new Set<number>();
      const cells: Pos[] = [];
      let maxH = 0;
      let maxV = 0;

      for (const r of rs) {
        if (r.eje === 'h') maxH = Math.max(maxH, r.cells.length);
        else maxV = Math.max(maxV, r.cells.length);
        for (const p of r.cells) {
          const k = clave(p.row, p.col);
          if (vistas.has(k)) continue;
          vistas.add(k);
          cells.push(p);
        }
      }

      return { type: rs[0].type, cells, maxH, maxV };
    });
}

/** ¿El tablero sirve alguna combinación ya hecha? */
export function hasInitialMatches(board: Board): boolean {
  return board.hayMatchServido();
}

/** Primera jugada disponible, o null si el tablero está muerto. */
export function findPossibleMove(board: Board): { a: Pos; b: Pos } | null {
  return board.buscarMovimiento();
}

export function hasPossibleMoves(board: Board): boolean {
  return board.buscarMovimiento() !== null;
}
