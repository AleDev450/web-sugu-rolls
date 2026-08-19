import {
  Assets,
  Graphics,
  Rectangle,
  Texture,
  type Renderer,
} from 'pixi.js';
import { FRAMES, SHEET_SRC, type FrameId } from './sprites';

/**
 * Texturas de Sugu Maki Maze.
 *
 * Dos orígenes distintos:
 *   1. El sprite sheet, recortado según `sprites.ts`. Todos los recortes
 *      comparten la misma textura base, así que Pixi los dibuja en una sola
 *      tanda por muchos sprites que haya en pantalla.
 *   2. Dos texturas generadas al vuelo (la bolita de arroz y un halo redondo)
 *      que no merecen un PNG: son formas planas de uno o dos colores.
 */

/** Paleta del tablero. Sale de la referencia: nori, brasa y crema. */
export const PALETA = {
  fondo: 0x050505,
  paredRelleno: 0x0d2a19,
  paredRellenoAlto: 0x143a23,
  paredBorde: 0xff3b1f,
  paredBrillo: 0xff7a3d,
  arroz: 0xf7ecd8,
  seigaiha: 0x7a1410,
  puerta: 0xff9d6b,
  asustado: 0x3f8fff,
  asustadoAviso: 0xf7ecd8,
} as const;

let base: Texture | null = null;
const recortes = new Map<FrameId, Texture>();

/** Carga el sprite sheet. Idempotente: se puede llamar en cada partida. */
export async function cargarHoja(): Promise<void> {
  if (base) return;
  const tex: Texture = await Assets.load(SHEET_SRC);
  /*
   * Pixel art: sin filtrado bilineal. Si no, al escalar el tablero los bordes
   * del maki se vuelven papilla y se pierde el aire retro.
   */
  tex.source.scaleMode = 'nearest';
  base = tex;
}

/** Textura de un frame del sheet. */
export function frame(id: FrameId): Texture {
  if (!base) throw new Error('cargarHoja() no se ha llamado todavía');
  let t = recortes.get(id);
  if (!t) {
    const r = FRAMES[id];
    t = new Texture({
      source: base.source,
      frame: new Rectangle(r.x, r.y, r.width, r.height),
    });
    recortes.set(id, t);
  }
  return t;
}

// --- texturas generadas ---------------------------------------------------

let texArroz: Texture | null = null;
let texResplandor: Texture | null = null;

/**
 * Bolita de arroz.
 *
 * Va generada y no recortada del sheet a propósito: el arroz del sheet son
 * tres granos con sombra, dibujados para verse a 100px. A los 6px que ocupa un
 * punto dentro del pasillo se convertirían en una mancha marrón. Un óvalo
 * crema con un brillo arriba se lee perfecto a ese tamaño y es lo que pide la
 * referencia.
 */
export function arrozTexture(renderer: Renderer): Texture {
  if (texArroz) return texArroz;

  const r = 5;
  const g = new Graphics()
    .ellipse(r + 2, r + 2, r, r * 0.86)
    .fill(PALETA.arroz)
    .ellipse(r + 1, r, r * 0.42, r * 0.3)
    .fill(0xffffff);

  const tex = renderer.generateTexture({
    target: g,
    resolution: 4,
    antialias: true,
  });
  g.destroy();

  texArroz = tex;
  return tex;
}

/** Halo redondo para brillos (power-up, maki dorado, enemigo asustado). */
export function resplandorTexture(renderer: Renderer): Texture {
  if (texResplandor) return texResplandor;

  const R = 48;
  const g = new Graphics();
  for (let i = 10; i >= 1; i--) {
    g.circle(R, R, (R * i) / 10).fill({ color: 0xffffff, alpha: 0.055 });
  }

  const tex = renderer.generateTexture({ target: g, resolution: 1, antialias: true });
  g.destroy();
  texResplandor = tex;
  return tex;
}

/** Se llama al desmontar el juego para no dejar texturas colgando. */
export function liberarTexturas() {
  recortes.forEach((t) => t.destroy(false));
  recortes.clear();
  texArroz?.destroy(true);
  texResplandor?.destroy(true);
  texArroz = texResplandor = null;
  // la hoja se queda en la caché de Assets: la siguiente partida la reutiliza
  base = null;
}
