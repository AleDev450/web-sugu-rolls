import { Container, Sprite } from 'pixi.js';
import { PARTICULAS_MAX } from '../config/medidas';
import { fxTex } from './textures';

/**
 * Partículas del tablero.
 *
 * Pool fijo y actualización a mano en el ticker: ni se crean ni se destruyen
 * sprites durante la partida. En un móvil de gama media, reventar seis piezas
 * a la vez con creación dinámica de objetos se nota en el hilo principal; con
 * el pool, no. Cuando el pool se agota, las partículas nuevas sencillamente no
 * salen — es mejor perder un destello que perder cuadros.
 */

interface Part {
  sprite: Sprite;
  vx: number;
  vy: number;
  vida: number;
  vidaMax: number;
  escala: number;
}

export class Particles {
  private pool: Part[] = [];
  private activas = 0;

  constructor(private capa: Container) {
    const t = fxTex().particula;
    for (let i = 0; i < PARTICULAS_MAX; i++) {
      const s = new Sprite(t);
      s.anchor.set(0.5);
      s.visible = false;
      capa.addChild(s);
      this.pool.push({ sprite: s, vx: 0, vy: 0, vida: 0, vidaMax: 1, escala: 1 });
    }
  }

  /** Estallido en (x, y). `n` partículas del color de la pieza. */
  estallido(x: number, y: number, color: number, n: number, fuerza = 1) {
    for (let i = 0; i < n; i++) {
      const p = this.libre();
      if (!p) return;

      const a = Math.random() * Math.PI * 2;
      const v = (60 + Math.random() * 150) * fuerza;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - 40 * fuerza;
      p.vidaMax = p.vida = 0.35 + Math.random() * 0.35;
      p.escala = (0.1 + Math.random() * 0.18) * fuerza;

      p.sprite.position.set(x, y);
      p.sprite.tint = color;
      p.sprite.alpha = 1;
      p.sprite.scale.set(p.escala);
      p.sprite.visible = true;
      this.activas++;
    }
  }

  private libre(): Part | null {
    if (this.activas >= PARTICULAS_MAX) return null;
    for (const p of this.pool) if (p.vida <= 0) return p;
    return null;
  }

  /** `dt` en segundos. */
  update(dt: number) {
    if (!this.activas) return;

    for (const p of this.pool) {
      if (p.vida <= 0) continue;

      p.vida -= dt;
      if (p.vida <= 0) {
        p.sprite.visible = false;
        this.activas--;
        continue;
      }

      p.vy += 900 * dt; // gravedad: las chispas caen, no flotan
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;

      const k = p.vida / p.vidaMax;
      p.sprite.alpha = k;
      p.sprite.scale.set(p.escala * (0.4 + k * 0.6));
    }
  }

  limpiar() {
    for (const p of this.pool) {
      p.vida = 0;
      p.sprite.visible = false;
    }
    this.activas = 0;
  }

  destroy() {
    this.pool.forEach((p) => p.sprite.destroy());
    this.pool = [];
    this.activas = 0;
  }
}
