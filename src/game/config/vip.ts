/**
 * Tuning de la mecánica de clientes VIP + BTS Festival.
 * Un solo sitio para balancear tiempos, recompensas y el festival.
 *
 * Filosofía (del brief): objetivos secundarios que emocionan sin frustrar —
 * fallar un pedido NUNCA penaliza, solo se pierde el bonus.
 */

import { DESIGN } from './layout';
import { SPAWN_MAX_TIER } from './tiers';

/**
 * Tier mínimo que un cliente puede pedir.
 *
 * Se ata a `SPAWN_MAX_TIER`: ningún pedido puede ser algo que caiga solo del
 * cielo (onigiri, gyoza, hosomaki, temaki). Siempre hay que fusionar para
 * servirlo — que es la gracia de tener clientes. Si algún día cambia la tabla
 * de spawn, el suelo se mueve solo.
 */
export const MIN_ORDER_TIER = SPAWN_MAX_TIER + 1;

export const VIP = {
  /** ms hasta la primera visita de la partida (engancha pronto) */
  firstVisitDelayMs: 12_000,
  /** rango ms entre que un cliente se va y llega el siguiente */
  nextVisitDelayMs: [30_000, 45_000] as const,
  /** prob. de elegir un personaje aún no atendido (progreso de colección) */
  preferUnservedProb: 0.8,

  /** ms que tarda el cliente en entrar caminando / salir */
  enterMs: 1_100,
  leaveMs: 1_500,

  /**
   * Espera del pedido según tier pedido: base + extra por nivel.
   *
   * 2026-08-03: 22.000 + tier*6.000 -> 14.000 + tier*4.500. Con la regla nueva
   * todos los pedidos son de tier 4 o más, así que se caía siempre en los
   * tiempos más largos de la fórmula vieja: 46-58 s por cliente, de sobra para
   * cualquiera. Ahora van de 32 a 41 s y hay que ir a por el pedido en serio.
   */
  waitMs: (tier: number) => 14_000 + tier * 4_500,

  /**
   * Dificultad de pedidos por puntuación: hasta qué tier puede pedir.
   * El suelo siempre es MIN_ORDER_TIER (Ebi Roll), así que el primer cliente
   * ya obliga a fusionar; con más puntos suben a Poke Bowl y Dragon Roll.
   */
  orderMaxTierByScore: [
    { score: 0, maxTier: 4 },
    { score: 3_000, maxTier: 5 },
    { score: 10_000, maxTier: 6 },
  ] as const,
  /** prob. de pedir el tier máximo permitido (si no, uno menos) */
  orderTopTierProb: 0.55,

  /**
   * Puntos por atender bien un pedido. Curva más empinada que la original
   * (120 + tier*60): ahora todo pedido exige fusionar, así que el trabajo de
   * servirlo es mucho mayor y la recompensa tiene que acompañar.
   */
  rewardPoints: (tier: number) => 200 + tier * 140,

  /** dónde se para el cliente, en coordenadas de diseño (para el vuelo de la pieza) */
  standX: 96,
  standY: DESIGN.height - 52,

  /**
   * Tope del multiplicador de poderes (RJ × Fever × Festival).
   *
   * 2026-08-17: los tres se acumulaban sin límite y daban 2 × 1.5 × 2 = 6x,
   * que encima se multiplicaba por el combo. Justo durante el festival —el
   * momento en el que más se encadena— coincidían los tres. Con el tope en 3
   * siguen mereciendo la pena y siguen sumándose entre ellos, pero el techo
   * deja de dispararse.
   */
  maxScoreMul: 3,

  powers: {
    koyaMs: 8_000,
    koyaGravityMul: 0.45,
    rjMs: 10_000,
    rjMul: 2,
    feverMs: 10_000,
    feverMul: 1.5,
    /** VAN: duración y factor de rebote (piezas se asientan más rápido) */
    vanMs: 6_000,
    vanRestitutionMul: 0.7,
    /** empujón de MANG: velocidad horizontal máxima añadida */
    mangPush: 2.2,
    /** tiers que puede regalar COOKY (con sus pesos) */
    cookyTiers: [3, 4, 5] as const,
    cookyWeights: [50, 35, 15] as const,
  },

  festival: {
    durationMs: 20_000,
    scoreMul: 2,
    /** "la velocidad aumenta ligeramente" */
    gravityMul: 1.12,
    musicRate: 1.12,
    /**
     * Pesos de spawn cargados a tiers altos (más comida de alto nivel).
     *
     * 2026-08-17: [10, 22, 30, 38] -> [24, 30, 30, 16]. El reparto anterior
     * era una manguera de temaki justo en los 20 s en los que todo puntúa
     * doble: se encadenaban cascadas enteras sin construir nada. Sigue siendo
     * bastante mejor que el reparto normal —el temaki más que dobla su
     * probabilidad— pero ahora el festival premia al que llega con la pila
     * bien montada, no al que espera que le caiga hecho.
     */
    spawnWeights: [24, 30, 30, 16] as const,
    /** ms entre ráfagas de confeti del renderer */
    confettiEveryMs: 700,
    /** pausa tras el festival antes de que vuelvan los clientes */
    afterDelayMs: 8_000,
  },
} as const;

/**
 * Tier a pedir dado el score actual.
 *
 * El suelo se aplica DESPUÉS de la resta del `- 1`: si no, con máximo 4 el 45%
 * de los pedidos serían temaki, que cae solo y se sirve sin fusionar nada.
 */
export function rollOrderTier(score: number, rand: () => number = Math.random): number {
  let max: number = VIP.orderMaxTierByScore[0].maxTier;
  for (const band of VIP.orderMaxTierByScore) {
    if (score >= band.score) max = band.maxTier;
  }
  const tier = rand() < VIP.orderTopTierProb ? max : max - 1;
  return Math.max(MIN_ORDER_TIER, tier);
}

/** Tier del regalo de COOKY. */
export function rollCookyTier(rand: () => number = Math.random): number {
  const { cookyTiers, cookyWeights } = VIP.powers;
  const total = cookyWeights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < cookyTiers.length; i++) {
    r -= cookyWeights[i];
    if (r <= 0) return cookyTiers[i];
  }
  return cookyTiers[0];
}
