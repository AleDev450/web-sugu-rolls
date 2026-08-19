import { COLS, ROWS } from './config';
import type { Maze } from './collision';
import { DIR_LIST, DIRS, type Dir, type Tile } from './types';

/**
 * Búsqueda de caminos por anchura (BFS) sobre la rejilla.
 *
 * El laberinto tiene 525 casillas y todas las aristas cuestan lo mismo, así
 * que A* no aportaría nada: BFS ya devuelve el camino más corto y recorre el
 * mapa entero en menos de medio milisegundo. Lo que sí importa es no llamarlo
 * cada frame — cada enemigo lo hace cada 260-480 ms (ver `REPATH_MS`).
 *
 * Los buffers se reutilizan entre llamadas para no crear basura en el bucle
 * del juego. Como el motor es de un solo hilo y BFS termina dentro de la misma
 * llamada, compartirlos es seguro.
 */

const TOTAL = COLS * ROWS;
const visto = new Int32Array(TOTAL);
const previo = new Int32Array(TOTAL);
const cola = new Int32Array(TOTAL);
/** Marca de la ejecución actual: evita tener que limpiar `visto` cada vez. */
let marca = 0;

function idx(x: number, y: number): number {
  return y * COLS + x;
}

/**
 * Primer paso del camino más corto de `desde` a `hasta`.
 *
 * Devuelve la dirección que hay que tomar ahora mismo, o `null` si no hay
 * camino. `evitar` es la dirección prohibida (los enemigos no se dan la vuelta
 * a mitad de pasillo, igual que en el arcade original).
 */
export function nextStep(
  maze: Maze,
  desde: Tile,
  hasta: Tile,
  opciones: { puertas?: boolean; evitar?: Dir } = {}
): Dir | null {
  const { puertas = false, evitar = 'none' } = opciones;

  if (desde.x === hasta.x && desde.y === hasta.y) return null;

  marca++;
  let cabeza = 0;
  let cola_fin = 0;

  const origen = idx(desde.x, desde.y);
  visto[origen] = marca;
  previo[origen] = -1;
  cola[cola_fin++] = origen;

  const destino = idx(hasta.x, hasta.y);
  let encontrado = false;

  while (cabeza < cola_fin) {
    const actual = cola[cabeza++];
    if (actual === destino) {
      encontrado = true;
      break;
    }

    const cx = actual % COLS;
    const cy = (actual - cx) / COLS;

    for (const dir of DIR_LIST) {
      // la primera casilla no puede salir en la dirección prohibida
      if (actual === origen && dir === evitar) continue;

      const d = DIRS[dir];
      const ny = cy + d.y;
      const nx = maze.wrapX(cx + d.x, ny);
      if (!maze.walkable(nx, ny, puertas)) continue;

      const siguiente = idx(nx, ny);
      if (visto[siguiente] === marca) continue;
      visto[siguiente] = marca;
      previo[siguiente] = actual;
      cola[cola_fin++] = siguiente;
    }
  }

  if (!encontrado) return null;

  // se desanda el camino hasta la casilla que sigue al origen
  let nodo = destino;
  while (previo[nodo] !== origen) {
    nodo = previo[nodo];
    if (nodo < 0) return null;
  }

  const nx = nodo % COLS;
  const ny = (nodo - nx) / COLS;
  return dirEntre(maze, desde, { x: nx, y: ny });
}

/** Dirección que lleva de una casilla a su vecina (contando el túnel). */
function dirEntre(maze: Maze, a: Tile, b: Tile): Dir | null {
  if (b.y === a.y - 1) return 'up';
  if (b.y === a.y + 1) return 'down';
  if (b.y === a.y) {
    if (b.x === a.x - 1) return 'left';
    if (b.x === a.x + 1) return 'right';
    // saltó por el túnel: de la columna 0 a la última o al revés
    if (a.x === 0 && b.x === COLS - 1) return 'left';
    if (a.x === COLS - 1 && b.x === 0) return 'right';
  }
  return null;
}

/**
 * Elección "a ojo": la salida que más acerca (o más aleja) del objetivo, sin
 * recorrer el mapa. La usan los enemigos entre recálculos y cuando huyen.
 */
export function greedyStep(
  maze: Maze,
  desde: Tile,
  objetivo: Tile,
  opciones: { puertas?: boolean; evitar?: Dir; alejarse?: boolean } = {}
): Dir | null {
  const { puertas = false, evitar = 'none', alejarse = false } = opciones;

  let mejor: Dir | null = null;
  let mejorCoste = alejarse ? -Infinity : Infinity;

  for (const dir of DIR_LIST) {
    if (dir === evitar) continue;
    const n = maze.neighbour(desde, dir);
    if (!maze.walkable(n.x, n.y, puertas)) continue;

    const dx = n.x - objetivo.x;
    const dy = n.y - objetivo.y;
    const coste = dx * dx + dy * dy;
    if (alejarse ? coste > mejorCoste : coste < mejorCoste) {
      mejorCoste = coste;
      mejor = dir;
    }
  }

  return mejor;
}

/** Una salida al azar. Último recurso cuando todo lo demás falla. */
export function randomStep(maze: Maze, desde: Tile, evitar: Dir = 'none'): Dir | null {
  const salidas = maze.exits(desde).filter((d) => d !== evitar);
  if (!salidas.length) return maze.exits(desde)[0] ?? null;
  return salidas[Math.floor(Math.random() * salidas.length)];
}
