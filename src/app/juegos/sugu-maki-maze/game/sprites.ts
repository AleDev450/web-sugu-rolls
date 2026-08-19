/**
 * Atlas del sprite sheet de Sugu Maki Maze.
 *
 * Hoja: /public/games/sugu-maki-maze/spritesheet.png (1254x1254, 8x8 celdas).
 *
 * Las celdas NO miden exactamente lo mismo: la hoja está dibujada a mano y los
 * canales vacíos entre sprites no caen en múltiplos exactos de 156.75px. Los
 * cortes de abajo son las MITADES de esos canales vacíos, medidas sobre el
 * canal alfa de la imagen, así que cada rectángulo contiene su sprite entero y
 * ni un píxel del vecino.
 *
 * Consecuencia práctica: los recortes tienen anchos de 152 a 163px. Como el
 * sobrante es transparente y el dibujo queda centrado en su celda, todos se
 * pintan con `anchor 0.5` y una escala común (`CELDA_NOMINAL`), y el personaje
 * conserva su tamaño aparente aunque el recorte varíe un par de píxeles.
 *
 * Este archivo lo consumen DOS mundos:
 *   - PixiJS, vía `game/textures.ts` (recorta la textura con estos rects).
 *   - El DOM, vía `components/SpriteImg.tsx` (background-position con los
 *     mismos números), para HUD y overlays.
 */

export const SHEET_SRC = '/games/sugu-maki-maze/spritesheet.png';
export const SHEET_W = 1254;
export const SHEET_H = 1254;

/** Lado de referencia para escalar. Es el tamaño medio de celda de la hoja. */
export const CELDA_NOMINAL = 157;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Líneas verticales de la rejilla (mitad de cada canal vacío). */
const VX = [0, 163, 319, 473, 632, 791, 948, 1100, 1254];
/** Líneas horizontales de la rejilla. */
const VY = [0, 163, 319, 467, 623, 780, 951, 1094, 1254];

/** Recorte de la celda (columna, fila) de la hoja. */
function celda(col: number, fila: number): Rect {
  return {
    x: VX[col],
    y: VY[fila],
    width: VX[col + 1] - VX[col],
    height: VY[fila + 1] - VY[fila],
  };
}

/**
 * Mapa plano nombre -> recorte. Las claves son las que usan Pixi y el DOM.
 *
 * Contenido de la hoja, fila por fila:
 *   0  maki andando a la DERECHA (2 ciclos de 4: cerrado, medio, abierto, cerrado)
 *   1  maki andando a la IZQUIERDA (mismos 2 ciclos)
 *   2  maki de frente / hacia ABAJO (0-3) y de espaldas / hacia ARRIBA (4-7)
 *   3  celebración (0-3), giro dorado (4-6), derrota (7)
 *   4  chile enemigo (8 poses; 4-7 repiten 0-3)
 *   5  wasabi enemigo (0-3), ebi/tempura (4-5), salsa oscura (6-7)
 *   6  objetos: arroz, nigiri, gari, wasabi, shoyu, ohashi, maki dorado, corazón
 *   7  efectos: destello, explosión, humo, estrella, proyectil, orbe, icono, corona
 */
export const FRAMES = {
  // --- jugador ------------------------------------------------------------
  'player.right.0': celda(0, 0),
  'player.right.1': celda(1, 0),
  'player.right.2': celda(2, 0),
  'player.right.3': celda(3, 0),
  'player.right.4': celda(4, 0),
  'player.right.5': celda(5, 0),
  'player.right.6': celda(6, 0),
  'player.right.7': celda(7, 0),

  'player.left.0': celda(0, 1),
  'player.left.1': celda(1, 1),
  'player.left.2': celda(2, 1),
  'player.left.3': celda(3, 1),
  'player.left.4': celda(4, 1),
  'player.left.5': celda(5, 1),
  'player.left.6': celda(6, 1),
  'player.left.7': celda(7, 1),

  'player.down.0': celda(0, 2),
  'player.down.1': celda(1, 2),
  'player.down.2': celda(2, 2),
  'player.down.3': celda(3, 2),

  'player.up.0': celda(4, 2),
  'player.up.1': celda(5, 2),
  'player.up.2': celda(6, 2),
  'player.up.3': celda(7, 2),

  'player.happy.0': celda(0, 3),
  'player.happy.1': celda(1, 3),
  'player.happy.2': celda(2, 3),
  'player.happy.3': celda(3, 3),

  'player.spin.0': celda(4, 3),
  'player.spin.1': celda(5, 3),
  'player.spin.2': celda(6, 3),

  'player.dead': celda(7, 3),

  // --- enemigos -----------------------------------------------------------
  'enemy.chili.0': celda(0, 4),
  'enemy.chili.1': celda(1, 4),
  'enemy.chili.2': celda(2, 4),
  'enemy.chili.3': celda(3, 4),

  'enemy.wasabi.0': celda(0, 5),
  'enemy.wasabi.1': celda(1, 5),
  'enemy.wasabi.2': celda(2, 5),
  'enemy.wasabi.3': celda(3, 5),

  'enemy.ebi.0': celda(4, 5),
  'enemy.ebi.1': celda(5, 5),

  'enemy.sauce.0': celda(6, 5),
  'enemy.sauce.1': celda(7, 5),

  // --- objetos ------------------------------------------------------------
  'item.rice': celda(0, 6),
  'item.nigiri': celda(1, 6),
  'item.gari': celda(2, 6),
  'item.wasabi': celda(3, 6),
  'item.shoyu': celda(4, 6),
  'item.ohashi': celda(5, 6),
  'item.golden': celda(6, 6),
  'item.heart': celda(7, 6),

  // --- efectos e interfaz -------------------------------------------------
  'fx.sparkle': celda(0, 7),
  'fx.explosion': celda(1, 7),
  'fx.smoke': celda(2, 7),
  'fx.star': celda(3, 7),
  'fx.dash': celda(4, 7),
  'fx.orb': celda(5, 7),
  'ui.life': celda(6, 7),
  'ui.crown': celda(7, 7),
} as const;

export type FrameId = keyof typeof FRAMES;

/**
 * Animaciones: listas ordenadas de frames.
 *
 * Las filas 0 y 1 traen dos vueltas idénticas del mismo ciclo, así que solo se
 * usan los cuatro primeros de cada una. El ciclo va cerrado → medio → abierto →
 * medio para que la boca abra y cierre como en un comecocos, en vez de dar un
 * salto seco de abierta a cerrada.
 */
export const ANIMS = {
  walkRight: ['player.right.0', 'player.right.1', 'player.right.2', 'player.right.1'],
  walkLeft: ['player.left.0', 'player.left.1', 'player.left.2', 'player.left.1'],
  walkDown: ['player.down.0', 'player.down.1', 'player.down.2', 'player.down.3'],
  walkUp: ['player.up.0', 'player.up.1', 'player.up.2', 'player.up.3'],
  /** Quieto: respira entre el frente feliz y el guiño. */
  idle: ['player.happy.0', 'player.happy.0', 'player.happy.0', 'player.happy.1'],
  /** Al recoger algo especial. */
  happy: ['player.happy.1', 'player.happy.2', 'player.happy.3', 'player.happy.2'],
  spin: ['player.spin.0', 'player.spin.1', 'player.spin.2'],
  dead: ['player.dead'],

  chili: ['enemy.chili.0', 'enemy.chili.1', 'enemy.chili.2', 'enemy.chili.3'],
  wasabi: ['enemy.wasabi.0', 'enemy.wasabi.1', 'enemy.wasabi.2', 'enemy.wasabi.3'],
  ebi: ['enemy.ebi.0', 'enemy.ebi.1'],
  sauce: ['enemy.sauce.0', 'enemy.sauce.1'],
} as const satisfies Record<string, readonly FrameId[]>;

export type AnimId = keyof typeof ANIMS;

/**
 * CSS para pintar un frame como fondo de un `<div>` de lado `size`.
 * Lo usa el HUD, que vive en el DOM y no puede tocar texturas de Pixi.
 */
export function frameToCss(id: FrameId, size: number): React.CSSProperties {
  const f = FRAMES[id];
  // la hoja se escala para que la celda del frame mida `size`
  const k = size / f.width;
  return {
    width: size,
    height: Math.round(f.height * k),
    backgroundImage: `url(${SHEET_SRC})`,
    backgroundSize: `${SHEET_W * k}px ${SHEET_H * k}px`,
    backgroundPosition: `-${f.x * k}px -${f.y * k}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}
