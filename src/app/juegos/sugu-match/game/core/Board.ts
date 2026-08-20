import type {
  FallMove,
  LayerKind,
  LevelConfig,
  MatchType,
  Pos,
  SpawnedTile,
  Tile,
  TileType,
} from '../types';
import { esEmparejable } from '../types';

/**
 * El tablero lógico de Sugu Match.
 *
 * No sabe nada de PixiJS, de GSAP ni de React: es una matriz de casillas con
 * las reglas de "qué se puede mover", "cómo cae" y "cómo se rellena". Todo lo
 * que dibuja va en `render/`, y todo lo que decide una jugada, en `turn.ts`.
 *
 * Dos conceptos que conviene no confundir:
 *
 *   - MOVIBLE: la pieza cae con la gravedad y se puede intercambiar. Ni las
 *     piedras ni las piezas con hielo o cuerda lo son: están clavadas hasta
 *     que se rompe lo que las sujeta.
 *   - EMPAREJABLE: la pieza cuenta para un match. Una pieza con hielo SÍ lo
 *     es —así es como el jugador la libera—, pero una piedra no.
 */

export interface Cell {
  /** false = hueco del nivel: ni hay casilla, ni cae, ni se rellena. */
  playable: boolean;
  tile: Tile | null;
}

/** Generador reproducible. Con la misma semilla sale el mismo tablero. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Board {
  readonly rows: number;
  readonly cols: number;
  /** Piezas que puede generar este nivel. */
  readonly tipos: readonly MatchType[];

  private cells: Cell[][] = [];
  private siguienteId = 1;
  private rng: () => number;

  constructor(level: LevelConfig, seed = Date.now()) {
    this.rows = level.rows;
    this.cols = level.cols;
    this.tipos = level.tiles;
    this.rng = mulberry32(seed);
    this.construir(level.layout);
  }

  // --- construcción -------------------------------------------------------

  /**
   * Levanta la rejilla a partir del mapa del nivel y la llena sin matches
   * servidos y con al menos un movimiento disponible.
   */
  private construir(layout?: readonly string[]) {
    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      const fila: Cell[] = [];
      for (let c = 0; c < this.cols; c++) {
        const simbolo = layout?.[r]?.[c] ?? '.';
        fila.push({ playable: simbolo !== '#', tile: null });
      }
      this.cells.push(fila);
    }

    this.generar(layout);
  }

  /** Rellena todas las casillas jugables respetando el mapa de obstáculos. */
  generar(layout?: readonly string[]) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const celda = this.cells[r][c];
        if (!celda.playable) {
          celda.tile = null;
          continue;
        }

        const simbolo = layout?.[r]?.[c] ?? '.';
        if (simbolo === 'o') {
          celda.tile = this.nuevaPieza('stone');
          continue;
        }

        const capa: LayerKind = simbolo === 'i' || simbolo === 'I' ? 'ice' : simbolo === 'c' ? 'rope' : 'none';
        const hp = simbolo === 'I' ? 2 : capa === 'none' ? 0 : 1;
        celda.tile = this.nuevaPieza(this.tipoSinMatch(r, c), capa, hp);
      }
    }

    // Un tablero sin jugadas posibles no es un tablero: se rehace.
    if (!this.buscarMovimiento()) this.mezclar();
  }

  /**
   * Elige un tipo que no complete un trío con las dos piezas anteriores de la
   * fila ni de la columna. Es la forma barata de cumplir `hasInitialMatches()
   * === false` sin generar y regenerar el tablero entero a ciegas.
   */
  private tipoSinMatch(r: number, c: number): MatchType {
    const prohibidos = new Set<MatchType>();

    const izq1 = this.tipoDe(r, c - 1);
    const izq2 = this.tipoDe(r, c - 2);
    if (izq1 && izq1 === izq2) prohibidos.add(izq1);

    const arr1 = this.tipoDe(r - 1, c);
    const arr2 = this.tipoDe(r - 2, c);
    if (arr1 && arr1 === arr2) prohibidos.add(arr1);

    const libres = this.tipos.filter((t) => !prohibidos.has(t));
    const pool = libres.length ? libres : this.tipos;
    return pool[Math.floor(this.rng() * pool.length)];
  }

  private tipoDe(r: number, c: number): MatchType | null {
    const t = this.tileAt(r, c);
    if (!t || !esEmparejable(t.type)) return null;
    return t.type;
  }

  nuevaPieza(type: TileType, layer: LayerKind = 'none', layerHp = 0): Tile {
    return { id: this.siguienteId++, type, special: 'none', layer, layerHp };
  }

  /** Tipo aleatorio de los permitidos por el nivel. */
  tipoAleatorio(): MatchType {
    return this.tipos[Math.floor(this.rng() * this.tipos.length)];
  }

  // --- consultas ----------------------------------------------------------

  dentro(r: number, c: number): boolean {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  playable(r: number, c: number): boolean {
    return this.dentro(r, c) && this.cells[r][c].playable;
  }

  tileAt(r: number, c: number): Tile | null {
    return this.dentro(r, c) ? this.cells[r][c].tile : null;
  }

  tileEn(p: Pos): Tile | null {
    return this.tileAt(p.row, p.col);
  }

  setTile(r: number, c: number, t: Tile | null) {
    if (this.dentro(r, c)) this.cells[r][c].tile = t;
  }

  /** Cae con la gravedad y se puede intercambiar. */
  movible(r: number, c: number): boolean {
    const t = this.tileAt(r, c);
    return !!t && t.type !== 'stone' && t.layer === 'none';
  }

  /**
   * Cuenta para un match. El arcoíris queda fuera a propósito: es un comodín
   * que se dispara al intercambiarlo, no una pieza de color.
   */
  emparejable(r: number, c: number): boolean {
    const t = this.tileAt(r, c);
    return !!t && esEmparejable(t.type) && t.special !== 'rainbow';
  }

  /** Recorre todas las casillas con pieza. */
  forEachTile(fn: (tile: Tile, row: number, col: number) => void) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.cells[r][c].tile;
        if (t) fn(t, r, c);
      }
    }
  }

  /** Cuántas piezas hay de cada tipo emparejable. */
  conteoPorTipo(): Map<MatchType, number> {
    const m = new Map<MatchType, number>();
    this.forEachTile((t) => {
      if (!esEmparejable(t.type) || t.special === 'rainbow') return;
      m.set(t.type, (m.get(t.type) ?? 0) + 1);
    });
    return m;
  }

  /** El tipo más abundante. Lo usa el arcoíris cuando estalla sin objetivo. */
  tipoMasAbundante(): MatchType {
    let mejor: MatchType = this.tipos[0];
    let max = -1;
    this.conteoPorTipo().forEach((n, t) => {
      if (n > max) {
        max = n;
        mejor = t;
      }
    });
    return mejor;
  }

  // --- movimiento ---------------------------------------------------------

  swap(a: Pos, b: Pos) {
    const ta = this.tileAt(a.row, a.col);
    const tb = this.tileAt(b.row, b.col);
    this.setTile(a.row, a.col, tb);
    this.setTile(b.row, b.col, ta);
  }

  /**
   * Colapsa el tablero: primero caída vertical, luego relleno diagonal para
   * los huecos que quedan sellados bajo una piedra, y por último piezas nuevas
   * desde arriba. Se repite hasta que nada más se mueve.
   */
  colapsar(): { falls: FallMove[]; spawns: SpawnedTile[] } {
    const falls: FallMove[] = [];

    // Origen real de cada pieza en este colapso, para que un movimiento en dos
    // tramos (vertical y luego diagonal) se anime como uno solo.
    const origen = new Map<number, { row: number; col: number }>();
    const anotar = (id: number, fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      const o = origen.get(id) ?? { row: fromRow, col: fromCol };
      origen.set(id, o);
      const previo = falls.find((f) => f.id === id);
      if (previo) {
        previo.toRow = toRow;
        previo.toCol = toCol;
      } else {
        falls.push({ id, fromRow: o.row, fromCol: o.col, toRow, toCol });
      }
    };

    let cambio = true;
    while (cambio) {
      cambio = this.caidaVertical(anotar) || this.caidaDiagonal(anotar);
    }

    const spawns = this.rellenar();
    return { falls: falls.filter((f) => f.fromRow !== f.toRow || f.fromCol !== f.toCol), spawns };
  }

  private caidaVertical(anotar: (id: number, fr: number, fc: number, tr: number, tc: number) => void): boolean {
    let movio = false;

    for (let c = 0; c < this.cols; c++) {
      // `hueco` es la casilla libre más baja donde puede aterrizar algo.
      let hueco = -1;
      for (let r = this.rows - 1; r >= 0; r--) {
        if (!this.playable(r, c)) {
          hueco = -1; // el hueco del nivel hace de suelo
          continue;
        }
        const t = this.cells[r][c].tile;
        if (!t) {
          if (hueco === -1) hueco = r;
          continue;
        }
        if (!this.movible(r, c)) {
          hueco = -1; // piedra, hielo o cuerda: nada la atraviesa
          continue;
        }
        if (hueco !== -1) {
          this.cells[hueco][c].tile = t;
          this.cells[r][c].tile = null;
          anotar(t.id, r, c, hueco, c);
          hueco--;
          movio = true;
        }
      }
    }

    return movio;
  }

  /**
   * Alimenta en diagonal los huecos que no pueden recibir nada por arriba
   * (tapados por una piedra o por el borde de un nivel recortado). Sin esto,
   * los niveles con obstáculos se quedan con agujeros para siempre.
   */
  private caidaDiagonal(anotar: (id: number, fr: number, fc: number, tr: number, tc: number) => void): boolean {
    let movio = false;

    for (let r = this.rows - 1; r >= 1; r--) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.playable(r, c) || this.cells[r][c].tile) continue;
        // si por encima puede llegar algo cayendo recto, no toca diagonal
        if (this.playable(r - 1, c) && this.movible(r - 1, c)) continue;
        if (this.playable(r - 1, c) && !this.cells[r - 1][c].tile) continue;

        for (const dc of [-1, 1]) {
          const oc = c + dc;
          if (!this.playable(r - 1, oc) || !this.movible(r - 1, oc)) continue;
          const t = this.cells[r - 1][oc].tile!;
          this.cells[r][c].tile = t;
          this.cells[r - 1][oc].tile = null;
          anotar(t.id, r - 1, oc, r, c);
          movio = true;
          break;
        }
      }
    }

    return movio;
  }

  /**
   * Genera piezas nuevas por arriba. Solo entran en las casillas a las que se
   * puede llegar desde el borde superior: lo que queda sellado bajo una piedra
   * ya lo ha resuelto la caída diagonal.
   */
  private rellenar(): SpawnedTile[] {
    const spawns: SpawnedTile[] = [];

    for (let c = 0; c < this.cols; c++) {
      let abierto = true;
      let huboCasilla = false;
      let altura = 1; // fila virtual por encima del tablero, para la animación

      for (let r = 0; r < this.rows; r++) {
        if (!this.playable(r, c)) {
          if (huboCasilla) abierto = false;
          continue;
        }
        huboCasilla = true;
        if (!abierto) continue;

        const t = this.cells[r][c].tile;
        if (t) {
          if (!this.movible(r, c)) abierto = false;
          continue;
        }

        const nueva = this.nuevaPieza(this.tipoAleatorio());
        this.cells[r][c].tile = nueva;
        spawns.push({
          id: nueva.id,
          row: r,
          col: c,
          type: nueva.type,
          special: 'none',
          layer: 'none',
          fromRow: -altura,
        });
        altura++;
      }
    }

    /*
     * Red de seguridad.
     *
     * Un nivel puede sellar una casilla del todo: bajo una piedra con piedras
     * también en diagonal, o bajo una pared de hielo de tres de ancho. Ahí no
     * llega la caída vertical, ni la diagonal, ni el relleno desde arriba, y
     * el hueco se quedaría vacío para siempre.
     *
     * En ese caso la pieza aparece EN EL SITIO (`fromRow === row`, que la
     * vista interpreta como "sin caída, entra con un pop"). Es menos elegante
     * que verla caer, pero la alternativa es un agujero permanente en el
     * tablero, y eso sí rompe la partida. La invariante que garantiza esta
     * función es simple y vale la pena: al salir, ninguna casilla jugable está
     * vacía.
     */
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.cells[r][c].playable || this.cells[r][c].tile) continue;
        const nueva = this.nuevaPieza(this.tipoAleatorio());
        this.cells[r][c].tile = nueva;
        spawns.push({
          id: nueva.id,
          row: r,
          col: c,
          type: nueva.type,
          special: 'none',
          layer: 'none',
          fromRow: r,
        });
      }
    }

    return spawns;
  }

  /**
   * Reparte de nuevo los tipos entre las piezas movibles hasta que el tablero
   * no sirva ningún match hecho y tenga al menos una jugada. Las piezas
   * conservan su id: para la vista es un baile, no un tablero nuevo.
   */
  mezclar(intentos = 60): boolean {
    const movibles: Tile[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.movible(r, c)) movibles.push(this.cells[r][c].tile!);
      }
    }
    if (movibles.length < 3) return false;

    for (let i = 0; i < intentos; i++) {
      for (const t of movibles) {
        if (t.special === 'none') t.type = this.tipoAleatorio();
      }
      if (!this.hayMatchServido() && this.buscarMovimiento()) return true;
    }

    return false;
  }

  /** ¿Hay algún trío ya formado sin que el jugador haya tocado nada? */
  hayMatchServido(): boolean {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.emparejable(r, c)) continue;
        const t = this.cells[r][c].tile!.type;
        if (
          this.emparejable(r, c + 1) &&
          this.emparejable(r, c + 2) &&
          this.tileAt(r, c + 1)!.type === t &&
          this.tileAt(r, c + 2)!.type === t
        ) {
          return true;
        }
        if (
          this.emparejable(r + 1, c) &&
          this.emparejable(r + 2, c) &&
          this.tileAt(r + 1, c)!.type === t &&
          this.tileAt(r + 2, c)!.type === t
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Primera jugada válida que encuentra, o null si el tablero está muerto.
   * Sirve para la pista del jugador y para decidir cuándo hay que mezclar.
   */
  buscarMovimiento(): { a: Pos; b: Pos } | null {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ]) {
          const a = { row: r, col: c };
          const b = { row: r + dr, col: c + dc };
          if (!this.movible(a.row, a.col) || !this.movible(b.row, b.col)) continue;

          const ta = this.tileAt(a.row, a.col)!;
          const tb = this.tileAt(b.row, b.col)!;
          /*
           * El arcoíris estalla contra lo que sea, y dos especiales juntos
           * siempre combinan. Un rayado o una bomba junto a una pieza normal,
           * en cambio, NO valen por sí solos: ese intercambio solo cuenta si
           * además forma un trío, así que pasa por la prueba de abajo como
           * cualquier otro.
           */
          if (ta.special === 'rainbow' || tb.special === 'rainbow') return { a, b };
          if (ta.special !== 'none' && tb.special !== 'none') return { a, b };

          this.swap(a, b);
          const vale = this.creaMatchEn(a) || this.creaMatchEn(b);
          this.swap(a, b);
          if (vale) return { a, b };
        }
      }
    }
    return null;
  }

  /** ¿La pieza que hay en `p` forma trío en alguna dirección? */
  private creaMatchEn(p: Pos): boolean {
    if (!this.emparejable(p.row, p.col)) return false;
    const tipo = this.tileAt(p.row, p.col)!.type;

    const cuenta = (dr: number, dc: number) => {
      let n = 0;
      let r = p.row + dr;
      let c = p.col + dc;
      while (this.emparejable(r, c) && this.tileAt(r, c)!.type === tipo) {
        n++;
        r += dr;
        c += dc;
      }
      return n;
    };

    return (
      cuenta(0, -1) + cuenta(0, 1) >= 2 || cuenta(-1, 0) + cuenta(1, 0) >= 2
    );
  }
}
