import { Application, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { BOOSTERS, MOVIMIENTOS_RELOJ } from './config/boosters';
import { nivel } from './config/levels';
import { SCORING, estrellas } from './config/scoring';
import { Board } from './core/Board';
import { celdasDeBooster } from './core/boosters';
import { aplicarPaso, completados, crearObjetivos } from './core/objectives';
import { intentarSwap, resolverPendientes, swapLibre, turnoBooster } from './core/turn';
import { BoardView } from './render/BoardView';
import { cargarTexturas, liberarTexturas } from './render/textures';
import { sonido } from './SoundManager';
import { guardarResultado } from './scores';
import type {
  BoosterId,
  GameResult,
  LevelConfig,
  ObjectiveState,
  Pos,
  TurnResult,
  TurnStep,
} from './types';
import { sonVecinas } from './types';
import { useSuguMatchStore } from '../store/useSuguMatchStore';

/**
 * El director de orquesta de Sugu Match.
 *
 * Es el ÚNICO sitio donde se juntan las cuatro piezas del juego:
 *
 *   Board + core/  las reglas          (no saben dibujar)
 *   BoardView      lo que se ve        (no sabe las reglas)
 *   store          lo que ve React     (no sabe nada de las otras dos)
 *   SoundManager   lo que se oye
 *
 * Mantener esa separación es lo que permite tocar la animación sin arriesgar
 * la lógica, y añadir niveles u obstáculos sin reescribir el motor.
 *
 * El bucle de una jugada está en `jugar()`: mientras dura, `bloqueado` es true
 * y el tablero ignora al jugador. Sin ese cerrojo, un segundo swap a mitad de
 * una cascada dejaría el tablero y la pantalla contando cosas distintas.
 */
export class Game {
  private app: Application | null = null;
  private board: Board | null = null;
  private view: BoardView | null = null;
  private observer: ResizeObserver | null = null;
  private host: HTMLElement | null = null;

  private level: LevelConfig = nivel(1);
  private objetivos: ObjectiveState[] = [];
  private score = 0;
  private moves = 0;
  private inicioMs = 0;

  /** Cerrojo de entrada: true mientras algo se está animando. */
  private bloqueado = true;
  private destruido = false;

  private seleccion: Pos | null = null;
  private arrastre: { pos: Pos; x: number; y: number } | null = null;
  /** Primera casilla elegida con el booster Ohashi. */
  private ohashiA: Pos | null = null;

  private pistaTimer: ReturnType<typeof setTimeout> | null = null;

  // --- ciclo de vida ------------------------------------------------------

  async init(host: HTMLElement) {
    this.host = host;

    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      // el retina de un móvil moderno llega a 3: por encima de 2 solo se
      // gastan píxeles que nadie distingue
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destruido) {
      app.destroy(true);
      return;
    }

    this.app = app;
    host.appendChild(app.canvas);

    await cargarTexturas(app.renderer);
    if (this.destruido) return;

    app.stage.eventMode = 'static';
    app.stage.on('pointerdown', this.alPulsar);
    app.stage.on('pointermove', this.alMover);
    app.stage.on('pointerup', this.alSoltar);
    app.stage.on('pointerupoutside', this.alSoltar);

    app.ticker.add((t) => this.view?.update(t.deltaMS / 1000));

    this.observer = new ResizeObserver(() => this.ajustar());
    this.observer.observe(host);

    /*
     * Se monta el nivel 1 pero la partida NO arranca: el tablero se ve de
     * fondo tras el menú, que es más acogedor que un hueco negro, y `idle`
     * mantiene la entrada bloqueada hasta que el jugador pulse JUGAR (que es
     * además el gesto que desbloquea el audio en el navegador).
     */
    this.cargarNivel(this.level.id);
    useSuguMatchStore.getState().sync({ cargando: false, status: 'idle' });
  }

  destroy() {
    this.destruido = true;
    if (this.pistaTimer) clearTimeout(this.pistaTimer);
    this.observer?.disconnect();
    this.observer = null;
    this.view?.destroy();
    this.view = null;
    this.board = null;
    if (this.app) {
      this.app.stage.removeAllListeners();
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    liberarTexturas();
    sonido.stopMusic();
  }

  private ajustar() {
    if (!this.app || !this.view) return;
    const { width, height } = this.app.screen;
    this.app.stage.hitArea = new Rectangle(0, 0, width, height);
    this.view.medir(width, height);
  }

  // --- niveles ------------------------------------------------------------

  cargarNivel(id: number) {
    if (!this.app) return;

    const level = nivel(id);
    this.level = level;
    this.objetivos = crearObjetivos(level);
    this.score = 0;
    this.moves = level.moves;
    this.inicioMs = performance.now();
    this.seleccion = null;
    this.ohashiA = null;

    this.view?.destroy();
    this.board = new Board(level);
    this.view = new BoardView(this.board);
    this.app.stage.addChild(this.view.raiz);
    this.view.construir();
    this.ajustar();

    const store = useSuguMatchStore.getState();
    store.sync({
      levelId: level.id,
      levelNombre: level.nombre,
      score: 0,
      moves: level.moves,
      movesTotal: level.moves,
      stars: 0,
      combo: 0,
      objectives: this.objetivos,
      boosters: { ...store.boosters, ...(level.boosters ?? {}) } as Record<BoosterId, number>,
      boosterActivo: null,
      result: null,
      status: 'playing',
    });

    this.bloqueado = false;
    this.programarPista();
  }

  empezar() {
    sonido.desbloquear();
    sonido.startMusic();
    this.cargarNivel(this.level.id);
  }

  siguienteNivel() {
    this.cargarNivel(this.level.id + 1);
  }

  reintentar() {
    this.cargarNivel(this.level.id);
  }

  pausar() {
    if (useSuguMatchStore.getState().status !== 'playing') return;
    useSuguMatchStore.getState().setStatus('paused');
    sonido.pauseMusic();
  }

  reanudar() {
    if (useSuguMatchStore.getState().status !== 'paused') return;
    useSuguMatchStore.getState().setStatus('playing');
    sonido.startMusic();
  }

  // --- entrada ------------------------------------------------------------

  private get jugable(): boolean {
    const s = useSuguMatchStore.getState().status;
    return !this.bloqueado && !this.destruido && (s === 'playing' || s === 'animating');
  }

  private celdaDeEvento(e: FederatedPointerEvent): Pos | null {
    if (!this.view) return null;
    const p = this.view.raiz.toLocal(e.global);
    return this.view.celdaEn(p.x, p.y);
  }

  private alPulsar = (e: FederatedPointerEvent) => {
    if (!this.jugable || !this.view) return;

    const celda = this.celdaDeEvento(e);
    if (!celda) return;

    this.view.ocultarPista();
    this.programarPista();

    const boosterActivo = useSuguMatchStore.getState().boosterActivo;
    if (boosterActivo) {
      this.usarBoosterEn(boosterActivo, celda);
      return;
    }

    if (!this.board?.movible(celda.row, celda.col)) {
      sonido.play('swapFail');
      return;
    }

    // segundo toque sobre una vecina: intercambio por selección
    if (this.seleccion && sonVecinas(this.seleccion, celda)) {
      const a = this.seleccion;
      this.seleccion = null;
      this.view.seleccionar(null);
      void this.jugarSwap(a, celda);
      return;
    }

    this.seleccion = celda;
    this.view.seleccionar(celda);
    this.arrastre = { pos: celda, x: e.global.x, y: e.global.y };
    sonido.play('select');
  };

  private alMover = (e: FederatedPointerEvent) => {
    if (!this.jugable || !this.arrastre || !this.view) return;

    const dx = e.global.x - this.arrastre.x;
    const dy = e.global.y - this.arrastre.y;
    const umbral = this.view.lado * 0.42;
    if (Math.abs(dx) < umbral && Math.abs(dy) < umbral) return;

    // solo cuatro direcciones: manda el eje con más recorrido
    const destino: Pos =
      Math.abs(dx) > Math.abs(dy)
        ? { row: this.arrastre.pos.row, col: this.arrastre.pos.col + (dx > 0 ? 1 : -1) }
        : { row: this.arrastre.pos.row + (dy > 0 ? 1 : -1), col: this.arrastre.pos.col };

    const origen = this.arrastre.pos;
    this.arrastre = null;
    this.seleccion = null;
    this.view.seleccionar(null);

    if (this.board?.playable(destino.row, destino.col)) void this.jugarSwap(origen, destino);
  };

  private alSoltar = () => {
    this.arrastre = null;
  };

  // --- jugadas ------------------------------------------------------------

  private async jugarSwap(a: Pos, b: Pos) {
    if (!this.board || !this.view || this.bloqueado) return;

    // Ohashi: cambia las piezas aunque no formen nada
    if (this.ohashiA) {
      this.ohashiA = null;
      await this.ejecutarJugada(() => swapLibre(this.board!, a, b), a, b, 'ohashi');
      return;
    }

    if (!this.board.movible(a.row, a.col) || !this.board.movible(b.row, b.col)) {
      sonido.play('swapFail');
      return;
    }

    await this.ejecutarJugada(() => intentarSwap(this.board!, a, b), a, b);
  }

  /**
   * Camino común de toda jugada: bloquear, resolver la lógica, reproducir la
   * animación y comprobar cómo queda el nivel.
   */
  private async ejecutarJugada(
    resolver: () => TurnResult | null,
    a?: Pos,
    b?: Pos,
    gastarBooster?: BoosterId
  ) {
    if (!this.board || !this.view) return;

    this.bloqueado = true;
    useSuguMatchStore.getState().setStatus('animating');

    /*
     * Las dos piezas que toca el jugador se apuntan ANTES de resolver: el
     * motor deja el tablero ya destruido, caído y con las cascadas hechas, y
     * para entonces esas casillas contienen piezas nuevas. La animación del
     * intercambio necesita las de antes.
     */
    const idA = a ? (this.board.tileEn(a)?.id ?? undefined) : undefined;
    const idB = b ? (this.board.tileEn(b)?.id ?? undefined) : undefined;

    const resultado = resolver();

    if (!resultado) {
      // el motor ha dejado el tablero como estaba: solo hay que ir y volver
      if (a && b) {
        sonido.play('swapFail');
        await this.view.animarSwapFallido(idA, idB, a, b);
      }
      this.bloqueado = false;
      useSuguMatchStore.getState().setStatus('playing');
      return;
    }

    if (gastarBooster) this.consumirBooster(gastarBooster);

    if (a && b) {
      sonido.play('swap');
      await this.view.animarSwap(idA, idB, a, b);
    }

    if (resultado.movesUsed > 0) {
      this.moves = Math.max(0, this.moves - resultado.movesUsed);
      useSuguMatchStore.getState().sync({ moves: this.moves });
    }

    for (const paso of resultado.steps) {
      if (this.destruido) return;
      await this.reproducir(paso);
    }

    useSuguMatchStore.getState().sync({ combo: 0 });
    await this.asegurarJugadas();
    this.comprobarFinal();
  }

  /** Un paso: sonido, animación, puntuación y objetivos. */
  private async reproducir(paso: TurnStep) {
    if (!this.view) return;

    this.sonarPaso(paso);
    await this.view.reproducirPaso(paso);
    if (this.destruido) return;

    this.score += paso.score;
    this.objetivos = aplicarPaso(this.objetivos, paso, this.score);

    const store = useSuguMatchStore.getState();
    store.sync({
      score: this.score,
      combo: paso.combo > 1 ? paso.combo : 0,
      objectives: this.objetivos,
      stars: estrellas(this.score, this.level.stars),
    });

    if (paso.cleared.length) {
      const centro = paso.cleared[Math.floor(paso.cleared.length / 2)];
      this.view.flotante(
        paso.combo > 1 ? `x${paso.combo}  +${paso.score}` : `+${paso.score}`,
        centro,
        paso.combo > 1 ? 0xffd166 : 0xfff0a8
      );
    }

    if (paso.combo === 3) store.mostrarAviso('COMBO x3', 'oro');
    else if (paso.combo >= 4) store.mostrarAviso(`SUGU COMBO x${paso.combo}`, 'rosa');
  }

  private sonarPaso(paso: TurnStep) {
    const variante = Math.max(0, paso.combo - 1);

    if (paso.fx.some((f) => f.kind === 'rainbow')) sonido.play('rainbow');
    else if (paso.fx.some((f) => f.kind === 'bomb')) sonido.play('bomb');
    else if (paso.fx.length) sonido.play('special');
    else if (paso.combo > 1) sonido.play('combo', variante);
    else sonido.play('match', variante);
  }

  /** Si el tablero se queda sin jugadas, se mezcla solo y se avisa. */
  private async asegurarJugadas() {
    if (!this.board || !this.view) return;

    if (this.board.buscarMovimiento()) return;

    useSuguMatchStore.getState().mostrarAviso('SIN JUGADAS: MEZCLANDO', 'verde');
    sonido.play('shuffle');
    this.board.mezclar();
    await this.view.animarMezcla();

    // mezclar puede servir algo hecho sin querer: se resuelve antes de seguir
    const pendiente = resolverPendientes(this.board);
    for (const paso of pendiente.steps) {
      if (this.destruido) return;
      await this.reproducir(paso);
    }
  }

  // --- boosters -----------------------------------------------------------

  /** Lo llama la barra de boosters de React. */
  pulsarBooster(id: BoosterId) {
    const store = useSuguMatchStore.getState();
    if (this.bloqueado || store.status !== 'playing') return;
    if ((store.boosters[id] ?? 0) <= 0) return;

    const def = BOOSTERS[id];

    if (def.target === 'none') {
      void this.usarBoosterGlobal(id);
      return;
    }

    // segundo toque en el mismo booster: se cancela
    store.activarBooster(store.boosterActivo === id ? null : id);
    this.ohashiA = null;
    this.seleccion = null;
    this.view?.seleccionar(null);
  }

  private async usarBoosterGlobal(id: BoosterId) {
    const store = useSuguMatchStore.getState();

    if (id === 'clock') {
      this.consumirBooster(id);
      this.moves += MOVIMIENTOS_RELOJ;
      store.sync({ moves: this.moves });
      store.mostrarAviso(`+${MOVIMIENTOS_RELOJ} MOVIMIENTOS`, 'verde');
      sonido.play('booster');
      return;
    }

    if (id === 'shuffle') {
      if (!this.board || !this.view) return;
      this.consumirBooster(id);
      this.bloqueado = true;
      store.setStatus('animating');
      sonido.play('shuffle');
      this.board.mezclar();
      await this.view.animarMezcla();
      const pendiente = resolverPendientes(this.board);
      for (const paso of pendiente.steps) await this.reproducir(paso);
      this.bloqueado = false;
      store.setStatus('playing');
      this.comprobarFinal();
    }
  }

  private usarBoosterEn(id: BoosterId, celda: Pos) {
    const store = useSuguMatchStore.getState();
    const def = BOOSTERS[id];

    if (def.target === 'swap') {
      // Ohashi necesita dos casillas vecinas
      if (!this.ohashiA) {
        this.ohashiA = celda;
        this.view?.seleccionar(celda);
        sonido.play('select');
        return;
      }
      const a = this.ohashiA;
      if (!sonVecinas(a, celda)) {
        this.ohashiA = celda;
        this.view?.seleccionar(celda);
        return;
      }
      this.view?.seleccionar(null);
      store.activarBooster(null);
      sonido.play('booster');
      void this.jugarSwap(a, celda);
      return;
    }

    if (!this.board) return;
    const zona = celdasDeBooster(this.board, id, celda);
    if (!zona) return;

    store.activarBooster(null);
    sonido.play('booster');
    void this.ejecutarJugada(
      () => turnoBooster(this.board!, zona.cells, zona.fx),
      undefined,
      undefined,
      id
    );
  }

  private consumirBooster(id: BoosterId) {
    const store = useSuguMatchStore.getState();
    const quedan = Math.max(0, (store.boosters[id] ?? 0) - 1);
    store.setBooster(id, quedan);
  }

  // --- final del nivel ----------------------------------------------------

  private comprobarFinal() {
    const store = useSuguMatchStore.getState();

    if (completados(this.objetivos)) {
      // los movimientos que sobran se convierten en puntos, como premio a
      // resolver el nivel con margen
      const bonus = this.moves * SCORING.bonusPorMovimiento;
      if (bonus > 0) {
        this.score += bonus;
        store.mostrarAviso(`+${bonus} POR ${this.moves} MOVIMIENTOS`, 'oro');
      }
      this.terminar(true);
      return;
    }

    if (this.moves <= 0) {
      this.terminar(false);
      return;
    }

    this.bloqueado = false;
    store.setStatus('playing');
    this.programarPista();
  }

  private terminar(ganado: boolean) {
    const store = useSuguMatchStore.getState();
    const estrellasFinales = ganado ? estrellas(this.score, this.level.stars) : 0;

    const resultado: GameResult = {
      level: this.level.id,
      score: this.score,
      stars: estrellasFinales,
      movesUsed: this.level.moves - this.moves,
      movesLeft: this.moves,
      duration: Math.round(performance.now() - this.inicioMs),
      won: ganado,
    };

    this.bloqueado = true;
    if (this.pistaTimer) clearTimeout(this.pistaTimer);

    store.sync({
      score: this.score,
      stars: estrellasFinales,
      result: resultado,
      status: ganado ? 'won' : 'lost',
    });
    store.guardarBest(this.score);

    sonido.play(ganado ? 'levelComplete' : 'gameOver');
    void guardarResultado(resultado);
  }

  // --- pista --------------------------------------------------------------

  /** A los ocho segundos sin tocar nada, se enseña una jugada posible. */
  private programarPista() {
    if (this.pistaTimer) clearTimeout(this.pistaTimer);
    this.pistaTimer = setTimeout(() => {
      if (!this.jugable || !this.board || !this.view) return;
      const m = this.board.buscarMovimiento();
      if (m) this.view.mostrarPista(m.a, m.b);
      this.programarPista();
    }, 8000);
  }
}
