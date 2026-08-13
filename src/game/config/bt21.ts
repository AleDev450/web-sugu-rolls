/**
 * Clientes VIP BT21 — mecánica secundaria sobre el Suika base.
 *
 * Los personajes NO son piezas fusionables: son clientes que visitan el
 * restaurante, piden un plato de la cadena y, si se les sirve a tiempo,
 * activan un poder único + puntos. Atender a los 7 en la misma partida
 * dispara el BTS Festival (ver vip.ts).
 *
 * VAN NO VISITA. Sigue definido aquí abajo con su poder y su sprite, pero se
 * queda fuera del reparto: la colección son 7, no 8. Para devolverlo al juego
 * basta con sacar su id de `FUERA_DE_JUEGO`.
 *
 * NOTA LEGAL: BT21 es IP de LINE Friends / HYBE. Esto queda implementado como
 * lo pide el boceto, pero la capa de personajes está aislada en este archivo
 * a propósito: cambiar a mascotas propias es editar solo esto + sus sprites.
 */

export type Bt21Id =
  | 'koya'
  | 'rj'
  | 'shooky'
  | 'mang'
  | 'chimmy'
  | 'tata'
  | 'cooky'
  | 'van';

export type VipPower =
  | 'low-gravity' // KOYA — todo cae más lento un rato
  | 'double-score' // RJ — x2 puntos un rato
  | 'clear-small' // SHOOKY — elimina la pieza más pequeña del tablero
  | 'tidy-center' // MANG — empuja las piezas hacia el centro
  | 'evolve-random' // CHIMMY — evoluciona una pieza aleatoria
  | 'fever' // TATA — Modo Fever: bonus en todas las fusiones
  | 'gift-food' // COOKY — regala una pieza ya evolucionada
  | 'calm-bounce'; // VAN — menos rebote: las piezas se asientan más rápido

export interface Bt21Char {
  id: Bt21Id;
  name: string;
  /** clave en ASSETS.bt21 */
  sprite: string;
  /** color de acento del personaje (chips, partículas, brillo) */
  color: string;
  power: VipPower;
  /** nombre corto del poder, para el toast al activarse */
  powerName: string;
  powerDesc: string;
}

const TODOS: Bt21Char[] = [
  {
    id: 'koya',
    name: 'KOYA',
    sprite: 'koya',
    color: '#5aa8e0',
    power: 'low-gravity',
    powerName: 'SUEÑO PROFUNDO',
    powerDesc: 'Las piezas caen más lento durante unos segundos.',
  },
  {
    id: 'rj',
    name: 'RJ',
    sprite: 'rj',
    color: '#f5efe4',
    power: 'double-score',
    powerName: 'FESTÍN DE RJ',
    powerDesc: 'Duplica todos los puntos durante unos segundos.',
  },
  {
    id: 'shooky',
    name: 'SHOOKY',
    sprite: 'shooky',
    color: '#8a5a3a',
    power: 'clear-small',
    powerName: 'TRAVESURA CRUJIENTE',
    powerDesc: 'Se come la pieza más pequeña del tablero.',
  },
  {
    id: 'mang',
    name: 'MANG',
    sprite: 'mang',
    color: '#8e6fc4',
    power: 'tidy-center',
    powerName: 'BAILE MAGNÉTICO',
    powerDesc: 'Empuja suavemente las piezas hacia el centro.',
  },
  {
    id: 'chimmy',
    name: 'CHIMMY',
    sprite: 'chimmy',
    color: '#f2c14e',
    power: 'evolve-random',
    powerName: 'PASIÓN EVOLUTIVA',
    powerDesc: 'Evoluciona una pieza aleatoria al siguiente nivel.',
  },
  {
    id: 'tata',
    name: 'TATA',
    sprite: 'tata',
    color: '#e0463c',
    power: 'fever',
    powerName: 'PODER ELÁSTICO',
    powerDesc: 'Todas las fusiones dan puntos extra durante unos segundos.',
  },
  {
    id: 'cooky',
    name: 'COOKY',
    sprite: 'cooky',
    color: '#f48fb1',
    power: 'gift-food',
    powerName: 'FUERZA MUSCULOSA',
    powerDesc: 'Regala una pieza ya evolucionada, lista para caer.',
  },
  {
    id: 'van',
    name: 'VAN',
    sprite: 'van',
    color: '#aab2bd',
    power: 'calm-bounce',
    powerName: 'PULSO PROTECTOR',
    powerDesc: 'Reduce el rebote de las piezas un 30%: caen y se estabilizan más rápido.',
  },
];

/** Personajes definidos pero retirados del reparto. */
const FUERA_DE_JUEGO: Bt21Id[] = ['van'];

/**
 * Los que de verdad visitan el restaurante. Todo lo demás —la colección, el
 * corte del BTS Festival, el sorteo del siguiente cliente— sale de aquí, así
 * que retirar a alguien no obliga a tocar ningún otro archivo.
 */
export const BT21: Bt21Char[] = TODOS.filter((c) => !FUERA_DE_JUEGO.includes(c.id));

export function estaEnJuego(id: Bt21Id): boolean {
  return !FUERA_DE_JUEGO.includes(id);
}

/** Busca entre TODOS, no solo entre los activos: una partida guardada puede
 *  referirse a un personaje ya retirado y no debe reventar. */
export function bt21ById(id: Bt21Id): Bt21Char {
  const c = TODOS.find((c) => c.id === id);
  if (!c) throw new Error(`BT21 desconocido: ${id}`);
  return c;
}
