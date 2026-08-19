import { COLS, ROWS, TILE } from './config';
import { DIRS, type Dir, type ItemKind, type Tile } from './types';

/**
 * Modelo del laberinto: convierte el mapa ASCII en una rejilla consultable y
 * resuelve todas las preguntas de colisión del juego.
 *
 * La colisión es por casillas, no por cuerpos físicos: en un laberinto de
 * comecocos los personajes van siempre por el centro del pasillo, así que
 * basta con saber si la casilla de al lado es pared. Matter.js aquí solo
 * añadiría trabajo y jitter.
 */

export interface ItemSpawn {
  tile: Tile;
  kind: ItemKind;
}

export class Maze {
  readonly cols = COLS;
  readonly rows = ROWS;

  /** true = pared. Índice = y * cols + x. */
  private wall = new Uint8Array(COLS * ROWS);
  /** true = puerta de la cocina: la cruzan los enemigos, el jugador no. */
  private door = new Uint8Array(COLS * ROWS);
  /** true = interior de la cocina (los enemigos no dejan rastro de arroz ahí). */
  private house = new Uint8Array(COLS * ROWS);
  /** Filas con túnel, por índice de fila. */
  private tunnelRow = new Uint8Array(ROWS);

  /** Casillas con arroz al empezar el nivel. */
  readonly pellets: Tile[] = [];
  /** Objetos especiales (nigiri, gari, wasabi) con su casilla. */
  readonly items: ItemSpawn[] = [];
  /** Dónde asoma el maki dorado. */
  bonusTile: Tile = { x: 10, y: 15 };

  playerSpawn: Tile = { x: 10, y: 23 };
  /** Casillas iniciales de los enemigos, en el orden 1-4 del mapa. */
  enemySpawns: Tile[] = [];
  /** Casilla justo encima de la puerta: adonde salen los enemigos. */
  houseExit: Tile = { x: 10, y: 9 };
  /** Centro de la cocina: adonde vuelven los comidos. */
  houseCenter: Tile = { x: 10, y: 12 };

  constructor(map: readonly string[]) {
    const spawnsPorNumero = new Map<string, Tile>();

    for (let y = 0; y < ROWS; y++) {
      const fila = map[y] ?? '';
      for (let x = 0; x < COLS; x++) {
        const ch = fila[x] ?? '#';
        const i = y * COLS + x;

        switch (ch) {
          case '#':
            this.wall[i] = 1;
            break;
          case '-':
            this.door[i] = 1;
            break;
          case '.':
            this.pellets.push({ x, y });
            break;
          case 'W':
            this.items.push({ tile: { x, y }, kind: 'wasabi' });
            break;
          case 'N':
            this.items.push({ tile: { x, y }, kind: 'nigiri' });
            break;
          case 'R':
            this.items.push({ tile: { x, y }, kind: 'gari' });
            break;
          case 'B':
            this.bonusTile = { x, y };
            break;
          case 'P':
            this.playerSpawn = { x, y };
            break;
          case 'T':
            this.tunnelRow[y] = 1;
            break;
          default:
            if ('1234'.includes(ch)) {
              spawnsPorNumero.set(ch, { x, y });
              this.house[i] = 1;
            } else if (ch === ' ') {
              this.house[i] = 1;
            }
        }
      }
    }

    this.enemySpawns = ['1', '2', '3', '4']
      .map((n) => spawnsPorNumero.get(n))
      .filter((t): t is Tile => !!t);

    // la cocina es siempre la misma caja; la salida es la casilla sobre la puerta
    const puerta = this.findDoor();
    if (puerta) {
      this.houseExit = { x: puerta.x, y: puerta.y - 1 };
      this.houseCenter = { x: puerta.x, y: puerta.y + 2 };
    }
  }

  private findDoor(): Tile | null {
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) if (this.door[y * COLS + x]) return { x, y };
    return null;
  }

  /** ¿La fila tiene túnel de un borde al otro? */
  hasTunnel(y: number): boolean {
    return y >= 0 && y < ROWS && this.tunnelRow[y] === 1;
  }

  /** Normaliza una columna que se salió por un túnel. */
  wrapX(x: number, y: number): number {
    if (!this.hasTunnel(y)) return x;
    return ((x % COLS) + COLS) % COLS;
  }

  isWall(x: number, y: number): boolean {
    if (y < 0 || y >= ROWS) return true;
    if (x < 0 || x >= COLS) return !this.hasTunnel(y);
    return this.wall[y * COLS + x] === 1;
  }

  isDoor(x: number, y: number): boolean {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return false;
    return this.door[y * COLS + x] === 1;
  }

  isHouse(x: number, y: number): boolean {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return false;
    return this.house[y * COLS + x] === 1;
  }

  /**
   * ¿Se puede pisar esa casilla?
   *
   * `puertas` distingue a los enemigos (que entran y salen de la cocina) del
   * jugador (que se queda fuera). Es el único punto donde los dos difieren.
   */
  walkable(x: number, y: number, puertas = false): boolean {
    if (y < 0 || y >= ROWS) return false;
    if (x < 0 || x >= COLS) return this.hasTunnel(y);
    const i = y * COLS + x;
    if (this.wall[i]) return false;
    if (this.door[i]) return puertas;
    if (this.house[i]) return puertas;
    return true;
  }

  /** Casilla vecina en una dirección, ya normalizada por el túnel. */
  neighbour(t: Tile, dir: Dir): Tile {
    const d = DIRS[dir];
    const y = t.y + d.y;
    return { x: this.wrapX(t.x + d.x, y), y };
  }

  /** Salidas transitables desde una casilla. */
  exits(t: Tile, puertas = false): Dir[] {
    const salidas: Dir[] = [];
    for (const dir of ['up', 'left', 'down', 'right'] as const) {
      const n = this.neighbour(t, dir);
      if (this.walkable(n.x, n.y, puertas)) salidas.push(dir);
    }
    return salidas;
  }

  // --- conversión casilla <-> píxeles de diseño --------------------------

  static centerX(tx: number): number {
    return tx * TILE + TILE / 2;
  }

  static centerY(ty: number): number {
    return ty * TILE + TILE / 2;
  }

  static tileX(px: number): number {
    return Math.floor(px / TILE);
  }

  static tileY(py: number): number {
    return Math.floor(py / TILE);
  }
}

/** Distancia al cuadrado entre casillas. Se evita la raíz: solo se compara. */
export function distSq(a: Tile, b: Tile): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
