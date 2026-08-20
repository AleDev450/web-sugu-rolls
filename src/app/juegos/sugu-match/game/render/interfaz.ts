import type { CSSProperties } from 'react';
import type { Rect } from './sprites';

/**
 * Atlas de la interfaz de Sugu Match.
 *
 * Las láminas de /public/games/sugu-match/ (marco de objetivos, de
 * movimientos, de puntuación, barra de habilidades, tablero, estrellas, logo,
 * botón de pausa) son dibujos sueltos con MUCHO aire transparente alrededor y
 * con los huecos útiles —los slots donde van los iconos, la casilla donde va
 * el número— en sitios que no caen en ninguna proporción redonda.
 *
 * Este archivo es el único sitio donde viven esas medidas. Todas están en
 * píxeles del PNG original y salieron de recorrer el canal alfa y el color de
 * cada imagen, no de mirarlas a ojo. El CSS no repite ni una: pide los huecos
 * a `dentro()` y recibe porcentajes.
 *
 * ⚠️ Si se regenera cualquiera de estas imágenes hay que volver a medirla.
 * Cambiar un `clamp` del CSS no arregla un slot descuadrado: lo que manda es
 * dónde está pintado el hueco dentro del PNG.
 */

const BASE = '/games/sugu-match/';

export interface Lamina {
  src: string;
  /** Tamaño del PNG completo. */
  W: number;
  H: number;
  /** Bounding box del dibujo dentro del PNG: todo lo demás es alfa vacío. */
  caja: Rect;
}

// --- las láminas ----------------------------------------------------------

export const FONDO = `${BASE}background.png`;

export const LOGO: Lamina = {
  src: `${BASE}sugu_match.png`,
  W: 1448,
  H: 1086,
  caja: { x: 72, y: 50, w: 1310, h: 960 },
};

export const PAUSA: Lamina = {
  src: `${BASE}pausa.png`,
  W: 1254,
  H: 1254,
  caja: { x: 86, y: 70, w: 1077, h: 1084 },
};

/** Marco verde de objetivos: tres slots de icono y tres pastillas de número. */
export const OBJETIVOS: Lamina & { slots: Rect[]; pastillas: Rect[] } = {
  src: `${BASE}objetivos.png`,
  W: 1448,
  H: 1086,
  caja: { x: 44, y: 102, w: 1360, h: 839 },
  slots: [
    { x: 174, y: 382, w: 333, h: 300 },
    { x: 557, y: 382, w: 333, h: 300 },
    { x: 940, y: 382, w: 333, h: 300 },
  ],
  pastillas: [
    { x: 195, y: 703, w: 292, h: 114 },
    { x: 577, y: 703, w: 292, h: 114 },
    { x: 959, y: 703, w: 292, h: 114 },
  ],
};

/**
 * Marco rosa de movimientos: la caja crema donde va la cifra y, debajo, la
 * barra marrón sobre la que se apoyan las tres estrellas.
 */
export const MOVIMIENTOS: Lamina & { numero: Rect; barra: Rect } = {
  src: `${BASE}movimientos.png`,
  W: 1448,
  H: 1086,
  caja: { x: 72, y: 31, w: 1310, h: 1015 },
  // la crema real llega hasta y=783, pero por debajo de 755 ya la tapa la
  // barra: la cifra se centra solo en el trozo que queda a la vista
  numero: { x: 168, y: 269, w: 1134, h: 486 },
  barra: { x: 204, y: 766, w: 1039, h: 149 },
};

/** Marco azul de puntuación: una sola casilla turquesa. */
export const PUNTUACION: Lamina & { numero: Rect } = {
  src: `${BASE}puntuacion.png`,
  W: 1448,
  H: 1086,
  caja: { x: 19, y: 248, w: 1413, h: 537 },
  numero: { x: 104, y: 481, w: 1242, h: 238 },
};

/**
 * Barra inferior de habilidades: siete slots.
 *
 * Son exactamente los siete boosters de `config/boosters.ts`. Si algún día se
 * añade uno más, esta lámina se queda corta y hay que redibujarla — no vale
 * con estirar el CSS.
 */
export const INTERFAZ: Lamina & { slots: Rect[] } = {
  src: `${BASE}interface.png`,
  W: 2172,
  H: 724,
  caja: { x: 15, y: 184, w: 2142, h: 330 },
  slots: [
    { x: 80, y: 240, w: 218, h: 190 },
    { x: 379, y: 240, w: 218, h: 190 },
    { x: 678, y: 240, w: 218, h: 190 },
    { x: 977, y: 240, w: 218, h: 190 },
    { x: 1275, y: 240, w: 218, h: 190 },
    { x: 1574, y: 240, w: 218, h: 190 },
    { x: 1873, y: 240, w: 218, h: 190 },
  ],
};

/**
 * Las dos estrellas del marcador, en la misma lámina.
 *
 * Los dos recortes miden lo mismo y están centrados en su dibujo a propósito:
 * al pasar de apagada a ganada solo cambia el `background-position`, así que
 * la estrella no da un salto de un píxel al encenderse.
 */
export const ESTRELLAS: Lamina & { oro: Rect; apagada: Rect } = {
  src: `${BASE}estrellas.png`,
  W: 1448,
  H: 1086,
  caja: { x: 86, y: 202, w: 1254, h: 480 },
  oro: { x: 80, y: 200, w: 502, h: 484 },
  apagada: { x: 838, y: 202, w: 502, h: 484 },
};

// --- el tablero -----------------------------------------------------------

/**
 * La bandeja azul de 8x8.
 *
 * `rejilla` es la geometría real medida sobre la imagen: dónde empieza la
 * casilla (0,0) y cuánto avanza de una a la siguiente. No es `W / 8`: el marco
 * de la bandeja no mide lo mismo arriba que abajo, así que dividir la lámina
 * en ocho dejaría las piezas desplazadas medio hueco al llegar a la última
 * fila.
 *
 * Los pasos horizontal y vertical difieren en 0.16 px (133.70 contra 133.86).
 * La lámina se estira esa milésima para que la rejilla case exacta; a simple
 * vista es indistinguible y a cambio las 64 piezas caen clavadas en su hueco.
 */
export const TABLERO = {
  src: `${BASE}tablero.png`,
  W: 1254,
  H: 1254,
  cols: 8,
  rows: 8,
  rejilla: { x: 93.15, y: 103.07, pasoX: 133.7, pasoY: 133.86 },
} as const;

/**
 * Lo que mide la lámina entera expresado en casillas. Es lo que necesita
 * `BoardView.medir` para despejar el lado de casilla que cabe en el hueco:
 * el ancho útil no son 8 casillas, son 8 más el marco.
 */
export const TABLERO_ANCHO_EN_CASILLAS = TABLERO.W / TABLERO.rejilla.pasoX;
export const TABLERO_ALTO_EN_CASILLAS = TABLERO.H / TABLERO.rejilla.pasoY;

/** Distancia del borde de la lámina al centro de la primera casilla, en casillas. */
export const TABLERO_MARGEN_X = TABLERO.rejilla.x / TABLERO.rejilla.pasoX;
export const TABLERO_MARGEN_Y = TABLERO.rejilla.y / TABLERO.rejilla.pasoY;

// --- helpers de CSS -------------------------------------------------------

/**
 * CSS para que un elemento muestre EXACTAMENTE el rectángulo `r` de la lámina,
 * estirado hasta llenarlo.
 *
 * Se apoya en que quien lo use le dé al elemento la misma proporción que el
 * recorte (`aspect-ratio`, que también sale de aquí): si las proporciones
 * coinciden, "estirar hasta llenar" y "encajar sin deformar" son lo mismo.
 *
 * La cuenta del `background-position`: en porcentaje, el navegador alinea el
 * p% de la imagen con el p% del elemento, así que para dejar el recorte a la
 * izquierda del todo hace falta p = x / (W - w). Por eso no aparece por
 * ningún lado el tamaño final en píxeles: la fórmula se cancela sola y el
 * mismo estilo vale para un panel de 90 px y para uno de 300.
 */
export function recorteCss(lam: Lamina, r: Rect): CSSProperties {
  return {
    backgroundImage: `url(${lam.src})`,
    backgroundSize: `${(lam.W / r.w) * 100}% ${(lam.H / r.h) * 100}%`,
    backgroundPosition: `${lam.W === r.w ? 50 : (r.x / (lam.W - r.w)) * 100}% ${
      lam.H === r.h ? 50 : (r.y / (lam.H - r.h)) * 100
    }%`,
    backgroundRepeat: 'no-repeat',
    aspectRatio: `${r.w} / ${r.h}`,
  };
}

/** El dibujo entero de la lámina, sin el aire transparente que lo rodea. */
export function laminaCss(lam: Lamina): CSSProperties {
  return recorteCss(lam, lam.caja);
}

/**
 * Sitúa un hueco de la lámina como porcentajes de la CAJA, que es lo que
 * ocupa el elemento en pantalla.
 *
 * Devuelve directamente las cuatro propiedades de posicionamiento absoluto,
 * así que el componente solo tiene que hacer `style={dentro(OBJETIVOS, slot)}`
 * y olvidarse de dónde estaba pintado el hueco.
 */
export function dentro(lam: Lamina, r: Rect): CSSProperties {
  const c = lam.caja;
  return {
    position: 'absolute',
    left: `${((r.x - c.x) / c.w) * 100}%`,
    top: `${((r.y - c.y) / c.h) * 100}%`,
    width: `${(r.w / c.w) * 100}%`,
    height: `${(r.h / c.h) * 100}%`,
  };
}
