import type { CSSProperties } from 'react';

/**
 * Atlas del sprite sheet de Sugu Match.
 *
 * Hoja: /public/games/sugu-match/spritesheet.png (1254x1254, 6x6 dibujos).
 *
 * A diferencia de la primera hoja, ésta viene con aire de sobra entre dibujos:
 * las seis columnas y las seis filas quedan separadas por bandas de alfa
 * completamente vacías, así que la rejilla SÍ se puede recortar sola. Aun así
 * los rectángulos de abajo no son la rejilla: son la CAJA REAL de cada dibujo,
 * sacada del canal alfa y con dos píxeles de aire.
 *
 * Se miden en vez de dividir la hoja entre seis porque los dibujos no están
 * centrados en su celda ni ocupan lo mismo (el ikura mide 153x194 y el tofu
 * 139x140). Recortando la caja real, el tablero puede escalar cada pieza para
 * que TODAS pesen lo mismo en pantalla, cosa imposible si el recorte lleva
 * cantidades distintas de aire.
 *
 * ⚠️ Si vuelves a generar la hoja hay que volver a medirla. El procedimiento:
 * recorre el alfa, busca las bandas vacías entre dibujos y saca el bounding
 * box de cada celda. No hay ninguna constante que puedas ajustar a ojo.
 *
 * Como los recortes no son cuadrados, todo lo que los pinta los ENCAJA
 * conservando la proporción (`TileSprite.encajar` en Pixi, `frameToCss` en el
 * DOM). No los estires.
 *
 * Este archivo lo consumen dos mundos:
 *   - PixiJS, vía `render/textures.ts` (recorta la textura con estos rects).
 *   - El DOM, vía `frameToCss`, para los objetivos y la barra de boosters.
 */

export const SHEET_SRC = '/games/sugu-match/spritesheet.png';
export const SHEET_W = 1254;
export const SHEET_H = 1254;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Contenido de la hoja, fila por fila:
 *
 *   0  piezas jugables: poke, ikura, onigiri, temaki, gyoza, maki
 *   1  piezas extra y especiales: palta, ebi, salmón, california, envuelto, arcoíris
 *   2  boosters: shoyu, ohashi, gari, wasabi, estrella, reloj
 *   3  obstáculos: hielo, salsa, candado, caja, piedra, cuerda
 *   4  ingredientes y vidas: salmón, palta, langostino, tofu, destello, corazón
 *   5  varios: sésamo, ají, shuffle, corona, burbuja, bomba
 */
export const FRAMES = {
  // --- fila 0: las seis piezas del tablero --------------------------------
  'tile.poke': { x: 29, y: 42, w: 178, h: 176 },
  'tile.ikura': { x: 260, y: 29, w: 153, h: 194 },
  'tile.onigiri': { x: 462, y: 60, w: 151, h: 154 },
  'tile.temaki': { x: 656, y: 35, w: 159, h: 187 },
  'tile.gyoza': { x: 845, y: 63, w: 170, h: 154 },
  'tile.maki': { x: 1070, y: 55, w: 138, h: 157 },

  // --- fila 1: reserva para futuras piezas y los especiales ---------------
  'tile.avocado': { x: 41, y: 256, w: 148, h: 155 },
  'tile.ebi': { x: 243, y: 241, w: 170, h: 173 },
  'tile.salmon': { x: 453, y: 259, w: 169, h: 153 },
  'tile.california': { x: 665, y: 250, w: 138, h: 168 },
  'special.wrapped': { x: 853, y: 249, w: 153, h: 166 },
  'special.rainbow': { x: 1061, y: 242, w: 163, h: 170 },

  // --- fila 2: boosters ---------------------------------------------------
  'booster.shoyu': { x: 43, y: 438, w: 140, h: 188 },
  'booster.ohashi': { x: 236, y: 432, w: 161, h: 188 },
  'booster.gari': { x: 448, y: 460, w: 166, h: 158 },
  'booster.wasabi': { x: 650, y: 473, w: 157, h: 147 },
  'ui.star': { x: 845, y: 452, w: 175, h: 170 },
  'booster.clock': { x: 1059, y: 447, w: 164, h: 173 },

  // --- fila 3: obstáculos -------------------------------------------------
  'layer.ice': { x: 31, y: 641, w: 165, h: 161 },
  'obstacle.sauce': { x: 243, y: 650, w: 171, h: 152 },
  'obstacle.lock': { x: 448, y: 642, w: 165, h: 157 },
  'ui.box': { x: 652, y: 643, w: 163, h: 163 },
  'obstacle.stone': { x: 858, y: 657, w: 158, h: 143 },
  'layer.rope': { x: 1058, y: 649, w: 165, h: 158 },

  // --- fila 4: ingredientes sueltos y vidas -------------------------------
  'item.salmon': { x: 28, y: 831, w: 178, h: 140 },
  'item.avocado': { x: 250, y: 832, w: 152, h: 151 },
  'item.ebi': { x: 449, y: 834, w: 177, h: 150 },
  'item.tofu': { x: 666, y: 842, w: 139, h: 140 },
  'fx.sparkle': { x: 847, y: 824, w: 173, h: 161 },
  'ui.heart': { x: 1065, y: 841, w: 152, h: 131 },

  // --- fila 5: varios -----------------------------------------------------
  'item.sesame': { x: 28, y: 1011, w: 164, h: 164 },
  'booster.spicy': { x: 236, y: 1012, w: 158, h: 159 },
  'booster.shuffle': { x: 441, y: 1005, w: 174, h: 166 },
  'ui.crown': { x: 639, y: 1019, w: 180, h: 152 },
  'fx.bubble': { x: 854, y: 1011, w: 174, h: 169 },
  'fx.bomb': { x: 1073, y: 987, w: 154, h: 193 },
} as const satisfies Record<string, Rect>;

export type FrameId = keyof typeof FRAMES;

export function esFrame(id: string): id is FrameId {
  return id in FRAMES;
}

/**
 * CSS para pintar un frame dentro de un elemento CUADRADO, encajado y
 * centrado, sin deformarlo.
 *
 * Va todo en porcentajes y no en píxeles a propósito: así el mismo estilo vale
 * para el icono de 24 px de un objetivo y para el de 40 px de un booster, y
 * las medidas responsive del CSS (`clamp`) siguen mandando. La cuenta sale de
 * despejar el lado del elemento en la fórmula de `background-position`, que se
 * cancela — por eso esta función no necesita saber el tamaño final.
 */
export function frameToCss(id: FrameId, size?: number): CSSProperties {
  const { x, y, w, h } = FRAMES[id];
  const lado = Math.max(w, h);

  return {
    ...(size ? { width: size, height: size } : null),
    backgroundImage: `url(${SHEET_SRC})`,
    backgroundSize: `${(SHEET_W / lado) * 100}% ${(SHEET_H / lado) * 100}%`,
    backgroundPosition: `${(((lado - w) / 2 - x) / (lado - SHEET_W)) * 100}% ${
      (((lado - h) / 2 - y) / (lado - SHEET_H)) * 100
    }%`,
    backgroundRepeat: 'no-repeat',
  };
}
