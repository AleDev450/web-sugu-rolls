import gsap from 'gsap';
import { Physics, type MergeEvent, type SuguBody } from './Physics';
import { Renderer } from './Renderer';
import { VipDirector } from './VipDirector';
import { loadGameAssets } from '@/game/assets/loader';
import { play, haptic, unlockAudio } from '@/game/audio/audio';
import {
  BOARD_LEFT,
  BOARD_RIGHT,
  DANGER_Y,
  DESIGN,
  PHYSICS,
  RULES,
} from '@/game/config/layout';
import { MAX_TIER, tierAt } from '@/game/config/tiers';
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

  private dangerSince = 0;
  private dangerActive = false;

  private disposed = false;
  private unsubStatus?: () => void;

  async init(host: HTMLDivElement) {
    await loadGameAssets();
    await this.renderer.init(host);

    this.physics = new Physics({
      onMerge: (e) => this.handleMerge(e),
    });

    this.director = new VipDirector({
      physics: this.physics,
      renderer: this.renderer,
      onSpecialCreate: (tier, body) => this.handleSpecialCreate(tier, body),
    });

    this.renderer.setDanger(false);
    this.bindInput();

    this.unsubStatus = useGameStore.subscribe((s, prev) => {
      if (s.status === 'playing' && prev.status === 'idle') this.onStart();
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

  // ---------- ciclo ----------

  private tick(dtMs: number) {
    if (this.disposed) return;
    const st = useGameStore.getState();
    const now = performance.now();

    if (st.status === 'playing') {
      // KOYA baja la gravedad; el festival la sube un poco
      this.physics.engine.gravity.y = PHYSICS.gravityY * this.director.gravityFactor();
      this.physics.update(dtMs);
      this.director.update(dtMs);
      this.updateDefeat(now);
      this.updateAutoDrop(dtMs);
      this.updateAim();
    }

    this.renderer.sync(this.physics.pieces);
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
  private updateDefeat(now: number) {
    if (this.physics.escapedPieces().length > 0) {
      this.endRun();
      return;
    }

    const over = this.physics.piecesOverLine(DANGER_Y).length > 0;

    if (over && !this.dangerActive) {
      this.dangerActive = true;
      this.dangerSince = now;
      this.renderer.setDanger(true);
    } else if (!over && this.dangerActive) {
      this.dangerActive = false;
      this.dangerSince = 0;
      this.renderer.setDanger(false);
    }

    if (this.dangerActive && now - this.dangerSince > RULES.dangerGraceMs) {
      this.endRun();
    }
  }

  private endRun() {
    this.dangerActive = false;
    this.renderer.setDanger(false);
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
    this.dangerActive = false;
    this.dangerSince = 0;
    this.dropLocked = false;
    this.autoDropMs = 0;
    this.renderer.setDanger(false);
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
    const x = Math.max(BOARD_LEFT + r + 2, Math.min(BOARD_RIGHT - r - 2, this.aimX));

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

    const bonus = 1 + Math.max(0, combo - 1) * 0.5;
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
   * Crear el Sugu Supreme no termina la partida: se celebra, la pieza
   * desaparece del tablero y se sigue jugando. Solo se pierde cuando la caja
   * se desborda.
   */
  private celebrateSupreme(body: SuguBody) {
    play('festival');
    haptic(30);
    this.renderer.confetti(30);
    gsap.delayedCall(0.6, () => {
      if (this.disposed || body.sugu.consumed) return;
      const { x, y } = body.position;
      this.physics.remove(body);
      this.renderer.burst(x, y, 0xf2c14e, 26);
      this.renderer.flash(x, y, 0xf2c14e, tierAt(MAX_TIER).radius + 24);
    });
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
    c.style.touchAction = 'none';
  }

  private unbindInput() {
    const c = this.renderer.app?.canvas;
    c?.removeEventListener('pointerdown', this.onPointerDown);
    c?.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

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
