/**
 * Tuning de la mecánica de clientes VIP + BTS Festival.
 * Un solo sitio para balancear tiempos, recompensas y el festival.
 *
 * Filosofía (del brief): objetivos secundarios que emocionan sin frustrar —
 * fallar un pedido NUNCA penaliza, solo se pierde el bonus.
 */

import { DESIGN } from './layout';

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

  /** espera del pedido según tier pedido: base + extra por nivel */
  waitMs: (tier: number) => 22_000 + tier * 6_000,

  /**
   * Dificultad de pedidos por puntuación: hasta qué tier puede pedir.
   * Al inicio piden comidas simples; con más puntos, platos avanzados
   * (tope: Poke Bowl, tier 5 — como pide el brief).
   */
  orderMaxTierByScore: [
    { score: 0, maxTier: 1 },
    { score: 400, maxTier: 2 },
    { score: 1_000, maxTier: 3 },
    { score: 2_200, maxTier: 4 },
    { score: 4_000, maxTier: 5 },
  ] as const,
  /** prob. de pedir el tier máximo permitido (si no, uno menos) */
  orderTopTierProb: 0.55,

  /** puntos por atender bien un pedido */
  rewardPoints: (tier: number) => 120 + tier * 60,

  /** dónde se para el cliente, en coordenadas de diseño (para el vuelo de la pieza) */
  standX: 96,
  standY: DESIGN.height - 52,

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
    /** pesos de spawn cargados a tiers altos (más comida de alto nivel) */
    spawnWeights: [10, 22, 30, 38] as const,
    /** ms entre ráfagas de confeti del renderer */
    confettiEveryMs: 700,
    /** pausa tras el festival antes de que vuelvan los clientes */
    afterDelayMs: 8_000,
  },
} as const;

/** Tier a pedir dado el score actual. */
export function rollOrderTier(score: number, rand: () => number = Math.random): number {
  let max: number = VIP.orderMaxTierByScore[0].maxTier;
  for (const band of VIP.orderMaxTierByScore) {
    if (score >= band.score) max = band.maxTier;
  }
  if (max <= 0) return 0;
  return rand() < VIP.orderTopTierProb ? max : max - 1;
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
