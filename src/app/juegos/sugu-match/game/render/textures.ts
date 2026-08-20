import { Assets, Rectangle, Texture, type Renderer } from 'pixi.js';
import { TABLERO } from './interfaz';
import { generarFx, generarPiezas, type TexturasFx } from './procedural';
import { FRAMES, SHEET_SRC, type FrameId } from './sprites';

/**
 * Gestor de texturas de Sugu Match.
 *
 * Intenta cargar el sprite sheet una sola vez. Si no está (todavía no se ha
 * subido, o falla la red) el juego NO se rompe: cae a las piezas generadas de
 * `procedural.ts` y sigue siendo jugable. En cuanto el PNG aparezca en
 * /public/games/sugu-match/spritesheet.png, esta misma función lo recorta y
 * los dibujos de repuesto dejan de usarse sin tocar una línea.
 *
 * Los recortes comparten la textura base, así que Pixi pinta todo el tablero
 * en una sola tanda por muchas piezas que haya.
 */

let hoja: Texture | null = null;
let bandeja: Texture | null = null;
let cargaIntentada = false;
const recortes = new Map<FrameId, Texture>();
let piezas: Map<string, Texture> | null = null;
let fx: TexturasFx | null = null;

/** Carga una imagen sin que un 404 tire la partida. */
async function cargarSuelta(src: string): Promise<Texture | null> {
  try {
    const t: Texture = await Assets.load(src);
    return t && t.width > 0 ? t : null;
  } catch {
    return null;
  }
}

export async function cargarTexturas(renderer: Renderer): Promise<void> {
  // los efectos y las capas se generan siempre: no viven en el atlas
  if (!fx) fx = generarFx(renderer);

  if (!cargaIntentada) {
    cargaIntentada = true;
    // en paralelo: son dos peticiones independientes y la bandeja no debe
    // retrasar la aparición de las piezas
    [hoja, bandeja] = await Promise.all([cargarSuelta(SHEET_SRC), cargarSuelta(TABLERO.src)]);
  }

  if (!hoja && !piezas) piezas = generarPiezas(renderer);
}

/** ¿Se está usando el sprite sheet definitivo o el dibujo de repuesto? */
export function hayHoja(): boolean {
  return hoja !== null;
}

/**
 * La bandeja de 8x8 dibujada, o null si no cargó.
 *
 * Devolver null no es un error: `BoardView` dibuja entonces la rejilla a mano
 * con Graphics, que es además lo que sigue usando cualquier nivel que no sea
 * de 8x8, porque la lámina solo tiene ese tamaño.
 */
export function texTablero(): Texture | null {
  return bandeja;
}

/**
 * Textura de un frame. Devuelve null si ese dibujo no existe todavía en el
 * repuesto —los adornos opcionales lo comprueban y se saltan sin más.
 */
export function tex(id: FrameId): Texture | null {
  if (!hoja) return piezas?.get(id) ?? null;

  let t = recortes.get(id);
  if (t) return t;

  const { x, y, w, h } = FRAMES[id];
  t = new Texture({ source: hoja.source, frame: new Rectangle(x, y, w, h) });
  recortes.set(id, t);
  return t;
}

/** Texturas de capas y efectos. Siempre disponibles tras `cargarTexturas`. */
export function fxTex(): TexturasFx {
  if (!fx) throw new Error('cargarTexturas() no se ha llamado todavía');
  return fx;
}

/**
 * Se llama al desmontar el juego. La hoja se queda en la caché de `Assets`:
 * volver a entrar a una partida no debería descargarla otra vez.
 */
export function liberarTexturas() {
  recortes.forEach((t) => t.destroy(false));
  recortes.clear();
  piezas?.forEach((t) => t.destroy(true));
  piezas = null;
  if (fx) {
    Object.values(fx).forEach((t) => t.destroy(true));
    fx = null;
  }
  hoja = null;
  bandeja = null;
  cargaIntentada = false;
}
