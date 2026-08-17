import gsap from 'gsap';
import { Physics, type MergeEvent, type SuguBody } from './Physics';
import { Renderer } from './Renderer';
import { VipDirector } from './VipDirector';
import { loadGameAssets } from '@/game/assets/loader';
import { play, haptic, unlockAudio } from '@/game/audio/audio';
import {
  BOARD_BOTTOM,
  BOARD_LEFT,
  BOARD_RIGHT,
  DANGER_Y,
  DESIGN,
  PHYSICS,
  RAMPA,
  RULES,
} from '@/game/config/layout';
import { MAX_TIER, TIERS, hitRadius, tierAt } from '@/game/config/tiers';
import { VIP } from '@/game/config/vip';
import { useGameStore } from '@/store/useGameStore';

/**
 * Orquestador: une física, render, audio, store y clientes VIP.
 *
 * Reglas confirmadas:
 * - UNA SOLA VIDA — sin revivir, continuar ni power-ups.
 * - Derrota cuando una pieza YA NO PUEDE INGRESAR a la caja (se queda asentada
 *   sobresaliendo por arriba durante `RULES.dangerGraceMs`) o cuando una pieza
 *   SE SALE del rectángulo (derrota inmediata).
 * - Los BT21 son clientes, no piezas: piden platos, dan poderes y, con los 7
 *   atendidos, disparan el BTS Festival (VipDirector).
 */
export class SuguGame {
  private renderer = new Renderer();
  private physics!: Physics;
  private director!: VipDirector;

  private aimX = DESIGN.width / 2;
  private pointerActive = false;
  private lastDropAt = 0;
  private dropLocked = false;
  /** ms que la ficha actual lleva esperando; al llegar a autoDropMs se lanza sola */
  private autoDropMs = 0;

  /**
   * Tiempo ACUMULADO en peligro, sumando dtMs del ticker — no un instante de
   * `performance.now()`.
   *
   * Con reloj de pared, el rato que el juego pasa sin correr (en pausa, o con
   * la pestaña en segundo plano porque bloqueaste el móvil) contaba igual: al
   * volver, la resta ya superaba la gracia y la partida moría sola, sin que la
   * pila hubiera cambiado. Sumando dtMs, el contador solo avanza mientras se
   * está jugando de verdad.
   */
  private dangerMs = 0;
  private dangerActive = false;
  /** último segundo anunciado de la cuenta atrás, para no repetir el aviso */
  private dangerBeep = 0;

  /** ms JUGADOS de la partida en curso; alimenta la rampa de dificultad */
  private runMs = 0;

  /** muestrario de colliders abierto: ni se suelta ficha ni se puede perder */
  private inspeccion = false;
  /** últimas flechas pulsadas, para detectar el combo del muestrario */
  private flechas: string[] = [];

  private disposed = false;
  private unsubStatus?: () => void;

  async init(host: HTMLDivElement) {
    await loadGameAssets();
    await this.renderer.init(host);

    this.physics = new Physics({
      onMerge: (e) => this.handleMerge(e),
      onSupremePair: (p) => this.handleSupremePair(p),
    });

    this.director = new VipDirector({
      physics: this.physics,
      renderer: this.renderer,
      onSpecialCreate: (tier, body) => this.handleSpecialCreate(tier, body),
    });

    this.renderer.setDanger(false);
    this.bindInput();
    this.descartarPartidaHuerfana();

    this.unsubStatus = useGameStore.subscribe((s, prev) => {
      /*
       * Se entra en partida desde el menú Y desde el game over: si solo se
       * mirara 'idle', volver a jugar tras perder dejaba el tablero anterior
       * en pie y el director sin reiniciar.
       */
      if (s.status === 'playing' && prev.status !== 'playing' && prev.status !== 'paused') {
        this.onStart();
      }
      if (s.status === 'idle' && prev.status !== 'idle') {
        this.clearBoard();
        this.director.endRun();
      }
      if (s.status === 'gameover' && prev.status !== 'gameover') this.director.endRun();
    });

    this.renderer.app.ticker.add((ticker) => this.tick(ticker.deltaMS));
  }

  destroy() {
    this.disposed = true;
    this.unsubStatus?.();
    this.unbindInput();
    this.physics?.destroy();
    this.renderer.destroy();
  }

  /**
   * Tira la partida que quedó colgando de un montaje anterior.
   *
   * Los dos stores (juego y VIP) son singletons de módulo: viven fuera del
   * canvas y SOBREVIVEN a salir de /juego y volver. El motor, en cambio, se
   * reconstruye entero — física nueva, tablero vacío. Sin esto el store seguía
   * diciendo 'playing' con el puntaje y el festival de antes, y como el status
   * nunca cambiaba la suscripción tampoco disparaba `onStart()`: se seguía
   * jugando sobre un tablero limpio conservando la puntuación. O sea, salir y
   * volver era un "reinicio gratis" que dejaba farmear puntos sin límite.
   *
   * Una partida sin su tablero no se puede continuar, así que se descarta y se
   * vuelve al menú. El récord no se pierde: `best` es histórico y va aparte.
   */
  private descartarPartidaHuerfana() {
    const st = useGameStore.getState();
    if (st.status === 'playing' || st.status === 'paused') st.reset();
    // el espejo VIP también persiste: dejaba el festival encendido al volver
    this.director.endRun();
  }

  // ---------- ciclo ----------

  private tick(dtMs: number) {
    if (this.disposed) return;
    const st = useGameStore.getState();

    if (st.status === 'playing') {
      this.runMs += dtMs;
      // la rampa sube con los minutos; KOYA la baja, el festival la sube algo
      this.physics.engine.gravity.y =
        PHYSICS.gravityY * this.director.gravityFactor() * this.rampaGravedad();
      this.physics.update(dtMs);
      this.director.update(dtMs);
      this.updateDefeat(dtMs);
      this.updateAutoDrop(dtMs);
      this.updateAim();
    }

    this.renderer.sync(this.physics.pieces);
    if (this.renderer.debugVisible) {
      this.renderer.drawDebug(this.physics.pieces, this.physics.walls);
    }
  }

  /**
   * Multiplicador de gravedad por tiempo jugado: 1 al empezar, sube lineal
   * hasta `RAMPA.maxGravityMul` a los `RAMPA.fullAtMs` y ahí se queda.
   */
  private rampaGravedad(): number {
    const avance = Math.min(1, this.runMs / RAMPA.fullAtMs);
    return 1 + (RAMPA.maxGravityMul - 1) * avance;
  }

  /**
   * Cuenta el tiempo que la ficha lleva sin lanzarse (solo con el juego
   * corriendo y la ficha lista). A los `autoDropMs` se lanza sola desde la
   * puntería actual. Pausar congela la cuenta.
   */
  private updateAutoDrop(dtMs: number) {
    if (this.dropLocked) return;
    this.autoDropMs += dtMs;
    if (this.autoDropMs >= RULES.autoDropMs) this.drop();
  }

  private updateAim() {
    const st = useGameStore.getState();
    if (this.dropLocked || st.status !== 'playing') {
      this.renderer.hideAim();
      return;
    }
    this.renderer.showAim(this.aimX, st.currentTier, this.autoDropMs / RULES.autoDropMs);
  }

  /**
   * Una sola vida. Dos formas de perder:
   * - una pieza se SALE del rectángulo -> fin inmediato
   * - una pieza asentada NO CABE (sobresale por la línea) durante la gracia
   */
  private updateDefeat(dtMs: number) {
    // el muestrario apila piezas que no caben a propósito: no se pierde
    if (this.inspeccion) return;

    if (this.physics.escapedPieces().length > 0) {
      this.endRun();
      return;
    }

    const over = this.physics.piecesOverLine(DANGER_Y).length > 0;

    if (over && !this.dangerActive) {
      this.dangerActive = true;
      this.dangerMs = 0;
      this.dangerBeep = 0;
      this.renderer.setDanger(true);
    } else if (!over && this.dangerActive) {
      this.dangerActive = false;
      this.dangerMs = 0;
      this.renderer.setDanger(false);
      this.renderer.showDangerCountdown(null);
    }

    if (!this.dangerActive) return;

    this.dangerMs += dtMs;
    const restante = RULES.dangerGraceMs - this.dangerMs;
    if (restante <= 0) {
      this.endRun();
      return;
    }

    // Aviso para que dé tiempo a reaccionar: cuenta atrás en pantalla y un
    // toque por segundo, que en el móvil es lo que de verdad se nota.
    this.renderer.showDangerCountdown(restante);
    const segundo = Math.ceil(restante / 1000);
    if (segundo !== this.dangerBeep) {
      this.dangerBeep = segundo;
      play('combo');
      haptic(25);
    }
  }

  private endRun() {
    this.dangerActive = false;
    this.renderer.setDanger(false);
    this.renderer.showDangerCountdown(null);
    this.renderer.hideAim();
    play('gameover');
    haptic(60);
    useGameStore.getState().gameOver();
  }

  private onStart() {
    unlockAudio();
    this.clearBoard();
    this.director.startRun();
  }

  private clearBoard() {
    this.physics.clearPieces();
    this.runMs = 0;
    this.dangerActive = false;
    this.dangerMs = 0;
    this.dangerBeep = 0;
    this.inspeccion = false;
    this.flechas = [];
    this.dropLocked = false;
    this.autoDropMs = 0;
    this.renderer.setDanger(false);
    this.renderer.showDangerCountdown(null);
  }

  // ---------- soltar pieza ----------

  private drop() {
    const st = useGameStore.getState();
    if (st.status !== 'playing' || this.dropLocked) return;
    const now = performance.now();
    if (now - this.lastDropAt < RULES.dropCooldownMs) return;
    this.lastDropAt = now;
    this.autoDropMs = 0;

    // en festival, la cola se carga hacia comidas de nivel más alto
    const tier = st.advanceQueue(
      this.director.festivalActive ? VIP.festival.spawnWeights : undefined
    );
    const r = tierAt(tier).radius;
    /*
     * Micro-desvío al soltar: la puntería no se mueve sola entre lanzamientos,
     * así que sin esto dos fichas seguidas caen en la MISMA vertical exacta y
     * se apilan en equilibrio perfecto. Es poco más de un píxel — no se nota
     * al apuntar, pero basta para que el contacto no sea perfectamente
     * centrado y la pila se acomode como lo haría de verdad.
     */
    const desvio = (Math.random() - 0.5) * PHYSICS.spawnJitter;
    const x = Math.max(
      BOARD_LEFT + r + 2,
      Math.min(BOARD_RIGHT - r - 2, this.aimX + desvio)
    );

    const body = this.physics.spawn(tier, x, DESIGN.dropY);
    st.unlockTier(tier);
    play('drop');
    haptic(8);

    // un plato soltado también puede satisfacer el pedido del cliente
    this.director.onPieceCreated(tier, body);

    this.dropLocked = true;
    this.renderer.hideAim();
    gsap.delayedCall(RULES.dropCooldownMs / 1000, () => {
      this.dropLocked = false;
    });
  }

  private handleMerge(e: MergeEvent) {
    const store = useGameStore.getState();
    const tier = tierAt(e.newTier);
    const combo = store.registerMerge(e.newTier);

    const bonus = Math.min(
      RULES.comboMaxMul,
      1 + Math.max(0, combo - 1) * RULES.comboStep
    );
    // RJ (x2), Fever de TATA y el festival multiplican los puntos
    const gained = Math.round(tier.points * bonus * this.director.scoreMultiplier());
    store.addScore(gained);

    this.renderer.burst(e.x, e.y, colorOf(tier.palette.accent), 12 + e.newTier);
    this.renderer.floatScore(e.x, e.y, gained);
    play('merge', e.newTier);
    if (combo >= 2) play('combo', combo);
    haptic(14);

    if (e.newTier === MAX_TIER) {
      this.celebrateSupreme(e.body);
      return;
    }

    // ¿era el plato que esperaba el cliente VIP?
    this.director.onPieceCreated(e.newTier, e.body);
  }

  /**
   * Crear el Sugu Supreme no termina la partida ni limpia el tablero: se
   * celebra y la pieza SE QUEDA, ocupando su sitio y con el aro dorado que la
   * distingue. Para sacarla del tablero hay que juntar dos.
   */
  private celebrateSupreme(body: SuguBody) {
    play('festival');
    haptic(30);
    this.renderer.confetti(30);
    const { x, y } = body.position;
    this.renderer.flash(x, y, 0xf2c14e, tierAt(MAX_TIER).radius + 24);
  }

  /** Dos Supreme juntos: se anulan, y es el mayor premio de la partida. */
  private handleSupremePair({ x, y }: { x: number; y: number }) {
    const puntos = Math.round(RULES.supremePairPoints * this.director.scoreMultiplier());
    useGameStore.getState().addScore(puntos);

    play('win');
    haptic(60);
    this.renderer.floatScore(x, y, puntos);
    this.renderer.flash(x, y, 0xf2c14e, tierAt(MAX_TIER).radius + 44);
    this.renderer.burst(x, y, 0xf2c14e, 34);
    this.renderer.confetti(34);
  }

  /**
   * Piezas creadas por poderes (CHIMMY evoluciona, COOKY regala): cuentan
   * para la colección y pueden llegar a crear el Supreme.
   */
  private handleSpecialCreate(tier: number, body: SuguBody) {
    const store = useGameStore.getState();
    store.unlockTier(tier);
    if (tier === MAX_TIER) {
      this.celebrateSupreme(body);
      return;
    }
    this.director.onPieceCreated(tier, body);
  }

  // ---------- input ----------

  private bindInput() {
    const c = this.renderer.app.canvas;
    c.addEventListener('pointerdown', this.onPointerDown);
    c.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.alFlecha);
    document.addEventListener('visibilitychange', this.alOcultarse);
    c.style.touchAction = 'none';
  }

  private unbindInput() {
    const c = this.renderer.app?.canvas;
    c?.removeEventListener('pointerdown', this.onPointerDown);
    c?.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.alFlecha);
    document.removeEventListener('visibilitychange', this.alOcultarse);
  }

  // ---------- muestrario de colisiones ----------

  /** ↑ ↑ ↓ ↓ ← ← → → */
  private static COMBO = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowRight',
    'ArrowRight',
  ];

  private alFlecha = (e: KeyboardEvent) => {
    if (!e.key.startsWith('Arrow')) return;
    const combo = SuguGame.COMBO;

    this.flechas.push(e.key);
    if (this.flechas.length > combo.length) this.flechas.shift();
    if (this.flechas.length < combo.length) return;
    if (!combo.every((k, i) => this.flechas[i] === k)) return;

    this.flechas = [];
    this.mostrarMuestrario();
  };

  /**
   * Vacía el tablero y coloca UNA pieza de cada tier, empaquetadas de mayor a
   * menor desde el suelo, con la vista de colliders encendida.
   *
   * Las posiciones se calculan con el radio del COLLIDER, no con el del
   * dibujo: así las piezas quedan justo tocándose y se ve de un vistazo cuánto
   * se solapan los sprites con el `hitScale` de cada una.
   *
   * Mientras el muestrario está abierto no se sueltan fichas ni se puede
   * perder — es para mirar, no para jugar. Se sale empezando otra partida.
   */
  private mostrarMuestrario() {
    if (useGameStore.getState().status !== 'playing') return;

    this.physics.clearPieces();
    this.inspeccion = true;
    this.dropLocked = true;
    this.dangerActive = false;
    this.dangerMs = 0;
    this.renderer.setDanger(false);
    this.renderer.showDangerCountdown(null);
    this.renderer.hideAim();
    this.renderer.setDebug(true);

    const margen = 4;
    const ancho = DESIGN.board.w - margen * 2;
    const diametro = (tier: number) => hitRadius(tier) * 2;
    const anchoFila = (fila: number[]) => fila.reduce((s, t) => s + diametro(t), 0);

    // de mayor a menor, cada pieza al primer renglón donde quepa
    const filas: number[][] = [];
    for (const tier of TIERS.map((t) => t.index).sort((a, b) => diametro(b) - diametro(a))) {
      const fila = filas.find((f) => anchoFila(f) + diametro(tier) <= ancho);
      if (fila) fila.push(tier);
      else filas.push([tier]);
    }

    // los renglones se apilan desde el suelo, el más alto abajo
    let base = BOARD_BOTTOM;
    for (const fila of filas) {
      const alto = Math.max(...fila.map(diametro));
      let x = BOARD_LEFT + margen + (ancho - anchoFila(fila)) / 2;
      for (const tier of fila) {
        const r = hitRadius(tier);
        this.physics.spawn(tier, x + r, base - alto / 2);
        x += r * 2;
      }
      base -= alto;
    }
  }

  /**
   * Bloquear el móvil, atender una llamada o cambiar de app deja al navegador
   * sin `requestAnimationFrame`: el juego se congela en mitad de la partida.
   * Se pausa solo para volver a la ventana de pausa, no a un tablero muerto.
   */
  private alOcultarse = () => {
    if (document.visibilityState !== 'hidden') return;
    const st = useGameStore.getState();
    if (st.status === 'playing') st.pause();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (useGameStore.getState().status !== 'playing') return;
    const p = this.renderer.toDesign(e.clientX, e.clientY);
    this.pointerActive = true;
    this.aimX = p.x;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (useGameStore.getState().status !== 'playing') return;
    if (!this.pointerActive) return;
    this.aimX = this.renderer.toDesign(e.clientX, e.clientY).x;
  };

  private onPointerUp = () => {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    this.drop();
  };
}

function colorOf(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
