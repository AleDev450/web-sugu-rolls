import { Body } from 'matter-js';
import type { Physics, SuguBody } from './Physics';
import type { Renderer } from './Renderer';
import { BT21, type Bt21Char } from '@/game/config/bt21';
import { VIP, rollOrderTier, rollCookyTier } from '@/game/config/vip';
import { BOARD_LEFT, DESIGN } from '@/game/config/layout';
import { MAX_TIER, tierAt } from '@/game/config/tiers';
import { useGameStore } from '@/store/useGameStore';
import { useVipStore } from '@/store/useVipStore';
import { play, haptic, setMusicRate } from '@/game/audio/audio';

interface DirectorDeps {
  physics: Physics;
  renderer: Renderer;
  /**
   * Un poder creó/regaló una pieza fuera del flujo normal de fusiones
   * (CHIMMY evoluciona, COOKY regala). El motor decide qué implica:
   * desbloquear en la colección, victoria si aparece el Supreme, etc.
   */
  onSpecialCreate: (tier: number, body: SuguBody) => void;
}

interface ActiveVisit {
  char: Bt21Char;
  tier: number;
  waitMs: number;
  remainingMs: number;
  phase: 'enter' | 'waiting' | 'happy' | 'sad';
  /** ms transcurridos en la fase actual */
  phaseMs: number;
}

/**
 * Dirige la mecánica de clientes VIP: agenda visitas, vigila el pedido,
 * activa poderes y orquesta el BTS Festival.
 *
 * Todos los tiempos son contadores en ms que SOLO avanzan cuando el juego
 * llama a `update()` (es decir, con status === 'playing'): pausar congela
 * pedidos, poderes y festival sin contabilidad extra.
 *
 * La UI (VipBar) no se entera de nada de esto directamente: el director
 * escribe un espejo quantizado en useVipStore y React solo dibuja.
 */
export class VipDirector {
  private deps: DirectorDeps;

  private visit: ActiveVisit | null = null;
  private untilNextVisitMs: number = VIP.firstVisitDelayMs;

  /** poderes temporales activos (ms restantes) */
  private fx = { koyaMs: 0, rjMs: 0, feverMs: 0, vanMs: 0 };

  private festivalMs = 0;
  private festivalPendingMs = 0;
  private confettiCdMs = 0;

  private seq = 0;

  // últimos valores espejados, para no escribir el store cada frame
  private mirroredRemaining = -1;
  private mirroredFestival = -1;
  private mirroredFx = { koya: -1, rj: -1, fever: -1, van: -1 };

  constructor(deps: DirectorDeps) {
    this.deps = deps;
  }

  // ---------- ciclo de vida de la partida ----------

  startRun() {
    this.visit = null;
    this.untilNextVisitMs = VIP.firstVisitDelayMs;
    this.fx = { koyaMs: 0, rjMs: 0, feverMs: 0, vanMs: 0 };
    this.deps.physics.setRestitutionFactor(1);
    this.festivalMs = 0;
    this.festivalPendingMs = 0;
    this.confettiCdMs = 0;
    this.mirroredRemaining = -1;
    this.mirroredFestival = -1;
    this.mirroredFx = { koya: -1, rj: -1, fever: -1, van: -1 };
    useVipStore.getState().resetRun();
  }

  /** Fin de partida o salida al menú: se limpia todo y la música vuelve a 1x. */
  endRun() {
    this.visit = null;
    this.fx = { koyaMs: 0, rjMs: 0, feverMs: 0, vanMs: 0 };
    this.deps.physics.setRestitutionFactor(1);
    this.festivalMs = 0;
    this.festivalPendingMs = 0;
    setMusicRate(1);
    useVipStore.getState().resetRun();
  }

  // ---------- lo que el motor consulta cada frame ----------

  /** Multiplicador de puntos vigente (RJ × Fever × Festival). */
  scoreMultiplier(): number {
    let m = 1;
    if (this.fx.rjMs > 0) m *= VIP.powers.rjMul;
    if (this.fx.feverMs > 0) m *= VIP.powers.feverMul;
    if (this.festivalMs > 0) m *= VIP.festival.scoreMul;
    return m;
  }

  /** Factor sobre la gravedad base (KOYA la baja, el festival la sube). */
  gravityFactor(): number {
    let f = 1;
    if (this.fx.koyaMs > 0) f *= VIP.powers.koyaGravityMul;
    if (this.festivalMs > 0) f *= VIP.festival.gravityMul;
    return f;
  }

  get festivalActive(): boolean {
    return this.festivalMs > 0;
  }

  /**
   * Una pieza acaba de crearse (fusión o soltada desde la cola). Si coincide
   * con el pedido activo, el cliente se la lleva.
   */
  onPieceCreated(tier: number, body: SuguBody) {
    if (!this.visit || this.visit.phase !== 'waiting') return;
    if (tier !== this.visit.tier) return;
    this.fulfill(body);
  }

  // ---------- tick (solo con status === 'playing') ----------

  update(dtMs: number) {
    this.updateEffects(dtMs);
    this.updateFestival(dtMs);
    this.updateVisit(dtMs);
  }

  private updateEffects(dtMs: number) {
    this.fx.koyaMs = Math.max(0, this.fx.koyaMs - dtMs);
    this.fx.rjMs = Math.max(0, this.fx.rjMs - dtMs);
    this.fx.feverMs = Math.max(0, this.fx.feverMs - dtMs);

    if (this.fx.vanMs > 0) {
      this.fx.vanMs = Math.max(0, this.fx.vanMs - dtMs);
      // al expirar VAN, el rebote vuelve a la normalidad
      if (this.fx.vanMs === 0) this.deps.physics.setRestitutionFactor(1);
    }

    const secs = {
      koya: Math.ceil(this.fx.koyaMs / 1000),
      rj: Math.ceil(this.fx.rjMs / 1000),
      fever: Math.ceil(this.fx.feverMs / 1000),
      van: Math.ceil(this.fx.vanMs / 1000),
    };
    const m = this.mirroredFx;
    if (
      secs.koya !== m.koya ||
      secs.rj !== m.rj ||
      secs.fever !== m.fever ||
      secs.van !== m.van
    ) {
      this.mirroredFx = secs;
      useVipStore.getState().setEffects(secs);
    }
  }

  private updateFestival(dtMs: number) {
    if (this.festivalPendingMs > 0) {
      this.festivalPendingMs -= dtMs;
      if (this.festivalPendingMs <= 0) this.startFestival();
    }

    if (this.festivalMs <= 0) return;
    this.festivalMs -= dtMs;

    this.confettiCdMs -= dtMs;
    if (this.confettiCdMs <= 0) {
      this.confettiCdMs = VIP.festival.confettiEveryMs;
      this.deps.renderer.confetti();
    }

    if (this.festivalMs <= 0) {
      this.endFestival();
      return;
    }

    const q = Math.ceil(this.festivalMs / 100) * 100;
    if (q !== this.mirroredFestival) {
      this.mirroredFestival = q;
      useVipStore.getState().setFestival(true, q);
    }
  }

  private updateVisit(dtMs: number) {
    const v = this.visit;

    if (!v) {
      // sin cliente: corre el reloj hasta la próxima visita (nunca en festival)
      if (this.festivalMs > 0 || this.festivalPendingMs > 0) return;
      this.untilNextVisitMs -= dtMs;
      if (this.untilNextVisitMs <= 0) this.arrive();
      return;
    }

    v.phaseMs += dtMs;

    if (v.phase === 'enter') {
      if (v.phaseMs >= VIP.enterMs) this.setPhase('waiting');
      return;
    }

    if (v.phase === 'waiting') {
      v.remainingMs -= dtMs;
      if (v.remainingMs <= 0) {
        v.remainingMs = 0;
        this.setPhase('sad');
        play('vip_sad');
        return;
      }
      const q = Math.ceil(v.remainingMs / 100) * 100;
      if (q !== this.mirroredRemaining) {
        this.mirroredRemaining = q;
        useVipStore.getState().patchVisit({ remainingMs: q });
      }
      return;
    }

    // happy / sad: espera a que termine la animación de salida
    if (v.phaseMs >= VIP.leaveMs) {
      this.visit = null;
      useVipStore.getState().setVisit(null);
      const [a, b] = VIP.nextVisitDelayMs;
      this.untilNextVisitMs = a + Math.random() * (b - a);
    }
  }

  private setPhase(phase: ActiveVisit['phase']) {
    if (!this.visit) return;
    this.visit.phase = phase;
    this.visit.phaseMs = 0;
    useVipStore.getState().patchVisit({ phase });
  }

  // ---------- visitas ----------

  private arrive() {
    const score = useGameStore.getState().score;
    const char = this.pickChar();
    const tier = rollOrderTier(score);
    const waitMs = VIP.waitMs(tier);

    this.visit = { char, tier, waitMs, remainingMs: waitMs, phase: 'enter', phaseMs: 0 };
    this.mirroredRemaining = -1;
    useVipStore.getState().setVisit({
      seq: ++this.seq,
      charId: char.id,
      tier,
      waitMs,
      remainingMs: waitMs,
      phase: 'enter',
    });
    play('vip_arrive');
    haptic(10);
  }

  /** Prefiere personajes aún no atendidos, para que la colección avance. */
  private pickChar(): Bt21Char {
    const served = useVipStore.getState().served;
    const unserved = BT21.filter((c) => !served.includes(c.id));
    if (unserved.length > 0 && Math.random() < VIP.preferUnservedProb) {
      return unserved[(Math.random() * unserved.length) | 0];
    }
    return BT21[(Math.random() * BT21.length) | 0];
  }

  private fulfill(body: SuguBody) {
    const v = this.visit!;
    const { x, y } = body.position;

    // el cliente se lleva el plato: la pieza sale del tablero y vuela hacia él
    this.deps.physics.remove(body);
    this.deps.renderer.flyTo(x, y, v.tier, VIP.standX, VIP.standY);

    const pts = VIP.rewardPoints(v.tier);
    useGameStore.getState().addScore(pts);
    this.deps.renderer.floatScore(x, y, pts);
    play('vip_serve');
    haptic(20);

    this.setPhase('happy');
    const vip = useVipStore.getState();
    vip.markServed(v.char.id);

    this.activatePower(v.char);

    // ¿colección completa? — el festival arranca tras un respiro
    if (useVipStore.getState().served.length >= BT21.length) {
      this.festivalPendingMs = 900;
    }
  }

  // ---------- poderes ----------

  private activatePower(char: Bt21Char) {
    const { physics, renderer } = this.deps;
    const colorNum = parseInt(char.color.replace('#', ''), 16);
    renderer.flash(VIP.standX, VIP.standY, colorNum, 46);
    play('power');
    useVipStore.getState().showPowerToast(char.id, char.powerName);

    switch (char.power) {
      case 'low-gravity':
        this.fx.koyaMs = VIP.powers.koyaMs;
        break;

      case 'double-score':
        this.fx.rjMs = VIP.powers.rjMs;
        break;

      case 'fever':
        this.fx.feverMs = VIP.powers.feverMs;
        break;

      case 'calm-bounce':
        this.fx.vanMs = VIP.powers.vanMs;
        physics.setRestitutionFactor(VIP.powers.vanRestitutionMul);
        break;

      case 'clear-small': {
        /*
         * CHIMMY rescata la pieza pequeña MÁS ENTERRADA (onigiri o gyoza).
         *
         * Las pequeñas de arriba las puede fusionar el jugador; las que quedan
         * atrapadas al fondo entre piezas grandes son peso muerto que ya no se
         * puede juntar con nada. Sacar una de ahí es un rescate de verdad y,
         * de paso, todo lo de encima baja y compacta la pila.
         *
         * Si ya no queda ninguna pequeña, cae al tier más bajo que haya —
         * también la más enterrada— para que el poder nunca salga en blanco.
         */
        const piezas = physics.pieces;
        if (piezas.length === 0) break;

        const tierMin = Math.min(...piezas.map((b) => b.sugu.tier));
        const limite = Math.max(tierMin, 1);
        const candidatas = piezas.filter((b) => b.sugu.tier <= limite);

        // la más enterrada = la de mayor y (más abajo en pantalla)
        const target = candidatas.reduce((peor, b) =>
          b.position.y > peor.position.y ? b : peor
        );

        renderer.flash(target.position.x, target.position.y, colorNum, 40);
        physics.remove(target);
        break;
      }

      case 'tidy-center': {
        const cx = BOARD_LEFT + DESIGN.board.w / 2;
        for (const b of physics.pieces) {
          const dx = cx - b.position.x;
          const push = Math.max(
            -VIP.powers.mangPush,
            Math.min(VIP.powers.mangPush, dx * 0.02)
          );
          Body.setVelocity(b, { x: b.velocity.x + push, y: b.velocity.y - 0.9 });
        }
        break;
      }

      case 'evolve-random': {
        const candidates = physics.pieces.filter((b) => b.sugu.tier < MAX_TIER);
        if (candidates.length === 0) break;
        const target = candidates[(Math.random() * candidates.length) | 0];
        const { x, y } = target.position;
        const newTier = target.sugu.tier + 1;
        physics.remove(target);
        const evolved = physics.spawn(newTier, x, y);
        renderer.flash(x, y, 0xf2c14e, tierAt(newTier).radius + 22);
        this.deps.onSpecialCreate(newTier, evolved);
        break;
      }

      case 'gift-food': {
        const tier = rollCookyTier();
        const r = tierAt(tier).radius;
        const x = BOARD_LEFT + r + 6 + Math.random() * (DESIGN.board.w - 2 * (r + 6));
        const gift = physics.spawn(tier, x, DESIGN.dropY);
        // "aparece suavemente": entra flotando, la gravedad hace el resto
        Body.setVelocity(gift, { x: 0, y: 0.5 });
        renderer.flash(x, DESIGN.dropY, colorNum, r + 16);
        this.deps.onSpecialCreate(tier, gift);
        break;
      }
    }
  }

  // ---------- festival ----------

  private startFestival() {
    this.festivalPendingMs = 0;
    this.festivalMs = VIP.festival.durationMs;
    this.mirroredFestival = -1;
    useVipStore.getState().setFestival(true, this.festivalMs);
    play('festival');
    haptic(40);
    setMusicRate(VIP.festival.musicRate);
    this.deps.renderer.confetti(44);
    this.confettiCdMs = VIP.festival.confettiEveryMs;
  }

  private endFestival() {
    this.festivalMs = 0;
    const vip = useVipStore.getState();
    vip.setFestival(false, 0);
    // la colección se reinicia: se puede volver a desbloquear el festival
    vip.clearServed();
    setMusicRate(1);
    this.untilNextVisitMs = VIP.festival.afterDelayMs;
  }
}
