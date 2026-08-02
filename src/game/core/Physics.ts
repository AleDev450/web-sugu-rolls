import {
  Bodies,
  Body,
  Composite,
  Engine,
  Events,
  type IEventCollision,
} from 'matter-js';
import {
  BOARD_BOTTOM,
  BOARD_LEFT,
  BOARD_RIGHT,
  BOARD_TOP,
  DESIGN,
  PHYSICS,
  RULES,
} from '@/game/config/layout';
import { MAX_TIER, hitRadius, tierAt } from '@/game/config/tiers';

export interface PieceData {
  uid: number;
  tier: number;
  bornAt: number;
  /** marcada para desaparecer en este paso — evita fusiones dobles */
  consumed: boolean;
}

export type SuguBody = Body & { sugu: PieceData };

export interface MergeEvent {
  tier: number;
  newTier: number;
  x: number;
  y: number;
  /** el cuerpo recién creado — los clientes VIP pueden llevárselo */
  body: SuguBody;
}

export interface PhysicsCallbacks {
  onMerge: (e: MergeEvent) => void;
}

/**
 * Mundo físico. No sabe nada de render ni de UI: emite eventos y expone
 * cuerpos. El renderer los lee cada frame; el store reacciona a los eventos.
 */
export class Physics {
  readonly engine: Engine;
  private uid = 0;
  private cbs: PhysicsCallbacks;
  /** factor sobre la restitución base (VAN lo baja temporalmente) */
  private restitutionFactor = 1;

  constructor(cbs: PhysicsCallbacks) {
    this.cbs = cbs;
    this.engine = Engine.create({
      gravity: { x: 0, y: PHYSICS.gravityY, scale: 0.001 },
      positionIterations: PHYSICS.positionIterations,
      velocityIterations: PHYSICS.velocityIterations,
    });
    this.buildWalls();
    Events.on(this.engine, 'collisionStart', this.handleCollisions);
  }

  private buildWalls() {
    const t = PHYSICS.wallThickness;
    const w = DESIGN.board.w;
    const h = DESIGN.board.h;
    const opts = { isStatic: true, restitution: 0.05, friction: PHYSICS.friction };

    const floor = Bodies.rectangle(BOARD_LEFT + w / 2, BOARD_BOTTOM + t / 2, w + t * 2, t, {
      ...opts,
      label: 'floor',
    });
    const left = Bodies.rectangle(BOARD_LEFT - t / 2, BOARD_TOP + h / 2, t, h * 2, {
      ...opts,
      label: 'wall-left',
    });
    const right = Bodies.rectangle(BOARD_RIGHT + t / 2, BOARD_TOP + h / 2, t, h * 2, {
      ...opts,
      label: 'wall-right',
    });

    Composite.add(this.engine.world, [floor, left, right]);
  }

  // ---------- ciclo ----------

  /** `dtMs` viene del ticker; se acota para que un tab en background no explote. */
  update(dtMs: number) {
    Engine.update(this.engine, Math.min(dtMs, 32));
  }

  destroy() {
    Events.off(this.engine, 'collisionStart', this.handleCollisions);
    Composite.clear(this.engine.world, false, true);
    Engine.clear(this.engine);
  }

  // ---------- piezas ----------

  get pieces(): SuguBody[] {
    return Composite.allBodies(this.engine.world).filter(
      (b): b is SuguBody => !b.isStatic && 'sugu' in b
    );
  }

  /** Paredes y suelo. Solo lo usa la vista de depuración. */
  get walls(): Body[] {
    return Composite.allBodies(this.engine.world).filter((b) => b.isStatic);
  }

  /**
   * Cambia el rebote de TODAS las piezas (las presentes y las que nazcan
   * mientras dure el factor). `1` restaura el valor base.
   */
  setRestitutionFactor(f: number) {
    this.restitutionFactor = f;
    for (const b of this.pieces) b.restitution = PHYSICS.restitution * f;
  }

  spawn(tier: number, x: number, y: number): SuguBody {
    const t = tierAt(tier);
    const body = Bodies.circle(x, y, hitRadius(tier), {
      restitution: PHYSICS.restitution * this.restitutionFactor,
      friction: PHYSICS.friction,
      frictionStatic: PHYSICS.frictionStatic,
      frictionAir: PHYSICS.frictionAir,
      density: PHYSICS.density,
      label: `sushi-${t.id}`,
    }) as SuguBody;

    body.sugu = {
      uid: ++this.uid,
      tier,
      bornAt: performance.now(),
      consumed: false,
    };

    Composite.add(this.engine.world, body);
    return body;
  }

  remove(body: SuguBody) {
    body.sugu.consumed = true;
    Composite.remove(this.engine.world, body);
  }

  clearPieces() {
    for (const b of this.pieces) Composite.remove(this.engine.world, b);
  }

  // ---------- fusiones ----------

  private handleCollisions = (evt: IEventCollision<Engine>) => {
    for (const pair of evt.pairs) {
      const a = pair.bodyA as SuguBody;
      const b = pair.bodyB as SuguBody;
      if (!('sugu' in a) || !('sugu' in b)) continue;
      if (a.sugu.consumed || b.sugu.consumed) continue;
      if (a.sugu.tier !== b.sugu.tier) continue;
      if (a.sugu.tier >= MAX_TIER) continue;

      const tier = a.sugu.tier;
      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;

      // Heredar algo de inercia para que la pieza nueva no quede clavada.
      const vx = (a.velocity.x + b.velocity.x) / 2;
      const vy = (a.velocity.y + b.velocity.y) / 2;

      this.remove(a);
      this.remove(b);

      const merged = this.spawn(tier + 1, x, y);
      Body.setVelocity(merged, { x: vx, y: vy });

      this.cbs.onMerge({ tier, newTier: tier + 1, x, y, body: merged });
    }
  };

  // ---------- condiciones de derrota ----------

  /**
   * "No puede ingresar": piezas asentadas cuya parte superior queda por encima
   * de la línea — la caja está llena y la pieza ya no cabe dentro.
   * Se ignoran las recién nacidas, que todavía están cayendo.
   */
  piecesOverLine(lineY: number): SuguBody[] {
    const now = performance.now();
    return this.pieces.filter((b) => {
      if (now - b.sugu.bornAt < RULES.dangerImmunityMs) return false;
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      if (speed > PHYSICS.restSpeed) return false;
      return b.position.y - hitRadius(b.sugu.tier) < lineY;
    });
  }

  /**
   * "Se sale": el centro de una pieza quedó fuera del rectángulo de la caja
   * (rebotó por encima de una pared, o algo la expulsó). Derrota inmediata.
   */
  escapedPieces(): SuguBody[] {
    const now = performance.now();
    const m = RULES.escapeMargin;
    return this.pieces.filter((b) => {
      if (now - b.sugu.bornAt < RULES.dangerImmunityMs) return false;
      return (
        b.position.x < BOARD_LEFT - m ||
        b.position.x > BOARD_RIGHT + m ||
        b.position.y > BOARD_BOTTOM + m
      );
    });
  }
}
