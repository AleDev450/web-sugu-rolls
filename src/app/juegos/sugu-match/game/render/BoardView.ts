import gsap from 'gsap';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  CAIDA_ESCALON,
  CASILLA_MAX,
  CASILLA_MIN,
  DUR,
  MARGEN_TABLERO,
  PARTICULAS_POR_PIEZA,
  POP_ESCALON,
} from '../config/medidas';
import { tileColor } from '../config/tiles';
import type { Board } from '../core/Board';
import type { ActivationFx, Pos, TurnStep } from '../types';
import {
  TABLERO,
  TABLERO_ALTO_EN_CASILLAS,
  TABLERO_ANCHO_EN_CASILLAS,
  TABLERO_MARGEN_X,
  TABLERO_MARGEN_Y,
} from './interfaz';
import { Particles } from './Particles';
import { TileSprite } from './TileSprite';
import { fxTex, texTablero } from './textures';

/**
 * Espera a que termine una animación de GSAP.
 *
 * `Timeline.then()` resuelve con la propia timeline, no con `void`, así que
 * encadenarla directamente arrastra ese tipo por todo el archivo. Este
 * envoltorio la convierte en una promesa normal y corriente.
 */
function esperar(tl: gsap.core.Timeline | gsap.core.Tween): Promise<void> {
  return new Promise((resolve) => {
    void tl.then(() => resolve());
  });
}

/**
 * Todo lo que se ve del tablero.
 *
 * La vista NUNCA decide reglas: recibe un `TurnStep` ya resuelto por el motor
 * y lo reproduce. Cuando `reproducirPaso` termina, lo que hay en pantalla
 * coincide exactamente con lo que hay en `Board`.
 *
 * Coordenadas: todo se calcula en el sistema local de `raiz`, que es lo que se
 * centra dentro del canvas. Así un cambio de tamaño de ventana solo mueve un
 * contenedor y no toca ni una posición de pieza.
 */
export class BoardView {
  readonly raiz = new Container();

  private capaFondo = new Container();
  private capaPiezas = new Container();
  private capaFx = new Container();
  private particulas: Particles;

  private sprites = new Map<number, TileSprite>();
  private fondo = new Graphics();
  private bandeja: Sprite | null = null;
  private marcaSeleccion = new Graphics();
  private marcaPista = new Graphics();

  /** Lado de casilla en píxeles de pantalla. */
  lado = 64;
  private margenX = 14;
  private margenY = 14;

  constructor(private board: Board) {
    this.raiz.addChild(this.capaFondo, this.capaPiezas, this.capaFx);
    this.capaFondo.addChild(this.fondo, this.marcaPista, this.marcaSeleccion);
    this.particulas = new Particles(this.capaFx);
    this.marcaSeleccion.visible = false;
    this.marcaPista.visible = false;
  }

  // --- geometría ----------------------------------------------------------

  /**
   * ¿Se pinta la bandeja dibujada o la rejilla de Graphics?
   *
   * La lámina `tablero.png` está dibujada con ocho huecos por lado y solo
   * sirve para eso. Un nivel de 9x9 —o cualquiera con huecos que dejen la
   * bandeja a medias— sigue usando el dibujo de repuesto, que se adapta a
   * cualquier tamaño. Por eso esto es una pregunta y no una constante.
   */
  private get usaLamina(): boolean {
    if (this.board.rows !== TABLERO.rows || this.board.cols !== TABLERO.cols) return false;
    if (texTablero() === null) return false;
    // un nivel con huecos enseñaría casillas pintadas donde no se puede jugar
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) if (!this.board.playable(r, c)) return false;
    }
    return true;
  }

  get ancho() {
    return this.usaLamina
      ? this.lado * TABLERO_ANCHO_EN_CASILLAS
      : this.board.cols * this.lado + this.margenX * 2;
  }

  get alto() {
    return this.usaLamina
      ? this.lado * TABLERO_ALTO_EN_CASILLAS
      : this.board.rows * this.lado + this.margenY * 2;
  }

  /**
   * Ajusta el tamaño de casilla al hueco disponible y recoloca todo.
   * No hay ninguna medida fija: el mismo tablero sirve para un móvil en
   * vertical y para una pantalla de escritorio.
   */
  medir(anchoDisp: number, altoDisp: number) {
    /*
     * Se despeja el lado de casilla que cabe en cada eje y manda el menor.
     *
     * El divisor no son las columnas a secas: hay que contar también el marco.
     * Con la lámina ese marco no es un margen que elijamos nosotros, es el que
     * viene pintado, y `TABLERO_*_EN_CASILLAS` es justamente cuántas casillas
     * mide la imagen entera. Repartir el hueco con otro número dejaría la
     * bandeja recortada o flotando.
     */
    const [divAncho, divAlto] = this.usaLamina
      ? [TABLERO_ANCHO_EN_CASILLAS, TABLERO_ALTO_EN_CASILLAS]
      : [this.board.cols + MARGEN_TABLERO * 2, this.board.rows + MARGEN_TABLERO * 2];

    const porAncho = anchoDisp / divAncho;
    const porAlto = altoDisp / divAlto;
    this.lado = Math.max(CASILLA_MIN, Math.min(CASILLA_MAX, Math.floor(Math.min(porAncho, porAlto))));

    if (this.usaLamina) {
      // sin redondear: medio píxel de más aquí se convierte en cuatro de
      // desfase en la última columna, y ahí sí se nota que la pieza no está
      // centrada en su hueco
      this.margenX = this.lado * TABLERO_MARGEN_X;
      this.margenY = this.lado * TABLERO_MARGEN_Y;
    } else {
      this.margenX = Math.round(this.lado * MARGEN_TABLERO);
      this.margenY = this.margenX;
    }

    this.raiz.x = Math.round((anchoDisp - this.ancho) / 2);
    this.raiz.y = Math.round((altoDisp - this.alto) / 2);

    this.pintarFondo();
    this.sprites.forEach((s) => s.setLado(this.lado));
    this.recolocar();
  }

  /** Centro de la casilla en coordenadas locales de `raiz`. */
  centro(row: number, col: number): { x: number; y: number } {
    return {
      x: this.margenX + col * this.lado + this.lado / 2,
      y: this.margenY + row * this.lado + this.lado / 2,
    };
  }

  /** Casilla que hay bajo un punto en coordenadas locales, o null. */
  celdaEn(x: number, y: number): Pos | null {
    const col = Math.floor((x - this.margenX) / this.lado);
    const row = Math.floor((y - this.margenY) / this.lado);
    return this.board.playable(row, col) ? { row, col } : null;
  }

  private pintarFondo() {
    if (this.usaLamina) {
      this.pintarBandeja();
      return;
    }

    /*
     * Sin lámina: la rejilla a mano, que vale para cualquier tamaño de
     * tablero. Va casi opaca porque detrás hay una foto con mucho detalle —la
     * terraza— y una bandeja translúcida deja ver farolillos y flores entre
     * las piezas, que es exactamente el ruido que un Match-3 no puede tener.
     */
    if (this.bandeja) this.bandeja.visible = false;

    const g = this.fondo;
    g.visible = true;
    g.clear();
    g.roundRect(0, 0, this.ancho, this.alto, this.lado * 0.32).fill({
      color: 0x2b6d8f,
      alpha: 0.92,
    });

    const hueco = this.lado * 0.06;
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        if (!this.board.playable(r, c)) continue;
        const p = this.centro(r, c);
        g.roundRect(
          p.x - this.lado / 2 + hueco,
          p.y - this.lado / 2 + hueco,
          this.lado - hueco * 2,
          this.lado - hueco * 2,
          this.lado * 0.2
        ).fill({ color: 0x8fd0e8, alpha: (r + c) % 2 ? 0.26 : 0.38 });
      }
    }
  }

  /**
   * Coloca la bandeja dibujada detrás de las piezas.
   *
   * Se estira a `ancho` x `alto`, que ya se calcularon de forma que un paso de
   * la rejilla de la imagen valga exactamente un `lado` en pantalla. Es decir:
   * la lámina no se adapta a las casillas, son las casillas las que se
   * calcularon a partir de la lámina. Por eso aquí no hay ni un ajuste fino.
   */
  private pintarBandeja() {
    const t = texTablero();
    if (!t) return;

    this.fondo.visible = false;

    if (!this.bandeja) {
      this.bandeja = new Sprite(t);
      // debajo de la marca de selección y de la de pista, que ya están dentro
      this.capaFondo.addChildAt(this.bandeja, 0);
    }

    this.bandeja.visible = true;
    this.bandeja.position.set(0, 0);
    this.bandeja.width = this.ancho;
    this.bandeja.height = this.alto;
  }

  // --- piezas -------------------------------------------------------------

  /** Crea desde cero los sprites de todas las piezas del tablero. */
  construir() {
    this.sprites.forEach((s) => s.destroy());
    this.sprites.clear();

    this.board.forEachTile((t, row, col) => {
      const s = this.crearSprite(t.id);
      s.sync(t.type, t.special, t.layer);
      const p = this.centro(row, col);
      s.view.position.set(p.x, p.y);
    });
  }

  private crearSprite(id: number): TileSprite {
    const s = new TileSprite(id);
    s.setLado(this.lado);
    this.capaPiezas.addChild(s.view);
    this.sprites.set(id, s);
    return s;
  }

  /** Recoloca cada sprite en la casilla que ocupa ahora mismo su pieza. */
  private recolocar() {
    this.board.forEachTile((t, row, col) => {
      const s = this.sprites.get(t.id);
      if (!s) return;
      const p = this.centro(row, col);
      s.view.position.set(p.x, p.y);
      s.sync(t.type, t.special, t.layer);
    });
  }

  /** Sincroniza dibujo y capas sin mover nada. */
  refrescarEstado() {
    this.board.forEachTile((t) => {
      this.sprites.get(t.id)?.sync(t.type, t.special, t.layer);
    });
  }

  // --- marcas de interfaz -------------------------------------------------

  seleccionar(pos: Pos | null) {
    if (!pos) {
      this.marcaSeleccion.visible = false;
      gsap.killTweensOf(this.marcaSeleccion.scale);
      return;
    }
    const p = this.centro(pos.row, pos.col);
    const g = this.marcaSeleccion;
    g.clear();
    g.roundRect(-this.lado / 2, -this.lado / 2, this.lado, this.lado, this.lado * 0.22).stroke({
      width: Math.max(2, this.lado * 0.07),
      color: 0xfff0a8,
      alpha: 0.95,
    });
    g.position.set(p.x, p.y);
    g.visible = true;
    g.scale.set(1);
    gsap.killTweensOf(g.scale);
    gsap.to(g.scale, { x: 1.08, y: 1.08, duration: 0.45, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  /** Parpadeo suave sobre la jugada sugerida. */
  mostrarPista(a: Pos, b: Pos) {
    const pa = this.centro(a.row, a.col);
    const pb = this.centro(b.row, b.col);
    const g = this.marcaPista;
    g.clear();
    for (const p of [pa, pb]) {
      g.roundRect(
        p.x - this.lado / 2,
        p.y - this.lado / 2,
        this.lado,
        this.lado,
        this.lado * 0.22
      ).fill({ color: 0xffffff, alpha: 0.28 });
    }
    g.visible = true;
    g.alpha = 0;
    gsap.killTweensOf(g);
    gsap.to(g, { alpha: 1, duration: 0.4, yoyo: true, repeat: 5, ease: 'sine.inOut' });
  }

  ocultarPista() {
    gsap.killTweensOf(this.marcaPista);
    this.marcaPista.visible = false;
  }

  // --- animaciones --------------------------------------------------------

  /**
   * Intercambio válido: las dos piezas cruzan y se quedan.
   *
   * Las piezas llegan por ID y no se leen del tablero a propósito: cuando esto
   * se llama, el motor YA ha resuelto la jugada entera —destrucción, caída y
   * cascadas incluidas—, así que preguntarle al tablero quién hay en esas dos
   * casillas devolvería piezas distintas de las que el jugador tocó.
   */
  async animarSwap(idA: number | undefined, idB: number | undefined, a: Pos, b: Pos) {
    await this.moverPar(idA, b, idB, a, DUR.swap);
  }

  /** Intercambio inválido: van y vuelven. */
  async animarSwapFallido(idA: number | undefined, idB: number | undefined, a: Pos, b: Pos) {
    await this.moverPar(idA, b, idB, a, DUR.swapVuelta);
    await this.moverPar(idA, a, idB, b, DUR.swapVuelta);
  }

  private moverPar(
    idA: number | undefined,
    destinoA: Pos,
    idB: number | undefined,
    destinoB: Pos,
    dur: number
  ): Promise<void> {
    const sa = idA !== undefined ? this.sprites.get(idA) : null;
    const sb = idB !== undefined ? this.sprites.get(idB) : null;
    const tl = gsap.timeline();

    if (sa) {
      const p = this.centro(destinoA.row, destinoA.col);
      tl.to(sa.view, { x: p.x, y: p.y, duration: dur, ease: 'power2.inOut' }, 0);
    }
    if (sb) {
      const p = this.centro(destinoB.row, destinoB.col);
      tl.to(sb.view, { x: p.x, y: p.y, duration: dur, ease: 'power2.inOut' }, 0);
    }

    return esperar(tl);
  }

  /**
   * Reproduce un paso completo del motor: especiales, destrucción, creación,
   * caída y relleno. Al terminar, pantalla y tablero coinciden.
   */
  async reproducirPaso(step: TurnStep) {
    step.fx.forEach((f) => this.efectoEspecial(f));

    await this.animarDestruccion(step);
    this.animarCapas(step);
    await this.animarCreaciones(step);
    await this.animarCaida(step);
  }

  private async animarDestruccion(step: TurnStep) {
    if (!step.cleared.length) return;

    const tl = gsap.timeline();
    step.cleared.forEach((c, i) => {
      const s = this.sprites.get(c.id);
      if (!s) return;
      this.sprites.delete(c.id);

      const retardo = Math.min(i * POP_ESCALON, 0.18);
      const p = this.centro(c.row, c.col);

      tl.to(
        s.view.scale,
        {
          x: 0,
          y: 0,
          duration: DUR.pop,
          ease: 'back.in(2.2)',
          onStart: () => {
            this.particulas.estallido(p.x, p.y, tileColor(c.type), PARTICULAS_POR_PIEZA);
          },
          onComplete: () => s.destroy(),
        },
        retardo
      );
      tl.to(s.view, { alpha: 0, duration: DUR.pop, ease: 'power1.in' }, retardo);
    });

    await esperar(tl);
  }

  private animarCapas(step: TurnStep) {
    for (const h of step.layerHits) {
      const s = this.sprites.get(h.id);
      if (!s) continue;

      const p = this.centro(h.row, h.col);
      this.particulas.estallido(p.x, p.y, h.layer === 'ice' ? 0xbfeaff : 0xc9a05c, 4, 0.7);
      gsap.fromTo(
        s.view,
        { x: p.x - this.lado * 0.06 },
        { x: p.x, duration: 0.35, ease: 'elastic.out(1.6, 0.35)' }
      );

      // el motor ya ha quitado la capa si se rompió: se relee solo esa pieza
      const tile = this.board.tileAt(h.row, h.col);
      if (tile) s.sync(tile.type, tile.special, tile.layer);
    }
  }

  private async animarCreaciones(step: TurnStep) {
    if (!step.created.length) return;

    const tl = gsap.timeline();
    for (const c of step.created) {
      const s = this.sprites.get(c.id);
      if (!s) continue;
      s.sync(c.type, c.special, 'none');
      const p = this.centro(c.row, c.col);
      this.particulas.estallido(p.x, p.y, 0xfff0a8, 8, 1.2);
      tl.fromTo(
        s.view.scale,
        { x: 0.4, y: 0.4 },
        { x: 1, y: 1, duration: DUR.especial, ease: 'back.out(2.4)' },
        0
      );
    }

    await esperar(tl);
  }

  private async animarCaida(step: TurnStep) {
    if (!step.falls.length && !step.spawns.length) return;

    const tl = gsap.timeline();

    for (const f of step.falls) {
      const s = this.sprites.get(f.id);
      if (!s) continue;
      const p = this.centro(f.toRow, f.toCol);
      const distancia = Math.abs(f.toRow - f.fromRow);
      tl.to(
        s.view,
        {
          x: p.x,
          y: p.y,
          duration: DUR.caida + distancia * 0.012,
          ease: 'power2.in',
        },
        0
      );
    }

    for (const sp of step.spawns) {
      const s = this.crearSprite(sp.id);
      s.sync(sp.type, sp.special, sp.layer);
      const fin = this.centro(sp.row, sp.col);

      // `fromRow === row` es la pieza que nace en una casilla sellada: no cae
      // desde ningún sitio, así que entra con un pop (ver `Board.rellenar`)
      if (sp.fromRow >= sp.row) {
        s.view.position.set(fin.x, fin.y);
        s.view.scale.set(0);
        tl.to(s.view.scale, { x: 1, y: 1, duration: DUR.spawn, ease: 'back.out(2.2)' }, 0);
        continue;
      }

      const inicio = this.centro(sp.fromRow, sp.col);
      s.view.position.set(inicio.x, inicio.y);
      tl.to(
        s.view,
        { x: fin.x, y: fin.y, duration: DUR.spawn, ease: 'power2.in' },
        Math.min(sp.col * CAIDA_ESCALON * 0.4, 0.12)
      );
    }

    await esperar(tl);
    this.rebotarAterrizaje(step);
  }

  /** Aplastadito al aterrizar. Es lo que hace que la caída se sienta con peso. */
  private rebotarAterrizaje(step: TurnStep) {
    const ids = [...step.falls.map((f) => f.id), ...step.spawns.map((s) => s.id)];
    for (const id of ids) {
      const s = this.sprites.get(id);
      if (!s) continue;
      gsap.fromTo(
        s.view.scale,
        { x: 1.14, y: 0.86 },
        { x: 1, y: 1, duration: 0.22, ease: 'elastic.out(1.4, 0.45)' }
      );
    }
  }

  /** El baile de la mezcla: todas las piezas se juntan y vuelven a repartirse. */
  async animarMezcla() {
    const cx = this.ancho / 2;
    const cy = this.alto / 2;
    const tl = gsap.timeline();

    this.sprites.forEach((s) => {
      tl.to(s.view, { x: cx, y: cy, duration: DUR.shuffle * 0.5, ease: 'power2.in' }, 0);
    });
    await esperar(tl);

    this.refrescarEstado();

    const vuelta = gsap.timeline();
    this.board.forEachTile((t, row, col) => {
      const s = this.sprites.get(t.id);
      if (!s) return;
      const p = this.centro(row, col);
      vuelta.to(
        s.view,
        { x: p.x, y: p.y, duration: DUR.shuffle * 0.6, ease: 'back.out(1.5)' },
        Math.random() * 0.12
      );
    });
    await esperar(vuelta);
  }

  // --- efectos de especiales ----------------------------------------------

  private efectoEspecial(f: ActivationFx) {
    const p = this.centro(f.row, f.col);
    const t = fxTex();

    if (f.kind === 'stripedH' || f.kind === 'stripedV') {
      const haz = new Sprite(t.haz);
      haz.anchor.set(0.5);
      haz.tint = 0xfff3c4;
      haz.position.set(f.kind === 'stripedH' ? this.ancho / 2 : p.x, f.kind === 'stripedH' ? p.y : this.alto / 2);
      haz.width = f.kind === 'stripedH' ? this.ancho : this.lado * 0.5;
      haz.height = f.kind === 'stripedH' ? this.lado * 0.5 : this.alto;
      this.capaFx.addChild(haz);

      gsap.fromTo(
        haz,
        { alpha: 0.95 },
        {
          alpha: 0,
          duration: 0.34,
          ease: 'power2.out',
          onComplete: () => haz.destroy(),
        }
      );
      return;
    }

    const halo = new Sprite(t.resplandor);
    halo.anchor.set(0.5);
    halo.position.set(p.x, p.y);
    halo.tint = f.kind === 'rainbow' ? 0xffffff : 0xffc06a;
    halo.width = halo.height = this.lado;
    this.capaFx.addChild(halo);

    const destino = f.kind === 'rainbow' ? this.lado * 9 : this.lado * 3.6;
    gsap.to(halo, {
      width: destino,
      height: destino,
      alpha: 0,
      duration: f.kind === 'rainbow' ? 0.55 : 0.4,
      ease: 'power2.out',
      onComplete: () => halo.destroy(),
    });

    this.particulas.estallido(p.x, p.y, f.kind === 'rainbow' ? 0xffffff : 0xffa93d, 14, 1.6);
  }

  /** Número flotante sobre el tablero (puntos de un combo). */
  flotante(texto: string, pos: Pos, color = 0xfff0a8) {
    const p = this.centro(pos.row, pos.col);
    const t = new Text({
      text: texto,
      style: {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: Math.round(this.lado * 0.5),
        fontWeight: '900',
        fill: color,
        stroke: { color: 0x2a1a12, width: Math.max(3, this.lado * 0.07) },
      },
    });
    t.anchor.set(0.5);
    t.position.set(p.x, p.y);
    this.capaFx.addChild(t);

    gsap.to(t, {
      y: p.y - this.lado * 1.2,
      alpha: 0,
      duration: 0.9,
      ease: 'power2.out',
      onComplete: () => t.destroy(),
    });
  }

  // --- ciclo de vida ------------------------------------------------------

  update(dt: number) {
    this.particulas.update(dt);
    this.sprites.forEach((s) => s.animarAura(dt * 60));
  }

  destroy() {
    gsap.killTweensOf(this.marcaSeleccion.scale);
    gsap.killTweensOf(this.marcaPista);
    this.sprites.forEach((s) => {
      gsap.killTweensOf(s.view);
      gsap.killTweensOf(s.view.scale);
      s.destroy();
    });
    this.sprites.clear();
    this.particulas.destroy();
    // sin `texture: true`: la bandeja vive en la caché de Assets y la
    // comparten los niveles siguientes
    this.bandeja = null;
    this.raiz.destroy({ children: true });
  }
}
