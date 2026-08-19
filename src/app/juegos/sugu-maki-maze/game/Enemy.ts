import { Actor } from './Actor';
import { Maze, distSq } from './collision';
import { COLS, ENEMY_SPEED_MULT, REPATH_MS, ROWS } from './config';
import { greedyStep, nextStep, randomStep } from './pathfinding';
import { DIRS, opuesta, type Dir, type EnemyKind, type EnemyMode, type Tile } from './types';

/**
 * Los cuatro enemigos.
 *
 * Cada uno calcula una CASILLA OBJETIVO distinta —ahí está su personalidad— y
 * el resto es común: BFS hasta el objetivo cada pocos cientos de milisegundos,
 * y entre recálculo y recálculo se sigue la última decisión. Recalcular a 60
 * fps no haría el juego más difícil, solo más caro y más errático.
 *
 * Modos:
 *   scatter    se va a su esquina y deja respirar al jugador
 *   chase      persigue con su propia regla
 *   frightened el jugador comió wasabi: huye y se le puede comer
 *   eaten      ya comido: vuelve a la cocina a toda prisa
 */

interface EnemyPerfil {
  /** Esquina propia en modo scatter. */
  esquina: Tile;
  /** Ruta de patrulla, solo para el ebi. */
  patrulla?: Tile[];
  /** Ajuste de velocidad respecto de la base del nivel. */
  velocidad: number;
}

const PERFILES: Record<EnemyKind, EnemyPerfil> = {
  // el chile va de frente: el más rápido y sin rodeos
  chili: { esquina: { x: COLS - 2, y: 1 }, velocidad: 1.04 },
  // el wasabi corta el paso: apunta por delante del jugador
  wasabi: { esquina: { x: 1, y: 1 }, velocidad: 1 },
  // el ebi hace su ronda y solo persigue si te cruzas
  ebi: {
    esquina: { x: COLS - 2, y: ROWS - 2 },
    patrulla: [
      { x: 1, y: 1 },
      { x: COLS - 2, y: 1 },
      { x: COLS - 2, y: ROWS - 2 },
      { x: 1, y: ROWS - 2 },
    ],
    velocidad: 0.94,
  },
  // la salsa no se sabe lo que hará: mitad persecución, mitad azar
  sauce: { esquina: { x: 1, y: ROWS - 2 }, velocidad: 0.98 },
};

export class Enemy extends Actor {
  mode: EnemyMode = 'scatter';
  /** Base del nivel; el perfil y el modo la multiplican. */
  baseSpeed = 108;

  /** Casilla a la que va ahora mismo. Se pinta en modo depuración. */
  objetivo: Tile = { x: 1, y: 1 };

  /** Tiempo que queda para recalcular la ruta. */
  private repathMs = 0;
  /** Dirección que dijo el último BFS; se usa al llegar al próximo centro. */
  private sugerida: Dir | null = null;
  /** Índice del punto de patrulla (solo ebi). */
  private puntoPatrulla = 0;
  /** Cuenta atrás para volver a salir de la cocina. */
  private encerradoMs = 0;
  /** Pide darse la vuelta en el próximo centro (cambio de modo). */
  private invertirPendiente = false;

  readonly spawn: Tile;

  constructor(
    maze: Maze,
    readonly kind: EnemyKind,
    spawn: Tile,
    /** Milisegundos que tarda en salir de la cocina al empezar el nivel. */
    salidaMs: number
  ) {
    super(maze);
    this.spawn = spawn;
    this.encerradoMs = salidaMs;
  }

  protected get cruzaPuertas(): boolean {
    // solo cruza la puerta quien entra o sale de la cocina
    return this.mode === 'eaten' || this.dentroDeLaCocina();
  }

  private dentroDeLaCocina(): boolean {
    const t = this.tile();
    return this.maze.isHouse(t.x, t.y) || this.maze.isDoor(t.x, t.y);
  }

  get asustado(): boolean {
    return this.mode === 'frightened';
  }

  get comido(): boolean {
    return this.mode === 'eaten';
  }

  reiniciar(salidaMs: number) {
    this.colocar(this.spawn, 'up');
    this.mode = 'scatter';
    this.encerradoMs = salidaMs;
    this.sugerida = null;
    this.repathMs = 0;
    this.puntoPatrulla = 0;
    this.invertirPendiente = false;
  }

  /**
   * Cambia de modo. Al pasar de scatter a chase (o al revés) el enemigo se da
   * la vuelta: es el aviso visual del arcade original de que algo cambió.
   */
  setMode(modo: EnemyMode) {
    if (this.mode === modo) return;
    const eraPerseguir = this.mode === 'chase' || this.mode === 'scatter';
    const seraPerseguir = modo === 'chase' || modo === 'scatter';
    this.mode = modo;
    this.sugerida = null;
    this.repathMs = 0;
    if (eraPerseguir && (seraPerseguir || modo === 'frightened')) this.invertirPendiente = true;
  }

  /** El jugador se lo comió: vuelve a la cocina. */
  serComido() {
    this.mode = 'eaten';
    this.sugerida = null;
    this.repathMs = 0;
  }

  /**
   * No se llama `update` para no chocar con la firma de `Actor`: el enemigo
   * necesita saber dónde está el jugador y el jugador no.
   */
  avanzar(dt: number, jugador: { tile: Tile; dir: Dir }) {
    const ms = dt * 1000;

    if (this.encerradoMs > 0) {
      this.encerradoMs -= ms;
      // dentro de la cocina se mueve arriba y abajo, esperando su turno
      this.bailarEnLaCocina(dt);
      return;
    }

    this.repathMs -= ms;
    if (this.repathMs <= 0) {
      this.repathMs = REPATH_MS[this.kind];
      this.objetivo = this.calcularObjetivo(jugador);
      this.sugerida = null; // se recalcula en el próximo centro
    }

    const mult = ENEMY_SPEED_MULT[this.mode];
    this.speed = this.baseSpeed * PERFILES[this.kind].velocidad * mult;

    if (this.invertirPendiente && this.dir !== 'none') {
      this.invertirPendiente = false;
      this.invertir();
    }

    super.update(dt);

    // llegó a la cocina después de que se lo comieran: vuelve a la carga
    if (this.mode === 'eaten' && this.enSuSitio()) {
      this.mode = 'chase';
      this.encerradoMs = 600;
    }
  }

  private enSuSitio(): boolean {
    const t = this.tile();
    const casa = this.maze.houseCenter;
    return Math.abs(t.x - casa.x) <= 2 && t.y === casa.y;
  }

  /**
   * Vaivén corto mientras espera para salir. El centro se toma de la casilla
   * donde esté ahora, no del spawn: un enemigo que acaba de ser comido espera
   * en el punto de la cocina al que ha vuelto, que no tiene por qué ser el suyo.
   */
  private bailarEnLaCocina(dt: number) {
    const centro = Maze.centerY(Maze.tileY(this.y));
    const amplitud = 5;
    this.recorrido += this.baseSpeed * dt * 0.5;
    this.y = centro + Math.sin(this.recorrido / 12) * amplitud;
    this.facing = 'up';
    // al terminar la espera se recoloca limpio para salir por la puerta
    if (this.encerradoMs <= 0) {
      this.y = centro;
      this.dir = 'up';
      this.want = 'up';
      this.mode = 'scatter';
    }
  }

  /**
   * Aquí vive la personalidad de cada uno.
   */
  private calcularObjetivo(jugador: { tile: Tile; dir: Dir }): Tile {
    if (this.mode === 'eaten') return this.maze.houseCenter;

    if (this.mode === 'frightened') {
      // huir es ir a la esquina más lejana del jugador
      const esquinas: Tile[] = [
        { x: 1, y: 1 },
        { x: COLS - 2, y: 1 },
        { x: 1, y: ROWS - 2 },
        { x: COLS - 2, y: ROWS - 2 },
      ];
      let lejos = esquinas[0];
      for (const e of esquinas) if (distSq(e, jugador.tile) > distSq(lejos, jugador.tile)) lejos = e;
      return lejos;
    }

    if (this.mode === 'scatter') return PERFILES[this.kind].esquina;

    switch (this.kind) {
      case 'chili':
        // agresivo: derecho a por el jugador
        return jugador.tile;

      case 'wasabi': {
        // emboscador: cuatro casillas por delante de donde mira el jugador
        const d = DIRS[jugador.dir];
        const objetivo = { x: jugador.tile.x + d.x * 4, y: jugador.tile.y + d.y * 4 };
        return this.acotar(objetivo);
      }

      case 'ebi': {
        // patrullero: recorre sus puntos y solo se desvía si el jugador entra
        // en su zona (a menos de 6 casillas)
        const patrulla = PERFILES.ebi.patrulla!;
        const punto = patrulla[this.puntoPatrulla];
        if (distSq(this.tile(), punto) < 9) {
          this.puntoPatrulla = (this.puntoPatrulla + 1) % patrulla.length;
        }
        if (distSq(this.tile(), jugador.tile) < 36) return jugador.tile;
        return patrulla[this.puntoPatrulla];
      }

      case 'sauce':
      default: {
        // impredecible: la mitad de las veces persigue, la otra mitad se va a
        // un rincón al azar del mapa
        if (Math.random() < 0.5) return jugador.tile;
        return this.acotar({
          x: 1 + Math.floor(Math.random() * (COLS - 2)),
          y: 1 + Math.floor(Math.random() * (ROWS - 2)),
        });
      }
    }
  }

  private acotar(t: Tile): Tile {
    return {
      x: Math.min(COLS - 1, Math.max(0, t.x)),
      y: Math.min(ROWS - 1, Math.max(0, t.y)),
    };
  }

  protected decidir() {
    const aqui = this.tile();
    const atras = opuesta(this.dir);

    // dentro de la cocina lo único que toca es subir y cruzar la puerta
    if (this.maze.isHouse(aqui.x, aqui.y) || this.maze.isDoor(aqui.x, aqui.y)) {
      if (this.mode !== 'eaten') {
        const salida = this.maze.houseExit;
        if (aqui.x !== salida.x) {
          this.dir = aqui.x < salida.x ? 'right' : 'left';
          return;
        }
        this.dir = 'up';
        return;
      }
    }

    let elegida = this.sugerida;
    this.sugerida = null;

    if (!elegida) {
      elegida = this.rutaHacia(aqui, atras);
    }

    if (elegida && this.puedeIrConPuertas(elegida)) {
      this.dir = elegida;
      return;
    }

    // sin ruta: cualquier salida que no sea volver sobre sus pasos
    const alternativa = randomStep(this.maze, aqui, atras);
    this.dir = alternativa ?? atras;
  }

  private puedeIrConPuertas(dir: Dir): boolean {
    const d = DIRS[dir];
    const t = this.tile();
    return this.maze.walkable(t.x + d.x, t.y + d.y, this.cruzaPuertas);
  }

  /**
   * Camino hasta el objetivo. En modo asustado NO se usa BFS: un enemigo que
   * huye con la ruta óptima es imposible de acorralar y el power-up deja de
   * tener gracia. Ahí basta con alejarse a ojo, con algo de azar.
   */
  private rutaHacia(desde: Tile, atras: Dir): Dir | null {
    const puertas = this.mode === 'eaten';

    if (this.mode === 'frightened') {
      if (Math.random() < 0.35) return randomStep(this.maze, desde, atras);
      return greedyStep(this.maze, desde, this.objetivo, { evitar: atras });
    }

    const paso = nextStep(this.maze, desde, this.objetivo, { puertas, evitar: atras });
    if (paso) return paso;
    return greedyStep(this.maze, desde, this.objetivo, { puertas, evitar: atras });
  }

  /** Frames de la animación que le toca a este enemigo. */
  get anim(): EnemyKind {
    return this.kind;
  }
}
