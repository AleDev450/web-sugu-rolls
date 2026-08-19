import { COLS, TILE } from './config';
import { Maze } from './collision';
import { DIRS, opuesta, type Dir, type Tile } from './types';

/**
 * Movimiento común del jugador y de los enemigos.
 *
 * La regla del género: se decide SOLO en el centro de una casilla. Entre
 * centros el personaje avanza en línea recta y no puede girar, que es lo que
 * hace que un laberinto se sienta como un laberinto y no como un campo
 * abierto. El avance se parte en tramos que terminan exactamente en un centro,
 * así que nunca se pasa de largo por muy alto que sea el dt ni por muy rápido
 * que vaya el personaje.
 *
 * Coordenadas: `x`/`y` son píxeles de DISEÑO y apuntan al centro del sprite.
 */

const EPS = 0.0001;

/** Distancia que hay que recorrer para pasar de frame de animación. */
const PASO_ANIMACION = TILE * 0.42;

export abstract class Actor {
  x = 0;
  y = 0;

  /** Hacia dónde se mueve ahora mismo. `none` = parado contra una pared. */
  dir: Dir = 'none';
  /** Hacia dónde quiere ir (tecla del jugador o decisión de la IA). */
  want: Dir = 'none';
  /**
   * Última dirección real. El sprite mira aquí aunque el personaje esté
   * parado, para que no se dé la vuelta al chocar contra una pared.
   */
  facing: Dir = 'left';

  /** Píxeles de diseño por segundo. */
  speed = 100;

  /** Distancia acumulada; de aquí sale el frame de animación. */
  protected recorrido = 0;

  constructor(protected maze: Maze) {}

  /** ¿Puede cruzar la puerta de la cocina? Los enemigos sí, el jugador no. */
  protected get cruzaPuertas(): boolean {
    return false;
  }

  get frameIndex(): number {
    return Math.floor(this.recorrido / PASO_ANIMACION);
  }

  tile(): Tile {
    return { x: Maze.tileX(this.x), y: Maze.tileY(this.y) };
  }

  /** ¿Está sobre una casilla real del tablero (no dentro de un túnel)? */
  protected enTablero(): boolean {
    const tx = Maze.tileX(this.x);
    return tx >= 0 && tx < COLS;
  }

  colocar(t: Tile, dir: Dir = 'none') {
    this.x = Maze.centerX(t.x);
    this.y = Maze.centerY(t.y);
    this.dir = dir;
    this.want = dir;
    if (dir !== 'none') this.facing = dir;
    this.recorrido = 0;
  }

  /**
   * Decide la dirección en el centro de una casilla. La implementan el jugador
   * (lee la tecla pendiente) y el enemigo (IA). Debe dejar `this.dir` con la
   * dirección elegida, o `none` si no hay salida posible.
   */
  protected abstract decidir(): void;

  /** Da la vuelta en el sitio, sin esperar al centro. */
  protected invertir() {
    if (this.dir === 'none') return;
    this.dir = opuesta(this.dir);
    this.facing = this.dir;
  }

  update(dt: number) {
    let restante = this.speed * dt;
    // tope de seguridad: si algo va mal, mejor perder velocidad que colgarse
    let vueltas = 0;

    while (restante > EPS && vueltas++ < 64) {
      if (this.enCentro()) {
        this.ajustarAlCentro();
        // el túnel se resuelve antes de decidir: dentro no hay bifurcaciones
        if (!this.cruzarTunel() && this.enTablero()) {
          this.decidir();
        }
        if (this.dir === 'none') break;
        this.facing = this.dir;
      }

      const destino = this.siguienteCentro();
      if (destino.dist <= EPS) break;

      const avance = Math.min(destino.dist, restante);
      if (avance >= destino.dist - EPS) {
        this.x = destino.x;
        this.y = destino.y;
      } else {
        const d = DIRS[this.dir];
        this.x += d.x * avance;
        this.y += d.y * avance;
      }
      this.recorrido += avance;
      restante -= avance;
    }
  }

  private enCentro(): boolean {
    const cx = Maze.centerX(Maze.tileX(this.x));
    const cy = Maze.centerY(Maze.tileY(this.y));
    return Math.abs(this.x - cx) < EPS && Math.abs(this.y - cy) < EPS;
  }

  private ajustarAlCentro() {
    this.x = Maze.centerX(Maze.tileX(this.x));
    this.y = Maze.centerY(Maze.tileY(this.y));
  }

  /**
   * Teletransporte del túnel.
   *
   * El personaje sale del tablero a una casilla "virtual" (-1 o COLS), y justo
   * en su centro salta al otro extremo, también fuera de pantalla. Así el
   * cambio ocurre con el sprite ya invisible y no se ve ningún salto: entra
   * por el otro lado caminando, no apareciendo de golpe.
   */
  private cruzarTunel(): boolean {
    const tx = Maze.tileX(this.x);
    const salto = (COLS + 1) * TILE;

    if (this.dir === 'left' && tx <= -1) {
      this.x += salto;
      return true;
    }
    if (this.dir === 'right' && tx >= COLS) {
      this.x -= salto;
      return true;
    }
    return false;
  }

  /** Centro de casilla al que lleva la dirección actual, y cuánto falta. */
  private siguienteCentro(): { x: number; y: number; dist: number } {
    const d = DIRS[this.dir];
    const cx = Maze.centerX(Maze.tileX(this.x));
    const cy = Maze.centerY(Maze.tileY(this.y));

    let tx = cx;
    let ty = cy;

    if (d.x > 0) tx = this.x < cx - EPS ? cx : cx + TILE;
    else if (d.x < 0) tx = this.x > cx + EPS ? cx : cx - TILE;
    if (d.y > 0) ty = this.y < cy - EPS ? cy : cy + TILE;
    else if (d.y < 0) ty = this.y > cy + EPS ? cy : cy - TILE;

    return { x: tx, y: ty, dist: Math.abs(tx - this.x) + Math.abs(ty - this.y) };
  }

  /** ¿Se puede pisar la casilla vecina en esa dirección? */
  protected puedeIr(dir: Dir): boolean {
    if (dir === 'none') return false;
    const t = this.tile();
    const d = DIRS[dir];
    return this.maze.walkable(t.x + d.x, t.y + d.y, this.cruzaPuertas);
  }
}
