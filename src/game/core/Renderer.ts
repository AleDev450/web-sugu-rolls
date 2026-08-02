import { Application, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import gsap from 'gsap';
import {
  BOARD_BOTTOM,
  BOARD_LEFT,
  BOARD_RIGHT,
  BOARD_TOP,
  DANGER_Y,
  DESIGN,
} from '@/game/config/layout';
import { tierAt } from '@/game/config/tiers';
import { getTierTexture } from '@/game/art/textures';
import { getTexture } from '@/game/assets/loader';
import type { SuguBody } from './Physics';

/**
 * Capa de dibujo. Trabaja siempre en coordenadas de diseño (480x854) dentro de
 * `world`, y `world` se escala para encajar en el canvas real. Todo lo que
 * necesite convertir pantalla -> juego usa `toDesign()`.
 */

/**
 * Los sprites se dibujan apenas más grandes que su collider circular para
 * disimular el aire transparente del lienzo cuadrado. 2026-08-01: bajado de
 * 1.18 a 1.05 — con 18% las piezas se veían solapadas al apilarse.
 */
const SPRITE_SCALE = 1.05;
export class Renderer {
  app!: Application;
  private world = new Container();
  private bgLayer = new Container();
  private boardLayer = new Container();
  private pieceLayer = new Container();
  private fxLayer = new Container();
  private guideLayer = new Container();

  private boardGfx = new Graphics();
  private dangerGfx = new Graphics();
  private aimGfx = new Graphics();
  private ghost: Sprite | null = null;

  private sprites = new Map<number, Sprite>();
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  async init(host: HTMLDivElement) {
    this.app = new Application();
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      /*
       * Tamaño fijo, sin `resizeTo`: el host mide siempre el lienzo de diseño
       * y es el CSS quien lo escala (`transform` en `.phone`).
       *
       * `resizeTo` medía el host al arrancar y solo volvía a medirlo con un
       * `resize` de ventana. En móvil llegaba a medir antes de que el layout
       * estuviera listo y el canvas se quedaba diminuto en la esquina superior
       * izquierda: como el input se escucha sobre el canvas, solo se podía
       * apuntar dentro de ese trozo.
       */
      width: DESIGN.width,
      height: DESIGN.height,
    });
    host.appendChild(this.app.canvas);

    this.world.addChild(
      this.bgLayer,
      this.boardLayer,
      this.pieceLayer,
      this.guideLayer,
      this.fxLayer
    );
    this.app.stage.addChild(this.world);

    this.boardLayer.addChild(this.boardGfx, this.dangerGfx);
    this.guideLayer.addChild(this.aimGfx);

    this.drawBackground();
    this.drawGlass();
    this.layout();
    this.app.renderer.on('resize', () => this.layout());

    window.addEventListener('resize', this.alRedimensionar);
    window.addEventListener('orientationchange', this.alRedimensionar);
    this.alRedimensionar();
  }

  destroy() {
    window.removeEventListener('resize', this.alRedimensionar);
    window.removeEventListener('orientationchange', this.alRedimensionar);
    gsap.killTweensOf([...this.sprites.values()]);
    this.sprites.clear();
    this.app?.destroy(true, { children: true, texture: false });
  }

  // ---------- encuadre ----------

  /** Factor del `transform: scale()` que el CSS aplica al marco del juego. */
  private escalaCss(): number {
    const canvas = this.app?.canvas;
    const ancho = canvas?.clientWidth;
    if (!canvas || !ancho) return 1;
    return canvas.getBoundingClientRect().width / ancho;
  }

  /**
   * El marco se agranda con `transform: scale()`, así que un canvas de 480px
   * se estira en pantallas grandes. Subimos la resolución del renderer en la
   * misma proporción para que no se vea borroso (tope 3 para no reventar la
   * GPU en móviles de densidad alta).
   */
  private ajustarNitidez = () => {
    const canvas = this.app?.canvas;
    if (!canvas || !canvas.clientWidth) return;

    const deseada = Math.min((window.devicePixelRatio || 1) * this.escalaCss(), 3);
    if (Math.abs(deseada - this.app.renderer.resolution) < 0.05) return;

    this.app.renderer.resize(DESIGN.width, DESIGN.height, deseada);
  };

  /** El CSS recalcula `--fit` en el mismo evento: medimos en el frame siguiente. */
  private alRedimensionar = () => {
    requestAnimationFrame(this.ajustarNitidez);
  };

  private layout() {
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    this.scale = Math.min(w / DESIGN.width, h / DESIGN.height);
    this.offsetX = (w - DESIGN.width * this.scale) / 2;
    this.offsetY = (h - DESIGN.height * this.scale) / 2;
    this.world.scale.set(this.scale);
    this.world.position.set(this.offsetX, this.offsetY);
  }

  /**
   * Convierte un punto de la página a coordenadas de diseño.
   *
   * El rect ya viene multiplicado por el `transform: scale()` del marco, así
   * que hay que deshacerlo antes de aplicar el encuadre interno del canvas.
   */
  toDesign(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const css = this.escalaCss();
    return {
      x: ((clientX - rect.left) / css - this.offsetX) / this.scale,
      y: ((clientY - rect.top) / css - this.offsetY) / this.scale,
    };
  }

  // ---------- fondo ----------

  /**
   * Fondo de ambientación: /imagenes/fondos/background.webp (el único fondo,
   * por decisión del 2026-07-31), en modo "cover" sobre el lienzo de diseño,
   * con un velo suave para que las piezas sigan legibles.
   * Si no existe, se queda el degradado CSS del frame.
   */
  private drawBackground() {
    const tex = getTexture('fondos', 'background');
    if (!tex) return;

    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    const s = Math.max(DESIGN.width / tex.width, DESIGN.height / tex.height);
    sp.scale.set(s);
    sp.position.set(DESIGN.width / 2, DESIGN.height / 2);

    const dim = new Graphics()
      .rect(0, 0, DESIGN.width, DESIGN.height)
      .fill({ color: 0x1a120b, alpha: 0.3 });

    this.bgLayer.addChild(sp, dim);
  }

  // ---------- vitrina ----------

  /**
   * Fracciones del arte del vidrio (imagenes/ui/vidrio.webp) que corresponden
   * al hueco interior donde viven las piezas. Si se cambia el arte del vidrio
   * y no calza, se ajustan estos 4 números.
   */
  private static GLASS_INNER = { l: 0.073, r: 0.928, t: 0.12, b: 0.885 };

  /**
   * Vitrina con arte, dibujada DETRÁS de las piezas. Se escala para que su
   * hueco interior coincida exactamente con la caja física (DESIGN.board).
   * Sin arte, cae al rectángulo procedural de siempre.
   */
  private drawGlass() {
    const { x, y, w, h } = DESIGN.board;
    const tex = getTexture('ui', 'vidrio');

    if (tex) {
      const inner = Renderer.GLASS_INNER;
      const sw = w / (inner.r - inner.l);
      const sh = h / (inner.b - inner.t);
      const sp = new Sprite(tex);
      sp.width = sw;
      sp.height = sh;
      sp.position.set(x - sw * inner.l, y - sh * inner.t);
      this.boardLayer.addChildAt(sp, 0);
      this.boardGfx.clear();
      return;
    }

    // fallback procedural
    this.boardGfx
      .clear()
      .roundRect(x, y, w, h, 18)
      .fill({ color: 0xffffff, alpha: 0.07 })
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.26 });
    this.boardGfx
      .roundRect(x - 8, y + h - 4, w + 16, 12, 5)
      .fill({ color: 0x5c3a22, alpha: 0.55 });
  }

  setDanger(active: boolean) {
    this.dangerGfx.clear();
    for (let dx = 0; dx < DESIGN.board.w - 8; dx += 12) {
      this.dangerGfx.rect(BOARD_LEFT + 4 + dx, DANGER_Y, 7, active ? 2.6 : 1.8);
    }
    this.dangerGfx.fill({ color: 0xe05a4c, alpha: active ? 0.95 : 0.5 });
  }

  // ---------- guía de tiro ----------

  /**
   * Guía de tiro. `autoDropFrac` (0..1) es el avance del temporizador de
   * lanzamiento automático: dibuja una barrita bajo la pieza fantasma que se
   * va vaciando; en rojo cuando queda poco.
   */
  showAim(x: number, tier: number, autoDropFrac = 0) {
    const r = tierAt(tier).radius;
    const cx = Math.max(BOARD_LEFT + r + 2, Math.min(BOARD_RIGHT - r - 2, x));

    this.aimGfx.clear();
    for (let y = BOARD_TOP + 4; y < BOARD_BOTTOM - 6; y += 12) {
      this.aimGfx.rect(cx - 1, y, 2, 5);
    }
    this.aimGfx.fill({ color: 0xe05a4c, alpha: 0.5 });

    if (autoDropFrac > 0) {
      const remaining = Math.max(0, 1 - autoDropFrac);
      const bw = 54;
      const bh = 5;
      const by = DESIGN.dropY + r * SPRITE_SCALE + 10;
      const low = remaining < 0.3;
      this.aimGfx
        .roundRect(cx - bw / 2, by, bw, bh, 3)
        .fill({ color: 0x000000, alpha: 0.35 });
      if (remaining > 0) {
        this.aimGfx
          .roundRect(cx - bw / 2, by, bw * remaining, bh, 3)
          .fill({ color: low ? 0xe05a4c : 0xf2c14e, alpha: 0.9 });
      }
    }

    if (!this.ghost) {
      this.ghost = new Sprite();
      this.ghost.anchor.set(0.5);
      this.ghost.alpha = 0.6;
      this.guideLayer.addChild(this.ghost);
    }
    this.ghost.texture = getTierTexture(tier);
    this.ghost.width = r * 2 * SPRITE_SCALE;
    this.ghost.height = r * 2 * SPRITE_SCALE;
    this.ghost.position.set(cx, DESIGN.dropY);
    this.ghost.visible = true;
  }

  hideAim() {
    this.aimGfx.clear();
    if (this.ghost) this.ghost.visible = false;
  }

  // ---------- piezas ----------

  /** Sincroniza sprites con los cuerpos físicos. Llamar una vez por frame. */
  sync(bodies: SuguBody[]) {
    const seen = new Set<number>();

    for (const b of bodies) {
      const { uid, tier } = b.sugu;
      seen.add(uid);
      let sp = this.sprites.get(uid);

      if (!sp) {
        sp = new Sprite(getTierTexture(tier));
        sp.anchor.set(0.5);
        const d = tierAt(tier).radius * 2 * SPRITE_SCALE;
        sp.width = d;
        sp.height = d;
        this.pieceLayer.addChild(sp);
        this.sprites.set(uid, sp);
        // pop de aparición
        sp.scale.set(sp.scale.x * 0.4, sp.scale.y * 0.4);
        gsap.to(sp.scale, {
          x: (d / sp.texture.width) * 1,
          y: (d / sp.texture.height) * 1,
          duration: 0.28,
          ease: 'back.out(2.2)',
        });
      }

      sp.position.set(b.position.x, b.position.y);
      sp.rotation = b.angle;
    }

    for (const [uid, sp] of this.sprites) {
      if (seen.has(uid)) continue;
      this.sprites.delete(uid);
      gsap.killTweensOf(sp);
      gsap.to(sp, {
        alpha: 0,
        duration: 0.14,
        onComplete: () => sp.destroy(),
      });
    }
  }

  // ---------- efectos ----------

  burst(x: number, y: number, color: number, count = 14) {
    for (let i = 0; i < count; i++) {
      const p = new Graphics().circle(0, 0, 2 + Math.random() * 3).fill({ color });
      p.position.set(x, y);
      this.fxLayer.addChild(p);
      const a = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 60;
      gsap.to(p, {
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist + 30,
        alpha: 0,
        duration: 0.5 + Math.random() * 0.3,
        ease: 'power2.out',
        onComplete: () => p.destroy(),
      });
    }
  }

  /**
   * La pieza vuela hasta el cliente VIP (coordenadas de diseño) y se encoge.
   * Es un sprite de FX independiente del cuerpo físico (que ya fue eliminado).
   */
  flyTo(fromX: number, fromY: number, tier: number, toX: number, toY: number) {
    const sp = new Sprite(getTierTexture(tier));
    sp.anchor.set(0.5);
    const d = tierAt(tier).radius * 2 * SPRITE_SCALE;
    sp.width = d;
    sp.height = d;
    sp.position.set(fromX, fromY);
    this.fxLayer.addChild(sp);

    const arcY = Math.min(fromY, toY) - 70;
    const tl = gsap.timeline({ onComplete: () => sp.destroy() });
    tl.to(sp, { x: toX, duration: 0.62, ease: 'power1.inOut' }, 0)
      .to(sp, { y: arcY, duration: 0.3, ease: 'power2.out' }, 0)
      .to(sp, { y: toY, duration: 0.32, ease: 'power2.in' }, 0.3)
      .to(sp.scale, {
        x: sp.scale.x * 0.35,
        y: sp.scale.y * 0.35,
        duration: 0.62,
        ease: 'power1.in',
      }, 0)
      .to(sp, { alpha: 0, duration: 0.12 }, 0.5);
  }

  /** Destello expansivo (evolución de CHIMMY, activación de poderes). */
  flash(x: number, y: number, color: number, radius = 60) {
    const g = new Graphics().circle(0, 0, radius).fill({ color, alpha: 0.55 });
    g.position.set(x, y);
    g.scale.set(0.2);
    this.fxLayer.addChild(g);
    gsap.to(g.scale, { x: 1, y: 1, duration: 0.4, ease: 'power2.out' });
    gsap.to(g, { alpha: 0, duration: 0.45, ease: 'power1.out', onComplete: () => g.destroy() });
    this.burst(x, y, color, 16);
  }

  /** Ráfaga de confeti del BTS Festival: papelitos que caen por todo el lienzo. */
  confetti(count = 22) {
    const colors = [0x8e6fc4, 0xf2c14e, 0xf48fb1, 0xffffff, 0x9b59d0];
    for (let i = 0; i < count; i++) {
      const w = 5 + Math.random() * 5;
      const h = 3 + Math.random() * 4;
      const p = new Graphics()
        .rect(-w / 2, -h / 2, w, h)
        .fill({ color: colors[(Math.random() * colors.length) | 0] });
      const x = Math.random() * DESIGN.width;
      p.position.set(x, -20 - Math.random() * 60);
      p.rotation = Math.random() * Math.PI;
      this.fxLayer.addChild(p);
      gsap.to(p, {
        y: DESIGN.height + 30,
        x: x + (Math.random() - 0.5) * 120,
        rotation: p.rotation + (Math.random() - 0.5) * 8,
        duration: 2.2 + Math.random() * 1.6,
        ease: 'power1.in',
        onComplete: () => p.destroy(),
      });
    }
  }

  floatScore(x: number, y: number, value: number) {
    const style = new TextStyle({
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: 22,
      fontWeight: '900',
      fill: 0xffffff,
      stroke: { color: 0x2a1a10, width: 4 },
    });
    const t = new Text({ text: `+${value}`, style });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.fxLayer.addChild(t);
    gsap.to(t, {
      y: y - 46,
      alpha: 0,
      duration: 0.85,
      ease: 'power1.out',
      onComplete: () => t.destroy(),
    });
  }
}
