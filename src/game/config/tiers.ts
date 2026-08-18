/**
 * Cadena de evolución — 10 niveles, tal cual el boceto.
 *
 * `radius` está en unidades de diseño (el tablero mide DESIGN.board.w = 380).
 * El renderer escala todo por un único factor, así que estos números no cambian
 * aunque cambie el tamaño de pantalla.
 *
 * 2026-07-31: radios subidos ~22% (los productos se veían muy pequeños).
 * Para agrandar/achicar TODA la cadena a la vez, tocar `ESCALA_PIEZAS`; los
 * números de aquí abajo son las proporciones de diseño y no hace falta
 * moverlos salvo que se quiera cambiar una pieza suelta respecto al resto.
 *
 * `sprite` apunta a una clave del manifest de assets. Mientras la imagen no
 * exista, el renderer dibuja el fallback procedural con `palette`.
 */

export type TierKind =
  | 'onigiri'
  | 'gyoza'
  | 'maki'
  | 'futomaki'
  | 'roll'
  | 'california'
  | 'dragon'
  | 'acevichado'
  | 'especial'
  | 'supreme';

export interface Tier {
  /** índice 0-based, coincide con la posición en TIERS */
  index: number;
  /** id estable para persistencia / analytics — nunca renombrar */
  id: string;
  name: string;
  kind: TierKind;
  /** radio del dibujo, en unidades de diseño */
  radius: number;
  /**
   * Radio del collider como fracción de `radius`. Ausente o 1 = el círculo de
   * colisión coincide con el dibujo.
   *
   * Se baja en las piezas cuyo arte no llena el círculo —el onigiri es un
   * triángulo, los rolls dejan las esquinas vacías— para que se apilen más
   * juntas y no parezca que chocan contra el aire. NO cambia el tamaño del
   * sprite: solo la física. Con la tecla D se ve el círculo resultante.
   */
  hitScale?: number;
  /** puntos que otorga CREAR esta pieza al fusionar */
  points: number;
  /** clave en ASSETS.sushi */
  sprite: string;
  /** colores del fallback procedural (mientras no hay imagen) */
  palette: {
    base: string;
    accent: string;
    wrap?: string;
    fill?: string;
  };
}

/**
 * Cuánto se agrandan TODAS las piezas respecto al tamaño de diseño original.
 *
 * 2026-08-18: 1 -> 1.15 -> 1.25. Las partidas duraban demasiado: con las
 * piezas pequeñas cabía tanto en la caja que llenarla costaba muchísimo. Lo
 * que importa no es el radio sino la superficie, que va al cuadrado: con 1.25
 * cada pieza ocupa un 56% más que al principio, así que en la caja entran
 * ~36% menos piezas y la línea de peligro llega bastante antes.
 *
 * Es el único número que hay que tocar para ajustar la duración: sube para
 * partidas más cortas, baja para más largas. Mantiene las proporciones de toda
 * la cadena, que están pensadas para que cada escalón se note.
 *
 * EFECTO EN LA PUNTA DE LA CADENA. Las dos piezas más grandes dejan de caber
 * lado a lado en los 380px de la caja: el Supreme a partir de ~1.08 y el Sugu
 * Especial a partir de ~1.10. No rompe nada —dos iguales siguen fusionando al
 * tocarse, apilada una sobre otra— pero a partir de ahí la punta de la cadena
 * se juega en vertical y empuja la pila hacia arriba mucho más rápido. Es
 * parte de por qué las partidas se acortan; si algún día se quiere revertir
 * solo eso, bajar `ESCALA_PIEZAS` por debajo de 1.08.
 */
export const ESCALA_PIEZAS = 1.25;

/** Aplica la escala al radio de diseño. Una decimal basta: la física no nota más. */
const r = (base: number) => Math.round(base * ESCALA_PIEZAS * 10) / 10;

export const TIERS: Tier[] = [
  {
    index: 0,
    id: 'onigiri',
    name: 'Onigiri',
    kind: 'onigiri',
    radius: r(20),
    hitScale: 0.88,
    points: 10,
    sprite: '01-onigiri',
    palette: { base: '#fbf6ec', accent: '#e9dcc4', wrap: '#2b3540' },
  },
  {
    index: 1,
    id: 'gyoza',
    name: 'Gyoza',
    kind: 'gyoza',
    radius: r(26),
    hitScale: 0.9,
    points: 30,
    sprite: '02-gyoza',
    palette: { base: '#f3e6c8', accent: '#dcc79b', wrap: '#c9ad7c' },
  },
  {
    index: 2,
    id: 'hosomaki',
    name: 'Hosomaki',
    kind: 'maki',
    radius: r(33),
    points: 60,
    sprite: '03-hosomaki',
    palette: { base: '#1a2129', accent: '#8bb04a', fill: '#8bb04a' },
  },
  {
    // 2026-07-31: Temaki reemplaza a Futomaki (nuevo set de comidas).
    // `kind` sigue siendo 'futomaki' solo para el dibujo de respaldo.
    index: 3,
    id: 'temaki',
    name: 'Temaki',
    kind: 'futomaki',
    radius: r(42),
    // cono en diagonal: dos esquinas del cuadro quedan completamente vacías
    hitScale: 0.84,
    points: 100,
    sprite: '04-temaki',
    palette: { base: '#1a2129', accent: '#f2c14e', fill: '#f2c14e' },
  },
  {
    index: 4,
    id: 'ebi-roll',
    name: 'Ebi Roll',
    kind: 'roll',
    radius: r(50),
    hitScale: 0.86,
    points: 150,
    sprite: '05-ebi-roll',
    palette: { base: '#fbf6ec', accent: '#f4956b', fill: '#f4956b' },
  },
  {
    // 2026-07-31: Poke Bowl reemplaza a California Roll (nuevo set de comidas).
    index: 5,
    id: 'pokebowl',
    name: 'Poke Bowl',
    kind: 'california',
    radius: r(60),
    hitScale: 0.9,
    points: 210,
    sprite: '06-pokebowl',
    palette: { base: '#fbf6ec', accent: '#f4784f', wrap: '#e6c98f' },
  },
  {
    index: 6,
    id: 'dragon-roll',
    name: 'Dragon Roll',
    kind: 'dragon',
    radius: r(71),
    hitScale: 0.86,
    points: 280,
    sprite: '07-dragon-roll',
    palette: { base: '#a4d07a', accent: '#8bb04a', wrap: '#7fae4f' },
  },
  {
    index: 7,
    id: 'acevichado-roll',
    name: 'Acevichado Roll',
    kind: 'acevichado',
    radius: r(83),
    hitScale: 0.84,
    points: 360,
    sprite: '08-acevichado-roll',
    palette: { base: '#f4b06b', accent: '#f4784f', wrap: '#f2a84e' },
  },
  {
    index: 8,
    id: 'sugu-especial',
    name: 'Sugu Especial',
    kind: 'especial',
    radius: r(96),
    hitScale: 0.9,
    points: 450,
    sprite: '09-sugu-especial',
    palette: { base: '#f7d9a0', accent: '#f4784f', wrap: '#e8a04f' },
  },
  {
    index: 9,
    id: 'sugu-supreme',
    name: 'Sugu Supreme',
    kind: 'supreme',
    radius: r(110),
    // cilindro de esquinas redondeadas: el círculo que lo envuelve sobra mucho
    hitScale: 0.8,
    points: 550,
    sprite: '10-sugu-supreme',
    palette: { base: '#f2c14e', accent: '#f4784f', wrap: '#d99b28' },
  },
];

export const MAX_TIER = TIERS.length - 1;

/** Solo los primeros tiers caen desde arriba. */
export const SPAWN_MAX_TIER = 3;

/**
 * Probabilidad de que caiga cada tier (onigiri, gyoza, hosomaki, temaki).
 *
 * 2026-08-17: [34, 28, 22, 16] -> [46, 30, 17, 7]. Con el reparto anterior
 * casi la mitad de las fichas ya venían medio hechas y las cadenas se
 * resolvían solas; el temaki, que es el escalón que abre los pedidos de los
 * clientes, salía una de cada seis veces. Ahora la mayoría de lo que cae es
 * onigiri y gyoza: el tablero sube de nivel porque LO FUSIONAS, no porque te
 * lo regalen. La suma no tiene por qué dar 100, `rollSpawnTier` normaliza.
 */
export const SPAWN_WEIGHTS = [46, 30, 17, 7];

export function rollSpawnTier(
  rand: () => number = Math.random,
  weights: readonly number[] = SPAWN_WEIGHTS
): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i <= SPAWN_MAX_TIER; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

export function tierAt(index: number): Tier {
  return TIERS[Math.max(0, Math.min(MAX_TIER, index))];
}

/**
 * Radio del cuerpo físico. Es el único que debe usar la física; el renderer
 * dibuja con `radius` a secas, que es el tamaño visible de la pieza.
 */
export function hitRadius(index: number): number {
  const t = tierAt(index);
  return t.radius * (t.hitScale ?? 1);
}
