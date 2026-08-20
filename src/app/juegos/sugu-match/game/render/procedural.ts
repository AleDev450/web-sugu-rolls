import { Graphics, Texture, type Renderer } from 'pixi.js';
import type { MatchType } from '../types';

/**
 * Dibujo generado con Graphics.
 *
 * Cumple dos papeles distintos:
 *
 *   1. PIEZAS DE REPUESTO. Mientras el sprite sheet no esté en
 *      /public/games/sugu-match/, el tablero se pinta con estas formas. No
 *      pretenden sustituir al arte definitivo: son siluetas y colores lo
 *      bastante distintos entre sí como para que el Match-3 se juegue y se
 *      pruebe desde el primer día. En cuanto aparezca el PNG, dejan de usarse
 *      solas (ver `textures.ts`).
 *
 *   2. CAPAS Y EFECTOS. El hielo, la cuerda, las rayas del maki rayado, el
 *      lazo del envuelto, el resplandor y la partícula se generan SIEMPRE,
 *      haya hoja o no. Son formas planas de uno o dos colores que se pintan
 *      encima de la pieza: gastar celdas del atlas en ellas no compensa, y
 *      así el rayado funciona sobre cualquier pieza sin arte específico.
 */

/** Lado del lienzo de dibujo. Las texturas luego se escalan a la casilla. */
const S = 128;
const C = S / 2;

function textura(renderer: Renderer, g: Graphics, resolution = 2): Texture {
  const t = renderer.generateTexture({ target: g, resolution, antialias: true });
  g.destroy();
  return t;
}

/** Carita kawaii: ojos con brillo, boca y mofletes. */
function cara(g: Graphics, cx: number, cy: number, r: number, claro = false) {
  const tinta = claro ? 0xfdf6ec : 0x33231a;

  g.ellipse(cx - r * 0.36, cy, r * 0.13, r * 0.18).fill(tinta);
  g.ellipse(cx + r * 0.36, cy, r * 0.13, r * 0.18).fill(tinta);
  g.circle(cx - r * 0.4, cy - r * 0.07, r * 0.05).fill(0xffffff);
  g.circle(cx + r * 0.32, cy - r * 0.07, r * 0.05).fill(0xffffff);

  g.moveTo(cx - r * 0.16, cy + r * 0.24)
    .quadraticCurveTo(cx, cy + r * 0.46, cx + r * 0.16, cy + r * 0.24)
    .stroke({ width: Math.max(2, r * 0.1), color: tinta, cap: 'round' });

  g.ellipse(cx - r * 0.62, cy + r * 0.22, r * 0.17, r * 0.11).fill({ color: 0xff8fa3, alpha: 0.7 });
  g.ellipse(cx + r * 0.62, cy + r * 0.22, r * 0.17, r * 0.11).fill({ color: 0xff8fa3, alpha: 0.7 });
}

// --- piezas ---------------------------------------------------------------

function dibujarMaki(g: Graphics) {
  g.circle(C, C, 52).fill(0x24432e);
  g.circle(C, C, 52).stroke({ width: 3, color: 0x16291d });
  g.circle(C, C, 41).fill(0xf9f2e4);
  g.circle(C, C - 4, 17).fill(0xff7a45);
  g.ellipse(C + 13, C + 8, 11, 8).fill(0x7fc35a);
  cara(g, C, C + 12, 26);
}

function dibujarOnigiri(g: Graphics) {
  g.moveTo(C, 20)
    .quadraticCurveTo(C + 16, 40, C + 48, 96)
    .quadraticCurveTo(C + 52, 108, C + 36, 108)
    .lineTo(C - 36, 108)
    .quadraticCurveTo(C - 52, 108, C - 48, 96)
    .quadraticCurveTo(C - 16, 40, C, 20)
    .fill(0xfaf5ea);
  g.rect(C - 27, 80, 54, 28).fill(0x22402c);
  cara(g, C, 66, 25);
}

function dibujarTemaki(g: Graphics) {
  g.moveTo(C - 40, 26).lineTo(C + 40, 26).lineTo(C + 4, 110).quadraticCurveTo(C, 116, C - 4, 110).fill(0x22402c);
  g.ellipse(C, 30, 38, 13).fill(0xf9f2e4);
  g.ellipse(C - 13, 25, 15, 9).fill(0xff8a5c);
  g.ellipse(C + 14, 26, 13, 8).fill(0x7fc35a);
  cara(g, C, 62, 22, true);
}

function dibujarGyoza(g: Graphics) {
  g.ellipse(C, C + 12, 51, 31).fill(0xecd6a8);
  g.ellipse(C, C + 4, 51, 27).fill(0xf7e9c9);
  for (let i = -2; i <= 2; i++) {
    g.circle(C + i * 19, C - 18, 11).fill(0xf7e9c9);
    g.circle(C + i * 19, C - 18, 11).stroke({ width: 2, color: 0xd9b884 });
  }
  cara(g, C, C + 10, 25);
}

function dibujarPoke(g: Graphics) {
  g.ellipse(C, C + 14, 50, 34).fill(0x2c2c34);
  g.ellipse(C, C + 4, 50, 26).fill(0x3a3a44);
  g.ellipse(C, C - 8, 46, 22).fill(0xf9f2e4);
  const cubos: [number, number, number][] = [
    [-26, -14, 0xff7a45],
    [-6, -20, 0xf5c542],
    [14, -14, 0x7fc35a],
    [30, -6, 0xff9d6b],
    [2, -6, 0xe8534a],
  ];
  for (const [dx, dy, color] of cubos) {
    g.roundRect(C + dx - 9, C + dy - 8, 18, 15, 4).fill(color);
  }
  cara(g, C, C + 16, 22, true);
}

function dibujarIkura(g: Graphics) {
  g.roundRect(C - 40, C - 14, 80, 54, 16).fill(0xf9f2e4);
  g.roundRect(C - 42, C + 2, 84, 40, 12).fill(0x22402c);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.circle(C + Math.cos(a) * 24, C - 20 + Math.sin(a) * 9, 7).fill(0xff5f2e);
    g.circle(C + Math.cos(a) * 24 - 2, C - 22 + Math.sin(a) * 9, 2.4).fill({
      color: 0xffd0b0,
      alpha: 0.9,
    });
  }
  g.circle(C, C - 20, 8).fill(0xff5f2e);
  cara(g, C, C + 20, 22, true);
}

function dibujarPiedra(g: Graphics) {
  g.roundRect(C - 47, C - 47, 94, 94, 14).fill(0x3a3a44);
  g.roundRect(C - 47, C - 47, 94, 94, 14).stroke({ width: 5, color: 0x1c1c22 });
  g.moveTo(C - 20, C - 40).lineTo(C - 6, C - 18).lineTo(C - 24, C + 4).stroke({
    width: 3,
    color: 0x22222a,
  });
  g.moveTo(C + 30, C - 6).lineTo(C + 12, C + 14).lineTo(C + 22, C + 38).stroke({
    width: 3,
    color: 0x22222a,
  });
  // ceño fruncido: es un obstáculo, no un amigo
  g.moveTo(C - 30, C - 14).lineTo(C - 10, C - 6).stroke({ width: 5, color: 0xf4f0ea, cap: 'round' });
  g.moveTo(C + 30, C - 14).lineTo(C + 10, C - 6).stroke({ width: 5, color: 0xf4f0ea, cap: 'round' });
  g.ellipse(C - 18, C + 4, 6, 8).fill(0xf4f0ea);
  g.ellipse(C + 18, C + 4, 6, 8).fill(0xf4f0ea);
}

function dibujarRainbow(g: Graphics) {
  const colores = [0xff4d6d, 0xff9d3d, 0xf5d13b, 0x63c95c, 0x3fb6e8, 0x9a6cf0];
  colores.forEach((color, i) => {
    const a0 = (i / colores.length) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / colores.length) * Math.PI * 2 - Math.PI / 2;
    g.moveTo(C, C).arc(C, C, 52, a0, a1).closePath().fill(color);
  });
  g.circle(C, C, 34).fill(0xf9f2e4);
  cara(g, C, C, 24);
}

const DIBUJOS: Record<MatchType, (g: Graphics) => void> = {
  poke: dibujarPoke,
  ikura: dibujarIkura,
  onigiri: dibujarOnigiri,
  temaki: dibujarTemaki,
  gyoza: dibujarGyoza,
  maki: dibujarMaki,
};

/** Texturas de repuesto para las piezas, cuando no hay sprite sheet. */
export function generarPiezas(renderer: Renderer): Map<string, Texture> {
  const out = new Map<string, Texture>();

  for (const [tipo, dibujo] of Object.entries(DIBUJOS)) {
    const g = new Graphics();
    dibujo(g);
    out.set(`tile.${tipo}`, textura(renderer, g));
  }

  const piedra = new Graphics();
  dibujarPiedra(piedra);
  out.set('obstacle.stone', textura(renderer, piedra));

  const arcoiris = new Graphics();
  dibujarRainbow(arcoiris);
  out.set('special.rainbow', textura(renderer, arcoiris));

  return out;
}

// --- capas y efectos (siempre generados) ----------------------------------

export interface TexturasFx {
  hielo: Texture;
  cuerda: Texture;
  rayasH: Texture;
  rayasV: Texture;
  envuelto: Texture;
  arcoirisAura: Texture;
  resplandor: Texture;
  particula: Texture;
  haz: Texture;
}

export function generarFx(renderer: Renderer): TexturasFx {
  // hielo: cristal translúcido con dos brillos
  const hielo = new Graphics();
  hielo.roundRect(6, 6, S - 12, S - 12, 18).fill({ color: 0xa8e4ff, alpha: 0.42 });
  hielo.roundRect(6, 6, S - 12, S - 12, 18).stroke({ width: 5, color: 0xe8f8ff, alpha: 0.85 });
  hielo.moveTo(22, 44).lineTo(48, 18).stroke({ width: 7, color: 0xffffff, alpha: 0.75, cap: 'round' });
  hielo.moveTo(74, 108).lineTo(104, 78).stroke({ width: 5, color: 0xffffff, alpha: 0.5, cap: 'round' });

  // cuerda: dos bandas cruzadas con nudo
  const cuerda = new Graphics();
  cuerda.roundRect(6, C - 13, S - 12, 26, 10).fill(0xc9a05c);
  cuerda.roundRect(C - 13, 6, 26, S - 12, 10).fill(0xb98c48);
  for (let i = 0; i < 8; i++) {
    cuerda.moveTo(10 + i * 15, C - 13).lineTo(18 + i * 15, C + 13).stroke({
      width: 3,
      color: 0x8f6a34,
      alpha: 0.7,
    });
  }
  cuerda.circle(C, C, 15).fill(0xdcb673);
  cuerda.circle(C, C, 15).stroke({ width: 3, color: 0x8f6a34 });

  // rayas del maki rayado: tres barras claras que marcan la dirección
  const rayasH = new Graphics();
  for (const y of [C - 26, C, C + 26]) {
    rayasH.roundRect(2, y - 7, S - 4, 14, 7).fill({ color: 0xffffff, alpha: 0.9 });
    rayasH.roundRect(2, y - 7, S - 4, 14, 7).stroke({ width: 2.5, color: 0xffd166, alpha: 0.95 });
  }

  const rayasV = new Graphics();
  for (const x of [C - 26, C, C + 26]) {
    rayasV.roundRect(x - 7, 2, 14, S - 4, 7).fill({ color: 0xffffff, alpha: 0.9 });
    rayasV.roundRect(x - 7, 2, 14, S - 4, 7).stroke({ width: 2.5, color: 0xffd166, alpha: 0.95 });
  }

  // envuelto (bomba): lazo dorado y cuatro chispas
  const envuelto = new Graphics();
  envuelto.roundRect(4, 4, S - 8, S - 8, 22).stroke({ width: 9, color: 0xf5c542, alpha: 0.95 });
  envuelto.roundRect(4, 4, S - 8, S - 8, 22).stroke({ width: 3, color: 0xfff3c4, alpha: 0.9 });
  for (const [x, y] of [
    [16, 16],
    [S - 16, 16],
    [16, S - 16],
    [S - 16, S - 16],
  ]) {
    envuelto
      .moveTo(x, y - 11)
      .lineTo(x + 4, y - 4)
      .lineTo(x + 11, y)
      .lineTo(x + 4, y + 4)
      .lineTo(x, y + 11)
      .lineTo(x - 4, y + 4)
      .lineTo(x - 11, y)
      .lineTo(x - 4, y - 4)
      .closePath()
      .fill(0xfff0a8);
  }

  /*
   * Aura del arcoíris: anillo multicolor. Se dibuja con `stroke` sobre arcos y
   * no como sectores recortados porque un trazo grueso YA es un anillo: no
   * hace falta restar el centro, que en Pixi obliga a operaciones de camino
   * más frágiles.
   */
  const aura = new Graphics();
  const colores = [0xff4d6d, 0xff9d3d, 0xf5d13b, 0x63c95c, 0x3fb6e8, 0x9a6cf0];
  colores.forEach((color, i) => {
    const a0 = (i / colores.length) * Math.PI * 2;
    const a1 = ((i + 1) / colores.length) * Math.PI * 2;
    aura
      .moveTo(C + Math.cos(a0) * 54, C + Math.sin(a0) * 54)
      .arc(C, C, 54, a0, a1)
      .stroke({ width: 18, color, alpha: 0.9 });
  });

  // resplandor redondo: capas concéntricas, más barato que un filtro de blur
  const resplandor = new Graphics();
  for (let i = 12; i >= 1; i--) {
    resplandor.circle(C, C, (62 * i) / 12).fill({ color: 0xffffff, alpha: 0.05 });
  }

  const particula = new Graphics();
  particula.circle(16, 16, 14).fill(0xffffff);

  // haz: barra blanca que se estira a lo largo de la fila o la columna
  const haz = new Graphics();
  haz.roundRect(0, 0, 64, 16, 8).fill(0xffffff);

  return {
    hielo: textura(renderer, hielo),
    cuerda: textura(renderer, cuerda),
    rayasH: textura(renderer, rayasH),
    rayasV: textura(renderer, rayasV),
    envuelto: textura(renderer, envuelto),
    arcoirisAura: textura(renderer, aura),
    resplandor: textura(renderer, resplandor, 1),
    particula: textura(renderer, particula, 1),
    haz: textura(renderer, haz, 1),
  };
}
