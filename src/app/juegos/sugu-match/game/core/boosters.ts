import type { ActivationFx, BoosterId, Pos } from '../types';
import type { Board } from './Board';
import { columnaCompleta, cuadro, filaCompleta } from './specials';

/**
 * Traducción de "booster + casilla" a "casillas que revientan".
 *
 * Los boosters que no apuntan a una casilla (shuffle, reloj) no pasan por
 * aquí: los resuelve `Game.ts`, porque tocan el tablero entero o el contador
 * de movimientos, no una zona.
 */
export function celdasDeBooster(
  board: Board,
  id: BoosterId,
  pos: Pos
): { cells: Pos[]; fx: ActivationFx[] } | null {
  switch (id) {
    case 'shoyu':
      return { cells: [pos], fx: [] };

    case 'spicy':
      return { cells: cuadro(board, pos, 1), fx: [{ kind: 'bomb', row: pos.row, col: pos.col }] };

    case 'gari':
      return {
        cells: filaCompleta(board, pos.row),
        fx: [{ kind: 'stripedH', row: pos.row, col: pos.col }],
      };

    case 'wasabi':
      return {
        cells: columnaCompleta(board, pos.col),
        fx: [{ kind: 'stripedV', row: pos.row, col: pos.col }],
      };

    default:
      return null;
  }
}
