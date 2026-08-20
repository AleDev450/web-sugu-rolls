import { Container, Sprite, Texture } from 'pixi.js';
import { tileFrame } from '../config/tiles';
import { ESCALA_PIEZA } from '../config/medidas';
import type { LayerKind, SpecialKind, TileType } from '../types';
import { fxTex, tex } from './textures';
import { esFrame, type FrameId } from './sprites';

/**
 * La representación visual de UNA pieza.
 *
 * Es un contenedor con hasta tres capas apiladas:
 *
 *   base    el sushi (o el arcoíris, que sustituye al dibujo normal)
 *   adorno  las rayas del rayado o el lazo del envuelto, encima de la base
 *   capa    el hielo o la cuerda, que van por delante de todo
 *
 * El contenedor se mueve y se escala; los hijos no. Así una animación de GSAP
 * sobre `escala` o `position` nunca pelea con lo que hace `sync()`.
 */
export class TileSprite {
  readonly view = new Container();

  private base = new Sprite();
  private adorno: Sprite | null = null;
  private capa: Sprite | null = null;

  private tipo: TileType | null = null;
  private special: SpecialKind = 'none';
  private layer: LayerKind = 'none';
  private lado = 64;

  constructor(public readonly id: number) {
    this.base.anchor.set(0.5);
    this.view.addChild(this.base);
    this.view.sortableChildren = false;
  }

  /**
   * Encaja un sprite en un cuadrado de lado `d` SIN deformarlo.
   *
   * Hace falta porque los recortes del sheet no son cuadrados: el ikura mide
   * 185x252 y el gyoza 204x189. Estirarlos a un cuadrado dejaría al ikura
   * achatado y al gyoza espigado. Encajándolos por el lado mayor, todas las
   * piezas ocupan lo mismo en el tablero y ninguna se deforma.
   */
  private static encajar(s: Sprite, d: number) {
    const t = s.texture;
    const k = d / Math.max(t.width, t.height);
    s.width = t.width * k;
    s.height = t.height * k;
  }

  /** Lado de casilla en píxeles. Recalcula el tamaño de todas las capas. */
  setLado(lado: number) {
    this.lado = lado;
    TileSprite.encajar(this.base, lado * ESCALA_PIEZA);
    if (this.adorno) TileSprite.encajar(this.adorno, lado * ESCALA_PIEZA);
    if (this.capa) TileSprite.encajar(this.capa, lado * 0.98);
  }

  /** Pone la pieza al día: dibujo, especial y capa. */
  sync(type: TileType, special: SpecialKind, layer: LayerKind) {
    if (type !== this.tipo || special !== this.special) {
      this.tipo = type;
      this.special = special;
      this.aplicarBase();
      this.aplicarAdorno();
    }
    if (layer !== this.layer) {
      this.layer = layer;
      this.aplicarCapa();
    }
  }

  private aplicarBase() {
    // el arcoíris no es un sushi con adorno: tiene dibujo propio
    const id = this.special === 'rainbow' ? 'special.rainbow' : tileFrame(this.tipo!);
    const t = esFrame(id) ? tex(id as FrameId) : null;
    this.base.texture = t ?? Texture.WHITE;
    this.base.tint = t ? 0xffffff : 0xcccccc;
    this.setLado(this.lado);
  }

  private aplicarAdorno() {
    if (this.adorno) {
      this.adorno.destroy();
      this.adorno = null;
    }

    const f = fxTex();
    const textura =
      this.special === 'stripedH'
        ? f.rayasH
        : this.special === 'stripedV'
          ? f.rayasV
          : this.special === 'bomb'
            ? f.envuelto
            : this.special === 'rainbow'
              ? f.arcoirisAura
              : null;
    if (!textura) return;

    const s = new Sprite(textura);
    s.anchor.set(0.5);
    s.alpha = this.special === 'rainbow' ? 0.85 : 0.95;
    this.adorno = s;
    this.view.addChild(s);
    this.setLado(this.lado);
  }

  private aplicarCapa() {
    if (this.capa) {
      this.capa.destroy();
      this.capa = null;
    }
    if (this.layer === 'none') return;

    const f = fxTex();
    const s = new Sprite(this.layer === 'ice' ? f.hielo : f.cuerda);
    s.anchor.set(0.5);
    this.capa = s;
    this.view.addChild(s);
    this.setLado(this.lado);
  }

  /** Gira despacio el aura del arcoíris. Lo llama el ticker de la vista. */
  animarAura(dt: number) {
    if (this.special === 'rainbow' && this.adorno) this.adorno.rotation += dt * 0.012;
  }

  destroy() {
    this.view.destroy({ children: true });
  }
}
